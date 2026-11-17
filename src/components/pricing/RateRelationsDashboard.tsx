/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM REVENUE — RATE RELATIONS DASHBOARD
 * Représentation graphique interactive du graphe de dépendances entre le tarif de référence
 * actif, les plans tarifaires dérivés (multi-niveaux) et les plans indépendants protégés.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  GitBranch,
  Lock,
  RotateCcw,
  Settings,
  ShieldAlert,
  Target,
} from 'lucide-react';
import {
  Hotel,
  HotelTariffConfiguration,
  RateCalendarCell,
  RatePlanConfig,
} from '../../types';
import {
  computeDerivedRateForPlan,
  detectCircularDependencies,
  resolveCascadeForRootPlan,
  resolveReferencePlanCode,
} from '../../services/tariffConfigurationService';
import { buildCellKey } from '../../services/ratePlanningSyncService';
import { getTodayIsoDate } from '../../utils/eventFilterUtils';

interface RateRelationsDashboardProps {
  hotel: Hotel;
  tariffConfig: HotelTariffConfiguration;
  cells: RateCalendarCell[];
  visibleDates: string[];
  onInspectPlanningCell?: (cellKey: string) => void;
  onOpenConfigRelations: () => void;
}

interface PositionedNode {
  plan: RatePlanConfig;
  role: 'reference' | 'derived' | 'independent';
  level: number;
  x: number;
  y: number;
  formulaLabel: string;
  currentCellRate: number | null;
  simulatedRate: number | null;
}

interface GraphEdge {
  id: string;
  fromCode: string;
  toCode: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  formulaLabel: string;
  isActive: boolean;
}

const NODE_WIDTH = 228;
const NODE_HEIGHT = 96;
const COL_GAP = 86;
const ROW_GAP = 24;
const PADDING_X = 28;
const PADDING_Y = 28;

function formatFormulaLabel(plan: RatePlanConfig, isRef: boolean): string {
  if (isRef) return 'Tarif de référence actif';
  if (
    plan.planNature === 'independent' ||
    plan.calculationMode === 'independent' ||
    !plan.referencePlanCode
  ) {
    return 'Indépendant (protégé)';
  }
  if (!plan.relationActive) {
    return `Relation suspendue (${plan.referencePlanCode})`;
  }
  switch (plan.calculationMode) {
    case 'percent_minus':
      return `-${plan.variationValue}% vs ${plan.referencePlanCode}`;
    case 'percent_plus':
      return `+${plan.variationValue}% vs ${plan.referencePlanCode}`;
    case 'fixed_minus':
      return `-${plan.variationValue}€ vs ${plan.referencePlanCode}`;
    case 'fixed_plus':
      return `+${plan.variationValue}€ vs ${plan.referencePlanCode}`;
    case 'multiplier':
      return `×${plan.variationValue} ${plan.referencePlanCode}`;
    case 'custom_formula':
      return plan.customFormula || `Formule vs ${plan.referencePlanCode}`;
    default:
      return 'Indépendant';
  }
}

export const RateRelationsDashboard: React.FC<RateRelationsDashboardProps> = ({
  hotel,
  tariffConfig,
  cells,
  visibleDates,
  onInspectPlanningCell,
  onOpenConfigRelations,
}) => {
  const activeCategories = useMemo(
    () => tariffConfig.roomCategories.filter((c) => c.isActive && !c.isArchived),
    [tariffConfig.roomCategories]
  );

  const [selectedCategory, setSelectedCategory] = useState<string>(
    () => activeCategories[0]?.code || 'classique'
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    () => visibleDates[0] || getTodayIsoDate()
  );
  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null);
  const [hoveredPlanCode, setHoveredPlanCode] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCategories.some((c) => c.code === selectedCategory)) {
      setSelectedCategory(activeCategories[0]?.code || 'classique');
    }
  }, [activeCategories, selectedCategory]);

  useEffect(() => {
    if (visibleDates.length > 0 && !visibleDates.includes(selectedDate)) {
      setSelectedDate(visibleDates[0]);
    }
  }, [visibleDates, selectedDate]);

  const activeReferenceCode = useMemo(
    () => resolveReferencePlanCode(tariffConfig, selectedCategory, selectedDate),
    [tariffConfig, selectedCategory, selectedDate]
  );

  const cellByPlan = useMemo(() => {
    const map = new Map<string, RateCalendarCell>();
    cells.forEach((c) => {
      if (c.roomTypeCode === selectedCategory && c.stayDate === selectedDate) {
        map.set(c.ratePlanCode, c);
      }
    });
    return map;
  }, [cells, selectedCategory, selectedDate]);

  const actualReferenceRate = useMemo(() => {
    const cell = cellByPlan.get(activeReferenceCode);
    return cell?.currentRateEur ?? Math.max(120, hotel.baseADR);
  }, [cellByPlan, activeReferenceCode, hotel.baseADR]);

  const [simulatedRefRate, setSimulatedRefRate] = useState<number>(actualReferenceRate);

  useEffect(() => {
    setSimulatedRefRate(actualReferenceRate);
  }, [actualReferenceRate, selectedCategory, selectedDate, activeReferenceCode]);

  const cycle = useMemo(
    () => detectCircularDependencies(tariffConfig.ratePlans),
    [tariffConfig.ratePlans]
  );

  const activePlans = useMemo(
    () =>
      tariffConfig.ratePlans.filter(
        (p) =>
          p.status !== 'archived' &&
          (p.roomCategoryCodes.length === 0 || p.roomCategoryCodes.includes(selectedCategory))
      ),
    [tariffConfig.ratePlans, selectedCategory]
  );

  const simulatedCascadeMap = useMemo(() => {
    const map = new Map<string, number>();
    map.set(activeReferenceCode, simulatedRefRate);
    const cascaded = resolveCascadeForRootPlan({
      rootPlanCode: activeReferenceCode,
      rootNewRateEur: simulatedRefRate,
      config: tariffConfig,
      roomCategoryCode: selectedCategory,
      stayDate: selectedDate,
    });
    cascaded.forEach((item) => map.set(item.planCode, item.computedRateEur));

    // Compléter les plans dérivés rattachés à un autre parent actif (hors cascade directe de la réf)
    activePlans.forEach((p) => {
      if (!map.has(p.code) && p.referencePlanCode && map.has(p.referencePlanCode)) {
        const parentRate = map.get(p.referencePlanCode)!;
        const val = computeDerivedRateForPlan({
          referenceRateEur: parentRate,
          targetPlan: p,
          config: tariffConfig,
          roomCategoryCode: selectedCategory,
          stayDate: selectedDate,
        });
        if (val !== null) map.set(p.code, val);
      }
    });

    return map;
  }, [activeReferenceCode, simulatedRefRate, tariffConfig, selectedCategory, selectedDate, activePlans]);

  // Construction topologique des colonnes du graphe
  const graphLayout = useMemo(() => {
    const planByCode = new Map(activePlans.map((p) => [p.code, p]));
    const levels = new Map<string, number>();
    const independentPlans: RatePlanConfig[] = [];

    const resolveLevel = (code: string, trail: Set<string>): number => {
      if (levels.has(code)) return levels.get(code)!;
      if (code === activeReferenceCode) {
        levels.set(code, 0);
        return 0;
      }
      const p = planByCode.get(code);
      if (
        !p ||
        p.planNature === 'independent' ||
        p.calculationMode === 'independent' ||
        !p.referencePlanCode
      ) {
        return -1;
      }
      if (trail.has(code)) return 1;
      const nextTrail = new Set(trail);
      nextTrail.add(code);
      const parentLvl = resolveLevel(p.referencePlanCode, nextTrail);
      const lvl = parentLvl >= 0 ? parentLvl + 1 : 1;
      levels.set(code, lvl);
      return lvl;
    };

    activePlans.forEach((p) => {
      if (p.code === activeReferenceCode) {
        levels.set(p.code, 0);
        return;
      }
      if (
        p.planNature === 'independent' ||
        p.calculationMode === 'independent' ||
        !p.referencePlanCode
      ) {
        independentPlans.push(p);
        return;
      }
      resolveLevel(p.code, new Set());
    });

    const columns = new Map<number, RatePlanConfig[]>();
    activePlans.forEach((p) => {
      const lvl = levels.get(p.code);
      if (lvl === undefined || lvl < 0) return;
      const list = columns.get(lvl) || [];
      list.push(p);
      columns.set(lvl, list);
    });

    const maxDerivedCol = Math.max(0, ...Array.from(columns.keys()));
    const independentColIdx = independentPlans.length > 0 ? maxDerivedCol + 1 : -1;

    const nodes: PositionedNode[] = [];
    const nodeMap = new Map<string, PositionedNode>();

    const placeColumn = (colIdx: number, plansInCol: RatePlanConfig[], isIndependentLane: boolean) => {
      plansInCol.forEach((p, rowIdx) => {
        const isRef = p.code === activeReferenceCode;
        const role: PositionedNode['role'] = isRef
          ? 'reference'
          : isIndependentLane
          ? 'independent'
          : 'derived';
        const cell = cellByPlan.get(p.code);
        const currentCellRate = cell?.currentRateEur ?? null;
        const simRate =
          role === 'independent'
            ? currentCellRate
            : simulatedCascadeMap.get(p.code) ?? currentCellRate;

        const node: PositionedNode = {
          plan: p,
          role,
          level: colIdx,
          x: PADDING_X + colIdx * (NODE_WIDTH + COL_GAP),
          y: PADDING_Y + rowIdx * (NODE_HEIGHT + ROW_GAP),
          formulaLabel: formatFormulaLabel(p, isRef),
          currentCellRate,
          simulatedRate: simRate,
        };
        nodes.push(node);
        nodeMap.set(p.code, node);
      });
    };

    Array.from(columns.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([colIdx, list]) => placeColumn(colIdx, list, false));

    if (independentPlans.length > 0 && independentColIdx >= 0) {
      placeColumn(independentColIdx, independentPlans, true);
    }

    const edges: GraphEdge[] = [];
    nodes.forEach((target) => {
      if (target.role !== 'derived' || !target.plan.referencePlanCode) return;
      const source = nodeMap.get(target.plan.referencePlanCode);
      if (!source) return;
      edges.push({
        id: `${source.plan.code}->${target.plan.code}`,
        fromCode: source.plan.code,
        toCode: target.plan.code,
        x1: source.x + NODE_WIDTH,
        y1: source.y + NODE_HEIGHT / 2,
        x2: target.x,
        y2: target.y + NODE_HEIGHT / 2,
        formulaLabel: target.formulaLabel,
        isActive: target.plan.relationActive && target.plan.status === 'active',
      });
    });

    const totalCols = independentColIdx >= 0 ? independentColIdx + 1 : maxDerivedCol + 1;
    const maxRowsInCol = Math.max(
      1,
      ...Array.from(columns.values()).map((l) => l.length),
      independentPlans.length
    );
    const canvasWidth = Math.max(720, PADDING_X * 2 + totalCols * NODE_WIDTH + Math.max(0, totalCols - 1) * COL_GAP);
    const canvasHeight = Math.max(280, PADDING_Y * 2 + maxRowsInCol * NODE_HEIGHT + Math.max(0, maxRowsInCol - 1) * ROW_GAP);

    return {
      nodes,
      edges,
      nodeMap,
      canvasWidth,
      canvasHeight,
      independentColIdx,
      maxDerivedCol,
    };
  }, [activePlans, activeReferenceCode, cellByPlan, simulatedCascadeMap]);

  const focusCode = hoveredPlanCode || selectedPlanCode || activeReferenceCode;

  const connectedSet = useMemo(() => {
    const set = new Set<string>();
    if (!focusCode) return set;
    set.add(focusCode);
    // Downstream BFS
    const queue = [focusCode];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      graphLayout.edges.forEach((e) => {
        if (e.fromCode === cur && !set.has(e.toCode)) {
          set.add(e.toCode);
          queue.push(e.toCode);
        }
      });
    }
    // Upstream walk
    let cursor = focusCode;
    const guard = new Set<string>();
    while (cursor && !guard.has(cursor)) {
      guard.add(cursor);
      const node = graphLayout.nodeMap.get(cursor);
      const parent = node?.plan.referencePlanCode;
      if (parent && graphLayout.nodeMap.has(parent)) {
        set.add(parent);
        cursor = parent;
      } else {
        break;
      }
    }
    return set;
  }, [focusCode, graphLayout.edges, graphLayout.nodeMap]);

  const inspectedNode =
    graphLayout.nodeMap.get(selectedPlanCode || activeReferenceCode) ||
    graphLayout.nodes[0] ||
    null;

  return (
    <section
      aria-label="Graphe des relations tarifaires"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5"
    >
      {/* EN-TÊTE + CONTRÔLES DE SIMULATION CONTEXTUELLE */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <GitBranch className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Graphe des Relations Tarifaires
            </h3>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Référence active : <strong className="text-violet-600 dark:text-violet-400">{activeReferenceCode}</strong> ·{' '}
              {graphLayout.edges.length} dérivation(s) ·{' '}
              {graphLayout.nodes.filter((n) => n.role === 'independent').length} plan(s) indépendant(s)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Visualisez l&apos;impact en cascade d&apos;une variation du tarif de référence sur chaque niveau dérivé tout en vérifiant l&apos;isolation des tarifs indépendants.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Catégorie de chambre pour le graphe"
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-100"
          >
            {activeCategories.map((cat) => (
              <option key={cat.code} value={cat.code}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            aria-label="Date de séjour pour le graphe"
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-100 tabular-nums"
          >
            {(visibleDates.length > 0 ? visibleDates : [getTodayIsoDate()]).map((dt) => (
              <option key={dt} value={dt}>
                {dt}
              </option>
            ))}
          </select>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Simuler {activeReferenceCode} :
            </span>
            <input
              type="number"
              min={50}
              max={2500}
              value={simulatedRefRate}
              onChange={(e) => setSimulatedRefRate(Math.max(50, Number(e.target.value) || 50))}
              className="w-20 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-slate-100 tabular-nums text-right"
              aria-label="Tarif de référence simulé"
            />
            <span className="text-[11px] font-semibold text-slate-500">{tariffConfig.currency}</span>
            {simulatedRefRate !== actualReferenceRate && (
              <button
                type="button"
                onClick={() => setSimulatedRefRate(actualReferenceRate)}
                className="p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"
                title="Réinitialiser au tarif actuel du planning"
                aria-label="Réinitialiser la simulation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenConfigRelations}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Settings className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            <span>Éditer formules</span>
          </button>
        </div>
      </div>

      {cycle && (
        <div className="p-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Dépendance circulaire détectée : {cycle.join(' → ')}. Veuillez corriger la chaîne dans la configuration.</span>
        </div>
      )}

      {/* CORPS PRINCIPAL : GRAPHE NODAL + INSPECTEUR LATÉRAL */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 overflow-x-auto">
          <div
            className="relative"
            style={{ width: graphLayout.canvasWidth, height: graphLayout.canvasHeight }}
          >
            {/* En-têtes de colonnes topologiques */}
            <div className="absolute top-1.5 left-0 right-0 flex pointer-events-none text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              {Array.from({ length: graphLayout.maxDerivedCol + 1 }).map((_, idx) => (
                <div
                  key={idx}
                  style={{ left: PADDING_X + idx * (NODE_WIDTH + COL_GAP), width: NODE_WIDTH }}
                  className="absolute truncate"
                >
                  {idx === 0 ? '01. Tarif de référence' : `0${idx + 1}. Dérivé niveau ${idx}`}
                </div>
              ))}
              {graphLayout.independentColIdx >= 0 && (
                <div
                  style={{
                    left: PADDING_X + graphLayout.independentColIdx * (NODE_WIDTH + COL_GAP),
                    width: NODE_WIDTH,
                  }}
                  className="absolute truncate"
                >
                  Plans indépendants (isolés)
                </div>
              )}
            </div>

            {/* Couche SVG des liens de dérivation */}
            <svg
              width={graphLayout.canvasWidth}
              height={graphLayout.canvasHeight}
              className="absolute inset-0 pointer-events-none"
            >
              <defs>
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" className="fill-violet-500" />
                </marker>
                <marker
                  id="arrow-muted"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" className="fill-slate-400 dark:fill-slate-600" />
                </marker>
              </defs>

              {/* Ligne de séparation verticale avant les plans indépendants */}
              {graphLayout.independentColIdx >= 0 && (
                <line
                  x1={
                    PADDING_X +
                    graphLayout.independentColIdx * (NODE_WIDTH + COL_GAP) -
                    COL_GAP / 2
                  }
                  y1={20}
                  x2={
                    PADDING_X +
                    graphLayout.independentColIdx * (NODE_WIDTH + COL_GAP) -
                    COL_GAP / 2
                  }
                  y2={graphLayout.canvasHeight - 16}
                  strokeDasharray="4 4"
                  className="stroke-slate-300 dark:stroke-slate-700"
                  strokeWidth={1}
                />
              )}

              {graphLayout.edges.map((edge) => {
                const isHighlighted =
                  connectedSet.has(edge.fromCode) && connectedSet.has(edge.toCode);
                const midX = (edge.x1 + edge.x2) / 2;
                const d = `M ${edge.x1} ${edge.y1} C ${midX} ${edge.y1}, ${midX} ${edge.y2}, ${edge.x2 - 4} ${edge.y2}`;
                return (
                  <g key={edge.id}>
                    <path
                      d={d}
                      fill="none"
                      strokeWidth={isHighlighted ? 2.25 : 1.5}
                      strokeDasharray={edge.isActive ? undefined : '5 4'}
                      markerEnd={isHighlighted ? 'url(#arrow-active)' : 'url(#arrow-muted)'}
                      className={
                        isHighlighted
                          ? 'stroke-violet-500 dark:stroke-violet-400 transition-colors'
                          : 'stroke-slate-300 dark:stroke-slate-700 transition-colors'
                      }
                    />
                  </g>
                );
              })}
            </svg>

            {/* Nœuds interactifs */}
            {graphLayout.nodes.map((node) => {
              const isSelected = inspectedNode?.plan.code === node.plan.code;
              const isInChain = connectedSet.has(node.plan.code);
              const delta =
                node.simulatedRate !== null && node.currentCellRate !== null
                  ? Math.round((node.simulatedRate - node.currentCellRate) * 100) / 100
                  : 0;

              const borderClass =
                node.role === 'reference'
                  ? 'border-violet-500 bg-violet-50/70 dark:bg-violet-950/40 dark:border-violet-500/80'
                  : node.role === 'independent'
                  ? 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                  : isSelected || isInChain
                  ? 'border-violet-400 dark:border-violet-600 bg-white dark:bg-slate-900'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-80';

              return (
                <button
                  key={node.plan.code}
                  type="button"
                  onClick={() => setSelectedPlanCode(node.plan.code)}
                  onMouseEnter={() => setHoveredPlanCode(node.plan.code)}
                  onMouseLeave={() => setHoveredPlanCode(null)}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: NODE_WIDTH,
                    height: NODE_HEIGHT,
                  }}
                  className={`absolute text-left rounded-xl border p-3 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${borderClass} ${
                    isSelected ? 'ring-2 ring-violet-500/40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {node.plan.code}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
                      {node.role === 'reference' && (
                        <>
                          <Target className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                          <span className="text-violet-700 dark:text-violet-300 font-semibold">Référence</span>
                        </>
                      )}
                      {node.role === 'independent' && (
                        <>
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>Indépendant</span>
                        </>
                      )}
                      {node.role === 'derived' && (
                        <span>
                          {node.plan.relationActive ? `Niv. ${node.level}` : 'Suspendu'}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                    {node.plan.name}
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 truncate">
                      {node.formulaLabel}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                      {node.simulatedRate !== null ? `${node.simulatedRate} ${tariffConfig.currency}` : '—'}
                      {delta !== 0 && (
                        <span
                          className={`ml-1 text-[10px] ${
                            delta > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          ({delta > 0 ? '+' : ''}
                          {delta})
                        </span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* INSPECTEUR DU NŒUD SÉLECTIONNÉ */}
        <div className="xl:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 p-4 space-y-3 text-xs">
          {inspectedNode ? (
            <>
              <div className="pb-2.5 border-b border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Détail du plan sélectionné
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {inspectedNode.plan.code} — {inspectedNode.plan.name}
                </div>
              </div>

              <dl className="space-y-2 text-[11px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Rôle moteur</dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100">
                    {inspectedNode.role === 'reference'
                      ? 'Tarif de référence'
                      : inspectedNode.role === 'independent'
                      ? 'Indépendant (non dérivé)'
                      : `Dérivé niveau ${inspectedNode.level}`}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Règle de calcul</dt>
                  <dd className="font-mono text-slate-800 dark:text-slate-200 text-right">
                    {inspectedNode.formulaLabel}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Tarif actuel ({selectedDate})</dt>
                  <dd className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {inspectedNode.currentCellRate !== null
                      ? `${inspectedNode.currentCellRate} ${tariffConfig.currency}`
                      : 'Non matérialisé'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Tarif simulé</dt>
                  <dd className="font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                    {inspectedNode.simulatedRate !== null
                      ? `${inspectedNode.simulatedRate} ${tariffConfig.currency}`
                      : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Annulation</dt>
                  <dd className="font-medium text-slate-700 dark:text-slate-300">
                    {inspectedNode.plan.cancellationPolicy}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Canaux</dt>
                  <dd className="font-mono text-[10px] text-slate-600 dark:text-slate-400 text-right">
                    {inspectedNode.plan.channels.join(', ')}
                  </dd>
                </div>
              </dl>

              {onInspectPlanningCell && inspectedNode.currentCellRate !== null && (
                <button
                  type="button"
                  onClick={() =>
                    onInspectPlanningCell(
                      buildCellKey(hotel.id, selectedCategory, inspectedNode.plan.code, selectedDate)
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 dark:bg-violet-600 hover:bg-slate-800 dark:hover:bg-violet-700 text-white font-semibold cursor-pointer transition-colors"
                >
                  Inspecter la cellule dans le Planning
                </button>
              )}
            </>
          ) : (
            <p className="text-slate-500">Aucun plan tarifaire actif pour cette catégorie.</p>
          )}
        </div>
      </div>
    </section>
  );
};
