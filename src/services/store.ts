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
  Subtask
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
  private objectives: Objective[] = [];
  private attendanceRecords: AttendanceRecord[] = [];
  private notifications: Notification[] = [];
  private auditLogs: AuditLog[] = [];
  private reports: DailyReport[] = [];
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

    this.subs.push(db.subscribeUsers(orgId, (items) => { this.users = items; this.notifyListeners(); }));
    this.subs.push(db.subscribeTeams(orgId, (items) => { this.teams = items; this.notifyListeners(); }));
    
    // Projects: filter by user membership unless super_admin
    this.subs.push(db.subscribeProjects(orgId, (items) => {
      if (isSuperAdmin) {
        this.projects = items;
      } else {
        this.projects = items.filter(p => 
          p.ownerId === currentUser.id || 
          p.members.some(m => m.userId === currentUser.id)
        );
      }
      this.notifyListeners();
    }));
    
    // Tasks: filter by project membership
    this.subs.push(db.subscribeTasks(orgId, (items) => {
      if (isSuperAdmin) {
        this.tasks = items;
      } else {
        const projectIds = this.projects.map(p => p.id);
        this.tasks = items.filter(t => projectIds.includes(t.projectId));
      }
      this.notifyListeners();
    }));
    
    this.subs.push(db.subscribeObjectives(orgId, (items) => { this.objectives = items; this.notifyListeners(); }));
    this.subs.push(db.subscribeAttendance(orgId, (items) => { this.attendanceRecords = items; this.notifyListeners(); }));
    this.subs.push(db.subscribeNotifications(currentUser.id, (items) => { this.notifications = items; this.notifyListeners(); }));
    this.subs.push(db.subscribeReports(orgId, (items) => { this.reports = items; this.notifyListeners(); }));
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
      try { await db.createNotification(notif); } catch (e) { console.error('[Notif] Erreur Firestore:', e); }
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

    let record = this.attendanceRecords.find((r) => r.userId === user.id && r.date === today);

    if (!record) {
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
    } else {
      record.status = 'working';
      if (summary) record.summary = summary;
    }

    if (isFirebaseConfigured) {
      await db.upsertAttendance(record);
      await db.updateUserPresence(user.id, 'online');
    } else {
      this.attendanceRecords = [record, ...this.attendanceRecords.filter((r) => r.id !== record!.id)];
      this.currentUser!.presenceStatus = 'online';
      const uIdx = this.users.findIndex((u) => u.id === user.id);
      if (uIdx !== -1) this.users[uIdx].presenceStatus = 'online';
    }

    await this.logAudit('Démarrage Journée', 'attendance', record.id, 'Pointage Entrée', `Pointé à ${nowHHMM}`);
    this.notify();
  }

  async toggleBreak() {
    const user = this.getCurrentUser();
    const today = new Date().toISOString().split('T')[0];
    const record = this.attendanceRecords.find((r) => r.userId === user.id && r.date === today);
    if (!record) return;

    if (record.status === 'working') {
      record.status = 'on_break';
      record.breakStartTime = new Date().toISOString();
      if (isFirebaseConfigured) await db.updateUserPresence(user.id, 'away');
      else this.currentUser!.presenceStatus = 'away';
      await this.logAudit('Début Pause', 'attendance', record.id, 'Pause');
    } else if (record.status === 'on_break') {
      record.status = 'working';
      if (record.breakStartTime) {
        const breakMins = Math.round((Date.now() - new Date(record.breakStartTime).getTime()) / 60000);
        record.totalBreakMinutes += Math.max(1, breakMins);
        record.breakStartTime = undefined;
      }
      if (isFirebaseConfigured) await db.updateUserPresence(user.id, 'online');
      else this.currentUser!.presenceStatus = 'online';
      await this.logAudit('Fin Pause', 'attendance', record.id, 'Reprise');
    }

    if (isFirebaseConfigured) {
      await db.upsertAttendance(record);
    } else {
      const uIdx = this.users.findIndex((u) => u.id === user.id);
      if (uIdx !== -1) this.users[uIdx].presenceStatus = this.currentUser!.presenceStatus;
    }
    this.notify();
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

      // BUG FIX: calculate actual work duration from startTime instead of hardcoding 420 minutes
      if (record.startTime) {
        const [sh, sm] = record.startTime.split(':').map(Number);
        const startMinutes = sh * 60 + sm;
        const [eh, em] = nowHHMM.split(':').map(Number);
        const endMinutes = eh * 60 + em;
        const totalElapsed = Math.max(0, endMinutes - startMinutes);
        record.totalWorkMinutes = Math.max(0, totalElapsed - record.totalBreakMinutes);
      }
    }

    if (isFirebaseConfigured) {
      if (record) await db.upsertAttendance(record);
      await db.updateUserPresence(user.id, 'offline');
    } else {
      this.currentUser!.presenceStatus = 'offline';
      const uIdx = this.users.findIndex((u) => u.id === user.id);
      if (uIdx !== -1) this.users[uIdx].presenceStatus = 'offline';
    }

    await this.logAudit('Fin Journée', 'attendance', record?.id || 'att-end', 'Pointage Sortie', `Pointé à ${nowHHMM}`);
    this.notify();
  }

  // ---------- Task Operations ----------

  async createTask(taskData: Omit<Task, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const orgId = this.getOrganization().id;

    if (isFirebaseConfigured) {
      const newTask = await db.createTask(taskData, orgId);
      await this.notifyAssignees(newTask, 'task_assigned', 'Assignation de Tâche', `${this.getCurrentUser().firstName} vous a assigné la tâche « ${newTask.title} ».`, `/tasks/${newTask.id}`);
      await this.logAudit('Tâche Créée', 'task', newTask.id, newTask.title, `Statut: ${newTask.status}, Priorité: ${newTask.priority}`);
      return newTask;
    }

    // Local mode
    const newTask: Task = {
      ...taskData,
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
    if (isFirebaseConfigured) {
      await db.updateTask(taskId, updates);
      const task = this.tasks.find((t) => t.id === taskId);
      if (task) await this.logAudit('Tâche Modifiée', 'task', taskId, task.title, 'Champs mis à jour');
      return;
    }
    const idx = this.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) return;
    this.tasks[idx] = { ...this.tasks[idx], ...updates, updatedAt: new Date().toISOString() };
    this.recalculateProjectProgress(this.tasks[idx].projectId);
    await this.logAudit('Tâche Modifiée', 'task', taskId, this.tasks[idx].title, 'Champs mis à jour');
    this.notify();
  }

  async updateTaskStatus(taskId: string, newStatus: TaskStatus, blockerReason?: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const oldStatus = task.status;

    const updates: Partial<Task> = { status: newStatus, updatedAt: new Date().toISOString() };
    if (newStatus === 'Blocked' && blockerReason) updates.blockerReason = blockerReason;
    else if (newStatus !== 'Blocked') updates.blockerReason = undefined;
    if (newStatus === 'Completed') updates.completedAt = new Date().toISOString();

    if (isFirebaseConfigured) {
      await db.updateTask(taskId, updates);
    } else {
      Object.assign(task, updates);
      this.recalculateProjectProgress(task.projectId);
    }

    await this.logAudit('Changement de Statut', 'task', taskId, task.title, `De « ${oldStatus} » à « ${newStatus} »${blockerReason ? ` (Raison: ${blockerReason})` : ''}`);
    this.notify();
  }

  async submitTaskForReview(taskId: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (isFirebaseConfigured) {
      await db.updateTask(taskId, { status: 'In Review', updatedAt: new Date().toISOString() });
    } else {
      task.status = 'In Review';
      task.updatedAt = new Date().toISOString();
    }

    const reviewerId = task.reviewerId || this.users.find((u) => u.role === 'super_admin')?.id || this.getCurrentUser().id;
    await this.notifyUser(reviewerId, 'review_requested', 'Revue Demandée', `${this.getCurrentUser().firstName} a soumis « ${task.title} » pour revue.`, `/tasks/${task.id}`);
    await this.logAudit('Soumis pour Revue', 'task', taskId, task.title, 'En attente de validation');
    this.notify();
  }

  async approveTask(taskId: string, validationComment?: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const now = new Date().toISOString();

    const updates: Partial<Task> = {
      status: 'Completed',
      completedAt: now,
      validatedAt: now,
      validatedBy: this.getCurrentUser().id,
      validationComment
    };

    if (isFirebaseConfigured) {
      await db.updateTask(taskId, updates);
    } else {
      Object.assign(task, updates);
      this.recalculateProjectProgress(task.projectId);
    }

    for (const uid of task.assigneeIds) {
      await this.notifyUser(uid, 'task_approved', 'Tâche Approuvée !', `Votre tâche « ${task.title} » a été approuvée par ${this.getCurrentUser().firstName}.`, `/tasks/${task.id}`);
    }
    await this.logAudit('Tâche Approuvée', 'task', taskId, task.title, validationComment || 'Marquée terminée');
    this.notify();
  }

  async rejectTask(taskId: string, feedback: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updates: Partial<Task> = {
      status: 'In Progress',
      validationComment: `Modifications demandées: ${feedback}`,
      updatedAt: new Date().toISOString()
    };

    if (isFirebaseConfigured) {
      await db.updateTask(taskId, updates);
    } else {
      Object.assign(task, updates);
    }

    for (const uid of task.assigneeIds) {
      await this.notifyUser(uid, 'task_rejected', 'Modifications Demandées', `${this.getCurrentUser().firstName} a demandé des modifications sur « ${task.title} »: ${feedback}`, `/tasks/${task.id}`);
    }
    await this.logAudit('Modifications Demandées', 'task', taskId, task.title, `Retour en cours. Feedback: ${feedback}`);
    this.notify();
  }

  async toggleSubtask(taskId: string, subtaskId: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const sub = task.subtasks.find((s) => s.id === subtaskId);
    if (!sub) return;

    const updatedSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );

    if (isFirebaseConfigured) {
      await db.updateTask(taskId, { subtasks: updatedSubtasks, updatedAt: new Date().toISOString() });
    } else {
      sub.completed = !sub.completed;
      task.updatedAt = new Date().toISOString();
      this.notify();
    }
  }

  async addSubtask(taskId: string, title: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newSub: Subtask = { id: `sub-${Date.now()}`, title, completed: false };
    const updatedSubtasks = [...task.subtasks, newSub];

    if (isFirebaseConfigured) {
      await db.updateTask(taskId, { subtasks: updatedSubtasks, updatedAt: new Date().toISOString() });
    } else {
      task.subtasks.push(newSub);
      task.updatedAt = new Date().toISOString();
      this.notify();
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

    if (isFirebaseConfigured) {
      await db.addCommentDb(comment);
    } else {
      const entry: Comment = { ...comment, id: `comm-${Date.now()}`, createdAt: new Date().toISOString() };
      if (!this.comments[taskId]) this.comments[taskId] = [];
      this.comments[taskId].push(entry);
    }

    const task = this.tasks.find((t) => t.id === taskId);
    if (task) {
      for (const uid of task.assigneeIds) {
        if (uid !== user.id) {
          await this.notifyUser(uid, 'mention', 'Nouveau Commentaire', `${user.firstName} a commenté « ${task.title} »: ${content.substring(0, 50)}...`);
        }
      }
    }
    this.notify();
  }

  // ---------- Team Operations ----------

  async createTeam(teamData: Omit<Team, 'id' | 'organizationId' | 'createdAt'>): Promise<Team> {
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
    const team = this.teams.find((t) => t.id === teamId);
    if (!team) return;
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
    const team = this.teams.find((t) => t.id === teamId);
    if (!team) return;
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

  async updateCurrentUserProfile(updates: Partial<User>) {
    const user = this.getCurrentUser();
    if (isFirebaseConfigured) {
      await db.updateUser(user.id, updates);
    }
    // Update the users array so all components see the change
    const idx = this.users.findIndex((u) => u.id === user.id);
    if (idx !== -1) {
      this.users[idx] = { ...this.users[idx], ...updates };
    }
    this.currentUser = { ...user, ...updates };
    // Sync back to AuthContext so useAuth().currentUser updates too
    if (this.onProfileUpdate) this.onProfileUpdate(updates);
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

    // BUG FIX: reset to 0 when no tasks remain
    if (projTasks.length === 0) {
      this.projects[projIdx].weightedProgress = 0;
      this.projects[projIdx].health = 'on_track';
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
    this.projects[projIdx].weightedProgress = progress;

    let health: Project['health'] = 'on_track';
    if (blockedCount > 0 || overdueCount >= 2) health = 'delayed';
    else if (overdueCount === 1 || progress < 40) health = 'at_risk';
    this.projects[projIdx].health = health;
  }

  async createProject(projData: Omit<Project, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'weightedProgress'>): Promise<Project> {
    const orgId = this.getOrganization().id;

    if (isFirebaseConfigured) {
      const newProj = await db.createProject(projData, orgId);
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
    if (isFirebaseConfigured) {
      await db.updateProject(projectId, updates);
      const proj = this.projects.find((p) => p.id === projectId);
      if (proj) await this.logAudit('Projet Modifié', 'project', projectId, proj.name, 'Champs mis à jour');
      return;
    }
    const idx = this.projects.findIndex((p) => p.id === projectId);
    if (idx === -1) return;
    this.projects[idx] = { ...this.projects[idx], ...updates, updatedAt: new Date().toISOString() };
    await this.logAudit('Projet Modifié', 'project', projectId, this.projects[idx].name, 'Champs mis à jour');
    this.notify();
  }

  async deleteProject(projectId: string) {
    const proj = this.projects.find((p) => p.id === projectId);
    if (isFirebaseConfigured) {
      await db.deleteProject(projectId);
      await this.logAudit('Projet Supprimé', 'project', projectId, proj?.name || projectId);
      return;
    }
    this.projects = this.projects.filter((p) => p.id !== projectId);
    this.tasks = this.tasks.filter((t) => t.projectId !== projectId);
    await this.logAudit('Projet Supprimé', 'project', projectId, proj?.name || projectId);
    this.notify();
  }

  async deleteTask(taskId: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (isFirebaseConfigured) {
      await db.deleteTask(taskId);
      await this.logAudit('Tâche Supprimée', 'task', taskId, task?.title || taskId);
      return;
    }
    this.tasks = this.tasks.filter((t) => t.id !== taskId);
    if (task) this.recalculateProjectProgress(task.projectId);
    await this.logAudit('Tâche Supprimée', 'task', taskId, task?.title || taskId);
    this.notify();
  }

  async deleteObjective(objId: string) {
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

  async generateDailyReport(teamId?: string): Promise<DailyReport> {
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

  async sendReportEmail(reportId: string) {
    const rep = this.reports.find((r) => r.id === reportId);
    if (!rep) return;

    // Call backend to dispatch email via Resend
    try {
      await fetch('/api/reports/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: rep.id,
          recipients: rep.recipients,
          reportData: {
            date: rep.date,
            generatedBy: rep.generatedBy,
            attendanceSummary: rep.attendanceSummary,
            tasksSummary: rep.tasksSummary,
            blockers: rep.blockers
          }
        })
      });
    } catch (e) {
      console.error('[Reports] Erreur envoi e-mail:', e);
    }

    const updates: Partial<DailyReport> = { status: 'sent', sentAt: new Date().toISOString() };
    if (isFirebaseConfigured) {
      await db.updateReport(reportId, updates);
    } else {
      Object.assign(rep, updates);
    }

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
}

export const store = new AppStore();
