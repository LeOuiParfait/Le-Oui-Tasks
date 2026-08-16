'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { store } from '@/lib/services/store'
import { useAuth } from '@/lib/services/AuthContext'
import {
  User,
  Team,
  Project,
  Task,
  Objective,
  AttendanceRecord,
  Notification as NotifType,
  DailyReport,
  WorkDayReport,
  TaskStatus
} from '@/types'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { TopMetrics } from '@/components/dashboard/TopMetrics'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { TaskDetailModal } from '@/components/kanban/TaskDetailModal'
import { CreateTaskModal } from '@/components/kanban/CreateTaskModal'
import { MyWorkView } from '@/components/mywork/MyWorkView'
import { AttendanceView } from '@/components/attendance/AttendanceView'
import { ProjectsView } from '@/components/projects/ProjectsView'
import { DailyReportsView } from '@/components/reports/DailyReportsView'
import { AnalyticsView } from '@/components/analytics/AnalyticsView'
import { TeamsView } from '@/components/teams/TeamsView'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { canViewAllTasks, canViewTask } from '@/lib/services/permissions'
import { usePresenceTracking } from '@/lib/services/usePresenceTracking'

export function Workspace() {
  const { currentUser: authUser, organization, signOut, updateCurrentUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Keep Workspace currentUser in sync with store (which follows Firestore users)
  const [currentUser, setStoreCurrentUser] = useState<User | null>(store.getCurrentUser())
  
  useEffect(() => {
    if (authUser) store.setCurrentUser(authUser)
  }, [authUser])
  
  useEffect(() => {
    const refresh = () => setStoreCurrentUser(store.getCurrentUser())
    refresh()
    const unsub = store.subscribe(refresh)
    return unsub
  }, [])

  // Sync store profile changes back to AuthContext
  useEffect(() => {
    store.setOnProfileUpdate((updates) => updateCurrentUser(updates))
  }, [updateCurrentUser])

  // Initialize store with Firestore subscriptions
  useEffect(() => {
    if (authUser && organization) {
      store.init(organization.id, authUser, organization)
    }
    return () => {
      if (authUser) store.destroy()
    }
  }, [authUser, organization])

  const [users, setUsers] = useState<User[]>(store.getUsers())
  const [teams, setTeams] = useState<Team[]>(store.getTeams())
  const [projects, setProjects] = useState<Project[]>(store.getProjects())
  const [tasks, setTasks] = useState<Task[]>(store.getTasks())
  const [objectives, setObjectives] = useState<Objective[]>(store.getObjectives())
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(store.getAttendanceRecords())
  const [notifications, setNotifications] = useState<NotifType[]>(store.getNotifications())
  const [reports, setReports] = useState<DailyReport[]>(store.getReports())
  const [workDayReports, setWorkDayReports] = useState<WorkDayReport[]>(store.getWorkDayReports())

  // Suivi de présence intelligent (heartbeat + inactivité + beforeunload)
  const today = new Date().toISOString().split('T')[0]
  const myTodayRecord = attendanceRecords.find((r) => r.userId === currentUser?.id && r.date === today)
  const isCurrentlyWorking = myTodayRecord?.status === 'working' || myTodayRecord?.status === 'on_break'
  usePresenceTracking(currentUser?.id, isCurrentlyWorking)

  const pathToView: Record<string, string> = {
    '/': 'kanban',
    '/kanban': 'kanban',
    '/mywork': 'mywork',
    '/attendance': 'attendance',
    '/projects': 'projects',
    '/teams': 'teams',
    '/reports': 'reports',
    '/analytics': 'analytics',
    '/notifications': 'notifications'
  }
  
  const viewToPath: Record<string, string> = {
    'kanban': '/',
    'mywork': '/mywork',
    'attendance': '/attendance',
    'projects': '/projects',
    'teams': '/teams',
    'reports': '/reports',
    'analytics': '/analytics',
    'notifications': '/notifications'
  }
  
  const [currentView, setCurrentView] = useState<string>(pathToView[pathname] || 'kanban')

  useEffect(() => {
    const view = pathToView[pathname] || 'kanban'
    if (view !== currentView) setCurrentView(view)
  }, [pathname])

  const handleSetView = (view: string) => {
    setCurrentView(view)
    const path = viewToPath[view] || '/'
    if (pathname !== path) router.push(path)
  }
  
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedTaskId) || null, [tasks, selectedTaskId])
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false)
  const [initialTaskStatus, setInitialTaskStatus] = useState<TaskStatus>('Todo')
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setUsers(store.getUsers())
      setTeams(store.getTeams())
      setProjects(store.getProjects())
      setTasks(store.getTasks())
      setObjectives(store.getObjectives())
      setAttendanceRecords(store.getAttendanceRecords())
      setNotifications(store.getNotifications())
      setReports(store.getReports())
      setWorkDayReports(store.getWorkDayReports())
    })
    return unsubscribe
  }, [])

  const todayStr = new Date().toISOString().split('T')[0]
  const myTodayAttendance = attendanceRecords.find((r) => r.userId === currentUser?.id && r.date === todayStr)

  const viewTitles: Record<string, string> = {
    kanban: 'Toutes les Tâches',
    mywork: 'Mon Travail & Priorités du Jour',
    notifications: 'Centre de Notifications',
    projects: 'Vue d\'ensemble des Projets',
    attendance: 'Présences & Pointage',
    teams: 'Équipes',
    reports: 'Rapports Quotidiens',
    analytics: 'Analytique de Gestion'
  }

  // Filtrer les tâches selon les permissions
  const visibleTasks = useMemo(() => {
    if (!currentUser) return []
    if (canViewAllTasks(currentUser)) return tasks
    return tasks.filter(t => canViewTask(currentUser, t.projectId, projects) || t.assigneeIds.includes(currentUser.id))
  }, [tasks, currentUser, projects])

  const completedTasksCount = visibleTasks.filter((t) => t.status === 'Completed').length
  const activeTeamMembersCount = users.filter((u) => u.presenceStatus === 'online' || u.presenceStatus === 'away').length
  const upcomingDeadlinesCount = visibleTasks.filter((t) => {
    if (t.status === 'Completed') return false
    const due = new Date(t.dueDate)
    const now = new Date()
    const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays >= 0 && diffDays <= 7
  }).length

  if (!currentUser) return null

  return (
    <div className="flex h-screen bg-stone-50 text-brand font-sans antialiased overflow-hidden">
      <Sidebar
        currentView={currentView}
        onSelectView={handleSetView}
        currentUser={currentUser}
        unreadNotificationsCount={notifications.filter((n) => !n.read).length}
        onOpenCreateProject={() => handleSetView('projects')}
        onOpenUserSwitch={() => setShowSettings(true)}
        onSignOut={signOut}
        tasksCount={visibleTasks.length}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
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

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 no-scrollbar">
          {currentView === 'kanban' && (
            <TopMetrics
              activeProjectsCount={projects.length}
              completedTasksCount={completedTasksCount}
              upcomingDeadlinesCount={upcomingDeadlinesCount}
              activeTeamMembersCount={activeTeamMembersCount}
            />
          )}

          {(currentView === 'kanban' || currentView === 'tasks') && (
            <KanbanBoard
              tasks={visibleTasks}
              users={users}
              projects={projects}
              onUpdateTaskStatus={(taskId, status) => store.updateTaskStatus(taskId, status)}
              onOpenTaskDetail={(t) => setSelectedTaskId(t.id)}
              onOpenCreateTask={(initialStatus) => {
                setInitialTaskStatus(initialStatus || 'Todo')
                setShowCreateTaskModal(true)
              }}
              onToggleSubtask={(taskId, subId) => store.toggleSubtask(taskId, subId)}
            />
          )}
          
          {currentView === 'mywork' && (
            <MyWorkView
              currentUser={currentUser}
              tasks={visibleTasks}
              objectives={objectives}
              attendanceRecord={myTodayAttendance}
              onOpenTaskDetail={(t) => setSelectedTaskId(t.id)}
              onUpdateTaskStatus={(taskId, status) => store.updateTaskStatus(taskId, status)}
              onStartWorkday={() => store.startWorkday()}
            />
          )}
          
          {currentView === 'attendance' && organization && (
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
          )}
          
          {currentView === 'projects' && (
            <ProjectsView
              projects={projects}
              tasks={tasks}
              teams={teams}
              users={users}
              currentUser={currentUser}
              onOpenCreateProject={() => setShowCreateTaskModal(true)}
              onSelectProject={(id: string) => console.log('Select project:', id)}
              onCreateProject={(p: any) => store.createProject(p)}
              onUpdateProject={(id: string, u: any) => store.updateProject(id, u)}
              onDeleteProject={(id: string) => store.deleteProject(id)}
            />
          )}
          
          {currentView === 'teams' && (
            <TeamsView
              teams={teams}
              users={users}
              currentUser={currentUser}
              onCreateTeam={(t: any) => store.createTeam(t)}
              onUpdateTeam={(id: string, u: any) => store.updateTeam(id, u)}
              onDeleteTeam={(id: string) => store.deleteTeam(id)}
              onAddMember={(teamId: string, userId: string) => store.addTeamMember(teamId, userId)}
              onRemoveMember={(teamId: string, userId: string) => store.removeTeamMember(teamId, userId)}
            />
          )}
          
          {currentView === 'reports' && (
            <DailyReportsView
              reports={reports}
              workDayReports={workDayReports}
              users={users}
              currentUser={currentUser}
              onGenerateReport={() => store.generateDailyReport()}
              onSendReportEmail={(id: string) => store.sendReportEmail(id)}
            />
          )}
          
          {currentView === 'analytics' && (
            <AnalyticsView
              tasks={tasks}
              users={users}
              projects={projects}
              teams={teams}
            />
          )}
        </main>
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          users={users}
          projects={projects}
          currentUser={currentUser}
          comments={store.getTaskComments(selectedTask.id)}
          onClose={() => setSelectedTaskId(null)}
          onUpdateTask={(id, u) => store.updateTask(id, u)}
          onUpdateStatus={(id, status, blockerReason) => store.updateTaskStatus(id, status, blockerReason)}
          onSubmitForReview={(id) => store.submitTaskForReview(id)}
          onApproveTask={(id, comment) => store.approveTask(id, comment)}
          onRejectTask={(id, feedback) => store.rejectTask(id, feedback)}
          onToggleSubtask={(taskId, subId) => store.toggleSubtask(taskId, subId)}
          onAddSubtask={(taskId, title) => store.addSubtask(taskId, title)}
          onEditSubtask={(taskId, subId, title) => store.editSubtask(taskId, subId, title)}
          onDeleteSubtask={(taskId, subId) => store.deleteSubtask(taskId, subId)}
          onAddComment={(taskId, c) => store.addComment(taskId, c)}
          onEditComment={(commentId, taskId, c) => store.editComment(commentId, taskId, c)}
          onDeleteComment={(commentId, taskId) => store.deleteComment(commentId, taskId)}
          onDeleteTask={(id) => store.deleteTask(id)}
        />
      )}

      {showCreateTaskModal && (
        <CreateTaskModal
          initialStatus={initialTaskStatus}
          projects={projects}
          users={users}
          currentUser={currentUser}
          onClose={() => setShowCreateTaskModal(false)}
          onCreateTask={(t) => store.createTask(t)}
        />
      )}

      {showSettings && organization && (
        <SettingsModal
          currentUser={currentUser}
          organization={organization}
          users={users}
          teams={teams}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
