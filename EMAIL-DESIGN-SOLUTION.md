# ✉️ Email Design Firebase — Limitation & Solution

## ⚠️ Problème : Firebase free plan (Spark)

**Firebase Console te dit** : "Impossible de modifier le design des emails."

**Pourquoi ?**
- Le **Spark (free) plan** de Firebase Auth ne permet pas de personnaliser les templates d'emails.
- Tu peux définir un **nom de projet** et une **langue**, mais pas le HTML/CSS.
- La **redirection URL custom** est maintenant passée dans le code (`resetPasswordSettings`).

**Pour avoir des emails personnalisés**, il faut :
1. Passer au plan **Blaze (pay-as-you-go)**
2. OU envoyer les emails toi-même via un backend Node.js

---

## ✅ Solution retenue : Redirection custom corrigée

J'ai corrigé la **redirection** dans `src/services/authService.ts` :

```typescript
const RESET_PASSWORD_URL = typeof window !== 'undefined'
  ? `${window.location.origin}/reset-password`
  : 'http://localhost:5173/reset-password';

const resetPasswordSettings: ActionCodeSettings = {
  url: RESET_PASSWORD_URL,
  handleCodeInApp: false
};
```

Toutes les fonctions `sendPasswordResetEmail` utilisent maintenant `resetPasswordSettings` :
- `createMemberAsAdmin`
- `resendInvitation`
- `resetPassword`

### Flow maintenant :

1. Admin invite un membre
2. Firebase envoie l'email (template par défaut, non modifiable en free)
3. Le membre clique sur le lien
4. Firebase gère le `oobCode`
5. Firebase redirige vers : `http://localhost:5173/reset-password?oobCode=XXX&mode=resetPassword`
6. Ta **page custom** s'affiche avec ton design
7. Le membre entre son nouveau mot de passe
8. Redirection automatique vers l'app (`/`)

---

## 🔧 Si tu veux vraiment des emails designés

### Option 1 : Upgrade Firebase Blaze (rapide)

1. Va dans Firebase Console → Upgrade
2. Active **Blaze (pay-as-you-go)**
3. Puis : Authentication → Templates → Réinitialisation
4. Tu pourras personnaliser le HTML de l'email
5. Colle le template que je t'ai donné

### Option 2 : Backend Node.js custom (gratuit)

**Principe** : Firebase génère le lien, ton serveur envoie l'email.

**Avantages** :
- Emails 100% personnalisés
- Pas besoin de payer Firebase
- Tu contrôles le design, l'expéditeur, etc.

**Inconvénients** :
- Besoin d'un email provider (Resend, SendGrid, Mailgun)
- Configuration DNS (SPF, DKIM) pour le domaine
- Ton domaine `tasking.app` doit être vérifié chez Resend

#### Code backend avec Resend + Firebase Admin SDK

**Prérequis** :
- Clé Resend (`RESEND_API_KEY`)
- Domaine vérifié chez Resend
- Credentials Firebase Admin

```typescript
// server.ts — ajoute cette route
import { initializeApp as initializeAdminApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Resend } from 'resend';

const adminApp = initializeAdminApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  })
});

const adminAuth = getAuth(adminApp);
const resend = new Resend(process.env.RESEND_API_KEY);

app.post('/api/send-invitation', async (req, res) => {
  try {
    const { email, firstName, appName } = req.body;
    
    const actionCodeSettings = {
      url: `${process.env.APP_URL}/reset-password`,
      handleCodeInApp: false
    };
    
    // Generate Firebase reset link with custom redirect
    const link = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);
    
    // Send with Resend (your verified domain)
    await resend.emails.send({
      from: 'Le Oui Parfait <noreply@tasking.app>',
      to: email,
      subject: `${appName} — Activez votre compte`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="margin:0; padding:0; background:#f5f5f4; font-family:Arial,sans-serif;">
            <table width="100%" style="background:#f5f5f4; padding:40px 20px;">
              <tr><td align="center">
                <table width="600" style="background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.08);">
                  <tr>
                    <td style="background:linear-gradient(135deg,#0d9488,#0f766e); padding:40px; text-align:center;">
                      <h1 style="margin:0; color:#fff; font-size:24px;">${appName}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:40px;">
                      <p style="font-size:16px; color:#44403c;">Bonjour ${firstName},</p>
                      <p style="font-size:15px; color:#57534e; line-height:1.7;">
                        Votre compte a été créé. Cliquez sur le bouton pour définir votre mot de passe.
                      </p>
                      <p style="text-align:center; margin:32px 0;">
                        <a href="${link}" style="background:linear-gradient(135deg,#0d9488,#0f766e); color:#fff; padding:16px 40px; text-decoration:none; border-radius:10px; font-weight:600; display:inline-block;">
                          Définir mon mot de passe
                        </a>
                      </p>
                      <p style="font-size:13px; color:#78716c;">
                        Si le bouton ne fonctionne pas : <a href="${link}" style="color:#0f766e;">${link}</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </body>
        </html>
      `
    });
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**MAIS** : ton domaine `tasking.app` n'est pas vérifié chez Resend → tu as déjà eu l'erreur.

### Option 3 : Utiliser un domaine vérifié gratuit pour tests

Pendant le développement, tu peux utiliser un email de test :
- `@gmail.com`
- Envoi via **Gmail SMTP** (Nodemailer)
- Voir : https://myaccount.google.com/apppasswords

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});
```

---

## ✅ Recommandation immédiate

**Garde la solution Firebase actuelle** : `sendPasswordResetEmail` avec `resetPasswordSettings`.

- ✅ Gratuit
- ✅ L'email part (même s'il va dans les spams)
- ✅ La page custom `/reset-password` s'affiche après le lien
- ✅ Redirection vers l'app après changement de mot de passe
- ❌ Email non personnalisé (template Firebase)

**Pour personnaliser l'email**, il faut :
- Upgrade Blaze (5€/mois en moyenne)
- OU configurer Resend/Gmail + backend

---

## 🎨 Astuce pour améliorer l'email sans payer

Même avec le template Firebase par défaut, tu peux améliorer l'expérience côté **page de réinitialisation** :
- ✅ Design moderne (déjà fait)
- ✅ Logo + couleurs brand
- ✅ Message de succès
- ✅ Redirection auto
- ✅ Gestion des erreurs

Le membre ne voit le template email que 2 secondes avant de cliquer. La **page custom** est ce qu'il verra le plus.

---

## 📋 Prochaines étapes

1. ✅ Redirection corrigée dans `authService.ts`
2. ✅ Build TypeScript OK
3. ⏭️ Teste une invitation/réinitialisation maintenant
4. ⏭️ Si l'email va dans les spams, ajoute `noreply@...` en contact
5. ⏭️ Si tu veux vraiment le design, upgrade Blaze ou configure Resend

---

**Date** : 2026-08-11
