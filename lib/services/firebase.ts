import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  type Auth
} from 'firebase/auth';
import { 
  getFirestore, 
  type Firestore 
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    
    // Persist sessions in localStorage so refresh keeps the user logged in
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('[Firebase] Impossible de définir la persistance de session:', err);
    });

    // Pas de persistence offline Firestore : évite les conflits multi-onglets et les erreurs de quota.
  } catch (err) {
    console.error('[Firebase] Erreur d\'initialisation:', err);
  }
} else {
  console.warn(
    '[Firebase] Configuration manquante. Vérifiez NEXT_PUBLIC_FIREBASE_* dans .env.local. ' +
    'L\'application utilise le fallback localStorage.'
  );
}

export { app, auth, db, storage };
