import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Organization } from '../types';
import {
  onAuthChange,
  loadSessionFor,
  signInWithEmail,
  initializeSystem,
  isSystemInitialized,
  signOutUser,
  resetPassword,
  type SetupInput
} from './authService';
import { isFirebaseConfigured, auth } from './firebase';

interface AuthContextValue {
  firebaseUid: string | null;
  currentUser: User | null;
  organization: Organization | null;
  initializing: boolean;
  loading: boolean;
  error: string | null;
  systemInitialized: boolean | null; // null = checking, true = setup done, false = needs setup
  signIn: (email: string, password: string) => Promise<void>;
  setupSystem: (input: SetupInput) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  updateCurrentUser: (updates: Partial<User>) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemInitialized, setSystemInitialized] = useState<boolean | null>(null);

  // Check if the system has been initialized (users exist in Firestore)
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setSystemInitialized(true);
      return;
    }
    isSystemInitialized()
      .then((initialized) => setSystemInitialized(initialized))
      .catch(() => setSystemInitialized(true)); // On error, assume initialized to not block login
  }, []);

  const refreshSession = useCallback(async () => {
    if (!firebaseUid) return;
    setLoading(true);
    try {
      if (!auth.currentUser) return;
      const session = await loadSessionFor(auth.currentUser);
      setCurrentUser(session.appUser);
      setOrganization(session.organization);
    } catch (err: any) {
      setError(err.message || 'Erreur de rafraîchissement de session.');
    } finally {
      setLoading(false);
    }
  }, [firebaseUid]);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setInitializing(false);
      return;
    }
    const unsub = onAuthChange(async (fbUser) => {
      if (fbUser) {
        setFirebaseUid(fbUser.uid);
        try {
          const session = await loadSessionFor(fbUser);
          setCurrentUser(session.appUser);
          setOrganization(session.organization);
        } catch (err) {
          console.error('[Auth] Erreur lors du chargement de session:', err);
          setCurrentUser(null);
          setOrganization(null);
        }
      } else {
        setFirebaseUid(null);
        setCurrentUser(null);
        setOrganization(null);
      }
      setInitializing(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const session = await signInWithEmail(email, password);
      setFirebaseUid(session.firebaseUser.uid);
      setCurrentUser(session.appUser);
      setOrganization(session.organization);
    } catch (err: any) {
      const code = err.code || '';
      let msg = err.message || 'Échec de connexion.';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        msg = 'E-mail ou mot de passe incorrect.';
      } else if (code === 'auth/user-not-found') {
        msg = 'Aucun compte associé à cet e-mail.';
      } else if (code === 'auth/too-many-requests') {
        msg = 'Trop de tentatives. Réessayez plus tard.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Adresse e-mail invalide.';
      }
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const setupSystem = useCallback(async (input: SetupInput) => {
    setLoading(true);
    setError(null);
    try {
      const session = await initializeSystem(input);
      setFirebaseUid(session.firebaseUser.uid);
      setCurrentUser(session.appUser);
      setOrganization(session.organization);
      setSystemInitialized(true);
    } catch (err: any) {
      const code = err.code || '';
      let msg = err.message || 'Échec de la configuration initiale.';
      if (code === 'auth/email-already-in-use') {
        msg = 'Cet e-mail est déjà utilisé.';
      } else if (code === 'auth/weak-password') {
        msg = 'Le mot de passe doit contenir au moins 6 caractères.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Adresse e-mail invalide.';
      }
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await signOutUser();
      setFirebaseUid(null);
      setCurrentUser(null);
      setOrganization(null);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la déconnexion.');
    } finally {
      setLoading(false);
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      await resetPassword(email);
    } catch (err: any) {
      const code = err.code || '';
      let msg = err.message || 'Erreur lors de l\'envoi de l\'e-mail de réinitialisation.';
      if (code === 'auth/user-not-found') {
        msg = 'Aucun compte associé à cet e-mail.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Adresse e-mail invalide.';
      }
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const updateCurrentUser = useCallback((updates: Partial<User>) => {
    setCurrentUser((prev) => prev ? { ...prev, ...updates } : prev);
  }, []);

  const value: AuthContextValue = {
    firebaseUid,
    currentUser,
    organization,
    initializing,
    loading,
    error,
    systemInitialized,
    signIn,
    setupSystem,
    signOut,
    sendPasswordReset,
    refreshSession,
    updateCurrentUser,
    clearError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider.');
  return ctx;
}
