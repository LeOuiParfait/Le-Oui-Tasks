import {
  User,
  Organization,
  Team,
  Project,
  Task,
  TaskStatus,
  Objective,
  AttendanceRecord,
  Notification,
  AuditLog,
  DailyReport,
  Comment,
  Subtask,
  WorkDayReport
} from '../types';
import {
  initialOrganization,
  initialUsers,
  initialTeams,
  initialProjects,
  initialTasks,
  initialObjectives,
  initialAttendanceRecords,
  initialNotifications,
  initialAuditLogs,
  initialReports
} from '../data/seedData';
import { isFirebaseConfigured } from './firebase';
import * as db from './dbService';
import type { Unsubscribe } from 'firebase/firestore';
import {
  canEditOrgSettings,
  canCreateProject,
  canDeleteProject,
  canEditProject,
  canCreateTask,
  canEditTask,
  canDeleteTask,
  canApproveTask,
  canCreateTeam,
  canDeleteTeam,
  canManageTeamMembers,
  canEditTeam,
  canCreateObjective,
  canDeleteObjective,
  canGenerateOrgReport,
  canChangeRoles,
  isAdmin
} from './permissions';

const STORAGE_PREFIX = 'tasking_app_v1_';

type Listener = () => void;

class AppStore {
  private listeners: Set<Listener> = new Set();
  private subs: Unsubscribe[] = [];
  private commentSubs: Record<string, Unsubscribe> = {}; // Track comment subscriptions per task
  private onProfileUpdate: ((updates: Partial<User>) => void) | null = null;

  private currentUser: User | null = null;
  private organization: Organization | null = null;
  private users: User[] = [];
  private teams: Team[] = [];
  private projects: Project[] = [];
  private tasks: Task[] = [];
  private allTasks: Task[] = [];
  private objectives: Objective[] = [];
  private attendanceRecords: AttendanceRecord[] = [];
  private notifications: Notification[] = [];
  private auditLogs: AuditLog[] = [];
  private reports: DailyReport[] = [];
  private workDayReports: WorkDayReport[] = [];
  private comments: Record<string, Comment[]> = {};

  private initialized = false;
  private orgId: string | null = null;

  constructor() {
    // In local fallback mode (Firebase not configured), load from localStorage/seed
    if (!isFirebaseConfigured) {
      this.initLocalFallback();
    }
  }

  // ---------- Local fallback (no Firebase) ----------

  private initLocalFallback() {
    this.organization = this.loadLocal('organization', initialOrganization);
    this.users = this.loadLocal('users', initialUsers);
    this.teams = this.loadLocal('teams', initialTeams);
    this.projects = this.loadLocal('projects', initialProjects);
    this.tasks = this.loadLocal('tasks', initialTasks);
    this.objectives = this.loadLocal('objectives', initialObjectives);
    this.attendanceRecords = this.loadLocal('attendance', initialAttendanceRecords);
    this.notifications = this.loadLocal('notifications', initialNotifications);
    this.auditLogs = this.loadLocal('auditLogs', initialAuditLogs);
    this.reports = this.loadLocal('reports', initialReports);
    this.comments = this.loadLocal('comments', {
      'task-10': [
        {
          id: 'comm-1',
          taskId: 'task-10',
          authorId: 'user-2',
          content: 'J\'ai vérifié la spec OpenAPI v3 avec les réponses de nos endpoints. Tout correspond parfaitement.',
          createdAt: '2026-08-10T16:30:00Z'
        }
      ]
    });

    const savedUserId = localStorage.getItem(`${STORAGE_PREFIX}active_user_id`);
    this.currentUser = this.users.find((u) => u.id === savedUserId) || this.users[0];
    this.initialized = true;
  }

  private loadLocal<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  private saveLocal(key: string, data: any) {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(data));
    } catch (e) {
      console.error('LocalStorage error', e);
    }
  }

  // ---------- Helpers ----------

  private refreshTasks() {
    const currentUser = this.getCurrentUser();
    const isSuperAdmin = currentUser?.role === 'super_admin';
    if (isSuperAdmin) {
      this.tasks = this.allTasks;
    } else {
      const projectIds = this.projects.map(p => p.id);
      this.tasks = this.allTasks.filter(t => projectIds.includes(t.projectId));
    }
    const projectIds = new Set(this.tasks.map(t => t.projectId));
    projectIds.forEach(pid => this.recalculateProjectProgress(pid));
  }

  // ---------- Firestore initialization ----------

  /** Initialize the store with Firestore subscriptions for the given organization. */
  init(orgId: string, currentUser: User, organization: Organization) {
    if (!isFirebaseConfigured) return;

    this.destroy();
    this.orgId = orgId;
    this.currentUser = currentUser;
    this.organization = organization;
    this.initialized = true;

    const isSuperAdmin = currentUser.role === 'super_admin';

    this.subs.push(db.subscribeUsers(orgId, (items) => {
      this.users = items;
      const me = items.find((u) => u.id === this.currentUser?.id);
      if (me) this.currentUser = me;
      this.notifyListeners();
    }));
    this.subs.push(db.subscribeTeams(orgId, (items) => { this.teams = items; this.notifyListeners(); }));
    
    // Projects: filter by user membership unless super_admin
    this.subs.push(db.subscribeProjects(orgId, currentUser.id, currentUser.teamIds || [], isSuperAdmin, (items) => {
      this.projects = items;
      this.refreshTasks();
      this.notifyListeners();
    }));
    
    // Tasks: filter by project membership
    this.subs.push(db.subscribeTasks(orgId, currentUser.id, currentUser.teamIds || [], isSuperAdmin, (items) => {
      this.allTasks = items;
      this.refreshTasks();
    }));
    
    this.subs.push(db.subscribeObjectives(orgId, (items) => { this.objectives = items; this.notifyListeners(); }));
    this.subs.push(db.subscribeAttendance(orgId, currentUser.id, isSuperAdmin, (items) => { this.attendanceRecords = items; this.notifyListeners(); }));
    this.subs.push(db.subscribeNotifications(currentUser.id, (items) => { this.notifications = items; this.notifyListeners(); }));
    this.subs.push(db.subscribeReports(orgId, (items) => { this.reports = items; this.notifyListeners(); }));
    this.subs.push(db.subscribeWorkDayReports(orgId, (items) => { this.workDayReports = items; this.notifyListeners(); }));
  }

  /** Tear down all Firestore subscriptions. */
  destroy() {
    this.subs.forEach((unsub) => { try { unsub(); } catch {} });
    this.subs = [];
    // Unsubscribe from all comment subscriptions
    Object.values(this.commentSubs).forEach((unsub) => { try { unsub(); } catch {} });
    this.commentSubs = {};
    this.orgId = null;
  }

  /** Update the current user reference (e.g. after profile changes). */
  setCurrentUser(user: User) {
    this.currentUser = user;
    this.notifyListeners();
  }

  /** Set a callback to sync profile updates back to AuthContext. */
  setOnProfileUpdate(cb: (updates: Partial<User>) => void) {
    this.onProfileUpdate = cb;
  }

  // ---------- Subscription / listeners ----------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => fn());
  }

  private notify() {
    if (!isFirebaseConfigured) {
      // Local mode: persist to localStorage
      this.saveLocal('organization', this.organization);
      this.saveLocal('users', this.users);
      this.saveLocal('teams', this.teams);
      this.saveLocal('projects', this.projects);
      this.saveLocal('tasks', this.tasks);
      this.saveLocal('objectives', this.objectives);
      this.saveLocal('attendance', this.attendanceRecords);
      this.saveLocal('notifications', this.notifications);
      this.saveLocal('auditLogs', this.auditLogs);
      this.saveLocal('reports', this.reports);
      this.saveLocal('comments', this.comments);
    }
    this.notifyListeners();
  }

  // ---------- Getters ----------

  getCurrentUser(): User {
    return this.currentUser || initialUsers[0];
  }

  getOrganization(): Organization {
    return this.organization || initialOrganization;
  }

  async updateOrganization(updates: Partial<Organization>): Promise<void> {
    // SÉCURITÉ : Seuls les admin/super_admin peuvent modifier les paramètres de l'org
    const user = this.getCurrentUser();
    if (!canEditOrgSettings(user)) {
      throw new Error('Vous n\'avez pas l\'autorisation de modifier les paramètres de l\'organisation.');
    }
    const orgId = this.getOrganization().id;
    if (isFirebaseConfigured) {
      await db.updateOrganization(orgId, updates);
    }
    this.organization = { ...this.getOrganization(), ...updates };
    this.notify();
  }

  getUsers(): User[] {
    return this.users;
  }

  getTeams(): Team[] {
    return this.teams;
  }

  getProjects(): Project[] {
    return this.projects;
  }

  getTasks(): Task[] {
    return this.tasks;
  }

  getObjectives(): Objective[] {
    return this.objectives;
  }

  getAttendanceRecords(): AttendanceRecord[] {
    return this.attendanceRecords;
  }

  getNotifications(): Notification[] {
    const uid = this.currentUser?.id;
    return uid ? this.notifications.filter((n) => n.userId === uid) : [];
  }

  getAuditLogs(): AuditLog[] {
    return this.auditLogs;
  }

  getReports(): DailyReport[] {
    return this.reports;
  }

  // === WorkDayReports (bilans journaliers individuels) ===
  getWorkDayReports(): WorkDayReport[] {
    return this.workDayReports;
  }

  getMyWorkDayReports(): WorkDayReport[] {
    const user = this.getCurrentUser();
    return this.workDayReports.filter(r => r.userId === user.id);
  }

  getVisibleWorkDayReports(): WorkDayReport[] {
    const user = this.getCurrentUser();
    // super_admin et admin voient tout
    if (user.role === 'super_admin' || user.role === 'admin') {
      return this.workDayReports;
    }
    // team_lead voit les bilans de son équipe
    if (user.role === 'team_lead') {
      const myTeams = this.teams.filter(t => t.managerId === user.id);
      const teamMemberIds = new Set<string>();
      myTeams.forEach(t => t.memberIds.forEach(id => teamMemberIds.add(id)));
      teamMemberIds.add(user.id);
      return this.workDayReports.filter(r => teamMemberIds.has(r.userId));
    }
    // manager voit les bilans des users de ses projets
    if (user.role === 'manager') {
      const myProjects = this.projects.filter(p =>
        p.memberIds.includes(user.id) &&
        (p.ownerId === user.id || p.members.some(m => m.userId === user.id && m.role === 'lead'))
      );
      const projectMemberIds = new Set<string>();
      myProjects.forEach(p => p.memberIds.forEach(id => projectMemberIds.add(id)));
      projectMemberIds.add(user.id);
      return this.workDayReports.filter(r => projectMemberIds.has(r.userId));
    }
    // user et viewer : uniquement leurs propres bilans
    return this.workDayReports.filter(r => r.userId === user.id);
  }

  async submitWorkDayReport(report: Partial<WorkDayReport>): Promise<WorkDayReport> {
    const user = this.getCurrentUser();
    const orgId = this.getOrganization().id;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // Trouver l'équipe du user
    const userTeam = this.teams.find(t => t.memberIds.includes(user.id));

    const fullReport: WorkDayReport = {
      id: report.id || `wdr-${user.id}-${today}`,
      organizationId: orgId,
      userId: user.id,
      teamId: userTeam?.id,
      date: today,
      summary: report.summary || '',
      tasksWorkedOn: report.tasksWorkedOn || [],
      achievements: report.achievements || '',
      challenges: report.challenges || '',
      planTomorrow: report.planTomorrow || '',
      workMinutes: report.workMinutes || 0,
      breakMinutes: report.breakMinutes || 0,
      startTime: report.startTime,
      endTime: report.endTime,
      status: 'submitted',
      submittedAt: now,
      visibleTo: [],
      createdAt: report.createdAt || now,
      updatedAt: now
    };

    if (isFirebaseConfigured) {
      await db.upsertWorkDayReport(fullReport);
    } else {
      this.workDayReports = [fullReport, ...this.workDayReports.filter(r => r.id !== fullReport.id)];
    }

    await this.logAudit('Bilan Journalier Soumis', 'report', fullReport.id, 'Soumission', `Bilan soumis pour ${today}`);
    this.notify();
    return fullReport;
  }

  async saveWorkDayReportDraft(report: Partial<WorkDayReport>): Promise<WorkDayReport> {
    const user = this.getCurrentUser();
    const orgId = this.getOrganization().id;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    const userTeam = this.teams.find(t => t.memberIds.includes(user.id));

    const fullReport: WorkDayReport = {
      id: report.id || `wdr-${user.id}-${today}`,
      organizationId: orgId,
      userId: user.id,
      teamId: userTeam?.id,
      date: today,
      summary: report.summary || '',
      tasksWorkedOn: report.tasksWorkedOn || [],
      achievements: report.achievements || '',
      challenges: report.challenges || '',
      planTomorrow: report.planTomorrow || '',
      workMinutes: report.workMinutes || 0,
      breakMinutes: report.breakMinutes || 0,
      startTime: report.startTime,
      endTime: report.endTime,
      status: 'draft',
      visibleTo: [],
      createdAt: report.createdAt || now,
      updatedAt: now
    };

    if (isFirebaseConfigured) {
      await db.upsertWorkDayReport(fullReport);
    } else {
      this.workDayReports = [fullReport, ...this.workDayReports.filter(r => r.id !== fullReport.id)];
    }

    this.notify();
    return fullReport;
  }

  getTaskComments(taskId: string): Comment[] {
    return this.comments[taskId] || [];
  }

  /** Subscribe to comments for a specific task in real-time */
  subscribeTaskComments(taskId: string) {
    if (!isFirebaseConfigured) return;
    
    // Unsubscribe if already subscribed
    if (this.commentSubs[taskId]) {
      try { this.commentSubs[taskId](); } catch {}
    }

    // Subscribe to comments for this task
    this.commentSubs[taskId] = db.subscribeComments(taskId, (items) => {
      this.comments[taskId] = items;
      this.notifyListeners();
    });
  }

  /** Unsubscribe from comments for a specific task */
  unsubscribeTaskComments(taskId: string) {
    if (this.commentSubs[taskId]) {
      try { this.commentSubs[taskId](); } catch {}
      delete this.commentSubs[taskId];
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // ---------- Demo user switcher (local mode only) ----------

  switchActiveUser(userId: string) {
    if (isFirebaseConfigured) return; // Disabled in production — real auth only
    const user = this.users.find((u) => u.id === userId);
    if (user) {
      this.currentUser = user;
      localStorage.setItem(`${STORAGE_PREFIX}active_user_id`, userId);
      this.notify();
    }
  }

  // ---------- Audit + Notification helpers ----------

  private async logAudit(
    action: string,
    targetType: AuditLog['targetType'],
    targetId: string,
    targetTitle: string,
    details?: string
  ) {
    const actor = this.currentUser;
    if (!actor || !this.orgId) return;

    const log: Omit<AuditLog, 'id' | 'timestamp'> = {
      organizationId: this.orgId,
      actorId: actor.id,
      actorName: `${actor.firstName} ${actor.lastName}`,
      action,
      targetType,
      targetId,
      targetTitle,
      details
    };

    if (isFirebaseConfigured) {
      try { await db.createAuditLog(log); } catch (e) { console.error('[Audit] Erreur Firestore:', e); }
    } else {
      const entry: AuditLog = {
        ...log,
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString()
      };
      this.auditLogs = [entry, ...this.auditLogs];
    }
  }

  private async notifyUser(
    userId: string,
    type: Notification['type'],
    title: string,
    message: string,
    link?: string
  ) {
    const notif: Omit<Notification, 'id' | 'createdAt'> = {
      userId,
      type,
      title,
      message,
      link,
      read: false
    };

    if (isFirebaseConfigured) {
      try {
        await db.createNotification(notif);
        const targetUser = this.users.find((u) => u.id === userId);
        if (targetUser?.email) {
          db.sendNotificationEmail(targetUser.email, { title, message, link }).catch((e) => {
            console.warn('[Notif] E-mail non envoyé:', e);
          });
        }
      } catch (e) { console.error('[Notif] Erreur Firestore:', e); }
    } else {
      const entry: Notification = {
        ...notif,
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString()
      };
      this.notifications = [entry, ...this.notifications];
    }
  }

  // ---------- Attendance / Workday ----------

  async startWorkday(summary?: string) {
    const user = this.getCurrentUser();
    const orgId = this.getOrganization().id;
    const today = new Date().toISOString().split('T')[0];
    const nowHHMM = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    // Vérifier si la journée est déjà terminée
    const existingRecord = this.attendanceRecords.find((r) => r.userId === user.id && r.date === today);
    if (existingRecord?.status === 'completed') {
      throw new Error('Votre journée est déjà terminée. Attendez demain à l\'heure de début pour pointer à nouveau.');
    }

    let record = existingRecord;

    if (!record) {
      // Premier démarrage de la journée : on crée un nouveau record
      record = {
        id: `att-${user.id}-${today}`,
        userId: user.id,
        organizationId: orgId,
        date: today,
        startTime: nowHHMM,
        totalWorkMinutes: 0,
        totalBreakMinutes: 0,
        status: 'working',
        summary: summary || 'Journée démarrée'
      };
    } else if (record.status === 'completed') {
      // Redémarrage après une journée terminée : on garde l'historique
      // mais on réinitialise les champs de timing pour la nouvelle session
      record.status = 'working';
      record.startTime = nowHHMM;
      record.endTime = undefined;
      record.breakStartTime = undefined;
      record.totalWorkMinutes = 0;
      record.totalBreakMinutes = 0;
      record.summary = summary || 'Journée redémarrée';
    } else {
      // Reprendre une journée en cours (working ou on_break)
      record.status = 'working';
      if (summary) record.summary = summary;
    }

    this.attendanceRecords = [record, ...this.attendanceRecords.filter((r) => r.id !== record!.id)];
    this.currentUser = { ...this.currentUser, presenceStatus: 'online' } as User;
    this.users = this.users.map((u) => u.id === user.id ? { ...u, presenceStatus: 'online' } : u);
    if (this.onProfileUpdate) this.onProfileUpdate({ presenceStatus: 'online' });

    if (isFirebaseConfigured) {
      await db.serverStartWorkday(record);
    }

    await this.logAudit('Démarrage Journée', 'attendance', record.id, 'Pointage Entrée', `Pointé à ${nowHHMM}`);
    this.notify();
  }

  async toggleBreak() {
    const user = this.getCurrentUser();
    const today = new Date().toISOString().split('T')[0];
    const record = this.attendanceRecords.find((r) => r.userId === user.id && r.date === today);
    if (!record) return;

    const presence: 'online' | 'away' = record.status === 'working' ? 'away' : 'online';

    if (record.status === 'working') {
      record.status = 'on_break';
      record.breakStartTime = new Date().toISOString();
      if (!isFirebaseConfigured) this.currentUser!.presenceStatus = 'away';
      await this.logAudit('Début Pause', 'attendance', record.id, 'Pause');
    } else if (record.status === 'on_break') {
      record.status = 'working';
      if (record.breakStartTime) {
        const breakMins = Math.round((Date.now() - new Date(record.breakStartTime).getTime()) / 60000);
        record.totalBreakMinutes += Math.max(1, breakMins);
        record.breakStartTime = undefined;
      }
      if (!isFirebaseConfigured) this.currentUser!.presenceStatus = 'online';
      await this.logAudit('Fin Pause', 'attendance', record.id, 'Reprise');
    }

    this.attendanceRecords = this.attendanceRecords.map((r) => r.id === record!.id ? record! : r);
    this.currentUser = { ...this.currentUser, presenceStatus: presence } as User;
    this.users = this.users.map((u) => u.id === user.id ? { ...u, presenceStatus: presence } : u);
    if (this.onProfileUpdate) this.onProfileUpdate({ presenceStatus: presence });
    this.notify();

    if (isFirebaseConfigured) {
      await db.serverToggleBreak(record!, presence);
    }
  }

  async endWorkday(summary?: string) {
    const user = this.getCurrentUser();
    const today = new Date().toISOString().split('T')[0];
    const record = this.attendanceRecords.find((r) => r.userId === user.id && r.date === today);
    const nowHHMM = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    if (record) {
      record.status = 'completed';
      record.endTime = nowHHMM;
      if (summary) record.summary = summary;

      // Calcul du temps de travail déclaré (startTime → endTime - pauses)
      if (record.startTime) {
        const [sh, sm] = record.startTime.split(':').map(Number);
        const startMinutes = sh * 60 + sm;
        const [eh, em] = nowHHMM.split(':').map(Number);
        const endMinutes = eh * 60 + em;
        const totalElapsed = Math.max(0, endMinutes - startMinutes);
        record.totalWorkMinutes = Math.max(0, totalElapsed - record.totalBreakMinutes);
      }

      // Détection d'inactivité : comparer lastActiveAt avec startTime
      // Si le dernier heartbeat est vieux de +15 min, le temps est "estimé"
      const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt) : null;
      const now = new Date();
      if (lastActive) {
        const minutesSinceLastActive = (now.getTime() - lastActive.getTime()) / 60000;
        if (minutesSinceLastActive > 15) {
          record.timeEstimated = true;
          // Période d'inactivité détectée
          if (!record.inactivePeriods) record.inactivePeriods = [];
          record.inactivePeriods.push({
            start: lastActive.toISOString(),
            end: now.toISOString(),
            minutes: Math.round(minutesSinceLastActive)
          });
        } else {
          record.timeEstimated = false;
        }
      }
      record.lastHeartbeatAt = user.lastActiveAt;
    }

    this.attendanceRecords = this.attendanceRecords.map((r) => r.id === record?.id ? record! : r);
    this.currentUser = { ...this.currentUser, presenceStatus: 'offline' } as User;
    this.users = this.users.map((u) => u.id === user.id ? { ...u, presenceStatus: 'offline' } : u);
    if (this.onProfileUpdate) this.onProfileUpdate({ presenceStatus: 'offline' });
    this.notify();

    if (isFirebaseConfigured) {
      if (record) await db.serverEndWorkday(record);
    }

    await this.logAudit('Fin Journée', 'attendance', record?.id || 'att-end', 'Pointage Sortie', `Pointé à ${nowHHMM}${record?.timeEstimated ? ' (temps estimé)' : ''}`);
  }

  // ---------- Task Operations ----------

  async createTask(taskData: Omit<Task, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    const proj = this.projects.find((p) => p.id === taskData.projectId);
    if (!canCreateTask(user, proj)) {
      throw new Error('Vous n\'avez pas l\'autorisation de créer une tâche dans ce projet.');
    }
    const orgId = this.getOrganization().id;
    const taskWithMeta = {
      ...taskData,
      memberIds: taskData.memberIds?.length ? taskData.memberIds : (proj?.memberIds || []),
      teamIds: taskData.teamIds?.length ? taskData.teamIds : (proj?.teamIds || [])
    };

    if (isFirebaseConfigured) {
      const newTask = await db.createTask(taskWithMeta, orgId);
      // onSnapshot mettra à jour this.tasks avec la source de vérité Firestore
      this.recalculateProjectProgress(newTask.projectId);
      this.notify();
      await this.notifyAssignees(newTask, 'task_assigned', 'Assignation de Tâche', `${this.getCurrentUser().firstName} vous a assigné la tâche « ${newTask.title} ».`, `/tasks/${newTask.id}`);
      await this.logAudit('Tâche Créée', 'task', newTask.id, newTask.title, `Statut: ${newTask.status}, Priorité: ${newTask.priority}`);
      return newTask;
    }

    // Local mode
    const newTask: Task = {
      ...taskWithMeta,
      id: `task-${Date.now()}`,
      organizationId: orgId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.tasks = [newTask, ...this.tasks];
    this.recalculateProjectProgress(newTask.projectId);
    await this.notifyAssignees(newTask, 'task_assigned', 'Assignation de Tâche', `${this.getCurrentUser().firstName} vous a assigné la tâche « ${newTask.title} ».`, `/tasks/${newTask.id}`);
    await this.logAudit('Tâche Créée', 'task', newTask.id, newTask.title, `Statut: ${newTask.status}, Priorité: ${newTask.priority}`);
    this.notify();
    return newTask;
  }

  private async notifyAssignees(task: Task, type: Notification['type'], title: string, message: string, link?: string) {
    for (const uid of task.assigneeIds) {
      if (uid !== this.getCurrentUser().id) {
        await this.notifyUser(uid, type, title, message, link);
      }
    }
  }

  async updateTask(taskId: string, updates: Partial<Task>) {
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    const task = this.tasks.find((t) => t.id === taskId);
    const proj = task ? this.projects.find((p) => p.id === task.projectId) : undefined;
    if (!canEditTask(user, task?.assigneeIds || [], proj)) {
      throw new Error('Vous n\'avez pas l\'autorisation de modifier cette tâche.');
    }
    const newProject = updates.projectId ? this.projects.find((p) => p.id === updates.projectId) : undefined;
    const metaUpdates = newProject ? { memberIds: newProject.memberIds, teamIds: newProject.teamIds } : {};
    this.tasks = this.tasks.map((t) => t.id === taskId ? { ...t, ...updates, ...metaUpdates, updatedAt: new Date().toISOString() } : t);
    const updatedTask = this.tasks.find((t) => t.id === taskId);
    if (updatedTask) this.recalculateProjectProgress(updatedTask.projectId);
    this.notify();

    const previousAssignees = task?.assigneeIds || [];
    const newAssignees = (updates.assigneeIds || []).filter((uid) => !previousAssignees.includes(uid));

    for (const uid of newAssignees) {
      if (uid !== this.getCurrentUser().id) {
        await this.notifyUser(uid, 'task_assigned', 'Assignation de Tâche', `${this.getCurrentUser().firstName} vous a assigné la tâche « ${updatedTask?.title || taskId} ».`, `/tasks/${taskId}`);
      }
    }

    if (isFirebaseConfigured) {
      await db.updateTask(taskId, updates);
    }

    await this.logAudit('Tâche Modifiée', 'task', taskId, updatedTask?.title || taskId, 'Champs mis à jour');
  }

  async updateTaskStatus(taskId: string, newStatus: TaskStatus, blockerReason?: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    const proj = this.projects.find((p) => p.id === task.projectId);
    if (!canEditTask(user, task.assigneeIds, proj)) {
      throw new Error('Vous n\'avez pas l\'autorisation de modifier cette tâche.');
    }
    const oldStatus = task.status;

    const updates: Partial<Task> = { status: newStatus, updatedAt: new Date().toISOString() };
    if (newStatus === 'Blocked' && blockerReason) updates.blockerReason = blockerReason;
    else if (newStatus !== 'Blocked') updates.blockerReason = undefined;
    if (newStatus === 'Completed') updates.completedAt = new Date().toISOString();

    this.tasks = this.tasks.map((t) => t.id === taskId ? { ...t, ...updates } : t);
    this.recalculateProjectProgress(task.projectId);
    this.notify();

    if (isFirebaseConfigured) {
      await db.updateTask(taskId, updates);
    }

    await this.logAudit('Changement de Statut', 'task', taskId, task.title, `De « ${oldStatus} » à « ${newStatus} »${blockerReason ? ` (Raison: ${blockerReason})` : ''}`);
  }

  async submitTaskForReview(taskId: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    // SÉCURITÉ : Vérifier l'autorisation (assigné ou éditeur du projet)
    const user = this.getCurrentUser();
    const proj = this.projects.find((p) => p.id === task.projectId);
    if (!canEditTask(user, task.assigneeIds, proj)) {
      throw new Error('Vous n\'avez pas l\'autorisation de soumettre cette tâche.');
    }

    task.status = 'In Review';
    task.updatedAt = new Date().toISOString();
    this.notify();

    if (isFirebaseConfigured) {
      await db.updateTask(taskId, { status: 'In Review', updatedAt: new Date().toISOString() });
    }

    const reviewerId = task.reviewerId || this.users.find((u) => u.role === 'super_admin')?.id || this.getCurrentUser().id;
    await this.notifyUser(reviewerId, 'review_requested', 'Revue Demandée', `${this.getCurrentUser().firstName} a soumis « ${task.title} » pour revue.`, `/tasks/${task.id}`);
    await this.logAudit('Soumis pour Revue', 'task', taskId, task.title, 'En attente de validation');
  }

  async approveTask(taskId: string, validationComment?: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    const proj = this.projects.find((p) => p.id === task.projectId);
    if (!canApproveTask(user, proj)) {
      throw new Error('Vous n\'avez pas l\'autorisation d\'approuver cette tâche.');
    }
    const now = new Date().toISOString();

    const updates: Partial<Task> = {
      status: 'Completed',
      completedAt: now,
      validatedAt: now,
      validatedBy: this.getCurrentUser().id,
      validationComment
    };

    this.tasks = this.tasks.map((t) => t.id === taskId ? { ...t, ...updates } : t);
    this.recalculateProjectProgress(task.projectId);
    this.notify();

    if (isFirebaseConfigured) {
      await db.updateTask(taskId, updates);
    }

    for (const uid of task.assigneeIds) {
      await this.notifyUser(uid, 'task_approved', 'Tâche Approuvée !', `Votre tâche « ${task.title} » a été approuvée par ${this.getCurrentUser().firstName}.`, `/tasks/${task.id}`);
    }
    await this.logAudit('Tâche Approuvée', 'task', taskId, task.title, validationComment || 'Marquée terminée');
  }

  async rejectTask(taskId: string, feedback: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    const proj = this.projects.find((p) => p.id === task.projectId);
    if (!canApproveTask(user, proj)) {
      throw new Error('Vous n\'avez pas l\'autorisation de rejeter cette tâche.');
    }

    const updates: Partial<Task> = {
      status: 'In Progress',
      validationComment: `Modifications demandées: ${feedback}`,
      updatedAt: new Date().toISOString()
    };

    this.tasks = this.tasks.map((t) => t.id === taskId ? { ...t, ...updates } : t);
    this.notify();

    if (isFirebaseConfigured) {
      await db.updateTask(taskId, updates);
    }

    for (const uid of task.assigneeIds) {
      await this.notifyUser(uid, 'task_rejected', 'Modifications Demandées', `${this.getCurrentUser().firstName} a demandé des modifications sur « ${task.title} »: ${feedback}`, `/tasks/${task.id}`);
    }
    await this.logAudit('Modifications Demandées', 'task', taskId, task.title, `Retour en cours. Feedback: ${feedback}`);
  }

  async toggleSubtask(taskId: string, subtaskId: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    const proj = this.projects.find((p) => p.id === task.projectId);
    if (!canEditTask(user, task.assigneeIds, proj)) {
      throw new Error('Vous n\'avez pas l\'autorisation de modifier cette tâche.');
    }
    const sub = task.subtasks.find((s) => s.id === subtaskId);
    if (!sub) return;

    const updatedSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );

    this.tasks = this.tasks.map((t) => t.id === taskId ? { ...t, subtasks: updatedSubtasks, updatedAt: new Date().toISOString() } : t);
    this.notify();

    if (isFirebaseConfigured) {
      await db.updateTask(taskId, { subtasks: updatedSubtasks, updatedAt: new Date().toISOString() });
    }
  }

  async addSubtask(taskId: string, title: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const user = this.getCurrentUser();
    const proj = this.projects.find((p) => p.id === task.projectId);
    if (!canEditTask(user, task.assigneeIds, proj)) {
      throw new Error('Vous n\'avez pas l\'autorisation de modifier cette tâche.');
    }
    const newSub: Subtask = { id: `sub-${Date.now()}`, title, completed: false };
    const updatedSubtasks = [...task.subtasks, newSub];

    this.tasks = this.tasks.map((t) => t.id === taskId ? { ...t, subtasks: updatedSubtasks, updatedAt: new Date().toISOString() } : t);
    this.notify();

    if (isFirebaseConfigured) {
      await db.updateTask(taskId, { subtasks: updatedSubtasks, updatedAt: new Date().toISOString() });
    }
  }

  async editSubtask(taskId: string, subtaskId: string, title: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const user = this.getCurrentUser();
    const proj = this.projects.find((p) => p.id === task.projectId);
    if (!canEditTask(user, task.assigneeIds, proj)) {
      throw new Error('Vous n\'avez pas l\'autorisation de modifier cette tâche.');
    }
    const updatedSubtasks = task.subtasks.map((s) => s.id === subtaskId ? { ...s, title: title.trim() } : s);
    this.tasks = this.tasks.map((t) => t.id === taskId ? { ...t, subtasks: updatedSubtasks, updatedAt: new Date().toISOString() } : t);
    this.notify();

    if (isFirebaseConfigured) {
      await db.updateTask(taskId, { subtasks: updatedSubtasks, updatedAt: new Date().toISOString() });
    }
  }

  async deleteSubtask(taskId: string, subtaskId: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const user = this.getCurrentUser();
    const proj = this.projects.find((p) => p.id === task.projectId);
    if (!canEditTask(user, task.assigneeIds, proj)) {
      throw new Error('Vous n\'avez pas l\'autorisation de modifier cette tâche.');
    }
    const updatedSubtasks = task.subtasks.filter((s) => s.id !== subtaskId);
    this.tasks = this.tasks.map((t) => t.id === taskId ? { ...t, subtasks: updatedSubtasks, updatedAt: new Date().toISOString() } : t);
    this.notify();

    if (isFirebaseConfigured) {
      await db.updateTask(taskId, { subtasks: updatedSubtasks, updatedAt: new Date().toISOString() });
    }
  }

  // ---------- Comments ----------

  async addComment(taskId: string, content: string) {
    const user = this.getCurrentUser();
    const comment: Omit<Comment, 'id' | 'createdAt'> = {
      taskId,
      authorId: user.id,
      content
    };

    let newComment: Comment;
    if (isFirebaseConfigured) {
      newComment = await db.addCommentDb(comment);
      // onSnapshot mettra à jour this.comments avec la vraie source de vérité
    } else {
      newComment = { ...comment, id: `comm-${Date.now()}`, createdAt: new Date().toISOString() };
      this.comments = { ...this.comments, [taskId]: [...(this.comments[taskId] || []), newComment] };
      this.notify();
    }

    const task = this.tasks.find((t) => t.id === taskId);
    if (task) {
      for (const uid of task.assigneeIds) {
        if (uid !== user.id) {
          await this.notifyUser(uid, 'mention', 'Nouveau Commentaire', `${user.firstName} a commenté « ${task.title} »: ${content.substring(0, 50)}...`);
        }
      }
    }
  }

  async editComment(commentId: string, taskId: string, content: string) {
    const user = this.getCurrentUser();
    const list = this.comments[taskId] || [];
    const idx = list.findIndex((c) => c.id === commentId);
    if (idx === -1) return;
    if (list[idx].authorId !== user.id && !isAdmin(user)) {
      throw new Error('Vous ne pouvez modifier que vos propres commentaires.');
    }
    const newList = list.map((c) => c.id === commentId ? { ...c, content: content.trim() } : c);
    this.comments = { ...this.comments, [taskId]: newList };
    this.notify();

    if (isFirebaseConfigured) {
      await db.updateCommentDb(commentId, { content: content.trim() });
    }
  }

  async deleteComment(commentId: string, taskId: string) {
    const user = this.getCurrentUser();
    const list = this.comments[taskId] || [];
    const comment = list.find((c) => c.id === commentId);
    if (!comment) return;
    if (comment.authorId !== user.id && !isAdmin(user)) {
      throw new Error('Vous ne pouvez supprimer que vos propres commentaires.');
    }
    this.comments = { ...this.comments, [taskId]: list.filter((c) => c.id !== commentId) };
    this.notify();

    if (isFirebaseConfigured) {
      await db.deleteComment(commentId);
    }
  }

  // ---------- Team Operations ----------

  async createTeam(teamData: Omit<Team, 'id' | 'organizationId' | 'createdAt'>): Promise<Team> {
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    if (!canCreateTeam(user)) {
      throw new Error('Vous n\'avez pas l\'autorisation de créer une équipe.');
    }
    const orgId = this.getOrganization().id;

    if (isFirebaseConfigured) {
      const newTeam = await db.createTeam(teamData, orgId);
      // Update each member's teamIds
      for (const memberId of teamData.memberIds) {
        const u = this.users.find((x) => x.id === memberId);
        if (u) {
          const newTeamIds = [...new Set([...(u.teamIds || []), newTeam.id])];
          await db.updateUser(memberId, { teamIds: newTeamIds });
        }
      }
      await this.logAudit('Équipe Créée', 'team', newTeam.id, newTeam.name, `Membres: ${teamData.memberIds.length}`);
      return newTeam;
    }

    const newTeam: Team = {
      ...teamData,
      id: `team-${Date.now()}`,
      organizationId: orgId,
      createdAt: new Date().toISOString()
    };
    this.teams = [newTeam, ...this.teams];
    // Update local users
    teamData.memberIds.forEach((memberId) => {
      const uIdx = this.users.findIndex((u) => u.id === memberId);
      if (uIdx !== -1) {
        this.users[uIdx].teamIds = [...new Set([...(this.users[uIdx].teamIds || []), newTeam.id])];
      }
    });
    await this.logAudit('Équipe Créée', 'team', newTeam.id, newTeam.name, `Membres: ${teamData.memberIds.length}`);
    this.notify();
    return newTeam;
  }

  async updateTeam(teamId: string, updates: Partial<Team>) {
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    const team = this.teams.find((t) => t.id === teamId);
    if (!canEditTeam(user, team)) {
      throw new Error('Vous n\'avez pas l\'autorisation de modifier cette équipe.');
    }
    if (isFirebaseConfigured) {
      await db.updateTeam(teamId, updates);
      const team = this.teams.find((t) => t.id === teamId);
      if (team) await this.logAudit('Équipe Modifiée', 'team', teamId, team.name, 'Champs mis à jour');
      return;
    }
    const idx = this.teams.findIndex((t) => t.id === teamId);
    if (idx === -1) return;
    this.teams[idx] = { ...this.teams[idx], ...updates };
    await this.logAudit('Équipe Modifiée', 'team', teamId, this.teams[idx].name, 'Champs mis à jour');
    this.notify();
  }

  async deleteTeam(teamId: string) {
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    if (!canDeleteTeam(user)) {
      throw new Error('Vous n\'avez pas l\'autorisation de supprimer cette équipe.');
    }
    const team = this.teams.find((t) => t.id === teamId);
    if (isFirebaseConfigured) {
      // Remove teamId from all members
      for (const memberId of team?.memberIds || []) {
        const u = this.users.find((x) => x.id === memberId);
        if (u) {
          const newTeamIds = (u.teamIds || []).filter((id) => id !== teamId);
          await db.updateUser(memberId, { teamIds: newTeamIds });
        }
      }
      await db.deleteTeam(teamId);
      await this.logAudit('Équipe Supprimée', 'team', teamId, team?.name || teamId);
      return;
    }
    // Remove teamId from local users
    team?.memberIds.forEach((memberId) => {
      const uIdx = this.users.findIndex((u) => u.id === memberId);
      if (uIdx !== -1) {
        this.users[uIdx].teamIds = (this.users[uIdx].teamIds || []).filter((id) => id !== teamId);
      }
    });
    this.teams = this.teams.filter((t) => t.id !== teamId);
    await this.logAudit('Équipe Supprimée', 'team', teamId, team?.name || teamId);
    this.notify();
  }

  async addTeamMember(teamId: string, userId: string) {
    // SÉCURITÉ : Vérifier l'autorisation
    const currentUser = this.getCurrentUser();
    const team = this.teams.find((t) => t.id === teamId);
    if (!team) return;
    if (!canManageTeamMembers(currentUser, team)) {
      throw new Error('Vous n\'avez pas l\'autorisation de gérer les membres de cette équipe.');
    }
    if (team.memberIds.includes(userId)) return;
    const newMemberIds = [...team.memberIds, userId];

    if (isFirebaseConfigured) {
      await db.updateTeam(teamId, { memberIds: newMemberIds });
      const u = this.users.find((x) => x.id === userId);
      if (u) {
        const newTeamIds = [...new Set([...(u.teamIds || []), teamId])];
        await db.updateUser(userId, { teamIds: newTeamIds });
      }
      await this.logAudit('Membre Ajouté', 'team', teamId, team.name, `Membre: ${userId}`);
      return;
    }
    team.memberIds = newMemberIds;
    const uIdx = this.users.findIndex((u) => u.id === userId);
    if (uIdx !== -1) {
      this.users[uIdx].teamIds = [...new Set([...(this.users[uIdx].teamIds || []), teamId])];
    }
    await this.logAudit('Membre Ajouté', 'team', teamId, team.name, `Membre: ${userId}`);
    this.notify();
  }

  async removeTeamMember(teamId: string, userId: string) {
    // SÉCURITÉ : Vérifier l'autorisation
    const currentUser = this.getCurrentUser();
    const team = this.teams.find((t) => t.id === teamId);
    if (!team) return;
    if (!canManageTeamMembers(currentUser, team)) {
      throw new Error('Vous n\'avez pas l\'autorisation de gérer les membres de cette équipe.');
    }
    const newMemberIds = team.memberIds.filter((id) => id !== userId);

    if (isFirebaseConfigured) {
      await db.updateTeam(teamId, { memberIds: newMemberIds });
      const u = this.users.find((x) => x.id === userId);
      if (u) {
        const newTeamIds = (u.teamIds || []).filter((id) => id !== teamId);
        await db.updateUser(userId, { teamIds: newTeamIds });
      }
      await this.logAudit('Membre Retiré', 'team', teamId, team.name, `Membre: ${userId}`);
      return;
    }
    team.memberIds = newMemberIds;
    const uIdx = this.users.findIndex((u) => u.id === userId);
    if (uIdx !== -1) {
      this.users[uIdx].teamIds = (this.users[uIdx].teamIds || []).filter((id) => id !== teamId);
    }
    await this.logAudit('Membre Retiré', 'team', teamId, team.name, `Membre: ${userId}`);
    this.notify();
  }

  // SÉCURITÉ : Whitelist des champs qu'un user peut modifier sur son propre profil
  // JAMAIS : role, organizationId, teamIds, email, createdAt
  private static readonly ALLOWED_PROFILE_FIELDS: ReadonlySet<string> = new Set([
    'firstName',
    'lastName',
    'avatar',
    'jobTitle'
  ]);

  async updateCurrentUserProfile(updates: Partial<User>) {
    // SÉCURITÉ : Filtrer les champs sensibles pour empêcher l'auto-promotion
    const user = this.getCurrentUser();
    const filteredUpdates: Partial<User> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (AppStore.ALLOWED_PROFILE_FIELDS.has(key)) {
        (filteredUpdates as any)[key] = value;
      }
      // Les champs sensibles (role, organizationId, teamIds, email) sont IGNORÉS
    }

    if (isFirebaseConfigured) {
      await db.updateUser(user.id, filteredUpdates);
    }
    // Update the users array so all components see the change
    const idx = this.users.findIndex((u) => u.id === user.id);
    if (idx !== -1) {
      this.users[idx] = { ...this.users[idx], ...filteredUpdates };
    }
    this.currentUser = { ...user, ...filteredUpdates };
    // Sync back to AuthContext so useAuth().currentUser updates too
    if (this.onProfileUpdate) this.onProfileUpdate(filteredUpdates);
    this.notify();
  }

  async uploadAvatar(file: File): Promise<string> {
    const user = this.getCurrentUser();
    if (isFirebaseConfigured) {
      const url = await db.uploadAvatar(user.id, file);
      await this.updateCurrentUserProfile({ avatar: url });
      return url;
    }
    // Local fallback: use data URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        this.updateCurrentUserProfile({ avatar: dataUrl });
        resolve(dataUrl);
      };
      reader.readAsDataURL(file);
    });
  }

  // ---------- Project Operations ----------

  recalculateProjectProgress(projectId: string) {
    if (isFirebaseConfigured) {
      // In Firestore mode, compute and update asynchronously
      this.recalculateProjectProgressAsync(projectId);
      return;
    }
    this.recalculateProjectProgressLocal(projectId);
  }

  private async recalculateProjectProgressAsync(projectId: string) {
    const projIdx = this.projects.findIndex((p) => p.id === projectId);
    if (projIdx === -1) return;
    const projTasks = this.tasks.filter((t) => t.projectId === projectId);
    if (projTasks.length === 0) {
      await db.updateProject(projectId, { weightedProgress: 0, health: 'on_track' });
      return;
    }

    let totalWeight = 0, completedWeight = 0, overdueCount = 0, blockedCount = 0;
    const nowStr = new Date().toISOString().split('T')[0];
    projTasks.forEach((t) => {
      const w = t.weight || 1;
      totalWeight += w;
      if (t.status === 'Completed') completedWeight += w;
      if (t.status === 'Blocked') blockedCount += 1;
      if (t.status !== 'Completed' && t.dueDate < nowStr) overdueCount += 1;
    });

    const progress = Math.round((completedWeight / totalWeight) * 100);
    let health: Project['health'] = 'on_track';
    if (blockedCount > 0 || overdueCount >= 2) health = 'delayed';
    else if (overdueCount === 1 || progress < 40) health = 'at_risk';

    await db.updateProject(projectId, { weightedProgress: progress, health });
  }

  private recalculateProjectProgressLocal(projectId: string) {
    const projIdx = this.projects.findIndex((p) => p.id === projectId);
    if (projIdx === -1) return;
    const projTasks = this.tasks.filter((t) => t.projectId === projectId);

    let totalWeight = 0, completedWeight = 0, overdueCount = 0, blockedCount = 0;
    const nowStr = new Date().toISOString().split('T')[0];
    projTasks.forEach((t) => {
      const w = t.weight || 1;
      totalWeight += w;
      if (t.status === 'Completed') completedWeight += w;
      if (t.status === 'Blocked') blockedCount += 1;
      if (t.status !== 'Completed' && t.dueDate < nowStr) overdueCount += 1;
    });

    const progress = projTasks.length === 0 ? 0 : Math.round((completedWeight / totalWeight) * 100);
    let health: Project['health'] = 'on_track';
    if (blockedCount > 0 || overdueCount >= 2) health = 'delayed';
    else if (overdueCount === 1 || progress < 40) health = 'at_risk';

    this.projects = this.projects.map((p) =>
      p.id === projectId ? { ...p, weightedProgress: progress, health } : p
    );
  }

  async createProject(projData: Omit<Project, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'weightedProgress'>): Promise<Project> {
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    if (!canCreateProject(user)) {
      throw new Error('Vous n\'avez pas l\'autorisation de créer un projet.');
    }
    const orgId = this.getOrganization().id;

    if (isFirebaseConfigured) {
      const newProj = await db.createProject(projData, orgId);
      // Laisse onSnapshot mettre à jour this.projects pour éviter les doublons
      await this.logAudit('Projet Créé', 'project', newProj.id, newProj.name, `Santé: ${newProj.health}`);
      return newProj;
    }

    const newProj: Project = {
      ...projData,
      id: `proj-${Date.now()}`,
      organizationId: orgId,
      weightedProgress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.projects = [newProj, ...this.projects];
    await this.logAudit('Projet Créé', 'project', newProj.id, newProj.name, `Santé: ${newProj.health}`);
    this.notify();
    return newProj;
  }

  async updateProject(projectId: string, updates: Partial<Project>) {
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    const proj = this.projects.find((p) => p.id === projectId);
    if (!canEditProject(user, proj)) {
      throw new Error('Vous n\'avez pas l\'autorisation de modifier ce projet.');
    }
    const previousMembers = this.projects.find((p) => p.id === projectId)?.members || [];
    this.projects = this.projects.map((p) =>
      p.id === projectId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    );
    this.notify();

    const newMemberIds = (updates.members || [])
      .map((m) => m.userId)
      .filter((uid) => !previousMembers.some((m) => m.userId === uid));

    for (const uid of newMemberIds) {
      if (uid !== this.getCurrentUser().id) {
        await this.notifyUser(uid, 'new_member', 'Ajouté à un projet', `${this.getCurrentUser().firstName} vous a ajouté au projet « ${proj?.name || projectId} ».`, `/projects/${projectId}`);
      }
    }

    if (isFirebaseConfigured) {
      await db.updateProject(projectId, updates);
      if (proj) await this.logAudit('Projet Modifié', 'project', projectId, proj.name, 'Champs mis à jour');
    }
  }

  async deleteProject(projectId: string) {
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    if (!canDeleteProject(user)) {
      throw new Error('Vous n\'avez pas l\'autorisation de supprimer ce projet.');
    }
    const proj = this.projects.find((p) => p.id === projectId);
    this.projects = this.projects.filter((p) => p.id !== projectId);
    this.tasks = this.tasks.filter((t) => t.projectId !== projectId);
    this.notify();

    if (isFirebaseConfigured) {
      await db.deleteProject(projectId);
      await this.logAudit('Projet Supprimé', 'project', projectId, proj?.name || projectId);
      return;
    }
    this.tasks = this.tasks.filter((t) => t.projectId !== projectId);
    await this.logAudit('Projet Supprimé', 'project', projectId, proj?.name || projectId);
    this.notify();
  }

  async deleteTask(taskId: string) {
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    const task = this.tasks.find((t) => t.id === taskId);
    const proj = task ? this.projects.find((p) => p.id === task.projectId) : undefined;
    if (!canDeleteTask(user, proj)) {
      throw new Error('Vous n\'avez pas l\'autorisation de supprimer cette tâche.');
    }
    this.tasks = this.tasks.filter((t) => t.id !== taskId);
    if (task) this.recalculateProjectProgress(task.projectId);
    this.notify();

    if (isFirebaseConfigured) {
      await db.deleteTask(taskId);
      await this.logAudit('Tâche Supprimée', 'task', taskId, task?.title || taskId);
      return;
    }
    if (task) this.recalculateProjectProgress(task.projectId);
    await this.logAudit('Tâche Supprimée', 'task', taskId, task?.title || taskId);
    this.notify();
  }

  async deleteObjective(objId: string) {
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    if (!canDeleteObjective(user)) {
      throw new Error('Vous n\'avez pas l\'autorisation de supprimer cet objectif.');
    }
    const obj = this.objectives.find((o) => o.id === objId);
    if (isFirebaseConfigured) {
      await db.deleteObjective(objId);
      await this.logAudit('Objectif Supprimé', 'objective', objId, obj?.title || objId);
      return;
    }
    this.objectives = this.objectives.filter((o) => o.id !== objId);
    await this.logAudit('Objectif Supprimé', 'objective', objId, obj?.title || objId);
    this.notify();
  }

  // ---------- Objectives / OKRs ----------

  async createObjective(objData: Omit<Objective, 'id' | 'organizationId' | 'createdAt'>): Promise<Objective> {
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    if (!canCreateObjective(user)) {
      throw new Error('Vous n\'avez pas l\'autorisation de créer un objectif.');
    }
    const orgId = this.getOrganization().id;

    if (isFirebaseConfigured) {
      const newObj = await db.createObjective(objData, orgId);
      await this.logAudit('Objectif Créé', 'objective', newObj.id, newObj.title, `Cible: ${newObj.targetValue} ${newObj.unit}`);
      return newObj;
    }

    const newObj: Objective = {
      ...objData,
      id: `obj-${Date.now()}`,
      organizationId: orgId,
      createdAt: new Date().toISOString()
    };
    this.objectives = [newObj, ...this.objectives];
    await this.logAudit('Objectif Créé', 'objective', newObj.id, newObj.title, `Cible: ${newObj.targetValue} ${newObj.unit}`);
    this.notify();
    return newObj;
  }

  async updateObjectiveProgress(objId: string, newValue: number) {
    const obj = this.objectives.find((o) => o.id === objId);
    if (!obj) return;

    let status: Objective['status'] = 'on_track';
    if (newValue >= obj.targetValue) status = 'completed';
    else if (newValue / obj.targetValue < 0.5) status = 'behind';

    if (isFirebaseConfigured) {
      await db.updateObjective(objId, { currentValue: newValue, status });
    } else {
      obj.currentValue = newValue;
      obj.status = status;
    }

    await this.logAudit('Progression OKR', 'objective', objId, obj.title, `Nouvelle valeur: ${newValue} / ${obj.targetValue}`);
    this.notify();
  }

  // ---------- Daily Reports ----------
  private getAttendanceRecordWorkMinutes(r: AttendanceRecord): number {
    if (r.status === 'completed') return r.totalWorkMinutes || 0;
    if (!r.startTime) return 0;
    const [sh, sm] = r.startTime.split(':').map(Number);
    const start = new Date();
    start.setHours(sh, sm, 0, 0);
    let elapsed = (Date.now() - start.getTime()) / 60000;
    if (elapsed < 0) elapsed += 24 * 60;
    let breakMins = r.totalBreakMinutes || 0;
    if (r.status === 'on_break' && r.breakStartTime) {
      breakMins += (Date.now() - new Date(r.breakStartTime).getTime()) / 60000;
    }
    return Math.max(0, Math.round(elapsed - breakMins));
  }

  async generateDailyReport(teamId?: string): Promise<DailyReport> {
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    if (!canGenerateOrgReport(user)) {
      throw new Error('Vous n\'avez pas l\'autorisation de générer un rapport.');
    }
    const orgId = this.getOrganization().id;
    const today = new Date().toISOString().split('T')[0];
    const nowStr = today;
    const teamTasks = teamId ? this.tasks.filter((t) => t.teamId === teamId) : this.tasks;
    const todayAttendance = this.attendanceRecords.filter((r) => r.date === today);

    // BUG FIX: compute real attendance instead of hardcoded values
    const expected = this.users.length;
    const present = todayAttendance.filter((r) => r.status !== 'absent' && r.status !== 'completed' || r.endTime).length;
    const absent = expected - todayAttendance.filter((r) => r.date === today).length;

    const blockers = teamTasks
      .filter((t) => t.status === 'Blocked')
      .map((t) => {
        const assignee = this.users.find((u) => t.assigneeIds.includes(u.id));
        return {
          taskTitle: t.title,
          assigneeName: assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Non assigné',
          reason: t.blockerReason || 'En attente de dépendances'
        };
      });

    const projectProgress = this.projects.map((p) => ({
      projectName: p.name,
      progress: p.weightedProgress,
      health: p.health
    }));

    // BUG FIX: derive priorities from actual overdue/blocked tasks instead of hardcoded list
    const overdueTasks = teamTasks
      .filter((t) => t.status !== 'Completed' && t.dueDate < nowStr)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 3);
    const prioritiesTomorrow = overdueTasks.length > 0
      ? overdueTasks.map((t) => `Finaliser: ${t.title}`)
      : ['Aucune priorité urgente identifiée'];

    const completedToday = teamTasks
      .filter((t) => t.status === 'Completed')
      .map((t) => {
        const p = this.projects.find((pr) => pr.id === t.projectId);
        return { title: t.title, projectName: p?.name || 'Sans projet' };
      });

    const inProgressToday = teamTasks
      .filter((t) => t.status === 'In Progress')
      .map((t) => {
        const p = this.projects.find((pr) => pr.id === t.projectId);
        const assignee = this.users.find((u) => t.assigneeIds.includes(u.id));
        return {
          title: t.title,
          projectName: p?.name || 'Sans projet',
          assigneeName: assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Non assigné'
        };
      });

    const attendanceDetails = todayAttendance.map((r) => {
      const u = this.users.find((usr) => usr.id === r.userId);
      return {
        name: u ? `${u.firstName} ${u.lastName}` : 'Inconnu',
        status: r.status,
        workMinutes: this.getAttendanceRecordWorkMinutes(r)
      };
    });

    const workDaySummaries = this.workDayReports
      .filter((r) => r.date === today && r.status === 'submitted')
      .map((r) => {
        const u = this.users.find((usr) => usr.id === r.userId);
        return {
          name: u ? `${u.firstName} ${u.lastName}` : 'Inconnu',
          summary: r.summary
        };
      });

    const report: Omit<DailyReport, 'id'> = {
      organizationId: orgId,
      teamId,
      date: today,
      generatedBy: `${this.getCurrentUser().firstName} ${this.getCurrentUser().lastName}`,
      attendanceSummary: { expected, present: Math.min(present, expected), absent: Math.max(0, absent) },
      tasksSummary: {
        completed: teamTasks.filter((t) => t.status === 'Completed').length,
        inProgress: teamTasks.filter((t) => t.status === 'In Progress').length,
        blocked: teamTasks.filter((t) => t.status === 'Blocked').length,
        inReview: teamTasks.filter((t) => t.status === 'In Review').length,
        overdue: teamTasks.filter((t) => t.status !== 'Completed' && t.dueDate < nowStr).length
      },
      blockers,
      projectProgress,
      prioritiesTomorrow,
      completedToday,
      inProgressToday,
      attendanceDetails,
      workDaySummaries,
      recipients: this.getOrganization().reportEmailRecipients,
      status: 'draft'
    };

    if (isFirebaseConfigured) {
      const saved = await db.createReportDb(report);
      await this.logAudit('Rapport Généré', 'report', saved.id, `Rapport du ${today}`);
      return saved;
    }

    const entry: DailyReport = { ...report, id: `rep-${Date.now()}` };
    this.reports = [entry, ...this.reports];
    await this.logAudit('Rapport Généré', 'report', entry.id, `Rapport du ${today}`);
    this.notify();
    return entry;
  }

  async deleteReport(reportId: string) {
    const user = this.getCurrentUser();
    if (!canGenerateOrgReport(user)) {
      throw new Error('Vous n\'avez pas l\'autorisation de supprimer un rapport.');
    }
    this.reports = this.reports.filter((r) => r.id !== reportId);
    if (isFirebaseConfigured) {
      await db.deleteReport(reportId);
    }
    await this.logAudit('Rapport Supprimé', 'report', reportId, `Rapport supprimé`);
    this.notify();
  }

  async sendReportEmail(reportId: string) {
    // SÉCURITÉ : Vérifier l'autorisation
    const user = this.getCurrentUser();
    if (!canGenerateOrgReport(user)) {
      throw new Error('Vous n\'avez pas l\'autorisation d\'envoyer un rapport.');
    }
    const rep = this.reports.find((r) => r.id === reportId);
    if (!rep) return;

    // Call backend to dispatch email
    try {
      // SÉCURITÉ : Envoyer le token Firebase pour l'authentification serveur
      const { auth } = await import('./firebase');
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const response = await fetch('/api/reports/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          reportId: rep.id,
          recipients: rep.recipients,
          reportData: {
            date: rep.date,
            generatedBy: rep.generatedBy,
            attendanceSummary: rep.attendanceSummary,
            tasksSummary: rep.tasksSummary,
            blockers: rep.blockers,
            prioritiesTomorrow: rep.prioritiesTomorrow
          }
        })
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Échec de l\'envoi du rapport.');
      }
      if (data.simulated) {
        console.warn('[Reports] Envoi simulé :', data.message);
      }
    } catch (e: any) {
      console.error('[Reports] Erreur envoi e-mail:', e);
      throw new Error(e.message || 'Échec de l\'envoi du rapport.');
    }

    const updates: Partial<DailyReport> = { status: 'sent', sentAt: new Date().toISOString() };
    if (isFirebaseConfigured) {
      await db.updateReport(reportId, updates);
    }
    this.reports = this.reports.map((r) => r.id === reportId ? { ...r, ...updates } : r);

    await this.logAudit('Rapport Envoyé', 'report', reportId, `Rapport du ${rep.date}`, `Destinataires: ${rep.recipients.join(', ')}`);
    this.notify();
  }

  // ---------- Notifications ----------

  async markNotificationRead(id: string) {
    if (isFirebaseConfigured) {
      await db.markNotificationRead(id, true);
      return;
    }
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) { notif.read = true; this.notify(); }
  }

  async markAllNotificationsRead() {
    const uid = this.getCurrentUser().id;
    const unread = this.notifications.filter((n) => n.userId === uid && !n.read);
    if (isFirebaseConfigured) {
      await Promise.all(unread.map((n) => db.markNotificationRead(n.id, true)));
      return;
    }
    this.notifications.forEach((n) => { if (n.userId === uid) n.read = true; });
    this.notify();
  }

  async deleteNotification(id: string) {
    if (isFirebaseConfigured) {
      await db.deleteNotification(id);
    }
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.notify();
  }
}

export const store = new AppStore();
