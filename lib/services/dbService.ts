import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  and,
  or,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
  type DocumentData
} from 'firebase/firestore';
import { db, isFirebaseConfigured, auth } from '@/lib/services/firebase';
import type {
  User,
  Organization,
  Team,
  Project,
  Task,
  Objective,
  AttendanceRecord,
  Notification,
  AuditLog,
  DailyReport,
  Comment,
  TaskStatus,
  TaskPriority,
  TaskDifficulty,
  ProjectHealth,
  PresenceStatus,
  UserRole,
  WorkDayReport
} from '@/types';

/**
 * Firestore data layer for the Tasking platform.
 * Each collection is scoped by organizationId via queries.
 * Dates are stored as serverTimestamp() on write and converted to ISO strings on read.
 */

function ensureDb() {
  if (!db) throw new Error('Firestore not configured');
  return db;
}

function ensureAuth() {
  if (!auth) throw new Error('Firebase Auth not configured');
  return auth;
}

const COLLECTIONS = {
  users: 'users',
  organizations: 'organizations',
  teams: 'teams',
  projects: 'projects',
  tasks: 'tasks',
  objectives: 'objectives',
  attendance: 'attendance',
  notifications: 'notifications',
  auditLogs: 'auditLogs',
  reports: 'reports',
  comments: 'comments',
  workDayReports: 'workDayReports'
} as const;

// ---------- Helpers ----------

function tsToIso(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value.toDate) return value.toDate().toISOString();
  return undefined;
}

function notConfigured(): never {
  throw new Error('Firebase n\'est pas configuré. Vérifiez les variables d\'environnement VITE_FIREBASE_*.');
}

/**
 * Remove all undefined values from an object recursively.
 * Firestore rejects undefined field values, so we must strip them before writing.
 */
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const key in obj) {
    if (obj[key] === undefined) continue;
    if (obj[key] === null) {
      result[key] = null;
    } else if (Array.isArray(obj[key])) {
      result[key] = obj[key].map((item: any) =>
        typeof item === 'object' && item !== null && !Array.isArray(item)
          ? stripUndefined(item)
          : item
      );
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      result[key] = stripUndefined(obj[key]);
    } else {
      result[key] = obj[key];
    }
  }
  return result as T;
}

// SÉCURITÉ : Allowlist de champs — ne garder que les champs autorisés
// Empêche le mass assignment de champs sensibles (role, organizationId, etc.)
function pickAllowed<T extends Record<string, any>>(obj: T, allowedFields: ReadonlySet<string>): Partial<T> {
  const result: Record<string, any> = {};
  for (const key of allowedFields) {
    if (key in obj && obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result as Partial<T>;
}

// SÉCURITÉ : Allowlists pour chaque type d'entité
// Ces champs sont les SEULS qu'un client peut modifier via les fonctions update*
const USER_UPDATABLE_FIELDS: ReadonlySet<string> = new Set([
  'firstName', 'lastName', 'avatar', 'jobTitle',
  'presenceStatus', 'lastActiveAt', 'lastSessionId'
  // JAMAIS: role, organizationId, teamIds, email, createdAt
]);

const ORG_UPDATABLE_FIELDS: ReadonlySet<string> = new Set([
  'name', 'industry', 'logo', 'workingHours', 'workingDays', 'timezone',
  'reportEmailRecipients', 'includeAdminsInReports'
  // JAMAIS: createdAt, id
]);

const TEAM_UPDATABLE_FIELDS: ReadonlySet<string> = new Set([
  'name', 'description', 'managerId', 'memberIds'
  // JAMAIS: organizationId, createdAt
]);

const PROJECT_UPDATABLE_FIELDS: ReadonlySet<string> = new Set([
  'name', 'description', 'ownerId', 'ownerIds', 'memberIds', 'viewerIds',
  'members', 'status', 'priority', 'health', 'startDate', 'endDate',
  'dueDate', 'tags', 'coverImage', 'color', 'weightedProgress',
  'teamId', 'progress', 'updatedAt'
  // JAMAIS: organizationId, createdAt
]);

const TASK_UPDATABLE_FIELDS: ReadonlySet<string> = new Set([
  'title', 'description', 'status', 'priority', 'assigneeId', 'assigneeIds',
  'dueDate', 'tags', 'subtasks', 'weight', 'projectId', 'teamId',
  'completedAt', 'reviewedBy', 'reviewedAt', 'reviewNotes', 'attachments',
  'estimatedHours', 'actualHours', 'memberIds', 'teamIds', 'updatedAt'
  // JAMAIS: organizationId, createdAt
]);

const OBJECTIVE_UPDATABLE_FIELDS: ReadonlySet<string> = new Set([
  'title', 'description', 'progress', 'targetDate', 'status',
  'ownerId', 'teamId', 'category', 'updatedAt'
  // JAMAIS: organizationId, createdAt
]);

const ATTENDANCE_UPDATABLE_FIELDS: ReadonlySet<string> = new Set([
  'date', 'startTime', 'endTime', 'breakStartTime', 'breakEndTime',
  'totalWorkMinutes', 'totalBreakMinutes', 'status', 'summary',
  'timeEstimated', 'inactiveMinutes', 'lastSessionId'
  // JAMAIS: userId, organizationId, createdAt
]);

const REPORT_UPDATABLE_FIELDS: ReadonlySet<string> = new Set([
  'date', 'generatedBy', 'attendanceSummary', 'tasksSummary',
  'blockers', 'prioritiesTomorrow', 'recipients', 'teamId',
  'sentAt', 'sentBy', 'status'
  // JAMAIS: organizationId, createdAt
]);

// ---------- Users ----------

export function mapUser(id: string, data: DocumentData): User {
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
    presenceStatus: (data.presenceStatus as PresenceStatus) || 'offline',
    lastActiveAt: tsToIso(data.lastActiveAt) || new Date().toISOString(),
    createdAt: tsToIso(data.createdAt) || new Date().toISOString()
  };
}

export async function fetchUsers(orgId: string): Promise<User[]> {
  if (!isFirebaseConfigured) notConfigured();
  const q = query(collection(ensureDb(), COLLECTIONS.users), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapUser(d.id, d.data()));
}

export function subscribeUsers(orgId: string, cb: (users: User[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(ensureDb(), COLLECTIONS.users), where('organizationId', '==', orgId));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => mapUser(d.id, d.data())));
  }, (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function updateUserPresence(userId: string, status: PresenceStatus): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await updateDoc(doc(ensureDb(), COLLECTIONS.users, userId), stripUndefined({
    presenceStatus: status,
    lastActiveAt: serverTimestamp()
  }));
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  // SÉCURITÉ : Appeler l'endpoint serveur qui vérifie l'autorisation
  const { auth } = await import('./firebase');
  const currentUser = ensureAuth().currentUser;
  if (!currentUser) throw new Error('Non authentifié.');
  const idToken = await currentUser.getIdToken();
  const origin = window.location.origin;
  const response = await fetch(`${origin}/api/auth/update-role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ targetUserId: userId, newRole: role })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Erreur inconnue.' }));
    throw new Error(data.error || 'Erreur lors de la mise à jour du rôle.');
  }
}

// ---------- Organization ----------

export function mapOrganization(id: string, data: DocumentData): Organization {
  return {
    id,
    name: data.name || '',
    logo: data.logo || '',
    industry: data.industry || '',
    timezone: data.timezone || 'Europe/Paris',
    workingHours: data.workingHours || { start: '09:00', end: '18:00' },
    workingDays: data.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    defaultWorkdayDurationHours: data.defaultWorkdayDurationHours || 8,
    reportEmailRecipients: data.reportEmailRecipients || [],
    includeAdminsInReports: data.includeAdminsInReports ?? false
  };
}

export async function fetchOrganization(orgId: string): Promise<Organization | null> {
  if (!isFirebaseConfigured) notConfigured();
  const snap = await getDoc(doc(ensureDb(), COLLECTIONS.organizations, orgId));
  return snap.exists() ? mapOrganization(orgId, snap.data()) : null;
}

export async function updateOrganization(orgId: string, updates: Partial<Organization>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  const safe = pickAllowed(updates as Record<string, any>, ORG_UPDATABLE_FIELDS);
  await updateDoc(doc(ensureDb(), COLLECTIONS.organizations, orgId), stripUndefined(safe as any));
}

// ---------- Teams ----------

export function mapTeam(id: string, data: DocumentData): Team {
  return {
    id,
    organizationId: data.organizationId || '',
    name: data.name || '',
    description: data.description || '',
    icon: data.icon || '',
    color: data.color || '#2563eb',
    managerId: data.managerId || '',
    memberIds: data.memberIds || [],
    createdAt: tsToIso(data.createdAt) || new Date().toISOString()
  };
}

export async function fetchTeams(orgId: string): Promise<Team[]> {
  if (!isFirebaseConfigured) notConfigured();
  const q = query(collection(ensureDb(), COLLECTIONS.teams), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapTeam(d.id, d.data()));
}

export function subscribeTeams(orgId: string, cb: (teams: Team[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(ensureDb(), COLLECTIONS.teams), where('organizationId', '==', orgId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => mapTeam(d.id, d.data()))), (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function createTeam(team: Omit<Team, 'id' | 'organizationId' | 'createdAt'>, orgId: string): Promise<Team> {
  if (!isFirebaseConfigured) notConfigured();
  const ref = await addDoc(collection(ensureDb(), COLLECTIONS.teams), stripUndefined({
    ...team,
    organizationId: orgId,
    createdAt: serverTimestamp()
  }));
  return { id: ref.id, organizationId: orgId, ...team, createdAt: new Date().toISOString() };
}

export async function updateTeam(teamId: string, updates: Partial<Team>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  const safe = pickAllowed(updates as Record<string, any>, TEAM_UPDATABLE_FIELDS);
  await updateDoc(doc(ensureDb(), COLLECTIONS.teams, teamId), stripUndefined(safe as any));
}

export async function deleteTeam(teamId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await deleteDoc(doc(ensureDb(), COLLECTIONS.teams, teamId));
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  const safe = pickAllowed(updates as Record<string, any>, USER_UPDATABLE_FIELDS);
  await updateDoc(doc(ensureDb(), COLLECTIONS.users, userId), stripUndefined(safe as any));
}

// ---------- Projects ----------

export function mapProject(id: string, data: DocumentData): Project {
  return {
    id,
    organizationId: data.organizationId || '',
    name: data.name || '',
    description: data.description || '',
    coverImage: data.coverImage || undefined,
    status: data.status || 'Planning',
    health: (data.health as ProjectHealth) || 'on_track',
    priority: (data.priority as TaskPriority) || 'Medium',
    ownerId: data.ownerId || '',
    teamIds: data.teamIds || [],
    members: data.members || [],
    memberIds: data.memberIds || (data.members || []).map((m: any) => m.userId),
    ownerIds: data.ownerIds || (data.members || []).filter((m: any) => m.role === 'owner').map((m: any) => m.userId),
    viewerIds: data.viewerIds || (data.members || []).filter((m: any) => m.role === 'viewer').map((m: any) => m.userId),
    startDate: data.startDate || new Date().toISOString().split('T')[0],
    dueDate: data.dueDate || new Date().toISOString().split('T')[0],
    weightedProgress: data.weightedProgress || 0,
    createdAt: tsToIso(data.createdAt) || new Date().toISOString(),
    updatedAt: tsToIso(data.updatedAt) || new Date().toISOString()
  };
}

export async function fetchProjects(orgId: string): Promise<Project[]> {
  if (!isFirebaseConfigured) notConfigured();
  const q = query(collection(ensureDb(), COLLECTIONS.projects), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapProject(d.id, d.data()));
}

/** Fetch projects where the user is a member or owner (for non-super_admin users) */
export async function fetchProjectsForUser(orgId: string, userId: string, isSuperAdmin: boolean): Promise<Project[]> {
  if (!isFirebaseConfigured) notConfigured();
  
  // Super admin sees all projects
  if (isSuperAdmin) {
    return fetchProjects(orgId);
  }
  
  // Regular users: fetch all projects then filter client-side
  // (Firestore doesn't support array-contains on nested objects easily)
  const allProjects = await fetchProjects(orgId);
  return allProjects.filter(project => 
    project.ownerId === userId || 
    project.members.some(m => m.userId === userId)
  );
}

export function subscribeProjects(orgId: string, _userId: string, _teamIds: string[], _isSuperAdmin: boolean, cb: (projects: Project[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(ensureDb(), COLLECTIONS.projects), where('organizationId', '==', orgId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => mapProject(d.id, d.data()))), (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function createProject(project: Omit<Project, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'weightedProgress'>, orgId: string): Promise<Project> {
  if (!isFirebaseConfigured) notConfigured();
  const ref = await addDoc(collection(ensureDb(), COLLECTIONS.projects), stripUndefined({
    ...project,
    organizationId: orgId,
    weightedProgress: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));
  return { id: ref.id, organizationId: orgId, ...project, weightedProgress: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export async function updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  const safe = pickAllowed(updates as Record<string, any>, PROJECT_UPDATABLE_FIELDS);
  await updateDoc(doc(ensureDb(), COLLECTIONS.projects, projectId), stripUndefined({
    ...safe,
    updatedAt: serverTimestamp()
  }));
}

export async function deleteProject(projectId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await deleteDoc(doc(ensureDb(), COLLECTIONS.projects, projectId));
}

// ---------- Tasks ----------

export function mapTask(id: string, data: DocumentData): Task {
  return {
    id,
    organizationId: data.organizationId || '',
    projectId: data.projectId || '',
    teamId: data.teamId || '',
    title: data.title || '',
    description: data.description || '',
    status: (data.status as TaskStatus) || 'Todo',
    priority: (data.priority as TaskPriority) || 'Medium',
    difficulty: (data.difficulty as TaskDifficulty) || 'Medium',
    assigneeIds: data.assigneeIds || [],
    creatorId: data.creatorId || '',
    reviewerId: data.reviewerId || undefined,
    dueDate: data.dueDate || new Date().toISOString().split('T')[0],
    startDate: data.startDate || new Date().toISOString().split('T')[0],
    estimatedHours: data.estimatedHours || 0,
    actualHours: data.actualHours || undefined,
    weight: data.weight || 1,
    subtasks: data.subtasks || [],
    blockerReason: data.blockerReason || undefined,
    labels: data.labels || [],
    attachments: data.attachments || [],
    memberIds: data.memberIds || [],
    teamIds: data.teamIds || [],
    createdAt: tsToIso(data.createdAt) || new Date().toISOString(),
    updatedAt: tsToIso(data.updatedAt) || new Date().toISOString(),
    completedAt: tsToIso(data.completedAt),
    validatedAt: tsToIso(data.validatedAt),
    validatedBy: data.validatedBy || undefined,
    validationComment: data.validationComment || undefined
  };
}

export async function fetchTasks(orgId: string): Promise<Task[]> {
  if (!isFirebaseConfigured) notConfigured();
  const q = query(collection(ensureDb(), COLLECTIONS.tasks), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapTask(d.id, d.data()));
}

export function subscribeTasks(orgId: string, userId: string, teamIds: string[], isSuperAdmin: boolean, cb: (tasks: Task[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  let q;
  if (isSuperAdmin) {
    q = query(collection(ensureDb(), COLLECTIONS.tasks), where('organizationId', '==', orgId));
  } else {
    const teamChunks = teamIds.length > 30
      ? teamIds.slice(0, 30).reduce<string[][]>((acc, id, i) => { const idx = Math.floor(i / 10); if (!acc[idx]) acc[idx] = []; acc[idx].push(id); return acc; }, [])
      : (teamIds.length > 0 ? [teamIds] : []);
    const teamFilters = teamChunks.map(ids => where('teamIds', 'array-contains-any', ids));
    q = query(
      collection(ensureDb(), COLLECTIONS.tasks),
      and(
        where('organizationId', '==', orgId),
        or(
          where('memberIds', 'array-contains', userId),
          where('assigneeIds', 'array-contains', userId),
          ...teamFilters
        )
      ) as any
    );
  }
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => mapTask(d.id, d.data()))), (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function createTask(task: Omit<Task, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>, orgId: string): Promise<Task> {
  if (!isFirebaseConfigured) notConfigured();
  const ref = await addDoc(collection(ensureDb(), COLLECTIONS.tasks), stripUndefined({
    ...task,
    organizationId: orgId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));
  return { id: ref.id, organizationId: orgId, ...task, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  const { auth } = await import('./firebase');
  const currentUser = ensureAuth().currentUser;
  if (!currentUser) throw new Error('Non authentifié.');
  const idToken = await currentUser.getIdToken();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const safe = pickAllowed(updates as Record<string, any>, TASK_UPDATABLE_FIELDS);
  const response = await fetch(`${origin}/api/tasks/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ taskId, updates: stripUndefined(safe) })
  });

  const data = await response.json().catch(() => ({ error: 'Erreur serveur.' }));
  if (!response.ok) {
    const message = data.error || `Erreur ${response.status} lors de la mise à jour de la tâche.`;
    console.error('[Tasks] update failed:', response.status, data);
    if (typeof window !== 'undefined') window.alert('Erreur de sauvegarde tâche : ' + message);
    throw new Error(message);
  }
  console.log('[Tasks] update OK:', taskId);
}

export async function deleteTask(taskId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await deleteDoc(doc(ensureDb(), COLLECTIONS.tasks, taskId));
}

// ---------- Objectives ----------

export function mapObjective(id: string, data: DocumentData): Objective {
  return {
    id,
    organizationId: data.organizationId || '',
    title: data.title || '',
    description: data.description || '',
    level: data.level || 'organization',
    ownerId: data.ownerId || undefined,
    teamId: data.teamId || undefined,
    projectId: data.projectId || undefined,
    targetValue: data.targetValue || 0,
    currentValue: data.currentValue || 0,
    unit: data.unit || '',
    deadline: data.deadline || new Date().toISOString().split('T')[0],
    status: data.status || 'on_track',
    linkedTaskIds: data.linkedTaskIds || [],
    createdAt: tsToIso(data.createdAt) || new Date().toISOString()
  };
}

export async function fetchObjectives(orgId: string): Promise<Objective[]> {
  if (!isFirebaseConfigured) notConfigured();
  const q = query(collection(ensureDb(), COLLECTIONS.objectives), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapObjective(d.id, d.data()));
}

export function subscribeObjectives(orgId: string, cb: (items: Objective[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(ensureDb(), COLLECTIONS.objectives), where('organizationId', '==', orgId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => mapObjective(d.id, d.data()))), (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function createObjective(obj: Omit<Objective, 'id' | 'organizationId' | 'createdAt'>, orgId: string): Promise<Objective> {
  if (!isFirebaseConfigured) notConfigured();
  const ref = await addDoc(collection(ensureDb(), COLLECTIONS.objectives), stripUndefined({
    ...obj,
    organizationId: orgId,
    createdAt: serverTimestamp()
  }));
  return { id: ref.id, organizationId: orgId, ...obj, createdAt: new Date().toISOString() };
}

export async function updateObjective(objId: string, updates: Partial<Objective>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  const safe = pickAllowed(updates as Record<string, any>, OBJECTIVE_UPDATABLE_FIELDS);
  await updateDoc(doc(ensureDb(), COLLECTIONS.objectives, objId), stripUndefined(safe as any));
}

export async function deleteObjective(objId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await deleteDoc(doc(ensureDb(), COLLECTIONS.objectives, objId));
}

// ---------- Attendance ----------

export function mapAttendance(id: string, data: DocumentData): AttendanceRecord {
  return {
    id,
    userId: data.userId || '',
    organizationId: data.organizationId || '',
    date: data.date || new Date().toISOString().split('T')[0],
    startTime: data.startTime || '',
    endTime: data.endTime || undefined,
    breakStartTime: data.breakStartTime || undefined,
    breakEndTime: data.breakEndTime || undefined,
    totalWorkMinutes: data.totalWorkMinutes || 0,
    totalBreakMinutes: data.totalBreakMinutes || 0,
    status: data.status || 'absent',
    summary: data.summary || undefined
  };
}

export async function fetchAttendance(orgId: string): Promise<AttendanceRecord[]> {
  if (!isFirebaseConfigured) notConfigured();
  const q = query(collection(ensureDb(), COLLECTIONS.attendance), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapAttendance(d.id, d.data()));
}

export function subscribeAttendance(orgId: string, userId: string, isSuperAdmin: boolean, cb: (items: AttendanceRecord[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = isSuperAdmin
    ? query(collection(ensureDb(), COLLECTIONS.attendance), where('organizationId', '==', orgId))
    : query(collection(ensureDb(), COLLECTIONS.attendance), and(where('organizationId', '==', orgId), where('userId', '==', userId)));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => mapAttendance(d.id, d.data()))), (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function upsertAttendance(record: AttendanceRecord): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await setDoc(doc(ensureDb(), COLLECTIONS.attendance, record.id), stripUndefined(record), { merge: true });
}

export async function updateAttendance(recordId: string, updates: Partial<AttendanceRecord>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  const safe = pickAllowed(updates as Record<string, any>, ATTENDANCE_UPDATABLE_FIELDS);
  await updateDoc(doc(ensureDb(), COLLECTIONS.attendance, recordId), stripUndefined(safe as any));
}

// ---------- WorkDayReports (bilans journaliers individuels) ----------

export function mapWorkDayReport(id: string, data: DocumentData): WorkDayReport {
  return {
    id,
    organizationId: data.organizationId || '',
    userId: data.userId || '',
    teamId: data.teamId || undefined,
    date: data.date || new Date().toISOString().split('T')[0],
    summary: data.summary || '',
    tasksWorkedOn: data.tasksWorkedOn || [],
    achievements: data.achievements || '',
    challenges: data.challenges || '',
    planTomorrow: data.planTomorrow || '',
    workMinutes: data.workMinutes || 0,
    breakMinutes: data.breakMinutes || 0,
    startTime: data.startTime || undefined,
    endTime: data.endTime || undefined,
    status: data.status || 'draft',
    submittedAt: data.submittedAt || undefined,
    visibleTo: data.visibleTo || [],
    createdAt: tsToIso(data.createdAt) || new Date().toISOString(),
    updatedAt: tsToIso(data.updatedAt) || new Date().toISOString()
  };
}

export async function fetchWorkDayReports(orgId: string): Promise<WorkDayReport[]> {
  if (!isFirebaseConfigured) return [];
  const q = query(collection(ensureDb(), COLLECTIONS.workDayReports), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map(d => mapWorkDayReport(d.id, d.data()));
}

export function subscribeWorkDayReports(orgId: string, cb: (reports: WorkDayReport[]) => void): () => void {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(ensureDb(), COLLECTIONS.workDayReports), where('organizationId', '==', orgId));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(d => mapWorkDayReport(d.id, d.data())));
  });
}

export async function upsertWorkDayReport(report: WorkDayReport): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await setDoc(doc(ensureDb(), COLLECTIONS.workDayReports, report.id), stripUndefined(report as any), { merge: true });
}

// ---------- Notifications ----------

export function mapNotification(id: string, data: DocumentData): Notification {
  return {
    id,
    userId: data.userId || '',
    type: data.type || 'mention',
    title: data.title || '',
    message: data.message || '',
    link: data.link || undefined,
    read: data.read || false,
    createdAt: tsToIso(data.createdAt) || new Date().toISOString()
  };
}

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  if (!isFirebaseConfigured) notConfigured();
  const q = query(collection(ensureDb(), COLLECTIONS.notifications), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapNotification(d.id, d.data()));
}

export function subscribeNotifications(userId: string, cb: (items: Notification[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(ensureDb(), COLLECTIONS.notifications), where('userId', '==', userId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => mapNotification(d.id, d.data()))), (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function createNotification(notif: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
  if (!isFirebaseConfigured) notConfigured();
  const ref = await addDoc(collection(ensureDb(), COLLECTIONS.notifications), stripUndefined({
    ...notif,
    createdAt: serverTimestamp()
  }));
  return { id: ref.id, ...notif, createdAt: new Date().toISOString() };
}

export async function markNotificationRead(notifId: string, read: boolean): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await updateDoc(doc(ensureDb(), COLLECTIONS.notifications, notifId), { read });
}

// ---------- Comments ----------

export function mapComment(id: string, data: DocumentData): Comment {
  return {
    id,
    taskId: data.taskId || '',
    authorId: data.authorId || '',
    content: data.content || '',
    createdAt: tsToIso(data.createdAt) || new Date().toISOString(),
    attachments: data.attachments || undefined
  };
}

export async function fetchComments(taskId: string): Promise<Comment[]> {
  if (!isFirebaseConfigured) notConfigured();
  const q = query(collection(ensureDb(), COLLECTIONS.comments), where('taskId', '==', taskId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapComment(d.id, d.data()));
}

export function subscribeComments(taskId: string, cb: (items: Comment[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(ensureDb(), COLLECTIONS.comments), where('taskId', '==', taskId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => mapComment(d.id, d.data()))), (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function addCommentDb(comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
  if (!isFirebaseConfigured) notConfigured();
  const ref = await addDoc(collection(ensureDb(), COLLECTIONS.comments), stripUndefined({
    ...comment,
    createdAt: serverTimestamp()
  }));
  return { id: ref.id, ...comment, createdAt: new Date().toISOString() };
}

export async function updateCommentDb(commentId: string, updates: Partial<Comment>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await updateDoc(doc(ensureDb(), COLLECTIONS.comments, commentId), stripUndefined({
    ...updates,
    updatedAt: serverTimestamp()
  }));
}

// ---------- Reports ----------

export function mapReport(id: string, data: DocumentData): DailyReport {
  return {
    id,
    organizationId: data.organizationId || '',
    teamId: data.teamId || undefined,
    date: data.date || new Date().toISOString().split('T')[0],
    generatedBy: data.generatedBy || '',
    attendanceSummary: data.attendanceSummary || { expected: 0, present: 0, absent: 0 },
    tasksSummary: data.tasksSummary || { completed: 0, inProgress: 0, blocked: 0, inReview: 0, overdue: 0 },
    blockers: data.blockers || [],
    projectProgress: data.projectProgress || [],
    prioritiesTomorrow: data.prioritiesTomorrow || [],
    completedToday: data.completedToday || [],
    inProgressToday: data.inProgressToday || [],
    attendanceDetails: data.attendanceDetails || [],
    workDaySummaries: data.workDaySummaries || [],
    sentAt: tsToIso(data.sentAt),
    recipients: data.recipients || [],
    status: data.status || 'draft'
  };
}

export async function fetchReports(orgId: string): Promise<DailyReport[]> {
  if (!isFirebaseConfigured) notConfigured();
  const q = query(collection(ensureDb(), COLLECTIONS.reports), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapReport(d.id, d.data()));
}

export function subscribeReports(orgId: string, cb: (items: DailyReport[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(ensureDb(), COLLECTIONS.reports), where('organizationId', '==', orgId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => mapReport(d.id, d.data()))), (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function createReportDb(report: Omit<DailyReport, 'id'>): Promise<DailyReport> {
  if (!isFirebaseConfigured) notConfigured();
  const ref = await addDoc(collection(ensureDb(), COLLECTIONS.reports), stripUndefined(report));
  return { id: ref.id, ...report };
}

export async function updateReport(reportId: string, updates: Partial<DailyReport>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  const safe = pickAllowed(updates as Record<string, any>, REPORT_UPDATABLE_FIELDS);
  await updateDoc(doc(ensureDb(), COLLECTIONS.reports, reportId), stripUndefined(safe as any));
}

// ---------- Audit Logs ----------

export function mapAuditLog(id: string, data: DocumentData): AuditLog {
  return {
    id,
    organizationId: data.organizationId || '',
    actorId: data.actorId || '',
    actorName: data.actorName || '',
    action: data.action || '',
    targetType: data.targetType || 'task',
    targetId: data.targetId || '',
    targetTitle: data.targetTitle || '',
    details: data.details || undefined,
    timestamp: tsToIso(data.timestamp) || new Date().toISOString()
  };
}

export async function fetchAuditLogs(orgId: string): Promise<AuditLog[]> {
  if (!isFirebaseConfigured) notConfigured();
  const q = query(collection(ensureDb(), COLLECTIONS.auditLogs), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapAuditLog(d.id, d.data()));
}

export async function createAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await addDoc(collection(ensureDb(), COLLECTIONS.auditLogs), stripUndefined({
    ...log,
    timestamp: serverTimestamp()
  }));
}

// ---------- File Upload (Avatar) ----------

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  // Use server-side upload via Admin SDK to bypass CORS issues
  const formData = new FormData();
  formData.append('avatar', file);
  formData.append('userId', userId);

  // Récupérer le token Firebase pour l'authentification serveur
  const { auth } = await import('./firebase');
  const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;

  const response = await fetch('/api/upload-avatar', {
    method: 'POST',
    headers: {
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
    },
    body: formData
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Échec de l\'upload de l\'avatar.');
  }

  const data = await response.json();
  return data.url;
}

// ---------- Fetch By ID Functions ----------

export async function fetchUserById(userId: string): Promise<User | null> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    const docSnap = await getDoc(doc(ensureDb(), COLLECTIONS.users, userId));
    return docSnap.exists() ? mapUser(docSnap.id, docSnap.data()) : null;
  } catch (error) {
    console.error('[Firestore] Error fetching user by ID:', error);
    return null;
  }
}

export async function fetchTeamById(teamId: string): Promise<Team | null> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    const docSnap = await getDoc(doc(ensureDb(), COLLECTIONS.teams, teamId));
    return docSnap.exists() ? mapTeam(docSnap.id, docSnap.data()) : null;
  } catch (error) {
    console.error('[Firestore] Error fetching team by ID:', error);
    return null;
  }
}

export async function fetchProjectById(projectId: string): Promise<Project | null> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    const docSnap = await getDoc(doc(ensureDb(), COLLECTIONS.projects, projectId));
    return docSnap.exists() ? mapProject(docSnap.id, docSnap.data()) : null;
  } catch (error) {
    console.error('[Firestore] Error fetching project by ID:', error);
    return null;
  }
}

export async function fetchTaskById(taskId: string): Promise<Task | null> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    const docSnap = await getDoc(doc(ensureDb(), COLLECTIONS.tasks, taskId));
    return docSnap.exists() ? mapTask(docSnap.id, docSnap.data()) : null;
  } catch (error) {
    console.error('[Firestore] Error fetching task by ID:', error);
    return null;
  }
}

export async function fetchObjectiveById(objectiveId: string): Promise<Objective | null> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    const docSnap = await getDoc(doc(ensureDb(), COLLECTIONS.objectives, objectiveId));
    return docSnap.exists() ? mapObjective(docSnap.id, docSnap.data()) : null;
  } catch (error) {
    console.error('[Firestore] Error fetching objective by ID:', error);
    return null;
  }
}

export async function fetchAttendanceById(recordId: string): Promise<AttendanceRecord | null> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    const docSnap = await getDoc(doc(ensureDb(), COLLECTIONS.attendance, recordId));
    return docSnap.exists() ? mapAttendance(docSnap.id, docSnap.data()) : null;
  } catch (error) {
    console.error('[Firestore] Error fetching attendance by ID:', error);
    return null;
  }
}

export async function fetchNotificationById(notificationId: string): Promise<Notification | null> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    const docSnap = await getDoc(doc(ensureDb(), COLLECTIONS.notifications, notificationId));
    return docSnap.exists() ? mapNotification(docSnap.id, docSnap.data()) : null;
  } catch (error) {
    console.error('[Firestore] Error fetching notification by ID:', error);
    return null;
  }
}

export async function fetchReportById(reportId: string): Promise<DailyReport | null> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    const docSnap = await getDoc(doc(ensureDb(), COLLECTIONS.reports, reportId));
    return docSnap.exists() ? mapReport(docSnap.id, docSnap.data()) : null;
  } catch (error) {
    console.error('[Firestore] Error fetching report by ID:', error);
    return null;
  }
}

// ---------- Additional Delete Operations ----------

export async function deleteUser(userId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    await deleteDoc(doc(ensureDb(), COLLECTIONS.users, userId));
  } catch (error) {
    console.error('[Firestore] Error deleting user:', error);
    throw error;
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    await deleteDoc(doc(ensureDb(), COLLECTIONS.notifications, notificationId));
  } catch (error) {
    console.error('[Firestore] Error deleting notification:', error);
    throw error;
  }
}

export async function deleteComment(commentId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    await deleteDoc(doc(ensureDb(), COLLECTIONS.comments, commentId));
  } catch (error) {
    console.error('[Firestore] Error deleting comment:', error);
    throw error;
  }
}

export async function deleteReport(reportId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    await deleteDoc(doc(ensureDb(), COLLECTIONS.reports, reportId));
  } catch (error) {
    console.error('[Firestore] Error deleting report:', error);
    throw error;
  }
}

export async function deleteAttendance(recordId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    await deleteDoc(doc(ensureDb(), COLLECTIONS.attendance, recordId));
  } catch (error) {
    console.error('[Firestore] Error deleting attendance:', error);
    throw error;
  }
}

// ---------- Server-side attendance (bypasses client Firestore rules) ----------

async function apiPost(path: string, body: unknown): Promise<void> {
  const { auth } = await import('./firebase');
  const currentUser = ensureAuth().currentUser;
  if (!currentUser) throw new Error('Non authentifié.');
  const idToken = await currentUser.getIdToken();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const response = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({ error: 'Erreur serveur.' }));
  if (!response.ok) {
    const message = data.error || `Erreur ${path}.`;
    if (typeof window !== 'undefined') window.alert('Erreur serveur : ' + message);
    throw new Error(message);
  }
}

export async function serverStartWorkday(record: AttendanceRecord): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await apiPost('/api/attendance/start', { record });
}

export async function serverEndWorkday(record: AttendanceRecord): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await apiPost('/api/attendance/end', { record });
}

export async function serverToggleBreak(record: AttendanceRecord, presence: 'online' | 'away'): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await apiPost('/api/attendance/toggle-break', { record, presence });
}

// ---------- Generic delete ----------

export async function sendNotificationEmail(toEmail: string, notification: { title: string; message: string; link?: string }): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  const { auth } = await import('./firebase');
  const currentUser = ensureAuth().currentUser;
  if (!currentUser) throw new Error('Non authentifié.');
  const idToken = await currentUser.getIdToken();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const response = await fetch(`${origin}/api/notifications/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      toEmail,
      subject: notification.title,
      title: notification.title,
      message: notification.message,
      link: notification.link
    })
  });

  const data = await response.json().catch(() => ({ error: 'Erreur serveur.' }));
  if (!response.ok) {
    throw new Error(data.error || 'Erreur lors de l\'envoi de l\'e-mail.');
  }
}

export async function deleteDocument(collectionName: string, docId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await deleteDoc(doc(ensureDb(), collectionName, docId));
}

export { COLLECTIONS };
