import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Search,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Zap,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  X,
  Layers,
} from 'lucide-react';
import { EventItem, EventProposal, Hotel } from '../../types';

interface RefreshModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotel: Hotel;
  onRefreshComplete: (
    newHighImpactEvents: EventItem[],
    newProposals: EventProposal[],
    stats: { newCount: number; modifiedCount: number; cancelledCount: number; verifiedCount: number }
  ) => void;
  onOpenProposals: () => void;
}

interface StepItem {
  id: number;
  label: string;
  detail: string;
}

const REFRESH_STEPS: StepItem[] = [
  { id: 1, label: 'Recherche des nouvelles sources', detail: 'Exploration des flux billetteries, Viparis, bureaux des congrès et agendas municipaux' },
  { id: 2, label: 'Analyse des événements', detail: 'Qualification des catégories, jauges attendues et ratios internationaux' },
  { id: 3, label: 'Vérification des dates', detail: 'Contrôle croisé des dates officielles et détection des annonces anticipées' },
  { id: 4, label: 'Détection des modifications & annulations', detail: 'Audit des changements de programmation et suppressions de dates' },
  { id: 5, label: 'Calcul des scores RM', detail: 'Calcul de la pression de marché et de l’indice de compression pour votre hôtel' },
  { id: 6, label: 'Mise à jour du calendrier', detail: 'Intégration automatique des scores ≥ 60 et préparation des propositions à valider' },
];

export const RefreshModal: React.FC<RefreshModalProps> = ({
  isOpen,
  onClose,
  hotel,
  onRefreshComplete,
  onOpenProposals,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [progressPercent, setProgressPercent] = useState(15);
  const [isFinished, setIsFinished] = useState(false);

  // Live counters
  const [stats, setStats] = useState({
    newCount: 0,
    modifiedCount: 0,
    cancelledCount: 0,
    verifiedCount: 106,
  });

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setProgressPercent(15);
      setIsFinished(false);
      setStats({ newCount: 0, modifiedCount: 0, cancelledCount: 0, verifiedCount: 106 });
      return;
    }

    // Step progression timer
    const t1 = setTimeout(() => {
      setCurrentStep(2);
      setProgressPercent(32);
      setStats((s) => ({ ...s, newCount: 2, verifiedCount: 110 }));
    }, 700);

    const t2 = setTimeout(() => {
      setCurrentStep(3);
      setProgressPercent(50);
      setStats((s) => ({ ...s, newCount: 3, modifiedCount: 1, verifiedCount: 112 }));
    }, 1400);

    const t3 = setTimeout(() => {
      setCurrentStep(4);
      setProgressPercent(68);
      setStats((s) => ({ ...s, newCount: 4, modifiedCount: 2, cancelledCount: 0 }));
    }, 2100);

    const t4 = setTimeout(() => {
      setCurrentStep(5);
      setProgressPercent(85);
      setStats((s) => ({ ...s, newCount: 5, verifiedCount: 118 }));
    }, 2800);

    const t5 = setTimeout(() => {
      setCurrentStep(6);
      setProgressPercent(100);
      setIsFinished(true);

      // Create new high-impact events (Score >= 60, auto-integrated)
      const newHighImpact: EventItem[] = [
        {
          id: `ev-ref-high-${Date.now()}`,
          title: 'Congrès International des Neurosciences 2026',
          subtitle: 'FENS Federation of European Neuroscience Societies',
          category: 'congres_medical',
          venueId: 'venue-porte-versailles',
          venueName: 'Porte de Versailles',
          city: hotel.city || 'Paris',
          country: 'France',
          startDate: '2026-11-18',
          endDate: '2026-11-22',
          expectedAttendance: 24000,
          internationalRatioPercent: 82,
          status: 'confirmed',
          impactLevel: 'critique',
          scoreBreakdown: {
            attendanceScore: 18,
            internationalScore: 19,
            saturationScore: 16,
            proximityScore: 14,
            compressionScore: 11,
            finalRMScore: 78,
            confidenceScore: 99,
          },
          sources: ['FENS Official Registry', 'Viparis Dates 2026'],
          evidences: [],
          hotelImpacts: {},
          isRecurring: true,
          recurrenceFrequency: 'biennial',
          isFavorite: false,
          isWatchlist: false,
          isYieldActive: true,
          createdAt: new Date().toISOString().slice(0, 10),
          lastVerifiedAt: new Date().toISOString().slice(0, 10),
        },
      ];

      // Create new medium-impact proposals (Score 30-59, pending user approval)
      const newProposals: EventProposal[] = [
        {
          id: `prop-${Date.now()}-1`,
          title: 'Salon du Vélo Urbain & Mobilités Douces',
          subtitle: 'Écomobilité urbaine',
          category: 'salons_foires',
          city: hotel.city || 'Paris',
          venueName: 'Porte de Versailles',
          startDate: '2026-11-27',
          endDate: '2026-11-29',
          expectedAttendance: 19000,
          score: 48,
          status: 'pending',
          detectedSource: 'Fédération des Usagers de la Bicyclette (FUB)',
          impactLevel: 'modere',
        },
        {
          id: `prop-${Date.now()}-2`,
          title: 'Championnat d’Europe d’Escrime Junior',
          subtitle: 'Escrime épée & fleuret',
          category: 'sport',
          city: hotel.city || 'Paris',
          venueName: 'Halle Carpentier',
          startDate: '2026-12-04',
          endDate: '2026-12-06',
          expectedAttendance: 8500,
          score: 36,
          status: 'pending',
          detectedSource: 'Fédération Française d’Escrime',
          impactLevel: 'modere',
        },
      ];

      onRefreshComplete(newHighImpact, newProposals, {
        newCount: 5,
        modifiedCount: 2,
        cancelledCount: 0,
        verifiedCount: 118,
      });
    }, 3400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${isFinished ? 'bg-emerald-600' : 'bg-violet-600'} transition-colors`}>
              <RotateCcw className={`w-4 h-4 ${!isFinished ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isFinished ? 'Actualisation Terminée' : 'Actualisation Événementielle en Cours...'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Moteur d&apos;intelligence événementielle Flowtym pour {hotel.name} ({hotel.city})
              </p>
            </div>
          </div>

          {isFinished && (
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-700">Progression globale</span>
              <span className="text-violet-700 tabular-nums">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-violet-600 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Metric Counters Grid */}
          <div className="grid grid-cols-4 gap-2.5">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70 text-center">
              <div className="text-[10px] font-bold uppercase text-slate-400">Nouveaux</div>
              <div className="text-lg font-extrabold text-emerald-600 tabular-nums mt-0.5">
                +{stats.newCount}
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70 text-center">
              <div className="text-[10px] font-bold uppercase text-slate-400">Modifiés</div>
              <div className="text-lg font-extrabold text-amber-600 tabular-nums mt-0.5">
                {stats.modifiedCount}
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70 text-center">
              <div className="text-[10px] font-bold uppercase text-slate-400">Annulés</div>
              <div className="text-lg font-extrabold text-slate-400 tabular-nums mt-0.5">
                {stats.cancelledCount}
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70 text-center">
              <div className="text-[10px] font-bold uppercase text-slate-400">Vérifiés</div>
              <div className="text-lg font-extrabold text-violet-700 tabular-nums mt-0.5">
                {stats.verifiedCount}
              </div>
            </div>
          </div>

          {/* Steps List */}
          <div className="space-y-2.5">
            {REFRESH_STEPS.map((step) => {
              const isPast = step.id < currentStep || isFinished;
              const isCurrent = step.id === currentStep && !isFinished;

              return (
                <div
                  key={step.id}
                  className={`p-3 rounded-xl border text-xs transition-all flex items-start gap-3 ${
                    isCurrent
                      ? 'bg-violet-50/80 border-violet-200 shadow-2xs'
                      : isPast
                      ? 'bg-white border-slate-200/80'
                      : 'bg-slate-50/50 border-slate-200/40 opacity-50'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isPast ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : isCurrent ? (
                      <RotateCcw className="w-4 h-4 text-violet-600 animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px] text-slate-400">
                        {step.id}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className={`font-bold ${isCurrent ? 'text-violet-900' : 'text-slate-800'}`}>
                      {step.label}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {step.detail}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Banner after finish */}
          {isFinished && (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200/80 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Règles de classification automatique appliquées :</span>
              </div>
              <ul className="text-[11px] text-emerald-800 space-y-1 list-disc list-inside">
                <li>
                  <strong>Score RM ≥ 60 (Fort / Critique) :</strong> Intégré directement au calendrier sans action requise.
                </li>
                <li>
                  <strong>Score RM 30 à 59 (Moyen) :</strong> 2 propositions en attente dans la rubrique <em>« Propositions à valider »</em>.
                </li>
              </ul>
            </div>
          )}

          {/* Actions */}
          {isFinished && (
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  onClose();
                  onOpenProposals();
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <span>Voir les propositions à valider (2)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
