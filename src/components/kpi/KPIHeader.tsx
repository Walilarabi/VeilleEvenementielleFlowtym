import React from 'react';
import {
  CalendarDays,
  Zap,
  AlertTriangle,
  TrendingUp,
  Eye,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { EventItem, FilterState } from '../../types';

interface KPIHeaderProps {
  events: EventItem[];
  filterState: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  onTriggerRefresh: () => void;
}

export const KPIHeader: React.FC<KPIHeaderProps> = ({
  events,
  filterState,
  onFilterChange,
  onTriggerRefresh,
}) => {
  // Compute reactive counts
  const totalEvents = events.length;
  const upcomingCount = events.filter((e) => new Date(e.startDate) >= new Date('2026-10-01')).length;
  const hyperCount = events.filter((e) => e.impactLevel === 'hyper').length;
  const criticalCount = events.filter((e) => e.impactLevel === 'critique').length;
  const rmsPrioritiesCount = events.filter((e) => e.scoreBreakdown.finalRMScore >= 50).length;
  const watchlistCount = events.filter((e) => e.isWatchlist).length;

  const avgRMScore = Math.round(
    events.reduce((acc, curr) => acc + curr.scoreBreakdown.finalRMScore, 0) / (totalEvents || 1)
  );

  return (
    <div className="space-y-4">
      {/* Top Banner with Title and Actualiser Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-600 flex items-center justify-center text-white shadow-xs">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Veille Événementielle
            </h1>
            <p className="text-xs text-slate-500">
              Suivez les événements qui impactent la demande, les prix et les décisions RMS
            </p>
          </div>
        </div>

        <button
          onClick={onTriggerRefresh}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-xs hover:shadow-sm transition-all shrink-0 cursor-pointer active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5 text-white" />
          <span>Actualiser</span>
        </button>
      </div>

      {/* KPI Cards Grid (Directly faithful to screenshot) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Card 1: Total événements */}
        <div
          onClick={() =>
            onFilterChange({
              periodTab: 'all',
              impact: 'all',
              rmsPrioritiesOnly: false,
              watchlistOnly: false,
            })
          }
          className={`bg-white border rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer relative overflow-hidden ${
            filterState.periodTab === 'all' && filterState.impact === 'all' && !filterState.rmsPrioritiesOnly && !filterState.watchlistOnly
              ? 'border-violet-300 ring-2 ring-violet-100'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                {totalEvents}
              </div>
              <div className="text-xs font-semibold text-slate-700 mt-0.5">
                Total événements
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {upcomingCount} à venir
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Card 2: Événements Hyper */}
        <div
          onClick={() =>
            onFilterChange({
              impact: filterState.impact === 'hyper' ? 'all' : 'hyper',
            })
          }
          className={`bg-white border rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer relative overflow-hidden ${
            filterState.impact === 'hyper'
              ? 'border-rose-400 ring-2 ring-rose-100'
              : 'border-slate-200/80 hover:border-rose-200'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                {hyperCount}
              </div>
              <div className="text-xs font-semibold text-slate-700 mt-0.5">
                Événements Hyper
              </div>
              <div className="text-[11px] text-rose-500 font-medium mt-1">
                Stop-sell requis
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Card 3: Événements critiques */}
        <div
          onClick={() =>
            onFilterChange({
              impact: filterState.impact === 'critique' ? 'all' : 'critique',
            })
          }
          className={`bg-white border rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer relative overflow-hidden ${
            filterState.impact === 'critique'
              ? 'border-amber-400 ring-2 ring-amber-100'
              : 'border-slate-200/80 hover:border-amber-200'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                {criticalCount}
              </div>
              <div className="text-xs font-semibold text-slate-700 mt-0.5">
                Événements critiques
              </div>
              <div className="text-[11px] text-amber-600 font-medium mt-1">
                Yield actif
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Card 4: Priorités RMS */}
        <div
          onClick={() =>
            onFilterChange({
              rmsPrioritiesOnly: !filterState.rmsPrioritiesOnly,
            })
          }
          className={`bg-white border rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer relative overflow-hidden ${
            filterState.rmsPrioritiesOnly
              ? 'border-blue-400 ring-2 ring-blue-100'
              : 'border-slate-200/80 hover:border-blue-200'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                {rmsPrioritiesCount}
              </div>
              <div className="text-xs font-semibold text-slate-700 mt-0.5">
                Priorités RMS
              </div>
              <div className="text-[11px] text-blue-600 font-medium mt-1">
                Score ≥ 50
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Card 5: À surveiller */}
        <div
          onClick={() =>
            onFilterChange({
              watchlistOnly: !filterState.watchlistOnly,
            })
          }
          className={`bg-white border rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer relative overflow-hidden ${
            filterState.watchlistOnly
              ? 'border-amber-400 ring-2 ring-amber-100'
              : 'border-slate-200/80 hover:border-amber-200'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                {watchlistCount}
              </div>
              <div className="text-xs font-semibold text-slate-700 mt-0.5">
                À surveiller
              </div>
              <div className="text-[11px] text-amber-600 font-medium mt-1">
                Alerte pricing
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Card 6: Score RM moyen */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                {avgRMScore}
              </div>
              <div className="text-xs font-semibold text-slate-700 mt-0.5">
                Score RM moyen
              </div>
              <div className="text-[11px] text-emerald-600 font-medium mt-1">
                sur 100
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
