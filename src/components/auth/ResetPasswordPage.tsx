import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Check, AlertCircle, Loader2, Eye, EyeOff, ArrowRight, Mail } from 'lucide-react';

// BrandLogo - logo horizontal en couleurs d'origine
const BrandLogo = ({ className = 'h-24' }: { className?: string }) => (
  <img src="/logo-horizontal.png" alt="LE LOUI PARFAIT" className={className} />
);

// Vidéo d'arrière-plan (identique aux pages Auth)
const AuthVideoBackground = () => (
  <>
    <video
      className="absolute inset-0 w-full h-full object-cover z-0"
      autoPlay
      muted
      loop
      playsInline
    >
      <source src="/auth-bg.mp4" type="video/mp4" />
    </video>
    <div className="absolute inset-0 bg-black/45 z-[1]" />
  </>
);

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // SÉCURITÉ : Lire le token depuis le hash fragment (non envoyé dans le header Referer)
  // Fallback sur query param pour rétrocompatibilité
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const token = hashParams.get('token') || searchParams.get('token');

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Lien invalide ou expiré. Veuillez demander un nouveau lien.');
        setLoading(false);
        return;
      }

      try {
        const origin = window.location.origin;
        const response = await fetch(`${origin}/api/auth/validate-token?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Lien invalide.');
          setLoading(false);
          return;
        }

        setEmail(data.email);
        setLoading(false);
      } catch (err) {
        console.error('[ResetPassword] Error validating token:', err);
        setError('Erreur lors de la vérification du lien.');
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || !confirmPassword) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      setError('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (!token) {
      setError('Token manquant.');
      return;
    }

    setVerifying(true);

    try {
      const origin = window.location.origin;
      const response = await fetch(`${origin}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la réinitialisation.');
      }

      setSuccess(true);

      setTimeout(() => {
        navigate('/?reset=success', { replace: true });
      }, 2000);
    } catch (err: any) {
      console.error('[ResetPassword] Error resetting password:', err);
      setError(err.message || 'Erreur lors de la réinitialisation.');
      setVerifying(false);
    }
  };

  // État : chargement (panneau plein écran centré)
  if (loading) {
    return (
      <div className="min-h-screen flex">
        {/* Panneau gauche - vidéo */}
        <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
          <AuthVideoBackground />
          <div className="relative z-10 text-center px-12">
            <BrandLogo className="h-14 mx-auto mb-6" />
            <p className="text-white/80 text-sm">Vérification de votre lien...</p>
          </div>
        </div>
        {/* Panneau droit - contenu */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-stone-50">
          <div className="w-full max-w-md">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-brand animate-spin" />
              <p className="text-stone-600 font-medium">Vérification du lien...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // État : erreur (lien invalide)
  if (error && !email) {
    return (
      <div className="min-h-screen flex">
        <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
          <AuthVideoBackground />
          <div className="relative z-10 text-center px-12">
            <BrandLogo className="h-14 mx-auto mb-6" />
            <p className="text-white/80 text-sm">Espace de travail collaboratif</p>
          </div>
        </div>
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-stone-50">
          <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-stone-900 mb-2">Lien invalide</h1>
            <p className="text-stone-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="px-6 py-3 bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg transition-colors"
            >
              Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  // État : succès
  if (success) {
    return (
      <div className="min-h-screen flex">
        <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
          <AuthVideoBackground />
          <div className="relative z-10 text-center px-12">
            <BrandLogo className="h-14 mx-auto mb-6" />
            <p className="text-white/80 text-sm">Compte activé avec succès</p>
          </div>
        </div>
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-stone-50">
          <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-stone-900 mb-2">Mot de passe créé !</h1>
            <p className="text-stone-600 mb-6">
              Votre compte est prêt. Vous allez être redirigé vers l'espace de travail.
            </p>
            <div className="flex items-center justify-center gap-2 text-brand">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Redirection en cours...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // État : formulaire principal
  return (
    <div className="min-h-screen flex">
      {/* Panneau gauche - vidéo + branding (identique aux pages Auth) */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
        <AuthVideoBackground />
        <div className="relative z-10 text-center px-12">
          <BrandLogo className="h-16 mx-auto mb-6" />
          <p className="text-white/80 text-sm leading-relaxed max-w-sm mx-auto">
            Votre espace de travail collaboratif. Définissez votre mot de passe pour accéder à votre compte.
          </p>
        </div>
      </div>

      {/* Panneau droit - formulaire */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 bg-stone-50">
        <div className="w-full max-w-md">
          {/* Logo mobile (visible seulement sur petits écrans) */}
          <div className="lg:hidden flex justify-center mb-6">
            <BrandLogo className="h-10" />
          </div>

          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-stone-900 mb-2 tracking-tight">
              Bienvenue
            </h1>
            <p className="text-stone-600 text-sm leading-relaxed">
              Votre compte a été créé. Définissez maintenant votre mot de passe pour accéder à votre espace de travail.
            </p>
          </div>

          {/* Info compte */}
          {email && (
            <div className="flex items-center gap-3 p-3 bg-white border border-stone-200 rounded-xl mb-6">
              <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-brand" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-stone-500 uppercase tracking-wide font-semibold">Compte à activer</p>
                <p className="text-sm text-stone-900 font-medium truncate">{email}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
                  placeholder="Minimum 6 caractères"
                  disabled={verifying}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">
                Confirmer le mot de passe
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
                placeholder="Retapez le mot de passe"
                disabled={verifying}
              />
            </div>

            <button
              type="submit"
              disabled={verifying}
              className="w-full py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 group"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Création en cours...</span>
                </>
              ) : (
                <>
                  <span>Activer mon compte</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="w-full py-2 text-stone-600 hover:text-stone-900 font-medium text-sm transition-colors"
            >
              Retour à la connexion
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
