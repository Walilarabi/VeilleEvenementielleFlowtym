import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { EventItem, Hotel } from '../../types';
import {
  DayMarketInfo,
  MarketDemandLevel,
  getMonthMarketGrid,
  formatDateKey,
} from '../../utils/marketDemand';

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

  // Selected date for deep inspection
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

  // Compute month grids
  const monthDataLeft = useMemo(() => {
    return getMonthMarketGrid(currentYear, currentMonth, events, currentHotel);
  }, [currentYear, currentMonth, events, currentHotel]);

  // Compute second month (right)
  const monthDataRight = useMemo(() => {
    const nextMonthIndex = (currentMonth + 1) % 12;
    const nextYear = currentMonth + 1 > 11 ? currentYear + 1 : currentYear;
    return getMonthMarketGrid(nextYear, nextMonthIndex, events, currentHotel);
  }, [currentYear, currentMonth, events, currentHotel]);

  // Compute third month for quarter view if active
  const monthDataThird = useMemo(() => {
    const thirdMonthIndex = (currentMonth + 2) % 12;
    const thirdYear = currentMonth + 2 > 11 ? currentYear + 1 : currentYear;
    return getMonthMarketGrid(thirdYear, thirdMonthIndex, events, currentHotel);
  }, [currentYear, currentMonth, events, currentHotel]);

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

  // Check if a day passes the current filter
  const isDayVisibleInFilter = (level: MarketDemandLevel) => {
    if (demandFilter === 'all') return true;
    return demandFilter === level;
  };

  // Render weekday labels (French initials matching screenshot: l m m j v s d)
  const weekdays = ['l', 'm', 'm', 'j', 'v', 's', 'd'];

  return (
    <div className="space-y-6 pb-16">
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

          {/* Quick controls: Hotel selector + Year toggle */}
          <div className="flex flex-wrap items-center gap-3">
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
          </div>
        </div>

        {/* 4 Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mt-5 pt-5 border-t border-slate-100">
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

                // Determine coloring based on demand level and screenshot appearance
                let cellClasses = 'aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer font-bold select-none text-base lg:text-lg ';

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
                  cellClasses += 'bg-[#fb7185] text-slate-900 shadow-xs hover:brightness-95 hover:scale-105 active:scale-95';
                } else if (dayInfo.demandLevel === 'moyenne') {
                  // Orange/Amber matching screenshot #fbb664
                  cellClasses += 'bg-[#fbb664] text-slate-900 shadow-xs hover:brightness-95 hover:scale-105 active:scale-95';
                } else {
                  // Mint/Green matching screenshot #6ee7b7
                  cellClasses += 'bg-[#6ee7b7] text-slate-900 shadow-xs hover:brightness-95 hover:scale-105 active:scale-95';
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

                let cellClasses = 'aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer font-bold select-none text-base lg:text-lg ';

                if (!matchesFilter) {
                  cellClasses += 'opacity-25 grayscale scale-95 ';
                }

                if (dayInfo.demandLevel === 'forte') {
                  // Coral/Pink Red matching screenshot #fb7185
                  cellClasses += 'bg-[#fb7185] text-slate-900 shadow-xs hover:brightness-95 hover:scale-105 active:scale-95';
                } else if (dayInfo.demandLevel === 'moyenne') {
                  // Orange/Amber matching screenshot #fbb664
                  cellClasses += 'bg-[#fbb664] text-slate-900 shadow-xs hover:brightness-95 hover:scale-105 active:scale-95';
                } else {
                  // Mint/Green matching screenshot #6ee7b7
                  cellClasses += 'bg-[#6ee7b7] text-slate-900 shadow-xs hover:brightness-95 hover:scale-105 active:scale-95';
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

      {/* Selected Date Inspector Panel (Slide-in / Expandable Deep Dive) */}
      {selectedDateInfo && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 lg:p-8 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-100 gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black shadow-xs shrink-0 ${
                  selectedDateInfo.demandLevel === 'forte'
                    ? 'bg-[#fb7185] text-slate-900'
                    : selectedDateInfo.demandLevel === 'moyenne'
                    ? 'bg-[#fbb664] text-slate-900'
                    : 'bg-[#6ee7b7] text-slate-900'
                }`}
              >
                <span className="text-2xl leading-none">{selectedDateInfo.dayNumber}</span>
                <span className="text-[10px] uppercase font-bold tracking-tight">
                  {new Date(selectedDateInfo.dateStr).toLocaleDateString('fr-FR', {
                    month: 'short',
                  })}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-extrabold text-slate-900">
                    {new Date(selectedDateInfo.dateStr).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h3>
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
                <p className="text-xs text-slate-500 mt-0.5">
                  Analyse d'impact pour l'établissement <strong>{currentHotel.name}</strong> (Capacité : {currentHotel.roomCount} chambres · Base ADR {currentHotel.baseADR}€).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto">
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
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 3 Columns Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {/* Col 1: Pression & TO Prévisionnel */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
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

              <div className="pt-2 border-t border-slate-200/60 space-y-2">
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
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
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

              <div className="text-xs text-slate-600 leading-relaxed bg-white rounded-xl p-3 border border-slate-200/60">
                <div className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-violet-600" />
                  Consigne Revenue Management :
                </div>
                {selectedDateInfo.yieldStrategy}
              </div>
            </div>

            {/* Col 3: Événements moteurs ce jour */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="w-4 h-4 text-violet-600" />
                  Salons & Événements ({selectedDateInfo.eventCount})
                </span>
                <span className="text-[10px] text-slate-400">Cliquez pour ouvrir</span>
              </div>

              {selectedDateInfo.activeEvents.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center text-center p-3 text-slate-400 text-xs">
                  <Info className="w-6 h-6 mb-1 text-slate-300" />
                  Aucun grand salon majeur répertorié. Période calme ou demande purement organique.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedDateInfo.activeEvents.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => onSelectEvent(ev)}
                      className="bg-white p-2.5 rounded-xl border border-slate-200/70 hover:border-violet-300 hover:shadow-2xs transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-slate-900 truncate group-hover:text-violet-700">
                          {ev.title}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {ev.venueName} · {(ev.expectedAttendance || 0).toLocaleString('fr-FR')} pax
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
      )}
    </div>
  );
};
