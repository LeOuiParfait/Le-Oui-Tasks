import React, { useState } from 'react';
import { useAuth } from '../../services/AuthContext';
import { isFirebaseConfigured } from '../../services/firebase';
import { Mail, Lock, User as UserIcon, Building2, Briefcase, Eye, EyeOff, AlertCircle, Loader2, ArrowRight, Rocket, Check } from 'lucide-react';

type Mode = 'signin' | 'reset';

export const AuthScreen: React.FC = () => {
  const { systemInitialized } = useAuth();

  if (systemInitialized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 text-stone-400 animate-spin" />
          <p className="text-sm text-stone-400 font-medium">Vérification...</p>
        </div>
      </div>
    );
  }

  if (!systemInitialized) {
    return <SetupScreen />;
  }

  return <LoginScreen />;
};

// ============== SHARED BRANDING ==============

const BrandLogo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <img src="/logo-horizontal.png" alt="Le Oui Parfait" className={`h-10 w-auto ${className}`} />
);

// ============== SETUP SCREEN ==============

const SetupScreen: React.FC = () => {
  const { setupSystem, loading, error, clearError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [industry, setIndustry] = useState('');

  const displayError = error || localError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!isFirebaseConfigured) {
      setLocalError('Firebase n\'est pas configuré. Ajoutez les variables VITE_FIREBASE_* dans le fichier .env.');
      return;
    }

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !organizationName.trim()) {
      setLocalError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    try {
      await setupSystem({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        jobTitle: jobTitle.trim() || 'Administrateur',
        organizationName: organizationName.trim(),
        industry: industry.trim()
      });
    } catch {
      // Error is set in context
    }
  };

  return (
    <div className="min-h-screen flex bg-stone-50">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-brand flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
        }} />

        <div className="relative z-10">
          <BrandLogo className="brightness-0 invert h-12" />
        </div>

        <div className="relative z-10 space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15">
            <Rocket className="w-3.5 h-3.5 text-stone-300" />
            <span className="text-xs font-medium text-stone-300 tracking-wide">Configuration initiale</span>
          </div>
          <div>
            <h1 className="font-brand text-4xl font-light text-white leading-tight tracking-tight">
              Bienvenue.<br />
              <span className="font-normal">Configurez votre espace.</span>
            </h1>
            <p className="text-stone-300 text-base leading-relaxed max-w-md mt-4">
              Cette étape ne se fait qu'une seule fois. Créez le compte administrateur et l'organisation de votre entreprise, puis invitez vos collaborateurs.
            </p>
          </div>
        </div>

        <div className="relative z-10 text-xs text-stone-300">
          © {new Date().getFullYear()} Le Oui Parfait. Tous droits réservés.
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          <div className="lg:hidden mb-8">
            <BrandLogo />
          </div>

          <div className="mb-8">
            <h2 className="font-brand text-2xl font-medium text-stone-900 tracking-tight">Configuration initiale</h2>
            <p className="text-sm text-stone-500 mt-2">
              Créez le compte administrateur et l'organisation de votre entreprise.
            </p>
          </div>

          {displayError && <ErrorBanner message={displayError} />}
          {!isFirebaseConfigured && <FirebaseWarning />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Prénom" icon={<UserIcon className="w-4 h-4" />}>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="form-input" placeholder="Nizar" autoComplete="given-name" />
              </FormField>
              <FormField label="Nom" icon={<UserIcon className="w-4 h-4" />}>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="form-input" placeholder="Ali" autoComplete="family-name" />
              </FormField>
            </div>

            <FormField label="E-mail" icon={<Mail className="w-4 h-4" />}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" placeholder="vous@entreprise.com" autoComplete="email" required />
            </FormField>

            <FormField label="Mot de passe" icon={<Lock className="w-4 h-4" />} trailing={
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-stone-400 hover:text-stone-600 transition-colors" tabIndex={-1}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="form-input pr-10" placeholder="••••••••" autoComplete="new-password" required />
            </FormField>

            <FormField label="Nom de l'organisation" icon={<Building2 className="w-4 h-4" />}>
              <input type="text" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} className="form-input" placeholder="Le Oui Parfait" />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Poste" icon={<Briefcase className="w-4 h-4" />}>
                <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="form-input" placeholder="Directeur" />
              </FormField>
              <FormField label="Secteur (optionnel)" icon={<Building2 className="w-4 h-4" />}>
                <input type="text" value={industry} onChange={(e) => setIndustry(e.target.value)} className="form-input" placeholder="Événementiel" />
              </FormField>
            </div>

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg px-4 py-2.5 transition-colors mt-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  <span>Configurer le système</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-xs text-stone-400 text-center leading-relaxed">
            Vous serez l'administrateur principal.<br />
            Vous pourrez ensuite inviter vos collaborateurs depuis les paramètres.
          </p>
        </div>
      </div>

      <FormInputStyle />
    </div>
  );
};

// ============== LOGIN SCREEN ==============

const LoginScreen: React.FC = () => {
  const { signIn, sendPasswordReset, loading, error, clearError } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const displayError = error || localError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    setResetSent(false);

    if (!isFirebaseConfigured) {
      setLocalError('Firebase n\'est pas configuré. Ajoutez les variables VITE_FIREBASE_* dans le fichier .env.');
      return;
    }

    try {
      if (mode === 'signin') {
        if (!email.trim() || !password) {
          setLocalError('Veuillez saisir votre e-mail et mot de passe.');
          return;
        }
        await signIn(email.trim(), password);
      } else if (mode === 'reset') {
        if (!email.trim()) {
          setLocalError('Veuillez saisir votre e-mail.');
          return;
        }
        await sendPasswordReset(email.trim());
        setResetSent(true);
        setMode('signin');
      }
    } catch {
      // Error is set in context
    }
  };

  return (
    <div className="min-h-screen flex bg-stone-50">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-brand flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
        }} />

        <div className="relative z-10">
          <BrandLogo className="brightness-0 invert h-12" />
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="font-brand text-4xl font-light text-white leading-tight tracking-tight">
              Gérez vos équipes<br />
              <span className="font-normal">et vos projets.</span>
            </h1>
            <p className="text-stone-300 text-base leading-relaxed max-w-md mt-4">
              Projets, tâches, présences, OKR et rapports — tout réuni dans un espace de travail clair et collaboratif.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {[
              'Tableau Kanban collaboratif en temps réel',
              'Suivi des présences et pointage',
              'Rapports quotidiens automatisés',
              'Gestion des équipes et des objectifs'
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-stone-200">
                <Check className="w-4 h-4 text-stone-400 shrink-0" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-stone-300">
          © {new Date().getFullYear()} Le Oui Parfait. Tous droits réservés.
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-sm py-8">
          <div className="lg:hidden mb-8">
            <BrandLogo />
          </div>

          <div className="mb-8">
            <h2 className="font-brand text-2xl font-medium text-stone-900 tracking-tight">
              {mode === 'signin' ? 'Connexion' : 'Mot de passe oublié'}
            </h2>
            <p className="text-sm text-stone-500 mt-2">
              {mode === 'signin'
                ? 'Accédez à votre espace de travail.'
                : 'Saisissez votre e-mail pour recevoir un lien de réinitialisation.'}
            </p>
          </div>

          {resetSent && mode === 'signin' && (
            <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-2.5">
              <Check className="w-4 h-4 mt-0.5 shrink-0" />
              <span>E-mail de réinitialisation envoyé. Vérifiez votre boîte de réception.</span>
            </div>
          )}

          {displayError && <ErrorBanner message={displayError} />}
          {!isFirebaseConfigured && <FirebaseWarning />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="E-mail" icon={<Mail className="w-4 h-4" />}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" placeholder="vous@entreprise.com" autoComplete="email" required />
            </FormField>

            {mode !== 'reset' && (
              <FormField label="Mot de passe" icon={<Lock className="w-4 h-4" />} trailing={
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-stone-400 hover:text-stone-600 transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }>
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="form-input pr-10" placeholder="••••••••" autoComplete="current-password" required />
              </FormField>
            )}

            {mode === 'signin' && (
              <div className="flex justify-end">
                <button type="button" onClick={() => { setMode('reset'); clearError(); setLocalError(null); setResetSent(false); }} className="text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors">
                  Mot de passe oublié ?
                </button>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg px-4 py-2.5 transition-colors mt-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  <span>{mode === 'signin' ? 'Se connecter' : 'Envoyer le lien'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {mode === 'reset' && (
            <div className="mt-6 text-center">
              <button onClick={() => { setMode('signin'); clearError(); setLocalError(null); setResetSent(false); }} className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors">
                ← Retour à la connexion
              </button>
            </div>
          )}

          <p className="mt-8 text-xs text-stone-400 text-center">
            Pas de compte ? Contactez votre administrateur pour une invitation.
          </p>
        </div>
      </div>

      <FormInputStyle />
    </div>
  );
};

// ============== SHARED COMPONENTS ==============

const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2.5">
    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
    <span>{message}</span>
  </div>
);

const FirebaseWarning: React.FC = () => (
  <div className="mb-5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-2.5">
    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
    <span>Variables Firebase manquantes. Configurez VITE_FIREBASE_* dans le fichier .env.</span>
  </div>
);

const FormField: React.FC<{
  label: string;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, icon, trailing, children }) => (
  <div>
    <label className="block text-xs font-medium text-stone-600 mb-1.5">{label}</label>
    <div className="relative">
      <div className="absolute left-3 top-1/2 -transtone-y-1/2 text-stone-400 pointer-events-none">
        {icon}
      </div>
      {children}
      {trailing && (
        <div className="absolute right-3 top-1/2 -transtone-y-1/2">
          {trailing}
        </div>
      )}
    </div>
  </div>
);

const FormInputStyle: React.FC = () => (
  <style>{`
    .form-input {
      width: 100%;
      border: 1px solid #e7e5e4;
      border-radius: 0.5rem;
      padding: 0.625rem 0.75rem 0.625rem 2.25rem;
      font-size: 0.875rem;
      color: #1c1917;
      background: white;
      transition: border-color 0.15s, box-shadow 0.15s;
      outline: none;
    }
    .form-input:focus {
      border-color: #887D93;
      box-shadow: 0 0 0 3px rgba(136, 125, 147, 0.12);
    }
    .form-input::placeholder {
      color: #a8a29e;
    }
  `}</style>
);
