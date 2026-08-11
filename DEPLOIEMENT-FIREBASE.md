# 🚀 Guide de Déploiement Firebase — Le Oui Parfait

## ⚠️ IMPORTANT : Déployer les règles et indexes Firestore

Les corrections apportées au projet **nécessitent** de déployer les nouvelles règles Firestore et les indexes composites. Sans cela, l'application **NE FONCTIONNERA PAS CORRECTEMENT**.

---

## 📋 Pré-requis

1. **Firebase CLI installé** :
   ```bash
   npm install -g firebase-tools
   ```

2. **Connexion à Firebase** :
   ```bash
   firebase login
   ```

3. **Projet Firebase initialisé** :
   - Projet ID : `gestion-projet-3d1ab`
   - Vérifier avec : `firebase projects:list`

---

## 🔥 Méthode 1 : Déploiement via Firebase CLI (RECOMMANDÉ)

### Étape 1 : Initialiser Firebase dans le projet (si pas déjà fait)

```bash
cd "C:\Users\Junel\Travail\Mes projets\tasking---remote-work-&-project-platform"
firebase init
```

**Sélectionner** :
- ✅ Firestore
- ✅ Hosting (optionnel)

**Configuration** :
- Firestore rules file : `firestore.rules` ✅ (déjà existant)
- Firestore indexes file : `firestore.indexes.json` ✅ (déjà existant)
- Public directory : `dist` (pour hosting)

### Étape 2 : Déployer les règles Firestore

```bash
firebase deploy --only firestore:rules
```

**Résultat attendu** :
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/gestion-projet-3d1ab/overview
```

### Étape 3 : Déployer les indexes Firestore

```bash
firebase deploy --only firestore:indexes
```

**Résultat attendu** :
```
✔  firestore: deployed indexes in firestore.indexes.json successfully
```

**Note** : La création des indexes peut prendre **plusieurs minutes**. Firebase enverra un email quand c'est terminé.

### Étape 4 : Vérifier le déploiement

```bash
firebase firestore:indexes
```

Devrait afficher les 8 indexes créés.

---

## 🌐 Méthode 2 : Déploiement via Firebase Console (MANUEL)

### Déployer les règles Firestore

1. Ouvrir [Firebase Console](https://console.firebase.google.com/project/gestion-projet-3d1ab/firestore)
2. Aller dans **Firestore Database** → **Rules**
3. Copier le contenu de `firestore.rules`
4. Coller dans l'éditeur
5. Cliquer sur **Publier**

### Créer les indexes Firestore

1. Ouvrir [Firebase Console](https://console.firebase.google.com/project/gestion-projet-3d1ab/firestore/indexes)
2. Aller dans **Firestore Database** → **Indexes** → **Composite**
3. Créer **manuellement** chaque index depuis `firestore.indexes.json` :

#### Index 1 : notifications
- Collection : `notifications`
- Champs :
  - `userId` : Ascending
  - `createdAt` : Descending
- Query scope : Collection

#### Index 2 : comments
- Collection : `comments`
- Champs :
  - `taskId` : Ascending
  - `createdAt` : Descending
- Query scope : Collection

#### Index 3 : attendance (date)
- Collection : `attendance`
- Champs :
  - `organizationId` : Ascending
  - `date` : Descending
- Query scope : Collection

#### Index 4 : attendance (user + date)
- Collection : `attendance`
- Champs :
  - `organizationId` : Ascending
  - `userId` : Ascending
  - `date` : Descending
- Query scope : Collection

#### Index 5 : tasks (project)
- Collection : `tasks`
- Champs :
  - `organizationId` : Ascending
  - `projectId` : Ascending
  - `createdAt` : Descending
- Query scope : Collection

#### Index 6 : tasks (assignee)
- Collection : `tasks`
- Champs :
  - `organizationId` : Ascending
  - `assigneeId` : Ascending
  - `createdAt` : Descending
- Query scope : Collection

#### Index 7 : reports
- Collection : `reports`
- Champs :
  - `organizationId` : Ascending
  - `date` : Descending
- Query scope : Collection

#### Index 8 : auditLogs
- Collection : `auditLogs`
- Champs :
  - `organizationId` : Ascending
  - `timestamp` : Descending
- Query scope : Collection

---

## ✅ Vérification post-déploiement

### 1. Vérifier les règles

1. Ouvrir [Firebase Console → Firestore → Rules](https://console.firebase.google.com/project/gestion-projet-3d1ab/firestore/rules)
2. Vérifier que les fonctions `isAdmin()`, `isManager()`, etc. sont présentes
3. Vérifier que les règles pour `reports` (pas `dailyReports`) sont présentes

### 2. Vérifier les indexes

1. Ouvrir [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/gestion-projet-3d1ab/firestore/indexes)
2. Vérifier que **8 indexes composites** sont listés
3. Statut : **Enabled** (vert) ou **Building** (orange)

### 3. Tester l'application

1. Démarrer le serveur de dev :
   ```bash
   npm run dev
   ```

2. Ouvrir http://localhost:3000

3. **Test 1 : Connexion**
   - Se connecter avec un compte admin
   - Vérifier qu'aucune erreur Firestore n'apparaît dans la console

4. **Test 2 : Création de projet**
   - Aller dans Projets
   - Cliquer sur "Nouveau Projet"
   - Remplir le formulaire
   - Cliquer sur "Créer"
   - ✅ Le projet doit apparaître immédiatement
   - ✅ Vérifier dans Firestore Console que le document existe

5. **Test 3 : Invitation membre**
   - Aller dans Équipes
   - Inviter un nouveau membre
   - ✅ Vérifier que l'email de réinitialisation est envoyé
   - ✅ Le membre doit apparaître dans Firestore

6. **Test 4 : Comments temps réel**
   - Ouvrir une tâche
   - Ajouter un commentaire
   - Ouvrir la même tâche dans un autre onglet/navigateur
   - ✅ Le commentaire doit apparaître en temps réel

---

## 🐛 Dépannage

### Erreur : "Missing or insufficient permissions"

**Cause** : Les règles Firestore ne sont pas déployées  
**Solution** :
1. Déployer les règles : `firebase deploy --only firestore:rules`
2. Attendre 30 secondes pour propagation
3. Rafraîchir l'application

### Erreur : "The query requires an index"

**Cause** : Les indexes ne sont pas créés  
**Solution** :
1. Copier l'URL de l'erreur (Firebase fournit un lien direct)
2. Cliquer sur le lien pour créer l'index automatiquement
3. OU déployer tous les indexes : `firebase deploy --only firestore:indexes`

### Erreur : "Collection 'dailyReports' not found"

**Cause** : Anciennes règles encore actives  
**Solution** :
1. Vérifier que `firestore.rules` contient `match /reports/{reportId}` (pas `dailyReports`)
2. Redéployer : `firebase deploy --only firestore:rules`

### Erreur : "Firebase Admin SDK credentials missing"

**Cause** : Variables d'environnement manquantes dans `.env.local`  
**Solution** :
1. Vérifier que `.env.local` contient :
   ```
   VITE_FIREBASE_ADMIN_PROJECT_ID=...
   VITE_FIREBASE_ADMIN_PRIVATE_KEY=...
   VITE_FIREBASE_ADMIN_CLIENT_EMAIL=...
   ```
2. Redémarrer le serveur : `npm run dev`

### Erreur : "Storage bucket does not exist"

**Cause** : Firebase Storage pas initialisé  
**Solution** :
1. Ouvrir [Firebase Console → Storage](https://console.firebase.google.com/project/gestion-projet-3d1ab/storage)
2. Cliquer sur "Get Started"
3. Accepter les règles par défaut
4. Le bucket sera créé automatiquement

---

## 📊 Monitoring

### Vérifier les logs Firestore

```bash
firebase firestore:logs
```

### Vérifier l'utilisation

1. Ouvrir [Firebase Console → Usage](https://console.firebase.google.com/project/gestion-projet-3d1ab/usage)
2. Surveiller :
   - Reads/Writes Firestore
   - Storage utilisé
   - Authentications

---

## 🔒 Sécurité

### Règles de sécurité déployées

Les nouvelles règles implémentent :

✅ **Contrôle basé sur les rôles** :
- Super Administrator : accès complet
- Administrator : gestion organisation + users
- Manager : gestion teams/projects/objectives
- Team Lead : gestion tasks
- Employee : lecture + modification limitée

✅ **Isolation par organisation** :
- Chaque utilisateur ne voit que les données de son organisation
- Fonction `belongsToOrganization(orgId)` vérifie l'accès

✅ **Protection des données sensibles** :
- Audit logs : lecture admin seulement, jamais de modification
- Notifications : lecture/modification self uniquement
- Users : modification self ou admin seulement

---

## 📞 Support

Si des problèmes persistent :

1. **Vérifier les logs navigateur** :
   - DevTools → Console
   - Chercher `[Firestore]` ou `[Auth]`

2. **Vérifier les logs serveur** :
   - Terminal où `npm run dev` tourne
   - Chercher erreurs Firebase

3. **Vérifier Firebase Console** :
   - [Firestore Rules](https://console.firebase.google.com/project/gestion-projet-3d1ab/firestore/rules)
   - [Firestore Indexes](https://console.firebase.google.com/project/gestion-projet-3d1ab/firestore/indexes)
   - [Authentication](https://console.firebase.google.com/project/gestion-projet-3d1ab/authentication/users)

---

**Date** : 2026-08-11  
**Version** : 1.0.0  
**Statut** : ✅ Prêt pour déploiement
