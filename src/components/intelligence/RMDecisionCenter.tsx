import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, Database, Edit3, Filter, History,
  RefreshCw, Search, ShieldCheck, XCircle, Eye, CalendarDays,
} from 'lucide-react';
import { Hotel, EventItem } from '../../types';
import { useAuth } from '../../auth/AuthProvider';
import { getHotelRecommendations, submitRevenueDecision } from '../../services/revenueApiClient';

type RecommendationRow = {
  id: string;
  stay_date: string;
  room_type_id: string | null;
  rate_plan_id: string | null;
  current_bar: number;
  suggested_bar: number;
  delta_amount: number;
  delta_pct: number;
  demand_index: number | null;
  demand_level: string | null;
  occupancy_pct: number | null;
  rooms_remaining: number | null;
  pickup_24h: number | null;
  pickup_3d: number | null;
  pickup_7d: number | null;
  lighthouse_median: number | null;
  flowtym_compset_median: number | null;
  confidence_score: number;
  data_quality_status: string;
  recommendation_status: string;
  strategy_code: string;
  explanation: string;
  evidence: Record<string, any> | null;
  currency: string;
  room_type_code?: string | null;
  room_type_name?: string | null;
  rate_plan_code?: string | null;
  rate_plan_name?: string | null;
};
type DecisionAuditRow = {
  id: string;
  rate_intelligence_id: string | null;
  stay_date: string;
  action_type: string;
  previous_rate: number | null;
  suggested_rate: number | null;
  final_rate: number | null;
  reason_code: string | null;
  reason_text: string | null;
  actor_user_id: string | null;
  created_at: string;
};
type DecisionAction = 'accept' | 'modify' | 'reject';

const money = (value: number | null | undefined, currency = 'EUR') =>
  value == null || !Number.isFinite(Number(value))
    ? '—'
    : new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value));

const dateRange = () => {
  const now = new Date();
  const from = new Date(now); from.setDate(from.getDate() - 7);
  const to = new Date(now); to.setDate(to.getDate() + 90);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
};

const qualityLabel = (status: string) => ({
  valid: 'Données validées',
  degraded: 'Sources partielles',
  insufficient: 'Données insuffisantes',
  stale: 'Sources périmées',
  conflicted: 'Conflit de données',
} as Record<string, string>)[status] ?? status;

const statusLabel = (status: string) => ({
  pending: 'À examiner',
  accepted: 'Validée',
  approved: 'Validée',
  modified: 'Modifiée',
  rejected: 'Rejetée',
} as Record<string, string>)[status] ?? status;

interface RMDecisionCenterProps {
  hotel: Hotel;
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  onShowToast: (msg: string) => void;
}

export const RMDecisionCenter: React.FC<RMDecisionCenterProps> = ({ hotel, events, onSelectEvent, onShowToast }) => {
  const { supabase } = useAuth();
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);
  const [auditRows, setAuditRows] = useState<DecisionAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all' | 'blocked' | 'decided'>('pending');
  const [search, setSearch] = useState('');
  const [showAudit, setShowAudit] = useState(false);
  const [decisionTarget, setDecisionTarget] = useState<RecommendationRow | null>(null);
  const [decisionAction, setDecisionAction] = useState<DecisionAction>('accept');
  const [appliedRate, setAppliedRate] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [savingDecision, setSavingDecision] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!supabase || !hotel?.id) {
      setError('Connexion Supabase ou hôtel indisponible.');
      setLoading(false);
      return;
    }
    if (quiet) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const range = dateRange();
      const [recommendationResult, auditResult, roomTypeResult, ratePlanResult] = await Promise.all([
        getHotelRecommendations(supabase, hotel.id, range.from, range.to),
        supabase.from('rm_decision_audit_logs').select('id,rate_intelligence_id,stay_date,action_type,previous_rate,suggested_rate,final_rate,reason_code,reason_text,actor_user_id,created_at').eq('hotel_id', hotel.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('hotel_room_types').select('id,code,name').eq('hotel_id', hotel.id),
        supabase.from('hotel_rate_plans').select('id,code,name').eq('hotel_id', hotel.id),
      ]);
      if (auditResult.error) throw auditResult.error;
      if (roomTypeResult.error) throw roomTypeResult.error;
      if (ratePlanResult.error) throw ratePlanResult.error;
      const roomById = new Map<string, any>((roomTypeResult.data ?? []).map((row: any) => [row.id, row]));
      const planById = new Map<string, any>((ratePlanResult.data ?? []).map((row: any) => [row.id, row]));
      const enriched = (recommendationResult.data ?? []).map((raw: any) => {
        const room = raw.room_type_id ? roomById.get(raw.room_type_id) : null;
        const plan = raw.rate_plan_id ? planById.get(raw.rate_plan_id) : null;
        return {
          ...raw,
          room_type_code: room?.code ?? null,
          room_type_name: room?.name ?? null,
          rate_plan_code: plan?.code ?? null,
          rate_plan_name: plan?.name ?? null,
        } as RecommendationRow;
      });
      setRecommendations(enriched);
      setAuditRows((auditResult.data ?? []) as DecisionAuditRow[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement du centre de décisions impossible.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase, hotel?.id]);

  useEffect(() => { void load(); }, [load]);

  const pending = recommendations.filter((row) => row.recommendation_status === 'pending');
  const blocked = pending.filter((row) => row.data_quality_status !== 'valid');
  const validPending = pending.filter((row) => row.data_quality_status === 'valid');
  const decided = recommendations.filter((row) => row.recommendation_status !== 'pending');

  const filtered = useMemo(() => {
    const base = filter === 'pending' ? pending
      : filter === 'blocked' ? blocked
      : filter === 'decided' ? decided
      : recommendations;
    const q = search.trim().toLocaleLowerCase('fr-FR');
    if (!q) return base;
    return base.filter((row) =>
      [row.stay_date, row.room_type_name, row.room_type_code, row.rate_plan_name, row.rate_plan_code, row.strategy_code]
        .some((value) => String(value ?? '').toLocaleLowerCase('fr-FR').includes(q))
    );
  }, [filter, search, recommendations, pending, blocked, decided]);

  const beginDecision = (row: RecommendationRow, action: DecisionAction) => {
    setDecisionTarget(row);
    setDecisionAction(action);
    setAppliedRate(String(action === 'accept' ? row.suggested_bar : row.current_bar));
    setReasonText(action === 'accept' ? 'Recommandation validée par le Revenue Manager après examen des sources.' : '');
  };

  const confirmDecision = async () => {
    if (!supabase || !decisionTarget) return;
    const rate = decisionAction === 'reject' ? undefined : Number(appliedRate.replace(',', '.'));
    if (decisionAction !== 'reject' && (!Number.isFinite(rate) || rate! <= 0)) {
      setError('Le tarif appliqué doit être un montant positif.');
      return;
    }
    if (decisionAction !== 'accept' && reasonText.trim().length < 8) {
      setError('Expliquez la modification ou le rejet (8 caractères minimum).');
      return;
    }
    setSavingDecision(true);
    setError(null);
    try {
      await submitRevenueDecision(supabase, hotel.id, {
        rateIntelligenceId: decisionTarget.id,
        action: decisionAction,
        appliedRate: rate,
        reasonCode: decisionAction === 'accept' ? 'APPROVED_BY_REVENUE_MANAGER' : decisionAction === 'modify' ? 'MANUAL_RATE_ADJUSTMENT' : 'RECOMMENDATION_REJECTED',
        reasonText: reasonText.trim() || undefined,
      });
      setDecisionTarget(null);
      onShowToast(decisionAction === 'accept' ? 'Recommandation validée et décision auditée.' : decisionAction === 'modify' ? 'Tarif modifié et décision auditée.' : 'Recommandation rejetée et décision auditée.');
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La décision n’a pas pu être enregistrée.');
    } finally {
      setSavingDecision(false);
    }
  };

  const relatedEvents = (stayDate: string) => events.filter((event) => event.startDate <= stayDate && event.endDate >= stayDate);

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Revenue Management · Gouvernance</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Centre de décisions RM</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hotel.name} · Les recommandations nécessitent une validation humaine. Aucune publication tarifaire automatique.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowAudit((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><History size={16}/>{showAudit ? 'Masquer le journal' : 'Journal des décisions'}</button>
          <button type="button" onClick={() => void load(true)} disabled={refreshing || loading} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/>Actualiser</button>
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">En attente</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{pending.length}</p></div>
        <div className="rounded-2xl border border-emerald-200 bg-white p-4 dark:border-emerald-900 dark:bg-slate-900"><p className="text-xs text-slate-500">Validables</p><p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{validPending.length}</p></div>
        <div className="rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-900 dark:bg-slate-900"><p className="text-xs text-slate-500">Bloquées par la qualité</p><p className="mt-1 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">{blocked.length}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">Décisions prises</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{decided.length}</p></div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(['pending','blocked','decided','all'] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${filter === value ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>{({pending:'En attente',blocked:'Bloquées',decided:'Historique',all:'Toutes'})[value]}</button>)}
        </div>
        <label className="relative block w-full sm:max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Date, typologie, plan…" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/></label>
      </div>

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Chargement des recommandations et du journal d'audit…</div> : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <Database className="mx-auto h-8 w-8 text-slate-400"/>
          <h2 className="mt-3 font-bold text-slate-900 dark:text-white">Aucune décision dans cette vue</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Les recommandations apparaîtront ici après import des données, configuration du plan BAR et exécution du moteur. Les états vides ne sont pas remplacés par des exemples fictifs.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[1350px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/70"><tr>
              <th className="px-3 py-3">Date</th><th className="px-3 py-3">Typologie / plan</th><th className="px-3 py-3 text-right">BAR actuel</th><th className="px-3 py-3 text-right">Proposé</th><th className="px-3 py-3 text-right">Écart</th><th className="px-3 py-3 text-right">TO</th><th className="px-3 py-3 text-right">Pickup 24h / 3j / 7j</th><th className="px-3 py-3 text-right">Demande</th><th className="px-3 py-3 text-right">Couverture</th><th className="px-3 py-3">Qualité / statut</th><th className="px-3 py-3">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((row) => {
                const valid = row.data_quality_status === 'valid';
                const rowEvents = relatedEvents(row.stay_date);
                return <tr key={row.id} className="align-top">
                  <td className="px-3 py-3 font-semibold text-slate-800 dark:text-slate-200">{row.stay_date}</td>
                  <td className="px-3 py-3"><div className="font-semibold text-slate-900 dark:text-white">{row.room_type_name ?? 'Typologie non définie'}</div><div className="text-[10px] text-slate-500">{row.room_type_code ?? '—'} · {row.rate_plan_code ?? 'Plan hôtel'}</div></td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(row.current_bar,row.currency)}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums">{money(row.suggested_bar,row.currency)}</td>
                  <td className={`px-3 py-3 text-right font-semibold tabular-nums ${row.delta_pct > 0 ? 'text-emerald-700' : row.delta_pct < 0 ? 'text-rose-700' : 'text-slate-500'}`}>{row.delta_pct > 0 ? '+' : ''}{Number(row.delta_pct ?? 0).toFixed(1)}%</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.occupancy_pct == null ? '—' : `${Number(row.occupancy_pct).toFixed(1)}%`}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.pickup_24h ?? '—'} / {row.pickup_3d ?? '—'} / {row.pickup_7d ?? '—'}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.demand_index == null ? '—' : `${row.demand_index}/100`}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.confidence_score ?? 0}%</td>
                  <td className="px-3 py-3"><div className="font-semibold text-slate-800 dark:text-slate-200">{qualityLabel(row.data_quality_status)}</div><div className="text-[10px] text-slate-500">{statusLabel(row.recommendation_status)}</div><p className="mt-1 max-w-[240px] whitespace-normal text-[10px] text-slate-500">{row.explanation}</p>
                    {rowEvents.length>0 && <div className="mt-2 space-y-1">{rowEvents.slice(0,2).map((event)=> <button key={event.id} type="button" onClick={()=>onSelectEvent(event)} className="block text-left text-[10px] font-semibold text-violet-700 hover:underline dark:text-violet-300">Événement : {event.title}</button>)}</div>}
                    <details className="mt-2"><summary className="cursor-pointer text-[10px] font-semibold text-violet-700">Preuves</summary><pre className="mt-1 max-w-[260px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[9px] text-slate-600 dark:bg-slate-950 dark:text-slate-300">{JSON.stringify(row.evidence ?? {},null,2)}</pre></details>
                  </td>
                  <td className="px-3 py-3"><div className="flex min-w-[120px] flex-col gap-1.5">
                    <button type="button" disabled={!valid || row.recommendation_status!=='pending'} onClick={()=>beginDecision(row,'accept')} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-35"><CheckCircle2 size={12}/>Valider</button>
                    <button type="button" disabled={!valid || row.recommendation_status!=='pending'} onClick={()=>beginDecision(row,'modify')} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:text-slate-200"><Edit3 size={12}/>Modifier</button>
                    <button type="button" disabled={row.recommendation_status!=='pending'} onClick={()=>beginDecision(row,'reject')} className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-200 px-2 py-1.5 text-[10px] font-bold text-rose-700 disabled:cursor-not-allowed disabled:opacity-35 dark:border-rose-900 dark:text-rose-300"><XCircle size={12}/>Rejeter</button>
                  </div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAudit && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="font-bold text-slate-900 dark:text-white">Journal d'audit des décisions</h2><span className="text-xs text-slate-500">{auditRows.length} entrée(s)</span></div>
        {auditRows.length===0 ? <p className="p-5 text-sm text-slate-500">Aucune décision enregistrée.</p> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{auditRows.map((row)=><div key={row.id} className="grid gap-2 px-5 py-3 text-xs sm:grid-cols-[1fr_1fr_1fr_2fr]"><div><p className="font-semibold text-slate-900 dark:text-white">{row.stay_date}</p><p className="text-slate-500">{new Date(row.created_at).toLocaleString('fr-FR')}</p></div><div className="font-semibold text-slate-700 dark:text-slate-200">{row.action_type}</div><div className="tabular-nums text-slate-600 dark:text-slate-300">{money(row.previous_rate,hotel.currency)} → {money(row.final_rate,hotel.currency)}</div><div className="text-slate-500">{row.reason_code ?? '—'} · {row.reason_text ?? 'Aucun motif renseigné'}</div></div>)}</div>}
      </section>}

      {decisionTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="presentation">
        <div role="dialog" aria-modal="true" aria-labelledby="rm-decision-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3"><div><h2 id="rm-decision-title" className="text-lg font-bold text-slate-900 dark:text-white">{decisionAction==='accept'?'Valider la recommandation':decisionAction==='modify'?'Modifier le tarif appliqué':'Rejeter la recommandation'}</h2><p className="mt-1 text-xs text-slate-500">{decisionTarget.stay_date} · {decisionTarget.room_type_name} · {decisionTarget.rate_plan_code}</p></div><button type="button" onClick={()=>setDecisionTarget(null)} aria-label="Fermer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><XCircle size={18}/></button></div>
          {decisionAction!=='reject' && <label className="mt-4 block"><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tarif final ({decisionTarget.currency})</span><input type="number" min="0.01" step="0.01" value={appliedRate} onChange={(event)=>setAppliedRate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"/></label>}
          <label className="mt-4 block"><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Motif / justification {decisionAction!=='accept'?'(obligatoire)':'(facultatif)'}</span><textarea value={reasonText} onChange={(event)=>setReasonText(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Expliquez la décision…"/></label>
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">Cette action enregistre une décision et son audit. Elle ne publie pas le tarif sur D-EDGE ni sur un canal de distribution.</p>
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={()=>setDecisionTarget(null)} disabled={savingDecision} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Annuler</button><button type="button" onClick={()=>void confirmDecision()} disabled={savingDecision} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingDecision?'Enregistrement…':'Confirmer la décision'}</button></div>
        </div>
      </div>}
    </section>
  );
};
