/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Users,
  TrendingUp,
  DollarSign,
  Percent,
  Download,
  Info,
  Building,
  Heart,
  Briefcase,
  Sparkles,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ComposedChart,
  Line,
} from 'recharts';
import { Hotel } from '../../types';
import {
  CLIENT_SEGMENTS,
  ClientSegmentKey,
  HolidaySeasonHistoricalSummary,
  getHotelHistoricalHolidayData,
  exportHolidaySegmentComparisonCSV,
} from '../../data/schoolHolidaysHistoricalData';

interface SchoolHolidaysImpactViewProps {
  hotel: Hotel;
  onShowToast?: (msg: string) => void;
  onGoToSchoolHolidaysCalendar?: () => void;
}

export const SchoolHolidaysImpactView: React.FC<SchoolHolidaysImpactViewProps> = ({
  hotel,
  onShowToast,
  onGoToSchoolHolidaysCalendar,
}) => {
  // Load data for the hotel
  const seasonsData = useMemo(() => {
    return getHotelHistoricalHolidayData(hotel.id);
  }, [hotel.id]);

  // Selected holiday season period
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('toussaint');

  // Active period
  const activeSeason = useMemo(() => {
    return seasonsData.find((s) => s.periodId === selectedPeriodId) || seasonsData[0];
  }, [seasonsData, selectedPeriodId]);

  // Selected segment filter ('all' or specific segment)
  const [selectedSegmentFilter, setSelectedSegmentFilter] = useState<string>('all');

  // Chart Metric Mode: 'adr' | 'occupancy' | 'revpar' | 'revenue'
  const [chartMetric, setChartMetric] = useState<'adr' | 'occupancy' | 'revpar' | 'revenue'>('adr');

  // Filtered segments
  const displayedSegments = useMemo(() => {
    if (selectedSegmentFilter === 'all') {
      return activeSeason.segments;
    }
    return activeSeason.segments.filter((s) => s.segmentKey === selectedSegmentFilter);
  }, [activeSeason, selectedSegmentFilter]);

  // Chart data preparation
  const chartData = useMemo(() => {
    return activeSeason.segments.map((seg) => {
      const meta = CLIENT_SEGMENTS.find((m) => m.key === seg.segmentKey);
      return {
        segmentKey: seg.segmentKey,
        name: meta ? meta.shortLabel : seg.segmentKey,
        fullName: meta ? meta.label : seg.segmentKey,
        color: meta ? meta.color : '#8b5cf6',
        // ADR values
        adrN: seg.adrN,
        adrN1: seg.adrN1,
        adrN2: seg.adrN2,
        baselineADR: seg.baselineRegularADR,
        // Occupancy values
        occN: seg.occupancyN,
        occN1: seg.occupancyN1,
        occN2: seg.occupancyN2,
        baselineOcc: seg.baselineRegularOcc,
        // RevPAR values
        revParN: seg.revParN,
        revParN1: seg.revParN1,
        revParN2: seg.revParN2,
        // Revenue values
        revenueN: seg.revenueN,
        revenueN1: seg.revenueN1,
        revenueN2: seg.revenueN2,
      };
    });
  }, [activeSeason]);

  // Handle Export CSV
  const handleExport = () => {
    exportHolidaySegmentComparisonCSV(activeSeason, hotel.name);
    if (onShowToast) {
      onShowToast(`Export CSV de l'analyse segmentaire (${activeSeason.name}) téléchargé`);
    }
  };

  // Helper to get segment icon
  const getSegmentIcon = (key: ClientSegmentKey) => {
    switch (key) {
      case 'leisure_family':
        return <Users className="w-4 h-4 text-violet-600" />;
      case 'leisure_couples':
        return <Heart className="w-4 h-4 text-pink-600" />;
      case 'business_corporate':
        return <Briefcase className="w-4 h-4 text-blue-600" />;
      case 'groups_tour':
        return <Building className="w-4 h-4 text-amber-600" />;
      case 'direct_web':
        return <Sparkles className="w-4 h-4 text-emerald-600" />;
      case 'ota_indirect':
        return <Globe className="w-4 h-4 text-slate-600" />;
      default:
        return <Users className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Context */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-violet-600/10 text-violet-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </span>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Impact Historique des Vacances Scolaires & Segmentation Clientèle
                </h2>
                <span className="text-[10px] font-bold uppercase bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full border border-violet-200">
                  RM Analytics & Mix
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 max-w-4xl leading-relaxed">
              Analysez et comparez l&apos;impact concret des calendriers scolaires européens sur les performances historiques (<strong>ADR</strong>, <strong>Taux d&apos;Occupation</strong>, <strong>RevPAR</strong>) des années <strong>2026</strong>, <strong>2025</strong> et <strong>2024</strong> pour chacun de vos segments de clientèle.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onGoToSchoolHolidaysCalendar && (
              <button
                onClick={onGoToSchoolHolidaysCalendar}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-600" />
                <span>Calendrier Multi-Pays</span>
              </button>
            )}

            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800 transition-all shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter Rapport Segmentaire (CSV)</span>
            </button>
          </div>
        </div>

        {/* Hotel Capacité & Profile Info Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-bold text-slate-800">
              <Building className="w-3.5 h-3.5 text-violet-600" />
              {hotel.name} ({hotel.city})
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600">
              Capacité : <strong>{hotel.roomCount || 45} chambres</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-violet-700 font-semibold bg-violet-50 px-2 py-0.5 rounded-md border border-violet-100">
              Potentiel Familial : 16 ch. (35.6% du parc : triples, quadruples, communicantes)
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            Sources PMS Night Audit clôturées (Opera / Protel) + Historique PMS consolidé
          </div>
        </div>
      </div>

      {/* 2. Holiday Season Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold text-slate-600">
        {seasonsData.map((season) => {
          const isActive = selectedPeriodId === season.periodId;
          return (
            <button
              key={season.periodId}
              onClick={() => setSelectedPeriodId(season.periodId)}
              className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border ${
                isActive
                  ? 'bg-violet-600 text-white border-violet-600 shadow-2xs ring-1 ring-violet-500'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{season.name}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {season.totalDays}j
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Global Period Performance KPI Cards (N vs N-1 vs N-2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Taux d'Occupation */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Taux d&apos;Occupation Global</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
              +{activeSeason.deltaOccVsN1Pts} pts vs N-1
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums flex items-baseline gap-2">
            <span>{activeSeason.globalOccN}%</span>
            <span className="text-xs font-normal text-slate-400">
              (N-1: {activeSeason.globalOccN1}% • N-2: {activeSeason.globalOccN2}%)
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            {activeSeason.activeZones}
          </p>
        </div>

        {/* KPI 2: ADR Moyen */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Prix Moyen Journalier (ADR)</span>
            <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200/60">
              +{activeSeason.deltaAdrVsN1Pct}% vs N-1
            </span>
          </div>
          <div className="text-2xl font-bold text-violet-700 tabular-nums flex items-baseline gap-2">
            <span>{activeSeason.globalAdrN} €</span>
            <span className="text-xs font-normal text-slate-400">
              (N-1: {activeSeason.globalAdrN1}€ • N-2: {activeSeason.globalAdrN2}€)
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-violet-700 font-semibold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{activeSeason.globalAdrN - activeSeason.globalAdrN1} € d&apos;augmentation tarifaire nette</span>
          </div>
        </div>

        {/* KPI 3: RevPAR Global */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>RevPAR de la Période</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
              +{activeSeason.deltaRevParVsN1Pct}%
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums flex items-baseline gap-2">
            <span>{activeSeason.globalRevParN} €</span>
            <span className="text-xs font-normal text-slate-400">
              (N-1: {activeSeason.globalRevParN1}€ • N-2: {activeSeason.globalRevParN2}€)
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Revenu par chambre disponible
          </p>
        </div>

        {/* KPI 4: Chiffre d'Affaires Hébergement */}
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50/50 rounded-2xl border border-violet-200/90 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-violet-800 text-xs font-semibold">
            <span>CA Hébergement Total</span>
            <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">
              {activeSeason.totalDays} jours
            </span>
          </div>
          <div className="text-2xl font-bold text-violet-900 tabular-nums">
            {activeSeason.totalRevenueN.toLocaleString('fr-FR')} €
          </div>
          <p className="text-[11px] text-violet-700/80">
            +{Math.round(activeSeason.totalRevenueN - activeSeason.totalRevenueN1).toLocaleString('fr-FR')} € vs l&apos;année N-1
          </p>
        </div>
      </div>

      {/* 4. Strategic Verdict Banner */}
      <div className="bg-slate-900 text-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-4xl">
          <div className="flex items-center gap-2 text-violet-400 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Synthèse Stratégique RM — {activeSeason.name}</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {activeSeason.strategicVerdict}
          </p>
        </div>

        {/* Feeder markets flags for this season */}
        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 shrink-0 space-y-1.5 text-xs">
          <div className="text-[10px] text-slate-400 font-bold uppercase">Marchés Émetteurs Clés :</div>
          <div className="flex items-center gap-2">
            {activeSeason.keyFeederCountries.map((c) => (
              <span
                key={c.code}
                className="inline-flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700 text-white font-medium text-xs"
                title={`${c.name} : ${c.sharePct}% du mix`}
              >
                <span>{c.flag}</span>
                <span className="tabular-nums font-bold text-slate-200">{c.sharePct}%</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Comparative Recharts Visualizer */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-600" />
              <span>Comparatif Multi-Années par Segment de Clientèle ({activeSeason.name})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Visualisez l&apos;évolution de chaque segment entre l&apos;Année N (2026), N-1 (2025) et N-2 (2024).
            </p>
          </div>

          {/* Metric Selector Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setChartMetric('adr')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartMetric === 'adr' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ADR (€)
            </button>
            <button
              onClick={() => setChartMetric('occupancy')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartMetric === 'occupancy' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Occupation (%)
            </button>
            <button
              onClick={() => setChartMetric('revpar')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartMetric === 'revpar' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              RevPAR (€)
            </button>
            <button
              onClick={() => setChartMetric('revenue')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartMetric === 'revenue' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              CA Total (€)
            </button>
          </div>
        </div>

        {/* Recharts Bar Chart */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                unit={chartMetric === 'occupancy' ? '%' : '€'}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl text-xs space-y-2 border border-slate-800">
                        <div className="font-bold text-violet-300 border-b border-slate-800 pb-1 flex items-center justify-between gap-4">
                          <span>{data.fullName}</span>
                          <span className="text-[10px] text-slate-400">{activeSeason.name}</span>
                        </div>
                        <div className="space-y-1 font-mono text-[11px]">
                          {chartMetric === 'adr' && (
                            <>
                              <div className="flex justify-between gap-4 text-violet-300 font-bold">
                                <span>Année N (2026) :</span>
                                <span>{data.adrN} €</span>
                              </div>
                              <div className="flex justify-between gap-4 text-slate-300">
                                <span>Année N-1 (2025) :</span>
                                <span>{data.adrN1} €</span>
                              </div>
                              <div className="flex justify-between gap-4 text-slate-400">
                                <span>Année N-2 (2024) :</span>
                                <span>{data.adrN2} €</span>
                              </div>
                              <div className="flex justify-between gap-4 text-amber-300 pt-1 border-t border-slate-800">
                                <span>Hors Vacances (Base) :</span>
                                <span>{data.baselineADR} €</span>
                              </div>
                            </>
                          )}
                          {chartMetric === 'occupancy' && (
                            <>
                              <div className="flex justify-between gap-4 text-violet-300 font-bold">
                                <span>Année N (2026) :</span>
                                <span>{data.occN}%</span>
                              </div>
                              <div className="flex justify-between gap-4 text-slate-300">
                                <span>Année N-1 (2025) :</span>
                                <span>{data.occN1}%</span>
                              </div>
                              <div className="flex justify-between gap-4 text-slate-400">
                                <span>Année N-2 (2024) :</span>
                                <span>{data.occN2}%</span>
                              </div>
                              <div className="flex justify-between gap-4 text-amber-300 pt-1 border-t border-slate-800">
                                <span>Hors Vacances (Base) :</span>
                                <span>{data.baselineOcc}%</span>
                              </div>
                            </>
                          )}
                          {chartMetric === 'revpar' && (
                            <>
                              <div className="flex justify-between gap-4 text-violet-300 font-bold">
                                <span>RevPAR N (2026) :</span>
                                <span>{data.revParN} €</span>
                              </div>
                              <div className="flex justify-between gap-4 text-slate-300">
                                <span>RevPAR N-1 (2025) :</span>
                                <span>{data.revParN1} €</span>
                              </div>
                              <div className="flex justify-between gap-4 text-slate-400">
                                <span>RevPAR N-2 (2024) :</span>
                                <span>{data.revParN2} €</span>
                              </div>
                            </>
                          )}
                          {chartMetric === 'revenue' && (
                            <>
                              <div className="flex justify-between gap-4 text-violet-300 font-bold">
                                <span>CA Total N (2026) :</span>
                                <span>{data.revenueN.toLocaleString('fr-FR')} €</span>
                              </div>
                              <div className="flex justify-between gap-4 text-slate-300">
                                <span>CA Total N-1 (2025) :</span>
                                <span>{data.revenueN1.toLocaleString('fr-FR')} €</span>
                              </div>
                              <div className="flex justify-between gap-4 text-slate-400">
                                <span>CA Total N-2 (2024) :</span>
                                <span>{data.revenueN2.toLocaleString('fr-FR')} €</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px', fontWeight: 600 }}
              />
              {chartMetric === 'adr' && (
                <>
                  <Bar dataKey="adrN2" fill="#94a3b8" name="2024 (N-2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="adrN1" fill="#64748b" name="2025 (N-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="adrN" fill="#7c3aed" name="2026 (N)" radius={[4, 4, 0, 0]} />
                </>
              )}
              {chartMetric === 'occupancy' && (
                <>
                  <Bar dataKey="occN2" fill="#94a3b8" name="TO 2024 (N-2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="occN1" fill="#64748b" name="TO 2025 (N-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="occN" fill="#10b981" name="TO 2026 (N)" radius={[4, 4, 0, 0]} />
                </>
              )}
              {chartMetric === 'revpar' && (
                <>
                  <Bar dataKey="revParN2" fill="#94a3b8" name="RevPAR 2024 (N-2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revParN1" fill="#64748b" name="RevPAR 2025 (N-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revParN" fill="#8b5cf6" name="RevPAR 2026 (N)" radius={[4, 4, 0, 0]} />
                </>
              )}
              {chartMetric === 'revenue' && (
                <>
                  <Bar dataKey="revenueN2" fill="#94a3b8" name="CA 2024 (€)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revenueN1" fill="#64748b" name="CA 2025 (€)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revenueN" fill="#3b82f6" name="CA 2026 (€)" radius={[4, 4, 0, 0]} />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 6. Detailed Analytical Breakdown Table by Segment */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-3">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-600" />
              <span>Tableau Comparatif Détaillé par Segment de Clientèle ({activeSeason.name})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Mesure de l&apos;élasticité prix, de l&apos;impact sur l&apos;occupation et des recommandations Yield par typologie de client.
            </p>
          </div>

          {/* Segment Filter selector */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-slate-500 font-medium">Filtrer par segment :</span>
            <select
              value={selectedSegmentFilter}
              onChange={(e) => setSelectedSegmentFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              <option value="all">Tous les segments ({activeSeason.segments.length})</option>
              {CLIENT_SEGMENTS.map((seg) => (
                <option key={seg.key} value={seg.key}>
                  {seg.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="py-3 px-4">Segment de Clientèle</th>
                <th className="py-3 px-3">Taux d&apos;Occupation (N vs N-1 vs N-2)</th>
                <th className="py-3 px-3">Prix Moyen ADR (N vs N-1 vs N-2)</th>
                <th className="py-3 px-3 text-center">RevPAR (€)</th>
                <th className="py-3 px-3 text-center">Part CA (%)</th>
                <th className="py-3 px-3 text-center">Durée Séjour (ALOS)</th>
                <th className="py-3 px-3">Base Hors Vacances</th>
                <th className="py-3 px-4">Stratégie & Recommandation RM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedSegments.map((seg) => {
                const meta = CLIENT_SEGMENTS.find((m) => m.key === seg.segmentKey);
                const deltaOcc = seg.occupancyN - seg.occupancyN1;
                const deltaAdr = seg.adrN - seg.adrN1;
                const deltaAdrPct = Math.round(((seg.adrN - seg.adrN1) / seg.adrN1) * 100);

                return (
                  <tr key={seg.segmentKey} className="hover:bg-slate-50/80 transition-colors">
                    {/* Segment Name & Icon */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-slate-100">
                          {getSegmentIcon(seg.segmentKey)}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">
                            {meta?.label || seg.segmentKey}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {meta?.description.slice(0, 55)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Occupancy Multi-Year */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-black text-slate-900 text-sm tabular-nums">
                          {seg.occupancyN}%
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            deltaOcc >= 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          }`}
                        >
                          {deltaOcc >= 0 ? `+${deltaOcc.toFixed(1)} pts` : `${deltaOcc.toFixed(1)} pts`}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        2025: {seg.occupancyN1}% • 2024: {seg.occupancyN2}%
                      </div>
                    </td>

                    {/* ADR Multi-Year */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-black text-violet-700 text-sm tabular-nums">
                          {seg.adrN} €
                        </span>
                        <span className="text-[10px] font-bold bg-violet-50 text-violet-800 px-1.5 py-0.2 rounded border border-violet-200/60">
                          +{deltaAdr}€ (+{deltaAdrPct}%)
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        2025: {seg.adrN1}€ • 2024: {seg.adrN2}€
                      </div>
                    </td>

                    {/* RevPAR */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="font-bold text-slate-900 text-xs tabular-nums">
                        {seg.revParN} €
                      </span>
                    </td>

                    {/* Revenue Share */}
                    <td className="py-3.5 px-3 text-center">
                      <div className="font-bold text-slate-900 text-xs tabular-nums">
                        {seg.shareOfRevenueN}%
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {seg.revenueN.toLocaleString('fr-FR')} €
                      </div>
                    </td>

                    {/* ALOS */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-block font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md tabular-nums">
                        {seg.alosN} nuits
                      </span>
                    </td>

                    {/* Regular Baseline Comparison */}
                    <td className="py-3.5 px-3">
                      <div className="text-[11px] text-slate-700 font-medium">
                        TO: <strong>{seg.baselineRegularOcc}%</strong>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        ADR: <strong>{seg.baselineRegularADR} €</strong>
                      </div>
                    </td>

                    {/* Yield Strategy & Recommendation */}
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="text-[11px] text-slate-800 font-medium leading-relaxed">
                        {seg.recommendedAction}
                      </div>
                      <div className="text-[10px] text-violet-600 italic mt-0.5">
                        Observation : {seg.yieldObservation}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Action Plan & RM Operational Guidelines for School Holidays */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Typologies Familiales */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-violet-700 font-bold text-xs uppercase tracking-wider">
            <Users className="w-4 h-4" />
            <span>Gestion des Typologies Familiales</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Les chambres familiales (triples, quadruples, communicantes) représentent <strong>35.6%</strong> de votre parc et génèrent <strong>43.5%</strong> de votre chiffre d&apos;affaires pendant les vacances scolaires avec un ADR premium moyen de <strong>335€</strong>.
          </p>
          <div className="text-xs font-semibold text-slate-800 bg-violet-50 p-3 rounded-xl border border-violet-100">
            👉 Recommandation : Bloquer les promotions non remboursables sur ces typologies et imposer un Min Stay 3 nuits sur les dates clés.
          </div>
        </div>

        {/* Card 2: Arbitrage Corporate vs Loisirs */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
            <Briefcase className="w-4 h-4" />
            <span>Arbitrage Corporate vs Loisirs</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Le volume d&apos;affaires individuel subit une contraction naturelle de <strong>-20 à -45 pts de TO</strong> selon la saison (été et Noël en particulier).
          </p>
          <div className="text-xs font-semibold text-slate-800 bg-blue-50 p-3 rounded-xl border border-blue-100">
            👉 Recommandation : Réallouer les chambres réservées aux tarifs corporate négociés vers le BAR loisir à plein tarif sans hésitation.
          </div>
        </div>

        {/* Card 3: Distribution Directe vs OTA */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Optimisation Canal Direct</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Le canal direct atteint <strong>18.5% à 19.6%</strong> du mix pendant les vacances, avec une durée moyenne de séjour supérieure de <strong>+0.9 nuit</strong> par rapport aux réservations OTA.
          </p>
          <div className="text-xs font-semibold text-slate-800 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
            👉 Recommandation : Réserver l&apos;accès exclusif aux chambres communicantes sur le site Web officiel avec petit-déjeuner enfant offert.
          </div>
        </div>
      </div>
    </div>
  );
};
