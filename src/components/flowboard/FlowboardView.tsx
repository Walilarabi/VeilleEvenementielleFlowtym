import React from 'react';
import { CalendarDays, Compass, Database, Info } from 'lucide-react';
import { EventItem, EventSuggestion, Hotel } from '../../types';

interface FlowboardViewProps {
  events: EventItem[];
  suggestions: EventSuggestion[];
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectEvent: (event: EventItem) => void;
  onApproveSuggestion: (id: string) => void;
  onDismissSuggestion: (id: string) => void;
  onGoToExplorer: () => void;
  onGoToCalendar: () => void;
  onGoToSchoolHolidays?: () => void;
  onGoToOpportunities?: () => void;
}

export const FlowboardView: React.FC<FlowboardViewProps> = ({ events, suggestions, hotels, selectedHotelId, onSelectEvent, onGoToExplorer, onGoToCalendar }) => {
  const hotel = hotels.find((item) => item.id === selectedHotelId) ?? hotels[0];
  const sortedEvents = [...events].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Flowboard</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{hotel?.name ?? 'Portefeuille hôtelier'}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Vue de synthèse alimentée uniquement par les événements et propositions enregistrés.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><div className="text-xs text-slate-500">Événements persistés</div><div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{events.length}</div></div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><div className="text-xs text-slate-500">Propositions en attente</div><div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{suggestions.filter((item) => item.status === 'pending').length}</div></div>
          <div className="col-span-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800 sm:col-span-1"><div className="text-xs text-slate-500">Sources connectées</div><div className="mt-1 text-sm font-semibold text-amber-700 dark:text-amber-300">Non raccordées</div></div>
        </div>
      </header>

      {sortedEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <Database className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">Aucun événement réel enregistré</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">Les événements de démonstration et les recommandations codées en dur ont été retirés. Le Flowboard se remplira lorsque les sources officielles, les preuves et les événements seront importés et validés dans Supabase.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={onGoToCalendar} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white"><CalendarDays size={16} /> Calendrier</button>
            <button type="button" onClick={onGoToExplorer} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"><Compass size={16} /> Explorer</button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-4 text-sm font-bold dark:border-slate-800 dark:text-white">Événements enregistrés</div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedEvents.map((event) => <button key={event.id} type="button" onClick={() => onSelectEvent(event)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"><span><span className="block text-sm font-semibold text-slate-900 dark:text-white">{event.title}</span><span className="mt-1 block text-xs text-slate-500">{event.startDate} · {event.city}</span></span><Info size={16} className="shrink-0 text-slate-400" /></button>)}
          </div>
        </div>
      )}
    </section>
  );
};
