import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, CircleAlert, Moon, Plug, Plus, RefreshCw, Save, Settings2, Sun, Trash2, Monitor } from 'lucide-react';
import { Hotel } from '../../types';
import { useAuth } from '../../auth/AuthProvider';
import { useTheme, ThemeMode } from '../../contexts/ThemeContext';
import { saveHotelRevenueParameters } from '../../services/revenueApiClient';

type DbHotel = {
  id: string; organization_id: string; name: string; city: string; country: string; stars: number | null;
  room_count: number | null; currency: string; timezone: string; rate_floor: number | null;
  rate_ceiling: number | null; max_rate_change_pct: number | null; is_active: boolean;
};
type Competitor = {
  id: string; competitor_name: string; address: string | null; stars: number | null;
  distance_meters: number | null; is_active: boolean;
};

type SettingsTab = 'hotel' | 'compset' | 'integrations' | 'appearance';

interface SettingsViewProps {
  hotels: Hotel[];
  onAddHotel: (hotel: Hotel) => void;
  onDeleteHotel: (id: string) => void;
  selectedHotelId?: string;
  onSelectHotel?: (hotelId: string) => void;
  onShowToast?: (message: string) => void;
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300';
const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';

export const SettingsView: React.FC<SettingsViewProps> = ({ selectedHotelId, onShowToast }) => {
  const { supabase, user } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const [tab, setTab] = useState<SettingsTab>('hotel');
  const [hotels, setHotels] = useState<DbHotel[]>([]);
  const [hotelId, setHotelId] = useState('');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ currency: 'EUR', timezone: 'Europe/Paris', targetAdr: '', targetOccupancyPct: '', targetRevpar: '', floorRate: '', ceilingRate: '', maxDailyRateChangePct: '', distributionCostPct: '' });
  const [newCompetitor, setNewCompetitor] = useState({ name: '', address: '', stars: '', distanceKm: '' });

  const activeHotel = useMemo(() => hotels.find(h => h.id === hotelId) ?? null, [hotels, hotelId]);

  const load = useCallback(async () => {
    if (!supabase) { setError('Connexion Supabase indisponible.'); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data: hotelRows, error: hotelError } = await supabase.from('hotels')
        .select('id,organization_id,name,city,country,stars,room_count,currency,timezone,rate_floor,rate_ceiling,max_rate_change_pct,is_active')
        .eq('is_active', true).order('name');
      if (hotelError) throw hotelError;
      const rows = (hotelRows ?? []) as DbHotel[];
      setHotels(rows);
      const chosenId = rows.some(h => h.id === selectedHotelId) ? selectedHotelId! : (rows[0]?.id ?? '');
      setHotelId(chosenId);
      if (!chosenId) { setCompetitors([]); setIntegrations([]); return; }
      const [profileResult, competitorResult, integrationResult] = await Promise.all([
        supabase.from('hotel_parameters_profiles').select('*').eq('hotel_id', chosenId).maybeSingle(),
        supabase.from('competitor_hotels').select('id,competitor_name,address,stars,distance_meters,is_active').eq('hotel_id', chosenId).order('competitor_name'),
        supabase.from('integration_connections').select('id,provider,connection_name,connection_status,last_success_at,last_error_at,last_error_code').eq('hotel_id', chosenId).order('provider'),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (competitorResult.error) throw competitorResult.error;
      if (integrationResult.error) throw integrationResult.error;
      const p = profileResult.data;
      setForm({
        currency: p?.currency ?? rows.find(h => h.id === chosenId)?.currency ?? 'EUR',
        timezone: p?.timezone ?? rows.find(h => h.id === chosenId)?.timezone ?? 'Europe/Paris',
        targetAdr: p?.target_adr == null ? '' : String(p.target_adr),
        targetOccupancyPct: p?.target_occupancy_pct == null ? '' : String(p.target_occupancy_pct),
        targetRevpar: p?.target_revpar == null ? '' : String(p.target_revpar),
        floorRate: p?.floor_rate == null ? (rows.find(h => h.id === chosenId)?.rate_floor == null ? '' : String(rows.find(h => h.id === chosenId)!.rate_floor)) : String(p.floor_rate),
        ceilingRate: p?.ceiling_rate == null ? (rows.find(h => h.id === chosenId)?.rate_ceiling == null ? '' : String(rows.find(h => h.id === chosenId)!.rate_ceiling)) : String(p.ceiling_rate),
        maxDailyRateChangePct: p?.max_daily_rate_change_pct == null ? (rows.find(h => h.id === chosenId)?.max_rate_change_pct == null ? '' : String(rows.find(h => h.id === chosenId)!.max_rate_change_pct)) : String(p.max_daily_rate_change_pct),
        distributionCostPct: p?.distribution_cost_pct == null ? '' : String(p.distribution_cost_pct),
      });
      setCompetitors((competitorResult.data ?? []) as Competitor[]);
      setIntegrations(integrationResult.data ?? []);
    } catch (e: any) {
      setError(e?.message || 'Impossible de charger les paramètres depuis Supabase.');
    } finally { setLoading(false); }
  }, [supabase, selectedHotelId]);

  useEffect(() => { void load(); }, [load]);

  const saveParameters = async () => {
    if (!supabase || !hotelId) return;
    const floor = Number(form.floorRate), ceiling = Number(form.ceilingRate), maxChange = Number(form.maxDailyRateChangePct);
    if (!Number.isFinite(floor) || !Number.isFinite(ceiling) || !Number.isFinite(maxChange) || floor <= 0 || ceiling < floor || maxChange <= 0 || maxChange > 100) {
      setError('Renseignez un plancher positif, un plafond supérieur ou égal au plancher et une variation maximale entre 0 et 100 %.'); return;
    }
    setSaving(true); setError(null);
    try {
      await saveHotelRevenueParameters(supabase, hotelId, {
        currency: form.currency, timezone: form.timezone,
        targetAdr: form.targetAdr === '' ? null : Number(form.targetAdr),
        targetOccupancyPct: form.targetOccupancyPct === '' ? null : Number(form.targetOccupancyPct),
        targetRevpar: form.targetRevpar === '' ? null : Number(form.targetRevpar),
        floorRate: floor, ceilingRate: ceiling, maxDailyRateChangePct: maxChange,
        distributionCostPct: form.distributionCostPct === '' ? null : Number(form.distributionCostPct),
        compsetConfig: competitors.map(c => ({ id: c.id, name: c.competitor_name, active: c.is_active })),
      });
      onShowToast?.('Paramètres Revenue Management enregistrés dans Supabase.');
      await load();
    } catch (e: any) { setError(e?.message || 'Échec de sauvegarde des paramètres.'); }
    finally { setSaving(false); }
  };

  const addCompetitor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !activeHotel || !newCompetitor.name.trim()) return;
    if (competitors.filter(c => c.is_active).length >= 10) { setError('Le CompSet est limité à 10 concurrents actifs.'); return; }
    setSaving(true); setError(null);
    try {
      const { error: insertError } = await supabase.from('competitor_hotels').insert({
        organization_id: activeHotel.organization_id,
        hotel_id: hotelId, competitor_name: newCompetitor.name.trim(),
        address: newCompetitor.address.trim() || null,
        stars: newCompetitor.stars ? Number(newCompetitor.stars) : null,
        distance_meters: newCompetitor.distanceKm === '' ? null : Math.round(Number(newCompetitor.distanceKm) * 1000),
        is_active: true,
      });
      if (insertError) throw insertError;
      setNewCompetitor({ name: '', address: '', stars: '', distanceKm: '' });
      onShowToast?.('Concurrent ajouté au CompSet de cet hôtel.');
      await load();
    } catch (e: any) { setError(e?.message || 'Impossible d’ajouter ce concurrent.'); }
    finally { setSaving(false); }
  };

  const toggleCompetitor = async (competitor: Competitor) => {
    if (!supabase) return;
    if (!competitor.is_active && competitors.filter(c => c.is_active).length >= 10) { setError('Maximum 10 concurrents actifs.'); return; }
    const { error: updateError } = await supabase.from('competitor_hotels').update({ is_active: !competitor.is_active }).eq('id', competitor.id).eq('hotel_id', hotelId);
    if (updateError) setError(updateError.message); else await load();
  };

  const deleteCompetitor = async (id: string) => {
    if (!supabase) return;
    const { error: deleteError } = await supabase.from('competitor_hotels').delete().eq('id', id).eq('hotel_id', hotelId);
    if (deleteError) setError(deleteError.message); else { onShowToast?.('Concurrent supprimé.'); await load(); }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'hotel', label: 'Hôtel & règles RM', icon: <Building2 size={16} /> },
    { id: 'compset', label: 'Concurrence', icon: <Settings2 size={16} /> },
    { id: 'integrations', label: 'Intégrations', icon: <Plug size={16} /> },
    { id: 'appearance', label: 'Affichage', icon: <Sun size={16} /> },
  ];

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2 text-violet-700 dark:text-violet-300"><Settings2 size={20} /><span className="text-xs font-bold uppercase tracking-wider">Configuration Flowtym RMS</span></div><h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Paramètres</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Paramètres persistés et relus depuis la base de données de l’établissement.</p></div>
      <div className="flex items-center gap-2"><span className="text-xs text-slate-500 dark:text-slate-400">{user?.email ?? 'Session non identifiée'}</span><button onClick={() => void load()} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Actualiser"><RefreshCw size={16} /></button></div>
    </div>
    <div className="flex flex-wrap gap-2">{tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${tab === t.id ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>{t.icon}{t.label}</button>)}</div>
    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><CircleAlert size={17} className="mt-0.5 shrink-0" />{error}</div>}
    {loading ? <div className={cardClass}>Chargement des paramètres réels…</div> : !activeHotel ? <div className={cardClass}><p className="font-semibold text-slate-900 dark:text-white">Aucun hôtel accessible dans Supabase.</p><p className="mt-1 text-sm text-slate-500">Vérifiez les droits de votre compte et l’association à un établissement.</p></div> : <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"><CheckCircle2 size={17} /><span><strong>{activeHotel.name}</strong> · {activeHotel.city}, {activeHotel.country} · {activeHotel.room_count ?? '—'} chambres</span><span className="ml-auto text-xs">Source : Supabase</span></div>
      {tab === 'hotel' && <section className={cardClass}><h2 className="text-base font-bold text-slate-900 dark:text-white">Paramètres opérationnels et garde-fous tarifaires</h2><p className="mb-5 mt-1 text-sm text-slate-500 dark:text-slate-400">Les champs vides restent non renseignés : aucune cible ni tarif de référence n’est inventé.</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['Devise','currency',form.currency],['Fuseau horaire','timezone',form.timezone],
          ['ADR cible (€)','targetAdr',form.targetAdr],['Occupation cible (%)','targetOccupancyPct',form.targetOccupancyPct],
          ['RevPAR cible (€)','targetRevpar',form.targetRevpar],['Tarif plancher (€)','floorRate',form.floorRate],
          ['Tarif plafond (€)','ceilingRate',form.ceilingRate],['Variation max / jour (%)','maxDailyRateChangePct',form.maxDailyRateChangePct],
          ['Coût de distribution (%)','distributionCostPct',form.distributionCostPct],
        ].map(([label,key,value]) => <label key={key as string}><span className={labelClass}>{label}</span><input className={inputClass} value={value as string} onChange={e => setForm(prev => ({...prev,[key as string]:e.target.value}))} /></label>)}
      </div><div className="mt-5 flex justify-end"><button disabled={saving} onClick={() => void saveParameters()} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"><Save size={16} />{saving ? 'Enregistrement…' : 'Enregistrer dans Supabase'}</button></div></section>}
      {tab === 'compset' && <section className={cardClass}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-slate-900 dark:text-white">CompSet concurrentiel</h2><p className="text-sm text-slate-500 dark:text-slate-400">{competitors.filter(c => c.is_active).length} / 10 concurrents actifs · enregistrement réel dans competitor_hotels</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{competitors.length} enregistré(s)</span></div>
        <form onSubmit={addCompetitor} className="mb-5 grid gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950 sm:grid-cols-2 lg:grid-cols-4"><label><span className={labelClass}>Nom de l’hôtel concurrent *</span><input required className={inputClass} value={newCompetitor.name} onChange={e => setNewCompetitor(p=>({...p,name:e.target.value}))} placeholder="Nom exact" /></label><label><span className={labelClass}>Adresse</span><input className={inputClass} value={newCompetitor.address} onChange={e => setNewCompetitor(p=>({...p,address:e.target.value}))} placeholder="Adresse vérifiée" /></label><label><span className={labelClass}>Étoiles</span><select className={inputClass} value={newCompetitor.stars} onChange={e=>setNewCompetitor(p=>({...p,stars:e.target.value}))}><option value="">Non renseigné</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}★</option>)}</select></label><label><span className={labelClass}>Distance (km)</span><input type="number" min="0" step="0.1" className={inputClass} value={newCompetitor.distanceKm} onChange={e=>setNewCompetitor(p=>({...p,distanceKm:e.target.value}))} placeholder="Non renseignée" /></label><div className="sm:col-span-2 lg:col-span-4"><button disabled={saving || competitors.filter(c=>c.is_active).length>=10} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus size={16}/>Ajouter au CompSet</button></div></form>
        {competitors.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Aucun concurrent enregistré. Les noms de démonstration ne sont pas injectés automatiquement.</p> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{competitors.map(c=><div key={c.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900 dark:text-white">{c.competitor_name}</p><p className="text-xs text-slate-500">{c.address || 'Adresse non renseignée'} · {c.stars ? `${c.stars}★` : 'Catégorie inconnue'} · {c.distance_meters == null ? 'Distance inconnue' : `${(c.distance_meters/1000).toFixed(1)} km`}</p></div><button onClick={()=>void toggleCompetitor(c)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${c.is_active?'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200':'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{c.is_active?'Actif':'Inactif'}</button><button onClick={()=>void deleteCompetitor(c.id)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40" aria-label={`Supprimer ${c.competitor_name}`}><Trash2 size={16}/></button></div>)}</div>}
      </section>}
      {tab === 'integrations' && <section className={cardClass}><h2 className="font-bold text-slate-900 dark:text-white">Connecteurs et disponibilité des données</h2><p className="mb-4 mt-1 text-sm text-slate-500 dark:text-slate-400">État lu dans integration_connections. Aucun connecteur n’est déclaré actif sans preuve en base.</p>{integrations.length===0?<p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Aucune intégration configurée pour cet hôtel.</p>:<div className="divide-y divide-slate-100 dark:divide-slate-800">{integrations.map((i:any)=><div key={i.id} className="flex flex-wrap items-center gap-3 py-3"><Plug size={17} className="text-slate-400"/><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900 dark:text-white">{i.connection_name} · {i.provider}</p><p className="text-xs text-slate-500">Dernier succès : {i.last_success_at ? new Date(i.last_success_at).toLocaleString('fr-FR') : 'Jamais'}{i.last_error_code ? ` · Erreur : ${i.last_error_code}` : ''}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{i.connection_status}</span></div>)}</div>}</section>}
      {tab === 'appearance' && <section className={cardClass}><h2 className="font-bold text-slate-900 dark:text-white">Confort d’affichage</h2><p className="mb-5 mt-1 text-sm text-slate-500 dark:text-slate-400">Préférence d’affichage locale à cet appareil.</p><div className="grid gap-3 sm:grid-cols-3">{([{id:'light',label:'Clair',icon:<Sun size={20}/>},{id:'dark',label:'Sombre',icon:<Moon size={20}/>},{id:'system',label:'Système',icon:<Monitor size={20}/>} ] as {id:ThemeMode;label:string;icon:React.ReactNode}[]).map(m=><button key={m.id} onClick={()=>setThemeMode(m.id)} className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold ${themeMode===m.id?'border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-950/30 dark:text-violet-200':'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>{m.icon}{m.label}{themeMode===m.id&&<CheckCircle2 size={16} className="ml-auto"/>}</button>)}</div></section>}
    </>}
  </div>;
};
