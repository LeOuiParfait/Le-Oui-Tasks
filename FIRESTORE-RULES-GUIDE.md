# 🔒 Guide des Firestore Rules - Le Oui Parfait

## 📋 Vue d'ensemble

Les Firestore Rules protègent la base de données en appliquant le **système de permissions par projet**.

### ⚠️ Important

Pour Firestore Rules, chaque projet stocke **3 listes d'IDs en plus des objets `members`** :

- **`members`** : Tableau d'objets avec `userId`, `role`, `addedAt` (utilisé par l'application)
- **`memberIds`** : Tous les IDs des membres du projet
- **`ownerIds`** : IDs des membres avec rôle `owner`
- **`viewerIds`** : IDs des membres avec rôle `viewer`

Ces listes sont **automatiquement synchronisées** par l'application.

---

## 🎯 Principes de sécurité

### 1. Rôles globaux simplifiés
- **`super_admin`** : Accès total (toi uniquement)
- **`user`** : Utilisateur standard

### 2. Rôles par projet
- **`owner`** : Chef de projet (gestion complète)
- **`member`** : Membre actif (créer/modifier tâches)
- **`viewer`** : Observateur (lecture seule)

### 3. Isolation par organisation
- Chaque user appartient à **une seule organisation**
- Les données sont filtrées par `organizationId`
- Impossible de lire les données d'autres organisations

---

## 🔐 Permissions par collection

### **Users**
| Action | Qui peut ? |
|--------|-----------|
| Lire | Tous les users de l'organisation |
| Créer | Super admin uniquement |
| Modifier son profil | L'utilisateur lui-même (sauf rôle) |
| Modifier rôle/supprimer | Super admin uniquement |

### **Organizations**
| Action | Qui peut ? |
|--------|-----------|
| Lire | Membres de l'organisation |
| Modifier | Super admin de l'organisation |
| Créer/Supprimer | Super admin uniquement |

### **Teams**
| Action | Qui peut ? |
|--------|-----------|
| Lire | Membres de l'organisation |
| Créer/Modifier/Supprimer | Super admin uniquement |

### **Projects**
| Action | Qui peut ? |
|--------|-----------|
| Lire | Super admin OU membre du projet (`memberIds`) |
| Créer | Super admin uniquement |
| Modifier | Super admin OU owner du projet (`ownerIds`) |
| Supprimer | Super admin uniquement |

### **Tasks**
| Action | Qui peut ? |
|--------|-----------|
| Lire | Super admin OU membre du projet parent |
| Créer | Super admin OU membre (non viewer) |
| Modifier | Super admin OU owner OU assigné à la tâche |
| Supprimer | Super admin OU owner du projet |

### **Comments**
| Action | Qui peut ? |
|--------|-----------|
| Lire | Membres du projet de la tâche |
| Créer | Membres du projet de la tâche |
| Modifier/Supprimer | Auteur OU super admin |

### **Attendance**
| Action | Qui peut ? |
|--------|-----------|
| Lire | Super admin OU ses propres pointages |
| Créer/Modifier | Ses propres pointages uniquement |
| Supprimer | Super admin uniquement |

### **Objectives, Reports**
| Action | Qui peut ? |
|--------|-----------|
| Lire | Membres de l'organisation |
| Créer/Modifier/Supprimer | Super admin uniquement |

### **Audit Logs**
| Action | Qui peut ? |
|--------|-----------|
| Lire | Super admin uniquement |
| Créer | Système |
| Modifier/Supprimer | Jamais (immutable) |

### **Password Resets**
| Action | Qui peut ? |
|--------|-----------|
| Lire/Écrire | Personne (Admin SDK server-side uniquement) |

---

## 🚀 Déploiement

### Option 1 : Firebase Console

1. Va sur https://console.firebase.google.com/project/gestion-projet-3d1ab/firestore/rules
2. Copie le contenu de `firestore.rules`
3. Clique **Publier**

### Option 2 : Firebase CLI

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

---

## ✅ Tests à faire après déploiement

### Test 1 : User ne voit que ses projets
- Alice (user, membre de proj-1) se connecte
- Elle ne doit voir **que** proj-1
- Elle ne doit PAS voir proj-2

### Test 2 : Pointage protégé
- Bob (user) essaie de créer un pointage pour Alice
- ❌ `PERMISSION DENIED`

### Test 3 : Viewer ne crée pas de tâches
- Charlie (viewer sur proj-1) crée une tâche
- ❌ `PERMISSION DENIED`

### Test 4 : Member crée des tâches
- David (member sur proj-1) crée une tâche
- ✅ `SUCCESS`

### Test 5 : Owner modifie le projet
- Emma (owner sur proj-1) modifie le nom
- ✅ `SUCCESS`

---

##  Matrice de permissions

| Collection | Super Admin | Project Owner | Project Member | Project Viewer | User (hors projet) |
|------------|-------------|---------------|----------------|----------------|-------------------|
| **Projects** | CRUD | RU | R | R | - |
| **Tasks** | CRUD | CRUD | CRU | R | - |
| **Comments** | CRUD | CRU | CRU | R | - |
| **Users** | CRUD | R | R | R | R (org) |
| **Teams** | CRUD | R | R | R | R (org) |
| **Attendance** | RD | R (propre) | R (propre) | R (propre) | R (propre) |
| **Objectives** | CRUD | R | R | R | R (org) |
| **Reports** | CRUD | R | R | R | R (org) |

---

## 🐛 Dépannage

### `Missing or insufficient permissions`
- User pas membre du projet
- User a rôle `viewer` et essaie de créer
- User essaie de modifier un autre user
- Rules pas déployées

### User voit tous les projets
- Vérifier déploiement des rules
- Vérifier `organizationId`
- Vérifier `memberIds` dans Firestore

---

## 📝 Changelog

**2026-08-11** : Règles avec listes d'IDs pour compatibilité Firebase
- `memberIds`, `ownerIds`, `viewerIds` synchronisés
- Suppression de `map`/`filter` (non supportés)
- Règles validées par TypeScript

---

**Version** : 1.1.0  
**Statut** : ✅ Prêt pour déploiement
