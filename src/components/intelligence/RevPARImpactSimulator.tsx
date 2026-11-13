import React from 'react';
import { AlertTriangle, Database } from 'lucide-react';
import { EventItem, Hotel } from '../../types';

interface RevPARImpactSimulatorProps {
  events: EventItem[];
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectEvent?: (event: EventItem) => void;
  onSelectHotel?: (hotelId: string) => void;
}

/** Scenario calculations are withheld until real occupancy and ADR baselines exist. */
export const RevPARImpactSimulator: React.FC<RevPARImpactSimulatorProps> = ({ hotels, selectedHotelId }) => {
  const hotel = hotels.find((item) => item.id === selectedHotelId) ?? hotels[0];
  return (
    <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div>
        <h2 className="text-base font-bold">Simulation RevPAR désactivée</h2>
        <p className="mt-2 text-sm">Aucun scénario n'est calculé pour {hotel?.name ?? 'cet établissement'} sans ADR, occupation et RevPAR réels, ni historique d'événements vérifiés. Les anciens scénarios reposaient sur une occupation de base et des multiplicateurs saisis arbitrairement.</p>
        <p className="mt-2 flex items-center gap-2 text-sm"><Database size={16} /> Importer les réalisations PMS et snapshots OTB avant de comparer des scénarios.</p>
      </div></div>
    </section>
  );
};
