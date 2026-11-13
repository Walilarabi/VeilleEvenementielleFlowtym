import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Sparkles,
  Calendar,
  MapPin,
  TrendingUp,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { EventProposal, EventItem } from '../../types';
import { getRMScoreColorClasses } from '../../utils/helpers';

interface ProposalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposals: EventProposal[];
  onAcceptProposal: (proposalId: string) => void;
  onRefuseProposal: (proposalId: string) => void;
  onRestoreProposal: (proposalId: string) => void;
}

export const ProposalsModal: React.FC<ProposalsModalProps> = ({
  isOpen,
  onClose,
  proposals,
  onAcceptProposal,
  onRefuseProposal,
  onRestoreProposal,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'refused'>('pending');

  if (!isOpen) return null;

  const pendingProposals = proposals.filter((p) => p.status === 'pending');
  const refusedProposals = proposals.filter((p) => p.status === 'refused');
  const acceptedProposals = proposals.filter((p) => p.status === 'accepted');

  const displayedProposals = proposals.filter((p) => {
    if (filterTab === 'pending') return p.status === 'pending';
    if (filterTab === 'refused') return p.status === 'refused';
    return true; // all
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Propositions d&apos;Événements à Valider
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                  Impact Moyen · Score 30 à 59
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Événements détectés par le moteur intelligent nécessitant l&apos;approbation du Revenue Manager
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter sub-bar */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterTab('pending')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                filterTab === 'pending'
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              En attente ({pendingProposals.length})
            </button>
            <button
              onClick={() => setFilterTab('refused')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                filterTab === 'refused'
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Refusés ({refusedProposals.length})
            </button>
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                filterTab === 'all'
                  ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-200'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Tous ({proposals.length})
            </button>
          </div>

          <div className="text-[11px] text-slate-400">
            {acceptedProposals.length} validés & intégrés
          </div>
        </div>

        {/* Proposals List */}
        <div className="p-6 overflow-y-auto space-y-3.5">
          {displayedProposals.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">Aucune proposition dans cette catégorie</p>
              <p className="text-[11px]">Toutes les détections d&apos;impact moyen ont été traitées.</p>
            </div>
          ) : (
            displayedProposals.map((prop) => {
              const scoreStyles = getRMScoreColorClasses(prop.score);
              const isRefused = prop.status === 'refused';
              const isAccepted = prop.status === 'accepted';

              return (
                <div
                  key={prop.id}
                  className={`p-4 rounded-2xl border transition-all space-y-3 ${
                    isRefused
                      ? 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 opacity-70'
                      : isAccepted
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs hover:border-amber-300 dark:hover:border-amber-600/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {/* Title: Strikethrough if refused */}
                        <h4
                          className={`font-bold text-sm ${
                            isRefused
                              ? 'line-through text-slate-400'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {prop.title}
                        </h4>

                        {/* Status Badge */}
                        {isAccepted && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70">
                            Validé
                          </span>
                        )}
                        {isRefused && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70">
                            Refusé
                          </span>
                        )}
                      </div>

                      {prop.subtitle && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">{prop.subtitle}</div>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{prop.startDate} → {prop.endDate}</span>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{prop.venueName} ({prop.city})</span>
                        </span>
                        <span>·</span>
                        <span>{prop.expectedAttendance.toLocaleString('fr-FR')} pax attendus</span>
                      </div>

                      <div className="text-[11px] text-slate-400 pt-1">
                        Source : {prop.detectedSource}
                      </div>
                    </div>

                    {/* Score RM pastel badge */}
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Score RM</div>
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-md font-extrabold text-xs mt-0.5 border ${scoreStyles.badge}`}
                      >
                        {prop.score}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Impact prévisionnel : <strong>Moyen</strong> (Surveillance pricing)
                    </span>

                    <div className="flex items-center gap-2">
                      {prop.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => onRefuseProposal(prop.id)}
                            className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl transition-colors flex items-center gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            <span>Refuser</span>
                          </button>
                          <button
                            onClick={() => onAcceptProposal(prop.id)}
                            className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Accepter</span>
                          </button>
                        </>
                      ) : isRefused ? (
                        <button
                          onClick={() => onRestoreProposal(prop.id)}
                          className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Rétablir l&apos;événement</span>
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Intégré au calendrier</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800/80 flex justify-end bg-slate-50/70 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
