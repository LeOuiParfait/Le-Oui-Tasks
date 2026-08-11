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
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
  type DocumentData,
  type QueryConstraint
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
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
  UserRole
} from '../types';

/**
 * Firestore data layer for the Tasking platform.
 * Each collection is scoped by organizationId via queries.
 * Dates are stored as serverTimestamp() on write and converted to ISO strings on read.
 */

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
  comments: 'comments'
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

// ---------- Users ----------

export function mapUser(id: string, data: DocumentData): User {
  return {
    id,
    organizationId: data.organizationId || '',
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    email: data.email || '',
    avatar: data.avatar || '',
    role: (data.role as UserRole) || 'employee',
    teamIds: data.teamIds || [],
    jobTitle: data.jobTitle || '',
    presenceStatus: (data.presenceStatus as PresenceStatus) || 'offline',
    lastActiveAt: tsToIso(data.lastActiveAt) || new Date().toISOString(),
    createdAt: tsToIso(data.createdAt) || new Date().toISOString()
  };
}

export async function fetchUsers(orgId: string): Promise<User[]> {
  if (!isFirebaseConfigured) notConfigured();
  const q = query(collection(db, COLLECTIONS.users), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapUser(d.id, d.data()));
}

export function subscribeUsers(orgId: string, cb: (users: User[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(db, COLLECTIONS.users), where('organizationId', '==', orgId));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => mapUser(d.id, d.data())));
  }, (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function updateUserPresence(userId: string, status: PresenceStatus): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await updateDoc(doc(db, COLLECTIONS.users, userId), stripUndefined({
    presenceStatus: status,
    lastActiveAt: serverTimestamp()
  }));
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await updateDoc(doc(db, COLLECTIONS.users, userId), { role });
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
    reportEmailRecipients: data.reportEmailRecipients || []
  };
}

export async function fetchOrganization(orgId: string): Promise<Organization | null> {
  if (!isFirebaseConfigured) notConfigured();
  const snap = await getDoc(doc(db, COLLECTIONS.organizations, orgId));
  return snap.exists() ? mapOrganization(orgId, snap.data()) : null;
}

export async function updateOrganization(orgId: string, updates: Partial<Organization>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await updateDoc(doc(db, COLLECTIONS.organizations, orgId), stripUndefined(updates as any));
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
  const q = query(collection(db, COLLECTIONS.teams), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapTeam(d.id, d.data()));
}

export function subscribeTeams(orgId: string, cb: (teams: Team[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(db, COLLECTIONS.teams), where('organizationId', '==', orgId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => mapTeam(d.id, d.data()))), (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function createTeam(team: Omit<Team, 'id' | 'organizationId' | 'createdAt'>, orgId: string): Promise<Team> {
  if (!isFirebaseConfigured) notConfigured();
  const ref = await addDoc(collection(db, COLLECTIONS.teams), stripUndefined({
    ...team,
    organizationId: orgId,
    createdAt: serverTimestamp()
  }));
  return { id: ref.id, organizationId: orgId, ...team, createdAt: new Date().toISOString() };
}

export async function updateTeam(teamId: string, updates: Partial<Team>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await updateDoc(doc(db, COLLECTIONS.teams, teamId), stripUndefined(updates as any));
}

export async function deleteTeam(teamId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await deleteDoc(doc(db, COLLECTIONS.teams, teamId));
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await updateDoc(doc(db, COLLECTIONS.users, userId), stripUndefined(updates as any));
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
    memberIds: data.memberIds || [],
    startDate: data.startDate || new Date().toISOString().split('T')[0],
    dueDate: data.dueDate || new Date().toISOString().split('T')[0],
    weightedProgress: data.weightedProgress || 0,
    createdAt: tsToIso(data.createdAt) || new Date().toISOString(),
    updatedAt: tsToIso(data.updatedAt) || new Date().toISOString()
  };
}

export async function fetchProjects(orgId: string): Promise<Project[]> {
  if (!isFirebaseConfigured) notConfigured();
  const q = query(collection(db, COLLECTIONS.projects), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapProject(d.id, d.data()));
}

export function subscribeProjects(orgId: string, cb: (projects: Project[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(db, COLLECTIONS.projects), where('organizationId', '==', orgId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => mapProject(d.id, d.data()))), (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function createProject(project: Omit<Project, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'weightedProgress'>, orgId: string): Promise<Project> {
  if (!isFirebaseConfigured) notConfigured();
  const ref = await addDoc(collection(db, COLLECTIONS.projects), stripUndefined({
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
  await updateDoc(doc(db, COLLECTIONS.projects, projectId), stripUndefined({
    ...updates,
    updatedAt: serverTimestamp()
  }));
}

export async function deleteProject(projectId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await deleteDoc(doc(db, COLLECTIONS.projects, projectId));
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
  const q = query(collection(db, COLLECTIONS.tasks), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapTask(d.id, d.data()));
}

export function subscribeTasks(orgId: string, cb: (tasks: Task[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(db, COLLECTIONS.tasks), where('organizationId', '==', orgId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => mapTask(d.id, d.data()))), (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function createTask(task: Omit<Task, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>, orgId: string): Promise<Task> {
  if (!isFirebaseConfigured) notConfigured();
  const ref = await addDoc(collection(db, COLLECTIONS.tasks), stripUndefined({
    ...task,
    organizationId: orgId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));
  return { id: ref.id, organizationId: orgId, ...task, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await updateDoc(doc(db, COLLECTIONS.tasks, taskId), stripUndefined({
    ...updates,
    updatedAt: serverTimestamp()
  }));
}

export async function deleteTask(taskId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await deleteDoc(doc(db, COLLECTIONS.tasks, taskId));
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
  const q = query(collection(db, COLLECTIONS.objectives), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapObjective(d.id, d.data()));
}

export function subscribeObjectives(orgId: string, cb: (items: Objective[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(db, COLLECTIONS.objectives), where('organizationId', '==', orgId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => mapObjective(d.id, d.data()))), (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function createObjective(obj: Omit<Objective, 'id' | 'organizationId' | 'createdAt'>, orgId: string): Promise<Objective> {
  if (!isFirebaseConfigured) notConfigured();
  const ref = await addDoc(collection(db, COLLECTIONS.objectives), stripUndefined({
    ...obj,
    organizationId: orgId,
    createdAt: serverTimestamp()
  }));
  return { id: ref.id, organizationId: orgId, ...obj, createdAt: new Date().toISOString() };
}

export async function updateObjective(objId: string, updates: Partial<Objective>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await updateDoc(doc(db, COLLECTIONS.objectives, objId), stripUndefined(updates as any));
}

export async function deleteObjective(objId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await deleteDoc(doc(db, COLLECTIONS.objectives, objId));
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
  const q = query(collection(db, COLLECTIONS.attendance), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapAttendance(d.id, d.data()));
}

export function subscribeAttendance(orgId: string, cb: (items: AttendanceRecord[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(db, COLLECTIONS.attendance), where('organizationId', '==', orgId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => mapAttendance(d.id, d.data()))), (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function upsertAttendance(record: AttendanceRecord): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await setDoc(doc(db, COLLECTIONS.attendance, record.id), stripUndefined(record), { merge: true });
}

export async function updateAttendance(recordId: string, updates: Partial<AttendanceRecord>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await updateDoc(doc(db, COLLECTIONS.attendance, recordId), stripUndefined(updates as any));
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
  const q = query(collection(db, COLLECTIONS.notifications), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapNotification(d.id, d.data()));
}

export function subscribeNotifications(userId: string, cb: (items: Notification[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(db, COLLECTIONS.notifications), where('userId', '==', userId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => mapNotification(d.id, d.data()))), (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function createNotification(notif: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
  if (!isFirebaseConfigured) notConfigured();
  const ref = await addDoc(collection(db, COLLECTIONS.notifications), stripUndefined({
    ...notif,
    createdAt: serverTimestamp()
  }));
  return { id: ref.id, ...notif, createdAt: new Date().toISOString() };
}

export async function markNotificationRead(notifId: string, read: boolean): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await updateDoc(doc(db, COLLECTIONS.notifications, notifId), { read });
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
  const q = query(collection(db, COLLECTIONS.comments), where('taskId', '==', taskId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapComment(d.id, d.data()));
}

export function subscribeComments(taskId: string, cb: (items: Comment[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(db, COLLECTIONS.comments), where('taskId', '==', taskId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => mapComment(d.id, d.data()))), (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function addCommentDb(comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
  if (!isFirebaseConfigured) notConfigured();
  const ref = await addDoc(collection(db, COLLECTIONS.comments), stripUndefined({
    ...comment,
    createdAt: serverTimestamp()
  }));
  return { id: ref.id, ...comment, createdAt: new Date().toISOString() };
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
    sentAt: tsToIso(data.sentAt),
    recipients: data.recipients || [],
    status: data.status || 'draft'
  };
}

export async function fetchReports(orgId: string): Promise<DailyReport[]> {
  if (!isFirebaseConfigured) notConfigured();
  const q = query(collection(db, COLLECTIONS.reports), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapReport(d.id, d.data()));
}

export function subscribeReports(orgId: string, cb: (items: DailyReport[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  const q = query(collection(db, COLLECTIONS.reports), where('organizationId', '==', orgId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => mapReport(d.id, d.data()))), (error) => {
    console.error(`[Firestore] Error in subscription:`, error);
    cb([]); // Return empty array on error to prevent crashes
  });
}

export async function createReportDb(report: Omit<DailyReport, 'id'>): Promise<DailyReport> {
  if (!isFirebaseConfigured) notConfigured();
  const ref = await addDoc(collection(db, COLLECTIONS.reports), stripUndefined(report));
  return { id: ref.id, ...report };
}

export async function updateReport(reportId: string, updates: Partial<DailyReport>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await updateDoc(doc(db, COLLECTIONS.reports, reportId), stripUndefined(updates as any));
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
  const q = query(collection(db, COLLECTIONS.auditLogs), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapAuditLog(d.id, d.data()));
}

export async function createAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await addDoc(collection(db, COLLECTIONS.auditLogs), stripUndefined({
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

  const response = await fetch('/api/upload-avatar', {
    method: 'POST',
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
    const docSnap = await getDoc(doc(db, COLLECTIONS.users, userId));
    return docSnap.exists() ? mapUser(docSnap.id, docSnap.data()) : null;
  } catch (error) {
    console.error('[Firestore] Error fetching user by ID:', error);
    return null;
  }
}

export async function fetchTeamById(teamId: string): Promise<Team | null> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    const docSnap = await getDoc(doc(db, COLLECTIONS.teams, teamId));
    return docSnap.exists() ? mapTeam(docSnap.id, docSnap.data()) : null;
  } catch (error) {
    console.error('[Firestore] Error fetching team by ID:', error);
    return null;
  }
}

export async function fetchProjectById(projectId: string): Promise<Project | null> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    const docSnap = await getDoc(doc(db, COLLECTIONS.projects, projectId));
    return docSnap.exists() ? mapProject(docSnap.id, docSnap.data()) : null;
  } catch (error) {
    console.error('[Firestore] Error fetching project by ID:', error);
    return null;
  }
}

export async function fetchTaskById(taskId: string): Promise<Task | null> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    const docSnap = await getDoc(doc(db, COLLECTIONS.tasks, taskId));
    return docSnap.exists() ? mapTask(docSnap.id, docSnap.data()) : null;
  } catch (error) {
    console.error('[Firestore] Error fetching task by ID:', error);
    return null;
  }
}

export async function fetchObjectiveById(objectiveId: string): Promise<Objective | null> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    const docSnap = await getDoc(doc(db, COLLECTIONS.objectives, objectiveId));
    return docSnap.exists() ? mapObjective(docSnap.id, docSnap.data()) : null;
  } catch (error) {
    console.error('[Firestore] Error fetching objective by ID:', error);
    return null;
  }
}

export async function fetchAttendanceById(recordId: string): Promise<AttendanceRecord | null> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    const docSnap = await getDoc(doc(db, COLLECTIONS.attendance, recordId));
    return docSnap.exists() ? mapAttendance(docSnap.id, docSnap.data()) : null;
  } catch (error) {
    console.error('[Firestore] Error fetching attendance by ID:', error);
    return null;
  }
}

export async function fetchNotificationById(notificationId: string): Promise<Notification | null> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    const docSnap = await getDoc(doc(db, COLLECTIONS.notifications, notificationId));
    return docSnap.exists() ? mapNotification(docSnap.id, docSnap.data()) : null;
  } catch (error) {
    console.error('[Firestore] Error fetching notification by ID:', error);
    return null;
  }
}

export async function fetchReportById(reportId: string): Promise<DailyReport | null> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    const docSnap = await getDoc(doc(db, COLLECTIONS.reports, reportId));
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
    await deleteDoc(doc(db, COLLECTIONS.users, userId));
  } catch (error) {
    console.error('[Firestore] Error deleting user:', error);
    throw error;
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    await deleteDoc(doc(db, COLLECTIONS.notifications, notificationId));
  } catch (error) {
    console.error('[Firestore] Error deleting notification:', error);
    throw error;
  }
}

export async function deleteComment(commentId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    await deleteDoc(doc(db, COLLECTIONS.comments, commentId));
  } catch (error) {
    console.error('[Firestore] Error deleting comment:', error);
    throw error;
  }
}

export async function deleteReport(reportId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    await deleteDoc(doc(db, COLLECTIONS.reports, reportId));
  } catch (error) {
    console.error('[Firestore] Error deleting report:', error);
    throw error;
  }
}

export async function deleteAttendance(recordId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  try {
    await deleteDoc(doc(db, COLLECTIONS.attendance, recordId));
  } catch (error) {
    console.error('[Firestore] Error deleting attendance:', error);
    throw error;
  }
}

// ---------- Generic delete ----------

export async function deleteDocument(collectionName: string, docId: string): Promise<void> {
  if (!isFirebaseConfigured) notConfigured();
  await deleteDoc(doc(db, collectionName, docId));
}

export { COLLECTIONS };
