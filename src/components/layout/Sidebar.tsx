import React, { useState } from 'react';
import {
  CheckSquare,
  Bell,
  FolderKanban,
  FileText,
  Clock,
  BarChart3,
  Plus,
  Users,
  ChevronDown,
  LogOut,
  UserCheck,
  Menu,
  X
} from 'lucide-react';
import { User, UserRole } from '../../types';
import {
  canViewKanbanBoard,
  canViewTeamsView,
  canViewReportsView,
  canViewAnalyticsView
} from '../../services/permissions';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  currentUser: User;
  unreadNotificationsCount: number;
  onOpenCreateProject: () => void;
  onOpenUserSwitch: () => void;
  onSignOut: () => void;
  tasksCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  currentUser,
  unreadNotificationsCount,
  onOpenCreateProject,
  onOpenUserSwitch,
  onSignOut,
  tasksCount
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return { label: 'Super Admin', bg: 'bg-purple-50 text-purple-700' };
      case 'admin':
        return { label: 'Admin', bg: 'bg-blue-50 text-blue-700' };
      case 'manager':
        return { label: 'Manager', bg: 'bg-emerald-50 text-emerald-700' };
      case 'team_lead':
        return { label: 'Chef d\'Équipe', bg: 'bg-amber-50 text-amber-700' };
      case 'viewer':
        return { label: 'Observateur', bg: 'bg-slate-50 text-slate-700' };
      default:
        return { label: 'Utilisateur', bg: 'bg-stone-100 text-stone-600' };
    }
  };

  const roleBadge = getRoleBadge(currentUser.role);

  const navItemClass = (active: boolean) =>
    `w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      active ? 'bg-brand-100 text-brand-dark' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
    }`;

  const handleSelect = (view: string) => {
    onSelectView(view);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <>
      {/* Top Header */}
      <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar">
        {/* Brand Logo + Close (mobile) */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-stone-100">
          <div className="cursor-pointer" onClick={() => handleSelect('kanban')}>
            <img src="/logo-horizontal.png" alt="LE LOUI PARFAIT" className="h-[4.5rem] w-auto" />
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-stone-400 hover:text-stone-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MAIN MENU Section */}
        <div className="px-3 pt-4">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-stone-400 uppercase">
            Menu Principal
          </div>
          <nav className="space-y-1">
            {/* Kanban global - Admins et management uniquement */}
            {canViewKanbanBoard(currentUser) && (
              <button onClick={() => handleSelect('kanban')} className={navItemClass(currentView === 'kanban' || currentView === 'tasks')}>
                <div className="flex items-center gap-3">
                  <CheckSquare className="w-4 h-4 shrink-0" />
                  <span>Toutes les Tâches</span>
                </div>
                <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-medium shrink-0">{tasksCount}</span>
              </button>
            )}

            {/* Mon Travail - Tous sauf viewer */}
            <button onClick={() => handleSelect('mywork')} className={navItemClass(currentView === 'mywork')}>
              <div className="flex items-center gap-3">
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>Mon Travail</span>
              </div>
            </button>

            {/* Notifications - Tous */}
            <button onClick={() => handleSelect('notifications')} className={navItemClass(currentView === 'notifications')}>
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 shrink-0" />
                <span>Notifications</span>
              </div>
              {unreadNotificationsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-brand shrink-0" />
              )}
            </button>

            {/* Projets - Tous (mais filtré dans la vue) */}
            <div
              onClick={() => handleSelect('projects')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                currentView === 'projects' ? 'bg-brand-100 text-brand-dark' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <FolderKanban className="w-4 h-4 shrink-0" />
                <span>Projets</span>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenCreateProject(); }}
                className="text-stone-400 hover:text-stone-900 p-0.5 rounded transition-colors shrink-0"
                title="Créer un Projet"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Présences - Tous (mais filtré dans la vue) */}
            <button onClick={() => handleSelect('attendance')} className={navItemClass(currentView === 'attendance')}>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Présences</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Statut en direct" />
            </button>

            {/* Équipes - Admins et management */}
            {canViewTeamsView(currentUser) && (
              <button onClick={() => handleSelect('teams')} className={navItemClass(currentView === 'teams')}>
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Équipes</span>
                </div>
              </button>
            )}

            {/* Rapports - Management uniquement */}
            {canViewReportsView(currentUser) && (
              <button onClick={() => handleSelect('reports')} className={navItemClass(currentView === 'reports')}>
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>Rapports</span>
                </div>
              </button>
            )}

            {/* Analytique - Management uniquement */}
            {canViewAnalyticsView(currentUser) && (
              <button onClick={() => handleSelect('analytics')} className={navItemClass(currentView === 'analytics')}>
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-4 h-4 shrink-0" />
                  <span>Analytique</span>
                </div>
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Bottom User Profile Card */}
      <div className="p-3 border-t border-stone-100 bg-stone-50/50 shrink-0">
        <div
          onClick={() => { onOpenUserSwitch(); setMobileOpen(false); }}
          className="flex items-center justify-between p-2 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-stone-200 cursor-pointer transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={`${currentUser.firstName} ${currentUser.lastName}`}
                  className="w-9 h-9 rounded-full object-cover border border-stone-200"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white text-sm font-semibold border border-stone-200">
                  {currentUser.firstName.charAt(0)}{currentUser.lastName.charAt(0)}
                </div>
              )}
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                  currentUser.presenceStatus === 'online'
                    ? 'bg-emerald-500'
                    : currentUser.presenceStatus === 'away'
                    ? 'bg-amber-500'
                    : 'bg-stone-400'
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-stone-900 truncate block">
                {currentUser.firstName} {currentUser.lastName}
              </span>
              <p className="text-xs text-stone-500 truncate">{currentUser.email}</p>
              <span className={`inline-block text-[10px] font-medium px-1.5 py-0.2 rounded mt-0.5 ${roleBadge.bg}`}>
                {roleBadge.label}
              </span>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
        </div>

        {/* Sign out button */}
        <button
          onClick={onSignOut}
          className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-stone-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span>Se déconnecter</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button — fixed top-left */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-30 bg-white border border-stone-200 rounded-lg p-2 shadow-sm text-stone-600 hover:text-stone-900"
        aria-label="Ouvrir le menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-30"
        />
      )}

      {/* Desktop sidebar — always visible */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-stone-200 h-screen flex-col justify-between shrink-0 select-none z-20">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar — drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-screen w-72 bg-white border-r border-stone-200 flex flex-col justify-between select-none z-40 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
