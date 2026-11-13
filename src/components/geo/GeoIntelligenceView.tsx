import React from 'react';
import { AlertTriangle, MapPin } from 'lucide-react';
import { Hotel, EventItem } from '../../types';

interface GeoIntelligenceViewProps {
  hotels: Hotel[];
  selectedHotelId: string;
  events?: EventItem[];
  onSelectHotel: (hotelId: string) => void;
  onSelectEvent?: (event: EventItem) => void;
  onShowToast: (message: string) => void;
}

/** Geographic discovery is intentionally blocked until hotel coordinates and venue data are persisted. */
export const GeoIntelligenceView: React.FC<GeoIntelligenceViewProps> = ({ hotels, selectedHotelId }) => {
  const hotel = hotels.find((item) => item.id === selectedHotelId) ?? hotels[0];
  const hasCoordinates = hotel?.lat !== null && hotel?.lat !== undefined && hotel?.lng !== null && hotel?.lng !== undefined;

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-amber-100 p-3 text-amber-800 dark:bg-amber-950 dark:text-amber-300"><MapPin size={22} /></span>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Intelligence géographique en attente de données vérifiées</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hotel?.name ?? 'Aucun hôtel sélectionné'} · {hotel?.address ?? 'Adresse inconnue'} · {hotel?.city ?? ''}</p>
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="flex items-start gap-2"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><p>{hasCoordinates ? 'Les coordonnées sont renseignées, mais le référentiel des lieux et la collecte géographique persistante ne sont pas raccordés. Aucun scan simulé ne sera présenté comme réel.' : 'Les coordonnées latitude/longitude de cet hôtel ne sont pas renseignées dans Supabase. La carte, les distances et les temps de trajet sont donc désactivés.'}</p></div>
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>Coordonnées GPS issues de la fiche hôtel Supabase</li>
          <li>Référentiel des lieux et événements dans le bassin géographique de l'hôtel</li>
          <li>Sources officielles, dates de collecte et preuves persistées</li>
          <li>Calcul des distances et impacts uniquement à partir de données vérifiées</li>
        </ul>
      </div>
    </section>
  );
};
