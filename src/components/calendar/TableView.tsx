import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Repeat,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { EventItem, EventCategory, RMImpactLevel } from '../../types';
import { getRMScoreColorClasses } from '../../utils/helpers';
import {
  getTodayIsoDate,
  sortEventsChronologically,
  getEventStatusBadgeConfig,
  getEventChronologicalStatus,
} from '../../utils/eventFilterUtils';

interface TableViewProps {
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  onToggleFavorite?: (eventId: string) => void;
  onExportPDF?: () => void;
  currentYear?: number;
  currentMonth?: number;
  filterKey?: string;
}

type SortColumn = 'title' | 'type' | 'dates' | 'location' | 'impact' | 'score' | 'status';
type SortDirection = 'asc' | 'desc';

const EASE_FLOWTYM: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const TableView: React.FC<TableViewProps> = ({
  events,
  onSelectEvent,
  onExportPDF,
  currentYear,
  currentMonth,
  filterKey,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const todayStr = useMemo(() => getTodayIsoDate(), []);

  // Sort state
  const [sortColumn, setSortColumn] = useState<SortColumn>('dates');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Track month navigation direction & brief loading transition feedback
  const prevMonthIndexRef = useRef<number | null>(
    currentYear !== undefined && currentMonth !== undefined
      ? currentYear * 12 + currentMonth
      : null
  );
  const [monthDirection, setMonthDirection] = useState<-1 | 0 | 1>(0);
  const [isUpdating, setIsUpdating] = useState(false);

  const eventIdsSignature = useMemo(
    () => events.map((e) => e.id).join('|'),
    [events]
  );

  const activeTransitionKey = useMemo(() => {
    const periodPart =
      currentYear !== undefined && currentMonth !== undefined
        ? `${currentYear}-${currentMonth}`
        : 'all';
    const filterPart = filterKey || `${events.length}:${eventIdsSignature.slice(0, 80)}`;
    return `${periodPart}::${filterPart}`;
  }, [currentYear, currentMonth, filterKey, events.length, eventIdsSignature]);

  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    if (currentYear !== undefined && currentMonth !== undefined) {
      const nextIndex = currentYear * 12 + currentMonth;
      if (prevMonthIndexRef.current !== null && prevMonthIndexRef.current !== nextIndex) {
        setMonthDirection(nextIndex > prevMonthIndexRef.current ? 1 : -1);
      } else {
        setMonthDirection(0);
      }
      prevMonthIndexRef.current = nextIndex;
    } else {
      setMonthDirection(0);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    setIsUpdating(true);
    const timer = window.setTimeout(() => {
      setIsUpdating(false);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [activeTransitionKey]);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  // Format dates: "10 nov. 2026 → 14 nov. 2026" (timezone-safe)
  const formatDateArrow = (startStr: string, endStr: string) => {
    if (!startStr) return '';
    const MONTH_LABELS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const partsStart = startStr.split('-');
    const sDay = partsStart[2];
    const sMonth = MONTH_LABELS[parseInt(partsStart[1], 10) - 1] || '';
    const sYear = partsStart[0];

    const effectiveEnd = endStr || startStr;
    const partsEnd = effectiveEnd.split('-');
    const eDay = partsEnd[2];
    const eMonth = MONTH_LABELS[parseInt(partsEnd[1], 10) - 1] || '';
    const eYear = partsEnd[0];

    if (startStr === effectiveEnd) {
      return `${sDay} ${sMonth} ${sYear}`;
    }
    return `${sDay} ${sMonth} ${sYear} → ${eDay} ${eMonth} ${eYear}`;
  };

  // Type label helper (Matching "Salon", "Sport", etc.)
  const getTypeLabel = (category: EventCategory, title: string) => {
    const t = title.toLowerCase();
    if (
      category === 'salons_foires' ||
      t.includes('salon') ||
      t.includes('mondial') ||
      t.includes('photo') ||
      t.includes('hotel') ||
      t.includes('naval') ||
      t.includes('games') ||
      t.includes('sial') ||
      t.includes('batimat') ||
      t.includes('all4pack')
    ) {
      return 'Salon';
    }
    if (
      category === 'sport' ||
      t.includes('rugby') ||
      t.includes('tennis') ||
      t.includes('masters') ||
      t.includes('cross') ||
      t.includes('ligue') ||
      t.includes('nfl') ||
      t.includes('marathon') ||
      t.includes('match')
    ) {
      return 'Sport';
    }
    if (category === 'mode_luxe' || t.includes('mode')) return 'Mode';
    if (category === 'concerts_spectacles' || t.includes('concert') || t.includes('dion')) return 'Spectacle';
    if (category === 'congres_medical' || t.includes('congrès') || t.includes('oncologie')) return 'Congrès';
    if (category === 'festivals' || t.includes('fête') || t.includes('lumières')) return 'Festival';
    if (category === 'corporate_sommet' || t.includes('sommet') || t.includes('summit')) return 'Sommet';
    if (category === 'vacances_scolaires') return 'Vacances';
    if (category === 'periodes_saisonnieres_fetes') return 'Saisonnier & Fêtes';
    return 'Culture';
  };

  // Status helper (En cours vs À venir vs Terminé)
  const renderStatusBadge = (ev: EventItem) => {
    const config = getEventStatusBadgeConfig(ev, todayStr);
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs ${config.badgeClass}`}>
          <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
          <span>{config.label}</span>
        </span>
        {config.subLabel && (
          <span className="text-[10px] text-slate-400 font-medium pl-1">
            {config.subLabel}
          </span>
        )}
      </div>
    );
  };

  // Impact RM pill helper (• Fort, • Critique, • Moyen, • Faible)
  const renderImpactPill = (score: number, impactLevel: RMImpactLevel) => {
    if (score >= 85 || impactLevel === 'hyper') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Critique
        </span>
      );
    }
    if (score >= 60 || impactLevel === 'critique') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Fort
        </span>
      );
    }
    if (score >= 30 || impactLevel === 'modere') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/70">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Moyen
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Faible
      </span>
    );
  };

  // Left vertical accent bar color based on score/impact
  const getAccentBarColor = (score: number) => {
    if (score >= 85) return 'bg-rose-500';
    if (score >= 60) return 'bg-amber-500';
    if (score >= 30) return 'bg-amber-400';
    return 'bg-emerald-500';
  };

  // Sorted events — preserves strict RM chronology (En cours d'abord, puis À venir par ordre croissant)
  const sortedEvents = useMemo(() => {
    if (sortColumn === 'dates') {
      const chrono = sortEventsChronologically(events, todayStr, false);
      return sortDirection === 'asc' ? chrono : [...chrono].reverse();
    }

    const list = [...events];
    list.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'title':
          comparison = a.title.localeCompare(b.title, 'fr');
          break;
        case 'type':
          comparison = getTypeLabel(a.category, a.title).localeCompare(getTypeLabel(b.category, b.title), 'fr');
          break;
        case 'location':
          comparison = `${a.city} ${a.venueName}`.localeCompare(`${b.city} ${b.venueName}`, 'fr');
          break;
        case 'impact': {
          const rank = (lvl: RMImpactLevel) =>
            lvl === 'hyper' ? 4 : lvl === 'critique' ? 3 : lvl === 'modere' ? 2 : 1;
          comparison = rank(a.impactLevel) - rank(b.impactLevel);
          break;
        }
        case 'score':
          comparison = a.scoreBreakdown.finalRMScore - b.scoreBreakdown.finalRMScore;
          break;
        case 'status': {
          const statusRank = (ev: EventItem) => {
            const st = getEventChronologicalStatus(ev, todayStr);
            return st === 'ongoing' ? 1 : st === 'upcoming' ? 2 : 3;
          };
          comparison = statusRank(a) - statusRank(b);
          if (comparison === 0) {
            comparison = a.startDate.localeCompare(b.startDate);
          }
          break;
        }
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [events, sortColumn, sortDirection, todayStr]);

  // Motion variants for month/filter content swaps
  const contentVariants = useMemo(() => {
    if (prefersReducedMotion) {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.14 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      };
    }

    const horizontalOffset = monthDirection !== 0 ? monthDirection * 18 : 0;
    const verticalOffset = monthDirection === 0 ? 8 : 0;

    return {
      initial: {
        opacity: 0,
        x: horizontalOffset,
        y: verticalOffset,
      },
      animate: {
        opacity: 1,
        x: 0,
        y: 0,
        transition: {
          duration: 0.24,
          ease: EASE_FLOWTYM,
        },
      },
      exit: {
        opacity: 0,
        x: horizontalOffset !== 0 ? -horizontalOffset * 0.6 : 0,
        y: verticalOffset !== 0 ? -4 : 0,
        transition: {
          duration: 0.12,
          ease: 'easeIn' as const,
        },
      },
    };
  }, [monthDirection, prefersReducedMotion]);

  // Render sorting header cell
  const renderSortHeader = (label: string, col: SortColumn, align: 'left' | 'right' = 'left') => {
    const isCurrent = sortColumn === col;
    return (
      <th
        onClick={() => handleSort(col)}
        className={`py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider cursor-pointer select-none transition-colors group ${
          isCurrent ? 'text-violet-700 dark:text-violet-300 bg-violet-50/40 dark:bg-violet-950/30' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/80'
        } ${align === 'right' ? 'text-right' : 'text-left'}`}
      >
        <div className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
          <span>{label}</span>
          {isCurrent ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </th>
    );
  };

  const enableRowLayout = !prefersReducedMotion && sortedEvents.length <= 45;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden relative">
      {/* Table Toolbar */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/50">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-violet-600" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Tableau des événements
          </span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium inline-flex items-center gap-1">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.strong
                key={sortedEvents.length}
                initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: 4 }}
                transition={{ duration: 0.16, ease: EASE_FLOWTYM }}
                className="text-slate-900 dark:text-slate-100 font-bold tabular-nums inline-block"
              >
                {sortedEvents.length}
              </motion.strong>
            </AnimatePresence>
            <span>événement{sortedEvents.length > 1 ? 's' : ''} affiché{sortedEvents.length > 1 ? 's' : ''}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 bg-white dark:bg-slate-900 hover:bg-violet-50 dark:hover:bg-violet-950/50 border border-violet-200 dark:border-violet-800/70 hover:border-violet-300 dark:hover:border-violet-600/70 rounded-xl transition-all shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
              title="Exporter les événements du tableau au format PDF"
            >
              <FileText className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              <span>Exporter en PDF</span>
            </button>
          )}
        </div>

        {/* Fluid progress indicator during month/filter transitions */}
        <AnimatePresence>
          {isUpdating && (
            <motion.div
              key="table-updating-bar"
              initial={{ scaleX: 0, opacity: 0.9 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE_FLOWTYM }}
              style={{ transformOrigin: '0% 50%' }}
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-400 pointer-events-none"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Animated Table Content Wrapper for Month & Filter Transitions */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTransitionKey}
          variants={contentVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {events.length === 0 ? (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: EASE_FLOWTYM }}
              className="py-16 px-6 text-center space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Aucun événement ne correspond aux filtres sélectionnés
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Modifiez la période, réinitialisez les critères d&apos;impact ou effacez la recherche textuelle pour afficher les événements.
              </p>
            </motion.div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    {renderSortHeader('ÉVÉNEMENT', 'title')}
                    {renderSortHeader('TYPE', 'type')}
                    {renderSortHeader('DATES', 'dates')}
                    {renderSortHeader('LIEU', 'location')}
                    {renderSortHeader('IMPACT RM', 'impact')}
                    {renderSortHeader('SCORE RM', 'score')}
                    {renderSortHeader('STATUT', 'status')}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {sortedEvents.map((ev, index) => {
                    const score = ev.scoreBreakdown.finalRMScore;
                    const scoreStyles = getRMScoreColorClasses(score);
                    const accentColor = getAccentBarColor(score);
                    const isRMSPriority = score >= 50;
                    const staggerDelay = prefersReducedMotion ? 0 : Math.min(index, 14) * 0.02;

                    return (
                      <motion.tr
                        key={ev.id}
                        layout={enableRowLayout ? 'position' : false}
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          opacity: { duration: 0.2, delay: staggerDelay, ease: EASE_FLOWTYM },
                          y: { duration: 0.22, delay: staggerDelay, ease: EASE_FLOWTYM },
                          layout: { duration: 0.2, ease: EASE_FLOWTYM },
                        }}
                        onClick={() => onSelectEvent(ev)}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                      >
                        {/* Nom de l’événement Column */}
                        <td className="py-4 px-6 max-w-sm">
                          <div className="flex items-start gap-3">
                            <div className={`w-1 self-stretch rounded-full ${accentColor} shrink-0 mt-0.5`} />

                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors text-sm">
                                  {ev.title}
                                </span>
                                {ev.isRecurring && (
                                  <span title="Événement récurrent">
                                    <Repeat className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                  </span>
                                )}
                              </div>

                              {ev.subtitle && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                                  {ev.subtitle}
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                {ev.isWatchlist && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70">
                                    À surveiller
                                  </span>
                                )}
                                {isRMSPriority && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/70">
                                    Priorité RMS
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Type Column */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {getTypeLabel(ev.category, ev.title)}
                          </span>
                        </td>

                        {/* Dates (début/fin) Column */}
                        <td className="py-4 px-4 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300 text-xs tabular-nums">
                          {formatDateArrow(ev.startDate, ev.endDate)}
                        </td>

                        {/* Ville / Lieu Column */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">{ev.city}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ev.venueName}</div>
                        </td>

                        {/* Impact RM Column */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {renderImpactPill(score, ev.impactLevel)}
                        </td>

                        {/* Score RM Column with animated horizontal progress gauge */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-12 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <motion.div
                                initial={prefersReducedMotion ? false : { width: '0%' }}
                                animate={{ width: `${Math.min(100, Math.max(10, score))}%` }}
                                transition={{ duration: 0.35, delay: staggerDelay, ease: EASE_FLOWTYM }}
                                className={`h-1.5 rounded-full ${scoreStyles.barColor}`}
                              />
                            </div>
                            <span
                              className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-md font-bold text-xs tabular-nums border ${scoreStyles.badge}`}
                              title={`Score RM : ${score}/100 (${scoreStyles.label})`}
                            >
                              {score}
                            </span>
                          </div>
                        </td>

                        {/* Statut Column */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {renderStatusBadge(ev)}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
