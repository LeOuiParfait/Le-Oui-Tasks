import React, { useState, useEffect, useMemo } from 'react';
import { store } from './services/store';
import { useAuth } from './services/AuthContext';
import { AuthScreen } from './components/auth/AuthScreen';
import {
  User,
  Organization,
  Team,
  Project,
  Task,
  Objective,
  AttendanceRecord,
  Notification as NotifType,
  DailyReport,
  TaskStatus
} from './types';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { TopMetrics } from './components/dashboard/TopMetrics';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { TaskDetailModal } from './components/kanban/TaskDetailModal';
import { CreateTaskModal } from './components/kanban/CreateTaskModal';
import { MyWorkView } from './components/mywork/MyWorkView';
import { AttendanceView } from './components/attendance/AttendanceView';
import { ProjectsView } from './components/projects/ProjectsView';
import { ObjectivesView } from './components/objectives/ObjectivesView';
import { DailyReportsView } from './components/reports/DailyReportsView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { TeamsView } from './components/teams/TeamsView';
import { SettingsModal } from './components/settings/SettingsModal';
import { Loader2 } from 'lucide-react';
import { canViewAllTasks } from './services/permissions';
import { usePresenceTracking } from './services/usePresenceTracking';

export default function App() {
  const { firebaseUid, currentUser, organization, initializing } = useAuth();

  // Initialize store with Firestore subscriptions when user is available
  useEffect(() => {
    if (currentUser && organization) {
      store.init(organization.id, currentUser, organization);
    }
    return () => {
      if (currentUser) store.destroy();
    };
  }, [currentUser, organization]);

  // Show auth screen if not logged in
  if (initializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
          <p className="text-sm text-stone-500 font-medium">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUid || !currentUser) {
    return <AuthScreen />;
  }

  return <Workspace />;
}

function Workspace() {
  const { currentUser, organization, signOut, updateCurrentUser } = useAuth();

  // Ensure store has the current user
  useEffect(() => {
    if (currentUser) store.setCurrentUser(currentUser);
  }, [currentUser]);

  // Sync store profile changes back to AuthContext
  useEffect(() => {
    store.setOnProfileUpdate((updates) => updateCurrentUser(updates));
  }, [updateCurrentUser]);

  const [users, setUsers] = useState<User[]>(store.getUsers());
  const [teams, setTeams] = useState<Team[]>(store.getTeams());
  const [projects, setProjects] = useState<Project[]>(store.getProjects());
  const [tasks, setTasks] = useState<Task[]>(store.getTasks());
  const [objectives, setObjectives] = useState<Objective[]>(store.getObjectives());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(store.getAttendanceRecords());
  const [notifications, setNotifications] = useState<NotifType[]>(store.getNotifications());
  const [reports, setReports] = useState<DailyReport[]>(store.getReports());

  // Suivi de présence intelligent (heartbeat + inactivité + beforeunload)
  const today = new Date().toISOString().split('T')[0];
  const myTodayRecord = attendanceRecords.find((r) => r.userId === currentUser?.id && r.date === today);
  const isCurrentlyWorking = myTodayRecord?.status === 'working' || myTodayRecord?.status === 'on_break';
  usePresenceTracking(currentUser?.id, isCurrentlyWorking);

  const [currentView, setCurrentView] = useState<string>('kanban');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [initialTaskStatus, setInitialTaskStatus] = useState<TaskStatus>('Todo');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setUsers(store.getUsers());
      setTeams(store.getTeams());
      setProjects(store.getProjects());
      setTasks(store.getTasks());
      setObjectives(store.getObjectives());
      setAttendanceRecords(store.getAttendanceRecords());
      setNotifications(store.getNotifications());
      setReports(store.getReports());
    });
    return unsubscribe;
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const myTodayAttendance = attendanceRecords.find((r) => r.userId === currentUser?.id && r.date === todayStr);

  const viewTitles: Record<string, string> = {
    kanban: 'Toutes les Tâches',
    mywork: 'Mon Travail & Priorités du Jour',
    notifications: 'Centre de Notifications',
    projects: 'Vue d\'ensemble des Projets',
    attendance: 'Présences & Pointage',
    teams: 'Équipes',
    objectives: 'OKR & Objectifs',
    reports: 'Rapports Quotidiens',
    analytics: 'Analytique de Gestion'
  };

  // Filtrer les tâches selon les permissions
  const visibleTasks = useMemo(() => {
    if (canViewAllTasks(currentUser)) return tasks;
    // User simple : uniquement ses tâches assignées
    return tasks.filter(t => t.assigneeIds.includes(currentUser.id));
  }, [tasks, currentUser]);

  const completedTasksCount = visibleTasks.filter((t) => t.status === 'Completed').length;
  const activeTeamMembersCount = users.filter((u) => u.presenceStatus === 'online' || u.presenceStatus === 'away').length;
  // BUG FIX: compute real upcoming deadlines instead of hardcoded 12
  const upcomingDeadlinesCount = visibleTasks.filter((t) => {
    if (t.status === 'Completed') return false;
    const due = new Date(t.dueDate);
    const now = new Date();
    const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  if (!currentUser) return null;

  return (
    <div className="flex h-screen bg-stone-50 text-brand font-sans antialiased overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        currentUser={currentUser}
        unreadNotificationsCount={notifications.filter((n) => !n.read).length}
        onOpenCreateProject={() => setCurrentView('projects')}
        onOpenUserSwitch={() => setShowSettings(true)}
        onSignOut={signOut}
        tasksCount={visibleTasks.length}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <Header
          title={viewTitles[currentView] || 'Toutes les Tâches'}
          users={users}
          currentUser={currentUser}
          attendanceRecord={myTodayAttendance}
          onStartWorkday={() => store.startWorkday()}
          onEndWorkday={() => store.endWorkday()}
          onToggleBreak={() => store.toggleBreak()}
          onOpenSettings={() => setShowSettings(true)}
          onSignOut={signOut}
        />

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 no-scrollbar">
          {/* Top KPI Metrics (Visible on Dashboard / Kanban View) */}
          {currentView === 'kanban' && (
            <TopMetrics
              activeProjectsCount={projects.length}
              completedTasksCount={completedTasksCount}
              upcomingDeadlinesCount={upcomingDeadlinesCount}
              activeTeamMembersCount={activeTeamMembersCount}
            />
          )}

          {/* View Routing */}
          {currentView === 'kanban' || currentView === 'tasks' ? (
            <KanbanBoard
              tasks={visibleTasks}
              users={users}
              projects={projects}
              onUpdateTaskStatus={(taskId, status) => store.updateTaskStatus(taskId, status)}
              onOpenTaskDetail={setSelectedTask}
              onOpenCreateTask={(initialStatus) => {
                setInitialTaskStatus(initialStatus || 'Todo');
                setShowCreateTaskModal(true);
              }}
              onToggleSubtask={(taskId, subId) => store.toggleSubtask(taskId, subId)}
            />
          ) : currentView === 'mywork' ? (
            <MyWorkView
              currentUser={currentUser}
              tasks={visibleTasks}
              objectives={objectives}
              attendanceRecord={myTodayAttendance}
              onOpenTaskDetail={setSelectedTask}
              onUpdateTaskStatus={(taskId, status) => store.updateTaskStatus(taskId, status)}
              onStartWorkday={() => store.startWorkday()}
            />
          ) : currentView === 'attendance' ? (
            <AttendanceView
              currentUser={currentUser}
              users={users}
              attendanceRecords={attendanceRecords}
              organization={organization}
              tasks={tasks}
              onStartWorkday={() => store.startWorkday()}
              onEndWorkday={() => store.endWorkday()}
              onToggleBreak={() => store.toggleBreak()}
            />
          ) : currentView === 'projects' ? (
            <ProjectsView
              projects={projects}
              users={users}
              tasks={tasks}
              teams={teams}
              currentUser={currentUser}
              onOpenCreateProject={() => setCurrentView('projects')}
              onSelectProject={(pId) => setCurrentView('kanban')}
              onCreateProject={(data) => store.createProject(data)}
              onUpdateProject={(projectId, updates) => store.updateProject(projectId, updates)}
              onDeleteProject={(projectId) => store.deleteProject(projectId)}
            />
          ) : currentView === 'teams' ? (
            <TeamsView
              teams={teams}
              users={users}
              currentUser={currentUser}
              onCreateTeam={(data) => store.createTeam(data)}
              onUpdateTeam={(teamId, updates) => store.updateTeam(teamId, updates)}
              onDeleteTeam={(teamId) => store.deleteTeam(teamId)}
              onAddMember={(teamId, userId) => store.addTeamMember(teamId, userId)}
              onRemoveMember={(teamId, userId) => store.removeTeamMember(teamId, userId)}
            />
          ) : currentView === 'objectives' ? (
            <ObjectivesView
              objectives={objectives}
              users={users}
              projects={projects}
              onUpdateProgress={(objId, val) => store.updateObjectiveProgress(objId, val)}
              onCreateObjective={(data) => store.createObjective(data)}
            />
          ) : currentView === 'reports' ? (
            <DailyReportsView
              reports={reports}
              workDayReports={store.getVisibleWorkDayReports()}
              users={users}
              currentUser={currentUser}
              onGenerateReport={() => store.generateDailyReport()}
              onSendReportEmail={(rId) => store.sendReportEmail(rId)}
            />
          ) : currentView === 'analytics' ? (
            <AnalyticsView
              tasks={tasks}
              users={users}
              projects={projects}
              teams={teams}
            />
          ) : currentView === 'notifications' ? (
            <div className="bg-white rounded-xl border border-stone-200 p-6 max-w-4xl mx-auto shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <h2 className="text-lg font-bold text-brand">Centre de Notifications</h2>
                <button
                  onClick={() => store.markAllNotificationsRead()}
                  className="text-xs text-brand font-semibold hover:underline"
                >
                  Tout marquer comme lu
                </button>
              </div>

              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <div className="text-center py-12 text-sm text-stone-400">
                    Aucune notification pour le moment.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => store.markNotificationRead(n.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        n.read ? 'bg-white border-stone-100' : 'bg-brand-50 border-brand font-semibold'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-brand">{n.title}</span>
                        <span className="text-[10px] text-stone-400">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 font-normal">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </main>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          users={users}
          projects={projects}
          currentUser={currentUser}
          comments={store.getTaskComments(selectedTask.id)}
          onClose={() => setSelectedTask(null)}
          onUpdateStatus={(taskId, status, blockerReason) => store.updateTaskStatus(taskId, status, blockerReason)}
          onSubmitForReview={(taskId) => store.submitTaskForReview(taskId)}
          onApproveTask={(taskId, comment) => store.approveTask(taskId, comment)}
          onRejectTask={(taskId, feedback) => store.rejectTask(taskId, feedback)}
          onToggleSubtask={(taskId, subId) => store.toggleSubtask(taskId, subId)}
          onAddSubtask={(taskId, title) => store.addSubtask(taskId, title)}
          onAddComment={(taskId, content) => store.addComment(taskId, content)}
          onDeleteTask={(taskId) => store.deleteTask(taskId)}
        />
      )}

      {/* Create Task Modal */}
      {showCreateTaskModal && (
        <CreateTaskModal
          initialStatus={initialTaskStatus}
          users={users}
          projects={projects}
          currentUser={currentUser}
          onClose={() => setShowCreateTaskModal(false)}
          onCreateTask={(taskData) => store.createTask(taskData)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && organization && (
        <SettingsModal
          organization={organization}
          users={users}
          teams={teams}
          currentUser={currentUser}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
