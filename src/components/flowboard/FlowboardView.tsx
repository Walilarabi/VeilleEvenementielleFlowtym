import React, { useMemo } from 'react';
import {
  CalendarDays, Compass, MapPin, ArrowUpRight, ShieldCheck, AlertTriangle,
  CheckCircle2, Clock3, Building2, Users, TrendingUp, Database,
} from 'lucide-react';
import { EventItem, EventSource, Hotel, Venue } from '../../types';

interface FlowboardViewProps {
  events: EventItem[];
  sources: EventSource[];
  venues: Venue[];
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectEvent: (event: EventItem) => void;
  onGoToExplorer: () => void;
  onGoToCalendar: () => void;
  onGoToSchoolHolidays?: () => void;
  onGoToOpportunities?: () => void;
}

const dateISO = () => new Date().toISOString().slice(0,10);
const formatDate = (date:string) => new Date(date+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
const scoreOf = (event:EventItem) => Number(event.scoreBreakdown?.finalRMScore ?? 0);

export const FlowboardView: React.FC<FlowboardViewProps> = ({
  events,sources,venues,hotels,selectedHotelId,onSelectEvent,onGoToExplorer,onGoToCalendar,onGoToSchoolHolidays,onGoToOpportunities,
}) => {
  const hotel = hotels.find((item)=>item.id===selectedHotelId) ?? hotels[0];
  const today = dateISO();
  const operationalEvents = events.filter((event)=>event.category!=='vacances_scolaires');
  const currentEvents = operationalEvents.filter((event)=>event.startDate<=today && event.endDate>=today).sort((a,b)=>scoreOf(b)-scoreOf(a));
  const upcomingEvents = operationalEvents.filter((event)=>event.startDate>today).sort((a,b)=>a.startDate.localeCompare(b.startDate));
  const highImpactEvents = operationalEvents.filter((event)=>event.endDate>=today && scoreOf(event)>=60).sort((a,b)=>scoreOf(b)-scoreOf(a));
  const healthySources = sources.filter((source)=>source.status==='healthy').length;
  const warningSources = sources.filter((source)=>source.status==='warning').length;
  const errorSources = sources.filter((source)=>source.status==='error').length;
  const officialSources = sources.filter((source)=>source.isOfficial).length;
  const nextEvents = [...currentEvents,...upcomingEvents].slice(0,8);
  const coverageRatio = sources.length ? Math.round(healthySources/sources.length*100) : null;

  const summary = useMemo(()=>({
    ongoing:currentEvents.length,
    upcoming:upcomingEvents.length,
    highImpact:highImpactEvents.length,
    sourceTotal:sources.length,
  }),[currentEvents.length,upcomingEvents.length,highImpactEvents.length,sources.length]);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Flowtym · Revenue Management</p><h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{hotel?.name ?? 'Flowboard hôtelier'}</h1><p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><MapPin size={14}/>{hotel?.city ?? 'Ville non renseignée'} · {hotel?.roomCount ?? '—'} chambres · {hotel?.stars ? hotel.stars + ' étoiles' : 'Catégorie non renseignée'}</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onGoToCalendar} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white"><CalendarDays size={16}/>Calendrier</button>
            <button type="button" onClick={onGoToExplorer} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"><Compass size={16}/>Explorer</button>
            {onGoToSchoolHolidays && <button type="button" onClick={onGoToSchoolHolidays} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Vacances scolaires</button>}
            {onGoToOpportunities && <button type="button" onClick={onGoToOpportunities} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Opportunités</button>}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><p className="text-xs text-slate-500">Événements en cours</p><Clock3 size={16} className="text-violet-600"/></div><p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{summary.ongoing}</p><p className="mt-1 text-[10px] text-slate-500">Impacts hôtel validés</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><p className="text-xs text-slate-500">Événements à venir</p><CalendarDays size={16} className="text-violet-600"/></div><p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{summary.upcoming}</p><p className="mt-1 text-[10px] text-slate-500">Dans le périmètre hôtelier</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><p className="text-xs text-slate-500">Fort impact RM</p><TrendingUp size={16} className="text-emerald-600"/></div><p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{summary.highImpact}</p><p className="mt-1 text-[10px] text-slate-500">Score hôtel ≥ 60/100</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><p className="text-xs text-slate-500">Sources vérifiées</p><ShieldCheck size={16} className="text-violet-600"/></div><p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{summary.sourceTotal}</p><p className="mt-1 text-[10px] text-slate-500">{officialSources} officielles · {healthySources} saines</p></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800"><div><h2 className="font-bold text-slate-900 dark:text-white">Agenda opérationnel</h2><p className="mt-1 text-xs text-slate-500">Événements en cours en premier, puis prochaines dates</p></div><button type="button" onClick={onGoToCalendar} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 dark:text-violet-300">Tout voir <ArrowUpRight size={13}/></button></div>
          {nextEvents.length===0 ? <div className="p-8 text-center"><Database className="mx-auto h-7 w-7 text-slate-400"/><h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">Aucun impact événementiel validé</h3><p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">Le calendrier ne présente pas de données de démonstration. Les événements apparaîtront après vérification des sources, calcul et validation de leur impact hôtelier.</p><button type="button" onClick={onGoToExplorer} className="mt-4 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white">Explorer les événements</button></div> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{nextEvents.map((event)=>{const ongoing=event.startDate<=today&&event.endDate>=today;return <button key={event.id} type="button" onClick={()=>onSelectEvent(event)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{event.title}</span>{ongoing&&<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">EN COURS</span>}</span><span className="mt-1 block text-xs text-slate-500">{formatDate(event.startDate)} – {formatDate(event.endDate)} · {event.city}</span></span><span className="shrink-0 text-right"><span className="block text-sm font-bold tabular-nums text-slate-900 dark:text-white">{scoreOf(event)}/100</span><span className="text-[10px] text-slate-500">Score RM</span></span></button>;})}</div>}
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between"><h2 className="font-bold text-slate-900 dark:text-white">Couverture des sources</h2><Database size={16} className="text-slate-400"/></div>
            {sources.length===0 ? <p className="mt-3 text-xs text-slate-500">Aucune source associée aux événements validés pour cet hôtel. Cela ne signifie pas qu'aucun fournisseur n'est configuré.</p> : <>
              <div className="mt-3 flex items-end justify-between"><p className="text-2xl font-bold text-slate-900 dark:text-white">{coverageRatio}%</p><p className="text-[10px] text-slate-500">{healthySources}/{sources.length} sources saines</p></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{width:coverageRatio+'%'}}/></div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]"><div><p className="font-bold text-emerald-700 dark:text-emerald-300">{healthySources}</p><p className="text-slate-500">Saines</p></div><div><p className="font-bold text-amber-700 dark:text-amber-300">{warningSources}</p><p className="text-slate-500">Alertes</p></div><div><p className="font-bold text-rose-700 dark:text-rose-300">{errorSources}</p><p className="text-slate-500">Erreurs</p></div></div>
            </>}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between"><h2 className="font-bold text-slate-900 dark:text-white">Opportunités prioritaires</h2><TrendingUp size={16} className="text-emerald-600"/></div>
            {highImpactEvents.length===0 ? <p className="mt-3 text-xs text-slate-500">Aucun événement validé avec un score RM supérieur ou égal à 60 pour la période à venir.</p> : <div className="mt-3 space-y-2">{highImpactEvents.slice(0,4).map((event)=><button key={event.id} type="button" onClick={()=>onSelectEvent(event)} className="flex w-full items-center justify-between gap-3 rounded-lg bg-slate-50 p-2.5 text-left dark:bg-slate-800"><span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-900 dark:text-white">{event.title}</span><span className="text-[10px] text-slate-500">{formatDate(event.startDate)} · {event.city}</span></span><span className="shrink-0 text-sm font-bold text-emerald-700 dark:text-emerald-300">{scoreOf(event)}</span></button>)}</div>}
          </section>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900"><span className="inline-flex items-center gap-2"><Building2 size={14}/> {venues.length} lieux associés aux événements validés · {operationalEvents.length} événements opérationnels</span><span>Les indicateurs reflètent uniquement les données chargées et validées pour l’hôtel sélectionné.</span></footer>
    </section>
  );
};
