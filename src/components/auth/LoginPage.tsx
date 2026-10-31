import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, ShieldCheck, Sparkles, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: { name: string; email: string; role: string }) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('wali.larabi@flowtym.com');
  const [password, setPassword] = useState('flowtym2026');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      // Valid credentials or non-empty check
      if (email.trim() && password.trim()) {
        onLoginSuccess({
          name: 'Wali Larabi',
          email: email.trim(),
          role: 'Head of Revenue Management',
        });
      } else {
        setError('Veuillez renseigner votre adresse e-mail et votre mot de passe.');
      }
    }, 400);
  };

  const handleQuickDemo = () => {
    setEmail('wali.larabi@flowtym.com');
    setPassword('flowtym2026');
    setError(null);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess({
        name: 'Wali Larabi',
        email: 'wali.larabi@flowtym.com',
        role: 'Head of Revenue Management',
      });
    }, 300);
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotEmail.trim()) {
      setForgotSent(true);
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotSent(false);
      }, 2500);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Discreet background ambient gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-violet-100/50 via-purple-50/20 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Login Card */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/50 p-8 sm:p-10 space-y-8 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-200/60 mb-1">
            <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Flowtym</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                Event Intelligence
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto">
              Plateforme d&apos;intelligence événementielle & d&apos;anticipation RM pour l&apos;hôtellerie
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Adresse e-mail
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre.email@hotel.com"
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Mot de passe
              </label>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-[11px] font-semibold text-violet-600 hover:text-violet-700 hover:underline"
              >
                Mot de passe oublié ?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1.5 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-md shadow-violet-200 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span>Authentification en cours...</span>
            ) : (
              <>
                <span>Se connecter</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Access Button */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <span>Environnement sécurisé RMS</span>
          </div>

          <button
            type="button"
            onClick={handleQuickDemo}
            className="w-full py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-violet-50 hover:text-violet-700 border border-slate-200 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Accès direct Démo (Wali L. · Head of RM)</span>
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Réinitialiser votre mot de passe</h3>
            <p className="text-xs text-slate-500">
              Saisissez votre e-mail professionnel. Vous recevrez un lien de réinitialisation sécurisé.
            </p>
            {forgotSent ? (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200">
                Lien de réinitialisation envoyé ! Vérifiez votre boîte de réception.
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-3">
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="votre.email@hotel.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
                  >
                    Envoyer le lien
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Discreet Footer */}
      <div className="mt-8 text-center text-xs text-slate-400">
        © 2026 Flowtym Hospitality Solutions · Système certifié ISO 27001
      </div>
    </div>
  );
};
