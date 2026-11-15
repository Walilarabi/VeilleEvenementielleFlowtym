import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Database, RefreshCw, Search, Zap, XCircle,
} from 'lucide-react';
import { EventCategory, EventEvidence, EventItem, EventScoreBreakdown, Hotel, ConfirmationStatus, RMImpactLevel } from '../../types';
import { useAuth } from '../../auth/AuthProvider';
import { decideHotelEventImpact, scoreHotelEventImpact } from '../../services/revenueApiClient';
import { RevPARImpactSimulator } from './RevPARImpactSimulator';

type OccurrenceRow = { id: string; event_id: string; start_date: string; end_date: string; date_status: string; attendance_estimate: number | null; notes: string | null };
type EventRow = { id: string; title: string; subtitle: string | null; category: string; venue_id: string | null; city: string | null; country_code: string | null; expected_attendance: number | null; international_ratio_pct: number | null; status: string; recurrence_frequency: string | null; official_url: string | null; created_at: string; last_verified_at: string | null };
type VenueRow = { id: string; name: string; city: string | null; country_code: string | null; address: string | null; latitude: number | null; longitude: number | null; capacity: number | null; venue_type: string | null };
type ImpactRow = {
  id: string; event_id: string; occurrence_id: string | null; distance_km: number | null; drive_time_minutes: number | null;
  attendance_score: number | null; international_score: number | null; duration_score: number | null; proximity_score: number | null;
  recurrence_score: number | null; capacity_score: number | null; notoriety_score: number | null; extra_nights_score: number | null;
  segment_fit_score: number | null; source_confidence_score: number | null; historical_demand_score: number | null;
  historical_demand_sample_count: number | null; final_rm_score: number | null; confidence_score: number | null;
  estimated_demand_lift_pct: number | null; estimated_adr_lift_pct: number | null; recommended_action: string | null;
  impact_status: 'to_review' | 'validated' | 'dismissed'; score_components: Record<string, any>; source_evidence: Record<string, any>;
};
type EvidenceRow = { id: string; event_id: string; occurrence_id: string | null; source_name: string | null; source_url: string | null; evidence_type: string | null; verified_at: string | null; captured_at: string | null; excerpt: string | null; trust_score: number | null };
type WorkspaceEvent = { occurrence: OccurrenceRow; event: EventRow; venue: VenueRow | null; impact: ImpactRow | null; evidence: EvidenceRow[] };
type ViewTab = 'compression' | 'recurrences' | 'pricing_rules' | 'revpar_simulator';
type DateFilter = 'active_upcoming' | 'past' | 'all';

const ALLOWED_CATEGORIES = new Set<EventCategory>(['salons_foires','congres_medical','concerts_spectacles','sport','festivals','mode_luxe','corporate_sommet','culturel','vacances_scolaires']);
const ALLOWED_STATUSES = new Set<ConfirmationStatus>(['confirmed','probable','estime','a_verifier','estimated_recurrent','announced_pending','rumored']);
const EVIDENCE_TYPES = new Set(['official_organizer','venue_calendar','press','ticketing','city_agenda']);
const todayISO = () => new Date().toISOString().slice(0,10);
const addDays = (date: string, days: number) => { const d = new Date(date+'T12:00:00'); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); };
const scoreLevel = (score: number): RMImpactLevel => score >= 80 ? 'hyper' : score >= 60 ? 'critique' : score >= 30 ? 'modere' : 'faible';
const fmtDate = (date: string) => new Date(date+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'});
const fmtNumber = (value: number | null | undefined, suffix = '') => value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('fr-FR',{maximumFractionDigits:1}) + suffix;

interface EventIntelligenceViewProps {
  events: EventItem[];
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectEvent: (event: EventItem) => void;
  defaultTab?: ViewTab;
  onOpenProposals?: () => void;
  pendingProposalsCount?: number;
}

export const EventIntelligenceView: React.FC<EventIntelligenceViewProps> = ({
  events, hotels, selectedHotelId, onSelectEvent, defaultTab = 'compression', onOpenProposals, pendingProposalsCount = 0,
}) => {
  const { supabase } = useAuth();
  const hotel = hotels.find((item) => item.id === selectedHotelId) ?? hotels[0];
  const [rows, setRows] = useState<WorkspaceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<ViewTab>(defaultTab);
  const [dateFilter, setDateFilter] = useState<DateFilter>('active_upcoming');
  const [search, setSearch] = useState('');
  const [busyOccurrenceId, setBusyOccurrenceId] = useState<string | null>(null);
  const [decisionReason, setDecisionReason] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!supabase || !hotel?.id) {
      setError('Session Supabase ou hôtel sélectionné indisponible.');
      setLoading(false);
      return;
    }
    if (quiet) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const today = todayISO();
      const from = addDays(today,-30);
      const to = addDays(today,365);
      const occurrenceResult = await supabase.from('event_occurrences')
        .select('id,event_id,start_date,end_date,date_status,attendance_estimate,notes')
        .gte('end_date',from).lte('start_date',to).order('start_date',{ascending:true}).limit(1500);
      if (occurrenceResult.error) throw occurrenceResult.error;
      const occurrences = (occurrenceResult.data ?? []) as OccurrenceRow[];
      const eventIds = [...new Set(occurrences.map((row)=>row.event_id))];
      if (eventIds.length === 0) { setRows([]); return; }
      const [eventResult, impactResult] = await Promise.all([
        supabase.from('events').select('id,title,subtitle,category,venue_id,city,country_code,expected_attendance,international_ratio_pct,status,recurrence_frequency,official_url,created_at,last_verified_at').in('id',eventIds),
        supabase.from('event_hotel_impacts').select('*').eq('hotel_id',hotel.id).in('event_id',eventIds),
      ]);
      if (eventResult.error) throw eventResult.error;
      if (impactResult.error) throw impactResult.error;
      const eventRows = (eventResult.data ?? []) as EventRow[];
      const impacts = (impactResult.data ?? []) as ImpactRow[];
      const venueIds = [...new Set(eventRows.map((row)=>row.venue_id).filter((id):id is string=>Boolean(id)))];
      const [venueResult,evidenceResult] = await Promise.all([
        venueIds.length ? supabase.from('venues').select('id,name,city,country_code,address,latitude,longitude,capacity,venue_type').in('id',venueIds) : Promise.resolve({data:[],error:null}),
        supabase.from('event_evidence').select('id,event_id,occurrence_id,source_name,source_url,evidence_type,verified_at,captured_at,excerpt,trust_score').in('event_id',eventIds),
      ]);
      if (venueResult.error) throw venueResult.error;
      if (evidenceResult.error) throw evidenceResult.error;
      const eventById = new Map<string,EventRow>(eventRows.map((row)=>[row.id,row]));
      const venueById = new Map<string,VenueRow>((venueResult.data ?? []).map((row:any)=>[row.id,row]));
      const impactByOccurrence = new Map<string,ImpactRow>();
      for (const impact of impacts) if (impact.occurrence_id) impactByOccurrence.set(impact.occurrence_id,impact);
      const evidenceByEvent = new Map<string,EvidenceRow[]>();
      for (const evidence of (evidenceResult.data ?? []) as EvidenceRow[]) {
        const list = evidenceByEvent.get(evidence.event_id) ?? [];
        list.push(evidence);
        evidenceByEvent.set(evidence.event_id,list);
      }
      const mapped: WorkspaceEvent[] = [];
      for (const occurrence of occurrences) {
        const event = eventById.get(occurrence.event_id);
        if (!event || !ALLOWED_CATEGORIES.has(event.category as EventCategory)) continue;
        const evidence = (evidenceByEvent.get(event.id) ?? []).filter((item)=>
          (!item.occurrence_id || item.occurrence_id === occurrence.id) &&
          Boolean(item.source_name && item.source_url && (item.verified_at || item.captured_at)) &&
          EVIDENCE_TYPES.has(String(item.evidence_type ?? ''))
        );
        const impact = impactByOccurrence.get(occurrence.id) ?? null;
        mapped.push({occurrence,event,venue:event.venue_id ? venueById.get(event.venue_id) ?? null : null,impact,evidence});
      }
      setRows(mapped);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement de l’intelligence événementielle impossible.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  },[supabase,hotel?.id]);

  useEffect(()=>{setTab(defaultTab);},[defaultTab]);
  useEffect(()=>{void load();},[load]);

  const filteredRows = useMemo(()=>{
    const today = todayISO();
    const q = search.trim().toLocaleLowerCase('fr-FR');
    return rows.filter((row)=>{
      const ongoing = row.occurrence.start_date <= today && row.occurrence.end_date >= today;
      const upcoming = row.occurrence.start_date > today;
      const past = row.occurrence.end_date < today;
      if (dateFilter==='active_upcoming' && !(ongoing || upcoming)) return false;
      if (dateFilter==='past' && !past) return false;
      if (tab==='recurrences' && !['annual','biennial'].includes(row.event.recurrence_frequency ?? '')) return false;
      if (tab==='pricing_rules' && !row.impact?.recommended_action) return false;
      if (q && ![row.event.title,row.event.city ?? '',row.venue?.name ?? '',row.event.category].join(' ').toLocaleLowerCase('fr-FR').includes(q)) return false;
      return true;
    }).sort((a,b)=>{
      const todayNow = todayISO();
      const aOngoing = a.occurrence.start_date <= todayNow && a.occurrence.end_date >= todayNow;
      const bOngoing = b.occurrence.start_date <= todayNow && b.occurrence.end_date >= todayNow;
      if (aOngoing!==bOngoing) return aOngoing ? -1 : 1;
      return a.occurrence.start_date.localeCompare(b.occurrence.start_date);
    });
  },[rows,dateFilter,tab,search]);

  const pending = rows.filter((row)=>row.impact?.impact_status==='to_review');
  const validated = rows.filter((row)=>row.impact?.impact_status==='validated');
  const ongoingCount = rows.filter((row)=>row.occurrence.start_date<=todayISO()&&row.occurrence.end_date>=todayISO()).length;
  const upcomingCount = rows.filter((row)=>row.occurrence.start_date>todayISO()).length;

  const toEventItem = (row: WorkspaceEvent): EventItem => {
    const existing = events.find((event)=>event.id===row.occurrence.id);
    if (existing) return existing;
    const impact = row.impact;
    const evidence: EventEvidence[] = row.evidence.map((item)=>({
      id:item.id,
      sourceName:item.source_name ?? 'Source non nommée',
      sourceUrl:item.source_url ?? '',
      sourceType:item.evidence_type as EventEvidence['sourceType'],
      verifiedAt:item.verified_at ?? item.captured_at ?? '',
      excerpt:item.excerpt ?? '',
      trustScore:Number(item.trust_score ?? 0),
    }));
    const score = Number(impact?.final_rm_score ?? 0);
    const scoreBreakdown: EventScoreBreakdown = {
      attendanceScore:Number(impact?.attendance_score ?? 0),
      internationalScore:Number(impact?.international_score ?? 0),
      saturationScore:Number(impact?.capacity_score ?? 0),
      proximityScore:Number(impact?.proximity_score ?? 0),
      compressionScore:Number(impact?.extra_nights_score ?? 0),
      finalRMScore:score,
      confidenceScore:Number(impact?.confidence_score ?? 0),
      durationScore:Number(impact?.duration_score ?? 0),
      recurrenceScore:Number(impact?.recurrence_score ?? 0),
      capacityScore:Number(impact?.capacity_score ?? 0),
      notorietyScore:Number(impact?.notoriety_score ?? 0),
      extraNightsScore:Number(impact?.extra_nights_score ?? 0),
      segmentFitScore:Number(impact?.segment_fit_score ?? 0),
      sourceConfidenceScore:Number(impact?.source_confidence_score ?? 0),
      historicalDemandScore:Number(impact?.historical_demand_score ?? 0),
      historicalDemandSampleCount:Number(impact?.historical_demand_sample_count ?? 0),
    };
    const status = ALLOWED_STATUSES.has(row.event.status as ConfirmationStatus) ? row.event.status as ConfirmationStatus : 'a_verifier';
    const hotelImpacts = impact && hotel ? {[hotel.id]:{
      hotelId:hotel.id,distanceKm:Number(impact.distance_km ?? 0),
      ...(impact.drive_time_minutes!=null?{distanceMins:Number(impact.drive_time_minutes)}:{}),
      ...(impact.estimated_demand_lift_pct!=null?{directDemandShare:Number(impact.estimated_demand_lift_pct)}:{}),
      estimatedADRBoostPercent:Number(impact.estimated_adr_lift_pct ?? 0),
      ...(impact.recommended_action?{recommendedAction:impact.recommended_action}:{})
    }} : {};
    return {
      id:row.occurrence.id,title:row.event.title,subtitle:row.event.subtitle ?? undefined,
      category:row.event.category as EventCategory,venueId:row.event.venue_id ?? '',venueName:row.venue?.name ?? 'Lieu non renseigné',
      city:row.event.city ?? hotel?.city ?? '',country:row.event.country_code ?? hotel?.country ?? '',
      startDate:row.occurrence.start_date,endDate:row.occurrence.end_date,
      expectedAttendance:Number(row.occurrence.attendance_estimate ?? row.event.expected_attendance ?? 0),
      internationalRatioPercent:Number(row.event.international_ratio_pct ?? 0),status,
      impactLevel:scoreLevel(score),scoreBreakdown,sources:[...new Set(evidence.map((item)=>item.sourceName))],
      evidences:evidence,hotelImpacts,
      isRecurring:['annual','biennial'].includes(row.event.recurrence_frequency ?? ''),
      ...(row.event.recurrence_frequency==='annual'||row.event.recurrence_frequency==='biennial'?{recurrenceFrequency:row.event.recurrence_frequency}:{}),
      notes:impact?.recommended_action ?? row.occurrence.notes ?? undefined,
      officialUrl:row.event.official_url ?? undefined,createdAt:row.event.created_at,
      lastVerifiedAt:row.event.last_verified_at ?? row.event.created_at,
    };
  };

  const calculateImpact = async (row:WorkspaceEvent) => {
    if (!supabase || !hotel?.id) return;
    if (hotel.lat==null || hotel.lng==null) { setError('Coordonnées GPS de l’hôtel manquantes : le calcul géographique est bloqué.'); return; }
    if (row.evidence.length===0) { setError('Aucune preuve événementielle vérifiée : le calcul d’impact est bloqué.'); return; }
    setBusyOccurrenceId(row.occurrence.id); setError(null); setActionMessage(null);
    try {
      await scoreHotelEventImpact(supabase,hotel.id,row.occurrence.id);
      setActionMessage('Impact calculé pour « ' + row.event.title + ' ». Il reste à valider humainement.');
      await load(true);
    } catch(cause) {
      setError(cause instanceof Error?cause.message:'Calcul de l’impact impossible.');
    } finally { setBusyOccurrenceId(null); }
  };

  const decideImpact = async (row:WorkspaceEvent,action:'validate'|'dismiss') => {
    if (!supabase || !hotel?.id) return;
    if (action==='dismiss' && decisionReason.trim().length<8) { setError('Précisez le motif du rejet (8 caractères minimum).'); return; }
    setBusyOccurrenceId(row.occurrence.id); setError(null); setActionMessage(null);
    try {
      await decideHotelEventImpact(supabase,hotel.id,row.occurrence.id,action,action==='validate'?'HOTEL_RM_VALIDATION':'HOTEL_RM_DISMISSAL',decisionReason.trim() || (action==='validate'?'Validation humaine après contrôle des sources.':undefined));
      setDecisionReason('');
      setActionMessage(action==='validate'?'Impact hôtel validé.':'Impact écarté.');
      await load(true);
    } catch(cause) {
      setError(cause instanceof Error?cause.message:'Décision sur l’impact impossible.');
    } finally { setBusyOccurrenceId(null); }
  };

  const tabItems: {id:ViewTab;label:string}[] = [
    {id:'compression',label:'Compression & événements'},
    {id:'recurrences',label:'Récurrences'},
    {id:'pricing_rules',label:'Règles tarifaires'},
    {id:'revpar_simulator',label:'Simulateur RevPAR'},
  ];

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Intelligence de marché · Sources vérifiées</p><h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Event Intelligence</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hotel?.name ?? 'Hôtel'} · impacts calculés à partir de preuves et validés avant exploitation Revenue.</p></div>
        <div className="flex flex-wrap gap-2">{onOpenProposals && <button type="button" onClick={onOpenProposals} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Propositions {pendingProposalsCount>0?'(' + pendingProposalsCount + ')':''}</button>}<button type="button" onClick={()=>void load(true)} disabled={refreshing||loading} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={15} className={refreshing?'animate-spin':''}/>Actualiser</button></div>
      </header>
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</div>}
      {actionMessage && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{actionMessage}</div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">En cours</p><p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{ongoingCount}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">À venir</p><p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{upcomingCount}</p></div>
        <div className="rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-900 dark:bg-slate-900"><p className="text-xs text-slate-500">À valider</p><p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-300">{pending.length}</p></div>
        <div className="rounded-2xl border border-emerald-200 bg-white p-4 dark:border-emerald-900 dark:bg-slate-900"><p className="text-xs text-slate-500">Impacts validés</p><p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{validated.length}</p></div>
      </div>
      <nav className="flex flex-wrap gap-2">{tabItems.map((item)=><button key={item.id} type="button" onClick={()=>setTab(item.id)} className={tab===item.id?'rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white':'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}>{item.label}</button>)}</nav>
      {tab==='revpar_simulator' ? <RevPARImpactSimulator events={events} hotels={hotels} selectedHotelId={selectedHotelId} onSelectEvent={onSelectEvent}/> : <>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setDateFilter('active_upcoming')} className={dateFilter==='active_upcoming'?'rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-slate-900':'rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700'}>En cours + à venir</button><button type="button" onClick={()=>setDateFilter('past')} className={dateFilter==='past'?'rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-slate-900':'rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700'}>Passés</button><button type="button" onClick={()=>setDateFilter('all')} className={dateFilter==='all'?'rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-slate-900':'rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700'}>Tous</button></div>
          <label className="relative block w-full sm:max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Événement, ville, lieu…" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"/></label>
        </div>
        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Chargement des événements, preuves et impacts hôtel…</div> : filteredRows.length===0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900"><Database className="mx-auto h-8 w-8 text-slate-400"/><h2 className="mt-3 font-bold text-slate-900 dark:text-white">Aucun événement dans cette période</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Aucun événement avec occurrence et données sources n’a été trouvé pour la période sélectionnée. Aucun score fictif n’est généré.</p></div> : <div className="grid gap-3 xl:grid-cols-2">
          {filteredRows.map((row)=>{
            const impact=row.impact;
            const status=impact?.impact_status ?? 'not_calculated';
            const eventItem=toEventItem(row);
            return <article key={row.occurrence.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">{row.event.category}</span><span className={status==='validated'?'rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300':status==='to_review'?'rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300':'rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300'}>{status==='validated'?'Impact validé':status==='to_review'?'À valider':status==='dismissed'?'Écarté':'Non calculé'}</span></div><h2 className="mt-2 text-base font-bold text-slate-900 dark:text-white">{row.event.title}</h2><p className="mt-1 text-xs text-slate-500">{fmtDate(row.occurrence.start_date)} – {fmtDate(row.occurrence.end_date)} · {row.event.city ?? hotel?.city} · {row.venue?.name ?? 'Lieu non renseigné'}</p></div><div className="shrink-0 text-right"><p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{impact?.final_rm_score ?? '—'}</p><p className="text-[10px] text-slate-500">Score RM /100</p></div></div>
              <div className="mt-3 grid grid-cols-3 gap-2"><div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><p className="text-[10px] text-slate-500">Fréquentation</p><p className="text-sm font-semibold text-slate-900 dark:text-white">{Number(row.occurrence.attendance_estimate ?? row.event.expected_attendance ?? 0)>0?Number(row.occurrence.attendance_estimate ?? row.event.expected_attendance).toLocaleString('fr-FR'):'—'}</p></div><div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><p className="text-[10px] text-slate-500">Distance</p><p className="text-sm font-semibold text-slate-900 dark:text-white">{fmtNumber(impact?.distance_km)} km</p></div><div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><p className="text-[10px] text-slate-500">Confiance</p><p className="text-sm font-semibold text-slate-900 dark:text-white">{fmtNumber(impact?.confidence_score,'%')}</p></div></div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">{row.evidence.length} preuve(s) vérifiée(s) · {impact?.recommended_action ?? 'Aucune action tarifaire calculée'}</p><button type="button" onClick={()=>onSelectEvent(eventItem)} className="text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300">Ouvrir la fiche</button></div>
              {impact && <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-violet-700 dark:text-violet-300">Composantes du score et preuves</summary><div className="mt-2 grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800"><p>Attendance : {fmtNumber(impact.attendance_score)}</p><p>International : {fmtNumber(impact.international_score)}</p><p>Durée : {fmtNumber(impact.duration_score)}</p><p>Proximité : {fmtNumber(impact.proximity_score)}</p><p>Capacité : {fmtNumber(impact.capacity_score)}</p><p>Récurrence : {fmtNumber(impact.recurrence_score)}</p><p>Notoriété : {fmtNumber(impact.notoriety_score)}</p><p>Nuits additionnelles : {fmtNumber(impact.extra_nights_score)}</p><p>Adéquation segment : {fmtNumber(impact.segment_fit_score)}</p><p>Demande historique : {fmtNumber(impact.historical_demand_score)} ({impact.historical_demand_sample_count ?? 0} obs.)</p></div><pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{JSON.stringify(impact.source_evidence ?? {},null,2)}</pre></div></details>}
              {status==='to_review' && <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800"><label className="block text-[10px] font-semibold text-slate-500">Motif si rejet (obligatoire pour écarter)<input value={decisionReason} onChange={(e)=>setDecisionReason(e.target.value)} placeholder="Motif de rejet…" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"/></label><div className="mt-2 flex gap-2"><button type="button" disabled={busyOccurrenceId===row.occurrence.id} onClick={()=>void decideImpact(row,'validate')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 size={13}/>Valider l’impact</button><button type="button" disabled={busyOccurrenceId===row.occurrence.id} onClick={()=>void decideImpact(row,'dismiss')} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300"><XCircle size={13}/>Écarter</button></div></div>}
              {!impact && <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800"><span className="text-[10px] text-slate-500">{hotel?.lat==null||hotel?.lng==null?'GPS hôtel manquant':row.evidence.length===0?'Aucune preuve vérifiée':'Prêt pour calcul'}</span><button type="button" disabled={busyOccurrenceId===row.occurrence.id||hotel?.lat==null||hotel?.lng==null||row.evidence.length===0} onClick={()=>void calculateImpact(row)} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-35"><Zap size={13}/>{busyOccurrenceId===row.occurrence.id?'Calcul…':'Calculer l’impact'}</button></div>}
            </article>;
          })}
        </div>}
      </>}
    </section>
  );
};
