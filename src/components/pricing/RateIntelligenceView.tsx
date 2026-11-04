/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Download,
  Upload,
  RefreshCw,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Building,
  Sparkles,
  Zap,
  Check,
  X,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Info,
  Clock,
  ShieldAlert,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  HelpCircle,
  Trophy,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
} from 'recharts';
import { Hotel, EventItem } from '../../types';
import {
  DailyRateIntelligence,
  TODAY_DATE_STR,
  COMPSET_METAS,
  calculateCompsetRanking,
  getRateIntelligenceRecords,
  saveRateIntelligenceRecords,
  applyRateSuggestion,
  applyAllRateSuggestions,
  exportRateGridToCSV,
} from '../../services/rateIntelligenceService';

interface RateIntelligenceViewProps {
  hotel: Hotel;
  events?: EventItem[];
  onSelectEvent?: (event: EventItem) => void;
  onGoToExcelUpload?: () => void;
  onShowToast?: (msg: string) => void;
}

export type PeriodDuration = '7d' | '14d' | '30d' | '60d' | '90d' | 'all';

export type CompsetStatusFilter =
  | 'all'
  | 'significantly_cheaper'
  | 'aligned'
  | 'more_expensive'
  | 'cheapest'
  | 'underpriced'
  | 'soldout'
  | 'pending';

export interface EnhancedDailyRateWithCompset extends DailyRateIntelligence {
  compsetRanking: ReturnType<typeof calculateCompsetRanking>;
  rankingString: string; // e.g. "1/6", "2/5"
  positionStatus: 'significantly_cheaper' | 'aligned' | 'more_expensive';
  statusBadge: {
    label: string;
    englishLabel: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    description: string;
  };
}

export const RateIntelligenceView: React.FC<RateIntelligenceViewProps> = ({
  hotel,
  events = [],
  onSelectEvent,
  onGoToExcelUpload,
  onShowToast,
}) => {
  // Base rate records loaded for this hotel
  const [records, setRecords] = useState<DailyRateIntelligence[]>(() =>
    getRateIntelligenceRecords(hotel.id)
  );

  // Sync records when hotel changes
  useEffect(() => {
    setRecords(getRateIntelligenceRecords(hotel.id));
  }, [hotel.id]);

  // View Mode: 'both' | 'table' | 'chart'
  const [viewMode, setViewMode] = useState<'both' | 'table' | 'chart'>('both');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Status Filter: includes 'all', 'significantly_cheaper', 'aligned', 'more_expensive', 'cheapest', etc.
  const [statusFilter, setStatusFilter] = useState<CompsetStatusFilter>('all');

  // Period Selector: 7j, 14j, 30j (default), 60j, 90j, all
  const [periodDuration, setPeriodDuration] = useState<PeriodDuration>('30d');

  // Navigation Offset (number of days shifted from TODAY_DATE_STR)
  const [dayOffset, setDayOffset] = useState<number>(0);

  // Allow showing past dates toggle
  const [showPastDates, setShowPastDates] = useState<boolean>(false);

  // Competitor lines visibility in Recharts graph
  const [visibleCompetitors, setVisibleCompetitors] = useState<Record<string, boolean>>({
    'Hôtel Saint-Pétersbourg Opéra': false,
    'Hôtel Charing Cross': false,
    'Hôtel Astra Opéra': false,
    'Hotel Indigo Paris-Opéra': false,
    'Hôtel Saint-Augustin Elysées': false,
  });

  // Expanded row ID for viewing individual competitor breakdown
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Manual Adjustment Modal State
  const [adjustingRecord, setAdjustingRecord] = useState<DailyRateIntelligence | null>(null);
  const [customRate, setCustomRate] = useState<number>(300);
  const [customMinStay, setCustomMinStay] = useState<number>(2);
  const [customNote, setCustomNote] = useState<string>('');

  // 1. Calculate active date window
  const activeDateRange = useMemo(() => {
    const today = new Date(`${TODAY_DATE_STR}T00:00:00Z`);
    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() + dayOffset);

    let numDays = 30;
    if (periodDuration === '7d') numDays = 7;
    else if (periodDuration === '14d') numDays = 14;
    else if (periodDuration === '30d') numDays = 30;
    else if (periodDuration === '60d') numDays = 60;
    else if (periodDuration === '90d') numDays = 90;
    else if (periodDuration === 'all') numDays = 120;

    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + numDays - 1);

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    return {
      startDate: start,
      endDate: end,
      startStr,
      endStr,
      numDays,
    };
  }, [dayOffset, periodDuration]);

  // 2. Filter records synchronized for BOTH chart and table (Shared Global State)
  const synchronizedRecords = useMemo<EnhancedDailyRateWithCompset[]>(() => {
    return records
      .filter((r) => {
        // Exclude past dates unless explicit toggle is active
        if (!showPastDates && r.dateStr < TODAY_DATE_STR) {
          return false;
        }

        // Date range filter: Shared between chart and table
        if (periodDuration !== 'all') {
          if (r.dateStr < activeDateRange.startStr || r.dateStr > activeDateRange.endStr) {
            return false;
          }
        }

        const ranking = calculateCompsetRanking(r, hotel.name);

        // Status filters
        if (statusFilter === 'significantly_cheaper' && ranking.statusClassification !== 'significantly_cheaper') return false;
        if (statusFilter === 'aligned' && ranking.statusClassification !== 'aligned') return false;
        if (statusFilter === 'more_expensive' && ranking.statusClassification !== 'more_expensive') return false;
        if (statusFilter === 'underpriced' && !r.underpricedAlert) return false;
        if (statusFilter === 'soldout' && r.compsetSoldOutCount === 0) return false;
        if (statusFilter === 'pending' && r.status !== 'pending') return false;
        if (statusFilter === 'cheapest' && !ranking.isCheapest) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = r.eventTitle?.toLowerCase().includes(q);
          const matchDate = r.dateStr.includes(q);
          const matchJustif = r.justification.toLowerCase().includes(q);
          const matchStatus = ranking.statusBadgeText.toLowerCase().includes(q);
          if (!matchTitle && !matchDate && !matchJustif && !matchStatus) return false;
        }

        return true;
      })
      .map((r) => {
        const ranking = calculateCompsetRanking(r, hotel.name);
        let bgClass = 'bg-sky-50';
        let textClass = 'text-sky-800';
        let borderClass = 'border-sky-300';
        let englishLabel = 'Aligned';

        if (ranking.statusClassification === 'significantly_cheaper') {
          bgClass = 'bg-emerald-50';
          textClass = 'text-emerald-800';
          borderClass = 'border-emerald-300';
          englishLabel = 'Significantly cheaper';
        } else if (ranking.statusClassification === 'more_expensive') {
          bgClass = 'bg-amber-50';
          textClass = 'text-amber-800';
          borderClass = 'border-amber-300';
          englishLabel = 'More expensive';
        }

        return {
          ...r,
          compsetRanking: ranking,
          rankingString: ranking.rankingFraction, // e.g. "1/6", "2/5"
          positionStatus: ranking.statusClassification,
          statusBadge: {
            label: ranking.statusBadgeText,
            englishLabel,
            bgClass,
            textClass,
            borderClass,
            description: ranking.statusDescription,
          },
        };
      })
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [records, showPastDates, periodDuration, activeDateRange, statusFilter, searchQuery, hotel.name]);

  // 3. Prepare Chart Data (Strictly synchronized with synchronizedRecords)
  const chartData = useMemo(() => {
    return synchronizedRecords.map((r) => {
      const dObj = new Date(r.dateStr);
      const formattedDate = `${dObj.getUTCDate()} ${dObj.toLocaleDateString('fr-FR', { month: 'short' })}`;

      // Competitor rate values
      const competitorValues: Record<string, number | null> = {};
      r.competitors.forEach((c) => {
        // If sold out, set to null so line discontinues without falsifying price
        competitorValues[c.hotelName] = c.isSoldOut ? null : c.rateEur;
      });

      return {
        dateStr: r.dateStr,
        displayDate: formattedDate,
        fullDate: r.dateStr,
        event: r.eventTitle || 'Sans événement',
        currentBar: r.currentBarEur,
        compsetMedian: r.compsetMedianEur,
        suggestedBar: r.suggestedBarEur,
        occupancy: r.occupancyPercent,
        soldOutCount: r.compsetSoldOutCount,
        rankingLabel: r.compsetRanking.positionLabel,
        rankingFraction: r.rankingString,
        positionStatus: r.positionStatus,
        statusBadgeText: r.statusBadge.label,
        statusEnglishText: r.statusBadge.englishLabel,
        rank: r.compsetRanking.rank,
        totalAvailable: r.compsetRanking.totalAvailable,
        ...competitorValues,
      };
    });
  }, [synchronizedRecords]);

  // 4. Aggregated Compset Positioning & Revenue Metrics on the displayed period
  const positioningStats = useMemo(() => {
    if (!synchronizedRecords.length) {
      return {
        avgRank: '1.0',
        avgTotalAvailable: 6,
        cheapestDaysCount: 0,
        significantlyCheaperDays: 0,
        alignedDays: 0,
        moreExpensiveDays: 0,
        underpricedDaysCount: 0,
        avgCurrentBar: 0,
        avgCompsetMedian: 0,
        avgGapEur: 0,
        avgGapPct: 0,
        totalGainPotential: 0,
        soldOutDatesCount: 0,
        cheaperCompsAvg: '0.0',
        moreExpensiveCompsAvg: '0.0',
      };
    }

    let totalRank = 0;
    let totalAvail = 0;
    let cheapestDays = 0;
    let significantlyCheaperDays = 0;
    let alignedDays = 0;
    let moreExpensiveDays = 0;
    let underpricedDays = 0;
    let soldOutDays = 0;
    let sumCurrentBar = 0;
    let sumMedian = 0;
    let totalGain = 0;
    let sumCheaper = 0;
    let sumMoreExpensive = 0;

    synchronizedRecords.forEach((r) => {
      const ranking = r.compsetRanking;
      totalRank += ranking.rank;
      totalAvail += ranking.totalAvailable;
      if (ranking.isCheapest) cheapestDays++;
      if (ranking.statusClassification === 'significantly_cheaper') significantlyCheaperDays++;
      else if (ranking.statusClassification === 'more_expensive') moreExpensiveDays++;
      else alignedDays++;

      if (r.underpricedAlert) underpricedDays++;
      if (r.compsetSoldOutCount > 0) soldOutDays++;
      sumCurrentBar += r.currentBarEur;
      sumMedian += r.compsetMedianEur;
      sumCheaper += ranking.cheaperCount;
      sumMoreExpensive += ranking.moreExpensiveCount;
      if (r.status === 'pending') {
        totalGain += r.revenueGainPotentialEur;
      }
    });

    const count = synchronizedRecords.length;
    const avgCurrent = Math.round(sumCurrentBar / count);
    const avgMed = Math.round(sumMedian / count);
    const avgGap = avgCurrent - avgMed;
    const avgGapPct = avgMed > 0 ? Math.round((avgGap / avgMed) * 1000) / 10 : 0;

    return {
      avgRank: (totalRank / count).toFixed(1),
      avgTotalAvailable: Math.round(totalAvail / count),
      cheapestDaysCount: cheapestDays,
      significantlyCheaperDays,
      alignedDays,
      moreExpensiveDays,
      underpricedDaysCount: underpricedDays,
      avgCurrentBar: avgCurrent,
      avgCompsetMedian: avgMed,
      avgGapEur: avgGap,
      avgGapPct,
      totalGainPotential: totalGain,
      soldOutDatesCount: soldOutDays,
      cheaperCompsAvg: (sumCheaper / count).toFixed(1),
      moreExpensiveCompsAvg: (sumMoreExpensive / count).toFixed(1),
    };
  }, [synchronizedRecords]);

  // Navigation handlers
  const handleStepPeriod = (direction: 'prev' | 'next') => {
    let step = 30;
    if (periodDuration === '7d') step = 7;
    else if (periodDuration === '14d') step = 14;
    else if (periodDuration === '30d') step = 30;
    else if (periodDuration === '60d') step = 60;
    else if (periodDuration === '90d') step = 90;

    setDayOffset((prev) => (direction === 'next' ? prev + step : prev - step));
  };

  const handleResetToToday = () => {
    setDayOffset(0);
    setShowPastDates(false);
  };

  // Toggle competitor line visibility on graph
  const handleToggleCompetitor = (compName: string) => {
    setVisibleCompetitors((prev) => ({
      ...prev,
      [compName]: !prev[compName],
    }));
  };

  const handleSetAllCompetitors = (visible: boolean) => {
    const updated: Record<string, boolean> = {};
    COMPSET_METAS.forEach((c) => {
      updated[c.name] = visible;
    });
    setVisibleCompetitors(updated);
  };

  // Actions
  const handleApplySingle = (record: DailyRateIntelligence) => {
    const updated = applyRateSuggestion(hotel.id, record.id);
    setRecords(updated);
    if (onShowToast) {
      onShowToast(
        `Tarif de ${record.suggestedBarEur}€ appliqué pour le ${record.dateStr} (Poussé vers D-EDGE CRS)`
      );
    }
  };

  const handleOpenAdjustModal = (record: DailyRateIntelligence) => {
    setAdjustingRecord(record);
    setCustomRate(record.suggestedBarEur);
    setCustomMinStay(record.suggestedMinStay);
    setCustomNote(`Ajustement manuel RM : alignement à ${record.suggestedBarEur}€`);
  };

  const handleConfirmAdjust = () => {
    if (!adjustingRecord) return;
    const updated = applyRateSuggestion(
      hotel.id,
      adjustingRecord.id,
      customRate,
      customMinStay,
      customNote
    );
    setRecords(updated);
    if (onShowToast) {
      onShowToast(
        `Tarif ajusté à ${customRate}€ (${customMinStay} nuits min.) enregistré pour le ${adjustingRecord.dateStr}`
      );
    }
    setAdjustingRecord(null);
  };

  const handleApplyAll = () => {
    const { updated, count } = applyAllRateSuggestions(hotel.id);
    setRecords(updated);
    if (onShowToast) {
      onShowToast(
        `${count} tarifs suggérés ont été validés et synchronisés avec le CRS D-EDGE`
      );
    }
  };

  const handleExport = () => {
    exportRateGridToCSV(synchronizedRecords, hotel.name);
    if (onShowToast) {
      onShowToast(`Export CSV de Pricing Intelligence généré avec succès (${synchronizedRecords.length} dates)`);
    }
  };

  const handleToggleRowExpand = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  // Active competitor lines count on graph
  const activeCompetitorLinesCount = Object.values(visibleCompetitors).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* 1. Header Card (Updated to PRICING INTELLIGENCE) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-violet-600/10 text-violet-700 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </span>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Pricing Intelligence
                </h1>
                <span className="text-[10px] font-bold uppercase bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full border border-violet-200">
                  Positionnement & Recommandations RM
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 max-w-4xl leading-relaxed">
              Analyse concurrentielle, positionnement tarifaire et recommandations de prix. Surveillez votre rang tarifaire parmi le compset Lighthouse et maximisez votre RevPAR grâce aux suggestions optimisées de Flowtym RM.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onGoToExcelUpload && (
              <button
                onClick={onGoToExcelUpload}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-slate-600" />
                <span>Importer Fichiers Excel</span>
              </button>
            )}

            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Exporter (CSV)</span>
            </button>

            <button
              onClick={handleApplyAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800 transition-all shadow-2xs cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Tout Valider & Pousser ({positioningStats.underpricedDaysCount})</span>
            </button>
          </div>
        </div>

        {/* Sync & Target Hotel Status Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-bold text-slate-800">
              <Building className="w-3.5 h-3.5 text-violet-600" />
              {hotel.name} ({hotel.roomCount || 45} ch. • {hotel.city})
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Compset Lighthouse connecté (5 hôtels 3★ et 4★ suivis en direct)
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>Date de référence : <strong>04 nov. 2026</strong></span>
            <span className="text-slate-300">•</span>
            <span>{synchronizedRecords.length} dates affichées en direct</span>
          </div>
        </div>
      </div>

      {/* 2. Positioning & Commercial Opportunity KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: POSITIONNEMENT SYNTHÉTIQUE COMPSET */}
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50/60 rounded-2xl border border-violet-200/90 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-violet-800 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-violet-600" />
              <span>Position Compset</span>
            </span>
            <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
              Rang {positioningStats.avgRank} / {positioningStats.avgTotalAvailable}
            </span>
          </div>
          <div className="text-xl font-black text-violet-950 tracking-tight">
            {Number(positioningStats.avgRank) <= 1.8
              ? '1er moins cher du Compset'
              : Number(positioningStats.avgRank) <= 2.8
              ? '2e moins cher'
              : 'Position Médiane'}
          </div>
          <p className="text-[11px] text-violet-700 leading-tight">
            {positioningStats.moreExpensiveCompsAvg} concurrents plus chers • {positioningStats.cheaperCompsAvg} moins cher
          </p>
        </div>

        {/* KPI 2: TARIF HÔTEL vs MÉDIANE COMPSET */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Mon Hôtel vs Médiane</span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
              Lighthouse
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums flex items-baseline gap-2">
            <span>{positioningStats.avgCurrentBar} €</span>
            <span className="text-xs font-normal text-slate-400">
              (Méd. {positioningStats.avgCompsetMedian} €)
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-600">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>
              {positioningStats.avgGapEur} € ({positioningStats.avgGapPct}%) sous le marché
            </span>
          </div>
        </div>

        {/* KPI 3: OPPORTUNITÉ REVPAR DÉTECTÉE */}
        <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200/90 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold">
            <span>Gain RevPAR Détecté</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
              Flowtym RM
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">
            +{positioningStats.totalGainPotential.toLocaleString('fr-FR')} €
          </div>
          <p className="text-[11px] text-emerald-700/80">
            Sur la période affichée
          </p>
        </div>

        {/* KPI 4: POSITIONNEMENT MARCHÉ & STATUTS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Statuts Positionnement</span>
            <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200/60">
              Compset
            </span>
          </div>
          <div className="flex items-center gap-1.5 pt-0.5">
            <span
              className="inline-flex items-center gap-1 text-xs font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"
              title="Significativement moins cher (Significantly cheaper)"
            >
              <ArrowDownRight className="w-3 h-3 text-emerald-600" />
              {positioningStats.significantlyCheaperDays}j
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs font-black text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200"
              title="Aligné sur le marché (Aligned)"
            >
              <CheckCircle2 className="w-3 h-3 text-sky-600" />
              {positioningStats.alignedDays}j
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200"
              title="Plus cher que le compset (More expensive)"
            >
              <ArrowUpRight className="w-3 h-3 text-amber-600" />
              {positioningStats.moreExpensiveDays}j
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            🟢 Moins cher • 🔵 Aligné • 🟠 Plus cher
          </p>
        </div>

        {/* KPI 5: TENSION COMPSET / SOLD-OUT */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Concurrents Sold-Out</span>
            <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200/60">
              Compression
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {positioningStats.soldOutDatesCount} <span className="text-xs font-normal text-slate-500">dates</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Ruptures de stock concurrentielles
          </p>
        </div>
      </div>

      {/* 3. Filter Toolbar & Date Range Selector (Synchronized globally for Chart & Grid) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Left: Date Range Selector (7, 14, 30 days default, 60, 90 days, all) */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-violet-600" />
            <span>Horizon temporel :</span>
          </div>

          {/* Date Range Selector Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold shadow-2xs">
            {(
              [
                { id: '7d', label: '7 jours' },
                { id: '14d', label: '14 jours' },
                { id: '30d', label: '30 jours (Défaut)' },
                { id: '60d', label: '60 jours' },
                { id: '90d', label: '90 jours' },
                { id: 'all', label: 'Tout' },
              ] as { id: PeriodDuration; label: string }[]
            ).map((btn) => (
              <button
                key={btn.id}
                onClick={() => {
                  setPeriodDuration(btn.id);
                  setDayOffset(0);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                  periodDuration === btn.id
                    ? 'bg-violet-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Stepper to slide the selected period backwards or forwards */}
          {periodDuration !== 'all' && (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-1 text-xs">
              <button
                onClick={() => handleStepPeriod('prev')}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
                title="Reculer dans la période sans modifier la durée"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetToToday}
                className="px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:text-violet-700 transition-colors cursor-pointer"
                title="Revenir à partir d'aujourd'hui"
              >
                Aujourd&apos;hui
              </button>
              <button
                onClick={() => handleStepPeriod('next')}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
                title="Avancer dans la période sans modifier la durée"
              >
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Active window preview chip */}
          <div className="hidden xl:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
            <span>📅 {new Date(activeDateRange.startStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
            <span>→</span>
            <span>{new Date(activeDateRange.endStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
            <span className="text-violet-700 font-bold ml-1">({activeDateRange.numDays}j synchronisés)</span>
          </div>

          {/* Toggle Past Dates checkbox */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer ml-1 select-none bg-slate-50 border border-slate-200/70 px-2 py-1 rounded-xl hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={showPastDates}
              onChange={(e) => setShowPastDates(e.target.checked)}
              className="rounded accent-violet-600 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="font-medium">Dates passées</span>
          </label>
        </div>

        {/* Right: View Mode & Search & Status Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status selector with significantly_cheaper, aligned, more_expensive */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="all">Toutes les positions ({synchronizedRecords.length})</option>
              <option value="significantly_cheaper">🟢 Significativement moins cher (Significantly cheaper)</option>
              <option value="aligned">🔵 Aligné sur le marché (Aligned)</option>
              <option value="more_expensive">🟠 Plus cher que le compset (More expensive)</option>
              <option value="cheapest">🏆 1er moins cher de tout le quartier</option>
              <option value="underpriced">⚡ Sous-tarification critique</option>
              <option value="soldout">🔴 Concurrents en Sold-Out</option>
              <option value="pending">⏳ Recommandations RM en attente</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher date ou événement..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs w-44 focus:w-56 transition-all focus:outline-hidden focus:border-violet-500"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode('both')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'both' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              Mixte
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              Grille
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'chart' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              Graphique
            </button>
          </div>
        </div>
      </div>

      {/* 4. Comparative Positioning Chart with Individual Competitors Toggle */}
      {(viewMode === 'chart' || viewMode === 'both') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-600" />
                <span>Courbes de Positionnement : Mon Hôtel vs Compset Médian vs Recommandations RM</span>
              </h2>
              <p className="text-xs text-slate-500">
                Du <strong>{new Date(activeDateRange.startStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</strong> au <strong>{new Date(activeDateRange.endStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</strong> ({chartData.length} dates)
              </p>
            </div>

            {/* Individual Competitor Display Controls */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600 text-[11px]">
                Détail concurrents :
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  onClick={() => handleSetAllCompetitors(true)}
                  className="px-2 py-0.5 rounded text-slate-600 hover:text-slate-900 hover:bg-white cursor-pointer"
                >
                  Tous
                </button>
                <button
                  onClick={() => handleSetAllCompetitors(false)}
                  className="px-2 py-0.5 rounded text-slate-600 hover:text-slate-900 hover:bg-white cursor-pointer"
                >
                  Aucun
                </button>
              </div>

              {COMPSET_METAS.map((c) => {
                const isSelected = !!visibleCompetitors[c.name];
                return (
                  <button
                    key={c.name}
                    onClick={() => handleToggleCompetitor(c.name)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="truncate max-w-[110px]" title={c.name}>
                      {c.name.replace('Hôtel ', '')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chart Display */}
          <div className="h-80 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval={chartData.length > 40 ? 3 : chartData.length > 20 ? 1 : 0}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  domain={[180, 550]}
                  unit="€"
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#10b981' }}
                  domain={[0, 100]}
                  unit="%"
                  axisLine={{ stroke: '#10b981' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl text-xs space-y-2 border border-slate-800 max-w-xs">
                          <div className="font-bold text-slate-100 flex items-center justify-between border-b border-slate-800 pb-1.5">
                            <span>{data.fullDate}</span>
                            <span className="text-violet-400 font-semibold truncate max-w-[140px]">
                              {data.event}
                            </span>
                          </div>

                          <div className="space-y-1 font-mono text-[11px]">
                            <div className="flex justify-between text-white font-bold bg-slate-800/80 px-1.5 py-0.5 rounded">
                              <span>Mon Hôtel (BAR) :</span>
                              <span>{data.currentBar} €</span>
                            </div>
                            <div className="flex justify-between text-amber-300">
                              <span>Médiane Compset :</span>
                              <span>{data.compsetMedian} €</span>
                            </div>
                            <div className="flex justify-between text-violet-300 font-bold">
                              <span>Tarif Suggéré IA :</span>
                              <span>{data.suggestedBar} €</span>
                            </div>
                            <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800">
                              <span>Position Compset :</span>
                              <span className="font-bold text-white bg-violet-600/70 px-1.5 py-0.2 rounded text-[10px]">
                                {data.rankingFraction} ({data.rank}e / {data.totalAvailable})
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] pt-0.5">
                              <span className="text-slate-400">Statut :</span>
                              <span
                                className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                                  data.positionStatus === 'significantly_cheaper'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                    : data.positionStatus === 'more_expensive'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                                    : 'bg-sky-950 text-sky-300 border border-sky-500/40'
                                }`}
                              >
                                {data.statusBadgeText}
                              </span>
                            </div>
                            <div className="flex justify-between text-emerald-400">
                              <span>Occupation OTB :</span>
                              <span>{data.occupancy}%</span>
                            </div>

                            {/* Active individual competitors */}
                            {COMPSET_METAS.filter((c) => visibleCompetitors[c.name]).map((c) => (
                              <div
                                key={c.name}
                                className="flex justify-between text-[10px] text-slate-300 pt-0.5"
                              >
                                <span className="truncate max-w-[120px]">{c.name} :</span>
                                <span>{data[c.name] ? `${data[c.name]} €` : 'Complet'}</span>
                              </div>
                            ))}

                            {data.soldOutCount > 0 && (
                              <div className="text-rose-400 font-bold pt-1 text-[10px]">
                                🔴 {data.soldOutCount} concurrents complets (sold-out)
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Primary Series */}
                <Bar
                  yAxisId="left"
                  dataKey="currentBar"
                  fill="#64748b"
                  radius={[4, 4, 0, 0]}
                  name="Mon Hôtel"
                  barSize={chartData.length > 40 ? 6 : chartData.length > 15 ? 10 : 16}
                />
                <Bar
                  yAxisId="left"
                  dataKey="compsetMedian"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  name="Médiane Compset"
                  barSize={chartData.length > 40 ? 6 : chartData.length > 15 ? 10 : 16}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="suggestedBar"
                  stroke="#7c3aed"
                  strokeWidth={2.5}
                  dot={{ r: chartData.length > 30 ? 2 : 4, fill: '#7c3aed' }}
                  name="Tarif Suggéré RM"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="occupancy"
                  fill="#10b981"
                  stroke="#10b981"
                  fillOpacity={0.08}
                  strokeWidth={1.5}
                  name="Occ. % OTB"
                />

                {/* Dynamic Competitor Lines when toggled by user */}
                {COMPSET_METAS.map((c) => {
                  if (!visibleCompetitors[c.name]) return null;
                  return (
                    <Line
                      key={c.name}
                      yAxisId="left"
                      type="monotone"
                      dataKey={c.name}
                      stroke={c.color}
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      dot={{ r: 2.5, fill: c.color }}
                      connectNulls={false}
                      name={c.name}
                    />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 5. Synchronized Positioning & Rate Grid */}
      {(viewMode === 'table' || viewMode === 'both') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-600" />
                <span>Grille de Positionnement Concurrentiel ({synchronizedRecords.length} dates)</span>
              </h2>
              <p className="text-xs text-slate-500">
                Période active : <strong>{new Date(activeDateRange.startStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</strong> au <strong>{new Date(activeDateRange.endStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</strong>. Cliquez sur une ligne pour afficher le comparatif classé des 6 hôtels.
              </p>
            </div>

            <div className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200 shrink-0">
              {synchronizedRecords.filter((r) => r.underpricedAlert).length} dates en sous-tarification critique
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date & Événement</th>
                  <th className="py-3 px-3">Tarif Mon Hôtel</th>
                  <th className="py-3 px-3">Position Compset</th>
                  <th className="py-3 px-3">Compset Médian</th>
                  <th className="py-3 px-3">Écart vs Marché</th>
                  <th className="py-3 px-4">Tarif Suggéré RM</th>
                  <th className="py-3 px-3 text-center">Gain Estimé</th>
                  <th className="py-3 px-3 text-center">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {synchronizedRecords.map((r) => {
                  const isExpanded = expandedRowId === r.id;
                  const ranking = calculateCompsetRanking(r, hotel.name);
                  const isUnderpriced = r.underpricedAlert && r.status === 'pending';
                  const isApplied = r.status === 'applied';

                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        onClick={() => handleToggleRowExpand(r.id)}
                        className={`transition-colors cursor-pointer ${
                          isUnderpriced
                            ? 'bg-rose-50/30 hover:bg-rose-50/60'
                            : isApplied
                            ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Date & Event */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 whitespace-nowrap">
                              {r.dayOfWeek.slice(0, 3)}. {new Date(r.dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {r.dateStr.slice(0, 4)}
                            </span>
                          </div>
                          {r.eventTitle ? (
                            <div className="text-[11px] font-semibold text-violet-700 truncate max-w-xs mt-0.5 flex items-center gap-1">
                              <span>{r.eventTitle}</span>
                              {r.rmScore && (
                                <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1 rounded">
                                  Score {r.rmScore}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">Sans événement majeur</span>
                          )}
                        </td>

                        {/* Mon Hôtel BAR */}
                        <td className="py-3.5 px-3">
                          <div className="font-black text-slate-900 text-sm tabular-nums">
                            {r.currentBarEur} €
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {r.occupancyPercent}% Occ. • {r.remainingRooms} dispo
                          </div>
                        </td>

                        {/* Position Compset (e.g. 1/6) + Visual Indicators ('significantly cheaper', 'aligned', 'more expensive') */}
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5">
                              {/* Ranking Chip in Compset (e.g. 1/6) */}
                              <span
                                className={`inline-flex items-center gap-1 font-black text-xs px-2.5 py-1 rounded-lg border tabular-nums shadow-2xs ${
                                  ranking.isCheapest
                                    ? 'bg-violet-100 text-violet-900 border-violet-300 ring-1 ring-violet-400/30'
                                    : ranking.isMostExpensive
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-slate-100 text-slate-800 border-slate-300'
                                }`}
                                title={`Position de l'hôtel : ${r.rankingString} (${ranking.rank}e sur ${ranking.totalAvailable} hôtels disponibles)`}
                              >
                                <Trophy className="w-3.5 h-3.5 text-violet-700 shrink-0" />
                                <span>{r.rankingString}</span>
                              </span>

                              {/* Visual Status Indicator: 'significantly cheaper', 'aligned', 'more expensive' */}
                              {r.positionStatus === 'significantly_cheaper' && (
                                <span
                                  className="inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap"
                                  title="Significativement moins cher (Significantly cheaper) — Risque de sous-tarification"
                                >
                                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                  <span>Moins cher</span>
                                </span>
                              )}

                              {r.positionStatus === 'aligned' && (
                                <span
                                  className="inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 border border-sky-300 whitespace-nowrap"
                                  title="Aligné sur le marché (Aligned)"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                                  <span>Aligné</span>
                                </span>
                              )}

                              {r.positionStatus === 'more_expensive' && (
                                <span
                                  className="inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap"
                                  title="Plus cher que le compset (More expensive)"
                                >
                                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                  <span>Plus cher</span>
                                </span>
                              )}
                            </div>

                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 leading-tight">
                              <span className="font-medium">{ranking.positionLabel}</span>
                              {ranking.soldOutCount > 0 && (
                                <span className="text-rose-600 font-semibold">• {ranking.soldOutCount} sold-out</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Compset Médian */}
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-900 tabular-nums">
                            {r.compsetMedianEur} €
                          </div>
                          <div className="text-[10px] text-slate-400">
                            [{r.compsetMinEur}€ - {r.compsetMaxEur}€]
                          </div>
                        </td>

                        {/* Écart vs Marché */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center font-bold text-xs px-2 py-0.5 rounded-md tabular-nums border ${
                              r.gapVsMedianEur <= -30
                                ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                                : r.gapVsMedianEur >= 30
                                ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                                : 'bg-slate-50 text-slate-700 border-slate-200/80'
                            }`}
                          >
                            {r.gapVsMedianEur > 0 ? `+${r.gapVsMedianEur} €` : `${r.gapVsMedianEur} €`}
                          </span>
                        </td>

                        {/* Suggested Rate */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-violet-700 text-base tabular-nums">
                              {r.suggestedBarEur} €
                            </span>
                            {r.deltaVsCurrentEur > 0 && (
                              <span className="text-[10px] font-bold bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded-full">
                                +{r.deltaVsCurrentEur} € (+{r.deltaVsCurrentPercent}%)
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">
                            Min Stay: {r.suggestedMinStay}n {r.suggestedStopSellPromos ? '• Stop Promos' : ''}
                          </div>
                        </td>

                        {/* Gain RevPAR Potential */}
                        <td className="py-3.5 px-3 text-center">
                          <span className="font-bold text-emerald-700 tabular-nums">
                            +{r.revenueGainPotentialEur.toLocaleString('fr-FR')} €
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3 text-center">
                          {r.status === 'applied' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Poussé CRS
                            </span>
                          ) : r.status === 'modified' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              <Sliders className="w-3 h-3" />
                              Modifié
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              <Clock className="w-3 h-3" />
                              À valider
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div
                            className="inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleApplySingle(r)}
                              title="Valider et pousser vers D-EDGE"
                              className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>Valider</span>
                            </button>
                            <button
                              onClick={() => handleOpenAdjustModal(r)}
                              title="Ajuster manuellement le tarif"
                              className="p-1 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleRowExpand(r.id)}
                              title="Voir le classement complet du compset"
                              className="p-1 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Competitor Detail Drawer (Requirement 4.D & 5) */}
                      {isExpanded && (
                        <tr className="bg-slate-50/95 border-b border-slate-200">
                          <td colSpan={9} className="p-4 space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200/70 pb-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                  <Trophy className="w-3.5 h-3.5 text-violet-600" />
                                  <span>Classement Compset : {r.rankingString}</span>
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium">
                                  ({ranking.totalAvailable} hôtels disponibles sur {ranking.totalCompset})
                                </span>
                                {r.positionStatus === 'significantly_cheaper' && (
                                  <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <ArrowDownRight className="w-3 h-3 text-emerald-700" />
                                    <span>Significativement moins cher</span>
                                  </span>
                                )}
                                {r.positionStatus === 'aligned' && (
                                  <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300">
                                    <CheckCircle2 className="w-3 h-3 text-sky-700" />
                                    <span>Aligné marché</span>
                                  </span>
                                )}
                                {r.positionStatus === 'more_expensive' && (
                                  <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                    <ArrowUpRight className="w-3 h-3 text-amber-700" />
                                    <span>Plus cher que le compset</span>
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-violet-700 font-semibold italic">
                                Justification RM : {r.justification}
                              </div>
                            </div>

                            {/* Insufficient sample warning (Requirement 5) */}
                            {ranking.soldOutCount >= 2 && (
                              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>
                                  <strong>Avertissement Compset :</strong> {ranking.soldOutCount} concurrents sont en rupture de stock (sold-out). Le classement disponible repose sur un échantillon restreint de {ranking.totalAvailable} établissements.
                                </span>
                              </div>
                            )}

                            {/* Ranking Table matching user request table format */}
                            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-2xs">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                                  <tr>
                                    <th className="py-2 px-3 text-center">Position</th>
                                    <th className="py-2 px-3">Établissement</th>
                                    <th className="py-2 px-3">Catégorie & Type</th>
                                    <th className="py-2 px-3 text-right">Tarif BAR (€)</th>
                                    <th className="py-2 px-3 text-right">Écart vs Mon Hôtel</th>
                                    <th className="py-2 px-3 text-center">Statut Disponibilité</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {ranking.fullRankingTable.map((item, idx) => (
                                    <tr
                                      key={idx}
                                      className={
                                        item.isCurrentHotel
                                          ? 'bg-violet-50/70 font-semibold text-violet-950 ring-1 ring-violet-300'
                                          : item.isSoldOut
                                          ? 'bg-slate-50 text-slate-400'
                                          : 'hover:bg-slate-50/60'
                                      }
                                    >
                                      {/* Position */}
                                      <td className="py-2.5 px-3 text-center">
                                        {item.rank !== null ? (
                                          <span
                                            className={`inline-block font-extrabold text-xs px-2 py-0.5 rounded-md tabular-nums ${
                                              item.isCurrentHotel
                                                ? 'bg-violet-600 text-white shadow-2xs'
                                                : item.rank === 1
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-slate-100 text-slate-700'
                                            }`}
                                          >
                                            {item.rank}/{ranking.totalAvailable}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                                            Exclu
                                          </span>
                                        )}
                                      </td>

                                      {/* Établissement */}
                                      <td className="py-2.5 px-3">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold">{item.hotelName}</span>
                                          {item.isCurrentHotel && (
                                            <span className="text-[9px] font-black uppercase bg-violet-600 text-white px-1.5 py-0.2 rounded-full">
                                              Votre Hôtel
                                            </span>
                                          )}
                                        </div>
                                      </td>

                                      {/* Catégorie & Type */}
                                      <td className="py-2.5 px-3 text-slate-500">
                                        <span>{item.stars}★ • {item.roomType}</span>
                                      </td>

                                      {/* Tarif BAR */}
                                      <td className="py-2.5 px-3 text-right font-black tabular-nums text-sm">
                                        {item.isSoldOut ? (
                                          <span className="text-slate-400 line-through">
                                            {item.rateEur > 0 ? `${item.rateEur} €` : 'N/A'}
                                          </span>
                                        ) : (
                                          <span className={item.isCurrentHotel ? 'text-violet-700' : 'text-slate-900'}>
                                            {item.rateEur} €
                                          </span>
                                        )}
                                      </td>

                                      {/* Écart vs Mon Hôtel */}
                                      <td className="py-2.5 px-3 text-right tabular-nums">
                                        {item.isCurrentHotel ? (
                                          <span className="text-violet-700 font-bold">— Référence</span>
                                        ) : item.isSoldOut ? (
                                          <span className="text-slate-400">N/A</span>
                                        ) : item.gapVsHotelEur > 0 ? (
                                          <span className="text-emerald-700 font-semibold">
                                            +{item.gapVsHotelEur} € (+{Math.round((item.gapVsHotelEur / r.currentBarEur) * 100)}%)
                                          </span>
                                        ) : item.gapVsHotelEur < 0 ? (
                                          <span className="text-rose-700 font-semibold">
                                            {item.gapVsHotelEur} € ({Math.round((item.gapVsHotelEur / r.currentBarEur) * 100)}%)
                                          </span>
                                        ) : (
                                          <span className="text-slate-500 font-semibold">Identique (0 €)</span>
                                        )}
                                      </td>

                                      {/* Statut Disponibilité */}
                                      <td className="py-2.5 px-3 text-center">
                                        {item.isSoldOut ? (
                                          <span className="text-[10px] font-black uppercase text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
                                            Complet (Sold-Out)
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                            Disponible
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Manual Rate Adjustment Modal */}
      {adjustingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-violet-600" />
                  <span>Ajuster le Tarif Manuellement</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pour le {adjustingRecord.dayOfWeek} {adjustingRecord.dateStr}
                </p>
              </div>
              <button
                onClick={() => setAdjustingRecord(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Event context */}
            {adjustingRecord.eventTitle && (
              <div className="bg-violet-50 p-3 rounded-2xl border border-violet-100 text-xs space-y-1">
                <span className="font-bold text-violet-900">{adjustingRecord.eventTitle}</span>
                <p className="text-violet-700/80 leading-relaxed text-[11px]">
                  {adjustingRecord.justification}
                </p>
              </div>
            )}

            {/* Price slider & numeric input */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Nouveau Tarif BAR Proposé :</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={customRate}
                    onChange={(e) => setCustomRate(Number(e.target.value))}
                    className="w-24 text-right font-bold text-lg text-violet-700 border border-slate-300 rounded-xl px-2 py-1 focus:outline-hidden focus:border-violet-500"
                  />
                  <span className="font-bold text-slate-900">€</span>
                </div>
              </div>

              <input
                type="range"
                min={150}
                max={600}
                step={5}
                value={customRate}
                onChange={(e) => setCustomRate(Number(e.target.value))}
                className="w-full accent-violet-600 cursor-pointer"
              />

              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>Actuel: {adjustingRecord.currentBarEur}€</span>
                <span className="text-amber-600 font-semibold">Compset Médian: {adjustingRecord.compsetMedianEur}€</span>
                <span className="text-violet-600 font-semibold">Suggéré IA: {adjustingRecord.suggestedBarEur}€</span>
              </div>
            </div>

            {/* Min Stay Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Restriction de Séjour Minimum (Min Stay) :
              </label>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCustomMinStay(n)}
                    className={`py-2 rounded-xl font-bold border transition-all cursor-pointer ${
                      customMinStay === n
                        ? 'bg-violet-600 text-white border-violet-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {n} {n > 1 ? 'nuits' : 'nuit'}
                  </button>
                ))}
              </div>
            </div>

            {/* Impact Calculation Preview */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs flex items-center justify-between">
              <span className="text-slate-600">Gain estimé avec ce tarif :</span>
              <span className="font-bold text-emerald-700 text-sm">
                +{Math.round((customRate - adjustingRecord.currentBarEur) * (adjustingRecord.remainingRooms || 5) * 0.85)} € RevPAR
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdjustingRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmAdjust}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Valider & Transmettre à D-EDGE</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
