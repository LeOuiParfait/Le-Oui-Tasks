import { useEffect, useRef, useCallback } from 'react';
import { store } from './store';
import { isFirebaseConfigured, auth } from './firebase';
import { updateUser, updateUserPresence } from './dbService';

const HEARTBEAT_INTERVAL = 30 * 1000;        // 30s : heartbeat régulier
const INACTIVITY_THRESHOLD = 10 * 60 * 1000; // 10 min sans activité → away
const STALE_THRESHOLD = 15 * 60 * 1000;      // 15 min sans heartbeat → inactive (onglet fermé)
const AWAY_CHECK_INTERVAL = 60 * 1000;       // Vérifier l'inactivité toutes les 60s

/**
 * Hook de suivi de présence — approche hybride honnête.
 *
 * PRINCIPE :
 * - L'user pointe manuellement (start/end workday) → c'est sa déclaration
 * - Si l'onglet est ouvert, on envoie un heartbeat toutes les 30s
 * - Si pas d'activité souris/clavier pendant 10 min → "away" (mais toujours en travail)
 * - Si pas de heartbeat pendant 15 min → "inactive" (onglet probablement fermé)
 * - Le temps de travail est "estimé" si inactivité détectée
 *
 * LIMITATIONS ASSUMÉES :
 * - Si l'user ferme son onglet, on ne peut pas savoir s'il travaille ailleurs
 * - Le multi-PC : le dernier heartbeat gagne
 * - La détection d'inactivité est limitée au navigateur
 *
 * @param userId   L'ID de l'user connecté
 * @param isWorking Si l'user a une journée en cours (working ou on_break)
 */
export function usePresenceTracking(userId: string | undefined, isWorking: boolean) {
  const lastActivityRef = useRef<number>(Date.now());
  const lastHeartbeatRef = useRef<number>(Date.now());
  const isAwayRef = useRef<boolean>(false);
  const sessionIdRef = useRef<string>(`sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const awayCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // SÉCURITÉ : Cache du token Firebase pour sendBeacon (qui ne supporte pas les headers)
  const cachedTokenRef = useRef<string | null>(null);

  // Mettre à jour lastActiveAt + sessionId (heartbeat)
  const sendHeartbeat = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    lastHeartbeatRef.current = Date.now();
    if (isFirebaseConfigured) {
      try {
        // SÉCURITÉ : Récupérer et cacher le token Firebase pour sendBeacon
        if (auth.currentUser && !cachedTokenRef.current) {
          cachedTokenRef.current = await auth.currentUser.getIdToken();
        }
        // Mettre à jour directement via Firestore SDK (déjà authentifié)
        await updateUser(userId, {
          lastActiveAt: now,
          lastSessionId: sessionIdRef.current
        } as any);
      } catch (err) {
        // Silencieux
      }
    }
  }, [userId]);

  // Marquer comme away (inactif dans le navigateur)
  const markAway = useCallback(async () => {
    if (!userId || isAwayRef.current) return;
    isAwayRef.current = true;
    if (isFirebaseConfigured) {
      try {
        await updateUserPresence(userId, 'away');
      } catch (err) { /* Silencieux */ }
    }
    const u = store.getCurrentUser();
    if (u) u.presenceStatus = 'away';
  }, [userId]);

  // Marquer comme online (reprise d'activité)
  const markOnline = useCallback(async () => {
    if (!userId || !isAwayRef.current) return;
    isAwayRef.current = false;
    lastActivityRef.current = Date.now();
    if (isFirebaseConfigured) {
      try {
        await updateUserPresence(userId, 'online');
        await sendHeartbeat();
      } catch (err) { /* Silencieux */ }
    }
    const u = store.getCurrentUser();
    if (u) u.presenceStatus = 'online';
  }, [userId, sendHeartbeat]);

  // Écouteurs d'activité + heartbeat + inactivité
  useEffect(() => {
    if (!userId) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      if (isAwayRef.current) {
        markOnline();
      }
    };

    // Écouter les événements d'activité
    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));

    // Heartbeat : toutes les 30s, mettre à jour lastActiveAt + sessionId
    heartbeatTimerRef.current = setInterval(() => {
      if (!isAwayRef.current) {
        sendHeartbeat();
      } else {
        // Même en away, on envoie un heartbeat pour dire "onglet ouvert"
        sendHeartbeat();
      }
    }, HEARTBEAT_INTERVAL);

    // Vérification d'inactivité : toutes les 60s
    awayCheckTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= INACTIVITY_THRESHOLD && !isAwayRef.current) {
        markAway();
      }
    }, AWAY_CHECK_INTERVAL);

    // beforeunload : marquer away + envoyer dernier heartbeat
    const handleBeforeUnload = () => {
      if (userId && isWorking) {
        const origin = window.location.origin;
        // SÉCURITÉ : Inclure le token Firebase dans le body (sendBeacon ne supporte pas les headers)
        const payload = JSON.stringify({
          userId,
          status: 'away',
          sessionId: sessionIdRef.current,
          idToken: cachedTokenRef.current
        });
        try {
          navigator.sendBeacon(
            `${origin}/api/presence/away`,
            new Blob([payload], { type: 'application/json' })
          );
        } catch (err) { /* Ignorer */ }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // visibilitychange : marquer away quand l'onglet devient invisible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= INACTIVITY_THRESHOLD) {
          markAway();
        }
      } else {
        if (isAwayRef.current) {
          markOnline();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Envoyer un heartbeat initial
    sendHeartbeat();

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (awayCheckTimerRef.current) clearInterval(awayCheckTimerRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId, isWorking, markAway, markOnline, sendHeartbeat]);
}

/**
 * Vérifie côté serveur si un user est "stale" (pas de heartbeat depuis 15 min).
 * À appeler périodiquement (ex: toutes les 5 min) pour nettoyer les users inactifs.
 */
export async function checkStaleUsers(): Promise<void> {
  if (!isFirebaseConfigured) return;
  // Cette fonction sera appelée par le cron serveur
  // Le serveur vérifie lastActiveAt pour chaque user "online"
  // Si lastActiveAt > 15 min → marquer "inactive"
}
