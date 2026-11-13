import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  Repeat,
  AlertTriangle,
  Zap,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  BarChart3,
  DollarSign,
} from 'lucide-react';
import { EventItem, Hotel } from '../../types';
import { formatEventDateRange, getCategoryLabel, getImpactColorClasses } from '../../utils/helpers';
import { RevPARImpactSimulator } from './RevPARImpactSimulator';

interface EventIntelligenceViewProps {
  events: EventItem[];
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectEvent: (event: EventItem) => void;
  defaultTab?: 'compression' | 'recurrences' | 'pricing_rules' | 'revpar_simulator';
  onOpenProposals?: () => void;
  pendingProposalsCount?: number;
}

export const EventIntelligenceView: React.FC<EventIntelligenceViewProps> = ({
  events,
  hotels,
  selectedHotelId,
  onSelectEvent,
  defaultTab = 'compression',
  onOpenProposals,
  pendingProposalsCount = 0,
}) => {
  const currentHotel = hotels.find((h) => h.id === selectedHotelId) || hotels[0];
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'compression' | 'revpar_simulator' | 'recurrences' | 'pricing_rules'>(
    defaultTab
  );

  React.useEffect(() => {
    if (defaultTab) {
      setActiveAnalysisTab(defaultTab);
    }
  }, [defaultTab]);

  // Recurrent events
  const recurrentEvents = events.filter((e) => e.isRecurring);

  // Severe compression dates (where multiple events collide or hyper event)
  const highPressureEvents = events.filter((e) => e.impactLevel === 'hyper' || e.scoreBreakdown.finalRMScore >= 80);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Event Intelligence & Analyses Prédictives
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Détection de récurrences, saturation de destination et simulateur RevPAR Recharts
              </p>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex flex-wrap items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/70 dark:border-slate-800/70 gap-1">
            <button
              onClick={() => setActiveAnalysisTab('compression')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeAnalysisTab === 'compression'
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Compression & Marché
            </button>
            <button
              onClick={() => setActiveAnalysisTab('revpar_simulator')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeAnalysisTab === 'revpar_simulator'
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Simulateur RevPAR (Recharts)</span>
            </button>
            <button
              onClick={() => setActiveAnalysisTab('recurrences')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeAnalysisTab === 'recurrences'
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Matrice de Récurrence
            </button>
            <button
              onClick={() => setActiveAnalysisTab('pricing_rules')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeAnalysisTab === 'pricing_rules'
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Règles Tarifaires RM
            </button>
          </div>
        </div>
      </div>

      {/* Tab: RevPAR Simulator with Recharts */}
      {activeAnalysisTab === 'revpar_simulator' && (
        <RevPARImpactSimulator
          events={events}
          hotels={hotels}
          selectedHotelId={selectedHotelId}
          onSelectEvent={onSelectEvent}
        />
      )}

      {/* Tab 1: Compression & Concurrence */}
      {activeAnalysisTab === 'compression' && (
        <div className="space-y-6">
          {/* Quick link to RevPAR Simulator */}
          <div className="bg-gradient-to-r from-violet-900 to-indigo-900 rounded-2xl p-4 sm:p-5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-amber-300 shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  Simulateur d&apos;Impact RevPAR Interactif
                </h4>
                <p className="text-xs text-violet-200">
                  Visualisez en temps réel l&apos;impact en € sur le RevPAR de <strong>{currentHotel.name}</strong> avec graphiques Recharts.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveAnalysisTab('revpar_simulator')}
              className="px-4 py-2 bg-white dark:bg-slate-900 text-violet-950 dark:text-violet-100 hover:bg-violet-50 dark:hover:bg-violet-950/50 text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <span>Lancer la projection RevPAR</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Market Collision Warning */}
          <div className="bg-amber-50/80 dark:bg-amber-950/45 border border-amber-200 dark:border-amber-800/70 rounded-2xl p-5 flex items-start gap-3.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Pic Critique de Demande : Semaine 42 (12 au 21 Octobre 2026)
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                Superposition du <strong>Mondial de l&apos;Automobile</strong> (Porte de Versailles) et du <strong>SIAL Paris</strong> (Villepinte), combinée aux concerts consécutifs de Céline Dion. Taux d&apos;occupation prévisionnel ville &gt; 94%.
              </p>
            </div>
          </div>

          {/* Visual Compression Timeline by day */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Indice de Saturation de la Destination (Octobre 2026)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pression sur les capacités hôtelières de Paris et première couronne
            </p>

            {/* Visual Bar representation */}
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2 pt-2">
              {[
                { date: '1-6 Oct', label: 'Fashion W.', value: 85, color: 'bg-amber-500', alert: 'Critique' },
                { date: '7-11 Oct', label: 'Concerts', value: 65, color: 'bg-blue-500', alert: 'Modéré' },
                { date: '12-16 Oct', label: 'Mondial Auto', value: 98, color: 'bg-rose-500', alert: 'Hyper' },
                { date: '17-18 Oct', label: 'Auto + SIAL', value: 100, color: 'bg-rose-600', alert: 'Saturé' },
                { date: '19-21 Oct', label: 'SIAL', value: 92, color: 'bg-rose-500', alert: 'Hyper' },
                { date: '22 Oct', label: 'Transition', value: 55, color: 'bg-emerald-500', alert: 'Standard' },
                { date: '23-25 Oct', label: 'Art Basel', value: 82, color: 'bg-amber-500', alert: 'Critique' },
                { date: '26-29 Oct', label: 'Affaires', value: 68, color: 'bg-blue-500', alert: 'Modéré' },
                { date: '30-31 Oct', label: 'Games Week', value: 78, color: 'bg-amber-500', alert: 'Fort' },
                { date: '31 Oct+', label: 'Rolex Masters', value: 88, color: 'bg-purple-600', alert: 'Critique' },
              ].map((item, idx) => (
                <div key={idx} className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800/70 text-center flex flex-col justify-between h-32">
                  <div className="text-[10px] font-bold text-slate-400">{item.date}</div>
                  <div className="my-auto">
                    <div className="text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums">{item.value}%</div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div className={`${item.color} h-1.5 rounded-full`} style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                  <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 truncate">{item.alert}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Major High Pressure Events List */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Événements à Saturation Maximale
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {highPressureEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => onSelectEvent(ev)}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/70 px-2 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{ev.title}</span>
                      <span className="text-[10px] font-semibold text-slate-400">· {ev.city}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {formatEventDateRange(ev.startDate, ev.endDate)} · {ev.venueName} ({ev.expectedAttendance.toLocaleString('fr-FR')} pax)
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums">
                        Score {ev.scoreBreakdown.finalRMScore}/100
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        ADR +{ev.hotelImpacts[currentHotel.id]?.estimatedADRBoostPercent || 35}% estimé
                      </div>
                    </div>
                    <button className="p-1.5 text-slate-400 hover:text-violet-600 rounded-lg">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Recurrences Matrix */}
      {activeAnalysisTab === 'recurrences' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Événements Récurrents & Détection des Décalages de Dates
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Surveillance des salons annuels et biennaux pour ajuster les budgets N-1 vs N
                </p>
              </div>
              <div className="flex items-center gap-2">
                {pendingProposalsCount > 0 && onOpenProposals && (
                  <button
                    onClick={onOpenProposals}
                    className="text-xs font-bold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-300 dark:border-amber-700/70 px-3 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>Valider les propositions ({pendingProposalsCount})</span>
                  </button>
                )}
                <span className="text-xs font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 px-3 py-1 rounded-xl border border-violet-200 dark:border-violet-800/70">
                  {recurrentEvents.length} événements récurrents trackés
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Événement</th>
                    <th className="py-3 px-4">Fréquence</th>
                    <th className="py-3 px-4">Dates 2026</th>
                    <th className="py-3 px-4">Statut Dates</th>
                    <th className="py-3 px-4">Évolution Historique</th>
                    <th className="py-3 px-4 text-center">Score RM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
                  {recurrentEvents.map((ev) => (
                    <tr
                      key={ev.id}
                      onClick={() => onSelectEvent(ev)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{ev.title}</td>
                      <td className="py-3 px-4 capitalize">
                        {ev.recurrenceFrequency === 'biennial' ? 'Biennal (1 an sur 2)' : 'Annuel'}
                      </td>
                      <td className="py-3 px-4 tabular-nums">
                        {formatEventDateRange(ev.startDate, ev.endDate)}
                      </td>
                      <td className="py-3 px-4">
                        {ev.status === 'confirmed' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            Dates officielles confirmées
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium">
                            <Repeat className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            Date estimée par IA
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {ev.historicalGrowth || '+5% affluence moyenne'}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {ev.scoreBreakdown.finalRMScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Pricing Rules & Yield Suggestions */}
      {activeAnalysisTab === 'pricing_rules' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Recommandations Tarifaires & Contrôles de Séjour
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Actions suggérées pour optimiser le RevPAR sans brader les nuits de haute compression
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50/50 dark:bg-rose-950/35 space-y-2">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs uppercase tracking-wider">
                  <Zap className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Règle 1 : Stop-Sell OTA & Distribution Tiers</span>
                </div>
                <p className="text-xs text-rose-900 dark:text-rose-200 leading-relaxed font-medium">
                  Pour tout événement avec Score RM &gt; 85 (Mondial Auto, SIAL Paris), fermer les promotions Booking/Expedia 90 jours à l&apos;avance et n&apos;ouvrir que le tarif direct flex ou non-remboursable.
                </p>
                <div className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold pt-1">
                  Établissements concernés : {currentHotel.name} (Paris)
                </div>
              </div>

              <div className="p-4 rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/50 dark:bg-violet-950/35 space-y-2">
                <div className="flex items-center gap-2 text-violet-800 dark:text-violet-300 font-bold text-xs uppercase tracking-wider">
                  <TrendingUp className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  <span>Règle 2 : Minimum Length of Stay (MLOS 2-3 nuits)</span>
                </div>
                <p className="text-xs text-violet-900 dark:text-violet-200 leading-relaxed font-medium">
                  Interdire les réservations d&apos;une seule nuit isolée le mardi/mercredi lors des salons professionnels majeurs pour éviter de créer des nuits orphelines.
                </p>
                <div className="text-[11px] text-violet-700 dark:text-violet-300 font-semibold pt-1">
                  Gain de taux d&apos;occupation moyen estimé : +12.4%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
