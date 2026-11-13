import React from 'react';
import { AlertTriangle, Database } from 'lucide-react';
import { Hotel, EventItem } from '../../types';

interface RMDecisionCenterProps {
  hotel: Hotel;
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  onShowToast: (msg: string) => void;
}

/** The former decision center used localStorage, seeded alerts and random scores. */
export const RMDecisionCenter: React.FC<RMDecisionCenterProps> = ({ hotel }) => (
  <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <h2 className="text-base font-bold">Centre de décisions RM temporairement désactivé</h2>
        <p className="mt-2 text-sm">Pour {hotel.name}, les anciennes alertes et décisions étaient stockées dans le navigateur et incluaient des scores simulés. Elles ne sont pas des décisions métier persistées et ont été retirées.</p>
        <p className="mt-2 flex items-center gap-2 text-sm"><Database size={16} /> Réactivation après raccordement de l'audit RM, des alertes et des décisions à l'API Revenue authentifiée et aux tables RLS.</p>
      </div>
    </div>
  </section>
);
