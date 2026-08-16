import { Organization, DayWorkingHours } from '@/types';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
type DayKey = typeof DAY_KEYS[number];

const DAY_LABELS: Record<DayKey, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche'
};

/**
 * Récupère les heures de travail pour un jour donné.
 * Gère la rétrocompatibilité avec l'ancien format { start, end }.
 */
export function getDayWorkingHours(org: Organization, date: Date = new Date()): DayWorkingHours {
  const dayKey = DAY_KEYS[date.getDay()];
  const wh = org.workingHours as any;

  // Nouveau format : par jour
  if (wh && wh[dayKey]) {
    return wh[dayKey] as DayWorkingHours;
  }

  // Ancien format : plage unique
  // Vérifier si le jour est dans workingDays
  const dayName = DAY_LABELS[dayKey];
  const isEnabled = org.workingDays.some(d => 
    d.toLowerCase().includes(dayName.toLowerCase().slice(0, 3)) ||
    d.toLowerCase() === dayName.toLowerCase()
  );

  return {
    enabled: isEnabled,
    start: wh?.start || '09:00',
    end: wh?.end || '18:00'
  };
}

/**
 * Vérifie si on peut pointer (démarrer une journée) maintenant.
 * Retourne { canStart, reason }
 */
export function canStartWorkday(org: Organization, date: Date = new Date()): {
  canStart: boolean;
  reason?: string;
  dayHours?: DayWorkingHours;
} {
  const dayHours = getDayWorkingHours(org, date);

  if (!dayHours.enabled) {
    const dayName = DAY_LABELS[DAY_KEYS[date.getDay()]];
    return {
      canStart: false,
      reason: `Aujourd'hui (${dayName}) n'est pas un jour ouvré.`,
      dayHours
    };
  }

  const now = date;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = dayHours.start.split(':').map(Number);
  const [eh, em] = dayHours.end.split(':').map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;

  // Tolérance : 15 min avant l'heure de début
  const tolerance = 15;

  if (currentMinutes < startMinutes - tolerance) {
    return {
      canStart: false,
      reason: `Le pointage ouvre à ${dayHours.start}. Il est ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`,
      dayHours
    };
  }

  if (currentMinutes > endMinutes) {
    return {
      canStart: false,
      reason: `L'heure de fin (${dayHours.end}) est dépassée. Attendez demain pour pointer.`,
      dayHours
    };
  }

  return { canStart: true, dayHours };
}

/**
 * Vérifie si une journée est déjà terminée (completed) pour un user.
 */
export function isDayCompleted(
  attendanceRecords: { userId: string; date: string; status: string }[],
  userId: string,
  date: Date = new Date()
): boolean {
  const todayStr = date.toISOString().split('T')[0];
  const record = attendanceRecords.find(
    r => r.userId === userId && r.date === todayStr
  );
  return record?.status === 'completed';
}

/**
 * Récupère les heures de travail pour tous les jours de la semaine.
 */
export function getAllDaysWorkingHours(org: Organization): Record<DayKey, DayWorkingHours> {
  const result = {} as Record<DayKey, DayWorkingHours>;
  for (const dayKey of DAY_KEYS) {
    const fakeDate = new Date();
    fakeDate.setDate(fakeDate.getDate() - fakeDate.getDay() + DAY_KEYS.indexOf(dayKey));
    result[dayKey] = getDayWorkingHours(org, fakeDate);
  }
  return result;
}

/**
 * Crée les heures par défaut (Lun-Ven 9h-18h, Sam-Dim désactivé).
 */
export function createDefaultWorkingHours(): Record<DayKey, DayWorkingHours> {
  return {
    monday:    { enabled: true,  start: '09:00', end: '18:00' },
    tuesday:   { enabled: true,  start: '09:00', end: '18:00' },
    wednesday: { enabled: true,  start: '09:00', end: '18:00' },
    thursday:  { enabled: true,  start: '09:00', end: '18:00' },
    friday:    { enabled: true,  start: '09:00', end: '17:00' },
    saturday:  { enabled: false, start: '09:00', end: '13:00' },
    sunday:    { enabled: false, start: '09:00', end: '17:00' }
  };
}

export { DAY_KEYS, DAY_LABELS };
export type { DayKey };
