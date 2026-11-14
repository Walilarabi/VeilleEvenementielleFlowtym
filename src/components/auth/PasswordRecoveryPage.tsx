import React, { useState } from 'react';
import { Lock, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getSupabaseClient } from '../../services/supabaseClient';

interface PasswordRecoveryPageProps {
  onComplete: () => Promise<void>;
}

export const PasswordRecoveryPage: React.FC<PasswordRecoveryPageProps> = ({ onComplete }) => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError('Choisissez un mot de passe de 12 caractères minimum.');
      return;
    }
    if (password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    const client = getSupabaseClient();
    if (!client) {
      setError('Le service Supabase est indisponible.');
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      setComplete(true);
    } catch (err: any) {
      setError(err?.message || 'La mise à jour du mot de passe a échoué.');
    } finally {
      setSaving(false);
      setPassword('');
      setConfirmation('');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#141824] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center"><ShieldCheck className="w-6 h-6" /></div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Nouveau mot de passe</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Définissez un nouveau mot de passe pour votre compte Flowtym.</p>
        </div>
        {error && <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
        {complete ? (
          <div className="space-y-4">
            <div role="status" className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />Votre mot de passe a été mis à jour.</div>
            <button type="button" onClick={() => void onComplete()} className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white py-2.5 text-xs font-bold">Retour à la connexion</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Nouveau mot de passe</label>
            <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100" /></div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Confirmer le mot de passe</label>
            <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="password" autoComplete="new-password" required minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100" /></div>
            <p className="text-[11px] text-slate-500">12 caractères minimum. Les règles supplémentaires configurées par Supabase restent appliquées.</p>
            <button type="submit" disabled={saving} className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2.5 text-xs font-bold">{saving ? 'Mise à jour…' : 'Enregistrer le nouveau mot de passe'}</button>
          </form>
        )}
      </div>
    </div>
  );
};
