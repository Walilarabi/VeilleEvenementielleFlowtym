import React, { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Upload,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Sparkles,
  RotateCcw,
  LayoutList,
  Calendar as CalendarIcon,
  FileText,
} from 'lucide-react';
import { FilterState, EventItem, RMImpactLevel, EventCategory, ConfirmationStatus } from '../../types';
import {
  CURRENT_REFERENCE_DATE,
  isEventOngoing,
  isEventUpcoming,
  isEventPast,
  doesEventOverlapMonth,
  getMonthTemporalRelation,
} from '../../utils/eventFilterUtils';

interface CalendarControlsProps {
  filterState: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  viewMode: 'calendar' | 'table';
  onToggleViewMode: (mode: 'calendar' | 'table') => void;
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
  onDownloadTemplate: () => void;
  onExportData: () => void;
  onExportPDF?: () => void;
  onResetFilters: () => void;
  isFilterExpanded: boolean;
  onToggleFilterExpanded: () => void;
  events: EventItem[];
}

const MONTH_NAMES = [
  'Janv.',
  'Févr.',
  'Mars',
  'Avr.',
  'Mai',
  'Juin',
  'Juil.',
  'Août',
  'Sept.',
  'Oct.',
  'Nov.',
  'Déc.',
];

export const CalendarControls: React.FC<CalendarControlsProps> = ({
  filterState,
  onFilterChange,
  viewMode,
  onToggleViewMode,
  onOpenAddModal,
  onOpenImportModal,
  onDownloadTemplate,
  onExportData,
  onExportPDF,
  onResetFilters,
  isFilterExpanded,
  onToggleFilterExpanded,
  events,
}) => {
  const selectedYear = filterState.currentYear;
  const selectedMonth = filterState.currentMonth;
  const temporal = getMonthTemporalRelation(selectedYear, selectedMonth, CURRENT_REFERENCE_DATE);

  // Filter events overlapping selected month
  const monthEvents = useMemo(() => {
    return events.filter((e) => doesEventOverlapMonth(e, selectedYear, selectedMonth));
  }, [events, selectedYear, selectedMonth]);

  // Counts based on certified RM chronology
  const ongoingCount = useMemo(() => {
    return monthEvents.filter((e) => isEventOngoing(e, CURRENT_REFERENCE_DATE)).length;
  }, [monthEvents]);

  const upcomingCount = useMemo(() => {
    if (temporal === 'past') return 0;
    if (temporal === 'future') return monthEvents.length;
    return monthEvents.filter((e) => isEventUpcoming(e, CURRENT_REFERENCE_DATE)).length;
  }, [monthEvents, temporal]);

  const pastCount = useMemo(() => {
    if (temporal === 'future') return 0;
    if (temporal === 'past') return monthEvents.length;
    return monthEvents.filter((e) => isEventPast(e, CURRENT_REFERENCE_DATE)).length;
  }, [monthEvents, temporal]);

  // Total count for current month: ongoing + upcoming (past excluded by default)
  const totalCount = useMemo(() => {
    if (temporal === 'current') return ongoingCount + upcomingCount;
    if (temporal === 'future') return upcomingCount;
    return pastCount;
  }, [temporal, ongoingCount, upcomingCount, pastCount]);

  const handlePrevMonth = () => {
    if (filterState.currentMonth === 0) {
      onFilterChange({ currentMonth: 11, currentYear: filterState.currentYear - 1, periodTab: 'all' });
    } else {
      onFilterChange({ currentMonth: filterState.currentMonth - 1, periodTab: 'all' });
    }
  };

  const handleNextMonth = () => {
    if (filterState.currentMonth === 11) {
      onFilterChange({ currentMonth: 0, currentYear: filterState.currentYear + 1, periodTab: 'all' });
    } else {
      onFilterChange({ currentMonth: filterState.currentMonth + 1, periodTab: 'all' });
    }
  };

  const handleGoToday = () => {
    onFilterChange({ currentYear: 2026, currentMonth: 10, periodTab: 'all' }); // 10 = Novembre 2026 (date du jour 12/11/2026)
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Date selectors & Primary Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
        {/* Left: Navigation and View Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year selector */}
          <select
            value={filterState.currentYear}
            onChange={(e) => onFilterChange({ currentYear: parseInt(e.target.value, 10), periodTab: 'all' })}
            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>

          {/* Month Stepper */}
          <div className="flex items-center bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
              title="Mois précédent"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <select
              value={filterState.currentMonth}
              onChange={(e) => onFilterChange({ currentMonth: parseInt(e.target.value, 10), periodTab: 'all' })}
              className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 px-2 py-1.5 focus:outline-none cursor-pointer"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx}>
                  {name} {filterState.currentYear}
                </option>
              ))}
            </select>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
              title="Mois suivant"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Aujourd'hui */}
          <button
            onClick={handleGoToday}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors"
          >
            Aujourd&apos;hui
          </button>

          {/* View Switcher: Tableau vs Calendrier matching screenshot */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800/80 ml-1">
            <button
              onClick={() => onToggleViewMode('table')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60'
              }`}
              title="Afficher les événements sous forme de tableau interactif (Vue Liste)"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Tableau</span>
            </button>
            <button
              onClick={() => onToggleViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60'
              }`}
              title="Afficher les événements sur le planning mensuel (Vue Calendrier)"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendrier</span>
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.8 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter un événement</span>
          </button>

          <button
            onClick={onOpenImportModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.8 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Importer (Excel)</span>
          </button>

          <button
            onClick={onDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.8 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl transition-colors"
            title="Télécharger le modèle Excel Flowtym pour importer vos événements"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Modèle Excel</span>
          </button>

          <button
            onClick={onExportData}
            className="inline-flex items-center gap-1.5 px-3 py-1.8 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl transition-colors"
            title="Exporter les données au format CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Exporter (CSV)</span>
          </button>

          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.8 text-xs font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200/90 dark:border-violet-800/70 rounded-xl transition-all shadow-2xs cursor-pointer"
              title="Générer un rapport récapitulatif PDF avec scores RM et détails essentiels"
            >
              <FileText className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              <span>Exporter en PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-bar: Status Tabs + Search & Filters Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Status Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800/80 w-fit">
          <button
            onClick={() => onFilterChange({ periodTab: 'upcoming' })}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              filterState.periodTab === 'upcoming'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            À venir <span className="tabular-nums opacity-90 ml-1">{upcomingCount}</span>
          </button>

          <button
            onClick={() => onFilterChange({ periodTab: 'ongoing' })}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              filterState.periodTab === 'ongoing'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            En cours <span className="tabular-nums opacity-90 ml-1">{ongoingCount}</span>
          </button>

          <button
            onClick={() => onFilterChange({ periodTab: 'past' })}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              filterState.periodTab === 'past'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Passés <span className="tabular-nums opacity-90 ml-1">{pastCount}</span>
          </button>

          <button
            onClick={() => onFilterChange({ periodTab: 'all' })}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              filterState.periodTab === 'all'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Tous <span className="tabular-nums opacity-90 ml-1">{totalCount}</span>
          </button>
        </div>

        {/* Right: Search Input + Filters Toggle + Demo Mode Pill */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterState.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              placeholder="Rechercher un événement, lieu..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.8 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 shadow-2xs"
            />
          </div>

          <button
            onClick={onToggleFilterExpanded}
            className={`inline-flex items-center gap-1.5 px-3 py-1.8 text-xs font-semibold rounded-xl border transition-colors ${
              isFilterExpanded
                ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700/70'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80'
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            <span>Filtres</span>
          </button>

          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/70 rounded-xl">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Base de démonstration</span>
          </div>
        </div>
      </div>

      {/* Collapsible Advanced Filters Drawer */}
      {isFilterExpanded && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-4 transition-all">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Filter className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              <span>Filtres avancés</span>
            </div>
            <button
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-violet-600 transition-colors font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Réinitialiser</span>
            </button>
          </div>

          {/* Selectors Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Impact RM
              </label>
              <select
                value={filterState.impact}
                onChange={(e) => onFilterChange({ impact: e.target.value as any })}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="all">Tous</option>
                <option value="hyper">Hyper (Stop-sell)</option>
                <option value="critique">Critique (Yield actif)</option>
                <option value="modere">Modéré</option>
                <option value="faible">Faible</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Type d&apos;événement
              </label>
              <select
                value={filterState.category}
                onChange={(e) => onFilterChange({ category: e.target.value as any })}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="all">Tous les types</option>
                <option value="salons_foires">Salons & Foires</option>
                <option value="congres_medical">Congrès & Médical</option>
                <option value="concerts_spectacles">Concerts & Spectacles</option>
                <option value="sport">Sport & Compétitions</option>
                <option value="festivals">Festivals & Culture</option>
                <option value="mode_luxe">Mode & Fashion Week</option>
                <option value="corporate_sommet">Sommets & Corporate</option>
                <option value="culturel">Culture & Arts</option>
                <option value="vacances_scolaires">Vacances Scolaires</option>
                <option value="periodes_saisonnieres_fetes">Périodes saisonnières et fêtes</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Lieu / Ville
              </label>
              <select
                value={filterState.city}
                onChange={(e) => onFilterChange({ city: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="all">Toutes les communes du périmètre</option>
                {Array.from(new Set(events.map((e) => e.city).filter(Boolean)))
                  .sort((a, b) => a.localeCompare(b))
                  .map((cityName) => (
                    <option key={cityName} value={cityName}>
                      {cityName}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Statut
              </label>
              <select
                value={filterState.status}
                onChange={(e) => onFilterChange({ status: e.target.value as any })}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="confirmed">Confirmé</option>
                <option value="estimated_recurrent">Récurrent estimé</option>
                <option value="announced_pending">Annoncé sans date précise</option>
              </select>
            </div>
          </div>

          {/* Quick Toggles Row */}
          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={filterState.recurrenceOnly}
                onChange={(e) => onFilterChange({ recurrenceOnly: e.target.checked })}
                className="w-4 h-4 text-violet-600 dark:text-violet-400 rounded border-slate-300 dark:border-slate-700 focus:ring-violet-500"
              />
              <span>Événements récurrents</span>
            </label>

            <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={filterState.rmsPrioritiesOnly}
                onChange={(e) => onFilterChange({ rmsPrioritiesOnly: e.target.checked })}
                className="w-4 h-4 text-violet-600 dark:text-violet-400 rounded border-slate-300 dark:border-slate-700 focus:ring-violet-500"
              />
              <span>Priorités RMS (score ≥ 50)</span>
            </label>

            <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={filterState.anomaliesOnly}
                onChange={(e) => onFilterChange({ anomaliesOnly: e.target.checked })}
                className="w-4 h-4 text-violet-600 dark:text-violet-400 rounded border-slate-300 dark:border-slate-700 focus:ring-violet-500"
              />
              <span>Anomalies</span>
            </label>

            <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={filterState.watchlistOnly}
                onChange={(e) => onFilterChange({ watchlistOnly: e.target.checked })}
                className="w-4 h-4 text-violet-600 dark:text-violet-400 rounded border-slate-300 dark:border-slate-700 focus:ring-violet-500"
              />
              <span>À surveiller</span>
            </label>

            <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={filterState.showSchoolHolidays ?? true}
                onChange={(e) => onFilterChange({ showSchoolHolidays: e.target.checked })}
                className="w-4 h-4 text-violet-600 dark:text-violet-400 rounded border-slate-300 dark:border-slate-700 focus:ring-violet-500"
              />
              <span className="font-semibold text-violet-900 dark:text-violet-200">Vacances scolaires</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
