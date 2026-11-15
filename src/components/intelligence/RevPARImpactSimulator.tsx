import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Database, RefreshCw } from 'lucide-react';
import { EventItem, Hotel } from '../../types';
import { useAuth } from '../../auth/AuthProvider';

type HistoricalRow = {
  stay_date: string;
  total_marketable_rooms: number | null;
  rooms_sold: number | null;
  occupancy_pct: number | null;
  adr_net: number | null;
  revpar: number | null;
  accommodation_revenue: number | null;
  currency: string;
  source_status: string;
};

type Baseline = {
  rows: HistoricalRow[];
  days: number;
  totalRooms: number;
  roomsSold: number;
  revenue: number;
  occupancy: number;
  adr: number;
  revpar: number;
  currency: string;
  from: string;
  to: string;
};

interface RevPARImpactSimulatorProps {
  events: EventItem[];
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectEvent?: (event: EventItem) => void;
  onSelectHotel?: (hotelId: string) => void;
}

const clamp = (value:number,min:number,max:number) => Math.min(max,Math.max(min,value));
const currencyFormat = (value:number,currency:string) => new Intl.NumberFormat('fr-FR',{style:'currency',currency,maximumFractionDigits:2}).format(value);
const dateISO = (date:Date) => date.toISOString().slice(0,10);

export const RevPARImpactSimulator: React.FC<RevPARImpactSimulatorProps> = ({ events, hotels, selectedHotelId, onSelectEvent }) => {
  const { supabase } = useAuth();
  const hotel = hotels.find((item)=>item.id===selectedHotelId) ?? hotels[0];
  const [periodDays,setPeriodDays] = useState(30);
  const [baseline,setBaseline] = useState<Baseline|null>(null);
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [priceChangePct,setPriceChangePct] = useState(5);
  const [occupancyDelta,setOccupancyDelta] = useState(0);

  const load = useCallback(async (quiet=false) => {
    if (!supabase || !hotel?.id) { setError('Session Supabase ou hôtel indisponible.'); setLoading(false); return; }
    if (quiet) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const today = dateISO(new Date());
      const toDate = new Date(today+'T12:00:00');
      toDate.setDate(toDate.getDate()-1);
      const to = dateISO(toDate);
      const fromDate = new Date(to+'T12:00:00');
      fromDate.setDate(fromDate.getDate()-periodDays+1);
      const from = dateISO(fromDate);
      const result = await supabase.from('hotel_historical_daily')
        .select('stay_date,total_marketable_rooms,rooms_sold,occupancy_pct,adr_net,revpar,accommodation_revenue,currency,source_status')
        .eq('hotel_id',hotel.id).in('source_status',['imported','live'])
        .gte('stay_date',from).lte('stay_date',to).order('stay_date',{ascending:true}).limit(500);
      if (result.error) throw result.error;
      const rows = (result.data ?? []) as HistoricalRow[];
      let totalRooms = 0, roomsSold = 0, revenue = 0;
      const currencies = new Set<string>();
      for (const row of rows) {
        const capacity = row.total_marketable_rooms == null ? null : Number(row.total_marketable_rooms);
        let sold = row.rooms_sold == null ? null : Number(row.rooms_sold);
        if (sold == null && row.occupancy_pct != null && capacity != null) sold = capacity*Number(row.occupancy_pct)/100;
        let accommodationRevenue = row.accommodation_revenue == null ? null : Number(row.accommodation_revenue);
        if (accommodationRevenue == null && row.adr_net != null && sold != null) accommodationRevenue = Number(row.adr_net)*sold;
        if (capacity == null || capacity<=0 || sold == null || sold<0 || accommodationRevenue == null || accommodationRevenue<0) continue;
        totalRooms += capacity;
        roomsSold += sold;
        revenue += accommodationRevenue;
        if (row.currency) currencies.add(row.currency.trim());
      }
      const validDays = rows.filter((row)=>row.total_marketable_rooms!=null && row.adr_net!=null && row.occupancy_pct!=null).length;
      const currency = currencies.size===1 ? [...currencies][0] : 'EUR';
      if (totalRooms<=0 || roomsSold<=0 || revenue<=0 || currencies.size>1) {
        setBaseline(null);
        if (currencies.size>1) setError('Plusieurs devises sont présentes dans l’historique : le calcul est bloqué.');
        return;
      }
      setBaseline({
        rows,days:validDays,totalRooms,roomsSold,revenue,
        occupancy:clamp(roomsSold/totalRooms*100,0,100),
        adr:revenue/roomsSold,
        revpar:revenue/totalRooms,
        currency,from,to,
      });
    } catch(cause) {
      setError(cause instanceof Error?cause.message:'Lecture des réalisations historiques impossible.');
      setBaseline(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  },[supabase,hotel?.id,periodDays]);

  useEffect(()=>{void load();},[load]);

  const scenario = useMemo(()=>{
    if (!baseline) return null;
    const scenarioADR = baseline.adr*(1+priceChangePct/100);
    const scenarioOccupancy = clamp(baseline.occupancy+occupancyDelta,0,100);
    const scenarioRevPAR = scenarioADR*scenarioOccupancy/100;
    const scenarioRoomsSold = baseline.totalRooms*scenarioOccupancy/100;
    const scenarioRevenue = scenarioADR*scenarioRoomsSold;
    return {
      adr:scenarioADR,
      occupancy:scenarioOccupancy,
      revpar:scenarioRevPAR,
      revenue:scenarioRevenue,
      deltaRevenue:scenarioRevenue-baseline.revenue,
      deltaRevPAR:scenarioRevPAR-baseline.revpar,
      deltaADR:scenarioADR-baseline.adr,
      roomsSold:scenarioRoomsSold,
    };
  },[baseline,priceChangePct,occupancyDelta]);

  const upcomingEvents = events.filter((event)=>event.endDate>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.startDate.localeCompare(b.startDate)).slice(0,5);

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Analyse de sensibilité · Données réelles</p><h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Simulateur d’impact RevPAR</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hotel?.name ?? 'Hôtel'} · scénarios calculés sur les réalisations journalières importées.</p></div>
        <div className="flex items-center gap-2"><select value={periodDays} onChange={(event)=>setPeriodDays(Number(event.target.value))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value={30}>30 derniers jours</option><option value={60}>60 derniers jours</option><option value={90}>90 derniers jours</option></select><button type="button" onClick={()=>void load(true)} disabled={loading||refreshing} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={15} className={refreshing?'animate-spin':''}/>Actualiser</button></div>
      </header>
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</div>}
      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Chargement des réalisations historiques…</div> : !baseline || !scenario ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900"><Database className="mx-auto h-8 w-8 text-slate-400"/><h2 className="mt-3 font-bold text-slate-900 dark:text-white">Historique réel insuffisant</h2><p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">Le simulateur attend des réalisations journalières importées dans hotel_historical_daily avec capacité commercialisable, chambres vendues, ADR net et chiffre d’affaires hébergement. Le planning Topsys transmis contient des stocks et tarifs futurs, pas ces réalisations. Aucun scénario fictif n’est calculé.</p></div>
      ) : <>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"><span>Période réelle : {baseline.from} → {baseline.to}</span><span>{baseline.days} jours avec ADR, TO et capacité exploitables · {baseline.rows.length} lignes sources</span></div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">ADR net observé</p><p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{currencyFormat(baseline.adr,baseline.currency)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">Occupation observée</p><p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{baseline.occupancy.toFixed(1)}%</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">RevPAR observé</p><p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{currencyFormat(baseline.revpar,baseline.currency)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">CA hébergement observé</p><p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{currencyFormat(baseline.revenue,baseline.currency)}</p></div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-bold text-slate-900 dark:text-white">Paramètres du scénario</h2>
            <label className="mt-5 block"><span className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200"><span>Variation tarifaire</span><span className="tabular-nums">{priceChangePct>0?'+':''}{priceChangePct}%</span></span><input type="range" min="-30" max="50" step="1" value={priceChangePct} onChange={(event)=>setPriceChangePct(Number(event.target.value))} className="mt-3 w-full"/><span className="mt-1 flex justify-between text-[10px] text-slate-400"><span>-30%</span><span>+50%</span></span></label>
            <label className="mt-6 block"><span className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200"><span>Variation d’occupation (points)</span><span className="tabular-nums">{occupancyDelta>0?'+':''}{occupancyDelta} pts</span></span><input type="range" min="-20" max="20" step="1" value={occupancyDelta} onChange={(event)=>setOccupancyDelta(Number(event.target.value))} className="mt-3 w-full"/><span className="mt-1 flex justify-between text-[10px] text-slate-400"><span>-20 pts</span><span>+20 pts</span></span></label>
            <div className="mt-5 flex gap-2"><button type="button" onClick={()=>{setPriceChangePct(0);setOccupancyDelta(0);}} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Réinitialiser</button><p className="self-center text-[10px] text-slate-500">Aucun tarif ni inventaire n’est modifié.</p></div>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5 dark:border-violet-900 dark:bg-violet-950/20">
            <h2 className="font-bold text-slate-900 dark:text-white">Résultat mécanique du scénario</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div><p className="text-xs text-slate-500">ADR simulé</p><p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{currencyFormat(scenario.adr,baseline.currency)}</p><p className="text-[10px] text-slate-500">Écart : {currencyFormat(scenario.deltaADR,baseline.currency)}</p></div>
              <div><p className="text-xs text-slate-500">Occupation simulée</p><p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{scenario.occupancy.toFixed(1)}%</p></div>
              <div><p className="text-xs text-slate-500">RevPAR simulé</p><p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{currencyFormat(scenario.revpar,baseline.currency)}</p><p className="text-[10px] text-slate-500">Écart : {currencyFormat(scenario.deltaRevPAR,baseline.currency)}</p></div>
              <div><p className="text-xs text-slate-500">CA hébergement simulé</p><p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{currencyFormat(scenario.revenue,baseline.currency)}</p><p className={scenario.deltaRevenue>=0?'text-[10px] font-semibold text-emerald-700':'text-[10px] font-semibold text-rose-700'}>{scenario.deltaRevenue>0?'+':''}{currencyFormat(scenario.deltaRevenue,baseline.currency)}</p></div>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-violet-600" style={{width:scenario.occupancy+'%'}}/></div><p className="mt-1 text-[10px] text-slate-500">Occupation simulée : {scenario.occupancy.toFixed(1)}% de la capacité commercialisable agrégée.</p>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><div className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0"/><div><strong>Limite méthodologique.</strong> Il s’agit d’une simulation de sensibilité, pas d’une prévision. L’occupation est modifiée manuellement et indépendamment du prix ; aucune élasticité tarifaire n’est supposée. L’effet prix/demande ne sera estimé qu’après calibration sur des expériences ou des observations comparables validées.</div></div></div>
        {upcomingEvents.length>0 && <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><h3 className="font-bold text-slate-900 dark:text-white">Événements validés à surveiller</h3><p className="mt-1 text-xs text-slate-500">Contexte fourni à titre informatif ; aucun lift événementiel n’est appliqué automatiquement au scénario.</p><div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">{upcomingEvents.map((event)=><button key={event.id} type="button" onClick={()=>onSelectEvent?.(event)} className="flex w-full items-center justify-between gap-3 py-2 text-left"><span><span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">{event.title}</span><span className="text-[10px] text-slate-500">{event.startDate} · {event.city}</span></span><span className="text-xs font-bold text-violet-700 dark:text-violet-300">{event.scoreBreakdown.finalRMScore}/100</span></button>)}</div></section>}
      </>
      }
    </section>
  );
};
