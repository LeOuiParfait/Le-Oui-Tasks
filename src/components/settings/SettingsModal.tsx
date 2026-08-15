import React, { useState, useRef } from 'react';
import { Copy, X, Building2, Users, Mail, Settings, ShieldCheck, Check, Loader2, AlertCircle, UserPlus, Crown, Camera, User as UserIcon, MailCheck, Key, Shield } from 'lucide-react';
import { Organization, User, Team, UserRole } from '../../types';
import { createMemberAsAdmin, resendInvitation, sendVerificationEmail, changePassword } from '../../services/authService';
import { updateUserRole, uploadAvatar, updateUser } from '../../services/dbService';
import { isFirebaseConfigured, auth } from '../../services/firebase';
import { store } from '../../services/store';
import { RolesGuide } from './RolesGuide';

interface SettingsModalProps {
  organization: Organization;
  users: User[];
  teams: Team[];
  currentUser: User;
  onClose: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrateur',
  manager: 'Manager',
  team_lead: 'Chef d\'Équipe',
  user: 'Utilisateur',
  viewer: 'Observateur'
};

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-purple-50 text-purple-700',
  admin: 'bg-blue-50 text-blue-700',
  manager: 'bg-emerald-50 text-emerald-700',
  team_lead: 'bg-amber-50 text-amber-700',
  user: 'bg-stone-100 text-stone-600',
  viewer: 'bg-slate-100 text-slate-600'
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  organization, users, teams, currentUser, onClose
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'org' | 'users' | 'reports' | 'roles'>('profile');
  const canManageUsers = currentUser.role === 'super_admin' || currentUser.role === 'admin';
  const isSuperAdmin = currentUser.role === 'super_admin';

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full shadow-xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        <div className="px-4 sm:px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand" />
            <h2 className="font-brand text-lg font-medium text-stone-900">Paramètres</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-stone-100 px-6 bg-stone-50/30 overflow-x-auto shrink-0">
          <button onClick={() => setActiveTab('profile')} className={`px-5 py-3.5 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'profile' ? 'border-brand text-brand' : 'border-transparent text-stone-500 hover:text-stone-900'}`}>
            Mon Profil
          </button>
          {canManageUsers && (
            <>
              <button onClick={() => setActiveTab('users')} className={`px-5 py-3.5 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'users' ? 'border-brand text-brand' : 'border-transparent text-stone-500 hover:text-stone-900'}`}>
                Membres & Invitations
              </button>
              <button onClick={() => setActiveTab('roles')} className={`px-5 py-3.5 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'roles' ? 'border-brand text-brand' : 'border-transparent text-stone-500 hover:text-stone-900'}`}>
                <Shield className="w-3.5 h-3.5 inline mr-1.5" />
                Guide des Rôles
              </button>
            </>
          )}
          {isSuperAdmin && (
            <>
              <button onClick={() => setActiveTab('org')} className={`px-5 py-3.5 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'org' ? 'border-brand text-brand' : 'border-transparent text-stone-500 hover:text-stone-900'}`}>
                Entreprise
              </button>
              <button onClick={() => setActiveTab('reports')} className={`px-5 py-3.5 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'reports' ? 'border-brand text-brand' : 'border-transparent text-stone-500 hover:text-stone-900'}`}>
                Rapports
              </button>
            </>
          )}
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 no-scrollbar text-xs">
          {activeTab === 'profile' ? (
            <ProfileTab currentUser={currentUser} />
          ) : activeTab === 'users' && canManageUsers ? (
            <UsersTab organization={organization} users={users} currentUser={currentUser} />
          ) : activeTab === 'roles' && canManageUsers ? (
            <RolesGuide />
          ) : activeTab === 'org' && isSuperAdmin ? (
            <OrgTab organization={organization} />
          ) : activeTab === 'reports' && isSuperAdmin ? (
            <ReportsTab organization={organization} />
          ) : (
            <ProfileTab currentUser={currentUser} />
          )}
        </div>
      </div>
    </div>
  );
};

// ============== PROFILE TAB (Avatar Upload) ==============

const ProfileTab: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [firstName, setFirstName] = useState(currentUser.firstName);
  const [lastName, setLastName] = useState(currentUser.lastName);
  const [jobTitle, setJobTitle] = useState(currentUser.jobTitle);
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fbUser = auth?.currentUser;
  const emailVerified = fbUser?.emailVerified ?? false;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('L\'image ne doit pas dépasser 2 Mo.'); return; }
    if (!file.type.startsWith('image/')) { setError('Veuillez sélectionner un fichier image.'); return; }
    setError(null);
    setUploading(true);
    try {
      await store.uploadAvatar(file);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await store.updateCurrentUserProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        jobTitle: jobTitle.trim()
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-stone-900 mb-3">Photo de profil</h3>
        <div className="flex items-center gap-4">
          <div className="relative">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt="" className="w-20 h-20 rounded-full object-cover border border-stone-200" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center text-white text-2xl font-semibold border border-stone-200">
                {currentUser.firstName.charAt(0)}{currentUser.lastName.charAt(0)}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-white border border-stone-200 shadow-sm flex items-center justify-center text-stone-600 hover:text-brand transition-colors disabled:opacity-50"
              title="Changer la photo"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </div>
          <div>
            <p className="text-xs text-stone-600 font-medium">{currentUser.firstName} {currentUser.lastName}</p>
            <p className="text-xs text-stone-400">{currentUser.email}</p>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="mt-1 text-xs text-brand font-medium hover:underline disabled:opacity-50">
              {uploading ? 'Upload en cours...' : 'Changer la photo'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-stone-100">
        <h3 className="text-sm font-bold text-stone-900">Informations personnelles</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Prénom</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="form-input-base" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Nom</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="form-input-base" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Poste</label>
          <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="form-input-base" />
        </div>
        <button onClick={handleSaveProfile} disabled={savingProfile} className="px-4 py-2 bg-brand hover:bg-brand-dark text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
          {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Enregistrer
        </button>
      </div>

      {/* Email Verification Section */}
      <div className="space-y-3 pt-4 border-t border-stone-100">
        <h3 className="text-sm font-bold text-stone-900">Vérification email</h3>
        <div className="flex items-center justify-between p-3 rounded-lg border border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2">
            {emailVerified ? (
              <>
                <MailCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs text-emerald-700 font-medium">Email vérifié</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span className="text-xs text-amber-700 font-medium">Email non vérifié</span>
              </>
            )}
          </div>
          {!emailVerified && (
            <button
              onClick={async () => {
                setSendingVerification(true);
                setError(null);
                try {
                  await sendVerificationEmail();
                  setSuccess(true);
                  setTimeout(() => setSuccess(false), 3000);
                } catch (err: any) {
                  setError(err.message || 'Erreur lors de l\'envoi.');
                } finally {
                  setSendingVerification(false);
                }
              }}
              disabled={sendingVerification}
              className="px-3 py-1.5 bg-brand hover:bg-brand-dark text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {sendingVerification ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
              Envoyer email
            </button>
          )}
        </div>
      </div>

      {/* Change Password Section */}
      <div className="space-y-3 pt-4 border-t border-stone-100">
        <h3 className="text-sm font-bold text-stone-900">Changer le mot de passe</h3>
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Mot de passe actuel</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="form-input-base"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Nouveau mot de passe</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="form-input-base"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Confirmer nouveau mot de passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="form-input-base"
              placeholder="••••••••"
            />
          </div>
          <button
            onClick={async () => {
              setError(null);
              if (!currentPassword || !newPassword || !confirmPassword) {
                setError('Veuillez remplir tous les champs.');
                return;
              }
              if (newPassword !== confirmPassword) {
                setError('Les mots de passe ne correspondent pas.');
                return;
              }
              if (newPassword.length < 6) {
                setError('Le nouveau mot de passe doit contenir au moins 6 caractères.');
                return;
              }
              setChangingPassword(true);
              try {
                await changePassword(currentPassword, newPassword);
                setSuccess(true);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setTimeout(() => setSuccess(false), 3000);
              } catch (err: any) {
                setError(err.message || 'Erreur lors du changement de mot de passe.');
              } finally {
                setChangingPassword(false);
              }
            }}
            disabled={changingPassword}
            className="px-4 py-2 bg-brand hover:bg-brand-dark text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {changingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
            Changer le mot de passe
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-2"><Check className="w-4 h-4" /> Enregistré avec succès.</div>}
    </div>
  );
};

// ============== USERS TAB ==============

const UsersTab: React.FC<{ organization: Organization; users: User[]; currentUser: User }> = ({
  organization,
  users,
  currentUser
}) => {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Invite form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const inviteAvatarInputRef = useRef<HTMLInputElement>(null);

  // Role editing
  const [editingRoleFor, setEditingRoleFor] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  const [resendingFor, setResendingFor] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setInviteError('L\'image ne doit pas dépasser 2 Mo.'); return; }
    if (!file.type.startsWith('image/')) { setInviteError('Veuillez sélectionner un fichier image.'); return; }
    setInviteError(null);
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setInviteError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (password.length < 8) {
      setInviteError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      setInviteError('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.');
      return;
    }

    setInviting(true);
    try {
      const newMember = await createMemberAsAdmin(
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          jobTitle: jobTitle.trim() || 'Membre d\'équipe',
          role
        },
        organization.id
      );

      // Upload avatar if one was selected
      if (avatarFile && isFirebaseConfigured) {
        try {
          const avatarUrl = await uploadAvatar(newMember.id, avatarFile);
          await updateUser(newMember.id, { avatar: avatarUrl });
        } catch (uploadErr) {
          console.error('[Invite] Erreur upload avatar:', uploadErr);
        }
      }

      // Generate custom reset link
      try {
        const result = await resendInvitation(newMember.email, newMember.firstName, newMember.id);
        if (result.link && !result.emailSent) {
          setCopiedLink(result.link);
          setInviteSuccess(`${firstName} ${lastName} a été ajouté(e). E-mail non envoyé — copiez le lien ci-dessous.`);
        } else {
          setInviteSuccess(`${firstName} ${lastName} a été ajouté(e). Un e-mail de connexion a été envoyé.`);
        }
      } catch (err: any) {
        setInviteError('Compte créé, mais échec de l\'envoi du lien : ' + err.message);
      }
      // Reset form
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setJobTitle('');
      setRole('user');
      setAvatarFile(null);
      setAvatarPreview(null);
      setShowInviteForm(false);
      setTimeout(() => setInviteSuccess(null), 5000);
    } catch (err: any) {
      setInviteError(err.message || 'Erreur lors de la création du compte.');
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    setSavingRole(true);
    try {
      await updateUserRole(userId, newRole);
      setEditingRoleFor(null);
    } catch (err: any) {
      console.error('Erreur changement de rôle:', err);
    } finally {
      setSavingRole(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Invite button / form */}
      {inviteSuccess && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2.5">
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{inviteSuccess}</span>
        </div>
      )}

      {copiedLink && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
          <p className="text-xs font-semibold">Lien d'activation (copiez-le et envoyez-le manuellement si l'email n'est pas arrivé) :</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={copiedLink}
              className="flex-1 bg-white border border-amber-300 rounded px-2 py-1.5 text-[11px] text-stone-700 truncate"
            />
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(copiedLink);
                  setInviteSuccess('Lien copié dans le presse-papiers.');
                  setTimeout(() => setInviteSuccess(null), 3000);
                } catch {
                  setInviteError('Impossible de copier automatiquement.');
                }
              }}
              className="flex items-center gap-1 px-2 py-1.5 bg-brand hover:bg-brand-dark text-white text-[11px] font-medium rounded"
            >
              <Copy className="w-3 h-3" />
              Copier
            </button>
          </div>
        </div>
      )}

      {!showInviteForm ? (
        <button
          onClick={() => setShowInviteForm(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg transition-colors shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>Inviter un membre</span>
        </button>
      ) : (
        <form onSubmit={handleInvite} className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-stone-800 text-sm">Nouveau membre</span>
            <button type="button" onClick={() => setShowInviteForm(false)} className="text-stone-400 hover:text-stone-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {inviteError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{inviteError}</span>
            </div>
          )}

          {/* Avatar upload */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="w-14 h-14 rounded-full object-cover border border-stone-200" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 border border-stone-200">
                  <Camera className="w-5 h-5" />
                </div>
              )}
              <button
                type="button"
                onClick={() => inviteAvatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-white border border-stone-200 shadow-sm flex items-center justify-center text-stone-600 hover:text-brand transition-colors"
                title="Ajouter une photo"
              >
                <Camera className="w-3 h-3" />
              </button>
              <input ref={inviteAvatarInputRef} type="file" accept="image/*" onChange={handleAvatarFileChange} className="hidden" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-stone-700">Photo de profil</p>
              <p className="text-[10px] text-stone-400">Optionnel. JPG ou PNG, max 2 Mo.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">Prénom *</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs" placeholder="Prénom" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">Nom *</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs" placeholder="Nom" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">E-mail *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs" placeholder="collegue@entreprise.com" />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">Mot de passe temporaire *</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs" placeholder="Min. 6 caractères" />
            <p className="text-[10px] text-stone-400 mt-1">Le membre pourra le changer après sa première connexion.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">Poste</label>
              <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs" placeholder="Développeur" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">Rôle</label>
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs">
                <option value="user">Utilisateur</option>
                <option value="team_lead">Chef d'équipe</option>
                <option value="manager">Manager</option>
                <option value="admin">Administrateur</option>
                <option value="viewer">Observateur</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={inviting} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-semibold rounded-lg transition-colors text-xs">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-3.5 h-3.5" /><span>Créer le compte</span></>}
          </button>
        </form>
      )}

      {/* Members list */}
      <div className="space-y-2">
        <span className="font-bold text-stone-500 uppercase block text-[11px]">Membres ({users.length})</span>
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-100">
            <div className="flex items-center gap-2.5 min-w-0">
              {u.avatar ? (
                <img src={u.avatar} alt={u.firstName} className="w-8 h-8 rounded-full object-cover border border-stone-200" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-semibold">
                  {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-stone-900 text-xs">{u.firstName} {u.lastName}</span>
                  {u.id === currentUser.id && <span className="text-[10px] text-stone-400">(vous)</span>}
                  {u.role === 'super_admin' && <Crown className="w-3 h-3 text-amber-500" />}
                </div>
                <p className="text-[10px] text-stone-500 truncate">{u.email}</p>
              </div>
            </div>

            {/* Role badge / selector */}
            {u.role === 'super_admin' ? (
              <span className={`text-[10px] font-medium px-2 py-1 rounded ${ROLE_COLORS[u.role]}`}>
                {ROLE_LABELS[u.role]}
              </span>
            ) : editingRoleFor === u.id ? (
              <div className="flex items-center gap-1.5">
                <select
                  defaultValue={u.role}
                  disabled={savingRole}
                  onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                  className="text-[10px] border border-stone-200 rounded px-2 py-1 bg-white"
                >
                  <option value="user">Utilisateur</option>
                  <option value="team_lead">Chef d'équipe</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Administrateur</option>
                  <option value="viewer">Observateur</option>
                </select>
                <button onClick={() => setEditingRoleFor(null)} className="text-stone-400 hover:text-stone-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setEditingRoleFor(u.id)}
                  className={`text-[10px] font-medium px-2 py-1 rounded hover:ring-2 hover:ring-brand-100 transition-all ${ROLE_COLORS[u.role]}`}
                  title="Cliquer pour modifier le rôle"
                >
                  {ROLE_LABELS[u.role]}
                </button>
                <button
                  onClick={async () => {
                    if (!u.email) return;
                    setResendingFor(u.id);
                    try {
                      const result = await resendInvitation(u.email, u.firstName, u.id);
                      if (result.link) {
                        setCopiedLink(result.link);
                        setInviteSuccess(result.emailSent
                          ? `Invitation envoyée à ${u.email}`
                          : `Lien généré pour ${u.email} (email non envoyé - copiez-le ci-dessous)`);
                      } else {
                        setInviteSuccess(`Invitation renvoyée à ${u.email}`);
                      }
                      setTimeout(() => { setInviteSuccess(null); setCopiedLink(null); }, 10000);
                    } catch (err: any) {
                      setInviteError(err.message || 'Erreur lors du renvoi.');
                    } finally {
                      setResendingFor(null);
                    }
                  }}
                  disabled={resendingFor === u.id || u.id === currentUser.id}
                  title="Générer un lien d'activation"
                  className="text-[10px] text-brand hover:text-brand-dark font-medium disabled:opacity-50"
                >
                  {resendingFor === u.id ? 'Génération...' : 'Renvoyer'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============== ORG TAB ==============

const OrgTab: React.FC<{ organization: Organization }> = ({ organization }) => {
  const [orgName, setOrgName] = useState(organization.name);
  const [orgIndustry, setOrgIndustry] = useState(organization.industry);
  const [orgTimezone, setOrgTimezone] = useState(organization.timezone);
  const [workingHours, setWorkingHours] = useState(() => {
    // Rétrocompatibilité : si ancien format, créer le nouveau
    const wh = organization.workingHours as any;
    if (wh?.monday) return wh;
    // Ancien format
    return {
      monday:    { enabled: true,  start: wh?.start || '09:00', end: wh?.end || '18:00' },
      tuesday:   { enabled: true,  start: wh?.start || '09:00', end: wh?.end || '18:00' },
      wednesday: { enabled: true,  start: wh?.start || '09:00', end: wh?.end || '18:00' },
      thursday:  { enabled: true,  start: wh?.start || '09:00', end: wh?.end || '18:00' },
      friday:    { enabled: true,  start: wh?.start || '09:00', end: wh?.end || '18:00' },
      saturday:  { enabled: false, start: '09:00', end: '13:00' },
      sunday:    { enabled: false, start: '09:00', end: '17:00' }
    };
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const DAY_LABELS_FR = [
    { key: 'monday', label: 'Lundi' },
    { key: 'tuesday', label: 'Mardi' },
    { key: 'wednesday', label: 'Mercredi' },
    { key: 'thursday', label: 'Jeudi' },
    { key: 'friday', label: 'Vendredi' },
    { key: 'saturday', label: 'Samedi' },
    { key: 'sunday', label: 'Dimanche' }
  ];

  const updateDay = (dayKey: string, field: string, value: any) => {
    setWorkingHours((prev: any) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [field]: value }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await store.updateOrganization({
        name: orgName,
        industry: orgIndustry,
        timezone: orgTimezone,
        workingHours: workingHours as any
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block font-bold text-stone-700 uppercase mb-1 text-xs">Nom de l'Entreprise</label>
        <input
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          className="w-full border border-stone-200 rounded-xl p-2.5 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-bold text-stone-700 uppercase mb-1 text-xs">Fuseau Horaire</label>
          <select
            value={orgTimezone}
            onChange={(e) => setOrgTimezone(e.target.value)}
            className="w-full border border-stone-200 rounded-xl p-2.5 font-medium text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
          >
            <option value="Europe/Paris">Europe/Paris (CET)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
            <option value="America/New_York">America/New_York (EST)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
            <option value="Africa/Douala">Africa/Douala (WAT)</option>
            <option value="Africa/Casablanca">Africa/Casablanca (WET)</option>
            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
            <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
          </select>
        </div>
        <div>
          <label className="block font-bold text-stone-700 uppercase mb-1 text-xs">Secteur</label>
          <input
            type="text"
            value={orgIndustry}
            onChange={(e) => setOrgIndustry(e.target.value)}
            className="w-full border border-stone-200 rounded-xl p-2.5 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Heures de travail par jour */}
      <div>
        <label className="block font-bold text-stone-700 uppercase mb-2 text-xs">Heures de Travail par Jour</label>
        <p className="text-[11px] text-stone-400 mb-3">
          Définissez les plages horaires pour chaque jour. Les users ne pourront pointer que pendant ces plages.
        </p>
        <div className="space-y-2">
          {DAY_LABELS_FR.map(({ key, label }) => {
            const day = (workingHours as any)[key];
            return (
              <div
                key={key}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  day.enabled ? 'bg-white border-stone-200' : 'bg-stone-50 border-stone-100'
                }`}
              >
                {/* Toggle */}
                <button
                  onClick={() => updateDay(key, 'enabled', !day.enabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                    day.enabled ? 'bg-brand' : 'bg-stone-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      day.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                {/* Jour */}
                <span className={`text-sm font-medium w-24 shrink-0 ${day.enabled ? 'text-stone-900' : 'text-stone-400'}`}>
                  {label}
                </span>
                {/* Heures */}
                <div className={`flex items-center gap-2 ${day.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
                  <input
                    type="time"
                    value={day.start}
                    onChange={(e) => updateDay(key, 'start', e.target.value)}
                    className="border border-stone-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <span className="text-stone-400 text-xs">→</span>
                  <input
                    type="time"
                    value={day.end}
                    onChange={(e) => updateDay(key, 'end', e.target.value)}
                    className="border border-stone-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
          <Check className="w-4 h-4" />
          Paramètres enregistrés avec succès !
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        <span>{saving ? 'Sauvegarde...' : 'Enregistrer les paramètres'}</span>
      </button>
    </div>
  );
};

// ============== REPORTS TAB ==============

const ReportsTab: React.FC<{ organization: Organization }> = ({ organization }) => {
  const [recipients, setRecipients] = useState(organization.reportEmailRecipients.join('\n'));
  const [includeAdmins, setIncludeAdmins] = useState(organization.includeAdminsInReports ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    const emails = recipients
      .split('\n')
      .map(e => e.trim())
      .filter(e => e.length > 0);

    // Validation simple
    const invalid = emails.find(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (invalid) {
      setError(`E-mail invalide : ${invalid}`);
      return;
    }

    setSaving(true);
    try {
      await store.updateOrganization({ reportEmailRecipients: emails, includeAdminsInReports: includeAdmins });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block font-bold text-stone-700 uppercase mb-1 text-xs">Destinataires des Rapports Quotidiens</label>
        <textarea
          rows={5}
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          className="w-full border border-stone-200 rounded-xl p-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
          placeholder="exemple@entreprise.com"
        />
        <p className="text-[11px] text-stone-400 mt-1">
          Un e-mail par ligne. Les rapports seront envoyés à ces adresses.
        </p>
      </div>

      <div className="flex items-start gap-3 p-3 rounded-lg bg-stone-50 border border-stone-200">
        <input
          id="include-admins"
          type="checkbox"
          checked={includeAdmins}
          onChange={(e) => setIncludeAdmins(e.target.checked)}
          className="mt-0.5 w-4 h-4 text-brand border-stone-300 rounded focus:ring-brand"
        />
        <label htmlFor="include-admins" className="text-xs text-stone-700">
          <span className="font-semibold">Inclure automatiquement les e-mails des admins</span>
          <span className="block text-stone-500">Les rapports seront également envoyés à tous les utilisateurs avec le rôle admin ou super admin.</span>
        </label>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
          <Check className="w-4 h-4" />
          Destinataires mis à jour avec succès !
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        <span>{saving ? 'Sauvegarde...' : 'Enregistrer les destinataires'}</span>
      </button>
    </div>
  );
};
