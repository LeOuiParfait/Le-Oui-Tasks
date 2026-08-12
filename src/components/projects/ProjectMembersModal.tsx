import React, { useState, useEffect } from 'react';
import { X, Crown, UserCog, User as UserIcon, Eye, UserPlus, Trash2, Loader2, Shield } from 'lucide-react';
import { Project, User, ProjectRole, ProjectMember } from '../../types';
import { canManageProjectMembers } from '../../services/permissions';

interface ProjectMembersModalProps {
  project: Project;
  users: User[];
  currentUser: User;
  onClose: () => void;
  onUpdateMembers: (members: ProjectMember[], ownerId: string) => Promise<void>;
}

const ROLE_LABELS: Record<ProjectRole, string> = {
  owner: 'Propriétaire',
  lead: 'Chef de projet',
  contributor: 'Contributeur',
  viewer: 'Observateur'
};

const ROLE_COLORS: Record<ProjectRole, string> = {
  owner: 'bg-amber-50 text-amber-700 border-amber-200',
  lead: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  contributor: 'bg-stone-100 text-stone-700 border-stone-200',
  viewer: 'bg-slate-100 text-slate-600 border-slate-200'
};

const ROLE_ICONS: Record<ProjectRole, React.ReactNode> = {
  owner: <Crown className="w-3 h-3" />,
  lead: <UserCog className="w-3 h-3" />,
  contributor: <UserIcon className="w-3 h-3" />,
  viewer: <Eye className="w-3 h-3" />
};

const ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  owner: 'Contrôle total sur le projet',
  lead: 'Gère l\'équipe et les tâches du projet',
  contributor: 'Crée et édite des tâches',
  viewer: 'Lecture seule (ne peut rien modifier)'
};

export const ProjectMembersModal: React.FC<ProjectMembersModalProps> = ({
  project, users, currentUser, onClose, onUpdateMembers
}) => {
  const [members, setMembers] = useState<ProjectMember[]>(project.members);
  const [ownerId, setOwnerId] = useState(project.ownerId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canManage = canManageProjectMembers(currentUser, project);

  // Map userId -> role (pour faciliter l'accès)
  const memberRoleMap: Record<string, ProjectRole> = {};
  members.forEach(m => {
    memberRoleMap[m.userId] = m.userId === ownerId ? 'owner' : m.role;
  });

  const isMember = (userId: string) => members.some(m => m.userId === userId);

  const handleAddMember = (userId: string) => {
    if (isMember(userId)) return;
    setMembers(prev => [
      ...prev,
      {
        userId,
        role: 'contributor',
        addedAt: new Date().toISOString()
      }
    ]);
  };

  const handleRemoveMember = (userId: string) => {
    if (userId === ownerId) return; // Ne pas retirer l'owner
    setMembers(prev => prev.filter(m => m.userId !== userId));
  };

  const handleChangeRole = (userId: string, newRole: ProjectRole) => {
    if (userId === ownerId) return; // L'owner ne change pas
    setMembers(prev => prev.map(m =>
      m.userId === userId ? { ...m, role: newRole } : m
    ));
  };

  const handleChangeOwner = (newOwnerId: string) => {
    if (newOwnerId === ownerId) return;
    const oldOwnerId = ownerId;
    setOwnerId(newOwnerId);
    // S'assurer que le nouvel owner est dans les membres
    setMembers(prev => {
      const exists = prev.some(m => m.userId === newOwnerId);
      let updated = prev;
      if (!exists) {
        updated = [...updated, { userId: newOwnerId, role: 'contributor', addedAt: new Date().toISOString() }];
      }
      // L'ancien owner devient 'lead' s'il est toujours membre
      return updated.map(m => {
        if (m.userId === newOwnerId) return { ...m, role: 'owner' };
        if (m.userId === oldOwnerId) return { ...m, role: 'lead' };
        return m;
      });
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Construire la liste finale avec les bons rôles
      const finalMembers = members.map(m => ({
        ...m,
        role: (m.userId === ownerId ? 'owner' : m.role) as ProjectRole
      }));
      await onUpdateMembers(finalMembers, ownerId);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  // Utilisateurs non membres (pour ajout)
  const nonMembers = users.filter(u => !isMember(u.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2 min-w-0">
            <UserCog className="w-5 h-5 text-brand shrink-0" />
            <div className="min-w-0">
              <h2 className="font-brand text-lg font-medium text-stone-900 truncate">Membres du projet</h2>
              <p className="text-xs text-stone-500 truncate">{project.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {!canManage && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <Shield className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Vous avez accès en lecture seule. Seuls le propriétaire, les chefs de projet et les administrateurs peuvent modifier les membres.</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center gap-2">
              <UserCog className="w-4 h-4" /> Membres mis à jour avec succès !
            </div>
          )}

          {/* Propriétaire du projet */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-2 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              Propriétaire du projet
            </label>
            <select
              value={ownerId}
              onChange={(e) => canManage && handleChangeOwner(e.target.value)}
              disabled={!canManage}
              className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm disabled:bg-stone-50 disabled:cursor-not-allowed"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} — {u.jobTitle || u.role}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-stone-400 mt-1">
              Le propriétaire a un contrôle total. Changer le propriétaire transfère toutes les permissions.
            </p>
          </div>

          {/* Liste des membres actuels */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-stone-700">
                Membres actuels ({members.length})
              </label>
            </div>
            <div className="space-y-2">
              {members.length === 0 ? (
                <div className="p-4 text-center text-xs text-stone-400 bg-stone-50 rounded-lg border border-stone-200">
                  Aucun membre. Ajoutez-en ci-dessous.
                </div>
              ) : (
                members.map((m) => {
                  const user = users.find(u => u.id === m.userId);
                  if (!user) return null;
                  const isOwner = m.userId === ownerId;
                  const role: ProjectRole = isOwner ? 'owner' : m.role;
                  return (
                    <div
                      key={m.userId}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isOwner ? 'bg-amber-50/40 border-amber-200' : 'bg-white border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.firstName} className="w-9 h-9 rounded-full object-cover border border-stone-200" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white text-xs font-semibold border border-stone-200">
                            {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                          </div>
                        )}
                        <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                          isOwner ? 'bg-amber-500' : role === 'lead' ? 'bg-emerald-500' : role === 'viewer' ? 'bg-slate-400' : 'bg-stone-300'
                        }`}>
                          <span className="text-white text-[8px]">
                            {isOwner ? '★' : ''}
                          </span>
                        </span>
                      </div>

                      {/* Nom + email */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-stone-900 truncate">
                            {user.firstName} {user.lastName}
                          </span>
                          {user.id === currentUser.id && (
                            <span className="text-[10px] text-stone-400">(vous)</span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 truncate">{user.email}</p>
                      </div>

                      {/* Sélecteur de rôle */}
                      {isOwner ? (
                        <span className={`text-[10px] font-medium px-2 py-1 rounded border flex items-center gap-1 shrink-0 ${ROLE_COLORS.owner}`}>
                          {ROLE_ICONS.owner}
                          {ROLE_LABELS.owner}
                        </span>
                      ) : canManage ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            value={role}
                            onChange={(e) => handleChangeRole(m.userId, e.target.value as ProjectRole)}
                            className={`text-[10px] font-medium px-2 py-1 rounded border focus:outline-none focus:ring-1 focus:ring-brand ${ROLE_COLORS[role]}`}
                          >
                            <option value="lead">Chef de projet</option>
                            <option value="contributor">Contributeur</option>
                            <option value="viewer">Observateur</option>
                          </select>
                          <button
                            onClick={() => handleRemoveMember(m.userId)}
                            className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Retirer du projet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className={`text-[10px] font-medium px-2 py-1 rounded border flex items-center gap-1 shrink-0 ${ROLE_COLORS[role]}`}>
                          {ROLE_ICONS[role]}
                          {ROLE_LABELS[role]}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Ajouter de nouveaux membres */}
          {canManage && nonMembers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-2 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-brand" />
                Ajouter des membres
              </label>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100">
                {nonMembers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleAddMember(u.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-stone-50 transition-colors text-left"
                  >
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.firstName} className="w-7 h-7 rounded-full object-cover border border-stone-200" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 text-[10px] font-semibold">
                        {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-stone-700 block truncate">{u.firstName} {u.lastName}</span>
                      <span className="text-xs text-stone-400 truncate block">{u.jobTitle || u.email}</span>
                    </div>
                    <UserPlus className="w-4 h-4 text-stone-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Légende des rôles */}
          <div className="bg-stone-50 rounded-lg border border-stone-200 p-3">
            <p className="text-[11px] font-semibold text-stone-700 mb-2">Comprendre les rôles projet</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-stone-600">
              {(Object.keys(ROLE_LABELS) as ProjectRole[]).map(r => (
                <div key={r} className="flex items-start gap-1.5">
                  <span className={`shrink-0 mt-0.5 ${ROLE_COLORS[r].split(' ')[1]}`}>
                    {ROLE_ICONS[r]}
                  </span>
                  <div>
                    <span className="font-semibold">{ROLE_LABELS[r]}</span>
                    <span className="text-stone-400"> — {ROLE_DESCRIPTIONS[r]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          {canManage && (
            <div className="flex gap-2 pt-2 sticky bottom-0 bg-white pb-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserCog className="w-4 h-4" />Enregistrer</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
