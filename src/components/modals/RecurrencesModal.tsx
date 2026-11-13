import React from 'react';
import { X, Repeat, Calendar, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { EventItem } from '../../types';
import { formatEventDateRange, getCategoryLabel } from '../../utils/helpers';

interface RecurrencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
}

export const RecurrencesModal: React.FC<RecurrencesModalProps> = ({
  isOpen,
  onClose,
  events,
  onSelectEvent,
}) => {
  if (!isOpen) return null;

  const recurrentEvents = events.filter((e) => e.isRecurring);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 flex items-center justify-center">
              <Repeat className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Matrice des Événements Récurrents
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Suivi pluriannuel des salons, foires et congrès récurrents ({recurrentEvents.length} identifiés)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Table */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="bg-violet-50/70 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/70 rounded-xl p-3 text-xs text-violet-900 dark:text-violet-200 flex items-center justify-between">
            <span>
              💡 <strong>Anticipation RM :</strong> Les événements récurrents vous permettent d&apos;aligner vos grilles tarifaires 12 à 24 mois avant l&apos;ouverture des réservations directes.
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
            {recurrentEvents.map((ev) => (
              <div
                key={ev.id}
                onClick={() => {
                  onSelectEvent(ev);
                  onClose();
                }}
                className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-violet-700 transition-colors">
                      {ev.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      ({getCategoryLabel(ev.category)})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span>{formatEventDateRange(ev.startDate, ev.endDate)}</span>
                    <span className="text-slate-300">·</span>
                    <span>{ev.venueName} ({ev.city})</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                      Score RM {ev.scoreBreakdown.finalRMScore}/100
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Fréquence {ev.recurrenceFrequency === 'biennial' ? 'Biennale' : 'Annuelle'}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-violet-600 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
