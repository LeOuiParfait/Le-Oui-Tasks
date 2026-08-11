import React, { useState } from 'react';
import { X, Loader2, FolderKanban } from 'lucide-react';
import { Project, Team, User, ProjectStatus, TaskPriority, ProjectHealth, ProjectRole } from '../../types';

interface CreateProjectModalProps {
  teams: Team[];
  users: User[];
  currentUser: User;
  project?: Project | null;
  onClose: () => void;
  onSubmit: (data: Omit<Project, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'weightedProgress'>) => Promise<void>;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  teams, users, currentUser, project, onClose, onSubmit
}) => {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status || 'Planning');
  const [priority, setPriority] = useState<TaskPriority>(project?.priority || 'Medium');
  const [ownerId, setOwnerId] = useState(project?.ownerId || currentUser.id);
  const [selectedTeams, setSelectedTeams] = useState<string[]>(project?.teamIds || []);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    project?.members.map(m => m.userId) || []
  );
  const [startDate, setStartDate] = useState(project?.startDate || new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(project?.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTeam = (id: string) => setSelectedTeams((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  const toggleMember = (id: string) => setSelectedMembers((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Le nom du projet est obligatoire.'); return; }
    if (!ownerId) { setError('Veuillez désigner un responsable.'); return; }
    setLoading(true);
    try {
      const newMembers = selectedMembers.map(userId => ({
        userId,
        role: userId === ownerId ? 'owner' : 'member' as ProjectRole,
        addedAt: new Date().toISOString()
      }));
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        coverImage: project?.coverImage,
        status,
        health: project?.health || 'on_track',
        priority,
        ownerId,
        teamIds: selectedTeams,
        members: newMembers,
        memberIds: newMembers.map(m => m.userId),
        ownerIds: newMembers.filter(m => m.role === 'owner').map(m => m.userId),
        viewerIds: newMembers.filter(m => m.role === 'viewer').map(m => m.userId),
        startDate,
        dueDate
      });
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-brand" />
            <h2 className="font-brand text-lg font-medium text-stone-900">{project ? 'Modifier le projet' : 'Nouveau projet'}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Nom du projet *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="form-input-base" placeholder="Ex : Refonte du site web" autoFocus />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="form-input-base resize-none" placeholder="Objectif et contexte du projet" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Statut</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className="form-input-base">
                <option value="Planning">Planification</option>
                <option value="Active">Actif</option>
                <option value="On Hold">En pause</option>
                <option value="Completed">Terminé</option>
                <option value="Archived">Archivé</option>
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
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Responsable *</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="form-input-base">
              <option value="">Sélectionner...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} — {u.jobTitle || u.role}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Date de début</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input-base" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Échéance</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="form-input-base" />
            </div>
          </div>

          {teams.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Équipes assignées</label>
              <div className="flex flex-wrap gap-2">
                {teams.map((t) => (
                  <button key={t.id} type="button" onClick={() => toggleTeam(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedTeams.includes(t.id) ? 'bg-brand text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Membres du projet</label>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-stone-50 cursor-pointer">
                  <input type="checkbox" checked={selectedMembers.includes(u.id)} onChange={() => toggleMember(u.id)} className="rounded border-stone-300 text-brand focus:ring-brand" />
                  <span className="text-sm text-stone-700">{u.firstName} {u.lastName}</span>
                  <span className="text-xs text-stone-400">{u.jobTitle}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-medium transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : project ? 'Enregistrer' : 'Créer le projet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
