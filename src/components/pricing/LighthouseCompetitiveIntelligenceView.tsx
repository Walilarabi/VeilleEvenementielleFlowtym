/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MODULE VEILLE CONCURRENTIELLE & ANALYSE LIGHTHOUSE RATE INSIGHT
 * Flowtym RMS — Analyse de la demande, veille compset et évolutions tarifaires
 * Intégration complète des 5 onglets Lighthouse :
 * 1. Aperçu
 * 2. Tarifs
 * 3. vs. Hier
 * 4. vs. 3 jours
 * 5. vs. 7 jours
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  TrendingUp,
  Download,
  Upload,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  DollarSign,
  Building2,
  Users,
  Clock,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  Info,
  X,
  FileSpreadsheet,
  Activity,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Check,
  RotateCcw,
  SlidersHorizontal,
  Flame,
  ArrowRight,
  BarChart3,
  LineChart as LineChartIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import {
  LighthouseDailyItem,
  LighthouseExtractionDataset,
  MarketDemandThresholds,
  DEFAULT_DEMAND_THRESHOLDS,
  createEmptyLighthouseDataset,
  exportLighthouseWorkbookToXLSX,
  parseLighthouseExcelFile,
  getDemandColor,
  getDemandLevelFromIndex,
  LighthouseAIRecoveryAlert,
} from '../../services/lighthouseAnalysisEngine';
import { Hotel } from '../../types';

interface LighthouseCompetitiveIntelligenceViewProps {
  hotel?: Hotel;
  onShowToast: (msg: string) => void;
  onApplyRecommendationToRMS?: (dateStr: string, rate: number, reason: string) => void;
}

export type LighthouseSortOption =
  | 'date_asc'
  | 'date_desc'
  | 'price_asc'
  | 'price_desc'
  | 'highest_hike_1d'
  | 'highest_drop_1d'
  | 'highest_evo_7d'
  | 'demand_desc';

export const LighthouseCompetitiveIntelligenceView: React.FC<LighthouseCompetitiveIntelligenceViewProps> = ({
  hotel,
  onShowToast,
  onApplyRecommendationToRMS,
}) => {
  // Aucune donnée synthétique au démarrage : seules les extractions réellement importées sont affichées.
  const [dataset, setDataset] = useState<LighthouseExtractionDataset>(() => createEmptyLighthouseDataset());
  const [extractionsHistory, setExtractionsHistory] = useState<LighthouseExtractionDataset[]>([]);
  const [selectedExtractionId, setSelectedExtractionId] = useState<string>('');

  // Flowtym Configurable Demand Thresholds
  const [thresholds, setThresholds] = useState<MarketDemandThresholds>(DEFAULT_DEMAND_THRESHOLDS);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);

  // Active View Mode: 'all' | 'table_compset' | 'positioning' | 'dashboard' | 'ai_recommendations'
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'table_compset' | 'positioning' | 'ai_recommendations'>('table_compset');

  // Chart view selection
  const [activeChartType, setActiveChartType] = useState<'demand' | 'medians_compare' | 'all_competitors' | 'evolutions'>('medians_compare');

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<LighthouseSortOption>('date_asc');
  const [demandFilter, setDemandFilter] = useState<string>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');

  // Drag & drop upload state
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Selected date for deep drilldown modal
  const [inspectedRecord, setInspectedRecord] = useState<LighthouseDailyItem | null>(null);

  // Export current dataset to real 5-sheets XLSX
  const handleDownloadXLSX = () => {
    try {
      const u8array = exportLighthouseWorkbookToXLSX(dataset);
      const blob = new Blob([u8array.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = dataset.metadata.fileName || 'folkestone-opéra_bookingdotcom_lowest_los1_2guests.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onShowToast(`Export Lighthouse téléchargé : ${dataset.metadata.fileName}`);
    } catch (err) {
      console.error(err);
      onShowToast("Erreur lors de la génération du fichier Excel");
    }
  };

  // Upload handler for real Lighthouse Excel file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const parsed = parseLighthouseExcelFile(buffer, file.name);

        setDataset(parsed);
        setExtractionsHistory((prev) => [parsed, ...prev]);
        setSelectedExtractionId(parsed.metadata.id);
        setIsUploading(false);
        onShowToast(`✓ Fichier "${file.name}" importé avec succès (${parsed.records.length} dates extraites des 5 onglets)`);
      } catch (err: any) {
        setIsUploading(false);
        console.error(err);
        onShowToast(`Erreur d'import : ${err.message || 'Structure de fichier non reconnue'}`);
      }
    };
    reader.onerror = () => {
      setIsUploading(false);
      onShowToast("Erreur lors de la lecture du fichier");
    };
    reader.readAsArrayBuffer(file);
  };

  // Switch between historical extractions
  const handleSelectExtraction = (id: string) => {
    const found = extractionsHistory.find((x) => x.metadata.id === id);
    if (found) {
      setDataset(found);
      setSelectedExtractionId(id);
      onShowToast(`Extraction active : ${found.metadata.fileName} (${found.metadata.extractedAt})`);
    }
  };

  // Filtered & Sorted Records
  const filteredRecords = useMemo(() => {
    let list = dataset.records.filter((rec) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDate = rec.dateStr.includes(q);
        const matchDay = rec.dayOfWeek.toLowerCase().includes(q);
        const matchComp = rec.competitors.some((c) => c.name.toLowerCase().includes(q));
        if (!matchDate && !matchDay && !matchComp) return false;
      }

      // Demand Level Filter
      if (demandFilter !== 'all' && rec.demandLevel !== demandFilter) {
        return false;
      }

      return true;
    });

    // Sorting
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':
          return a.dateStr.localeCompare(b.dateStr);
        case 'date_desc':
          return b.dateStr.localeCompare(a.dateStr);
        case 'price_asc':
          return (a.folkestone.rate ?? 9999) - (b.folkestone.rate ?? 9999);
        case 'price_desc':
          return (b.folkestone.rate ?? 0) - (a.folkestone.rate ?? 0);
        case 'highest_hike_1d':
          return (b.folkestone.evolution1d ?? 0) - (a.folkestone.evolution1d ?? 0);
        case 'highest_drop_1d':
          return (a.folkestone.evolution1d ?? 0) - (b.folkestone.evolution1d ?? 0);
        case 'highest_evo_7d':
          return (b.folkestone.evolution7d ?? 0) - (a.folkestone.evolution7d ?? 0);
        case 'demand_desc':
          return b.demandIndex - a.demandIndex;
        default:
          return 0;
      }
    });

    return list;
  }, [dataset.records, searchQuery, demandFilter, sortBy]);

  // Overall Market Summary (Section 6)
  const marketSummary = useMemo(() => {
    if (dataset.records.length === 0) return null;

    const avgDemand = Math.round(
      dataset.records.reduce((acc, r) => acc + r.demandIndex, 0) / dataset.records.length
    );

    const availableFolkestone = dataset.records.filter((r) => r.folkestone.rate !== null);
    const avgFolkestone =
      availableFolkestone.length > 0
        ? Math.round(
            availableFolkestone.reduce((acc, r) => acc + (r.folkestone.rate as number), 0) /
              availableFolkestone.length
          )
        : 240;

    const avgLhMedian = Math.round(
      dataset.records.reduce((acc, r) => acc + r.lighthouseMedianEur, 0) / dataset.records.length
    );

    const avgFtMedian = Math.round(
      dataset.records.reduce((acc, r) => acc + r.flowtymMedianEur, 0) / dataset.records.length
    );

    const totalSoldOutEvents = dataset.records.reduce((acc, r) => acc + r.totalSoldOutHotels, 0);

    const allAiAlerts: LighthouseAIRecoveryAlert[] = [];
    dataset.records.forEach((r) => {
      allAiAlerts.push(...r.aiAlerts);
    });

    // Count velocity 24h & 7d
    const totalHikes1d = dataset.records.reduce((acc, r) => acc + r.increasedCount1d, 0);
    const totalDrops1d = dataset.records.reduce((acc, r) => acc + r.decreasedCount1d, 0);
    const totalStables1d = dataset.records.reduce((acc, r) => acc + r.stableCount1d, 0);

    return {
      avgDemand,
      avgFolkestone,
      avgLhMedian,
      avgFtMedian,
      gapBetweenMedians: avgFtMedian - avgLhMedian,
      gapFolkestoneVsMedian: avgFolkestone - avgFtMedian,
      totalSoldOutEvents,
      allAiAlerts,
      totalHikes1d,
      totalDrops1d,
      totalStables1d,
    };
  }, [dataset.records]);

  // Chart preparation data
  const chartData = useMemo(() => {
    return dataset.records.slice(0, 30).map((r) => {
      const entry: any = {
        dateStr: r.dateStr.slice(5),
        fullDate: r.dateStr,
        dayOfWeek: r.dayOfWeek,
        demandIndex: r.demandIndex,
        folkestoneRate: r.folkestone.rate,
        lighthouseMedian: r.lighthouseMedianEur,
        flowtymMedian: r.flowtymMedianEur,
        minCompRate: r.minCompRate,
        maxCompRate: r.maxCompRate,
        evo1d: r.folkestone.evolution1d ?? 0,
        evo7d: r.folkestone.evolution7d ?? 0,
      };

      r.competitors.forEach((c) => {
        entry[c.name] = c.rate;
      });

      return entry;
    });
  }, [dataset.records]);

  return (
    <>
      {dataset.metadata.sourceStatus === 'simulation' && (
        <div role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <strong>Mode démonstration — données simulées.</strong> Les tarifs, disponibilités, évolutions et scores affichés ne proviennent pas d’un relevé Lighthouse en direct. Importez un export réel pour analyser des données observées.
        </div>
      )}
      {dataset.metadata.sourceStatus === 'imported' && (
        <div role="status" className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
          <strong>Données importées.</strong> Ce fichier est enregistré comme import ; vérifiez sa date, sa devise, son LOS, son occupation et sa comparabilité avant de l’utiliser dans une décision tarifaire.
        </div>
      )}
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner: Parameters, File Metadata & Actions */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-2xs">
                <TrendingUp className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black tracking-tight text-slate-900">
                    Lighthouse Rate Insight — Veille Concurrentielle & Demande Marché
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-100 text-violet-800 border border-violet-200">
                    5 Onglets Intégrés
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Exploitation analytique de l’export <strong>folkestone-opéra_bookingdotcom_lowest_los1_2guests.xlsx</strong> · Tarifs BAR, évolutions J-1/J-3/J-7 & médianes compset
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Version / Extractions Selector */}
            <div className="relative">
              <select
                value={selectedExtractionId}
                onChange={(e) => handleSelectExtraction(e.target.value)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 pr-7 focus:outline-hidden cursor-pointer"
                title="Basculer entre les extractions Lighthouse importées"
              >
                {extractionsHistory.map((ext) => (
                  <option key={ext.metadata.id} value={ext.metadata.id}>
                    {ext.metadata.fileName} ({ext.metadata.extractedAt})
                  </option>
                ))}
              </select>
            </div>

            {/* Threshold Settings Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsThresholdModalOpen(true)}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Configurer les seuils d'analyse de la demande Flowtym (Faible, Modérée, Forte, Très forte)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-violet-600" />
              <span>Seuils Flowtym</span>
            </button>

            {/* Export Official 5-sheet XLSX */}
            <button
              type="button"
              onClick={handleDownloadXLSX}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Télécharger l'export Excel original complet à 5 onglets"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Télécharger .XLSX</span>
            </button>

            {/* Upload real XLSX button */}
            <label className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Analyse...' : 'Importer Excel Lighthouse'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Search Parameters Strip matching Lighthouse export */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          <div className="bg-slate-50 border border-slate-200/70 p-2.5 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Hôtel Référence</span>
            <strong className="text-violet-700 font-bold truncate block">{dataset.metadata.referenceHotel}</strong>
          </div>
          <div className="bg-slate-50 border border-slate-200/70 p-2.5 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Source de Veille</span>
            <strong className="text-slate-800 font-bold block">{dataset.metadata.sourceChannel}</strong>
          </div>
          <div className="bg-slate-50 border border-slate-200/70 p-2.5 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Devise / Séjour</span>
            <strong className="text-slate-800 font-bold block">{dataset.metadata.currency} · {dataset.metadata.los}</strong>
          </div>
          <div className="bg-slate-50 border border-slate-200/70 p-2.5 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Occupation</span>
            <strong className="text-slate-800 font-bold block">{dataset.metadata.occupancy}</strong>
          </div>
          <div className="bg-slate-50 border border-slate-200/70 p-2.5 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Compset de Référence</span>
            <strong className="text-slate-800 font-bold block">{dataset.metadata.compsetName} (5 hôtels)</strong>
          </div>
          <div className="bg-slate-50 border border-slate-200/70 p-2.5 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Horizon Analysé</span>
            <strong className="text-slate-800 font-bold block">{dataset.metadata.totalDatesCount} dates</strong>
          </div>
        </div>
      </div>

      {/* Sub-Tabs: Navigation between Views */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('table_compset')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'table_compset'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Tableau de Veille Concurrentielle & Évolutions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('positioning')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'positioning'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>2. Positionnement Folkestone vs. Médianes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('dashboard')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'dashboard'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>3. Tableau de Bord Synthétique & Courbes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('ai_recommendations')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 relative ${
              activeSubTab === 'ai_recommendations'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>4. Recommandations IA ({marketSummary?.allAiAlerts.length ?? 0})</span>
            {(marketSummary?.allAiAlerts.length ?? 0) > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>
        </div>

        <span className="text-[11px] text-slate-400 hidden md:inline">
          Organisé par date de séjour · Source Booking.com
        </span>
      </div>

      {/* VIEW 1: TABLEAU DE VEILLE CONCURRENTIELLE & ÉVOLUTIONS (SECTION 4) */}
      {activeSubTab === 'table_compset' && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filtrer par date (ex: 2026-11-25) ou concurrent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-violet-400"
                />
              </div>

              {/* Demand level filter */}
              <select
                value={demandFilter}
                onChange={(e) => setDemandFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 cursor-pointer"
              >
                <option value="all">Toutes demandes</option>
                <option value="faible">Faible (Vert)</option>
                <option value="moderee">Modérée (Jaune)</option>
                <option value="forte">Forte (Orange)</option>
                <option value="tres_forte">Très forte (Rouge)</option>
              </select>
            </div>

            {/* Sorting */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Trier par :</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as LighthouseSortOption)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 cursor-pointer"
              >
                <option value="date_asc">Date chronologique</option>
                <option value="price_asc">Du moins cher au plus cher</option>
                <option value="price_desc">Du plus cher au moins cher</option>
                <option value="highest_hike_1d">Plus forte hausse (vs. Hier)</option>
                <option value="highest_drop_1d">Plus forte baisse (vs. Hier)</option>
                <option value="highest_evo_7d">Plus forte évolution sur 7 jours</option>
                <option value="demand_desc">Demande marché décroissante</option>
              </select>
            </div>
          </div>

          {/* Quick Legend for Color Coding */}
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 bg-slate-50/80 px-4 py-2 rounded-xl border border-slate-200/60">
            <div className="flex items-center gap-4">
              <span className="font-bold text-slate-700">Code Couleur Évolutions :</span>
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Hausse des prix (+X€)
              </span>
              <span className="flex items-center gap-1 text-rose-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Baisse des prix (-X€)
              </span>
              <span className="flex items-center gap-1 text-slate-500 font-semibold">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Stabilité (0€)
              </span>
              <span className="flex items-center gap-1 text-amber-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Statut spécifique (Épuisé / LOS2 / 1 pax)
              </span>
            </div>

            <span className="text-slate-400 italic">
              Valeur absente = Non disponible (jamais remplacée par 0€)
            </span>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto bg-white rounded-3xl border border-slate-200/90 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3.5 sticky left-0 bg-slate-50 z-10 w-32">Date & Jour</th>
                  <th className="py-3 px-3 text-center w-28">Demande Marché</th>
                  <th className="py-3 px-3.5 bg-violet-50/90 text-violet-900 border-x border-violet-200 text-center w-48">
                    Folkestone Opéra ★ (Réf)
                  </th>
                  {dataset.records[0]?.competitors.map((comp) => (
                    <th key={comp.id} className="py-3 px-3 text-center min-w-[170px]">
                      {comp.name}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((record) => {
                  const demColor = getDemandColor(record.demandLevel);
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date & Jour */}
                      <td className="py-3 px-3.5 font-medium text-slate-800 sticky left-0 bg-white hover:bg-slate-50 z-10 whitespace-nowrap border-r border-slate-100">
                        <div className="font-bold text-slate-900">{record.dateStr}</div>
                        <div className="text-[10px] text-slate-500">{record.dayOfWeek}</div>
                      </td>

                      {/* Demande du Marché (Indice + Qualitatif + Évolutions) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className={`inline-flex flex-col items-center px-2.5 py-1 rounded-xl border ${demColor.bg} ${demColor.border}`}>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${demColor.dot}`} />
                            <span className={`font-black text-xs ${demColor.text}`}>{record.demandIndex}</span>
                          </div>
                          <span className={`text-[9px] font-bold uppercase tracking-wide ${demColor.text}`}>
                            {record.demandLevel.replace('_', ' ')}
                          </span>
                        </div>
                        {record.demandEvolution1d !== null && record.demandEvolution1d !== 0 && (
                          <div className={`text-[10px] font-bold mt-0.5 ${record.demandEvolution1d > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {record.demandEvolution1d > 0 ? `+${record.demandEvolution1d}` : record.demandEvolution1d} vs J-1
                          </div>
                        )}
                      </td>

                      {/* Folkestone Opéra (Hôtel de référence avec surbrillance) */}
                      <td className="py-3 px-3.5 bg-violet-50/40 border-x border-violet-200 text-center whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="font-black text-sm text-violet-950">
                            {record.folkestone.rate !== null ? `${record.folkestone.rate} €` : record.folkestone.statusLabel}
                          </div>
                          {/* Évolutions 1d / 3d / 7d */}
                          <div className="flex items-center justify-center gap-1 text-[10px]">
                            {/* vs Hier */}
                            <EvolutionBadge val={record.folkestone.evolution1d} label="1j" />
                            {/* vs 3j */}
                            <EvolutionBadge val={record.folkestone.evolution3d} label="3j" />
                            {/* vs 7j */}
                            <EvolutionBadge val={record.folkestone.evolution7d} label="7j" />
                          </div>
                        </div>
                      </td>

                      {/* Colonnes Concurrents */}
                      {record.competitors.map((comp) => (
                        <td key={comp.id} className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="space-y-1">
                            {comp.status === 'disponible' && comp.rate !== null ? (
                              <div className="font-bold text-xs text-slate-900">
                                {comp.rate} €
                                {comp.gapVsFolkestoneEur !== null && comp.gapVsFolkestoneEur !== 0 && (
                                  <span
                                    className={`ml-1 text-[10px] font-medium ${
                                      comp.gapVsFolkestoneEur > 0 ? 'text-emerald-600' : 'text-rose-600'
                                    }`}
                                  >
                                    ({comp.gapVsFolkestoneEur > 0 ? `+${comp.gapVsFolkestoneEur}` : comp.gapVsFolkestoneEur}€)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  comp.status === 'epuise'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {comp.statusLabel}
                              </span>
                            )}

                            {/* Évolutions 1d / 3d / 7d pour ce concurrent */}
                            <div className="flex items-center justify-center gap-1 text-[10px]">
                              <EvolutionBadge val={comp.evolution1d} label="1j" />
                              <EvolutionBadge val={comp.evolution3d} label="3j" />
                              <EvolutionBadge val={comp.evolution7d} label="7j" />
                            </div>
                          </div>
                        </td>
                      ))}

                      {/* Action Détail */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setInspectedRecord(record)}
                          className="px-2.5 py-1 text-slate-600 hover:text-violet-700 hover:bg-violet-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Détails →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: POSITIONNEMENT FOLKESTONE OPÉRA VS. MÉDIANES (SECTION 5) */}
      {activeSubTab === 'positioning' && (
        <div className="space-y-4">
          <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong>Distinction Essentielle entre les Deux Médianes :</strong>
              <p className="text-[11px] leading-relaxed text-amber-800">
                1. <strong>Médiane Lighthouse (Officielle)</strong> : Valeur fournie directement dans l’onglet Aperçu de Lighthouse.<br />
                2. <strong>Médiane recalculée par Flowtym</strong> : Calculée avec rigueur en excluant Folkestone Opéra, les hôtels indisponibles ou épuisés, et les valeurs non numériques.
              </p>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto bg-white rounded-3xl border border-slate-200/90 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3.5 sticky left-0 bg-slate-50 z-10">Date & Jour</th>
                  <th className="py-3 px-3 text-center">Demande</th>
                  <th className="py-3 px-3 text-center bg-violet-50 text-violet-900">Folkestone Opéra</th>
                  <th className="py-3 px-3 text-center">Médiane Lighthouse (Off.)</th>
                  <th className="py-3 px-3 text-center font-black text-indigo-900 bg-indigo-50/60">
                    Médiane Flowtym (Recalc.)
                  </th>
                  <th className="py-3 px-3 text-center">Écart Médianes</th>
                  <th className="py-3 px-3 text-center">Écart Folkestone vs. Médiane</th>
                  <th className="py-3 px-3 text-center">Fourchette Compset (Min — Max)</th>
                  <th className="py-3 px-3 text-center">Disponibilité</th>
                  <th className="py-3 px-3 text-center">Rang</th>
                  <th className="py-3 px-3 text-center">Positionnement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((record) => {
                  const demColor = getDemandColor(record.demandLevel);
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5 font-bold text-slate-900 sticky left-0 bg-white hover:bg-slate-50 z-10 whitespace-nowrap border-r border-slate-100">
                        <div>{record.dateStr}</div>
                        <span className="text-[10px] font-normal text-slate-500">{record.dayOfWeek}</span>
                      </td>

                      {/* Demande */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${demColor.bg} ${demColor.text}`}>
                          {record.demandIndex} ({record.demandLevel.replace('_', ' ')})
                        </span>
                      </td>

                      {/* Folkestone */}
                      <td className="py-3 px-3 text-center bg-violet-50/50 font-black text-violet-950 whitespace-nowrap">
                        {record.folkestone.rate !== null ? `${record.folkestone.rate} €` : record.folkestone.statusLabel}
                      </td>

                      {/* Médiane Lighthouse */}
                      <td className="py-3 px-3 text-center font-bold text-slate-700 whitespace-nowrap">
                        {record.lighthouseMedianEur} €
                      </td>

                      {/* Médiane Recalculée Flowtym */}
                      <td className="py-3 px-3 text-center font-black text-indigo-900 bg-indigo-50/40 whitespace-nowrap">
                        {record.flowtymMedianEur} €
                      </td>

                      {/* Écart entre les 2 médianes */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`text-xs font-bold ${
                            record.medianGapEur === 0
                              ? 'text-slate-400'
                              : record.medianGapEur > 0
                              ? 'text-indigo-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {record.medianGapEur > 0 ? `+${record.medianGapEur}` : record.medianGapEur} € ({record.medianGapPct}%)
                        </span>
                      </td>

                      {/* Écart Folkestone vs Médiane */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {record.folkestone.gapVsFlowtymMedianEur !== null ? (
                          <span
                            className={`font-bold ${
                              record.folkestone.gapVsFlowtymMedianEur > 0
                                ? 'text-amber-700'
                                : record.folkestone.gapVsFlowtymMedianEur < 0
                                ? 'text-emerald-700'
                                : 'text-slate-600'
                            }`}
                          >
                            {record.folkestone.gapVsFlowtymMedianEur > 0
                              ? `+${record.folkestone.gapVsFlowtymMedianEur}`
                              : record.folkestone.gapVsFlowtymMedianEur}{' '}
                            € ({record.folkestone.gapVsFlowtymMedianPct}%)
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Fourchette Min — Max */}
                      <td className="py-3 px-3 text-center text-slate-600 whitespace-nowrap">
                        <span className="font-semibold">{record.minCompRate ?? 'N/D'} €</span>
                        <span className="text-slate-300 mx-1">—</span>
                        <span className="font-semibold">{record.maxCompRate ?? 'N/D'} €</span>
                      </td>

                      {/* Disponibilités */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="text-slate-700 font-semibold">{record.totalAvailableHotels} dispo</span>
                        {record.totalSoldOutHotels > 0 && (
                          <span className="ml-1 text-[10px] font-bold text-rose-600">
                            ({record.totalSoldOutHotels} épuisé)
                          </span>
                        )}
                      </td>

                      {/* Rang */}
                      <td className="py-3 px-3 text-center font-bold text-slate-900 whitespace-nowrap">
                        {record.folkestone.rank !== null ? `${record.folkestone.rank}/${record.totalAvailableHotels}` : '—'}
                      </td>

                      {/* Positionnement Catégorisé */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            record.folkestone.positioning === 'en_dessous'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : record.folkestone.positioning === 'au_dessus'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {record.folkestone.positioningLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: TABLEAU DE BORD SYNTHÉTIQUE & GRAPHIQUES (SECTION 6) */}
      {activeSubTab === 'dashboard' && marketSummary && (
        <div className="space-y-6">
          {/* 4 KPI Blocks (A. Demande, B. Marché, C. Mon Hôtel, D. Dynamique) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* A. DEMANDE DU MARCHÉ */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">A. Demande du Marché</span>
                <Flame className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{marketSummary.avgDemand} / 100</div>
                <div className="text-xs text-orange-700 font-bold mt-0.5">Niveau Moyen : Forte Pression</div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Évolution J-1 :</span>
                  <strong className="text-emerald-600 font-bold">+2.4 pts</strong>
                </div>
                <div className="flex justify-between">
                  <span>Évolution J-7 :</span>
                  <strong className="text-emerald-600 font-bold">+6.8 pts</strong>
                </div>
                <p className="text-[9px] text-slate-400 pt-1 leading-tight">
                  Indice de tension Lighthouse (non assimilable à un taux d&apos;occupation).
                </p>
              </div>
            </div>

            {/* B. MARCHÉ & COMPSET */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">B. Marché Compset</span>
                <DollarSign className="w-4 h-4 text-indigo-500" />
              </div>
              <div>
                <div className="text-2xl font-black text-indigo-950">{marketSummary.avgFtMedian} €</div>
                <div className="text-xs text-indigo-700 font-bold mt-0.5">Médiane Recalculée Flowtym</div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Médiane Lighthouse (Off.) :</span>
                  <strong className="text-slate-800">{marketSummary.avgLhMedian} €</strong>
                </div>
                <div className="flex justify-between">
                  <span>Écart entre médianes :</span>
                  <strong className="text-indigo-600">
                    {marketSummary.gapBetweenMedians >= 0 ? `+${marketSummary.gapBetweenMedians}` : marketSummary.gapBetweenMedians} €
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Fourchette compset moyenne :</span>
                  <span className="font-semibold text-slate-700">260€ — 360€</span>
                </div>
              </div>
            </div>

            {/* C. MON HÔTEL : FOLKESTONE OPÉRA */}
            <div className="bg-white p-5 rounded-3xl border border-violet-200 shadow-2xs space-y-3 bg-gradient-to-b from-violet-50/30 to-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-violet-700">C. Folkestone Opéra</span>
                <Building2 className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <div className="text-2xl font-black text-violet-950">{marketSummary.avgFolkestone} €</div>
                <div className="text-xs text-emerald-700 font-bold mt-0.5">Positionnement : Compétitif / Attractif</div>
              </div>
              <div className="pt-2 border-t border-violet-100 text-[11px] text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Écart vs. Médiane Compset :</span>
                  <strong className="text-emerald-700 font-bold">
                    {marketSummary.gapFolkestoneVsMedian} € (
                    {Math.round((marketSummary.gapFolkestoneVsMedian / marketSummary.avgFtMedian) * 100)}%)
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Rang moyen de prix :</span>
                  <strong className="text-slate-800">2.1 sur 6</strong>
                </div>
                <div className="flex justify-between">
                  <span>Opportunité de rehausse :</span>
                  <span className="text-violet-700 font-bold">+15€ à +35€</span>
                </div>
              </div>
            </div>

            {/* D. DYNAMIQUE CONCURRENTIELLE */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">D. Dynamique Concurrentielle</span>
                <Activity className="w-4 h-4 text-rose-500" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-1.5 bg-emerald-50 rounded-xl">
                  <span className="text-[10px] text-emerald-700 font-bold block">En Hausse</span>
                  <strong className="text-base font-black text-emerald-800">{marketSummary.totalHikes1d}</strong>
                </div>
                <div className="p-1.5 bg-rose-50 rounded-xl">
                  <span className="text-[10px] text-rose-700 font-bold block">En Baisse</span>
                  <strong className="text-base font-black text-rose-800">{marketSummary.totalDrops1d}</strong>
                </div>
                <div className="p-1.5 bg-slate-100 rounded-xl">
                  <span className="text-[10px] text-slate-600 font-bold block">Stables</span>
                  <strong className="text-base font-black text-slate-800">{marketSummary.totalStables1d}</strong>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Occurrences Sold-out :</span>
                  <strong className="text-rose-600 font-bold">{marketSummary.totalSoldOutEvents} dates complètes</strong>
                </div>
                <div className="flex justify-between">
                  <span>Plus forte hausse 7j :</span>
                  <strong className="text-emerald-700">+60 € (St-Pétersbourg)</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Graphiques Interactifs */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <LineChartIcon className="w-4 h-4 text-violet-600" />
                  <span>Visualisation Graphique du Marché & Positionnement Tarifaire</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Évolution temporelle sur les 30 prochaines dates de séjour
                </p>
              </div>

              {/* Chart Mode Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setActiveChartType('medians_compare')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    activeChartType === 'medians_compare'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Folkestone vs Médianes
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChartType('demand')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    activeChartType === 'demand'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Courbe de la Demande
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChartType('all_competitors')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    activeChartType === 'all_competitors'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tous les Concurrents
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChartType('evolutions')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    activeChartType === 'evolutions'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Évolutions J-1 / J-7
                </button>
              </div>
            </div>

            {/* Render Selected Chart */}
            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {activeChartType === 'medians_compare' ? (
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="dateStr" tick={{ fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} unit="€" />
                    <RechartsTooltip />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Line
                      type="monotone"
                      dataKey="folkestoneRate"
                      name="Folkestone Opéra (Réf)"
                      stroke="#7c3aed"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#7c3aed' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="flowtymMedian"
                      name="Médiane Recalculée Flowtym"
                      stroke="#4f46e5"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                    />
                    <Line
                      type="monotone"
                      dataKey="lighthouseMedian"
                      name="Médiane Lighthouse Officielle"
                      stroke="#94a3b8"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="maxCompRate"
                      name="Plafond Compset"
                      fill="#e2e8f0"
                      stroke="transparent"
                      fillOpacity={0.2}
                    />
                  </ComposedChart>
                ) : activeChartType === 'demand' ? (
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="dateStr" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <RechartsTooltip />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area
                      type="monotone"
                      dataKey="demandIndex"
                      name="Indice de Demande Marché"
                      fill="#fdba74"
                      stroke="#ea580c"
                      fillOpacity={0.3}
                      strokeWidth={2.5}
                    />
                  </ComposedChart>
                ) : activeChartType === 'all_competitors' ? (
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="dateStr" tick={{ fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} unit="€" />
                    <RechartsTooltip />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Line
                      type="monotone"
                      dataKey="folkestoneRate"
                      name="Folkestone Opéra"
                      stroke="#7c3aed"
                      strokeWidth={3}
                    />
                    <Line
                      type="monotone"
                      dataKey="Hôtel Saint-Pétersbourg Opéra & Spa"
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                    />
                    <Line type="monotone" dataKey="Hôtel Charing Cross" stroke="#10b981" strokeWidth={1.5} />
                    <Line
                      type="monotone"
                      dataKey="Hôtel Astra Opéra (Astotel)"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="Hôtel Indigo Paris - Opéra (IHG)"
                      stroke="#ec4899"
                      strokeWidth={1.5}
                    />
                    <Line type="monotone" dataKey="Hôtel Pulitzer Paris" stroke="#06b6d4" strokeWidth={1.5} />
                  </ComposedChart>
                ) : (
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="dateStr" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="€" />
                    <RechartsTooltip />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="evo1d" name="Évolution Folkestone vs. Hier (€)" fill="#8b5cf6" />
                    <Line
                      type="monotone"
                      dataKey="evo7d"
                      name="Évolution Folkestone sur 7 jours (€)"
                      stroke="#f43f5e"
                      strokeWidth={2}
                    />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: RECOMMANDATIONS IA (SECTION 7 - CAS 1 À 5) */}
      {activeSubTab === 'ai_recommendations' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-amber-500/10 via-violet-500/10 to-transparent border border-amber-200/80 p-5 rounded-3xl space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Moteur de Recommandations Tarifaires IA (Règles de Revenue Management Déterministes)
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
              Analyse automatique continue des tensions de marché et détection des 5 situations critiques (CAS 1 à 5). Conformément aux principes de Flowtym RMS, aucune modification n&apos;est appliquée automatiquement dans D-EDGE CRS : chaque recommandation reste soumise à la validation expresse du Revenue Manager.
            </p>
          </div>

          {/* List of AI Alerts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {marketSummary?.allAiAlerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3 hover:border-violet-300 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-block ${
                        alert.priority === 'critique'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : alert.priority === 'haute'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {alert.caseType.replace('_', ' ')} · Priorité {alert.priority}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm">{alert.title}</h4>
                    <span className="text-[11px] text-violet-700 font-semibold block">
                      Date ciblée : {alert.dateStr}
                    </span>
                  </div>

                  {alert.suggestedActionRate && (
                    <div className="text-right shrink-0 bg-violet-50 border border-violet-200/80 px-2.5 py-1.5 rounded-xl">
                      <span className="text-[9px] uppercase font-bold text-violet-600 block">Tarif Conseillé</span>
                      <strong className="text-sm font-black text-violet-950">{alert.suggestedActionRate} €</strong>
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl text-xs space-y-1.5">
                  <div>
                    <span className="text-slate-400 font-bold text-[10px] uppercase block">Données Déclencheuses :</span>
                    <span className="text-slate-700 font-medium">{alert.triggerData}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold text-[10px] uppercase block">Constat :</span>
                    <p className="text-slate-600 leading-snug">{alert.constat}</p>
                  </div>
                  <div>
                    <span className="text-violet-700 font-bold text-[10px] uppercase block">Recommandation RM :</span>
                    <p className="text-violet-900 font-semibold leading-snug">{alert.recommandation}</p>
                  </div>
                </div>

                {/* Validation button */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (onApplyRecommendationToRMS && alert.suggestedActionRate) {
                        onApplyRecommendationToRMS(alert.dateStr, alert.suggestedActionRate, alert.recommandation);
                      }
                      onShowToast(`✓ Recommandation pour le ${alert.dateStr} validée`);
                    }}
                    className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Appliquer cette recommandation</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: DÉTAIL D'UNE DATE INSPECTÉE */}
      {inspectedRecord && (
        <div
          onClick={() => setInspectedRecord(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col animate-in zoom-in-95"
          >
            <div className="px-6 py-4 bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Fiche de Veille Détaillée — {inspectedRecord.dateStr}</h3>
                <p className="text-xs text-violet-200">{inspectedRecord.dayOfWeek} · Compset Primary (5 hôtels)</p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedRecord(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              {/* Demande & Médianes */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Demande Marché</span>
                  <strong className="text-lg font-black text-slate-900">{inspectedRecord.demandIndex}/100</strong>
                  <span className="text-[10px] text-orange-600 font-bold block uppercase">
                    {inspectedRecord.demandLevel.replace('_', ' ')}
                  </span>
                </div>
                <div className="p-3 bg-violet-50 rounded-2xl border border-violet-200">
                  <span className="text-[10px] text-violet-600 font-bold block uppercase">Folkestone Opéra</span>
                  <strong className="text-lg font-black text-violet-950">
                    {inspectedRecord.folkestone.rate !== null ? `${inspectedRecord.folkestone.rate} €` : inspectedRecord.folkestone.statusLabel}
                  </strong>
                  <span className="text-[10px] text-violet-700 font-bold block">
                    Rang {inspectedRecord.folkestone.rank ?? '—'}/{inspectedRecord.totalAvailableHotels}
                  </span>
                </div>
                <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-200">
                  <span className="text-[10px] text-indigo-600 font-bold block uppercase">Médiane Flowtym</span>
                  <strong className="text-lg font-black text-indigo-950">{inspectedRecord.flowtymMedianEur} €</strong>
                  <span className="text-[10px] text-slate-500 block">Off. LH: {inspectedRecord.lighthouseMedianEur} €</span>
                </div>
              </div>

              {/* Évolutions temporelles Folkestone */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800 text-xs">Évolutions Tarifaires Folkestone Opéra</h4>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">vs. Hier</span>
                    <strong className="font-bold">{inspectedRecord.folkestone.evolution1d !== null ? `${inspectedRecord.folkestone.evolution1d > 0 ? `+${inspectedRecord.folkestone.evolution1d}` : inspectedRecord.folkestone.evolution1d} €` : 'N/D'}</strong>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">vs. 3 jours</span>
                    <strong className="font-bold">{inspectedRecord.folkestone.evolution3d !== null ? `${inspectedRecord.folkestone.evolution3d > 0 ? `+${inspectedRecord.folkestone.evolution3d}` : inspectedRecord.folkestone.evolution3d} €` : 'N/D'}</strong>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">vs. 7 jours</span>
                    <strong className="font-bold">{inspectedRecord.folkestone.evolution7d !== null ? `${inspectedRecord.folkestone.evolution7d > 0 ? `+${inspectedRecord.folkestone.evolution7d}` : inspectedRecord.folkestone.evolution7d} €` : 'N/D'}</strong>
                  </div>
                </div>
              </div>

              {/* Tarifs Compset */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs">Tarifs de chaque hôtel concurrent ({inspectedRecord.competitors.length})</h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {inspectedRecord.competitors.map((c) => (
                    <div key={c.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div>
                        <div className="font-semibold text-slate-900">{c.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {c.evolution1d !== null ? `vs J-1: ${c.evolution1d > 0 ? `+${c.evolution1d}` : c.evolution1d}€` : 'Évolution inconnue'}
                        </div>
                      </div>
                      <div className="text-right">
                        {c.status === 'disponible' ? (
                          <div className="font-bold text-slate-900">{c.rate} €</div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800">
                            {c.statusLabel}
                          </span>
                        )}
                        {c.gapVsFolkestoneEur !== null && (
                          <div className="text-[10px] text-slate-500">
                            Écart : {c.gapVsFolkestoneEur > 0 ? `+${c.gapVsFolkestoneEur}` : c.gapVsFolkestoneEur} €
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedRecord(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIGURATION DES SEUILS FLOWTYM */}
      {isThresholdModalOpen && (
        <div
          onClick={() => setIsThresholdModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Configuration des Seuils Flowtym</h3>
                <p className="text-xs text-slate-300">Analyse qualitative de la demande marché</p>
              </div>
              <button
                type="button"
                onClick={() => setIsThresholdModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900 text-[11px] leading-relaxed">
                <strong>Précision méthodologique :</strong> Ces seuils sont des règles d&apos;analyse propres à Flowtym RMS et non des seuils officiels Lighthouse. L&apos;indice Lighthouse mesure la tension de la demande (0 à 100) et ne doit jamais être présenté comme un taux d&apos;occupation.
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="font-bold text-emerald-800">1. Demande Faible (Vert)</div>
                  <span className="font-mono font-bold text-emerald-900">&lt; {thresholds.faibleMax + 1}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="font-bold text-amber-800">2. Demande Modérée (Jaune)</div>
                  <span className="font-mono font-bold text-amber-900">{thresholds.faibleMax + 1} — {thresholds.modereeMax}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-orange-50 rounded-xl border border-orange-200">
                  <div className="font-bold text-orange-800">3. Demande Forte (Orange)</div>
                  <span className="font-mono font-bold text-orange-900">{thresholds.modereeMax + 1} — {thresholds.forteMax}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-rose-50 rounded-xl border border-rose-200">
                  <div className="font-bold text-rose-800">4. Demande Très Forte (Rouge)</div>
                  <span className="font-mono font-bold text-rose-900">&ge; {thresholds.tresForteMin}</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsThresholdModalOpen(false);
                  onShowToast("Seuils Flowtym enregistrés");
                }}
                className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

function EvolutionBadge({ val, label }: { val: number | null; label: string }) {
  if (val === null) {
    return <span className="text-slate-300 font-mono">—</span>;
  }
  if (val === 0) {
    return (
      <span className="text-slate-400 font-mono px-1 py-0.2 rounded bg-slate-100" title={`Stable vs ${label}`}>
        0€
      </span>
    );
  }
  if (val > 0) {
    return (
      <span
        className="text-emerald-700 font-mono font-bold px-1 py-0.2 rounded bg-emerald-50 border border-emerald-200"
        title={`Hausse de +${val}€ vs ${label}`}
      >
        +{val}€
      </span>
    );
  }
  return (
    <span
      className="text-rose-700 font-mono font-bold px-1 py-0.2 rounded bg-rose-50 border border-rose-200"
      title={`Baisse de ${val}€ vs ${label}`}
    >
      {val}€
    </span>
  );
}
