import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Task, User as UserType, Project, TaskStatus, TaskPriority, TaskDifficulty } from '../../types';

interface CreateTaskModalProps {
  initialStatus?: TaskStatus;
  users: UserType[];
  projects: Project[];
  currentUser: UserType;
  onClose: () => void;
  onCreateTask: (taskData: Omit<Task, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  initialStatus = 'Todo', users, projects, currentUser, onClose, onCreateTask
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [difficulty, setDifficulty] = useState<TaskDifficulty>('Medium');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([currentUser.id]);
  const [reviewerId, setReviewerId] = useState<string>('');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
  const [estimatedHours, setEstimatedHours] = useState(8);
  const [weight, setWeight] = useState(3);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');

  const handleAddSubtask = () => {
    if (!subtaskInput.trim()) return;
    setSubtasks([...subtasks, subtaskInput.trim()]);
    setSubtaskInput('');
  };

  const handleRemoveSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const toggleAssignee = (id: string) => {
    setSelectedAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreateTask({
      projectId,
      teamId: '',
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      difficulty,
      assigneeIds: selectedAssigneeIds,
      creatorId: currentUser.id,
      reviewerId: reviewerId || undefined,
      dueDate,
      startDate: new Date().toISOString().split('T')[0],
      estimatedHours,
      weight,
      subtasks: subtasks.map((st, i) => ({ id: `sub-new-${i}`, title: st, completed: false })),
      labels: [priority],
      attachments: []
    });
    onClose();
  };

  const Avatar: React.FC<{ user: UserType; size?: string }> = ({ user, size = 'w-4 h-4' }) => {
    if (user.avatar) return <img src={user.avatar} alt="" className={`${size} rounded-full object-cover`} />;
    return (
      <div className={`${size} rounded-full bg-brand flex items-center justify-center text-white text-[8px] font-semibold`}>
        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full shadow-xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        <div className="px-4 sm:px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-brand-100 text-brand-dark">
              <Plus className="w-5 h-5" />
            </div>
            <h2 className="font-brand text-lg font-medium text-stone-900">Nouvelle Tâche</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 no-scrollbar">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Titre *</label>
            <input type="text" required placeholder="Ex : Implémenter la page de connexion" value={title} onChange={(e) => setTitle(e.target.value)} className="form-input-base" autoFocus />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Projet</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="form-input-base">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Statut</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className="form-input-base">
                <option value="Backlog">Backlog</option>
                <option value="Todo">À faire</option>
                <option value="In Progress">En cours</option>
                <option value="In Review">En révision</option>
                <option value="Blocked">Bloqué</option>
                <option value="Completed">Terminé</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Difficulté</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as TaskDifficulty)} className="form-input-base">
                <option value="Easy">Facile</option>
                <option value="Medium">Moyen</option>
                <option value="Hard">Difficile</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Priorité</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="form-input-base">
                <option value="Low">Basse</option>
                <option value="Medium">Moyenne</option>
                <option value="High">Haute</option>
                <option value="Critical">Critique</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Description</label>
            <textarea rows={3} placeholder="Périmètre et attentes techniques..." value={description} onChange={(e) => setDescription(e.target.value)} className="form-input-base resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-2">Assignés</label>
            <div className="flex flex-wrap gap-2">
              {users.map((u) => {
                const isSelected = selectedAssigneeIds.includes(u.id);
                return (
                  <button type="button" key={u.id} onClick={() => toggleAssignee(u.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${isSelected ? 'bg-brand-100 text-brand-dark border-brand' : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'}`}>
                    <Avatar user={u} />
                    <span>{u.firstName} {u.lastName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Réviseur</label>
              <select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} className="form-input-base">
                <option value="">Aucun</option>
                {users.filter((u) => u.role === 'super_admin' || u.role === 'admin' || u.role === 'manager' || u.role === 'team_lead').map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Échéance</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="form-input-base" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Heures estimées</label>
              <input type="number" min={1} value={estimatedHours} onChange={(e) => setEstimatedHours(Number(e.target.value))} className="form-input-base" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Poids (1-8)</label>
              <input type="number" min={1} max={8} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="form-input-base" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Sous-tâches</label>
            <div className="space-y-1.5 mb-2">
              {subtasks.map((st, idx) => (
                <div key={idx} className="flex items-center justify-between bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200 text-xs">
                  <span className="font-medium text-stone-800">{st}</span>
                  <button type="button" onClick={() => handleRemoveSubtask(idx)} className="text-stone-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" placeholder="Ajouter une sous-tâche..." value={subtaskInput} onChange={(e) => setSubtaskInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }} className="form-input-base" />
              <button type="button" onClick={handleAddSubtask} className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 shrink-0">
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors">
              Annuler
            </button>
            <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />
              Créer la tâche
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
