import React from 'react';
import {
  Shirt,
  Store,
  Music,
  Trophy,
  Palette,
  Gamepad2,
  Sparkles,
  Stethoscope,
  Briefcase,
  CalendarDays,
  Plus,
  FileText,
  GraduationCap,
} from 'lucide-react';
import { EventItem, EventCategory, RMImpactLevel } from '../../types';
import { getRMScoreColorClasses } from '../../utils/helpers';
import {
  CURRENT_REFERENCE_DATE,
  getEffectiveEndDate,
  isEventOngoing,
  sortEventsChronologically,
  getMonthTemporalRelation,
} from '../../utils/eventFilterUtils';

interface CalendarViewProps {
  events: EventItem[];
  currentYear: number;
  currentMonth: number; // 0-11
  onSelectEvent: (event: EventItem) => void;
  onAddEventOnDate: (dateStr: string) => void;
  onExportPDF?: () => void;
  onSelectDate?: (dateStr: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  currentYear,
  currentMonth,
  onSelectEvent,
  onAddEventOnDate,
  onExportPDF,
  onSelectDate,
}) => {
  // Days of the week in French (starting Monday)
  const WEEKDAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

  // Days in current month
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const totalDays = lastDayOfMonth.getDate();

  // Day of week for 1st day (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  // Convert so Monday = 0, Sunday = 6
  let firstDayIndex = firstDayOfMonth.getDay() - 1;
  if (firstDayIndex === -1) firstDayIndex = 6;

  // Build grid matrix: cells before 1st of month + days + trailing cells
  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push({ dayNumber: null, dateStr: null, isCurrentMonth: false });
  }
  for (let d = 1; d <= totalDays; d++) {
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const dayStr = String(d).padStart(2, '0');
    calendarCells.push({
      dayNumber: d,
      dateStr: `${currentYear}-${monthStr}-${dayStr}`,
      isCurrentMonth: true,
    });
  }
  // Fill remaining cells to complete last week row
  while (calendarCells.length % 7 !== 0) {
    calendarCells.push({ dayNumber: null, dateStr: null, isCurrentMonth: false });
  }

  // Helper to get events active on a specific date, strictly sorted (En cours d'abord, puis par date/score)
  const getEventsForDate = (dateStr: string | null) => {
    if (!dateStr) return [];
    const matching = events.filter((e) => {
      const effectiveEnd = getEffectiveEndDate(e);
      return dateStr >= e.startDate && dateStr <= effectiveEnd;
    });
    return sortEventsChronologically(matching, CURRENT_REFERENCE_DATE, false);
  };

  // Icon helper based on category
  const renderCategoryIcon = (category: EventCategory, title: string) => {
    const t = title.toLowerCase();
    if (category === 'mode_luxe' || t.includes('mode')) return <Shirt className="w-3 h-3 shrink-0" />;
    if (category === 'concerts_spectacles' || t.includes('dion') || t.includes('concert'))
      return <Music className="w-3 h-3 shrink-0" />;
    if (category === 'sport' || t.includes('ligue') || t.includes('masters') || t.includes('nfl'))
      return <Trophy className="w-3 h-3 shrink-0" />;
    if (category === 'salons_foires' || t.includes('mondial') || t.includes('sial') || t.includes('bâtiment'))
      return <Store className="w-3 h-3 shrink-0" />;
    if (category === 'festivals' || t.includes('games'))
      return <Gamepad2 className="w-3 h-3 shrink-0" />;
    if (category === 'culturel' || t.includes('art') || t.includes('nuit blanche'))
      return <Palette className="w-3 h-3 shrink-0" />;
    if (category === 'congres_medical') return <Stethoscope className="w-3 h-3 shrink-0" />;
    if (category === 'corporate_sommet') return <Briefcase className="w-3 h-3 shrink-0" />;
    if (category === 'vacances_scolaires') return <GraduationCap className="w-3 h-3 shrink-0 text-indigo-600 dark:text-indigo-400" />;
    if (category === 'periodes_saisonnieres_fetes') return <CalendarDays className="w-3 h-3 shrink-0 text-rose-600 dark:text-rose-400" />;
    return <Sparkles className="w-3 h-3 shrink-0" />;
  };

  // Color helper based on impact matching the user screenshot
  const getChipStyle = (impact: RMImpactLevel, title: string, category?: EventCategory) => {
    const t = title.toLowerCase();

    // Specific styling for vacances scolaires
    if (category === 'vacances_scolaires' || t.includes('vacances') || t.includes('half-term') || t.includes('spring break')) {
      return 'text-indigo-800 dark:text-indigo-300 bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/90 dark:border-indigo-800/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-semibold';
    }

    // Specific styling for seasonal & holiday periods
    if (category === 'periodes_saisonnieres_fetes') {
      return 'text-rose-800 dark:text-rose-300 bg-amber-50/95 dark:bg-rose-950/45 border border-rose-200/90 dark:border-rose-800/70 hover:bg-rose-50 dark:hover:bg-rose-900/55 font-semibold';
    }

    // Specific styling matching screenshot:
    // Red/Rose for Mondial de l'Auto, SIAL, Rolex Paris Masters (highest yield pressure)
    if (impact === 'hyper' || t.includes('auto') || t.includes('sial')) {
      return 'text-rose-600 dark:text-rose-300 bg-rose-50/90 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-800/70 hover:bg-rose-100/90 dark:hover:bg-rose-900/60 font-medium';
    }
    // Orange/Amber for Mode Féminine, Céline Dion, Art Basel, NFL
    if (impact === 'critique' || t.includes('mode') || t.includes('ligue') || t.includes('art basel') || t.includes('nfl')) {
      return 'text-amber-700 dark:text-amber-300 bg-amber-50/90 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/70 hover:bg-amber-100/90 dark:hover:bg-amber-900/60 font-medium';
    }
    // Rolex Paris Masters special prominent styling on Oct 31
    if (t.includes('rolex') || t.includes('masters')) {
      return 'text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/45 border border-purple-300 dark:border-purple-700/70 hover:bg-purple-200 dark:hover:bg-purple-800/60 font-bold';
    }
    // Moderate / neutral
    return 'text-amber-800/90 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/70 hover:bg-amber-100/70 dark:hover:bg-amber-900/50 font-medium';
  };

  // Get max impact dot for a cell
  const getCellImpactDot = (dayEvents: EventItem[]) => {
    if (dayEvents.some((e) => e.impactLevel === 'hyper')) return 'bg-rose-500';
    if (dayEvents.some((e) => e.impactLevel === 'critique')) return 'bg-amber-500';
    if (dayEvents.some((e) => e.impactLevel === 'modere')) return 'bg-amber-400';
    if (dayEvents.length > 0) return 'bg-slate-300';
    return null;
  };

  // Today is 2026-11-12 (CURRENT_REFERENCE_DATE)
  const isSimulationToday = (dateStr: string | null) => dateStr === CURRENT_REFERENCE_DATE;
  const monthTemporal = getMonthTemporalRelation(currentYear, currentMonth, CURRENT_REFERENCE_DATE);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
      {/* Calendar Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/50">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-violet-600" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Vue Calendrier Mensuel
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            <strong className="text-slate-900 dark:text-slate-100 font-bold">{events.length}</strong> événement{events.length > 1 ? 's' : ''} {monthTemporal === 'current' ? 'en cours et à venir' : 'sur la période'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 bg-white dark:bg-slate-900 hover:bg-violet-50 dark:hover:bg-violet-950/50 border border-violet-200 dark:border-violet-800/70 hover:border-violet-300 dark:hover:border-violet-600/70 rounded-xl transition-all shadow-2xs cursor-pointer"
              title="Exporter le planning et les événements du calendrier au format PDF"
            >
              <FileText className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              <span>Exporter en PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Calendar Weekday Headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-center">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-3 text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase border-r last:border-r-0 border-slate-200/60 dark:border-slate-800/70"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Day Cells Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-slate-200/80 dark:divide-slate-800/70">
        {calendarCells.map((cell, index) => {
          if (!cell.isCurrentMonth || !cell.dateStr) {
            return (
              <div
                key={`empty-${index}`}
                className="min-h-[140px] bg-slate-50/40 dark:bg-slate-800/40 p-2 text-slate-300"
              />
            );
          }

          const dayEvents = getEventsForDate(cell.dateStr);
          const impactDot = getCellImpactDot(dayEvents);
          const isToday = isSimulationToday(cell.dateStr);
          const isPastDay = cell.dateStr < CURRENT_REFERENCE_DATE;

          // Highlight today, subtly attenuate past days, tint major upcoming event cells
          const hasBigEvent = dayEvents.some((e) => e.impactLevel === 'hyper' || e.impactLevel === 'critique');
          const cellBg = isToday
            ? 'bg-purple-50/50 dark:bg-purple-950/35 ring-2 ring-inset ring-violet-400 dark:ring-violet-500'
            : isPastDay
            ? 'bg-slate-50/70 dark:bg-slate-800/40 opacity-75'
            : hasBigEvent
            ? 'bg-[#fffdf9] dark:bg-amber-950/20'
            : 'bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/60';

          return (
            <div
              key={cell.dateStr}
              className={`min-h-[140px] p-2 flex flex-col justify-between group transition-colors relative ${cellBg}`}
            >
              {/* Top Row: Day Number + Impact dot */}
              <div className="flex items-center justify-between mb-1.5">
                <button
                  type="button"
                  onClick={() => cell.dateStr && onSelectDate?.(cell.dateStr)}
                  className="flex items-center gap-1.5 group/btn text-left cursor-pointer"
                  title="Examiner la demande, signaux marché et recommandations RM pour cette date"
                >
                  {isToday ? (
                    <div className="flex items-center gap-1">
                      <span className="w-6 h-6 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        {cell.dayNumber}
                      </span>
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 rounded">
                        Aujourd&apos;hui
                      </span>
                    </div>
                  ) : (
                    <span className={`text-xs font-semibold transition-colors tabular-nums ${
                      isPastDay ? 'text-slate-400 group-hover/btn:text-slate-600' : 'text-slate-700 dark:text-slate-300 group-hover/btn:text-violet-600'
                    }`}>
                      {cell.dayNumber}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-1.5">
                  {/* Subtle Add event hover trigger */}
                  <button
                    onClick={() => onAddEventOnDate(cell.dateStr!)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/50 rounded transition-all"
                    title={`Ajouter un événement le ${cell.dayNumber}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>

                  {/* Impact Dot matching screenshot */}
                  {impactDot && (
                    <span className={`w-2 h-2 rounded-full ${impactDot} shrink-0`} />
                  )}
                </div>
              </div>

            {/* Event Stack Inside Day */}
            <div className="space-y-1 overflow-y-auto max-h-[115px] pr-0.5">
              {dayEvents.map((ev) => {
                const chipStyle = getChipStyle(ev.impactLevel, ev.title, ev.category);
                const score = ev.scoreBreakdown.finalRMScore;
                const scoreColors = getRMScoreColorClasses(score);
                const ongoing = isEventOngoing(ev, CURRENT_REFERENCE_DATE);

                return (
                  <button
                    key={`${ev.id}-${cell.dateStr}`}
                    onClick={() => onSelectEvent(ev)}
                    className={`w-full text-left px-2 py-1 rounded-md text-[11px] leading-tight flex items-center justify-between gap-1.5 transition-all truncate shadow-2xs cursor-pointer ${chipStyle}`}
                    title={`${ongoing ? '[EN COURS] ' : ''}${ev.title} — ${ev.venueName} (Score RM: ${score}/100)`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {ongoing ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" title="En cours" />
                      ) : (
                        renderCategoryIcon(ev.category, ev.title)
                      )}
                      <span className="truncate">{ev.title}</span>
                    </div>
                      <span
                        className={`shrink-0 px-1 py-0.2 rounded text-[9px] font-bold tabular-nums border ${scoreColors.badge}`}
                      >
                        {score}
                      </span>
                    </button>
                  );
                })}

                {dayEvents.length === 0 && (
                  <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onAddEventOnDate(cell.dateStr!)}
                      className="text-[10px] text-slate-400 hover:text-violet-600 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Ajouter</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
