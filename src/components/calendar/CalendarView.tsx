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

  // Helper to get events active on a specific date
  const getEventsForDate = (dateStr: string | null) => {
    if (!dateStr) return [];
    return events.filter((e) => {
      return dateStr >= e.startDate && dateStr <= e.endDate;
    });
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
    if (category === 'vacances_scolaires') return <GraduationCap className="w-3 h-3 shrink-0 text-indigo-600" />;
    return <Sparkles className="w-3 h-3 shrink-0" />;
  };

  // Color helper based on impact matching the user screenshot
  const getChipStyle = (impact: RMImpactLevel, title: string, category?: EventCategory) => {
    const t = title.toLowerCase();

    // Specific styling for vacances scolaires
    if (category === 'vacances_scolaires' || t.includes('vacances') || t.includes('half-term') || t.includes('spring break')) {
      return 'text-indigo-800 bg-indigo-50/90 border border-indigo-200/90 hover:bg-indigo-100 font-semibold';
    }

    // Specific styling matching screenshot:
    // Red/Rose for Mondial de l'Auto, SIAL, Rolex Paris Masters (highest yield pressure)
    if (impact === 'hyper' || t.includes('auto') || t.includes('sial')) {
      return 'text-rose-600 bg-rose-50/90 border border-rose-200/80 hover:bg-rose-100/90 font-medium';
    }
    // Orange/Amber for Mode Féminine, Céline Dion, Art Basel, NFL
    if (impact === 'critique' || t.includes('mode') || t.includes('ligue') || t.includes('art basel') || t.includes('nfl')) {
      return 'text-amber-700 bg-amber-50/90 border border-amber-200/80 hover:bg-amber-100/90 font-medium';
    }
    // Rolex Paris Masters special prominent styling on Oct 31
    if (t.includes('rolex') || t.includes('masters')) {
      return 'text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 font-bold';
    }
    // Moderate / neutral
    return 'text-amber-800/90 bg-amber-50/60 border border-amber-200/60 hover:bg-amber-100/70 font-medium';
  };

  // Get max impact dot for a cell
  const getCellImpactDot = (dayEvents: EventItem[]) => {
    if (dayEvents.some((e) => e.impactLevel === 'hyper')) return 'bg-rose-500';
    if (dayEvents.some((e) => e.impactLevel === 'critique')) return 'bg-amber-500';
    if (dayEvents.some((e) => e.impactLevel === 'modere')) return 'bg-amber-400';
    if (dayEvents.length > 0) return 'bg-slate-300';
    return null;
  };

  // Today is simulated as Oct 31, 2026 (matching current time and screenshot highlight)
  const isSimulationToday = (dateStr: string | null) => dateStr === '2026-10-31';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
      {/* Calendar Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200/80 bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-violet-600" />
          <span className="text-xs font-bold text-slate-800">
            Vue Calendrier Mensuel
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-xs text-slate-600 font-medium">
            <strong className="text-slate-900 font-bold">{events.length}</strong> événement{events.length > 1 ? 's' : ''} sur la période
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-white hover:bg-violet-50 border border-violet-200 hover:border-violet-300 rounded-xl transition-all shadow-2xs cursor-pointer"
              title="Exporter le planning et les événements du calendrier au format PDF"
            >
              <FileText className="w-3.5 h-3.5 text-violet-600" />
              <span>Exporter en PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Calendar Weekday Headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70 text-center">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase border-r last:border-r-0 border-slate-200/60"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Day Cells Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-slate-200/80">
        {calendarCells.map((cell, index) => {
          if (!cell.isCurrentMonth || !cell.dateStr) {
            return (
              <div
                key={`empty-${index}`}
                className="min-h-[140px] bg-slate-50/40 p-2 text-slate-300"
              />
            );
          }

          const dayEvents = getEventsForDate(cell.dateStr);
          const impactDot = getCellImpactDot(dayEvents);
          const isToday = isSimulationToday(cell.dateStr);

          // In screenshot: cells with major multi-day events have a very subtle warm tinted background
          const hasBigEvent = dayEvents.some((e) => e.impactLevel === 'hyper' || e.impactLevel === 'critique');
          const cellBg = isToday
            ? 'bg-purple-50/40 ring-1 ring-inset ring-purple-300'
            : hasBigEvent
            ? 'bg-[#fffdf9]'
            : 'bg-white hover:bg-slate-50/50';

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
                  className="flex items-center gap-1 group/btn text-left cursor-pointer"
                  title="Examiner la demande, signaux marché et recommandations RM pour cette date"
                >
                  {isToday ? (
                    <span className="w-6 h-6 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      {cell.dayNumber}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-700 group-hover/btn:text-violet-600 transition-colors tabular-nums">
                      {cell.dayNumber}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-1.5">
                  {/* Subtle Add event hover trigger */}
                  <button
                    onClick={() => onAddEventOnDate(cell.dateStr!)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-all"
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
                const chipStyle = ev.scoreUnknown ? 'bg-slate-100 text-slate-700 border border-slate-200' : getChipStyle(ev.impactLevel, ev.title, ev.category);
                const score = ev.scoreBreakdown.finalRMScore;
                const scoreColors = getRMScoreColorClasses(score);

                return (
                  <button
                    key={`${ev.id}-${cell.dateStr}`}
                    onClick={() => onSelectEvent(ev)}
                    className={`w-full text-left px-2 py-1 rounded-md text-[11px] leading-tight flex items-center justify-between gap-1.5 transition-all truncate shadow-2xs ${chipStyle}`}
                    title={`${ev.title} — ${ev.venueName} (Score RM: ${ev.scoreUnknown ? "non calculé" : score+"/100"})`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {renderCategoryIcon(ev.category, ev.title)}
                      <span className="truncate">{ev.title}</span>
                    </div>
                      <span
                        className={`shrink-0 px-1 py-0.2 rounded text-[9px] font-bold tabular-nums border ${scoreColors.badge}`}
                      >
                        {ev.scoreUnknown ? '—' : score}
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
