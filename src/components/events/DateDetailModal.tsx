import React from 'react';
import { AlertTriangle, Database, X } from 'lucide-react';
import { EventItem, Hotel } from '../../types';

interface DateDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  hotel: Hotel;
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  onApplyRecommendation?: (dateStr: string, recommendedRate: number) => void;
}

/** The legacy day-detail panel used synthetic Compset and D-EDGE values. */
export const DateDetailModal: React.FC<DateDetailModalProps> = ({ isOpen, onClose, dateStr, hotel }) => {
  if (!isOpen || !dateStr) return null;
  const formattedDate = new Date(`${dateStr}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="day-detail-title">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header className="flex items-start justify-between gap-4">
          <div><h2 id="day-detail-title" className="text-lg font-bold text-slate-900 dark:text-white">Détail indisponible</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formattedDate} · {hotel.name}</p></div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </header>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>Les anciennes estimations de tarif, de CompSet et de stock D-EDGE provenaient de données simulées. Elles ont été retirées. Aucun tarif recommandé ni impact événementiel ne sera affiché sans sources réelles persistées.</p></div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><Database className="h-4 w-4" /> En attente des imports PMS/D-EDGE, Lighthouse et des événements vérifiés.</p>
        <footer className="mt-6 flex justify-end"><button type="button" onClick={onClose} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900">Fermer</button></footer>
      </section>
    </div>
  );
};
