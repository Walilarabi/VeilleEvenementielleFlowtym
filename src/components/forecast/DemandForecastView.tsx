import React from 'react';
import { AlertTriangle, Database } from 'lucide-react';
import { Hotel, EventItem } from '../../types';

interface DemandForecastViewProps {
  hotel?: Hotel;
  events?: EventItem[];
  onSelectEvent?: (event: EventItem) => void;
  onGoToMarket?: () => void;
}

/** Forecasts remain disabled until actual PMS history and OTB snapshots are available. */
export const DemandForecastView: React.FC<DemandForecastViewProps> = ({ hotel }) => (
  <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <h2 className="text-base font-bold">Prévisions de demande non disponibles</h2>
        <p className="mt-2 text-sm">{hotel?.name ?? 'Cet établissement'} ne dispose pas encore d'un historique PMS réel ni de snapshots OTB vérifiés dans Supabase. L'ancienne courbe utilisait des dates et valeurs codées en dur ; elle a été retirée.</p>
        <p className="mt-2 flex items-center gap-2 text-sm"><Database size={16} /> Importer les réalisations quotidiennes, réservations, stocks et snapshots OTB avant de calculer une prévision.</p>
      </div>
    </div>
  </section>
);
