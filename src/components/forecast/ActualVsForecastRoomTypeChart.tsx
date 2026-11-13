/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GRAPHIQUE INTERACTIF : RÉSERVATIONS RÉELLES (OTB) VS PRÉVISIONS (FORECAST)
 * Avec filtrage dynamique par typologie de chambre (Classique, Supérieure, Deluxe, Suite Famille)
 */

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  BedDouble,
  Check,
  Eye,
  EyeOff,
  TrendingUp,
  Sparkles,
  Calendar,
  Layers,
  Percent,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from 'lucide-react';
import { Hotel } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';

export interface RoomTypeConfig {
  id: string;
  name: string;
  shortName: string;
  totalRooms: number;
  color: string;
  baseAdr: number;
}

export const HOTEL_ROOM_TYPES: RoomTypeConfig[] = [
  { id: 'classique', name: 'Chambres Classiques Double', shortName: 'Classique', totalRooms: 20, color: '#6366f1', baseAdr: 260 },
  { id: 'superieure', name: 'Chambres Supérieures Exécutives', shortName: 'Supérieure', totalRooms: 15, color: '#8b5cf6', baseAdr: 310 },
  { id: 'deluxe', name: 'Chambres Deluxe Opéra', shortName: 'Deluxe', totalRooms: 6, color: '#ec4899', baseAdr: 370 },
  { id: 'suite_famille', name: 'Suites Famille & Quadruples', shortName: 'Suite Famille', totalRooms: 4, color: '#f59e0b', baseAdr: 440 },
];

interface ActualVsForecastRoomTypeChartProps {
  hotel?: Hotel;
  className?: string;
}

export const ActualVsForecastRoomTypeChart: React.FC<ActualVsForecastRoomTypeChartProps> = ({
  hotel,
  className = '',
}) => {
  const { chartTokens } = useTheme();
  // Active room types filter (multi-select)
  const [activeTypeIds, setActiveTypeIds] = useState<string[]>(['classique', 'superieure', 'deluxe', 'suite_famille']);
  
  // Metric selector: 'rooms' (Nuitées), 'occupancy' (TO %), 'revenue' (CA €)
  const [metricMode, setMetricMode] = useState<'rooms' | 'occupancy' | 'revenue'>('rooms');
  
  // Horizon selector: 7, 14, 30, 60 days
  const [dayRange, setDayRange] = useState<number>(30);

  // Toggle room type
  const toggleRoomType = (id: string) => {
    setActiveTypeIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter((x) => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const selectAllTypes = () => {
    setActiveTypeIds(HOTEL_ROOM_TYPES.map((t) => t.id));
  };

  // Selected room types metadata
  const selectedTypes = useMemo(() => {
    return HOTEL_ROOM_TYPES.filter((t) => activeTypeIds.includes(t.id));
  }, [activeTypeIds]);

  const selectedCapacity = useMemo(() => {
    return selectedTypes.reduce((sum, t) => sum + t.totalRooms, 0);
  }, [selectedTypes]);

  // Generate date series starting from today (2026-11-04)
  const chartData = useMemo(() => {
    const startDate = new Date(2026, 10, 4); // Nov 4, 2026
    const data = [];

    // Realistic day-by-day modeling with weekend peaks and major events
    for (let i = 0; i < dayRange; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeekNum = d.getDay();
      const isWeekend = dayOfWeekNum === 5 || dayOfWeekNum === 6; // Friday, Saturday

      const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      const dayLabel = `${dayNames[dayOfWeekNum]} ${d.getDate()}/${d.getMonth() + 1}`;

      // Events detection
      let eventTitle = '';
      let compressionBonus = 0;
      if (dateStr >= '2026-11-18' && dateStr <= '2026-11-20') {
        eventTitle = 'Salon des Maires';
        compressionBonus = 0.22;
      } else if (dateStr >= '2026-12-02' && dateStr <= '2026-12-04') {
        eventTitle = 'Congrès Médical';
        compressionBonus = 0.25;
      } else if (dateStr === '2026-12-31') {
        eventTitle = 'Réveillon Saint-Sylvestre';
        compressionBonus = 0.35;
      }

      // Base occupancy curve (higher near term, dips mid-week, spikes on events)
      const proximityDecay = Math.max(0.45, 1 - i * 0.015);
      const baseRatio = Math.min(0.96, Math.max(0.4, 0.65 + (isWeekend ? 0.18 : 0) + compressionBonus + (Math.sin(i * 0.6) * 0.08)));

      let actualRoomsTotal = 0;
      let forecastRoomsTotal = 0;
      let actualRevenueTotal = 0;
      let forecastRevenueTotal = 0;

      const typeBreakdown: Record<string, { actual: number; forecast: number; capacity: number; adr: number }> = {};

      selectedTypes.forEach((t) => {
        // Individual room type weights
        const typeFactor = t.id === 'classique' ? 1.05 : t.id === 'superieure' ? 0.98 : t.id === 'deluxe' ? 0.88 : 0.82;
        const actualRatio = Math.min(1, baseRatio * typeFactor * proximityDecay);
        const forecastRatio = Math.min(1, Math.max(0.5, baseRatio * typeFactor + (i > 10 ? 0.08 : -0.02)));

        const actualRooms = Math.min(t.totalRooms, Math.round(t.totalRooms * actualRatio));
        const forecastRooms = Math.min(t.totalRooms, Math.round(t.totalRooms * forecastRatio));

        const actualAdr = t.baseAdr + (compressionBonus > 0 ? 55 : isWeekend ? 30 : 0);
        const forecastAdr = t.baseAdr + (compressionBonus > 0 ? 65 : isWeekend ? 25 : 0);

        actualRoomsTotal += actualRooms;
        forecastRoomsTotal += forecastRooms;
        actualRevenueTotal += actualRooms * actualAdr;
        forecastRevenueTotal += forecastRooms * forecastAdr;

        typeBreakdown[t.id] = {
          actual: actualRooms,
          forecast: forecastRooms,
          capacity: t.totalRooms,
          adr: actualAdr,
        };
      });

      const actualOcc = Math.round((actualRoomsTotal / selectedCapacity) * 100);
      const forecastOcc = Math.round((forecastRoomsTotal / selectedCapacity) * 100);

      data.push({
        date: dateStr,
        dayLabel,
        eventTitle,
        actualRooms: actualRoomsTotal,
        forecastRooms: forecastRoomsTotal,
        capacity: selectedCapacity,
        actualOccupancy: actualOcc,
        forecastOccupancy: forecastOcc,
        actualRevenue: actualRevenueTotal,
        forecastRevenue: forecastRevenueTotal,
        gapRooms: actualRoomsTotal - forecastRoomsTotal,
        gapRevenue: actualRevenueTotal - forecastRevenueTotal,
        typeBreakdown,
      });
    }

    return data;
  }, [dayRange, selectedTypes, selectedCapacity]);

  // Totals for top cards
  const totalActualRooms = chartData.reduce((s, d) => s + d.actualRooms, 0);
  const totalForecastRooms = chartData.reduce((s, d) => s + d.forecastRooms, 0);
  const totalCapacity = chartData.reduce((s, d) => s + d.capacity, 0);
  const totalActualRevenue = chartData.reduce((s, d) => s + d.actualRevenue, 0);
  const totalForecastRevenue = chartData.reduce((s, d) => s + d.forecastRevenue, 0);
  const achievementRate = Math.round((totalActualRooms / totalForecastRooms) * 1000) / 10;
  const remainingPickup = Math.max(0, totalForecastRooms - totalActualRooms);

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-5 ${className}`}>
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Comparatif Prévisions (Forecast) vs Réservations Réelles (OTB)
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/70">
              Multi-Typologies
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Suivi dynamique des nuitées acquises vs le modèle prédictif · Filtrez par type de chambre pour analyser la montée en charge
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Metric Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setMetricMode('rooms')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                metricMode === 'rooms' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Nuitées (Chambres)
            </button>
            <button
              onClick={() => setMetricMode('occupancy')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                metricMode === 'occupancy' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Taux d’Occupation (%)
            </button>
            <button
              onClick={() => setMetricMode('revenue')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                metricMode === 'revenue' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Chiffre d’Affaires (€)
            </button>
          </div>

          {/* Date Horizon Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            {[7, 14, 30, 60].map((d) => (
              <button
                key={d}
                onClick={() => setDayRange(d)}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  dayRange === d ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 font-bold shadow-2xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {d}j
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Room Types Interactive Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Filtrer par type de chambre :
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            ({selectedCapacity} ch. actives sur 45)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={selectAllTypes}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
              activeTypeIds.length === HOTEL_ROOM_TYPES.length
                ? 'bg-violet-600 text-white border-violet-600 shadow-2xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Toutes (45 ch.)
          </button>

          {HOTEL_ROOM_TYPES.map((t) => {
            const isSelected = activeTypeIds.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggleRoomType(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 shadow-2xs ring-2 ring-violet-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: isSelected ? t.color : '#cbd5e1' }}
                />
                <span>{t.shortName}</span>
                <span className="text-[10px] font-bold text-slate-400">({t.totalRooms} ch.)</span>
                {isSelected ? (
                  <Eye className="w-3 h-3 text-emerald-600 dark:text-emerald-400 ml-0.5" />
                ) : (
                  <EyeOff className="w-3 h-3 text-slate-400 ml-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-violet-50/70 dark:bg-violet-950/40 border border-violet-200/80 dark:border-violet-800/70 rounded-2xl">
          <div className="text-[10px] uppercase font-bold text-violet-700 dark:text-violet-300">Taux de Réalisation Forecast</div>
          <div className="text-xl font-black text-violet-950 dark:text-violet-100 mt-1 tabular-nums flex items-baseline gap-1">
            <span>{achievementRate}%</span>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
              {achievementRate >= 100 ? '✓ En avance' : 'En cours'}
            </span>
          </div>
          <div className="text-[10px] text-violet-600 dark:text-violet-400 mt-0.5">
            {totalActualRooms} nuitées réelles vs {totalForecastRooms} prévues
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl">
          <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Pickup Résiduel Attendu</div>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
            {remainingPickup} chambres
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Sur les prochains {dayRange} jours
          </div>
        </div>

        <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/70 rounded-2xl">
          <div className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">CA Hébergement OTB</div>
          <div className="text-xl font-black text-emerald-950 dark:text-emerald-100 mt-1 tabular-nums">
            {totalActualRevenue.toLocaleString('fr-FR')} €
          </div>
          <div className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-0.5 flex items-center gap-1 font-semibold">
            <ArrowUpRight className="w-3 h-3" />
            <span>Objectif Forecast: {totalForecastRevenue.toLocaleString('fr-FR')} €</span>
          </div>
        </div>

        <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/70 rounded-2xl">
          <div className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300">Écart Valeur Cumulé</div>
          <div className="text-xl font-black text-amber-950 dark:text-amber-100 mt-1 tabular-nums">
            {totalActualRevenue >= totalForecastRevenue ? '+' : ''}
            {(totalActualRevenue - totalForecastRevenue).toLocaleString('fr-FR')} €
          </div>
          <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">
            {totalActualRevenue >= totalForecastRevenue ? 'Surperformance budgétaire' : 'Potentiel de capture restant'}
          </div>
        </div>
      </div>

      {/* Main Interactive Recharts Composed Chart */}
      <div className="h-80 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.gridStroke} vertical={false} />
            <XAxis
              dataKey="dayLabel"
              tick={{ fontSize: 10, fill: chartTokens.axisTickColor }}
              axisLine={{ stroke: chartTokens.axisLineColor }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: chartTokens.axisTickColor }}
              axisLine={{ stroke: chartTokens.axisLineColor }}
              tickLine={false}
              unit={metricMode === 'occupancy' ? '%' : metricMode === 'revenue' ? '€' : ''}
              domain={metricMode === 'occupancy' ? [0, 100] : [0, 'auto']}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-xl border border-slate-700 text-xs min-w-[240px] space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
                      <span className="font-bold text-slate-200">{d.dayLabel} ({d.date})</span>
                      {d.eventTitle && (
                        <span className="bg-violet-500/30 text-violet-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-violet-500/40 truncate max-w-[140px]">
                          {d.eventTitle}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-violet-300 flex items-center gap-1.5 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
                          Réservations Réelles (OTB) :
                        </span>
                        <strong className="text-white font-bold tabular-nums">
                          {metricMode === 'rooms'
                            ? `${d.actualRooms} / ${d.capacity} ch.`
                            : metricMode === 'occupancy'
                            ? `${d.actualOccupancy}%`
                            : `${d.actualRevenue.toLocaleString('fr-FR')} €`}
                        </strong>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full border border-dashed border-slate-400" />
                          Prévision IA (Forecast) :
                        </span>
                        <strong className="text-slate-200 tabular-nums">
                          {metricMode === 'rooms'
                            ? `${d.forecastRooms} ch.`
                            : metricMode === 'occupancy'
                            ? `${d.forecastOccupancy}%`
                            : `${d.forecastRevenue.toLocaleString('fr-FR')} €`}
                        </strong>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                        <span className="text-slate-400">Écart Réel vs Prévu :</span>
                        <span className={`font-bold tabular-nums ${d.gapRooms >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {d.gapRooms >= 0 ? `+${d.gapRooms}` : d.gapRooms} ch. ({d.gapRevenue >= 0 ? `+${d.gapRevenue}€` : `${d.gapRevenue}€`})
                        </span>
                      </div>
                    </div>

                    {/* Breakdown by room type */}
                    <div className="pt-2 border-t border-slate-800 space-y-1">
                      <div className="text-[10px] font-bold uppercase text-slate-400">
                        Détail typologies actives :
                      </div>
                      {selectedTypes.map((t) => {
                        const br = d.typeBreakdown[t.id];
                        if (!br) return null;
                        return (
                          <div key={t.id} className="flex items-center justify-between text-[10px] text-slate-300">
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                              {t.shortName} :
                            </span>
                            <span className="font-semibold tabular-nums">
                              {br.actual} / {br.capacity} ch. (Prev: {br.forecast})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
              formatter={(value) => {
                if (value === 'actualValue') return 'Réservations Réelles (OTB Acquis)';
                if (value === 'forecastValue') return 'Prévision Modèle RM (Forecast)';
                if (value === 'capacity') return `Capacité Max (${selectedCapacity} chambres)`;
                return value;
              }}
            />

            {/* Capacity ceiling line */}
            {metricMode === 'rooms' && (
              <ReferenceLine
                y={selectedCapacity}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                label={{ value: `Capacité (${selectedCapacity} ch.)`, fill: '#94a3b8', fontSize: 10, position: 'insideTopRight' }}
              />
            )}

            {/* Actual (Area + Line) */}
            <Area
              type="monotone"
              dataKey={metricMode === 'rooms' ? 'actualRooms' : metricMode === 'occupancy' ? 'actualOccupancy' : 'actualRevenue'}
              name="actualValue"
              stroke="#7c3aed"
              strokeWidth={2.5}
              fill="url(#actualGradient)"
            />

            {/* Forecast (Dashed Line) */}
            <Line
              type="monotone"
              dataKey={metricMode === 'rooms' ? 'forecastRooms' : metricMode === 'occupancy' ? 'forecastOccupancy' : 'forecastRevenue'}
              name="forecastValue"
              stroke="#0ea5e9"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 2.5, fill: '#0ea5e9' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
