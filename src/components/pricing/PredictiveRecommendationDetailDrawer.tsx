/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FLOWTYM REVENUE — PANNEAU DÉTAILLÉ DE RECOMMANDATION TARIFAIRE PRÉDICTIVE (SECTION 12)
 * Affiche au clic sur une date :
 * 1. Les performances des années précédentes (N-1, N-2, N-3)
 * 2. Les dates historiques comparables
 * 3. L'évolution du pickup et de l'occupation
 * 4. Les événements associés et distance
 * 5. Le positionnement concurrentiel Compset
 * 6. Le Demand Score détaillé
 * 7. Les 3 scénarios tarifaires (Prudent, Équilibré, Agressif)
 * 8. Les justifications épistémologiques et validation humaine
 */

import React, { useState } from 'react';
import {
  X,
  TrendingUp,
  Calendar,
  Layers,
  Building,
  ShieldAlert,
  Check,
  CheckCircle2,
  AlertTriangle,
  Info,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Sparkles,
} from 'lucide-react';
import { FullPredictivePricingRecommendation } from '../../types/historicalData';

interface PredictiveRecommendationDetailDrawerProps {
  recommendation: FullPredictivePricingRecommendation;
  hotelName: string;
  onClose: () => void;
  onApplyScenario: (scenarioName: string, rate: number, explanation: string) => void;
}

export const PredictiveRecommendationDetailDrawer: React.FC<PredictiveRecommendationDetailDrawerProps> = ({
  recommendation: rec,
  hotelName,
  onClose,
  onApplyScenario,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<'prudent' | 'equilibre' | 'agressif'>('equilibre');
  const [customRate, setCustomRate] = useState<number>(rec.optimalRecommendedBarEur);

  const activeScenario = rec.scenarios[selectedScenario];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col border-l border-slate-200">
        {/* 1. Header du Drawer */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-violet-50/50 to-white">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-violet-100 text-violet-800">
                {rec.dayOfWeek} {rec.dateStr}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${rec.demandScore.colorClass}`}>
                {rec.demandScore.categoryLabel} ({rec.demandScore.score}/100)
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Analyse Prédictive & Recommandation Tarifaire
            </h2>
            <p className="text-xs text-slate-500">
              {hotelName} (45 chambres) • Décision basée sur 3 années d'historique certifié et signaux de marché
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Contenu Déroulant */}
        <div className="p-6 space-y-6 flex-1">
          {/* A. Synthèse du Tarif Recommandé vs Actuel */}
          <div className="p-5 rounded-3xl bg-slate-900 text-white shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase font-bold text-violet-400 tracking-wider">
                Recommandation FLOWTYM Optimale
              </div>
              <div className="text-xs text-slate-400">
                Confiance : <strong className="text-emerald-400">{rec.confidenceScore}%</strong>
              </div>
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <div className="text-3xl font-black text-white tabular-nums flex items-baseline gap-2">
                  <span>{rec.optimalRecommendedBarEur} €</span>
                  <span className="text-sm font-semibold text-slate-400 line-through">
                    {rec.currentBarEur} €
                  </span>
                </div>
                <div className="text-xs font-bold text-violet-300 mt-0.5 flex items-center gap-1">
                  {rec.deltaVsCurrentEur >= 0 ? (
                    <span className="text-emerald-400 flex items-center">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      +{rec.deltaVsCurrentEur} € (+{rec.deltaVsCurrentPercent}%)
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center">
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      {rec.deltaVsCurrentEur} € ({rec.deltaVsCurrentPercent}%)
                    </span>
                  )}
                  <span className="text-slate-400 font-normal">• Action : {rec.recommendedAction.actionLabel}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-400">RevPAR Prévisionnel</div>
                <div className="text-xl font-black text-emerald-400 tabular-nums">
                  {rec.projectedRevParEur} €
                </div>
                <div className="text-[11px] text-slate-400">Occ. estimée : {rec.projectedOccupancyPercent}%</div>
              </div>
            </div>
          </div>

          {/* B. Les 3 Scénarios Tarifaires (Prudent, Équilibré, Agressif) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                Choix du Scénario d'Optimisation
              </h3>
              <span className="text-[11px] text-slate-400">Arbitrage Volume vs Prix</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['prudent', 'equilibre', 'agressif'] as const).map((scKey) => {
                const sc = rec.scenarios[scKey];
                const isSelected = selectedScenario === scKey;
                return (
                  <div
                    key={scKey}
                    onClick={() => {
                      setSelectedScenario(scKey);
                      setCustomRate(sc.suggestedBarEur);
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? 'border-violet-600 bg-violet-50/70 shadow-xs ring-2 ring-violet-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        scKey === 'prudent' ? 'text-emerald-700' : scKey === 'equilibre' ? 'text-violet-700' : 'text-rose-700'
                      }`}>
                        {scKey}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-violet-600" />}
                    </div>

                    <div className="text-lg font-black text-slate-900 tabular-nums">
                      {sc.suggestedBarEur} €
                    </div>

                    <div className="text-[11px] text-slate-500 leading-tight">
                      Occ. <strong>{sc.expectedOccupancyPercent}%</strong> • RevPAR <strong>{sc.projectedRevParEur}€</strong>
                    </div>

                    <p className="text-[10px] text-slate-500 leading-snug pt-1 border-t border-slate-100">
                      {sc.riskDescription}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* C. Comparaison Historique Multi-Années (N-1, N-2, N-3) */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-violet-600" />
                <span>Performances Historiques Comparables (Iso-Weekday)</span>
              </h3>
              <span className="text-[11px] font-semibold text-violet-700">Pondération 50% / 30% / 20%</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Année N-1 (2025)</div>
                {rec.comparableHistory.n1 ? (
                  <div className="mt-1 space-y-0.5">
                    <div className="font-black text-slate-900">{rec.comparableHistory.n1.bar} €</div>
                    <div className="text-[10px] text-slate-500">Occ: {rec.comparableHistory.n1.occ}%</div>
                    <div className="text-[10px] text-emerald-700 font-bold">RevPAR: {rec.comparableHistory.n1.revpar}€</div>
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs mt-1">Non disponible</div>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Année N-2 (2024)</div>
                {rec.comparableHistory.n2 ? (
                  <div className="mt-1 space-y-0.5">
                    <div className="font-black text-slate-900">{rec.comparableHistory.n2.bar} €</div>
                    <div className="text-[10px] text-slate-500">Occ: {rec.comparableHistory.n2.occ}%</div>
                    <div className="text-[10px] text-emerald-700 font-bold">RevPAR: {rec.comparableHistory.n2.revpar}€</div>
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs mt-1">Non disponible</div>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Année N-3 (2023)</div>
                {rec.comparableHistory.n3 ? (
                  <div className="mt-1 space-y-0.5">
                    <div className="font-black text-slate-900">{rec.comparableHistory.n3.bar} €</div>
                    <div className="text-[10px] text-slate-500">Occ: {rec.comparableHistory.n3.occ}%</div>
                    <div className="text-[10px] text-emerald-700 font-bold">RevPAR: {rec.comparableHistory.n3.revpar}€</div>
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs mt-1">Non disponible</div>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
              <span>Moyenne pondérée historique de référence :</span>
              <span className="font-bold text-slate-900">
                Occ. {rec.comparableHistory.weightedAvgOcc}% • ADR {rec.comparableHistory.weightedAvgAdr}€ • RevPAR {rec.comparableHistory.weightedAvgRevpar}€
              </span>
            </div>
          </div>

          {/* D. Décomposition Épistémologique (Faits, Analyse, Prévision, Hypothèses) */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">
              Justification & Transparence Algorithmique
            </h3>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-600" />
                  <span>1. Faits Observés</span>
                </div>
                <ul className="text-slate-600 list-disc list-inside space-y-0.5 pl-2 text-[11px]">
                  {rec.justificationNotes.faits.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  <span>2. Analyse de Marché</span>
                </div>
                <ul className="text-slate-600 list-disc list-inside space-y-0.5 pl-2 text-[11px]">
                  {rec.justificationNotes.analyse.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>3. Prévision & Recommandation</span>
                </div>
                <ul className="text-slate-600 list-disc list-inside space-y-0.5 pl-2 text-[11px]">
                  {rec.justificationNotes.recommandation.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  <span>4. Hypothèses & Garde-fous</span>
                </div>
                <ul className="text-amber-800 list-disc list-inside space-y-0.5 pl-2 text-[11px]">
                  {rec.justificationNotes.limitesEtHypotheses.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Footer d'Action / Validation par le RM */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Ajustement manuel :</span>
            <div className="relative">
              <input
                type="number"
                value={customRate}
                onChange={(e) => setCustomRate(Number(e.target.value))}
                className="w-24 px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-violet-500"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">€</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Fermer
            </button>
            <button
              onClick={() => {
                onApplyScenario(
                  selectedScenario,
                  customRate,
                  `Validation scénario ${selectedScenario.toUpperCase()} (${customRate}€) pour le ${rec.dateStr}`
                );
                onClose();
              }}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Valider le tarif ({customRate} €)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
