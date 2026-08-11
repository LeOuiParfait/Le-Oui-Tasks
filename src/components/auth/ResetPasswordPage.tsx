import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Check, AlertCircle, Loader2, Eye, EyeOff, Sparkles, ArrowRight, Mail } from 'lucide-react';

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

  const token = searchParams.get('token');

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

    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand via-brand-dark to-stone-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-brand animate-spin" />
            <p className="text-stone-600 font-medium">Vérification du lien...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand via-brand-dark to-stone-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
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
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand via-brand-dark to-stone-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
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
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand via-brand-dark to-stone-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">

        {/* Header dédié invité */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-200/50">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 mb-2">
            Bienvenue sur Le Oui Parfait
          </h1>
          <p className="text-stone-600 text-sm leading-relaxed">
            Votre compte a été créé. Définissez maintenant votre mot de passe pour accéder à votre espace de travail.
          </p>
        </div>

        {/* Info compte */}
        {email && (
          <div className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-100 rounded-xl mb-6">
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
  );
};
