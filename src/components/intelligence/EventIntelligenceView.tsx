import React from 'react';
import { AlertTriangle, Database } from 'lucide-react';
import { EventItem, Hotel } from '../../types';

interface EventIntelligenceViewProps {
  events: EventItem[];
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectEvent: (event: EventItem) => void;
  defaultTab?: 'compression' | 'recurrences' | 'pricing_rules' | 'revpar_simulator';
  onOpenProposals?: () => void;
  pendingProposalsCount?: number;
}

export const EventIntelligenceView: React.FC<EventIntelligenceViewProps> = ({ events, hotels, selectedHotelId }) => {
  const hotel = hotels.find((item) => item.id === selectedHotelId) ?? hotels[0];
  const operationalEvents = events.filter((event) => event.category !== 'vacances_scolaires');
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div>
        <h2 className="text-base font-bold">Event Intelligence en attente de données vérifiées</h2>
        <p className="mt-2 text-sm">{hotel?.name ?? 'Cet établissement'} : {operationalEvents.length} événement(s) opérationnel(s) transmis. Les anciens scores de compression, récurrences et simulations RevPAR reposaient sur des hypothèses et des valeurs codées en dur ; ils ont été retirés.</p>
        <p className="mt-2 flex items-center gap-2 text-sm"><Database size={16} /> Réactivation après ingestion des événements sourcés, des impacts hôtel validés et des données PMS/OTB.</p>
      </div></div>
      {operationalEvents.length > 0 ? <ul className="mt-4 space-y-2">{operationalEvents.map((event) => <li key={event.id} className="rounded-xl border border-amber-200/70 bg-white/60 p-3 text-sm dark:border-amber-800 dark:bg-black/10">{event.title} · {event.startDate}</li>)}</ul> : null}
    </section>
  );
};
