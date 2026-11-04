import React from 'react';
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
  // Counts for tabs
  const upcomingCount = events.filter((e) => new Date(e.startDate) >= new Date('2026-10-01')).length;
  const ongoingCount = 2; // In current month active window
  const pastCount = events.filter((e) => new Date(e.startDate) < new Date('2026-10-01')).length;
  const totalCount = events.length;

  const handlePrevMonth = () => {
    if (filterState.currentMonth === 0) {
      onFilterChange({ currentMonth: 11, currentYear: filterState.currentYear - 1 });
    } else {
      onFilterChange({ currentMonth: filterState.currentMonth - 1 });
    }
  };

  const handleNextMonth = () => {
    if (filterState.currentMonth === 11) {
      onFilterChange({ currentMonth: 0, currentYear: filterState.currentYear + 1 });
    } else {
      onFilterChange({ currentMonth: filterState.currentMonth + 1 });
    }
  };

  const handleGoToday = () => {
    onFilterChange({ currentYear: 2026, currentMonth: 9 }); // October 2026 (0-indexed 9)
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Date selectors & Primary Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        {/* Left: Navigation and View Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year selector */}
          <select
            value={filterState.currentYear}
            onChange={(e) => onFilterChange({ currentYear: parseInt(e.target.value, 10) })}
            className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>

          {/* Month Stepper */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Mois précédent"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <select
              value={filterState.currentMonth}
              onChange={(e) => onFilterChange({ currentMonth: parseInt(e.target.value, 10) })}
              className="bg-transparent text-xs font-semibold text-slate-800 px-2 py-1.5 focus:outline-none cursor-pointer"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx}>
                  {name} {filterState.currentYear}
                </option>
              ))}
            </select>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Mois suivant"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Aujourd'hui */}
          <button
            onClick={handleGoToday}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
          >
            Aujourd&apos;hui
          </button>

          {/* View Switcher: Tableau vs Calendrier matching screenshot */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 ml-1">
            <button
              onClick={() => onToggleViewMode('table')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
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
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
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
            className="inline-flex items-center gap-1.5 px-3 py-1.8 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Importer (Excel)</span>
          </button>

          <button
            onClick={onDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.8 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
            title="Télécharger le modèle Excel Flowtym pour importer vos événements"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Modèle Excel</span>
          </button>

          <button
            onClick={onExportData}
            className="inline-flex items-center gap-1.5 px-3 py-1.8 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
            title="Exporter les données au format CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exporter (CSV)</span>
          </button>

          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.8 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200/90 rounded-xl transition-all shadow-2xs cursor-pointer"
              title="Générer un rapport récapitulatif PDF avec scores RM et détails essentiels"
            >
              <FileText className="w-3.5 h-3.5 text-violet-600" />
              <span>Exporter en PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-bar: Status Tabs + Search & Filters Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Status Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 w-fit">
          <button
            onClick={() => onFilterChange({ periodTab: 'upcoming' })}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              filterState.periodTab === 'upcoming'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            À venir <span className="tabular-nums opacity-90 ml-1">{upcomingCount}</span>
          </button>

          <button
            onClick={() => onFilterChange({ periodTab: 'ongoing' })}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              filterState.periodTab === 'ongoing'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            En cours <span className="tabular-nums opacity-90 ml-1">{ongoingCount}</span>
          </button>

          <button
            onClick={() => onFilterChange({ periodTab: 'past' })}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              filterState.periodTab === 'past'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Passés <span className="tabular-nums opacity-90 ml-1">{pastCount}</span>
          </button>

          <button
            onClick={() => onFilterChange({ periodTab: 'all' })}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              filterState.periodTab === 'all'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
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
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.8 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 shadow-2xs"
            />
          </div>

          <button
            onClick={onToggleFilterExpanded}
            className={`inline-flex items-center gap-1.5 px-3 py-1.8 text-xs font-semibold rounded-xl border transition-colors ${
              isFilterExpanded
                ? 'bg-violet-50 text-violet-700 border-violet-300'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-violet-600" />
            <span>Filtres</span>
          </button>

          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200/80 rounded-xl">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Base de démonstration</span>
          </div>
        </div>
      </div>

      {/* Collapsible Advanced Filters Drawer */}
      {isFilterExpanded && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-4 transition-all">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Filter className="w-3.5 h-3.5 text-violet-600" />
              <span>Filtres avancés</span>
            </div>
            <button
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-violet-600 transition-colors font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Réinitialiser</span>
            </button>
          </div>

          {/* Selectors Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Impact RM
              </label>
              <select
                value={filterState.impact}
                onChange={(e) => onFilterChange({ impact: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="all">Tous</option>
                <option value="hyper">Hyper (Stop-sell)</option>
                <option value="critique">Critique (Yield actif)</option>
                <option value="modere">Modéré</option>
                <option value="faible">Faible</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Type d&apos;événement
              </label>
              <select
                value={filterState.category}
                onChange={(e) => onFilterChange({ category: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
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
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Lieu / Ville
              </label>
              <select
                value={filterState.city}
                onChange={(e) => onFilterChange({ city: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="all">Toutes les villes</option>
                <option value="Paris">Paris & Région parisienne</option>
                <option value="Lyon">Lyon</option>
                <option value="Nice">Nice</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Statut
              </label>
              <select
                value={filterState.status}
                onChange={(e) => onFilterChange({ status: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
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
            <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={filterState.recurrenceOnly}
                onChange={(e) => onFilterChange({ recurrenceOnly: e.target.checked })}
                className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
              />
              <span>Événements récurrents</span>
            </label>

            <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={filterState.rmsPrioritiesOnly}
                onChange={(e) => onFilterChange({ rmsPrioritiesOnly: e.target.checked })}
                className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
              />
              <span>Priorités RMS (score ≥ 50)</span>
            </label>

            <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={filterState.anomaliesOnly}
                onChange={(e) => onFilterChange({ anomaliesOnly: e.target.checked })}
                className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
              />
              <span>Anomalies</span>
            </label>

            <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={filterState.watchlistOnly}
                onChange={(e) => onFilterChange({ watchlistOnly: e.target.checked })}
                className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
              />
              <span>À surveiller</span>
            </label>

            <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={filterState.showSchoolHolidays ?? true}
                onChange={(e) => onFilterChange({ showSchoolHolidays: e.target.checked })}
                className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
              />
              <span className="font-semibold text-violet-900">Vacances scolaires</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
