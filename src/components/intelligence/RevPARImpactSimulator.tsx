import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Percent,
  Calendar,
  Sparkles,
  Building2,
  CheckSquare,
  Square,
  BarChart3,
  ArrowUpRight,
  ShieldAlert,
  Zap,
  Info,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
  Cell,
  ReferenceLine,
} from 'recharts';
import { EventItem, Hotel } from '../../types';
import { formatEventDateRange, getImpactColorClasses } from '../../utils/helpers';

interface RevPARImpactSimulatorProps {
  events: EventItem[];
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectEvent?: (event: EventItem) => void;
  onSelectHotel?: (hotelId: string) => void;
}

type YieldScenario = 'conservative' | 'nominal' | 'aggressive';

export const RevPARImpactSimulator: React.FC<RevPARImpactSimulatorProps> = ({
  events,
  hotels,
  selectedHotelId,
  onSelectEvent,
  onSelectHotel,
}) => {
  // Current active hotel
  const [activeHotelId, setActiveHotelId] = useState<string>(selectedHotelId || hotels[0]?.id || 'hotel-opera');
  const currentHotel = useMemo(() => {
    return hotels.find((h) => h.id === activeHotelId) || hotels[0];
  }, [hotels, activeHotelId]);

  // Synchronize if selectedHotelId changes from parent
  React.useEffect(() => {
    if (selectedHotelId) {
      setActiveHotelId(selectedHotelId);
    }
  }, [selectedHotelId]);

  // Pricing / Yield Strategy Scenario
  const [scenario, setScenario] = useState<YieldScenario>('nominal');

  // Baseline Occupancy Rate (TO de base hors événement)
  const [baseOccupancy, setBaseOccupancy] = useState<number>(70);

  // Filter high-impact events relevant for this hotel
  const highImpactEvents = useMemo(() => {
    return events
      .filter((e) => {
        const isCityMatch = !currentHotel.city || e.city.toLowerCase() === currentHotel.city.toLowerCase();
        const isHighImpact = e.impactLevel === 'hyper' || e.impactLevel === 'critique' || e.scoreBreakdown.finalRMScore >= 60;
        return isCityMatch && isHighImpact;
      })
      .sort((a, b) => b.scoreBreakdown.finalRMScore - a.scoreBreakdown.finalRMScore);
  }, [events, currentHotel]);

  // Selected events IDs (defaults to top 5 high-impact events)
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>(() => {
    return highImpactEvents.slice(0, 5).map((e) => e.id);
  });

  // Re-seed selected IDs when hotel changes if empty
  React.useEffect(() => {
    setSelectedEventIds((prev) => {
      const valid = prev.filter((id) => highImpactEvents.some((e) => e.id === id));
      if (valid.length === 0) {
        return highImpactEvents.slice(0, 5).map((e) => e.id);
      }
      return valid;
    });
  }, [highImpactEvents]);

  const handleToggleEvent = (id: string) => {
    setSelectedEventIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedEventIds(highImpactEvents.map((e) => e.id));
  };

  const handleDeselectAll = () => {
    setSelectedEventIds([]);
  };

  // Scenario multipliers
  const scenarioConfig = useMemo(() => {
    switch (scenario) {
      case 'conservative':
        return {
          label: 'Prudent (+20% max)',
          adrFactor: 0.8,
          toBoost: 16,
          maxTO: 93,
          description: 'Ajustement tarifaire modéré, préservation des volumes sans stop-sell agressif.',
        };
      case 'aggressive':
        return {
          label: 'Agressif / Plein Yield',
          adrFactor: 1.35,
          toBoost: 28,
          maxTO: 99,
          description: 'Fermeture précoce des OTA, hausse maximale du tarif direct, séjour minimum 3 nuits.',
        };
      case 'nominal':
      default:
        return {
          label: 'Recommandé Flowtym',
          adrFactor: 1.0,
          toBoost: 22,
          maxTO: 96,
          description: 'Stratégie optimale équilibrant ADR et taux de remplissage pour un RevPAR maximal.',
        };
    }
  }, [scenario]);

  // Base metrics for current hotel
  const baseADR = currentHotel.baseADR || 240;
  const roomCount = currentHotel.roomCount || 100;
  const baseRevPAR = Math.round(baseADR * (baseOccupancy / 100));

  // Projected impact calculations per selected event
  const eventImpacts = useMemo(() => {
    return highImpactEvents
      .filter((ev) => selectedEventIds.includes(ev.id))
      .map((ev) => {
        // Event duration in days
        const start = new Date(ev.startDate);
        const end = new Date(ev.endDate);
        const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        // ADR Boost percentage calculation
        const baseUplift = ev.hotelImpacts[currentHotel.id]?.estimatedADRBoostPercent || Math.round(ev.scoreBreakdown.finalRMScore * 0.48);
        const adrBoostPercent = Math.round(baseUplift * scenarioConfig.adrFactor);

        // Projected ADR & Occupancy
        const projectedADR = Math.round(baseADR * (1 + adrBoostPercent / 100));
        const projectedTO = Math.min(
          scenarioConfig.maxTO,
          Math.round(baseOccupancy + (ev.scoreBreakdown.finalRMScore >= 80 ? scenarioConfig.toBoost : scenarioConfig.toBoost * 0.75))
        );

        // Projected RevPAR
        const projectedRevPAR = Math.round(projectedADR * (projectedTO / 100));
        const revparGain = projectedRevPAR - baseRevPAR;
        const revparGainPercent = Math.round(((projectedRevPAR - baseRevPAR) / baseRevPAR) * 100);

        // Incremental Room Revenue
        const incrementalRevenue = Math.round(revparGain * roomCount * diffDays);
        const totalProjectedRevenue = Math.round(projectedRevPAR * roomCount * diffDays);

        // Short title for charts
        const shortTitle = ev.title.length > 22 ? `${ev.title.slice(0, 20)}…` : ev.title;

        return {
          id: ev.id,
          title: ev.title,
          shortTitle,
          city: ev.city,
          venueName: ev.venueName,
          category: ev.category,
          impactLevel: ev.impactLevel,
          score: ev.scoreBreakdown.finalRMScore,
          startDate: ev.startDate,
          endDate: ev.endDate,
          durationDays: diffDays,
          expectedAttendance: ev.expectedAttendance,
          baseADR,
          projectedADR,
          adrBoostPercent,
          baseOccupancy,
          projectedTO,
          toGainPercent: projectedTO - baseOccupancy,
          baseRevPAR,
          projectedRevPAR,
          revparGain,
          revparGainPercent,
          incrementalRevenue,
          totalProjectedRevenue,
          event: ev,
        };
      });
  }, [highImpactEvents, selectedEventIds, baseADR, baseOccupancy, baseRevPAR, roomCount, scenarioConfig, currentHotel.id]);

  // Aggregated totals across all selected events
  const summary = useMemo(() => {
    if (eventImpacts.length === 0) {
      return {
        totalDays: 0,
        avgProjectedADR: baseADR,
        avgProjectedTO: baseOccupancy,
        avgProjectedRevPAR: baseRevPAR,
        avgRevparGain: 0,
        avgRevparGainPercent: 0,
        totalIncrementalRevenue: 0,
        totalProjectedRevenue: 0,
      };
    }

    const totalDays = eventImpacts.reduce((sum, d) => sum + d.durationDays, 0);
    const totalIncrementalRevenue = eventImpacts.reduce((sum, d) => sum + d.incrementalRevenue, 0);
    const totalProjectedRevenue = eventImpacts.reduce((sum, d) => sum + d.totalProjectedRevenue, 0);

    const weightedProjectedRevPAR = Math.round(
      eventImpacts.reduce((sum, d) => sum + d.projectedRevPAR * d.durationDays, 0) / totalDays
    );
    const weightedProjectedADR = Math.round(
      eventImpacts.reduce((sum, d) => sum + d.projectedADR * d.durationDays, 0) / totalDays
    );
    const weightedProjectedTO = Math.round(
      eventImpacts.reduce((sum, d) => sum + d.projectedTO * d.durationDays, 0) / totalDays
    );

    const avgRevparGain = weightedProjectedRevPAR - baseRevPAR;
    const avgRevparGainPercent = Math.round(((weightedProjectedRevPAR - baseRevPAR) / baseRevPAR) * 100);

    return {
      totalDays,
      avgProjectedADR: weightedProjectedADR,
      avgProjectedTO: weightedProjectedTO,
      avgProjectedRevPAR: weightedProjectedRevPAR,
      avgRevparGain,
      avgRevparGainPercent,
      totalIncrementalRevenue,
      totalProjectedRevenue,
    };
  }, [eventImpacts, baseADR, baseOccupancy, baseRevPAR]);

  return (
    <div className="space-y-6">
      {/* Simulation Control Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 bg-violet-50 text-violet-700 px-3 py-1 rounded-full text-xs font-bold border border-violet-200">
              <BarChart3 className="w-3.5 h-3.5 text-violet-600" />
              <span>Simulateur d&apos;Impact RevPAR Hôtelier</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Projection du RevPAR & Revenu Additionnel par Événement
            </h3>
            <p className="text-xs text-slate-500">
              Modélisation Recharts de l&apos;impact sur le RevPAR en combinant l&apos;élasticité de l&apos;ADR et la compression du taux d&apos;occupation (TO).
            </p>
          </div>

          {/* Hotel selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <label htmlFor="revpar-hotel-select" className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Établissement simulé :
              </label>
              <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 hover:border-slate-300 transition-colors">
                <Building2 className="w-4 h-4 text-violet-600 mr-2 shrink-0" />
                <select
                  id="revpar-hotel-select"
                  aria-label="Établissement simulé"
                  value={activeHotelId}
                  onChange={(e) => {
                    setActiveHotelId(e.target.value);
                    if (onSelectHotel) onSelectHotel(e.target.value);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-800 pr-6 focus:outline-none cursor-pointer appearance-none"
                >
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} · {h.city} ({h.roomCount} ch. · ADR base {h.baseADR}€)
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Scenario toggle */}
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Scénario Yield RM :
              </label>
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                {(['conservative', 'nominal', 'aggressive'] as YieldScenario[]).map((sc) => (
                  <button
                    key={sc}
                    onClick={() => setScenario(sc)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      scenario === sc
                        ? 'bg-violet-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sc === 'conservative' ? 'Prudent' : sc === 'nominal' ? 'Nominal' : 'Agressif'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Hotel Baseline Specs & Scenario Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 text-xs">
          <div>
            <span className="text-slate-500 font-medium block">Capacité hôtelière</span>
            <strong className="text-slate-900 font-extrabold text-sm">{roomCount} chambres</strong>
            <span className="text-[10px] text-slate-400 block">{currentHotel.stars}★ · {currentHotel.segment}</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium block">ADR de Base standard</span>
            <strong className="text-slate-900 font-extrabold text-sm tabular-nums">{baseADR} €</strong>
            <span className="text-[10px] text-slate-400 block">Tarif moyen hors compression</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium block">TO de Base standard</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <strong className="text-slate-900 font-extrabold text-sm tabular-nums">{baseOccupancy}%</strong>
              <input
                type="range"
                min="50"
                max="85"
                step="5"
                value={baseOccupancy}
                onChange={(e) => setBaseOccupancy(Number(e.target.value))}
                className="w-16 accent-violet-600 cursor-pointer"
                title={`Ajuster le TO de base: ${baseOccupancy}%`}
              />
            </div>
            <span className="text-[10px] text-slate-400 block">Taux d&apos;occupation normal</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium block">RevPAR de Base</span>
            <strong className="text-violet-700 font-black text-sm tabular-nums">{baseRevPAR} €</strong>
            <span className="text-[10px] text-slate-400 block">RevPAR = ADR × TO</span>
          </div>
        </div>

        {/* High Impact Events Checkbox Selection Strip */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
              <span>Événements à fort impact sélectionnés ({selectedEventIds.length} / {highImpactEvents.length}) :</span>
              <span className="text-[11px] font-normal text-slate-400">
                Cochez ou décochez pour recalculer les projections instantanément
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="text-xs font-semibold text-violet-700 hover:text-violet-900 px-2.5 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 transition-colors cursor-pointer"
              >
                Tout sélectionner
              </button>
              <button
                onClick={handleDeselectAll}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Réinitialiser
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
            {highImpactEvents.map((ev) => {
              const isSelected = selectedEventIds.includes(ev.id);
              const boost = ev.hotelImpacts[currentHotel.id]?.estimatedADRBoostPercent || Math.round(ev.scoreBreakdown.finalRMScore * 0.48);

              return (
                <div
                  key={ev.id}
                  onClick={() => handleToggleEvent(ev.id)}
                  className={`p-3 rounded-2xl border text-xs transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                    isSelected
                      ? 'bg-violet-50/70 border-violet-300 shadow-2xs'
                      : 'bg-white border-slate-200/80 hover:border-slate-300 opacity-60'
                  }`}
                >
                  <div className="mt-0.5 shrink-0 text-violet-600">
                    {isSelected ? <CheckSquare className="w-4 h-4 fill-violet-600 text-white" /> : <Square className="w-4 h-4 text-slate-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`font-bold truncate ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                        {ev.title}
                      </span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 shrink-0 tabular-nums">
                        Score {ev.scoreBreakdown.finalRMScore}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate flex items-center gap-1.5">
                      <span>{formatEventDateRange(ev.startDate, ev.endDate)}</span>
                      <span>·</span>
                      <span className="font-semibold text-emerald-700">ADR +{boost}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Aggregate KPI Impact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Projected RevPAR */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>RevPAR Moyen Projeté</span>
            <DollarSign className="w-4 h-4 text-violet-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
              {summary.avgProjectedRevPAR} €
            </span>
            <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              +{summary.avgRevparGainPercent}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            vs RevPAR Base : <strong className="text-slate-600">{baseRevPAR} €</strong> ({summary.totalDays} nuitées impactées)
          </p>
        </div>

        {/* KPI 2: Daily RevPAR Uplift */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Gain RevPAR Quotidien</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 tabular-nums">
              +{summary.avgRevparGain} €
            </span>
            <span className="text-xs text-slate-500 font-medium">/ ch. / nuit</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Survaleur nette captée grâce à la compression événementielle
          </p>
        </div>

        {/* KPI 3: Projected Occupancy */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Taux d&apos;Occupation Estimé</span>
            <Percent className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-indigo-950 tabular-nums">
              {summary.avgProjectedTO}%
            </span>
            <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              +{summary.avgProjectedTO - baseOccupancy} pts
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            ADR projeté moyen : <strong className="text-slate-600">{summary.avgProjectedADR} €</strong> (vs {baseADR} € base)
          </p>
        </div>

        {/* KPI 4: Total Incremental Revenue */}
        <div className="bg-gradient-to-br from-violet-900 to-indigo-950 text-white rounded-2xl p-5 border border-violet-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-violet-200 text-xs font-semibold">
            <span>CA Additionnel Estimé</span>
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-white tabular-nums">
              +{summary.totalIncrementalRevenue.toLocaleString('fr-FR')} €
            </span>
          </div>
          <p className="text-[11px] text-violet-200/80">
            Sur les {summary.totalDays} nuits des {eventImpacts.length} événements sélectionnés
          </p>
        </div>
      </div>

      {/* Main Recharts Visualization Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-bold text-slate-900">
              Comparatif Graphique : RevPAR de Base vs RevPAR Projeté (€)
            </h4>
            <p className="text-xs text-slate-500">
              Impact unitaire par chambre disponible selon chaque événement majeur modélisé
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-slate-300" />
              <span className="text-slate-600">RevPAR Base ({baseRevPAR} €)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-violet-600" />
              <span className="text-violet-900 font-bold">RevPAR Projeté</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-rose-500" />
              <span className="text-rose-600 font-bold">ADR Projeté (€)</span>
            </div>
          </div>
        </div>

        {eventImpacts.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Info className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-semibold text-sm">Aucun événement sélectionné</p>
            <p className="text-xs">Cochez au moins un événement ci-dessus pour afficher la projection Recharts.</p>
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={eventImpacts}
                margin={{ top: 20, right: 30, left: 10, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="shortTitle"
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  yAxisId="revpar"
                  unit=" €"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                />
                <YAxis
                  yAxisId="adr"
                  orientation="right"
                  unit=" €"
                  stroke="#f43f5e"
                  tick={{ fontSize: 10, fill: '#e11d48' }}
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white rounded-2xl shadow-xl p-4 border border-slate-700/80 text-xs space-y-2 max-w-xs animate-in fade-in zoom-in-95">
                          <div className="font-bold text-sm text-slate-100 leading-tight">
                            {data.title}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center justify-between pb-1 border-b border-slate-800">
                            <span>{data.venueName} ({data.city})</span>
                            <span className="font-bold text-violet-400">Score RM : {data.score}/100</span>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between">
                              <span className="text-slate-400">RevPAR Base :</span>
                              <span className="font-bold tabular-nums text-slate-300">{data.baseRevPAR} €</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-violet-300 font-semibold">RevPAR Projeté :</span>
                              <span className="font-extrabold tabular-nums text-violet-400 text-sm">
                                {data.projectedRevPAR} € (+{data.revparGainPercent}%)
                              </span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-slate-800 text-[11px]">
                              <span className="text-slate-400">ADR Estimé :</span>
                              <span className="font-bold text-rose-400">{data.projectedADR} € (+{data.adrBoostPercent}%)</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-400">TO Estimé :</span>
                              <span className="font-bold text-indigo-300">{data.projectedTO}% (vs {data.baseOccupancy}%)</span>
                            </div>
                            <div className="flex justify-between text-[11px] pt-1 border-t border-slate-800 text-emerald-400 font-bold">
                              <span>Gain Total Événement ({data.durationDays}j) :</span>
                              <span className="tabular-nums">+{data.incrementalRevenue.toLocaleString('fr-FR')} €</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine
                  yAxisId="revpar"
                  y={baseRevPAR}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `RevPAR Base: ${baseRevPAR}€`,
                    position: 'insideTopLeft',
                    fill: '#64748b',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
                {/* Bar 1: RevPAR Base */}
                <Bar
                  yAxisId="revpar"
                  dataKey="baseRevPAR"
                  name="RevPAR Base"
                  fill="#cbd5e1"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
                {/* Bar 2: RevPAR Projected */}
                <Bar
                  yAxisId="revpar"
                  dataKey="projectedRevPAR"
                  name="RevPAR Projeté"
                  fill="#7c3aed"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                >
                  {eventImpacts.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.score >= 80 ? '#7c3aed' : '#9333ea'}
                    />
                  ))}
                </Bar>
                {/* Line: Projected ADR on secondary axis */}
                <Line
                  yAxisId="adr"
                  type="monotone"
                  dataKey="projectedADR"
                  name="ADR Projeté"
                  stroke="#e11d48"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#e11d48', stroke: '#fff', strokeWidth: 1.5 }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Second Breakdown Chart: Incremental Cashflow Generated by Event */}
      {eventImpacts.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-base font-bold text-slate-900">
                Chiffre d&apos;Affaires Additionnel Estimé par Événement (€)
              </h4>
              <p className="text-xs text-slate-500">
                Gain financier brut généré sur l&apos;ensemble de la capacité de {roomCount} chambres pendant la tenue de l&apos;événement
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
              Total cumulé : +{summary.totalIncrementalRevenue.toLocaleString('fr-FR')} €
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={eventImpacts}
                margin={{ top: 10, right: 20, left: 10, bottom: 35 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="shortTitle"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  unit=" €"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `${Math.round(val / 1000)}k€`}
                />
                <RechartsTooltip
                  formatter={(val: any) => [`+${Number(val).toLocaleString('fr-FR')} €`, 'Gain CA additionnel']}
                />
                <Bar
                  dataKey="incrementalRevenue"
                  name="Gain CA Additionnel"
                  radius={[6, 6, 0, 0]}
                  barSize={24}
                >
                  {eventImpacts.map((entry, index) => (
                    <Cell
                      key={`ca-cell-${index}`}
                      fill={
                        entry.impactLevel === 'hyper'
                          ? '#e11d48'
                          : entry.impactLevel === 'critique'
                          ? '#ea580c'
                          : '#10b981'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Yield Recommandations & Implementation Steps */}
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Zap className="w-5 h-5 text-violet-600" />
          <h4 className="text-sm font-bold text-violet-950 uppercase tracking-wide">
            Plan d&apos;Action Revenue Management Recommandé pour {currentHotel.name}
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-white/90 p-4 rounded-2xl border border-violet-100 space-y-1.5">
            <span className="font-bold text-violet-900 block flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-600" />
              1. Verrouillage OTA précoce
            </span>
            <p className="text-slate-600 leading-relaxed">
              Pour les événements avec Score RM &gt; 75, fermer les promotions Booking.com et Expedia à J-90 afin de forcer la réservation directe à plein tarif ADR.
            </p>
          </div>

          <div className="bg-white/90 p-4 rounded-2xl border border-violet-100 space-y-1.5">
            <span className="font-bold text-violet-900 block flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-600" />
              2. Minimum Length of Stay (MinLOS)
            </span>
            <p className="text-slate-600 leading-relaxed">
              Imposer un séjour minimum de 2 à 3 nuits sur les dates charnières afin de combler les nuits de transition et garantir un taux d&apos;occupation de {summary.avgProjectedTO}%.
            </p>
          </div>

          <div className="bg-white/90 p-4 rounded-2xl border border-violet-100 space-y-1.5">
            <span className="font-bold text-violet-900 block flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-600" />
              3. Grille Tarifaire Dynamique
            </span>
            <p className="text-slate-600 leading-relaxed">
              Activer les paliers d&apos;ADR progressifs : ouvrir à +{Math.round(summary.avgRevparGainPercent * 0.6)}% dès détection, puis accélérer à +{summary.avgRevparGainPercent}% dès que le pickup atteint 65%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
