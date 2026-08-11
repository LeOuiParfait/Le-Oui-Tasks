# 📧 Configuration des emails Firebase Auth

## ⚠️ IMPORTANT : Configurer l'URL de réinitialisation

Pour que les utilisateurs soient redirigés vers ta page custom de réinitialisation de mot de passe, tu dois configurer Firebase Auth.

---

## 🔧 Étape 1 : Configurer l'URL dans Firebase Console

1. Ouvre [Firebase Console](https://console.firebase.google.com/project/gestion-projet-3d1ab/authentication/emails)
2. Va dans **Authentication** → **Templates** (ou **Modèles**)
3. Clique sur **Réinitialisation du mot de passe** (Password reset)
4. Clique sur l'icône **crayon** (modifier)

### Configuration de l'URL d'action

Dans la section **URL d'action** :

**URL à configurer** :
```
http://localhost:5173/reset-password
```

**Pour la production** :
```
https://ton-domaine.com/reset-password
```

5. Coche **Personnaliser l'URL d'action**
6. Entre l'URL ci-dessus
7. Clique **Enregistrer**

---

## 📝 Étape 2 : Personnaliser le template d'email (optionnel)

Tu peux aussi personnaliser le contenu de l'email :

### Template recommandé :

**Objet** : Réinitialisation de votre mot de passe - Le Oui Parfait

**Corps** :
```
Bonjour,

Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Le Oui Parfait.

Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :

%LINK%

Ce lien expirera dans 1 heure.

Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.

Cordialement,
L'équipe Le Oui Parfait
```

---

## 🎨 Étape 3 : Personnaliser les couleurs (optionnel)

Dans la même page, tu peux personnaliser :
- **Couleur principale** : `#2563eb` (brand)
- **Nom de l'application** : Le Oui Parfait
- **Logo** : Upload ton logo

---

## ✅ Étape 4 : Tester

1. Lance l'app : `npm run dev`
2. Va dans **Paramètres** → **Membres & Invitations**
3. Invite un nouveau membre ou clique **Renvoyer** sur un membre existant
4. Vérifie l'email reçu
5. Clique sur le lien
6. Tu dois arriver sur ta page custom `/reset-password` avec ton design

---

## 🔒 Domaines autorisés

Assure-toi que ton domaine est autorisé dans Firebase :

1. Va dans **Authentication** → **Settings** → **Authorized domains**
2. Ajoute :
   - `localhost` (déjà présent)
   - `ton-domaine.com` (pour la production)

---

## 📊 Vérifier que ça marche

### Test complet :

1. **Invitation** : Invite un membre
2. **Email** : Vérifie que l'email arrive (spam inclus)
3. **Lien** : Clique sur le lien dans l'email
4. **Page custom** : Tu arrives sur `/reset-password` avec ton design
5. **Nouveau mot de passe** : Entre un nouveau mot de passe
6. **Redirection** : Tu es redirigé vers `/` (connexion)
7. **Connexion** : Tu peux te connecter avec le nouveau mot de passe

---

## 🐛 Dépannage

### L'email va dans les spams

**Solutions** :
1. Ajoute `noreply@gestion-projet-3d1ab.firebaseapp.com` aux contacts
2. Configure SPF/DKIM pour ton domaine (production)
3. Utilise un domaine custom pour les emails (Firebase Auth Custom Email)

### Le lien redirige vers Firebase

**Cause** : L'URL d'action n'est pas configurée dans Firebase Console  
**Solution** : Suis l'Étape 1 ci-dessus

### Erreur "Lien invalide"

**Causes possibles** :
- Le lien a expiré (1 heure)
- Le lien a déjà été utilisé
- Le code `oobCode` est manquant dans l'URL

**Solution** : Clique sur **Renvoyer** pour obtenir un nouveau lien

---

## 🎯 Résultat final

Après configuration, le flow sera :

1. **Admin** invite un membre → Email envoyé
2. **Membre** reçoit l'email → Clique sur le lien
3. **Page custom** s'ouvre avec ton design brand
4. **Membre** entre son nouveau mot de passe
5. **Succès** → Message de confirmation + redirection automatique
6. **Connexion** → Le membre se connecte avec son nouveau mot de passe

---

**Date** : 2026-08-11  
**Version** : 1.0.0  
**Statut** : ✅ Page créée, configuration Firebase requise
