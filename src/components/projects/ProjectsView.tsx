import React, { useState } from 'react';
import {
  FolderKanban, Plus, Calendar, ChevronRight, Pencil, Trash2
} from 'lucide-react';
import { Project, User, Task, ProjectHealth, Team } from '../../types';
import { CreateProjectModal } from './CreateProjectModal';

interface ProjectsViewProps {
  projects: Project[];
  users: User[];
  tasks: Task[];
  teams: Team[];
  currentUser: User;
  onOpenCreateProject: () => void;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (data: Omit<Project, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'weightedProgress'>) => Promise<Project>;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects, users, tasks, teams, currentUser,
  onOpenCreateProject, onSelectProject, onCreateProject, onUpdateProject, onDeleteProject
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const canManage = currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'team_lead';

  const getHealthBadge = (health: ProjectHealth) => {
    switch (health) {
      case 'on_track': return { label: 'Sur les rails', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' };
      case 'at_risk': return { label: 'En risque', bg: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' };
      case 'delayed': return { label: 'En retard', bg: 'bg-rose-50 text-rose-800 border-rose-200', dot: 'bg-rose-500' };
    }
  };

  const handleCreate = async (data: Omit<Project, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'weightedProgress'>) => {
    await onCreateProject(data);
    setShowCreateModal(false);
  };

  const handleUpdate = async (data: Omit<Project, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'weightedProgress'>) => {
    if (editingProject) {
      await onUpdateProject(editingProject.id, data);
      setEditingProject(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight">Projets</h1>
          <p className="text-xs text-stone-500 mt-0.5">Suivez la progression des projets pondérée par la complexité des tâches.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-brand hover:bg-brand-dark text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Projet</span>
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <FolderKanban className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-500">Aucun projet pour le moment.</p>
          {canManage && <p className="text-xs text-stone-400 mt-1">Cliquez sur « Nouveau Projet » pour commencer.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {projects.map((project) => {
            const owner = users.find((u) => u.id === project.ownerId);
            const projectTasks = tasks.filter((t) => t.projectId === project.id);
            const completedCount = projectTasks.filter((t) => t.status === 'Completed').length;
            const health = getHealthBadge(project.health);

            return (
              <div
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${health.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
                      {health.label}
                    </span>
                    {canManage && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingProject(project); }}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm(`Supprimer « ${project.name} » et toutes ses tâches ?`)) onDeleteProject(project.id); }}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-stone-900 group-hover:text-brand transition-colors mb-1">
                    {project.name}
                  </h3>
                  <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed mb-3">
                    {project.description || 'Aucune description'}
                  </p>

                  <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-stone-400 uppercase tracking-wider text-[10px]">Progression</span>
                      <span className="text-brand">{project.weightedProgress}%</span>
                    </div>
                    <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-brand h-full rounded-full transition-all duration-500" style={{ width: `${project.weightedProgress}%` }} />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {owner?.avatar ? (
                      <img src={owner.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : owner ? (
                      <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center text-white text-[10px] font-semibold">
                        {owner.firstName.charAt(0)}{owner.lastName.charAt(0)}
                      </div>
                    ) : null}
                    <span className="font-medium text-stone-700">{owner ? `${owner.firstName} ${owner.lastName}` : 'Non assigné'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-stone-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {project.dueDate}
                    </span>
                    <span>{completedCount}/{projectTasks.length} tâches</span>
                    <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-brand transition-colors" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(showCreateModal || editingProject) && (
        <CreateProjectModal
          teams={teams}
          users={users}
          currentUser={currentUser}
          project={editingProject}
          onClose={() => { setShowCreateModal(false); setEditingProject(null); }}
          onSubmit={editingProject ? handleUpdate : handleCreate}
        />
      )}
    </div>
  );
};
