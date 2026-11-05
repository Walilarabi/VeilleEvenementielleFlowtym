/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Building2,
  DollarSign,
  Users,
  Flame,
  ArrowRight,
  Info,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { Hotel, EventItem, DemandForecastItem, StandardDemandLevel } from '../../types';
import { generateDemandForecast } from '../../services/demandForecastService';
import { formatEventDateRange, getCategoryLabel } from '../../utils/helpers';
import { ActualVsForecastRoomTypeChart } from './ActualVsForecastRoomTypeChart';

interface DemandForecastViewProps {
  hotel: Hotel;
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  onGoToMarket: () => void;
}

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const DemandForecastView: React.FC<DemandForecastViewProps> = ({
  hotel,
  events,
  onSelectEvent,
  onGoToMarket,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(9); // 9 = October
  const [demandLevelFilter, setDemandLevelFilter] = useState<'all' | StandardDemandLevel>('all');

  const forecasts = useMemo(() => {
    return generateDemandForecast(hotel, events, selectedYear, selectedMonth);
  }, [hotel, events, selectedYear, selectedMonth]);

  const filteredForecasts = useMemo(() => {
    if (demandLevelFilter === 'all') return forecasts;
    return forecasts.filter((f) => f.demandLevel === demandLevelFilter);
  }, [forecasts, demandLevelFilter]);

  // Statistics
  const highDemandDays = forecasts.filter((f) => f.demandLevel === 'eleve' || f.demandLevel === 'exceptionnel');
  const lowDemandDays = forecasts.filter((f) => f.demandLevel === 'faible');
  const totalRevenueOpportunity = forecasts.reduce((sum, f) => sum + f.revenueOpportunityEur, 0);
  const avgConfidence = Math.round(forecasts.reduce((sum, f) => sum + f.confidenceScore, 0) / forecasts.length);

  const getDemandPillStyle = (lvl: StandardDemandLevel) => {
    switch (lvl) {
      case 'exceptionnel':
        return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
      case 'eleve':
        return 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
      case 'normal':
        return 'bg-sky-100 text-sky-800 border-sky-300 font-semibold';
      case 'faible':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300 font-medium';
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-violet-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-violet-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Modélisation Prédictive & Facteurs Explicatifs · {hotel.name}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Prévisions de la Demande Hôtelière
            </h2>
            <p className="text-xs sm:text-sm text-violet-200/90 max-w-2xl leading-relaxed">
              Projection qualifiée de la demande événementielle et des signaux de marché (compset) sans extrapolation fictive. Architecture prête pour l&apos;ingestion des flux PMS.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 text-center">
              <div className="text-[10px] uppercase font-bold text-violet-300">Dates Forte Demande</div>
              <div className="text-xl font-black text-amber-400 mt-0.5">{highDemandDays.length} jours</div>
              <div className="text-[10px] text-violet-300">Élevé & Exceptionnel</div>
            </div>

            <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 text-center">
              <div className="text-[10px] uppercase font-bold text-violet-300">Gain Potentiel RevPAR</div>
              <div className="text-xl font-black text-emerald-400 mt-0.5">+{totalRevenueOpportunity.toLocaleString('fr-FR')}€</div>
              <div className="text-[10px] text-violet-300">Sur le mois</div>
            </div>

            <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 text-center">
              <div className="text-[10px] uppercase font-bold text-violet-300">Fiabilité Modèle</div>
              <div className="text-xl font-black text-white mt-0.5">{avgConfidence}%</div>
              <div className="text-[10px] text-violet-300">Sources vérifiées</div>
            </div>
          </div>
        </div>

        {/* PMS Status Disclaimer Banner */}
        <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 text-xs text-violet-200 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Cadre Méthodologique & Prérequis PMS :</strong> En l&apos;absence de connexion directe avec votre PMS (Opera Cloud, Mews, Apaleo, Protel), ces prévisions mesurent rigoureusement la <strong>demande événementielle induite</strong>, les <strong>tensions de saturation compset</strong> et les <strong>vacances scolaires</strong>. Le connecteur API est prêt pour ingérer l&apos;OTB (On-The-Books) et le rythme de pickup dès synchronisation.
          </div>
        </div>
      </div>

      {/* Graphique Interactif : Réservations Réelles vs Prévisions par Typologie de Chambre */}
      <ActualVsForecastRoomTypeChart hotel={hotel} />

      {/* Month Navigator & Demand Level Filters */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => {
                if (selectedMonth === 0) {
                  setSelectedMonth(11);
                  setSelectedYear(selectedYear - 1);
                } else {
                  setSelectedMonth(selectedMonth - 1);
                }
              }}
              className="p-1 hover:bg-white rounded-lg text-slate-600 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-800 px-3">
              {MONTH_NAMES_FR[selectedMonth]} {selectedYear}
            </span>
            <button
              onClick={() => {
                if (selectedMonth === 11) {
                  setSelectedMonth(0);
                  setSelectedYear(selectedYear + 1);
                } else {
                  setSelectedMonth(selectedMonth + 1);
                }
              }}
              className="p-1 hover:bg-white rounded-lg text-slate-600 transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter by demand level */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-slate-600 mr-1">Filtrer par niveau :</span>
          {(['all', 'exceptionnel', 'eleve', 'normal', 'faible'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setDemandLevelFilter(lvl)}
              className={`px-3 py-1.5 rounded-xl font-bold capitalize transition-all cursor-pointer ${
                demandLevelFilter === lvl
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {lvl === 'all' ? 'Tous les jours' : lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Daily Timeline Forecast Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-bold tracking-wider">
              <tr>
                <th className="py-3 px-4">Date & Jour</th>
                <th className="py-3 px-3">Niveau de Demande</th>
                <th className="py-3 px-3">Fourchette d&apos;Occ. Attendue</th>
                <th className="py-3 px-3">Tarif Base / Conseillé</th>
                <th className="py-3 px-3">Opportunité Revenus</th>
                <th className="py-3 px-4">Principaux Facteurs Explicatifs (Drivers)</th>
                <th className="py-3 px-3 text-right">Confiance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredForecasts.map((day) => {
                const isHighlight = day.demandLevel === 'exceptionnel' || day.demandLevel === 'eleve';

                return (
                  <tr
                    key={day.dateStr}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      day.demandLevel === 'exceptionnel' ? 'bg-rose-50/30' : day.demandLevel === 'eleve' ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* Date */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-xs">{day.dayOfWeekFr}</div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {new Date(day.dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </td>

                    {/* Level badge */}
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] border capitalize ${getDemandPillStyle(day.demandLevel)}`}>
                        {day.demandLevel}
                      </span>
                    </td>

                    {/* Projected occ range */}
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {day.expectedOccupancyRange[0]}% – {day.expectedOccupancyRange[1]}%
                    </td>

                    {/* Base vs Recommended ADR */}
                    <td className="py-3 px-3">
                      <span className="line-through text-slate-400 mr-1.5">{day.baseADR}€</span>
                      <span className="font-black text-slate-900">{day.recommendedADR}€</span>
                    </td>

                    {/* Revenue opportunity */}
                    <td className="py-3 px-3">
                      {day.revenueOpportunityEur > 0 ? (
                        <span className="font-bold text-emerald-600">
                          +{day.revenueOpportunityEur.toLocaleString('fr-FR')}€
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Drivers */}
                    <td className="py-3 px-4">
                      {day.drivers.length > 0 ? (
                        <div className="space-y-1">
                          {day.drivers.map((drv, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-600 shrink-0" />
                              <strong className="truncate max-w-[240px]">{drv.name}</strong>
                              <span className="text-slate-400">({drv.expectedAttendance.toLocaleString('fr-FR')} pax · {drv.distanceKm} km)</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Demande organique régulière</span>
                      )}
                    </td>

                    {/* Confidence */}
                    <td className="py-3 px-3 text-right font-bold text-emerald-600">
                      {day.confidenceScore}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
