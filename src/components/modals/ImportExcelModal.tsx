import React from 'react';
import { AlertTriangle, Database, X } from 'lucide-react';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportEvents: (newEvents: never[]) => void;
}

/** Read-only until a persisted event-ingestion endpoint exists. */
export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="event-import-title">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"><Database className="h-5 w-5" /></span>
            <div><h2 id="event-import-title" className="text-base font-bold text-slate-900 dark:text-slate-100">Import événementiel indisponible</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Le fichier ne sera pas importé ni enregistré.</p></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </header>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>Le backend d'ingestion des événements n'est pas raccordé à cette interface. L'ancien écran simulait la lecture d'un fichier et affichait de faux événements ; ce comportement a été retiré pour éviter de polluer le calendrier.</p></div>
        </div>
        <p className="mt-4 text-xs text-slate-600 dark:text-slate-300">Le raccordement sera activé lorsque l'import réel, la validation des colonnes et l'enregistrement Supabase seront disponibles.</p>
        <footer className="mt-6 flex justify-end"><button type="button" onClick={onClose} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900">Fermer</button></footer>
      </section>
    </div>
  );
};
