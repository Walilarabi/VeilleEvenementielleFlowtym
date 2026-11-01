import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar as CalendarIcon,
  Building2,
  DollarSign,
  Users,
  ArrowUpRight,
  Clock,
  Sparkles,
  Info,
  X,
  ShieldAlert,
  Percent,
  SlidersHorizontal,
  MapPin,
  Compass,
  Filter,
  ShieldCheck,
  Activity,
  Zap,
  BarChart3,
  BellRing,
  AlertCircle,
  Maximize2,
  Minimize2,
  FileDown,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  Line,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { EventItem, Hotel } from '../../types';
import {
  DayMarketInfo,
  MarketDemandLevel,
  getMonthMarketGrid,
  formatDateKey,
  isEventGeographicallyRelevant,
  getHotelCatchmentDescription,
} from '../../utils/marketDemand';
import { exportMarketDemandReportPDF } from '../../utils/exportMarketPdf';

interface MarketCalendarViewProps {
  events: EventItem[];
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectHotel: (hotelId: string) => void;
  onSelectEvent: (event: EventItem) => void;
  onShowToast: (msg: string) => void;
}

export const MarketCalendarView: React.FC<MarketCalendarViewProps> = ({
  events,
  hotels,
  selectedHotelId,
  onSelectHotel,
  onSelectEvent,
  onShowToast,
}) => {
  // Navigation state: start month index (0-indexed) & year
  // Default to October 2026 (month 9) so it displays "octobre 2026" & "novembre 2026" exactly like the screenshot!
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(9); // 9 = October

  // Filter by demand level: 'all' | 'forte' | 'moyenne' | 'faible'
  const [demandFilter, setDemandFilter] = useState<'all' | MarketDemandLevel>('all');

  // Selected date for deep inspection (rendered in centered modal popup)
  const [selectedDateInfo, setSelectedDateInfo] = useState<DayMarketInfo | null>(null);

  // Hovered day for interactive popover tooltip
  const [hoveredDay, setHoveredDay] = useState<{
    info: DayMarketInfo;
    x: number;
    y: number;
  } | null>(null);

  // View presentation mode: 'screenshot_dual' (2 months side-by-side) or 'quarter' (3 months)
  const [displayMode, setDisplayMode] = useState<'dual' | 'quarter'>('dual');

  const currentHotel = useMemo(() => {
    return hotels.find((h) => h.id === selectedHotelId) || hotels[0];
  }, [hotels, selectedHotelId]);

  // Description du bassin géographique actif et du rayon d'influence
  const catchmentInfo = useMemo(() => {
    return getHotelCatchmentDescription(currentHotel);
  }, [currentHotel]);

  // Filtrage géographique intelligent : ne retenir que les événements pertinents pour cet hôtel
  const relevantEvents = useMemo(() => {
    return events.filter((e) => isEventGeographicallyRelevant(e, currentHotel));
  }, [events, currentHotel]);

  const excludedCount = events.length - relevantEvents.length;

  // Lock body scroll and listen for Escape key when modal is open
  useEffect(() => {
    if (selectedDateInfo) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setSelectedDateInfo(null);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [selectedDateInfo]);

  // Compute month grids with filtered relevant events
  const monthDataLeft = useMemo(() => {
    return getMonthMarketGrid(currentYear, currentMonth, relevantEvents, currentHotel);
  }, [currentYear, currentMonth, relevantEvents, currentHotel]);

  // Compute second month (right)
  const monthDataRight = useMemo(() => {
    const nextMonthIndex = (currentMonth + 1) % 12;
    const nextYear = currentMonth + 1 > 11 ? currentYear + 1 : currentYear;
    return getMonthMarketGrid(nextYear, nextMonthIndex, relevantEvents, currentHotel);
  }, [currentYear, currentMonth, relevantEvents, currentHotel]);

  // Compute third month for quarter view if active
  const monthDataThird = useMemo(() => {
    const thirdMonthIndex = (currentMonth + 2) % 12;
    const thirdYear = currentMonth + 2 > 11 ? currentYear + 1 : currentYear;
    return getMonthMarketGrid(thirdYear, thirdMonthIndex, relevantEvents, currentHotel);
  }, [currentYear, currentMonth, relevantEvents, currentHotel]);

  // Navigation handlers
  const handlePrev = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNext = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Quick year switch
  const handleSetYear = (year: number) => {
    setCurrentYear(year);
  };

  // Aggregated KPI numbers for the current displayed period
  const totalForte = monthDataLeft.stats.forteCount + monthDataRight.stats.forteCount;
  const totalMoyenne = monthDataLeft.stats.moyenneCount + monthDataRight.stats.moyenneCount;
  const totalFaible = monthDataLeft.stats.faibleCount + monthDataRight.stats.faibleCount;
  const combinedAvgTO = Math.round(
    (monthDataLeft.stats.avgOccupancy + monthDataRight.stats.avgOccupancy) / 2
  );

  // Configuration de la visualisation Recharts (Évolution de la demande, barres & pics)
  const [chartScope, setChartScope] = useState<'month1' | 'month2' | 'both'>('month1');
  const [chartMetric, setChartMetric] = useState<'tension' | 'occupancy' | 'both'>('tension');
  const [showChart, setShowChart] = useState<boolean>(true);
  const [chartViewMode, setChartViewMode] = useState<'bars-combo' | 'bars-only' | 'curve-only'>('bars-combo');
  const [barColorTheme, setBarColorTheme] = useState<'slate' | 'dynamic'>('slate');

  // Seuil critique d'alerte Revenue Management (80% tension ou forte demande)
  const CRITICAL_THRESHOLD = 80;

  // Identification de l'ensemble des dates critiques sous tension maximale sur la période affichée
  const criticalDaysInView = useMemo(() => {
    const combined = [...monthDataLeft.days, ...monthDataRight.days];
    return combined.filter((d) => d.intensity >= CRITICAL_THRESHOLD || d.demandLevel === 'forte');
  }, [monthDataLeft, monthDataRight]);

  // Données structurées pour la courbe d'évolution et les barres Recharts
  const chartData = useMemo(() => {
    let daysToInclude: DayMarketInfo[] = [];
    if (chartScope === 'month1') {
      daysToInclude = monthDataLeft.days;
    } else if (chartScope === 'month2') {
      daysToInclude = monthDataRight.days;
    } else {
      daysToInclude = [...monthDataLeft.days, ...monthDataRight.days];
    }

    const basePrice = currentHotel?.baseADR || 240;

    return daysToInclude.map((d) => {
      const dObj = new Date(d.dateStr);
      const dayOfWeek = dObj.getDay(); // 0 = Dimanche, 6 = Samedi
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Label d'axe X formaté fidèlement à la capture : "1 nov. 2026", "2 nov. 2026", etc.
      const formattedAxisLabel = `${dObj.getDate()} ${dObj.toLocaleDateString('fr-FR', {
        month: 'short',
      })} ${dObj.getFullYear()}`;

      const shortMonth = dObj.toLocaleDateString('fr-FR', { month: 'short' });

      // Estimation dynamique du tarif ADR en € selon la tension marché et le prix de base de l'hôtel
      // Échelle correspondant à la capture fournie : ~130€ à ~545€
      const adrMultiplier = 0.65 + (d.intensity / 100) * 1.35;
      const estimatedADR = Math.round(basePrice * adrMultiplier);

      return {
        dateStr: d.dateStr,
        dayNumber: d.dayNumber,
        axisLabel: formattedAxisLabel,
        shortLabel: chartScope === 'both' ? `${d.dayNumber} ${shortMonth}` : `${d.dayNumber}`,
        fullDateFormatted: dObj.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        intensity: d.intensity,
        occupancy: d.projectedOccupancy,
        maxRMScore: d.maxRMScore,
        demandLevel: d.demandLevel,
        eventCount: d.eventCount,
        topEvents: d.topEventsTitles,
        dayInfo: d,
        isCritical: d.intensity >= CRITICAL_THRESHOLD || d.demandLevel === 'forte',
        isWeekend,
        estimatedADR,
      };
    });
  }, [chartScope, monthDataLeft, monthDataRight, currentHotel, CRITICAL_THRESHOLD]);

  // Zones de week-ends pour shading en arrière-plan (exactement comme dans la capture)
  const weekendBlocks = useMemo(() => {
    const blocks: { x1: string; x2: string }[] = [];
    let startLabel: string | null = null;
    let lastLabel: string | null = null;

    chartData.forEach((item, index) => {
      if (item.isWeekend) {
        if (!startLabel) startLabel = item.axisLabel;
        lastLabel = item.axisLabel;
      } else {
        if (startLabel && lastLabel) {
          blocks.push({ x1: startLabel, x2: lastLabel });
          startLabel = null;
          lastLabel = null;
        }
      }
      if (index === chartData.length - 1 && startLabel && lastLabel) {
        blocks.push({ x1: startLabel, x2: lastLabel });
      }
    });

    return blocks;
  }, [chartData]);

  // Top pics de tension sur le scope actif pour un accès rapide en 1 clic
  const peakTensionDays = useMemo(() => {
    return [...chartData]
      .filter((d) => d.intensity >= 65 || d.demandLevel === 'forte')
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 4);
  }, [chartData]);

  // Check if a day passes the current filter
  const isDayVisibleInFilter = (level: MarketDemandLevel) => {
    if (demandFilter === 'all') return true;
    return demandFilter === level;
  };

  // Mode Plein Écran pour moniteurs haute résolution
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);

  // Synchronisation avec l'API HTML5 Fullscreen et gestion de la touche Échap
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen && !selectedDateInfo) {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, selectedDateInfo]);

  const handleToggleFullscreen = async () => {
    if (!isFullscreen) {
      try {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
      } catch {
        // Fallback CSS plein écran garanti même en cas de restriction de permissions
      }
      setIsFullscreen(true);
      onShowToast('Mode Plein Écran activé pour grands moniteurs');
    } else {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch {}
      setIsFullscreen(false);
      onShowToast('Affichage standard restauré');
    }
  };

  // Génération du rapport consolidé PDF de la demande pour le mois sélectionné
  const handleExportPDF = () => {
    try {
      setIsExportingPDF(true);

      // Sélection des données selon le scope actif (Mois 1, Mois 2 ou Combiné 2 Mois)
      const targetMonthData = chartScope === 'month2' ? monthDataRight : monthDataLeft;
      const daysToExport =
        chartScope === 'both'
          ? [...monthDataLeft.days, ...monthDataRight.days]
          : targetMonthData.days;

      const statsToExport =
        chartScope === 'both'
          ? {
              forteCount: totalForte,
              moyenneCount: totalMoyenne,
              faibleCount: totalFaible,
              avgOccupancy: combinedAvgTO,
            }
          : targetMonthData.stats;

      const periodLabel =
        chartScope === 'both'
          ? `${monthDataLeft.monthName} & ${monthDataRight.monthName}`
          : targetMonthData.monthName;

      exportMarketDemandReportPDF({
        hotel: currentHotel,
        monthName: periodLabel,
        days: daysToExport,
        stats: statsToExport,
        catchmentZone: catchmentInfo.zoneName,
        catchmentScope: catchmentInfo.scopeRadius,
        criticalThreshold: CRITICAL_THRESHOLD,
      });

      onShowToast(`Rapport consolidé PDF généré avec succès pour ${periodLabel} !`);
    } catch (err) {
      console.error('Erreur lors de la génération du rapport PDF:', err);
      onShowToast("Erreur lors de la création du rapport consolidé PDF.");
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Render weekday labels (French initials matching screenshot: l m m j v s d)
  const weekdays = ['l', 'm', 'm', 'j', 'v', 's', 'd'];

  return (
    <div
      ref={containerRef}
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 overflow-y-auto bg-slate-100 p-4 sm:p-6 lg:p-8 space-y-6'
          : 'space-y-6 pb-16'
      }
    >
      {/* Sticky Fullscreen Notification & Exit Bar */}
      {isFullscreen && (
        <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-xl flex items-center justify-between border border-slate-700/80 mb-2">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <div className="text-xs font-extrabold flex items-center gap-2">
                Vue Marché en Plein Écran
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Affichage Grand Moniteur
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Calendrier multi-mois et courbe de tension Recharts optimisés pour une lisibilité maximale.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-98 text-white rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isExportingPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>Exporter en PDF</span>
            </button>
            <button
              onClick={handleToggleFullscreen}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Quitter (Échap)</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Banner: Market Intelligence Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-gradient-to-br from-rose-500 to-amber-500 text-white rounded-xl shadow-xs">
                <Flame className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  Marché & Dates à Surveiller
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">
                    Revenue Management
                  </span>
                </h1>
                <p className="text-xs text-slate-500">
                  Cartographie dynamique des niveaux de tension de la demande hôtelière basée sur la pression événementielle & les scores RM.
                </p>
              </div>
            </div>
          </div>

          {/* Quick controls: Hotel selector + Year toggle + Plein écran + Export PDF */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Hotel Selector */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <Building2 className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-medium text-slate-600">Hôtel cible :</span>
              <select
                value={selectedHotelId}
                onChange={(e) => onSelectHotel(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
              >
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.city})
                  </option>
                ))}
              </select>
            </div>

            {/* Year Switcher (2026 / 2027) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => handleSetYear(2026)}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  currentYear === 2026
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                2026
              </button>
              <button
                onClick={() => handleSetYear(2027)}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  currentYear === 2027
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                2027 (Paris)
              </button>
            </div>

            {/* Plein Écran Option */}
            <button
              onClick={handleToggleFullscreen}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isFullscreen
                  ? 'bg-violet-50 text-violet-800 border-violet-300 ring-2 ring-violet-200'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
              }`}
              title={
                isFullscreen
                  ? 'Quitter le mode plein écran (Échap)'
                  : 'Basculer la vue Marché en plein écran pour grands moniteurs'
              }
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-violet-600" />
                  <span>Quitter plein écran</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-slate-600" />
                  <span>Plein écran</span>
                </>
              )}
            </button>

            {/* Exporter en PDF Button */}
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 active:scale-98 text-white text-xs font-extrabold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              title="Générer un rapport consolidé de la demande pour le mois sélectionné en PDF"
            >
              {isExportingPDF ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Export en cours...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5 text-white" />
                  <span>Exporter en PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic Geographic Catchment & Relevance Indicator */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-violet-50 text-violet-700">
              <MapPin className="w-3.5 h-3.5" />
            </span>
            <span className="text-slate-600">
              <strong className="text-slate-800">Périmètre de pertinence :</strong> {catchmentInfo.zoneName} ({catchmentInfo.scopeRadius})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-semibold text-[11px] border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              {relevantEvents.length} événements influents retenus
            </span>
            {excludedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium text-[11px] border border-slate-200" title="Événements situés dans d'autres villes éloignées (Lyon, Nice, etc.) sans impact direct sur la demande locale de cet hôtel">
                <Filter className="w-3 h-3 text-slate-400" />
                {excludedCount} distants hors-bassin exclus
              </span>
            )}
          </div>
        </div>

        {/* 4 Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mt-4 pt-4 border-t border-slate-100">
          {/* KPI 1: Forte Demande */}
          <div
            onClick={() => setDemandFilter(demandFilter === 'forte' ? 'all' : 'forte')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              demandFilter === 'forte'
                ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-300'
                : 'bg-rose-50/50 border-rose-200 hover:bg-rose-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                Forte Demande
              </span>
              <span className="text-xs text-rose-600 font-semibold">Tension Max</span>
            </div>
            <div className="text-2xl font-black text-rose-950 mt-1 tabular-nums">
              {totalForte} <span className="text-xs font-semibold text-rose-700">jours</span>
            </div>
            <div className="text-[11px] text-rose-700 mt-1">
              Hausse ADR requise (+25% à +45%) · Min stay 3 nuits
            </div>
          </div>

          {/* KPI 2: Demande Moyenne */}
          <div
            onClick={() => setDemandFilter(demandFilter === 'moyenne' ? 'all' : 'moyenne')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              demandFilter === 'moyenne'
                ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300'
                : 'bg-amber-50/50 border-amber-200 hover:bg-amber-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Demande Moyenne
              </span>
              <span className="text-xs text-amber-600 font-semibold">Soutenu</span>
            </div>
            <div className="text-2xl font-black text-amber-950 mt-1 tabular-nums">
              {totalMoyenne} <span className="text-xs font-semibold text-amber-700">jours</span>
            </div>
            <div className="text-[11px] text-amber-700 mt-1">
              Pilotage actif du pickup · ADR +10% à +20%
            </div>
          </div>

          {/* KPI 3: Faible Demande */}
          <div
            onClick={() => setDemandFilter(demandFilter === 'faible' ? 'all' : 'faible')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              demandFilter === 'faible'
                ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300'
                : 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Faible Demande
              </span>
              <span className="text-xs text-emerald-600 font-semibold">Opportunité</span>
            </div>
            <div className="text-2xl font-black text-emerald-950 mt-1 tabular-nums">
              {totalFaible} <span className="text-xs font-semibold text-emerald-700">jours</span>
            </div>
            <div className="text-[11px] text-emerald-700 mt-1">
              Actions commerciales · Packages & Annulation libre
            </div>
          </div>

          {/* KPI 4: TO Prévisionnel Moyen */}
          <div className="p-3.5 rounded-xl border border-violet-200 bg-violet-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-violet-800 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-violet-600" />
                TO Prévisionnel
              </span>
              <span className="text-xs text-violet-600 font-semibold">{currentHotel.name}</span>
            </div>
            <div className="text-2xl font-black text-violet-950 mt-1 tabular-nums">
              {combinedAvgTO}%
            </div>
            <div className="text-[11px] text-violet-700 mt-1">
              Moyenne estimée sur les 2 mois affichés
            </div>
          </div>
        </div>

        {/* Filter bar: Level pills & Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mr-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtrer par niveau :
            </span>
            <button
              onClick={() => setDemandFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                demandFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tous les niveaux
            </button>
            <button
              onClick={() => setDemandFilter('forte')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                demandFilter === 'forte'
                  ? 'bg-rose-500 text-white shadow-2xs'
                  : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Forte demande (Rouge)
            </button>
            <button
              onClick={() => setDemandFilter('moyenne')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                demandFilter === 'moyenne'
                  ? 'bg-amber-400 text-slate-900 shadow-2xs'
                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Demande moyenne (Orange)
            </button>
            <button
              onClick={() => setDemandFilter('faible')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                demandFilter === 'faible'
                  ? 'bg-emerald-400 text-slate-900 shadow-2xs'
                  : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Faible demande (Vert)
            </button>
          </div>

          {/* Quick jump to October 2026 reference (matching user's screenshot) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCurrentYear(2026);
                setCurrentMonth(9); // Oct 2026
                onShowToast('Affichage repositionné sur Octobre & Novembre 2026');
              }}
              className="text-xs font-semibold text-violet-700 hover:text-violet-900 hover:underline cursor-pointer"
            >
              Repositionner sur Oct. / Nov. 2026
            </button>
          </div>
        </div>
      </div>

      {/* 1. COURBE D'ÉVOLUTION DE LA DEMANDE (RECHARTS) & PICS DE TENSION */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 lg:p-6 space-y-4">
        {/* Header bar of the chart card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200/60">
                <Activity className="w-4 h-4" />
              </span>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                Courbe d'Évolution de la Demande & Pics de Tension
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Recharts Analytics
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Visualisation continue de la pression du marché jour par jour pour identifier immédiatement les pics de tension et ajuster le Yield.
            </p>
          </div>

          {/* Controls: Scope Switcher, View Mode, Bar Coloring, Metric Toggle & PDF Export */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Scope Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setChartScope('month1')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer capitalize ${
                  chartScope === 'month1'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {monthDataLeft.monthName.split(' ')[0]}
              </button>
              <button
                onClick={() => setChartScope('month2')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer capitalize ${
                  chartScope === 'month2'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {monthDataRight.monthName.split(' ')[0]}
              </button>
              <button
                onClick={() => setChartScope('both')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  chartScope === 'both'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                2 Mois
              </button>
            </div>

            {/* Chart Mode: Combo / Bars Only / Curve Only */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setChartViewMode('bars-combo')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  chartViewMode === 'bars-combo'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Barres pour chaque date avec courbe d'évolution superposée"
              >
                <BarChart3 className="w-3.5 h-3.5 text-rose-500" />
                <span>Barres & Courbe</span>
              </button>
              <button
                onClick={() => setChartViewMode('bars-only')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  chartViewMode === 'bars-only'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Barres seules pour chaque date (fidèle à la capture)"
              >
                <span>Barres seules</span>
              </button>
              <button
                onClick={() => setChartViewMode('curve-only')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  chartViewMode === 'curve-only'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Courbe fluide seule"
              >
                <span>Courbe</span>
              </button>
            </div>

            {/* Bar Styling Theme Toggle */}
            {chartViewMode !== 'curve-only' && (
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-medium">
                <button
                  onClick={() => setBarColorTheme('slate')}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] ${
                    barColorTheme === 'slate'
                      ? 'bg-slate-700 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Barres couleur ardoise neutre fidèle à la capture"
                >
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>Ardoise</span>
                </button>
                <button
                  onClick={() => setBarColorTheme('dynamic')}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] ${
                    barColorTheme === 'dynamic'
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Barres colorées selon le niveau de tension (Rouge, Orange, Vert)"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Coloré</span>
                </button>
              </div>
            )}

            {/* Metric Toggle (visible in combo or curve mode) */}
            {chartViewMode !== 'bars-only' && (
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  onClick={() => setChartMetric('tension')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    chartMetric === 'tension'
                      ? 'bg-rose-500 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tension (%)
                </button>
                <button
                  onClick={() => setChartMetric('occupancy')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    chartMetric === 'occupancy'
                      ? 'bg-violet-600 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  TO Projeté (%)
                </button>
                <button
                  onClick={() => setChartMetric('both')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    chartMetric === 'both'
                      ? 'bg-slate-900 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Combiné
                </button>
              </div>
            )}

            {/* Direct PDF Export from Chart */}
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              title="Exporter le rapport consolidé de la demande pour cette sélection en PDF"
            >
              {isExportingPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-white" />
              )}
              <span className="hidden sm:inline">Rapport PDF</span>
            </button>
          </div>
        </div>

        {/* Peak Tension Callout Pill Chips */}
        {peakTensionDays.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Pics de tension détectés :
            </span>
            {peakTensionDays.map((peak) => (
              <button
                key={peak.dateStr}
                onClick={() => setSelectedDateInfo(peak.dayInfo)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-violet-50 text-slate-800 hover:text-violet-900 border border-slate-200 hover:border-violet-300 font-medium text-xs transition-all cursor-pointer group"
                title="Cliquer pour inspecter cette date en détail"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    peak.demandLevel === 'forte' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <strong className="font-bold">
                  {new Date(peak.dateStr).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </strong>
                <span className="text-[11px] font-extrabold text-rose-600 tabular-nums">
                  {peak.intensity}% tension
                </span>
                {peak.topEvents && peak.topEvents.length > 0 && (
                  <span className="text-[10px] text-slate-400 max-w-[130px] truncate hidden md:inline">
                    · {peak.topEvents[0]}
                  </span>
                )}
                <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-violet-600" />
              </button>
            ))}
          </div>
        )}

        {/* The Recharts Composed Canvas with Vertical Bars for Every Date */}
        <div className={`w-full ${isFullscreen ? 'h-96 lg:h-[450px]' : 'h-72 lg:h-80'} pt-2 transition-all`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 15, right: 35, left: 10, bottom: 45 }}
              onClick={(e: any) => {
                if (e && e.activePayload && e.activePayload[0]) {
                  const d = e.activePayload[0].payload?.dayInfo;
                  if (d) setSelectedDateInfo(d);
                }
              }}
            >
              <defs>
                <linearGradient id="marketTensionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="marketOccupancyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              {/* Shaded Weekend Bands in Chart Background (matching screenshot) */}
              {weekendBlocks.map((wb, idx) => (
                <ReferenceArea
                  key={`we-${idx}`}
                  yAxisId="right"
                  x1={wb.x1}
                  x2={wb.x2}
                  fill="#64748b"
                  fillOpacity={0.08}
                />
              ))}

              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

              {/* X-Axis with rotated date labels matching screenshot */}
              <XAxis
                dataKey="axisLabel"
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }}
                angle={-45}
                textAnchor="end"
                height={52}
                interval={chartData.length > 31 ? 1 : 0}
              />

              {/* Left Y-Axis: ADR Price in € (matching screenshot: € 130 to € 545) */}
              <YAxis
                yAxisId="left"
                orientation="left"
                tickLine={false}
                axisLine={{ stroke: '#f1f5f9' }}
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={(val) => `€ ${val}`}
                domain={[
                  (dataMin: number) => Math.floor(Math.max(90, dataMin * 0.9)),
                  (dataMax: number) => Math.ceil(dataMax * 1.05),
                ]}
              />

              {/* Right Y-Axis: Market Demand in % (matching screenshot: 10% to 85% + label) */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                ticks={[10, 25, 40, 55, 70, 85, 100]}
                tickLine={false}
                axisLine={{ stroke: '#f1f5f9' }}
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={(val) => `${val}%`}
                label={{
                  value: 'Demande du marché',
                  angle: 90,
                  position: 'insideRight',
                  fill: '#475569',
                  fontSize: 11,
                  fontWeight: 600,
                  offset: 15,
                }}
              />

              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload;
                  const dInfo = data.dayInfo as DayMarketInfo;
                  return (
                    <div className="bg-slate-900 text-white rounded-xl shadow-xl p-3 border border-slate-700/80 text-xs min-w-56 max-w-72">
                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
                        <span className="font-bold text-slate-100 capitalize">
                          {data.fullDateFormatted}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-sm uppercase ${
                            dInfo.demandLevel === 'forte'
                              ? 'bg-rose-500 text-white'
                              : dInfo.demandLevel === 'moyenne'
                              ? 'bg-amber-400 text-slate-900'
                              : 'bg-emerald-400 text-slate-900'
                          }`}
                        >
                          {dInfo.demandLevel}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Demande du marché :</span>
                          <span className="font-extrabold text-rose-400 tabular-nums">
                            {data.intensity}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Tarif suggéré (ADR) :</span>
                          <span className="font-bold text-emerald-400 tabular-nums">
                            € {data.estimatedADR}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">TO prévisionnel :</span>
                          <span className="font-bold text-violet-300 tabular-nums">
                            {data.occupancy}%
                          </span>
                        </div>
                        {dInfo.maxRMScore > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Score RM max :</span>
                            <span className="font-bold text-amber-300 tabular-nums">
                              {dInfo.maxRMScore}/100
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Événements influents :</span>
                          <span className="font-bold text-white tabular-nums">
                            {data.eventCount}
                          </span>
                        </div>
                        {data.topEvents && data.topEvents.length > 0 && (
                          <div className="pt-1.5 mt-1 border-t border-slate-800 text-[11px]">
                            <span className="text-slate-400">Salons : </span>
                            <span className="text-slate-200 font-medium truncate block">
                              {data.topEvents.slice(0, 2).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 pt-1 border-t border-slate-800 text-[10px] text-violet-400 flex items-center gap-1 font-semibold">
                        <Sparkles className="w-3 h-3 shrink-0" />
                        <span>Cliquez pour ouvrir le diagnostic complet</span>
                      </div>
                    </div>
                  );
                }}
              />

              <ReferenceLine
                yAxisId="right"
                y={CRITICAL_THRESHOLD}
                stroke="#e11d48"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'Seuil Critique (80%)',
                  position: 'insideTopRight',
                  fill: '#e11d48',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              />

              {/* VERTICAL BARS FOR EACH INDIVIDUAL DATE (Faithful to Screenshot) */}
              {(chartViewMode === 'bars-combo' || chartViewMode === 'bars-only') && (
                <Bar
                  yAxisId="right"
                  dataKey="intensity"
                  name="Demande du marché"
                  barSize={chartData.length > 35 ? 7 : 12}
                  radius={[3, 3, 0, 0]}
                  cursor="pointer"
                  onClick={(entry: any) => {
                    if (entry && entry.dayInfo) {
                      setSelectedDateInfo(entry.dayInfo);
                    }
                  }}
                >
                  {chartData.map((entry, index) => {
                    let cellFill = '#54657e'; // Screenshot default slate-blue tone
                    if (barColorTheme === 'dynamic') {
                      if (entry.demandLevel === 'forte') cellFill = '#f43f5e';
                      else if (entry.demandLevel === 'moyenne') cellFill = '#f59e0b';
                      else cellFill = '#10b981';
                    }
                    return (
                      <Cell
                        key={`bar-cell-${index}`}
                        fill={cellFill}
                        fillOpacity={entry.isCritical ? 1 : 0.88}
                        className="hover:opacity-100 transition-opacity cursor-pointer"
                      />
                    );
                  })}
                </Bar>
              )}

              {/* OVERLAY CURVES (When in Combo or Curve-Only Mode) */}
              {(chartViewMode === 'bars-combo' || chartViewMode === 'curve-only') &&
                (chartMetric === 'tension' || chartMetric === 'both') && (
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="intensity"
                    name="Tension de la demande"
                    stroke="#e11d48"
                    strokeWidth={2.5}
                    fillOpacity={chartViewMode === 'bars-combo' ? 0.12 : 0.45}
                    fill="url(#marketTensionGradient)"
                    activeDot={{
                      r: 6,
                      fill: '#be123c',
                      stroke: '#ffffff',
                      strokeWidth: 2,
                      cursor: 'pointer',
                    }}
                  />
                )}

              {(chartViewMode === 'bars-combo' || chartViewMode === 'curve-only') &&
                (chartMetric === 'occupancy' || chartMetric === 'both') && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="occupancy"
                    name="TO Prévisionnel"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    strokeDasharray={chartViewMode === 'bars-combo' ? '4 4' : undefined}
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: '#6d28d9',
                      stroke: '#ffffff',
                      strokeWidth: 2,
                      cursor: 'pointer',
                    }}
                  />
                )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. BANDEAU D'ALERTE VISUELLE (SEUIL CRITIQUE DÉPASSÉ) */}
      {criticalDaysInView.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border border-rose-300 rounded-2xl p-4 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="relative flex h-3.5 w-3.5 mt-1 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-extrabold text-rose-950 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Alerte Seuil Critique : {criticalDaysInView.length} date{criticalDaysInView.length > 1 ? 's' : ''} sous tension maximale
                  </h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900">
                    Tension ≥ {CRITICAL_THRESHOLD}%
                  </span>
                </div>
                <p className="text-xs text-rose-900/80 mt-0.5">
                  Pics de tension identifiés avec saturation prévisionnelle de la capacité hôtelière. Décision immédiate recommandée : fermeture des tarifs promotionnels (OTA), hausse de l'ADR (+25% à +45%) et application d'un séjour minimum (MinLOS 2-3 nuits).
                </p>
              </div>
            </div>

            {/* Quick date inspection pills */}
            <div className="flex items-center gap-1.5 flex-wrap self-end md:self-auto shrink-0">
              <span className="text-[11px] font-semibold text-rose-800 mr-1">Inspecter :</span>
              {criticalDaysInView.slice(0, 6).map((cd) => (
                <button
                  key={cd.dateStr}
                  onClick={() => setSelectedDateInfo(cd)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-rose-800 hover:bg-rose-100 border border-rose-300 shadow-2xs transition-all cursor-pointer flex items-center gap-1 hover:scale-105 active:scale-95"
                  title={`Ouvrir le diagnostic pour le ${cd.dateStr}`}
                >
                  <Flame className="w-3 h-3 text-rose-500" />
                  <span>
                    {new Date(cd.dateStr).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </span>
                  <span className="text-[10px] text-rose-600 font-extrabold">({cd.intensity}%)</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Multi-Month Calendar Surface (faithful to screenshot image_d31a63a7.png) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 lg:p-8">
        {/* Navigation Bar matching screenshot */}
        <div className="flex items-center justify-between mb-8 px-2">
          <button
            onClick={handlePrev}
            aria-label="Mois précédent"
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
            <h2 className="text-xl lg:text-2xl font-bold text-slate-900 lowercase tracking-tight">
              {monthDataLeft.monthName}
            </h2>
            <h2 className="text-xl lg:text-2xl font-bold text-slate-900 lowercase tracking-tight">
              {monthDataRight.monthName}
            </h2>
          </div>

          <button
            onClick={handleNext}
            aria-label="Mois suivant"
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <ChevronRight className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* 2 Month Grids Side-by-Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-14">
          {/* LEFT MONTH */}
          <div>
            {/* Weekday headers: l m m j v s d */}
            <div className="grid grid-cols-7 gap-2 lg:gap-3 text-center mb-4">
              {weekdays.map((w, idx) => (
                <div
                  key={idx}
                  className="text-sm lg:text-base font-extrabold text-slate-900 uppercase tracking-wider py-1"
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-2 lg:gap-3">
              {/* Leading empty slots */}
              {Array.from({ length: monthDataLeft.leadingEmptyDays }).map((_, i) => (
                <div key={`empty-left-${i}`} className="aspect-square" />
              ))}

              {/* Day cells */}
              {monthDataLeft.days.map((dayInfo) => {
                const isSelected = selectedDateInfo?.dateStr === dayInfo.dateStr;
                const matchesFilter = isDayVisibleInFilter(dayInfo.demandLevel);
                const isCritical =
                  dayInfo.intensity >= CRITICAL_THRESHOLD || dayInfo.demandLevel === 'forte';

                // Determine coloring based on demand level and screenshot appearance
                let cellClasses =
                  'aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer font-bold select-none text-base lg:text-lg ';

                if (!matchesFilter) {
                  cellClasses += 'opacity-25 grayscale scale-95 ';
                }

                // If date is in October and before day 31, screenshot shows plain uncolored muted numbers
                // If it has demand or day 31, color it!
                const isSpecialScreenshotOctMuted =
                  dayInfo.year === 2026 &&
                  dayInfo.month === 9 &&
                  dayInfo.dayNumber < 31 &&
                  dayInfo.demandLevel === 'faible';

                if (isSpecialScreenshotOctMuted) {
                  cellClasses += 'text-slate-400 hover:bg-slate-100 hover:text-slate-700';
                } else if (dayInfo.demandLevel === 'forte') {
                  // Coral/Pink Red matching screenshot #fb7185
                  cellClasses +=
                    'bg-[#fb7185] text-slate-900 shadow-xs hover:brightness-95 hover:scale-105 active:scale-95';
                } else if (dayInfo.demandLevel === 'moyenne') {
                  // Orange/Amber matching screenshot #fbb664
                  cellClasses +=
                    'bg-[#fbb664] text-slate-900 shadow-xs hover:brightness-95 hover:scale-105 active:scale-95';
                } else {
                  // Mint/Green matching screenshot #6ee7b7
                  cellClasses +=
                    'bg-[#6ee7b7] text-slate-900 shadow-xs hover:brightness-95 hover:scale-105 active:scale-95';
                }

                if (isSelected) {
                  cellClasses += ' ring-3 ring-slate-900 ring-offset-2 z-10';
                }

                return (
                  <div
                    key={dayInfo.dateStr}
                    onClick={() => setSelectedDateInfo(dayInfo)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredDay({
                        info: dayInfo,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setHoveredDay(null)}
                    className={cellClasses}
                  >
                    <span>{dayInfo.dayNumber}</span>

                    {/* Pastille d'alerte visuelle quand le niveau dépasse le seuil critique */}
                    {isCritical && (
                      <span
                        className="absolute -top-1 -right-1 flex h-3 w-3 z-20 pointer-events-none"
                        title={`Alerte seuil critique : tension ${dayInfo.intensity}%`}
                      >
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600 border border-white items-center justify-center shadow-xs">
                          <span className="w-1 h-1 rounded-full bg-white" />
                        </span>
                      </span>
                    )}

                    {/* Small badge if events exist & cell is colored */}
                    {dayInfo.eventCount > 0 && (
                      <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-slate-900/60" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT MONTH */}
          <div>
            {/* Weekday headers: l m m j v s d */}
            <div className="grid grid-cols-7 gap-2 lg:gap-3 text-center mb-4">
              {weekdays.map((w, idx) => (
                <div
                  key={idx}
                  className="text-sm lg:text-base font-extrabold text-slate-900 uppercase tracking-wider py-1"
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-2 lg:gap-3">
              {/* Leading empty slots */}
              {Array.from({ length: monthDataRight.leadingEmptyDays }).map((_, i) => (
                <div key={`empty-right-${i}`} className="aspect-square" />
              ))}

              {/* Day cells */}
              {monthDataRight.days.map((dayInfo) => {
                const isSelected = selectedDateInfo?.dateStr === dayInfo.dateStr;
                const matchesFilter = isDayVisibleInFilter(dayInfo.demandLevel);
                const isCritical =
                  dayInfo.intensity >= CRITICAL_THRESHOLD || dayInfo.demandLevel === 'forte';

                let cellClasses =
                  'aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer font-bold select-none text-base lg:text-lg ';

                if (!matchesFilter) {
                  cellClasses += 'opacity-25 grayscale scale-95 ';
                }

                if (dayInfo.demandLevel === 'forte') {
                  // Coral/Pink Red matching screenshot #fb7185
                  cellClasses +=
                    'bg-[#fb7185] text-slate-900 shadow-xs hover:brightness-95 hover:scale-105 active:scale-95';
                } else if (dayInfo.demandLevel === 'moyenne') {
                  // Orange/Amber matching screenshot #fbb664
                  cellClasses +=
                    'bg-[#fbb664] text-slate-900 shadow-xs hover:brightness-95 hover:scale-105 active:scale-95';
                } else {
                  // Mint/Green matching screenshot #6ee7b7
                  cellClasses +=
                    'bg-[#6ee7b7] text-slate-900 shadow-xs hover:brightness-95 hover:scale-105 active:scale-95';
                }

                if (isSelected) {
                  cellClasses += ' ring-3 ring-slate-900 ring-offset-2 z-10';
                }

                return (
                  <div
                    key={dayInfo.dateStr}
                    onClick={() => setSelectedDateInfo(dayInfo)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredDay({
                        info: dayInfo,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setHoveredDay(null)}
                    className={cellClasses}
                  >
                    <span>{dayInfo.dayNumber}</span>

                    {/* Pastille d'alerte visuelle quand le niveau dépasse le seuil critique */}
                    {isCritical && (
                      <span
                        className="absolute -top-1 -right-1 flex h-3 w-3 z-20 pointer-events-none"
                        title={`Alerte seuil critique : tension ${dayInfo.intensity}%`}
                      >
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600 border border-white items-center justify-center shadow-xs">
                          <span className="w-1 h-1 rounded-full bg-white" />
                        </span>
                      </span>
                    )}

                    {/* Small dot indicator if events exist */}
                    {dayInfo.eventCount > 0 && (
                      <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-slate-900/60" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend bar at the bottom matching user specifications */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-10 pt-6 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-md bg-[#fb7185] border border-rose-300 inline-block shadow-2xs" />
            <span className="font-semibold text-slate-800">Rouge :</span>
            <span>Forte demande — dates sous tension maximale ou exceptionnelle</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-md bg-[#fbb664] border border-amber-300 inline-block shadow-2xs" />
            <span className="font-semibold text-slate-800">Orange :</span>
            <span>Demande moyenne — dates présentant un niveau de demande modéré</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-md bg-[#6ee7b7] border border-emerald-300 inline-block shadow-2xs" />
            <span className="font-semibold text-slate-800">Vert :</span>
            <span>Faible demande — dates présentant un niveau de demande faible / calme</span>
          </div>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredDay && !selectedDateInfo && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${hoveredDay.x}px`,
            top: `${hoveredDay.y - 10}px`,
          }}
        >
          <div className="bg-slate-900 text-white rounded-xl shadow-xl p-3.5 w-64 border border-slate-700/80 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs capitalize text-slate-100">
                {new Date(hoveredDay.info.dateStr).toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${
                  hoveredDay.info.demandLevel === 'forte'
                    ? 'bg-rose-500 text-white'
                    : hoveredDay.info.demandLevel === 'moyenne'
                    ? 'bg-amber-400 text-slate-900'
                    : 'bg-emerald-400 text-slate-900'
                }`}
              >
                {hoveredDay.info.demandLevel}
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span>Intensité demande :</span>
                <span className="font-bold text-white tabular-nums">
                  {hoveredDay.info.intensity}%
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    hoveredDay.info.demandLevel === 'forte'
                      ? 'bg-rose-400'
                      : hoveredDay.info.demandLevel === 'moyenne'
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${hoveredDay.info.intensity}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span>TO Prévisionnel :</span>
                <span className="font-bold text-white tabular-nums">
                  {hoveredDay.info.projectedOccupancy}%
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span>Événements identifiés :</span>
                <span className="font-bold text-white tabular-nums">
                  {hoveredDay.info.eventCount}
                </span>
              </div>

              {hoveredDay.info.topEventsTitles.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                  <div className="font-semibold text-slate-400 mb-0.5">Moteurs de demande :</div>
                  <ul className="list-disc list-inside truncate text-slate-200">
                    {hoveredDay.info.topEventsTitles.slice(0, 2).map((t, i) => (
                      <li key={i} className="truncate">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-2 text-[10px] text-slate-400 text-center italic">
              Cliquez pour inspecter la date en détail
            </div>
          </div>
        </div>
      )}

      {/* Fenêtre Modale (Popup) des Détails d'une Date au premier plan */}
      {selectedDateInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-slate-950/65 backdrop-blur-xs transition-all animate-in fade-in duration-200"
          onClick={() => setSelectedDateInfo(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-date-title"
        >
          <div
            className="relative w-full max-w-4xl max-h-[88vh] bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Sticky Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 sm:py-5 border-b border-slate-100 bg-white sticky top-0 z-10 gap-3">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-13 h-13 rounded-2xl flex flex-col items-center justify-center font-black shadow-xs shrink-0 ${
                    selectedDateInfo.demandLevel === 'forte'
                      ? 'bg-[#fb7185] text-slate-900'
                      : selectedDateInfo.demandLevel === 'moyenne'
                      ? 'bg-[#fbb664] text-slate-900'
                      : 'bg-[#6ee7b7] text-slate-900'
                  }`}
                >
                  <span className="text-2xl leading-none font-black">{selectedDateInfo.dayNumber}</span>
                  <span className="text-[10px] uppercase font-bold tracking-tight">
                    {new Date(selectedDateInfo.dateStr).toLocaleDateString('fr-FR', {
                      month: 'short',
                    })}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 id="modal-date-title" className="text-xl font-extrabold text-slate-900 capitalize">
                      {new Date(selectedDateInfo.dateStr).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </h2>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        selectedDateInfo.demandLevel === 'forte'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : selectedDateInfo.demandLevel === 'moyenne'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                      }`}
                    >
                      Demande {selectedDateInfo.demandLevel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>Établissement : <strong>{currentHotel.name}</strong> ({currentHotel.city})</span>
                    <span className="text-slate-300">·</span>
                    <span>Capacité {currentHotel.roomCount} ch.</span>
                    <span className="text-slate-300">·</span>
                    <span>Base ADR {currentHotel.baseADR}€</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  onClick={() => {
                    onShowToast(`Règle Yield enregistrée pour le ${selectedDateInfo.dateStr}`);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Appliquer Règle Yield
                </button>

                <button
                  onClick={() => setSelectedDateInfo(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
                  aria-label="Fermer la fenêtre (Échap)"
                  title="Fermer la fenêtre (Échap)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Internal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Geographic Catchment Notice */}
              <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-violet-600 shrink-0" />
                  <span>
                    <strong>Bassin de pertinence :</strong> {catchmentInfo.zoneName} ({catchmentInfo.scopeRadius})
                  </span>
                </div>
                <span className="text-slate-500 text-[11px]">
                  Seuls les événements générateurs de flux locaux sont comptabilisés
                </span>
              </div>

              {/* 3 Columns Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Col 1: Pression & TO Prévisionnel */}
                <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/80 space-y-3.5 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
                      <Percent className="w-4 h-4 text-violet-600" />
                      Indicateurs Prévisionnels
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="text-slate-600 font-medium">Intensité de tension globale</span>
                        <span className="font-extrabold text-slate-900 tabular-nums">
                          {selectedDateInfo.intensity}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            selectedDateInfo.demandLevel === 'forte'
                              ? 'bg-rose-500'
                              : selectedDateInfo.demandLevel === 'moyenne'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${selectedDateInfo.intensity}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/70 space-y-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">Taux d'occupation estimé :</span>
                      <span className="font-extrabold text-slate-900 tabular-nums">
                        {selectedDateInfo.projectedOccupancy}% ({Math.round((selectedDateInfo.projectedOccupancy / 100) * currentHotel.roomCount)} ch.)
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">Score RM max enregistré :</span>
                      <span className="font-bold text-violet-700 tabular-nums">
                        {selectedDateInfo.maxRMScore > 0 ? `${selectedDateInfo.maxRMScore} / 100` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">Affluence cumulée estimée :</span>
                      <span className="font-bold text-slate-800 tabular-nums">
                        {selectedDateInfo.totalAttendance.toLocaleString('fr-FR')} pax
                      </span>
                    </div>
                  </div>
                </div>

                {/* Col 2: Recommandation Tarifaire & Yield */}
                <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/80 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      Stratégie Tarifaire Recommandée
                    </div>

                    <div className="bg-white rounded-xl p-3 border border-slate-200/60 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Ajustement ADR conseillé :</span>
                        <span className="font-black text-emerald-700 text-sm">
                          {selectedDateInfo.adrAdvice}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Restriction de séjour (MinLOS) :</span>
                        <span className="font-bold text-slate-800">
                          {selectedDateInfo.minStayAdvice}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 leading-relaxed bg-white rounded-xl p-3 border border-slate-200/60">
                    <div className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-violet-600" />
                      Consigne Revenue Management :
                    </div>
                    {selectedDateInfo.yieldStrategy}
                  </div>
                </div>

                {/* Col 3: Événements moteurs ce jour */}
                <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/80 space-y-2.5 flex flex-col">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon className="w-4 h-4 text-violet-600" />
                      Événements Pertinents ({selectedDateInfo.eventCount})
                    </span>
                    <span className="text-[10px] text-slate-400">Clic pour fiche</span>
                  </div>

                  {selectedDateInfo.activeEvents.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-slate-400 text-xs">
                      <Info className="w-7 h-7 mb-1.5 text-slate-300" />
                      Aucun événement majeur répertorié dans le bassin pour cette date. Période calme ou demande purement organique.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {selectedDateInfo.activeEvents.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={() => onSelectEvent(ev)}
                          className="bg-white p-2.5 rounded-xl border border-slate-200/70 hover:border-violet-300 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between group"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-bold text-slate-900 truncate group-hover:text-violet-700">
                              {ev.title}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                              <span>{ev.venueName}</span>
                              <span>·</span>
                              <span>{(ev.expectedAttendance || 0).toLocaleString('fr-FR')} pax</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md tabular-nums ${
                                ev.scoreBreakdown?.finalRMScore >= 80
                                  ? 'bg-rose-100 text-rose-800'
                                  : ev.scoreBreakdown?.finalRMScore >= 60
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {ev.scoreBreakdown?.finalRMScore ?? 50}
                            </span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-600" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Sticky Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-white border border-slate-200 rounded shadow-2xs text-slate-600">
                  Échap
                </kbd>
                <span>ou clic à l'extérieur pour fermer</span>
              </span>
              <button
                onClick={() => setSelectedDateInfo(null)}
                className="px-4 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
