import React from 'react';
import { AlertTriangle, Database, X } from 'lucide-react';
import { Hotel } from '../../types';

interface RefreshModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotel: Hotel;
  onRefreshComplete: (
    newHighImpactEvents: never[],
    newProposals: never[],
    stats: { newCount: number; modifiedCount: number; cancelledCount: number; verifiedCount: number }
  ) => void;
  onOpenProposals: () => void;
}

/**
 * Deliberately prevents the old local/demo campaign from being presented as a
 * live verified crawl. The event ingestion and provenance pipeline is not yet
 * deployed and persisted for this tenant.
 */
export const RefreshModal: React.FC<RefreshModalProps> = ({ isOpen, onClose, hotel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="refresh-events-title">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"><Database className="h-5 w-5" /></span>
            <div><h2 id="refresh-events-title" className="text-base font-bold text-slate-900 dark:text-slate-100">Veille événementielle non connectée</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hotel.name} · {hotel.city}</p></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </header>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>Aucune campagne de collecte ne sera lancée. L'ancien écran exécutait une simulation locale avec des compteurs et résultats non persistés. Il a été neutralisé pour ne pas présenter ces données comme une veille réelle.</p></div>
        </div>
        <p className="mt-4 text-xs text-slate-600 dark:text-slate-300">La fonction sera réactivée après raccordement des sources officielles, de la géolocalisation de l'hôtel, de la traçabilité des collectes et de l'enregistrement Supabase.</p>
        <footer className="mt-6 flex justify-end"><button type="button" onClick={onClose} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900">Fermer</button></footer>
      </section>
    </div>
  );
};
