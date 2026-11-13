import React, { useState, useMemo } from 'react';
import {
  Repeat,
  ExternalLink,
  Star,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar as CalendarIcon,
  MapPin,
  Search,
  Eye,
  FileText,
} from 'lucide-react';
import { EventItem, EventCategory, RMImpactLevel } from '../../types';
import { getRMScoreColorClasses } from '../../utils/helpers';
import {
  SYSTEM_REFERENCE_DATE,
  sortEventsChronologically,
  getEventStatusBadgeConfig,
  getEffectiveEndDate,
} from '../../services/eventChronologyService';

interface TableViewProps {
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  onToggleFavorite?: (eventId: string) => void;
  onExportPDF?: () => void;
}

const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  salons_foires: 'Salons & foires',
  congres_medical: 'Congrès & médical',
  concerts_spectacles: 'Concerts & spectacles',
  sport: 'Sport',
  festivals: 'Festivals',
  mode_luxe: 'Mode & luxe',
  corporate_sommet: 'Corporate & sommets',
  culturel: 'Culturel',
  vacances_scolaires: 'Vacances scolaires',
  autre: 'Autre',
};

const getTypeLabel = (category: EventCategory, _title: string): string =>
  EVENT_CATEGORY_LABELS[category] ?? 'Autre';

type SortColumn = 'title' | 'type' | 'dates' | 'location' | 'impact' | 'score' | 'status';
type SortDirection = 'asc' | 'desc';

export const TableView: React.FC<TableViewProps> = ({
  events,
  onSelectEvent,
  onToggleFavorite,
  onExportPDF,
}) => {
  // Sort state
  const [sortColumn, setSortColumn] = useState<SortColumn>('dates');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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

  // Status helper (En cours vs À venir vs Terminé)
  const renderStatusBadge = (ev: EventItem) => {
    const config = getEventStatusBadgeConfig(ev, SYSTEM_REFERENCE_DATE);
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
        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Critique
        </span>
      );
    }
    if (score >= 60 || impactLevel === 'critique') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Fort
        </span>
      );
    }
    if (score >= 30 || impactLevel === 'modere') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Moyen
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
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

  // Sorted events
  const sortedEvents = useMemo(() => {
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
        case 'dates':
          comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
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
        case 'status':
          comparison = a.startDate.localeCompare(b.startDate);
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [events, sortColumn, sortDirection]);

  // Render sorting header cell
  const renderSortHeader = (label: string, col: SortColumn, align: 'left' | 'right' = 'left') => {
    const isCurrent = sortColumn === col;
    return (
      <th
        onClick={() => handleSort(col)}
        className={`py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider cursor-pointer select-none transition-colors group ${
          isCurrent ? 'text-violet-700 bg-violet-50/40' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100/50'
        } ${align === 'right' ? 'text-right' : 'text-left'}`}
      >
        <div className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
          <span>{label}</span>
          {isCurrent ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-violet-600" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-violet-600" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
      {/* Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200/80 bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-violet-600" />
          <span className="text-xs font-bold text-slate-800">
            Tableau des événements
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-xs text-slate-600 font-medium">
            <strong className="text-slate-900 font-bold">{sortedEvents.length}</strong> événement{sortedEvents.length > 1 ? 's' : ''} affiché{sortedEvents.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-white hover:bg-violet-50 border border-violet-200 hover:border-violet-300 rounded-xl transition-all shadow-2xs cursor-pointer"
              title="Exporter les événements du tableau au format PDF"
            >
              <FileText className="w-3.5 h-3.5 text-violet-600" />
              <span>Exporter en PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {events.length === 0 ? (
        <div className="py-16 px-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">Aucun événement ne correspond aux filtres sélectionnés</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Modifiez la période, réinitialisez les critères d&apos;impact ou effacez la recherche textuelle pour afficher les événements.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/70 border-b border-slate-200">
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
            <tbody className="divide-y divide-slate-100">
              {sortedEvents.map((ev) => {
                const score = ev.scoreBreakdown.finalRMScore;
                const scoreStyles = getRMScoreColorClasses(score);
                const accentColor = getAccentBarColor(score);
                const isRMSPriority = score >= 50;

                return (
                  <tr
                    key={ev.id}
                    onClick={() => onSelectEvent(ev)}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                  >
                    {/* Nom de l’événement Column with left vertical color bar, title, subtitle & tags */}
                    <td className="py-4 px-6 max-w-sm">
                      <div className="flex items-start gap-3">
                        {/* Vertical Left colored bar matching image_5397ea52.png */}
                        <div className={`w-1 self-stretch rounded-full ${accentColor} shrink-0 mt-0.5`} />

                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 group-hover:text-violet-700 transition-colors text-sm">
                              {ev.title}
                            </span>
                            {/* Repeat icon if recurrent */}
                            {ev.isRecurring && (
                              <span title="Événement récurrent">
                                <Repeat className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                              </span>
                            )}
                          </div>

                          {/* Subtitle / Theme */}
                          {ev.subtitle && (
                            <div className="text-xs text-slate-500 leading-snug">
                              {ev.subtitle}
                            </div>
                          )}

                          {/* Badges: À surveiller, Priorité RMS */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {ev.isWatchlist && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                À surveiller
                              </span>
                            )}
                            {isRMSPriority && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                Priorité RMS
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Type Column */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                        {getTypeLabel(ev.category, ev.title)}
                      </span>
                    </td>

                    {/* Dates (début/fin) Column */}
                    <td className="py-4 px-4 whitespace-nowrap font-medium text-slate-700 text-xs tabular-nums">
                      {formatDateArrow(ev.startDate, ev.endDate)}
                    </td>

                    {/* Ville / Lieu Column */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900 text-xs">{ev.city}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{ev.venueName}</div>
                    </td>

                    {/* Impact RM Column */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      {renderImpactPill(score, ev.impactLevel)}
                    </td>

                    {/* Score RM Column with horizontal progress gauge + pastel colored badge */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${scoreStyles.barColor}`}
                            style={{ width: `${Math.min(100, Math.max(10, score))}%` }}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
