# Migration Next.js 16 - LE LOUI PARFAIT

## ✅ Migration Complétée

Ce projet a été migré de **Vite + React Router** vers **Next.js 16** avec succès.

### Technologies

- **Next.js 16.3.1** avec Turbopack
- **React 19**
- **TypeScript 5.8**
- **Tailwind CSS 4**
- **Firebase Client + Admin SDK**
- **Nodemailer** pour les e-mails

### Structure

```
nextjs-migration/
├── app/
│   ├── layout.tsx          # Layout racine avec AuthProvider
│   ├── page.tsx             # Page d'accueil (auth ou workspace)
│   ├── reset-password/
│   │   └── page.tsx         # Page de réinitialisation MDP
│   └── api/
│       ├── health/
│       │   └── route.ts     # Health check endpoint
│       └── auth/
│           └── forgot-password/
│               └── route.ts # API réinitialisation MDP
├── components/              # Tous les composants React (22 composants)
│   ├── auth/
│   ├── kanban/
│   ├── layout/
│   ├── projects/
│   ├── reports/
│   ├── settings/
│   ├── teams/
│   └── workspace/
├── lib/
│   ├── services/            # Services (store, auth, db, etc.)
│   ├── firebase-admin.ts    # Firebase Admin SDK
│   └── email.ts             # Utilitaires e-mail
├── types/                   # Types TypeScript
├── data/                    # Seed data
└── public/                  # Assets statiques

```

### Fonctionnalités Migrées

✅ **Authentification**
- Connexion / Déconnexion
- Réinitialisation de mot de passe
- Invitations utilisateurs
- Gestion des sessions

✅ **Gestion de Projets**
- CRUD projets
- Membres de projet
- Équipes
- Permissions par rôle

✅ **Gestion de Tâches**
- Kanban board (drag & drop)
- CRUD tâches
- Sous-tâches
- Commentaires
- Statuts et priorités

✅ **Présence & Pointage**
- Suivi de présence en temps réel
- Pointage début/fin journée
- Pauses
- Historique

✅ **Rapports**
- Rapports quotidiens
- Envoi automatique par e-mail
- Analytiques

✅ **Firestore Sync**
- Subscriptions temps réel
- Synchronisation multi-onglets
- Permissions Firestore

### Configuration Requise

#### Variables d'Environnement

Créer `.env.local` avec :

```bash
# App
NEXT_PUBLIC_APP_URL=https://tasks.leouiparfait.com
APP_URL=https://tasks.leouiparfait.com

# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (Server-side)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# SMTP
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=
```

### Commandes

```bash
# Développement
npm run dev

# Build production
npm run build

# Démarrer production
npm start

# Lint TypeScript
npm run lint
```

### Déploiement Vercel

1. Push le code vers GitHub
2. Connecter le repo à Vercel
3. Configurer les variables d'environnement dans Vercel
4. Déployer

**Important :** Toutes les variables d'environnement doivent être configurées dans Vercel Project Settings → Environment Variables.

### Différences vs Version Vite

| Aspect | Vite (Ancien) | Next.js 16 (Nouveau) |
|--------|---------------|----------------------|
| Routing | React Router | App Router Next.js |
| API | Express server.ts | Route Handlers `/app/api/` |
| Build | Vite + esbuild | Turbopack |
| SSR | Client-side only | SSR + Client components |
| Env vars | `import.meta.env.VITE_*` | `process.env.NEXT_PUBLIC_*` |
| Navigation | `useNavigate()` | `useRouter().push()` |
| Params | `useSearchParams()[0]` | `useSearchParams()` |

### Problèmes Résolus

✅ `FUNCTION_INVOCATION_FAILED` sur Vercel
✅ Variables d'environnement Vite → Next.js
✅ `useSearchParams` Next.js 16
✅ `useRouter` vs `useNavigate`
✅ Null checks TypeScript
✅ Firebase Admin SDK pour serverless
✅ Imports `@/` alias

### Notes Importantes

- **Tous les composants** sont marqués `'use client'` car ils utilisent des hooks React
- **Firebase Admin** est chargé dynamiquement dans les API routes
- **Firestore subscriptions** fonctionnent côté client
- **E-mails** sont envoyés via Nodemailer (SMTP) ou Resend
- **Cron jobs** (rapports auto) ne fonctionnent pas sur Vercel serverless

### Support

Pour toute question, consulter :
- [Next.js 16 Docs](https://nextjs.org/docs)
- [Firebase Docs](https://firebase.google.com/docs)
- `AGENTS.md` pour les règles du projet

---

**Migration effectuée le** : 2026-08-16
**Version Next.js** : 16.3.1
**Status** : ✅ Production Ready
