import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser as deleteFirebaseUser,
  getAuth,
  type ActionCodeSettings,
  type User as FirebaseUser
} from 'firebase/auth';
import {
  initializeApp,
  deleteApp,
  getApps,
  type FirebaseApp
} from 'firebase/app';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  limit
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured, app as primaryApp, firebaseConfig } from './firebase';
import type { User, UserRole, Organization } from '../types';

/** Remove undefined values from an object before writing to Firestore */
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const key in obj) {
    if (obj[key] === undefined) continue;
    if (obj[key] === null) {
      result[key] = null;
    } else if (Array.isArray(obj[key])) {
      result[key] = obj[key];
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      result[key] = stripUndefined(obj[key]);
    } else {
      result[key] = obj[key];
    }
  }
  return result as T;
}

/** URL de la page de réinitialisation personnalisée */
const RESET_PASSWORD_URL = typeof window !== 'undefined'
  ? `${window.location.origin}/reset-password`
  : 'http://localhost:5173/reset-password';

/** Configuration Firebase pour l'email de réinitialisation */
const resetPasswordSettings: ActionCodeSettings = {
  url: RESET_PASSWORD_URL,
  handleCodeInApp: true
};

export interface AuthSession {
  firebaseUser: FirebaseUser;
  appUser: User | null;
  organization: Organization | null;
}

export interface SetupInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  jobTitle: string;
  organizationName: string;
  industry?: string;
}

export interface InviteMemberInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  jobTitle: string;
  role: UserRole;
  avatar?: string;
}

const USERS_COLLECTION = 'users';
const ORGS_COLLECTION = 'organizations';

function mapUser(id: string, data: any): User {
  return {
    id,
    organizationId: data.organizationId || '',
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    email: data.email || '',
    avatar: data.avatar || '',
    role: (data.role as UserRole) || 'user',
    teamIds: data.teamIds || [],
    jobTitle: data.jobTitle || '',
    presenceStatus: data.presenceStatus || 'offline',
    lastActiveAt: data.lastActiveAt || new Date().toISOString(),
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || new Date().toISOString()
  };
}

function mapOrganization(id: string, data: any): Organization {
  return {
    id,
    name: data.name || '',
    logo: data.logo || '',
    industry: data.industry || '',
    timezone: data.timezone || 'Europe/Paris',
    workingHours: data.workingHours || { start: '09:00', end: '18:00' },
    workingDays: data.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    defaultWorkdayDurationHours: data.defaultWorkdayDurationHours || 8,
    reportEmailRecipients: data.reportEmailRecipients || []
  };
}

/**
 * Check if the system has been initialized (at least one user exists in Firestore).
 * Used to decide whether to show the setup screen or the login screen.
 * Fails safe to true (login) so the setup screen is never shown to invited users.
 */
export async function isSystemInitialized(): Promise<boolean> {
  if (!isFirebaseConfigured) return true; // Local mode bypasses setup
  try {
    const snap = await getDocs(query(collection(db, USERS_COLLECTION), limit(1)));
    return !snap.empty;
  } catch (err) {
    console.warn('[Auth] isSystemInitialized query failed, assuming initialized:', err);
    return true; // Fail-safe: show login, never setup to unauthorized users
  }
}

/**
 * One-time system initialization: creates the first admin user + the organization.
 * This is called from the setup screen, not from a regular signup.
 *
 * Handles the case where a previous attempt created the Firebase Auth user
 * but failed before writing the Firestore profile (e.g. due to permissions).
 * In that case, we sign in with the provided credentials and finish the setup.
 */
export async function initializeSystem(input: SetupInput): Promise<AuthSession> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase n\'est pas configuré. Vérifiez les variables d\'environnement.');
  }

  // Safety check: refuse if users already exist in Firestore
  const alreadyInitialized = await isSystemInitialized();
  if (alreadyInitialized) {
    throw new Error('Le système est déjà configuré. Utilisez la page de connexion.');
  }

  let fbUser: FirebaseUser;

  try {
    const cred = await createUserWithEmailAndPassword(auth, input.email, input.password);
    fbUser = cred.user;
  } catch (err: any) {
    // If email already in use, this is likely a retry of a failed setup.
    // Sign in with the provided credentials and finish creating the Firestore profile.
    if (err?.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, input.email, input.password);
      fbUser = cred.user;
    } else {
      throw err;
    }
  }

  await updateProfile(fbUser, {
    displayName: `${input.firstName} ${input.lastName}`
  });

  const orgId = `org-${fbUser.uid}`;
  const now = new Date().toISOString();

  const orgData: Omit<Organization, 'id'> = {
    name: input.organizationName,
    logo: '',
    industry: input.industry || '',
    timezone: 'Europe/Paris',
    workingHours: { start: '09:00', end: '18:00' },
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    defaultWorkdayDurationHours: 8,
    reportEmailRecipients: [input.email]
  };
  await setDoc(doc(db, ORGS_COLLECTION, orgId), stripUndefined({
    ...orgData,
    createdAt: serverTimestamp(),
    ownerId: fbUser.uid
  }));

  const userData: Omit<User, 'id'> = {
    organizationId: orgId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    avatar: '',
    role: 'super_admin',
    teamIds: [],
    jobTitle: input.jobTitle,
    presenceStatus: 'online',
    lastActiveAt: now,
    createdAt: now
  };
  await setDoc(doc(db, USERS_COLLECTION, fbUser.uid), stripUndefined({
    ...userData,
    createdAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  }));

  const appUser: User = { id: fbUser.uid, ...userData };
  const organization: Organization = { id: orgId, ...orgData };

  return { firebaseUser: fbUser, appUser, organization };
}

/** Sign in an existing user with email + password. */
export async function signInWithEmail(email: string, password: string): Promise<AuthSession> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase n\'est pas configuré. Vérifiez les variables d\'environnement.');
  }

  const cred = await signInWithEmailAndPassword(auth, email, password);
  const fbUser = cred.user;

  const session = await loadSessionFor(fbUser);
  if (!session.appUser) {
    await signOut(auth);
    throw new Error('Profil utilisateur introuvable. Contactez un administrateur.');
  }
  return session;
}

/** Load the app User + Organization for a given Firebase user. */
export async function loadSessionFor(fbUser: FirebaseUser): Promise<AuthSession> {
  const userSnap = await getDoc(doc(db, USERS_COLLECTION, fbUser.uid));
  let appUser: User | null = null;
  let organization: Organization | null = null;

  if (userSnap.exists()) {
    appUser = mapUser(fbUser.uid, userSnap.data());
    const orgSnap = await getDoc(doc(db, ORGS_COLLECTION, appUser.organizationId));
    if (orgSnap.exists()) {
      organization = mapOrganization(appUser.organizationId, orgSnap.data());
    }
  }

  return { firebaseUser: fbUser, appUser, organization };
}

/**
 * Create a new user account as an admin, WITHOUT affecting the current session.
 * Uses a secondary Firebase app instance so the admin stays logged in.
 * The new member joins the same organization as the admin.
 */
export async function createMemberAsAdmin(
  input: InviteMemberInput,
  orgId: string
): Promise<User> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase n\'est pas configuré.');
  }

  // Check if email is already used
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new Error('Un compte avec cet e-mail existe déjà.');
  }

  // Use a secondary app instance to create the user without logging out the admin
  const secondaryAppName = 'secondary-' + Date.now();
  let secondaryApp: FirebaseApp;
  try {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  } catch {
    // If a secondary app already exists, reuse it
    const existing = getApps().find((a) => a.name === secondaryAppName);
    if (!existing) throw new Error('Impossible d\'initialiser l\'instance secondaire Firebase.');
    secondaryApp = existing;
  }

  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      input.email,
      input.password
    );
    const newUid = cred.user.uid;

    await updateProfile(cred.user, {
      displayName: `${input.firstName} ${input.lastName}`
    });

    const now = new Date().toISOString();
    const userData: Omit<User, 'id'> = {
      organizationId: orgId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      avatar: input.avatar || '',
      role: input.role,
      teamIds: [],
      jobTitle: input.jobTitle,
      presenceStatus: 'offline',
      lastActiveAt: now,
      createdAt: now
    };
    await setDoc(doc(db, USERS_COLLECTION, newUid), stripUndefined({
      ...userData,
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp()
    }));

    // Sign out of the secondary instance
    await signOut(secondaryAuth);

    return { id: newUid, ...userData };
  } finally {
    // Clean up the secondary app instance
    try { await deleteApp(secondaryApp); } catch {}
  }
}

/** Find a user by email (used for invitation / member lookup). */
export async function findUserByEmail(email: string): Promise<User | null> {
  const q = query(collection(db, USERS_COLLECTION), where('email', '==', email), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return mapUser(d.id, d.data());
}

export async function signOutUser(): Promise<void> {
  if (!isFirebaseConfigured) return;
  await signOut(auth);
}

/** Send a custom invitation/reset link via the backend (100% independent of Firebase email UI). */
export async function sendCustomResetLink(email: string, firstName?: string, userId?: string): Promise<{ link: string; emailSent: boolean; emailId?: string }> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase n\'est pas configuré.');
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const response = await fetch(`${origin}/api/auth/reset-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, firstName, appName: 'Le Oui Parfait', userId })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erreur serveur.');
  return { link: data.link, emailSent: data.emailSent, emailId: data.emailId };
}

export async function resendInvitation(email: string, firstName?: string, userId?: string): Promise<{ link: string; emailSent: boolean; emailId?: string }> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase n\'est pas configuré.');
  }
  return sendCustomResetLink(email, firstName, userId);
}

export async function resetPassword(email: string): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase n\'est pas configuré.');
  }
  try {
    await sendPasswordResetEmail(auth, email, resetPasswordSettings);
  } catch (error: any) {
    console.error('[Auth] Error sending password reset email:', error);
    throw new Error(`Erreur lors de l'envoi de l'email de réinitialisation: ${error.message}`);
  }
}

export async function sendVerificationEmail(user?: FirebaseUser): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase n\'est pas configuré.');
  }
  try {
    const currentUser = user || auth.currentUser;
    if (!currentUser) {
      throw new Error('Aucun utilisateur connecté.');
    }
    await sendEmailVerification(currentUser);
  } catch (error: any) {
    console.error('[Auth] Error sending verification email:', error);
    throw new Error(`Erreur lors de l'envoi de l'email de vérification: ${error.message}`);
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase n\'est pas configuré.');
  }
  try {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error('Aucun utilisateur connecté.');
    }

    // Re-authenticate user before changing password (security requirement)
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // Update password
    await updatePassword(user, newPassword);
  } catch (error: any) {
    console.error('[Auth] Error changing password:', error);
    if (error.code === 'auth/wrong-password') {
      throw new Error('Le mot de passe actuel est incorrect.');
    }
    throw new Error(`Erreur lors du changement de mot de passe: ${error.message}`);
  }
}

export async function deleteUserAccount(password: string): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase n\'est pas configuré.');
  }
  try {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error('Aucun utilisateur connecté.');
    }

    // Re-authenticate before deletion (security requirement)
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);

    // Delete user from Firebase Auth
    await deleteFirebaseUser(user);
    
    // Note: Firestore user document should be deleted separately via Cloud Function or Admin SDK
  } catch (error: any) {
    console.error('[Auth] Error deleting user account:', error);
    if (error.code === 'auth/wrong-password') {
      throw new Error('Le mot de passe est incorrect.');
    }
    throw new Error(`Erreur lors de la suppression du compte: ${error.message}`);
  }
}

export function onAuthChange(callback: (fbUser: FirebaseUser | null) => void): () => void {
  if (!isFirebaseConfigured) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function getCurrentFirebaseUser(): FirebaseUser | null {
  return isFirebaseConfigured ? auth.currentUser : null;
}
