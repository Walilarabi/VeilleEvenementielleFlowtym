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
import { SchoolHolidaysImpactView } from './SchoolHolidaysImpactView';
import { LighthouseCompetitiveIntelligenceView } from '../pricing/LighthouseCompetitiveIntelligenceView';

interface MarketCalendarViewProps {
  events: EventItem[];
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectHotel: (hotelId: string) => void;
  onSelectEvent: (event: EventItem) => void;
  onShowToast: (msg: string) => void;
  initialSubTab?: 'calendar' | 'school_holidays' | 'lighthouse';
}

export const MarketCalendarView: React.FC<MarketCalendarViewProps> = ({
  events,
  hotels,
  selectedHotelId,
  onSelectHotel,
  onSelectEvent,
  onShowToast,
  initialSubTab = 'calendar',
}) => {
  // Active sub-tab in Analyse de marché: 'calendar' | 'school_holidays' | 'lighthouse'
  const [activeMarketSubTab, setActiveMarketSubTab] = useState<'calendar' | 'school_holidays' | 'lighthouse'>(initialSubTab);
  // Date locale de l'établissement : aucune date de démonstration codée en dur.
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());

  // Navigation state: start month index (0-indexed) & year
  // Par défaut, initialisé automatiquement sur le mois en cours
  const [currentYear, setCurrentYear] = useState<number>(() => Number(todayStr.slice(0, 4)));
  const [currentMonth, setCurrentMonth] = useState<number>(() => Number(todayStr.slice(5, 7)) - 1);

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

  // Calcul dynamique des 3 mois consécutifs : Mois en cours, Mois+1, Mois+2
  const getMonthYearOffset = (baseYear: number, baseMonth: number, offset: number) => {
    const totalMonths = baseYear * 12 + baseMonth + offset;
    const year = Math.floor(totalMonths / 12);
    const month = ((totalMonths % 12) + 12) % 12;
    return { year, month };
  };

  const m1 = useMemo(() => getMonthYearOffset(currentYear, currentMonth, 0), [currentYear, currentMonth]);
  const m2 = useMemo(() => getMonthYearOffset(currentYear, currentMonth, 1), [currentYear, currentMonth]);
  const m3 = useMemo(() => getMonthYearOffset(currentYear, currentMonth, 2), [currentYear, currentMonth]);

  // Mois 1 : mois courant
  const monthData1 = useMemo(() => {
    return getMonthMarketGrid(m1.year, m1.month, relevantEvents, currentHotel);
  }, [m1.year, m1.month, relevantEvents, currentHotel]);

  // Mois 2 : mois suivant
  const monthData2 = useMemo(() => {
    return getMonthMarketGrid(m2.year, m2.month, relevantEvents, currentHotel);
  }, [m2.year, m2.month, relevantEvents, currentHotel]);

  // Mois 3 : 2ème mois suivant (ex: Janvier 2027)
  const monthData3 = useMemo(() => {
    return getMonthMarketGrid(m3.year, m3.month, relevantEvents, currentHotel);
  }, [m3.year, m3.month, relevantEvents, currentHotel]);

  // Animation state for smooth month transitions (fade-in + horizontal slide)
  const [animationClass, setAnimationClass] = useState<string>('animate-calendar-fade');
  const [calendarKey, setCalendarKey] = useState<string>(() => `cal-${currentYear}-${currentMonth}`);

  const triggerCalendarTransition = (direction: 'next' | 'prev') => {
    setAnimationClass(direction === 'next' ? 'animate-calendar-next' : 'animate-calendar-prev');
    setCalendarKey(`cal-${Date.now()}`);
  };

  // Navigation handlers (mois par mois, trimestre, réinitialisation à aujourd'hui)
  const handlePrev = () => {
    triggerCalendarTransition('prev');
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNext = () => {
    triggerCalendarTransition('next');
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handlePrevQuarter = () => {
    triggerCalendarTransition('prev');
    const p = getMonthYearOffset(currentYear, currentMonth, -3);
    setCurrentYear(p.year);
    setCurrentMonth(p.month);
  };

  const handleNextQuarter = () => {
    triggerCalendarTransition('next');
    const n = getMonthYearOffset(currentYear, currentMonth, 3);
    setCurrentYear(n.year);
    setCurrentMonth(n.month);
  };

  const handleResetToToday = () => {
    triggerCalendarTransition('prev');
    const today = new Date(`${todayStr}T12:00:00`);
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    onShowToast("Calendrier repositionné sur le mois courant.");
  };

  // Quick year switch
  const handleSetYear = (year: number) => {
    setCurrentYear(year);
  };

  // Aggregated KPI numbers for the 3 displayed consecutive months
  const totalForte = monthData1.stats.forteCount + monthData2.stats.forteCount + monthData3.stats.forteCount;
  const totalMoyenne = monthData1.stats.moyenneCount + monthData2.stats.moyenneCount + monthData3.stats.moyenneCount;
  const totalFaible = monthData1.stats.faibleCount + monthData2.stats.faibleCount + monthData3.stats.faibleCount;
  const combinedAvgTO = Math.round(
    (monthData1.stats.avgOccupancy + monthData2.stats.avgOccupancy + monthData3.stats.avgOccupancy) / 3
  );

  // Configuration de la visualisation Recharts (Évolution de la demande, barres & pics sur 3 mois)
  const [chartScope, setChartScope] = useState<'month1' | 'month2' | 'month3' | 'all3'>('all3');
  const [chartMetric, setChartMetric] = useState<'tension' | 'occupancy' | 'both'>('tension');
  const [showChart, setShowChart] = useState<boolean>(true);
  const [chartViewMode, setChartViewMode] = useState<'bars-combo' | 'bars-only' | 'curve-only'>('bars-combo');
  const [barColorTheme, setBarColorTheme] = useState<'slate' | 'dynamic'>('slate');

  // Seuil critique d'alerte Revenue Management (80% tension ou forte demande)
  const CRITICAL_THRESHOLD = 80;

  // Identification de l'ensemble des dates critiques sous tension maximale sur les 3 mois affichés
  const criticalDaysInView = useMemo(() => {
    const combined = [...monthData1.days, ...monthData2.days, ...monthData3.days];
    return combined.filter((d) => d.intensity >= CRITICAL_THRESHOLD || d.demandLevel === 'forte');
  }, [monthData1, monthData2, monthData3]);

  // Données structurées pour la courbe d'évolution et les barres Recharts
  const chartData = useMemo(() => {
    let daysToInclude: DayMarketInfo[] = [];
    if (chartScope === 'month1') {
      daysToInclude = monthData1.days;
    } else if (chartScope === 'month2') {
      daysToInclude = monthData2.days;
    } else if (chartScope === 'month3') {
      daysToInclude = monthData3.days;
    } else {
      daysToInclude = [...monthData1.days, ...monthData2.days, ...monthData3.days];
    }

    const basePrice = currentHotel?.baseADR || 240;

    return daysToInclude.map((d) => {
      const dObj = new Date(d.dateStr);
      const dayOfWeek = dObj.getDay(); // 0 = Dimanche, 6 = Samedi
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const formattedAxisLabel = `${dObj.getDate()} ${dObj.toLocaleDateString('fr-FR', {
        month: 'short',
      })} ${dObj.getFullYear()}`;

      const shortMonth = dObj.toLocaleDateString('fr-FR', { month: 'short' });

      const adrMultiplier = 0.65 + (d.intensity / 100) * 1.35;
      const estimatedADR = Math.round(basePrice * adrMultiplier);

      return {
        dateStr: d.dateStr,
        dayNumber: d.dayNumber,
        axisLabel: formattedAxisLabel,
        shortLabel: chartScope === 'all3' ? `${d.dayNumber} ${shortMonth}` : `${d.dayNumber}`,
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
  }, [chartScope, monthData1, monthData2, monthData3, currentHotel, CRITICAL_THRESHOLD]);

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

  // Génération du rapport consolidé PDF de la demande pour la période sélectionnée
  const handleExportPDF = () => {
    try {
      setIsExportingPDF(true);

      // Sélection des données selon le scope actif (Mois 1, 2, 3 ou Combiné 3 Mois)
      let daysToExport: DayMarketInfo[] = [];
      let statsToExport = {
        forteCount: totalForte,
        moyenneCount: totalMoyenne,
        faibleCount: totalFaible,
        avgOccupancy: combinedAvgTO,
      };
      let periodLabel = `${monthData1.monthName}, ${monthData2.monthName} & ${monthData3.monthName}`;

      if (chartScope === 'month1') {
        daysToExport = monthData1.days;
        statsToExport = monthData1.stats;
        periodLabel = monthData1.monthName;
      } else if (chartScope === 'month2') {
        daysToExport = monthData2.days;
        statsToExport = monthData2.stats;
        periodLabel = monthData2.monthName;
      } else if (chartScope === 'month3') {
        daysToExport = monthData3.days;
        statsToExport = monthData3.stats;
        periodLabel = monthData3.monthName;
      } else {
        daysToExport = [...monthData1.days, ...monthData2.days, ...monthData3.days];
      }

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

  // Rendu unifié, compact et responsive d'une colonne de mois (pour affichage de 3 mois consécutifs)
  const renderMonthColumn = (
    monthData: typeof monthData1,
    colIndex: number
  ) => {
    const isCurrentActiveMonth = monthData.year === currentYear && monthData.month === currentMonth;

    return (
      <div
        key={`month-col-${monthData.year}-${monthData.month}`}
        className="flex flex-col bg-slate-50/60 p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs"
      >
        {/* Entête de colonne du mois */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-900 capitalize tracking-tight flex items-center gap-1.5">
              <span>{monthData.monthName}</span>
              {isCurrentActiveMonth && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200 uppercase tracking-wider">
                  Actuel
                </span>
              )}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <span className="text-rose-600 font-extrabold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              {monthData.stats.forteCount} j.
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-violet-700 font-extrabold">{monthData.stats.avgOccupancy}% TO</span>
          </div>
        </div>

        {/* Jours de la semaine : l m m j v s d */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center mb-1.5">
          {weekdays.map((w, idx) => (
            <div
              key={idx}
              className="text-xs font-black text-slate-400 uppercase tracking-wider py-0.5"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Grille des journées compactes */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {/* Espaces vides initiaux */}
          {Array.from({ length: monthData.leadingEmptyDays }).map((_, i) => (
            <div key={`empty-${colIndex}-${i}`} className="h-9 sm:h-10 md:h-11" />
          ))}

          {/* Cases des jours */}
          {monthData.days.map((dayInfo) => {
            const isSelected = selectedDateInfo?.dateStr === dayInfo.dateStr;
            const matchesFilter = isDayVisibleInFilter(dayInfo.demandLevel);
            const isCritical =
              dayInfo.intensity >= CRITICAL_THRESHOLD || dayInfo.demandLevel === 'forte';

            const isPast = dayInfo.dateStr < todayStr;
            const isToday = dayInfo.dateStr === todayStr;

            // Dimensions réduites et compactes pour un affichage parfait des 3 mois
            let cellClasses =
              'h-9 sm:h-10 md:h-11 rounded-lg sm:rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer font-bold select-none text-xs sm:text-sm ';

            if (!matchesFilter) {
              cellClasses += 'opacity-25 grayscale scale-95 ';
            }

            if (isPast) {
              // Journée passée : gris clair atténué, information conservée, pleinement interactive
              cellClasses +=
                'bg-slate-100 text-slate-500 border border-slate-200/80 hover:bg-slate-200/80 hover:text-slate-900 hover:scale-105 active:scale-95 ';
            } else if (dayInfo.demandLevel === 'forte') {
              // Forte tension : Rose/Corail #fb7185
              cellClasses +=
                'bg-[#fb7185] text-slate-900 shadow-2xs hover:brightness-95 hover:scale-105 active:scale-95 ';
            } else if (dayInfo.demandLevel === 'moyenne') {
              // Moyenne tension : Orange #fbb664
              cellClasses +=
                'bg-[#fbb664] text-slate-900 shadow-2xs hover:brightness-95 hover:scale-105 active:scale-95 ';
            } else {
              // Faible tension : Vert d'eau #6ee7b7
              cellClasses +=
                'bg-[#6ee7b7] text-slate-900 shadow-2xs hover:brightness-95 hover:scale-105 active:scale-95 ';
            }

            if (isToday) {
              // Mise en avant forte et indiscutable de la date du jour (Aujourd'hui)
              cellClasses +=
                ' ring-2 ring-violet-600 ring-offset-2 z-10 font-black shadow-md scale-102';
            } else if (isSelected) {
              cellClasses += ' ring-2 ring-slate-900 ring-offset-2 z-10';
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
                <span className="leading-none">{dayInfo.dayNumber}</span>

                {/* Badge visuel "Auj." marquant la date du jour */}
                {isToday && (
                  <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-wider bg-violet-600 text-white px-1 py-0.2 rounded-full shadow-2xs whitespace-nowrap leading-tight">
                    Auj.
                  </span>
                )}

                {/* Témoin discret de tension sur les journées passées pour conserver l'information */}
                {isPast && (
                  <span
                    className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                      dayInfo.demandLevel === 'forte'
                        ? 'bg-rose-400/80'
                        : dayInfo.demandLevel === 'moyenne'
                        ? 'bg-amber-400/80'
                        : 'bg-emerald-400/70'
                    }`}
                    title={`Journée passée — Tension historique : ${dayInfo.demandLevel}`}
                  />
                )}

                {/* Pastille clignotante de seuil critique (Aujourd'hui & Futur) */}
                {!isPast && isCritical && (
                  <span
                    className="absolute -top-1 -right-1 flex h-2.5 w-2.5 z-20 pointer-events-none"
                    title={`Alerte seuil critique : tension ${dayInfo.intensity}%`}
                  >
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600 border border-white items-center justify-center shadow-2xs">
                      <span className="w-1 h-1 rounded-full bg-white" />
                    </span>
                  </span>
                )}

                {/* Point d'événement identifié (Aujourd'hui & Futur) */}
                {!isPast && dayInfo.eventCount > 0 && (
                  <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-slate-900/60" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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

      {/* Sub-Navigation Tabs in Analyse de Marché */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveMarketSubTab('calendar')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeMarketSubTab === 'calendar'
                ? 'bg-violet-600 text-white shadow-2xs font-extrabold'
                : 'hover:bg-slate-100 hover:text-slate-900 text-slate-700 bg-slate-50 border border-slate-200/60'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Calendrier de Tension & Demande Marché</span>
          </button>

          <button
            onClick={() => setActiveMarketSubTab('school_holidays')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeMarketSubTab === 'school_holidays'
                ? 'bg-violet-600 text-white shadow-2xs font-extrabold'
                : 'hover:bg-slate-100 hover:text-slate-900 text-slate-700 bg-slate-50 border border-slate-200/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Impact Historique Vacances Scolaires & Segments</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                activeMarketSubTab === 'school_holidays'
                  ? 'bg-white/20 text-white'
                  : 'bg-violet-100 text-violet-800'
              }`}
            >
              Nouveau
            </span>
          </button>

          <button
            onClick={() => setActiveMarketSubTab('lighthouse')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeMarketSubTab === 'lighthouse'
                ? 'bg-violet-600 text-white shadow-2xs font-extrabold'
                : 'hover:bg-slate-100 hover:text-slate-900 text-slate-700 bg-slate-50 border border-slate-200/60'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Veille Concurrentielle Lighthouse</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                activeMarketSubTab === 'lighthouse'
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              5 Onglets
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 self-end sm:self-auto">
          <Building2 className="w-3.5 h-3.5 text-violet-600" />
          <span>{currentHotel.name}</span>
        </div>
      </div>

      {activeMarketSubTab === 'lighthouse' ? (
        <LighthouseCompetitiveIntelligenceView
          hotel={currentHotel}
          onShowToast={onShowToast}
        />
      ) : activeMarketSubTab === 'school_holidays' ? (
        <SchoolHolidaysImpactView
          hotel={currentHotel}
          onShowToast={onShowToast}
        />
      ) : (
        <>
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
                onClick={() => handleSetYear(currentYear)}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  currentYear === 2026
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {currentYear}
              </button>
              <button
                onClick={() => handleSetYear(currentYear + 1)}
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
              Moyenne estimée sur les 3 mois consécutifs
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

          {/* Quick jump to Today (Nov 2026 - Jan 2027) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetToToday}
              className="text-xs font-semibold text-violet-700 hover:text-violet-900 hover:underline cursor-pointer flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Aujourd'hui (Nov. 2026 - Janv. 2027)</span>
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
              Visualisation continue de la pression du marché jour par jour sur les 3 mois pour identifier immédiatement les pics de tension et ajuster le Yield.
            </p>
          </div>

          {/* Controls: Scope Switcher, View Mode, Bar Coloring, Metric Toggle & PDF Export */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Scope Toggle: Mois 1, Mois 2, Mois 3, 3 Mois */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setChartScope('month1')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer capitalize ${
                  chartScope === 'month1'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {monthData1.monthName.split(' ')[0]}
              </button>
              <button
                onClick={() => setChartScope('month2')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer capitalize ${
                  chartScope === 'month2'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {monthData2.monthName.split(' ')[0]}
              </button>
              <button
                onClick={() => setChartScope('month3')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer capitalize ${
                  chartScope === 'month3'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {monthData3.monthName.split(' ')[0]}
              </button>
              <button
                onClick={() => setChartScope('all3')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  chartScope === 'all3'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                3 Mois
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

      {/* Main Multi-Month Calendar Surface: 3 Consecutive Months */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-6 lg:p-7 space-y-6 w-full">
        {/* Navigation Bar with Controls and 3 Month Headers */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              onClick={handlePrevQuarter}
              title="Reculer de 3 mois"
              className="px-2.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer text-xs font-bold border border-slate-200/70 flex items-center gap-1"
            >
              <span>-3 m.</span>
            </button>
            <button
              onClick={handlePrev}
              aria-label="Mois précédent"
              title="Reculer d'un mois"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer border border-slate-200/70"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          <div className="flex-1 flex flex-wrap items-center justify-center gap-2 sm:gap-4 md:gap-6 text-center">
            <div className="flex items-center gap-1.5 text-base sm:text-lg font-black text-slate-900 capitalize tracking-tight">
              <span className="text-violet-900">{monthData1.monthName}</span>
              <span className="text-slate-300">/</span>
              <span>{monthData2.monthName}</span>
              <span className="text-slate-300">/</span>
              <span>{monthData3.monthName}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={handleResetToToday}
              className="px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 hover:text-violet-900 border border-violet-200 text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Revenir instantanément au mois courant"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Aujourd'hui</span>
            </button>
            <button
              onClick={handleNext}
              aria-label="Mois suivant"
              title="Avancer d'un mois"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer border border-slate-200/70"
            >
              <ChevronRight className="w-5 h-5 stroke-[2.5]" />
            </button>
            <button
              onClick={handleNextQuarter}
              title="Avancer de 3 mois"
              className="px-2.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer text-xs font-bold border border-slate-200/70 flex items-center gap-1"
            >
              <span>+3 m.</span>
            </button>
          </div>
        </div>

        {/* 3 Month Grids Side-by-Side with smooth slide & fade animation */}
        <div
          key={calendarKey}
          className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6 w-full ${animationClass}`}
        >
          {renderMonthColumn(monthData1, 0)}
          {renderMonthColumn(monthData2, 1)}
          {renderMonthColumn(monthData3, 2)}
        </div>

        {/* Legend bar at the bottom matching user specifications */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-5 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-[#fb7185] border border-rose-300 inline-block shadow-2xs" />
            <span className="font-bold text-slate-800">Rouge :</span>
            <span>Forte demande (Tension max)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-[#fbb664] border border-amber-300 inline-block shadow-2xs" />
            <span className="font-bold text-slate-800">Orange :</span>
            <span>Demande moyenne (Soutenu)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-[#6ee7b7] border border-emerald-300 inline-block shadow-2xs" />
            <span className="font-bold text-slate-800">Vert :</span>
            <span>Faible demande (Calme)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-slate-100 border border-slate-300 inline-flex items-center justify-center text-[9px] text-slate-500 font-bold">
              •
            </span>
            <span className="font-bold text-slate-800">Gris clair :</span>
            <span>Journées passées (Historique / Réalisé)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-white border-2 border-violet-600 ring-1 ring-violet-400 inline-block shadow-2xs" />
            <span className="font-bold text-violet-800">Contour violet :</span>
            <span>Date du jour (Aujourd'hui)</span>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Floating Enriched Hover Tooltip */}
      {hoveredDay && !selectedDateInfo && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${Math.max(170, Math.min(typeof window !== 'undefined' ? window.innerWidth - 170 : 800, hoveredDay.x))}px`,
            top: `${Math.max(220, hoveredDay.y - 12)}px`,
          }}
        >
          {(() => {
            const d = hoveredDay.info;
            const isPast = d.dateStr < todayStr;
            const isToday = d.dateStr === todayStr;
            const basePrice = currentHotel?.baseADR || 240;
            const adrMultiplier = 0.65 + (d.intensity / 100) * 1.35;
            const estimatedADR = Math.round(basePrice * adrMultiplier);
            const compsetADR = Math.round(estimatedADR * 1.06);

            return (
              <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl p-4 w-76 sm:w-80 border border-slate-700/80 animate-in fade-in zoom-in-95 duration-100 text-xs">
                {/* Header: Date lisible & Badges */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <div>
                    <div className="font-black text-sm capitalize text-slate-100">
                      {new Date(d.dateStr).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isToday ? (
                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded-sm bg-violet-600 text-white uppercase tracking-wider">
                          Aujourd'hui
                        </span>
                      ) : isPast ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-slate-700 text-slate-300 uppercase tracking-wider">
                          Journée passée (Réalisé)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-emerald-950/80 text-emerald-300 border border-emerald-800 uppercase tracking-wider">
                          Prévisionnel
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                      d.demandLevel === 'forte'
                        ? 'bg-rose-500 text-white shadow-xs'
                        : d.demandLevel === 'moyenne'
                        ? 'bg-amber-400 text-slate-900 font-black'
                        : 'bg-emerald-400 text-slate-900 font-black'
                    }`}
                  >
                    Demande {d.demandLevel}
                  </span>
                </div>

                {/* Key indicators: Tension gauge & TO */}
                <div className="space-y-2 text-slate-300">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400">Niveau de tension marché :</span>
                      <span className="font-extrabold text-white tabular-nums">{d.intensity}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          d.demandLevel === 'forte'
                            ? 'bg-rose-400'
                            : d.demandLevel === 'moyenne'
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${d.intensity}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60">
                      <div className="text-[10px] text-slate-400">TO Projeté</div>
                      <div className="text-sm font-extrabold text-violet-300 tabular-nums">
                        {d.projectedOccupancy}%
                      </div>
                    </div>
                    <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60">
                      <div className="text-[10px] text-slate-400">ADR Suggéré</div>
                      <div className="text-sm font-extrabold text-emerald-400 tabular-nums">
                        {estimatedADR} €
                        <span className="text-[9px] text-slate-400 ml-1 font-normal">
                          (vs CompSet {compsetADR}€)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Identified events */}
                  <div className="pt-1.5 border-t border-slate-800">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-400 flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3 text-violet-400" />
                        Événements identifiés :
                      </span>
                      <span className="font-extrabold text-white tabular-nums">
                        {d.eventCount}
                      </span>
                    </div>
                    {d.topEventsTitles.length > 0 ? (
                      <div className="space-y-0.5">
                        {d.topEventsTitles.slice(0, 2).map((t, idx) => (
                          <div key={idx} className="text-[11px] text-slate-200 truncate flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                            <span className="truncate">{t}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic">
                        Demande organique usuelle
                      </div>
                    )}
                  </div>

                  {/* RM Recommendation */}
                  <div className="pt-1.5 border-t border-slate-800 text-[11px]">
                    <div className="text-violet-400 font-extrabold flex items-center gap-1 mb-0.5">
                      <Sparkles className="w-3 h-3" />
                      Recommandation RM :
                    </div>
                    <div className="text-slate-200 leading-tight">
                      {d.adrAdvice} · {d.minStayAdvice}
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1 italic">
                  <ArrowUpRight className="w-3 h-3" />
                  <span>Cliquer pour ouvrir le diagnostic complet</span>
                </div>
              </div>
            );
          })()}
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
                    <span>Capacité {currentHotel.roomCount ?? '—'} ch.</span>
                    <span className="text-slate-300">·</span>
                    <span>Base ADR {currentHotel.baseADR === null ? 'Non renseigné' : `${currentHotel.baseADR}€`}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  disabled
                  title="Action non disponible : le flux de validation et de publication Yield n'est pas raccordé."
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Règle Yield non connectée
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
                        {selectedDateInfo.projectedOccupancy}% ({currentHotel.roomCount === null ? '—' : `${Math.round((selectedDateInfo.projectedOccupancy / 100) * currentHotel.roomCount)} ch.`})
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
