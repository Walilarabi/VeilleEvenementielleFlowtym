import React, { useEffect, useState } from 'react';
import { AlertTriangle, Database, RefreshCw, ExternalLink } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { Hotel } from '../../types';

interface HotelConnectivityHubProps {
  hotel: Hotel;
  onShowToast: (message: string) => void;
  onNavigateToPricing?: () => void;
}

interface IntegrationConnectionRow {
  id: string;
  provider: string;
  connection_name: string | null;
  connection_status: string;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_code: string | null;
}

const providerLabel = (provider: string) => {
  const key = provider.toLowerCase();
  if (key.includes('d-edge') || key.includes('dedge')) return 'D-EDGE';
  if (key.includes('lighthouse')) return 'Lighthouse';
  return provider;
};

const statusLabel = (status: string) => {
  const key = status.toLowerCase();
  if (['connected', 'active', 'healthy'].includes(key)) return 'Connecté';
  if (['error', 'failed', 'unhealthy'].includes(key)) return 'Erreur';
  if (['pending', 'configuring'].includes(key)) return 'En attente';
  return 'Non connecté';
};

export const HotelConnectivityHub: React.FC<HotelConnectivityHubProps> = ({ hotel, onNavigateToPricing }) => {
  const { supabase } = useAuth();
  const [rows, setRows] = useState<IntegrationConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) {
        if (active) { setError('Session Supabase indisponible.'); setLoading(false); }
        return;
      }
      setLoading(true);
      setError(null);
      const result = await supabase
        .from('integration_connections')
        .select('id,provider,connection_name,connection_status,last_success_at,last_error_at,last_error_code')
        .eq('hotel_id', hotel.id)
        .order('updated_at', { ascending: false });
      if (!active) return;
      if (result.error) setError(result.error.message);
      else setRows((result.data ?? []) as IntegrationConnectionRow[]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [supabase, hotel.id]);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3"><Database className="h-6 w-6 text-violet-600" /><div><h1 className="text-lg font-bold text-slate-900 dark:text-white">Connexions hôtelières</h1><p className="text-sm text-slate-500 dark:text-slate-400">{hotel.name} · état lu depuis Supabase</p></div></div>
      </header>
      {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">Lecture des intégrations impossible : {error}</div> : null}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-slate-900 dark:text-white">Intégrations enregistrées</h2>{loading ? <RefreshCw className="h-4 w-4 animate-spin text-slate-400" /> : <span className="text-xs text-slate-500">{rows.length} connexion(s)</span>}</div>
        {!loading && rows.length === 0 && !error ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>Aucune intégration D-EDGE, Lighthouse ou PMS n'est enregistrée pour cet hôtel. Aucun test réseau n'est lancé et aucune connexion n'est déclarée active par défaut.</p></div></div> : null}
        <div className="mt-4 space-y-3">
          {rows.map((row) => <div key={row.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-semibold text-slate-900 dark:text-white">{row.connection_name || providerLabel(row.provider)}</div><div className="mt-1 text-xs text-slate-500">{providerLabel(row.provider)} · {row.last_success_at ? `Dernier succès : ${new Date(row.last_success_at).toLocaleString('fr-FR')}` : 'Aucun succès enregistré'}</div>{row.last_error_code ? <div className="mt-1 text-xs text-rose-600">Dernière erreur : {row.last_error_code}</div> : null}</div><span className="inline-flex w-fit rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">{statusLabel(row.connection_status)}</span></div>)}
        </div>
      </div>
      {onNavigateToPricing ? <button type="button" onClick={onNavigateToPricing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Ouvrir le Revenue Management <ExternalLink size={15} /></button> : null}
      <p className="text-xs text-slate-500 dark:text-slate-400">Les identifiants et secrets API ne sont jamais stockés dans le navigateur. Le paramétrage des credentials et les tests de connectivité nécessitent un endpoint serveur dédié, qui n'est pas encore déployé.</p>
    </section>
  );
};
