/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM RMS — VUE REVPAR IMPACT (FLOWBOARD)
 * Compare les prévisions d'occupation et de RevPAR avec les événements à fort impact
 * à l'aide des outils de visualisation multi-échelles Recharts.
 */

import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  Cell,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ReferenceArea,
  Brush,
  ScatterChart,
  Scatter,
} from 'recharts';
import {
  TrendingUp,
  Layers,
  Calendar,
  SlidersHorizontal,
  ArrowUpRight,
  Activity,
  Maximize2,
} from 'lucide-react';
import { EventItem, Hotel } from '../../types';
import { generateDemandForecast } from '../../services/demandForecastService';
import {
  getTodayIsoDate,
  filterEventsByHotelGeography,
} from '../../utils/eventFilterUtils';
import { formatEventDateRange, getCategoryLabel } from '../../utils/helpers';
import { useTheme } from '../../contexts/ThemeContext';

interface RevPARImpactViewProps {
  events: EventItem[];
  hotel: Hotel;
  onSelectEvent: (event: EventItem) => void;
}

type HorizonDays = 30 | 60 | 90 | 180;
type ComparisonMetricMode = 'occ_vs_score' | 'occ_vs_revpar' | 'revpar_vs_attendance';
type AxisScaleMode = 'fixed_0_100' | 'zoom_auto' | 'sqrt_attendance';

interface DailyChartDatum {
  dateStr: string;
  shortDate: string;
  dayLabel: string;
  dayOfWeekFr: string;
  occPrevue: number;
  occMin: number;
  occMax: number;
  baseADR: number;
  recommendedADR: number;
  revparBase: number;
  revparPrevu: number;
  revparLiftEur: number;
  marketPressureScore: number;
  highImpactScore: number | null;
  highImpactScoreZeroed: number;
  highImpactCount: number;
  totalAttendance: number;
  attendanceK: number;
  topEventTitle: string | null;
  topEventId: string | null;
  topEventBoostPct: number;
  demandLevel: string;
  isHighCompression: boolean;
}

interface EventWindowHighlight {
  id: string;
  title: string;
  startShort: string;
  endShort: string;
  score: number;
  event: EventItem;
}

interface EventCorrelationRow {
  id: string;
  title: string;
  shortTitle: string;
  categoryLabel: string;
  dateRange: string;
  startDate: string;
  scoreRM: number;
  expectedAttendance: number;
  avgOccPrevue: number;
  avgRevparPrevu: number;
  revparDeltaEur: number;
  revparDeltaPct: number;
  totalIncrementalEur: number;
  adrBoostPct: number;
  distanceKm: number;
  durationDays: number;
  event: EventItem;
}

const MONTHS_SHORT_FR = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatShortFrenchDate(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS_SHORT_FR[(m - 1) % 12]}`;
}

export const RevPARImpactView: React.FC<RevPARImpactViewProps> = ({
  events,
  hotel,
  onSelectEvent,
}) => {
  const { chartTokens, isDark } = useTheme();

  const todayStr = useMemo(() => getTodayIsoDate(), []);
  const [startDateFilter, setStartDateFilter] = useState<string>(() => getTodayIsoDate());
  const [horizonDays, setHorizonDays] = useState<HorizonDays>(60);
  const [minEventScore, setMinEventScore] = useState<number>(70);
  const [metricMode, setMetricMode] = useState<ComparisonMetricMode>('occ_vs_score');
  const [axisScaleMode, setAxisScaleMode] = useState<AxisScaleMode>('fixed_0_100');

  const effectiveStartDate = startDateFilter || todayStr;

  const endDateStr = useMemo(
    () => addDaysIso(effectiveStartDate, horizonDays - 1),
    [effectiveStartDate, horizonDays]
  );

  // Filtrage géographique strict au niveau des données pour l'hôtel actif
  const geoEvents = useMemo(
    () => filterEventsByHotelGeography(events, hotel),
    [events, hotel]
  );

  // Événements à fort impact dans l'horizon sélectionné
  const highImpactEventsInHorizon = useMemo(() => {
    return geoEvents
      .filter((ev) => {
        const effEnd = ev.endDate && ev.endDate >= ev.startDate ? ev.endDate : ev.startDate;
        const overlaps = effEnd >= effectiveStartDate && ev.startDate <= endDateStr;
        const meetsScore = (ev.scoreBreakdown?.finalRMScore ?? 0) >= minEventScore;
        return overlaps && meetsScore;
      })
      .sort((a, b) => b.scoreBreakdown.finalRMScore - a.scoreBreakdown.finalRMScore);
  }, [geoEvents, effectiveStartDate, endDateStr, minEventScore]);

  // Génération de la série quotidienne de prévisions + superposition événements
  const dailySeries = useMemo<DailyChartDatum[]>(() => {
    const startDt = new Date(`${effectiveStartDate}T00:00:00`);
    const endDt = new Date(`${endDateStr}T00:00:00`);

    const monthKeys: Array<{ year: number; month: number }> = [];
    const cursor = new Date(startDt.getFullYear(), startDt.getMonth(), 1);
    while (cursor <= endDt) {
      monthKeys.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const rawForecasts = monthKeys.flatMap(({ year, month }) =>
      generateDemandForecast(hotel, geoEvents, year, month)
    );

    const periodForecasts = rawForecasts.filter(
      (f) => f.dateStr >= effectiveStartDate && f.dateStr <= endDateStr
    );

    return periodForecasts.map((f) => {
      const [occMin, occMax] = f.expectedOccupancyRange;
      const pressureNorm = Math.min(1, Math.max(0, f.marketPressureScore / 100));
      const occPrevue =
        Math.round((occMin + (occMax - occMin) * (0.35 + pressureNorm * 0.65)) * 10) / 10;

      const revparBase = Math.round(f.baseADR * 0.68);
      const revparPrevu = Math.round(f.recommendedADR * (occPrevue / 100));
      const revparLiftEur = Math.max(0, revparPrevu - revparBase);

      const activeHighEvents = highImpactEventsInHorizon.filter((ev) => {
        const effEnd = ev.endDate && ev.endDate >= ev.startDate ? ev.endDate : ev.startDate;
        return ev.startDate <= f.dateStr && effEnd >= f.dateStr;
      });

      const topEvent =
        activeHighEvents.length > 0
          ? [...activeHighEvents].sort(
              (a, b) => b.scoreBreakdown.finalRMScore - a.scoreBreakdown.finalRMScore
            )[0]
          : null;

      const highImpactScore = topEvent ? topEvent.scoreBreakdown.finalRMScore : null;
      const totalAttendance = activeHighEvents.reduce(
        (sum, ev) => sum + (ev.expectedAttendance || 0),
        0
      );
      const topEventBoostPct = topEvent
        ? topEvent.hotelImpacts?.[hotel.id]?.estimatedADRBoostPercent ??
          Math.round(topEvent.scoreBreakdown.finalRMScore * 0.35)
        : 0;

      const shortDate = formatShortFrenchDate(f.dateStr);

      return {
        dateStr: f.dateStr,
        shortDate,
        dayLabel: `${f.dayOfWeekFr.slice(0, 3)} ${shortDate}`,
        dayOfWeekFr: f.dayOfWeekFr,
        occPrevue,
        occMin,
        occMax,
        baseADR: f.baseADR,
        recommendedADR: f.recommendedADR,
        revparBase,
        revparPrevu,
        revparLiftEur,
        marketPressureScore: f.marketPressureScore,
        highImpactScore,
        highImpactScoreZeroed: highImpactScore ?? 0,
        highImpactCount: activeHighEvents.length,
        totalAttendance,
        attendanceK: Math.round((totalAttendance / 1000) * 10) / 10,
        topEventTitle: topEvent ? topEvent.title : null,
        topEventId: topEvent ? topEvent.id : null,
        topEventBoostPct,
        demandLevel: f.demandLevel,
        isHighCompression: occPrevue >= 80,
      };
    });
  }, [hotel, geoEvents, effectiveStartDate, endDateStr, highImpactEventsInHorizon]);

  // Zones de référence pour matérialiser les fenêtres d'événements majeurs sur l'axe X
  const eventWindowHighlights = useMemo<EventWindowHighlight[]>(() => {
    if (dailySeries.length === 0) return [];
    const validShorts = new Set(dailySeries.map((d) => d.shortDate));
    const minStr = dailySeries[0].dateStr;
    const maxStr = dailySeries[dailySeries.length - 1].dateStr;

    return highImpactEventsInHorizon
      .slice(0, 8)
      .map((ev) => {
        const effEnd = ev.endDate && ev.endDate >= ev.startDate ? ev.endDate : ev.startDate;
        const clampedStart = ev.startDate < minStr ? minStr : ev.startDate;
        const clampedEnd = effEnd > maxStr ? maxStr : effEnd;
        const startShort = formatShortFrenchDate(clampedStart);
        const endShort = formatShortFrenchDate(clampedEnd);
        return {
          id: ev.id,
          title: ev.title,
          startShort,
          endShort,
          score: ev.scoreBreakdown.finalRMScore,
          event: ev,
        };
      })
      .filter((w) => validShorts.has(w.startShort) && validShorts.has(w.endShort));
  }, [dailySeries, highImpactEventsInHorizon]);

  // KPI synthétiques comparant jours avec événements à fort impact vs jours standard
  const kpis = useMemo(() => {
    const eventDays = dailySeries.filter((d) => d.highImpactScore !== null);
    const standardDays = dailySeries.filter((d) => d.highImpactScore === null);

    const avgOccEvent =
      eventDays.length > 0
        ? Math.round(
            (eventDays.reduce((s, d) => s + d.occPrevue, 0) / eventDays.length) * 10
          ) / 10
        : 0;
    const avgOccStandard =
      standardDays.length > 0
        ? Math.round(
            (standardDays.reduce((s, d) => s + d.occPrevue, 0) / standardDays.length) * 10
          ) / 10
        : 0;

    const avgRevparAll =
      dailySeries.length > 0
        ? Math.round(
            dailySeries.reduce((s, d) => s + d.revparPrevu, 0) / dailySeries.length
          )
        : 0;
    const avgRevparBase =
      dailySeries.length > 0
        ? Math.round(
            dailySeries.reduce((s, d) => s + d.revparBase, 0) / dailySeries.length
          )
        : 0;
    const avgRevparEventDays =
      eventDays.length > 0
        ? Math.round(eventDays.reduce((s, d) => s + d.revparPrevu, 0) / eventDays.length)
        : 0;

    const totalIncrementalEur = dailySeries.reduce(
      (s, d) => s + d.revparLiftEur * (hotel.roomCount || 45),
      0
    );
    const compressionDaysCount = dailySeries.filter((d) => d.isHighCompression).length;
    const peakDay =
      dailySeries.length > 0
        ? [...dailySeries].sort((a, b) => b.revparPrevu - a.revparPrevu)[0]
        : null;

    return {
      eventDaysCount: eventDays.length,
      avgOccEvent,
      avgOccStandard,
      occLiftPts:
        eventDays.length > 0 && standardDays.length > 0
          ? Math.round((avgOccEvent - avgOccStandard) * 10) / 10
          : 0,
      avgRevparAll,
      avgRevparBase,
      avgRevparEventDays,
      revparLiftPct:
        avgRevparBase > 0
          ? Math.round(((avgRevparAll - avgRevparBase) / avgRevparBase) * 100)
          : 0,
      totalIncrementalEur,
      compressionDaysCount,
      peakDay,
    };
  }, [dailySeries, hotel.roomCount]);

  // Données corrélées par événement pour la matrice Recharts (ScatterChart ZAxis) & le tableau détaillé
  const eventCorrelationRows = useMemo<EventCorrelationRow[]>(() => {
    const roomCount = hotel.roomCount || 45;

    return highImpactEventsInHorizon.map((ev) => {
      const effEnd = ev.endDate && ev.endDate >= ev.startDate ? ev.endDate : ev.startDate;
      const coveredDays = dailySeries.filter(
        (d) => d.dateStr >= ev.startDate && d.dateStr <= effEnd
      );
      const durationDays = Math.max(1, coveredDays.length);

      const avgOccPrevue =
        coveredDays.length > 0
          ? Math.round(
              (coveredDays.reduce((s, d) => s + d.occPrevue, 0) / coveredDays.length) * 10
            ) / 10
          : 82;
      const avgRevparPrevu =
        coveredDays.length > 0
          ? Math.round(
              coveredDays.reduce((s, d) => s + d.revparPrevu, 0) / coveredDays.length
            )
          : Math.round((hotel.baseADR || 260) * 0.95);
      const avgRevparBase =
        coveredDays.length > 0
          ? Math.round(
              coveredDays.reduce((s, d) => s + d.revparBase, 0) / coveredDays.length
            )
          : Math.round((hotel.baseADR || 260) * 0.68);

      const revparDeltaEur = Math.max(0, avgRevparPrevu - avgRevparBase);
      const revparDeltaPct =
        avgRevparBase > 0 ? Math.round((revparDeltaEur / avgRevparBase) * 100) : 0;
      const totalIncrementalEur = revparDeltaEur * roomCount * durationDays;

      const imp = ev.hotelImpacts?.[hotel.id];
      const adrBoostPct =
        imp?.estimatedADRBoostPercent ?? Math.round(ev.scoreBreakdown.finalRMScore * 0.35);

      return {
        id: ev.id,
        title: ev.title,
        shortTitle: ev.title.length > 26 ? `${ev.title.slice(0, 24)}…` : ev.title,
        categoryLabel: getCategoryLabel(ev.category),
        dateRange: formatEventDateRange(ev.startDate, ev.endDate),
        startDate: ev.startDate,
        scoreRM: ev.scoreBreakdown.finalRMScore,
        expectedAttendance: ev.expectedAttendance,
        avgOccPrevue,
        avgRevparPrevu,
        revparDeltaEur,
        revparDeltaPct,
        totalIncrementalEur,
        adrBoostPct,
        distanceKm: imp?.distanceKm ?? 4.2,
        durationDays,
        event: ev,
      };
    });
  }, [highImpactEventsInHorizon, dailySeries, hotel]);

  // Configuration dynamique des échelles Y Recharts
  const leftAxisConfig = useMemo(() => {
    if (metricMode === 'revpar_vs_attendance') {
      const domain: [number | 'auto', number | 'auto'] =
        axisScaleMode === 'zoom_auto' ? ['dataMin - 15', 'dataMax + 20'] as unknown as [number, number] : [0, 'auto'];
      return {
        label: 'RevPAR (€)',
        unit: '€',
        domain,
      };
    }
    const occDomain: [number, number] =
      axisScaleMode === 'zoom_auto' ? [35, 100] : [0, 100];
    return {
      label: 'Occupation (%)',
      unit: '%',
      domain: occDomain,
    };
  }, [metricMode, axisScaleMode]);

  const rightAxisConfig = useMemo(() => {
    if (metricMode === 'occ_vs_score') {
      return {
        label: 'Score RM (0–100)',
        unit: ' pts',
        domain: [0, 100] as [number, number],
        scale: 'linear' as const,
      };
    }
    if (metricMode === 'occ_vs_revpar') {
      return {
        label: 'RevPAR (€)',
        unit: '€',
        domain: [0, 'auto'] as [number, 'auto'],
        scale: 'linear' as const,
      };
    }
    return {
      label: 'Affluence (k pax)',
      unit: 'k',
      domain: [0, 'auto'] as [number, 'auto'],
      scale: (axisScaleMode === 'sqrt_attendance' ? 'sqrt' : 'linear') as 'sqrt' | 'linear',
    };
  }, [metricMode, axisScaleMode]);

  const colors = useMemo(
    () => ({
      occLine: isDark ? '#34d399' : '#059669',
      occAreaTop: isDark ? 'rgba(52, 211, 153, 0.24)' : 'rgba(5, 150, 105, 0.16)',
      occAreaBottom: isDark ? 'rgba(52, 211, 153, 0.02)' : 'rgba(5, 150, 105, 0.01)',
      revparLine: isDark ? '#8b6ef3' : '#7c3aed',
      revparBaseLine: isDark ? '#64748b' : '#94a3b8',
      scoreCrit: isDark ? '#fb7185' : '#e11d48',
      scoreHigh: isDark ? '#a78bfa' : '#7c3aed',
      scoreMod: isDark ? '#fbbf24' : '#d97706',
      attendanceBar: isDark ? '#38bdf8' : '#0284c7',
      highlightBg: isDark ? 'rgba(139, 110, 243, 0.09)' : 'rgba(124, 58, 237, 0.06)',
    }),
    [isDark]
  );

  const handleOpenEventById = (eventId: string | null) => {
    if (!eventId) return;
    const found = geoEvents.find((e) => e.id === eventId);
    if (found) onSelectEvent(found);
  };

  return (
    <div className="space-y-6">
      {/* Header & Contrôles d'échelle / horizon */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-violet-700 dark:text-violet-300">
              <Layers className="w-4 h-4 shrink-0" />
              <span className="uppercase tracking-wider">RevPAR Impact · Corrélation Multi-Échelles</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {hotel.name} ({hotel.city} · {hotel.roomCount} ch. · ADR base {hotel.baseADR} €)
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Prévisions d&apos;occupation &amp; RevPAR face aux événements à fort impact
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
              Comparaison quotidienne à double échelle Recharts entre le taux d&apos;occupation prévisionnel, le RevPAR projeté et l&apos;intensité des événements géographiquement pertinents autour de l&apos;hôtel.
            </p>
          </div>

          {/* Date de début + Horizon & Seuil Score Controls (single-line controls) */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Début :</span>
              <input
                type="date"
                aria-label="Date de début d'analyse RevPAR"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value || todayStr)}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer tabular-nums"
              />
              {startDateFilter !== todayStr && (
                <button
                  type="button"
                  onClick={() => setStartDateFilter(todayStr)}
                  className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer pl-1"
                >
                  Aujourd&apos;hui
                </button>
              )}
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              {([30, 60, 90, 180] as HorizonDays[]).map((days) => (
                <button
                  key={days}
                  onClick={() => setHorizonDays(days)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                    horizonDays === days
                      ? 'bg-violet-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {days} j
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                aria-label="Seuil de score événementiel"
                value={minEventScore}
                onChange={(e) => setMinEventScore(Number(e.target.value))}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer whitespace-nowrap"
              >
                <option value={60}>Événements Score &ge; 60</option>
                <option value={70}>Fort impact Score &ge; 70</option>
                <option value={80}>Critiques Score &ge; 80</option>
                <option value={85}>Hyper-compression &ge; 85</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4 Single-Elevation KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              TO Prévu Jours Événements
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {kpis.eventDaysCount > 0 ? `${kpis.avgOccEvent.toFixed(1)} %` : '—'}
              </span>
              {kpis.occLiftPts > 0 && (
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  +{kpis.occLiftPts} pts vs standard
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {kpis.eventDaysCount} j d&apos;événements · {kpis.avgOccStandard.toFixed(1)}% hors événements
            </div>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              RevPAR Moyen Prévisionnel
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {kpis.avgRevparAll} €
              </span>
              <span className="text-xs font-bold text-violet-700 dark:text-violet-300 tabular-nums">
                +{kpis.revparLiftPct}% vs base ({kpis.avgRevparBase} €)
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              Moy. jours événements : {kpis.eventDaysCount > 0 ? `${kpis.avgRevparEventDays} €` : '—'}
            </div>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Revenu Additionnel Capturable
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                +{kpis.totalIncrementalEur.toLocaleString('fr-FR')} €
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              Sur {horizonDays} j · {hotel.roomCount} chambres ({highImpactEventsInHorizon.length} événements)
            </div>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Dates Sous Compression (&ge; 80%)
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {kpis.compressionDaysCount} j
              </span>
              {kpis.peakDay && (
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                  Pic {kpis.peakDay.shortDate} · {kpis.peakDay.revparPrevu} €
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {kpis.peakDay?.topEventTitle
                ? `Moteur : ${kpis.peakDay.topEventTitle}`
                : 'Tension combinée marché & calendrier'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Recharts Dual-Scale Visualization Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Visualisation Multi-Échelles Recharts : Occupation Prévisionnelle vs Événements
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Utilisez le sélecteur d&apos;échelles et la glissière inférieure (<code className="font-mono text-[11px]">Brush</code>) pour isoler les pics de compression. Cliquez sur une barre d&apos;événement pour inspecter le détail.
            </p>
          </div>

          {/* Recharts Scale & Metric Tooling Bar */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setMetricMode('occ_vs_score')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  metricMode === 'occ_vs_score'
                    ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Occupation % vs Score RM
              </button>
              <button
                onClick={() => setMetricMode('occ_vs_revpar')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  metricMode === 'occ_vs_revpar'
                    ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Occupation % vs RevPAR €
              </button>
              <button
                onClick={() => setMetricMode('revpar_vs_attendance')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  metricMode === 'revpar_vs_attendance'
                    ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                RevPAR € vs Affluence (pax)
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
              <Maximize2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                aria-label="Mode d'échelle des axes Y"
                value={axisScaleMode}
                onChange={(e) => setAxisScaleMode(e.target.value as AxisScaleMode)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer whitespace-nowrap"
              >
                <option value="fixed_0_100">Échelle standard (0–100)</option>
                <option value="zoom_auto">Échelle resserrée (Zoom compression)</option>
                <option value="sqrt_attendance">Échelle racine (√ Affluence pax)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Inline Legend (No Pill Boxes) */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
          {metricMode !== 'revpar_vs_attendance' ? (
            <span className="inline-flex items-center gap-2 font-medium">
              <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: colors.occLine }} />
              <span>Occupation Prévue (%) · Axe gauche</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 font-medium">
              <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: colors.revparLine }} />
              <span>RevPAR Prévu (€) · Axe gauche</span>
            </span>
          )}

          {metricMode === 'occ_vs_score' && (
            <span className="inline-flex items-center gap-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: colors.scoreHigh }} />
              <span>Score Événement Fort Impact (0–100) · Axe droit</span>
            </span>
          )}
          {metricMode === 'occ_vs_revpar' && (
            <>
              <span className="inline-flex items-center gap-2 font-medium">
                <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: colors.revparLine }} />
                <span>RevPAR Projeté (€) · Axe droit</span>
              </span>
              <span className="inline-flex items-center gap-2 font-medium">
                <span
                  className="w-3 h-0.5 border-t border-dashed"
                  style={{ borderColor: colors.revparBaseLine }}
                />
                <span>RevPAR Base Organique (€)</span>
              </span>
            </>
          )}
          {metricMode === 'revpar_vs_attendance' && (
            <span className="inline-flex items-center gap-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: colors.attendanceBar }} />
              <span>Affluence Événements (k pax) · Axe droit</span>
            </span>
          )}

          <span className="inline-flex items-center gap-2 font-medium text-rose-600 dark:text-rose-400">
            <span className="w-3 h-0.5 border-t border-dashed border-rose-500" />
            <span>Seuil compression 80% TO</span>
          </span>
        </div>

        {/* Main ComposedChart */}
        {dailySeries.length === 0 ? (
          <div className="h-[340px] flex flex-col items-center justify-center text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-2">
            <Calendar className="w-6 h-6 text-slate-400" />
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Aucune donnée de prévision disponible sur cette période
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ajustez l&apos;horizon ou le seuil de score événementiel pour visualiser la corrélation.
            </p>
          </div>
        ) : (
          <div className="w-full h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={dailySeries}
                margin={{ top: 14, right: 16, left: 4, bottom: 8 }}
                onClick={(state: unknown) => {
                  const s = state as { activePayload?: Array<{ payload?: DailyChartDatum }> } | null;
                  const clicked = s?.activePayload?.[0]?.payload;
                  if (clicked?.topEventId) {
                    handleOpenEventById(clicked.topEventId);
                  }
                }}
              >
                <defs>
                  <linearGradient id="occForecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.occLine} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={colors.occLine} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="revparGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.revparLine} stopOpacity={0.26} />
                    <stop offset="95%" stopColor={colors.revparLine} stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chartTokens.gridStroke}
                  vertical={false}
                />

                {/* Event windows shaded via ReferenceArea */}
                {eventWindowHighlights.map((win) => (
                  <ReferenceArea
                    key={win.id}
                    yAxisId="left"
                    x1={win.startShort}
                    x2={win.endShort}
                    fill={colors.highlightBg}
                    strokeOpacity={0}
                  />
                ))}

                <XAxis
                  dataKey="shortDate"
                  tick={{ fill: chartTokens.axisTickColor, fontSize: 11 }}
                  axisLine={{ stroke: chartTokens.axisLineColor }}
                  tickLine={false}
                  minTickGap={18}
                />

                <YAxis
                  yAxisId="left"
                  domain={leftAxisConfig.domain}
                  tick={{ fill: chartTokens.axisTickColor, fontSize: 11 }}
                  axisLine={{ stroke: chartTokens.axisLineColor }}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v) =>
                    metricMode === 'revpar_vs_attendance' ? `${v}€` : `${v}%`
                  }
                />

                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={rightAxisConfig.domain}
                  scale={rightAxisConfig.scale}
                  tick={{ fill: chartTokens.axisTickColor, fontSize: 11 }}
                  axisLine={{ stroke: chartTokens.axisLineColor }}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v) =>
                    metricMode === 'occ_vs_revpar'
                      ? `${v}€`
                      : metricMode === 'revpar_vs_attendance'
                      ? `${v}k`
                      : `${v}`
                  }
                />

                {metricMode !== 'revpar_vs_attendance' && (
                  <ReferenceLine
                    yAxisId="left"
                    y={80}
                    stroke={chartTokens.referenceLineColor}
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                )}

                <RechartsTooltip
                  cursor={{ fill: chartTokens.cursorFill }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const row = payload[0]?.payload as DailyChartDatum | undefined;
                    if (!row) return null;

                    return (
                      <div
                        className="rounded-xl p-3.5 shadow-xl border text-xs space-y-2 min-w-[240px] max-w-[310px]"
                        style={{
                          backgroundColor: chartTokens.tooltipBg,
                          borderColor: chartTokens.tooltipBorder,
                          color: chartTokens.tooltipText,
                        }}
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-1.5">
                          <span className="font-bold capitalize">{row.dayLabel}</span>
                          <span
                            className="font-mono text-[11px]"
                            style={{ color: chartTokens.tooltipMutedText }}
                          >
                            {row.dateStr}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums">
                          <span style={{ color: chartTokens.tooltipMutedText }}>
                            TO Prévu :
                          </span>
                          <span className="font-bold text-right text-emerald-400">
                            {row.occPrevue.toFixed(1)}% ({row.occMin}–{row.occMax}%)
                          </span>

                          <span style={{ color: chartTokens.tooltipMutedText }}>
                            ADR Recommandé :
                          </span>
                          <span className="font-bold text-right">
                            {row.recommendedADR} €
                          </span>

                          <span style={{ color: chartTokens.tooltipMutedText }}>
                            RevPAR Projeté :
                          </span>
                          <span className="font-bold text-right text-violet-300">
                            {row.revparPrevu} € (+{row.revparLiftEur} €)
                          </span>
                        </div>

                        {row.topEventTitle ? (
                          <div className="pt-1.5 border-t border-white/10 space-y-1">
                            <div className="text-[11px] font-bold text-amber-300">
                              Événement : {row.topEventTitle}
                            </div>
                            <div
                              className="flex items-center justify-between text-[11px] tabular-nums"
                              style={{ color: chartTokens.tooltipMutedText }}
                            >
                              <span>Score RM : {row.highImpactScore}/100</span>
                              <span>
                                {row.totalAttendance > 0
                                  ? `${row.totalAttendance.toLocaleString('fr-FR')} pax`
                                  : `ADR +${row.topEventBoostPct}%`}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="pt-1 border-t border-white/10 text-[11px]"
                            style={{ color: chartTokens.tooltipMutedText }}
                          >
                            Demande organique (aucun événement &ge; {minEventScore})
                          </div>
                        )}
                      </div>
                    );
                  }}
                />

                {/* Right-axis metric bars */}
                {metricMode === 'occ_vs_score' && (
                  <Bar
                    yAxisId="right"
                    dataKey="highImpactScoreZeroed"
                    name="Score RM Événement"
                    barSize={12}
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                  >
                    {dailySeries.map((entry) => {
                      const s = entry.highImpactScore ?? 0;
                      const fill =
                        s >= 85
                          ? colors.scoreCrit
                          : s >= 70
                          ? colors.scoreHigh
                          : colors.scoreMod;
                      return (
                        <Cell
                          key={entry.dateStr}
                          fill={fill}
                          fillOpacity={s > 0 ? 0.85 : 0}
                        />
                      );
                    })}
                  </Bar>
                )}

                {metricMode === 'occ_vs_revpar' && (
                  <>
                    <Bar
                      yAxisId="right"
                      dataKey="revparPrevu"
                      name="RevPAR Projeté (€)"
                      barSize={10}
                      radius={[4, 4, 0, 0]}
                      fill={colors.revparLine}
                      fillOpacity={0.78}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="revparBase"
                      name="RevPAR Base (€)"
                      stroke={colors.revparBaseLine}
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </>
                )}

                {metricMode === 'revpar_vs_attendance' && (
                  <Bar
                    yAxisId="right"
                    dataKey="attendanceK"
                    name="Affluence Événements (k pax)"
                    barSize={12}
                    radius={[4, 4, 0, 0]}
                    fill={colors.attendanceBar}
                    fillOpacity={0.82}
                  />
                )}

                {/* Left-axis primary curve */}
                {metricMode === 'revpar_vs_attendance' ? (
                  <>
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="revparPrevu"
                      name="RevPAR Prévu (€)"
                      stroke={colors.revparLine}
                      strokeWidth={2.5}
                      fill="url(#revparGrad)"
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="revparBase"
                      name="RevPAR Base (€)"
                      stroke={colors.revparBaseLine}
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </>
                ) : (
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="occPrevue"
                    name="Occupation Prévue (%)"
                    stroke={colors.occLine}
                    strokeWidth={2.5}
                    fill="url(#occForecastGrad)"
                    activeDot={{ r: 5 }}
                  />
                )}

                <Brush
                  dataKey="shortDate"
                  height={24}
                  stroke={isDark ? '#8b6ef3' : '#7c3aed'}
                  fill={isDark ? '#171d2b' : '#f8fafc'}
                  travellerWidth={8}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Lower Analytics Grid: Recharts Bubble Elasticity Matrix (Scatter + ZAxis) & High-Impact Events Table */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Left: Recharts ScatterChart + ZAxis (2/5 width on xl) */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Matrice Score RM × Occupation × Gain RevPAR
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Taille des bulles (<code className="font-mono text-[11px]">ZAxis</code>) proportionnelle au revenu additionnel total (€) capturé sur la durée de l&apos;événement.
            </p>
          </div>

          {eventCorrelationRows.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              Aucun événement au-dessus du seuil {minEventScore} sur cet horizon.
            </div>
          ) : (
            <div className="w-full h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 12, right: 16, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.gridStroke} />
                  <XAxis
                    type="number"
                    dataKey="scoreRM"
                    name="Score RM"
                    domain={[Math.max(50, minEventScore - 5), 100]}
                    tick={{ fill: chartTokens.axisTickColor, fontSize: 11 }}
                    axisLine={{ stroke: chartTokens.axisLineColor }}
                    tickLine={false}
                    tickFormatter={(v) => `${v}`}
                  />
                  <YAxis
                    type="number"
                    dataKey="avgOccPrevue"
                    name="Occupation Prévue"
                    domain={[60, 100]}
                    tick={{ fill: chartTokens.axisTickColor, fontSize: 11 }}
                    axisLine={{ stroke: chartTokens.axisLineColor }}
                    tickLine={false}
                    width={42}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <ZAxis
                    type="number"
                    dataKey="totalIncrementalEur"
                    range={[80, 620]}
                    name="Gain RevPAR"
                  />
                  <ReferenceLine
                    y={80}
                    stroke={chartTokens.referenceLineColor}
                    strokeDasharray="4 4"
                  />
                  <RechartsTooltip
                    cursor={{ strokeDasharray: '3 3', stroke: chartTokens.axisLineColor }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0]?.payload as EventCorrelationRow | undefined;
                      if (!item) return null;

                      return (
                        <div
                          className="rounded-xl p-3 shadow-xl border text-xs space-y-1.5 max-w-[260px]"
                          style={{
                            backgroundColor: chartTokens.tooltipBg,
                            borderColor: chartTokens.tooltipBorder,
                            color: chartTokens.tooltipText,
                          }}
                        >
                          <div className="font-bold leading-snug">{item.title}</div>
                          <div
                            className="text-[11px]"
                            style={{ color: chartTokens.tooltipMutedText }}
                          >
                            {item.dateRange} · {item.distanceKm} km
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1 border-t border-white/10 tabular-nums">
                            <span style={{ color: chartTokens.tooltipMutedText }}>Score RM :</span>
                            <span className="font-bold text-right">{item.scoreRM}/100</span>
                            <span style={{ color: chartTokens.tooltipMutedText }}>Occ. prévue :</span>
                            <span className="font-bold text-right text-emerald-400">
                              {item.avgOccPrevue.toFixed(1)}%
                            </span>
                            <span style={{ color: chartTokens.tooltipMutedText }}>RevPAR prévu :</span>
                            <span className="font-bold text-right text-violet-300">
                              {item.avgRevparPrevu} € (+{item.revparDeltaEur} €)
                            </span>
                            <span style={{ color: chartTokens.tooltipMutedText }}>Gain cumulé :</span>
                            <span className="font-bold text-right text-emerald-300">
                              +{item.totalIncrementalEur.toLocaleString('fr-FR')} €
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Scatter
                    data={eventCorrelationRows}
                    cursor="pointer"
                    onClick={(data) => {
                      const row = (data as unknown as { payload?: EventCorrelationRow })?.payload ||
                        (data as unknown as EventCorrelationRow);
                      if (row?.event) onSelectEvent(row.event);
                    }}
                  >
                    {eventCorrelationRows.map((entry) => (
                      <Cell
                        key={entry.id}
                        fill={
                          entry.scoreRM >= 85
                            ? colors.scoreCrit
                            : entry.scoreRM >= 75
                            ? colors.scoreHigh
                            : colors.occLine
                        }
                        fillOpacity={0.82}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right: High-Density Correlation Table (3/5 width on xl) */}
        <div className="xl:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
          <div className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Impact détaillé des événements à fort impact ({eventCorrelationRows.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cliquez sur une ligne pour ouvrir la fiche Yield complète et ajuster vos restrictions.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap shrink-0">
              {hotel.city} · Score &ge; {minEventScore}
            </span>
          </div>

          {eventCorrelationRows.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Aucun événement détecté sur cet horizon pour le seuil sélectionné. Essayez un horizon de 90j ou 180j.
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-4">Événement &amp; Dates</th>
                    <th className="py-2.5 px-3 text-right">Score RM</th>
                    <th className="py-2.5 px-3 text-right">Occ. Prévue</th>
                    <th className="py-2.5 px-3 text-right">RevPAR</th>
                    <th className="py-2.5 px-3 text-right">Delta / Base</th>
                    <th className="py-2.5 px-4 text-right">Gain Hôtel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {eventCorrelationRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => onSelectEvent(row.event)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-4 max-w-[260px]">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100 group-hover:text-violet-700 dark:group-hover:text-violet-300 truncate">
                          <span className="truncate">{row.title}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
                          {row.dateRange} · {row.categoryLabel} · {row.expectedAttendance.toLocaleString('fr-FR')} pax
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                        <span
                          className={
                            row.scoreRM >= 85
                              ? 'text-rose-600 dark:text-rose-400'
                              : row.scoreRM >= 75
                              ? 'text-violet-700 dark:text-violet-300'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {row.scoreRM}/100
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {row.avgOccPrevue.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {row.avgRevparPrevu} €
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                        +{row.revparDeltaEur} € ({row.revparDeltaPct}%)
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                        +{row.totalIncrementalEur.toLocaleString('fr-FR')} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
