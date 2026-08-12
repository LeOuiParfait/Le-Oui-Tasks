export type UserRole = 
  | 'super_admin'    // Propriétaire organisation - Accès total
  | 'admin'          // Administrateur - Gestion équipes/projets/utilisateurs
  | 'manager'        // Manager/Chef de projet - Gestion de ses projets et équipes
  | 'team_lead'      // Chef d'équipe - Gestion de son équipe uniquement
  | 'user'           // Utilisateur standard - Voit uniquement ses tâches
  | 'viewer';        // Observateur - Lecture seule

export type ProjectRole = 
  | 'owner'          // Propriétaire du projet - Contrôle total
  | 'lead'           // Chef de projet délégué - Gestion équipe + tâches
  | 'contributor'    // Contributeur - Crée/édite des tâches
  | 'viewer';        // Observateur - Lecture seule

export interface ProjectMember {
  userId: string;
  role: ProjectRole;
  addedAt: string;
}

export type PresenceStatus = 'online' | 'away' | 'offline' | 'on_leave';

export type TaskDifficulty = 'Easy' | 'Medium' | 'Hard';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type TaskStatus = 'Backlog' | 'Todo' | 'In Progress' | 'In Review' | 'Blocked' | 'Completed';

export type ProjectStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed' | 'Archived';

export type ProjectHealth = 'on_track' | 'at_risk' | 'delayed';

export interface User {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar: string;
  role: UserRole;
  teamIds: string[];
  jobTitle: string;
  presenceStatus: PresenceStatus;
  lastActiveAt: string;
  lastSessionId?: string;      // ID de session pour multi-PC
  createdAt: string;
}

export interface DayWorkingHours {
  enabled: boolean;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface Organization {
  id: string;
  name: string;
  logo: string;
  industry: string;
  timezone: string;
  // Heures de travail par jour (7 jours)
  // Ancien format (rétrocompatibilité) : { start, end }
  // Nouveau format : par jour de la semaine
  workingHours: {
    start: string;
    end: string;
  } | {
    monday: DayWorkingHours;
    tuesday: DayWorkingHours;
    wednesday: DayWorkingHours;
    thursday: DayWorkingHours;
    friday: DayWorkingHours;
    saturday: DayWorkingHours;
    sunday: DayWorkingHours;
  };
  workingDays: string[];
  defaultWorkdayDurationHours: number;
  reportEmailRecipients: string[];
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  managerId: string;
  memberIds: string[];
  createdAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  coverImage?: string;
  status: ProjectStatus;
  health: ProjectHealth;
  priority: TaskPriority;
  ownerId: string;
  members: ProjectMember[]; // Avec rôles par projet
  memberIds: string[]; // Pour Firestore rules (synchronisé avec members)
  ownerIds: string[]; // Pour Firestore rules (membres avec rôle owner)
  viewerIds: string[]; // Pour Firestore rules (membres avec rôle viewer)
  teamIds: string[];
  startDate: string;
  dueDate: string;
  weightedProgress: number; // 0-100%
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: string;
  attachments?: string[];
}

export interface Task {
  id: string;
  organizationId: string;
  projectId: string;
  teamId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  difficulty: TaskDifficulty;
  assigneeIds: string[];
  creatorId: string;
  reviewerId?: string;
  dueDate: string;
  startDate: string;
  estimatedHours: number;
  actualHours?: number;
  weight: number; // 1 to 8
  subtasks: Subtask[];
  blockerReason?: string;
  labels: string[];
  attachments: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  validatedAt?: string;
  validatedBy?: string;
  validationComment?: string;
}

export interface Objective {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  level: 'organization' | 'team' | 'project' | 'individual';
  ownerId?: string;
  teamId?: string;
  projectId?: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: string;
  status: 'on_track' | 'at_risk' | 'behind' | 'completed';
  linkedTaskIds: string[];
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  organizationId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // ISO string or HH:MM
  endTime?: string;
  breakStartTime?: string;
  breakEndTime?: string;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  status: 'working' | 'on_break' | 'completed' | 'absent';
  summary?: string;
  // Suivi de présence hybride
  timeEstimated?: boolean;       // true si le temps est estimé (inactivité détectée)
  inactivePeriods?: {            // Périodes d'inactivité détectées
    start: string;
    end: string;
    minutes: number;
  }[];
  lastHeartbeatAt?: string;      // Dernier heartbeat reçu
}

export interface Notification {
  id: string;
  userId: string;
  type: 'task_assigned' | 'review_requested' | 'task_approved' | 'task_rejected' | 'mention' | 'deadline' | 'report_ready';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: 'task' | 'project' | 'user' | 'team' | 'attendance' | 'report' | 'objective';
  targetId: string;
  targetTitle: string;
  details?: string;
  timestamp: string;
}

export interface DailyReport {
  id: string;
  organizationId: string;
  teamId?: string;
  date: string;
  generatedBy: string;
  attendanceSummary: {
    expected: number;
    present: number;
    absent: number;
  };
  tasksSummary: {
    completed: number;
    inProgress: number;
    blocked: number;
    inReview: number;
    overdue: number;
  };
  blockers: {
    taskTitle: string;
    assigneeName: string;
    reason: string;
  }[];
  projectProgress: {
    projectName: string;
    progress: number;
    health: ProjectHealth;
  }[];
  prioritiesTomorrow: string[];
  sentAt?: string;
  recipients: string[];
  status: 'draft' | 'sent';
}

// Bilan journalier individuel soumis par chaque user
export interface WorkDayReport {
  id: string;
  organizationId: string;
  userId: string;          // Qui a soumis
  teamId?: string;         // Équipe du user
  date: string;            // YYYY-MM-DD
  // Contenu du bilan
  summary: string;         // Bilan textuel global
  tasksWorkedOn: {
    taskId: string;
    taskTitle: string;
    progressNote?: string; // ce qu'il a fait dessus
  }[];
  achievements: string;    // Ce qu'il a accompli
  challenges: string;      // Difficultés rencontrées
  planTomorrow: string;    // Plan pour demain
  // Métadonnées de présence
  workMinutes: number;
  breakMinutes: number;
  startTime?: string;
  endTime?: string;
  // Soumission
  status: 'draft' | 'submitted';
  submittedAt?: string;
  // Qui peut voir
  visibleTo: string[]; // userIds qui peuvent voir ce bilan
  createdAt: string;
  updatedAt: string;
}
