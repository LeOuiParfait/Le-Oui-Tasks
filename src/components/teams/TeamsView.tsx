import React, { useState } from 'react';
import {
  Users, Plus, X, Trash2, UserPlus, UserMinus, Crown, Mail, Briefcase, Loader2, Pencil
} from 'lucide-react';
import { Team, User, UserRole } from '../../types';

interface TeamsViewProps {
  teams: Team[];
  users: User[];
  currentUser: User;
  onCreateTeam: (data: Omit<Team, 'id' | 'organizationId' | 'createdAt'>) => Promise<Team>;
  onUpdateTeam: (teamId: string, updates: Partial<Team>) => Promise<void>;
  onDeleteTeam: (teamId: string) => Promise<void>;
  onAddMember: (teamId: string, userId: string) => Promise<void>;
  onRemoveMember: (teamId: string, userId: string) => Promise<void>;
}

const TEAM_COLORS = ['#887D93', '#6b5f78', '#a89db4', '#5b6b8c', '#8c6b5b', '#5b8c6b', '#8c5b6b', '#6b8c5b'];

export const TeamsView: React.FC<TeamsViewProps> = ({
  teams, users, currentUser, onCreateTeam, onUpdateTeam, onDeleteTeam, onAddMember, onRemoveMember
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [managingTeam, setManagingTeam] = useState<Team | null>(null);

  const canManage = currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'team_lead';

  const getManager = (team: Team) => users.find((u) => u.id === team.managerId);
  const getMembers = (team: Team) => team.memberIds.map((id) => users.find((u) => u.id === id)).filter(Boolean) as User[];

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight">Équipes</h1>
          <p className="text-xs text-stone-500 mt-0.5">Gérez vos équipes, leurs membres et leurs responsables.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-brand hover:bg-brand-dark text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Équipe</span>
          </button>
        )}
      </div>

      {teams.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <Users className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-500">Aucune équipe pour le moment.</p>
          {canManage && <p className="text-xs text-stone-400 mt-1">Cliquez sur « Nouvelle Équipe » pour commencer.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {teams.map((team) => {
            const manager = getManager(team);
            const members = getMembers(team);
            return (
              <div key={team.id} className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: team.color || '#887D93' }}>
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-stone-900">{team.name}</h3>
                      <p className="text-xs text-stone-500 line-clamp-1">{team.description || 'Aucune description'}</p>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditingTeam(team)} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors" title="Modifier">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm(`Supprimer l'équipe « ${team.name} » ?`)) onDeleteTeam(team.id); }} className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Supprimer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {manager && (
                    <div className="flex items-center gap-2 text-xs">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      <span className="font-semibold text-stone-700">{manager.firstName} {manager.lastName}</span>
                      <span className="text-stone-400">· Responsable</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <Users className="w-3.5 h-3.5" />
                    <span>{members.length} membre{members.length > 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-stone-100">
                  {members.slice(0, 6).map((m) => (
                    <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-stone-50 text-xs">
                      {m.avatar ? (
                        <img src={m.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center text-white text-[10px] font-semibold">
                          {m.firstName.charAt(0)}{m.lastName.charAt(0)}
                        </div>
                      )}
                      <span className="text-stone-700 font-medium">{m.firstName} {m.lastName.charAt(0)}.</span>
                    </div>
                  ))}
                  {members.length > 6 && (
                    <div className="px-2 py-1 rounded-lg bg-stone-50 text-xs text-stone-500 font-medium">
                      +{members.length - 6}
                    </div>
                  )}
                </div>

                {canManage && (
                  <button
                    onClick={() => setManagingTeam(team)}
                    className="text-xs font-medium text-brand hover:text-brand-dark transition-colors flex items-center gap-1.5 self-start"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Gérer les membres
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <TeamFormModal
          users={users}
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
          onSubmit={async (data) => { await onCreateTeam(data); setShowCreateModal(false); }}
        />
      )}

      {editingTeam && (
        <TeamFormModal
          team={editingTeam}
          users={users}
          currentUser={currentUser}
          onClose={() => setEditingTeam(null)}
          onSubmit={async (data) => { await onUpdateTeam(editingTeam.id, data); setEditingTeam(null); }}
        />
      )}

      {managingTeam && (
        <ManageMembersModal
          team={managingTeam}
          users={users}
          onClose={() => setManagingTeam(null)}
          onAddMember={onAddMember}
          onRemoveMember={onRemoveMember}
        />
      )}
    </div>
  );
};

// ============== Team Form Modal ==============

const TeamFormModal: React.FC<{
  team?: Team;
  users: User[];
  currentUser: User;
  onClose: () => void;
  onSubmit: (data: Omit<Team, 'id' | 'organizationId' | 'createdAt'>) => Promise<void>;
}> = ({ team, users, currentUser, onClose, onSubmit }) => {
  const [name, setName] = useState(team?.name || '');
  const [description, setDescription] = useState(team?.description || '');
  const [color, setColor] = useState(team?.color || TEAM_COLORS[0]);
  const [managerId, setManagerId] = useState(team?.managerId || '');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(team?.memberIds || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Le nom de l\'équipe est obligatoire.'); return; }
    if (!managerId) { setError('Veuillez désigner un responsable.'); return; }
    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        icon: '',
        color,
        managerId,
        memberIds: selectedMembers.includes(managerId) ? selectedMembers : [...selectedMembers, managerId]
      });
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title={team ? 'Modifier l\'équipe' : 'Nouvelle équipe'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner message={error} />}

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">Nom de l'équipe *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="form-input-base" placeholder="Ex : Équipe Design" autoFocus />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="form-input-base resize-none" placeholder="Rôle de l'équipe dans l'organisation" />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">Couleur</label>
          <div className="flex flex-wrap gap-2">
            {TEAM_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} className={`w-7 h-7 rounded-lg transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-stone-400 scale-110' : ''}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">Responsable *</label>
          <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className="form-input-base">
            <option value="">Sélectionner...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName} — {u.jobTitle || u.role}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5">Membres</label>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-stone-50 cursor-pointer">
                <input type="checkbox" checked={selectedMembers.includes(u.id)} onChange={() => toggleMember(u.id)} className="rounded border-stone-300 text-brand focus:ring-brand" />
                <div className="flex items-center gap-2 min-w-0">
                  {u.avatar ? (
                    <img src={u.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center text-white text-[10px] font-semibold">
                      {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                    </div>
                  )}
                  <span className="text-sm text-stone-700 truncate">{u.firstName} {u.lastName}</span>
                  <span className="text-xs text-stone-400 truncate">{u.jobTitle}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors">
            Annuler
          </button>
          <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : team ? 'Enregistrer' : 'Créer l\'équipe'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

// ============== Manage Members Modal ==============

const ManageMembersModal: React.FC<{
  team: Team;
  users: User[];
  onClose: () => void;
  onAddMember: (teamId: string, userId: string) => Promise<void>;
  onRemoveMember: (teamId: string, userId: string) => Promise<void>;
}> = ({ team, users, onClose, onAddMember, onRemoveMember }) => {
  const members = team.memberIds.map((id) => users.find((u) => u.id === id)).filter(Boolean) as User[];
  const nonMembers = users.filter((u) => !team.memberIds.includes(u.id));

  return (
    <ModalShell title={`Membres — ${team.name}`} onClose={onClose}>
      <div className="space-y-5">
        <div>
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Membres actuels ({members.length})</h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {members.length === 0 ? (
              <p className="text-xs text-stone-400 py-3 text-center">Aucun membre.</p>
            ) : members.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-stone-50">
                <div className="flex items-center gap-2.5 min-w-0">
                  {m.avatar ? (
                    <img src={m.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-white text-xs font-semibold">
                      {m.firstName.charAt(0)}{m.lastName.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{m.firstName} {m.lastName}</p>
                    <p className="text-xs text-stone-400 truncate">{m.email}</p>
                  </div>
                  {m.id === team.managerId && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      <Crown className="w-3 h-3" /> Responsable
                    </span>
                  )}
                </div>
                {m.id !== team.managerId && (
                  <button onClick={() => onRemoveMember(team.id, m.id)} className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Retirer">
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {nonMembers.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Ajouter un membre</h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {nonMembers.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-stone-100 hover:bg-stone-50">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {u.avatar ? (
                      <img src={u.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-stone-300 flex items-center justify-center text-white text-xs font-semibold">
                        {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-700 truncate">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-stone-400 truncate">{u.jobTitle || u.email}</p>
                    </div>
                  </div>
                  <button onClick={() => onAddMember(team.id, u.id)} className="p-1.5 rounded-lg text-brand hover:bg-brand-50 transition-colors" title="Ajouter">
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
};

// ============== Shared UI ==============

const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 sticky top-0 bg-white z-10">
        <h2 className="font-brand text-lg font-medium text-stone-900">{title}</h2>
        <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  </div>
);

const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{message}</div>
);
