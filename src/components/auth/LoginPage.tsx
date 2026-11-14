import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { getSupabaseClient } from '../../services/supabaseClient';

interface LoginPageProps {
  onLoginSuccess: () => void;
  authError?: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, authError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const client = getSupabaseClient();
    if (!client) {
      setError('Le service de connexion est indisponible. Vérifiez la configuration Supabase.');
      return;
    }

    setIsLoading(true);
    try {
      const { error: signInError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      onLoginSuccess();
    } catch (err: any) {
      setError(err?.message || 'Connexion impossible. Vérifiez vos identifiants.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const client = getSupabaseClient();
    if (!client) {
      setError('Le service de réinitialisation est indisponible.');
      return;
    }

    setForgotLoading(true);
    try {
      const redirectTo = `${window.location.origin}/`;
      const { error: resetError } = await client.auth.resetPasswordForEmail(forgotEmail.trim(), { redirectTo });
      if (resetError) throw resetError;
      setForgotSent(true);
    } catch (err: any) {
      setError(err?.message || "Impossible d'envoyer le lien de réinitialisation.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#141824] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-violet-100/50 dark:from-violet-950/25 via-purple-50/20 dark:via-purple-950/20 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 p-8 sm:p-10 space-y-8 relative z-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600 text-white shadow-md mb-1">
            <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white/95" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Flowtym</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">HOPTYM</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs mx-auto">
              Intelligence événementielle et Revenue Management hôtelier
            </p>
          </div>
        </div>

        {(error || authError) && (
          <div role="alert" className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 rounded-2xl flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error || authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="hoptym-email" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Adresse e-mail</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input id="hoptym-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="votre.email@hotel.com" className="w-full bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="hoptym-password" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Mot de passe</label>
              <button type="button" onClick={() => { setShowForgotPassword(true); setForgotEmail(email); setForgotSent(false); setError(null); }} className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline">Mot de passe oublié ?</button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input id="hoptym-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Votre mot de passe" className="w-full bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
              <button type="button" aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setShowPassword((visible) => !visible)} className="p-1.5 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2">
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={isLoading} className="w-full py-2.5 px-4 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {isLoading ? 'Authentification en cours…' : <>Se connecter <ArrowRight className="w-3.5 h-3.5" /></>}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" /> Connexion sécurisée par Supabase Auth
        </div>
      </div>

      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Réinitialiser votre mot de passe</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Si un compte existe pour cette adresse, un lien de réinitialisation sera envoyé.</p>
            {forgotSent ? (
              <div role="status" className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-200 dark:border-emerald-800/70">Demande traitée. Vérifiez votre boîte de réception.</div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-3">
                <input type="email" autoComplete="email" required value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} placeholder="votre.email@hotel.com" className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowForgotPassword(false)} className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Annuler</button>
                  <button type="submit" disabled={forgotLoading} className="px-4 py-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50">{forgotLoading ? 'Envoi…' : 'Envoyer le lien'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 text-center text-xs text-slate-400">© 2026 Flowtym Hospitality Solutions</div>
    </div>
  );
};
