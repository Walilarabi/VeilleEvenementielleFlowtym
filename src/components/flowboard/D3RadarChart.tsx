/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { EventItem, Hotel } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Users,
  Building2,
  Globe2,
  MapPin,
  Flame,
  TrendingUp,
  Info,
  ShieldCheck,
  Award,
} from 'lucide-react';

interface D3RadarChartProps {
  event: EventItem;
  hotel?: Hotel;
  className?: string;
}

interface RadarDimension {
  key: string;
  label: string;
  shortLabel: string;
  rawValue: number;
  maxRaw: number;
  normalizedValue: number; // 0 - 100
  benchmarkValue: number; // 0 - 100
  unit: string;
  color: string;
  icon: React.ReactNode;
  description: string;
}

export const D3RadarChart: React.FC<D3RadarChartProps> = ({
  event,
  hotel,
  className = '',
}) => {
  const { isDark } = useTheme();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredDimension, setHoveredDimension] = useState<RadarDimension | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);

  // Compute normalized dimensions (0 to 100) based on real RM metrics
  const dimensions: RadarDimension[] = useMemo(() => {
    const sb = event.scoreBreakdown;
    const hotelImpact = hotel ? event.hotelImpacts[hotel.id] : undefined;

    // 1. Attractivité & Fréquentation (max 25)
    const rawAttendance = sb.attendanceScore || 15;
    const normAttendance = Math.min(100, Math.round((rawAttendance / 25) * 100));

    // 2. Saturation Marché & Tension (max 20)
    const rawSaturation = sb.saturationScore || 14;
    const normSaturation = Math.min(100, Math.round((rawSaturation / 20) * 100));

    // 3. Rayonnement International (max 20)
    const rawInternational = sb.internationalScore || (event.internationalRatioPercent ? Math.round(event.internationalRatioPercent / 5) : 12);
    const normInternational = Math.min(100, Math.round((rawInternational / 20) * 100));

    // 4. Proximité Géographique & Accès (max 20)
    const rawProximity = sb.proximityScore || (hotelImpact ? Math.max(5, 20 - Math.round(hotelImpact.distanceKm * 2)) : 14);
    const normProximity = Math.min(100, Math.round((rawProximity / 20) * 100));

    // 5. Dynamique Pickup & Vélocité (max 15)
    const rawCompression = sb.compressionScore || 11;
    const normCompression = Math.min(100, Math.round((rawCompression / 15) * 100));

    // 6. Pouvoir d'Achat & ADR Boost
    const adrBoost = hotelImpact ? hotelImpact.estimatedADRBoostPercent : Math.round(sb.finalRMScore * 0.35);
    const normPricingPower = Math.min(100, Math.max(20, Math.round((adrBoost / 35) * 100)));

    return [
      {
        key: 'attendance',
        label: 'Attractivité & Fréquentation',
        shortLabel: 'Fréquentation',
        rawValue: rawAttendance,
        maxRaw: 25,
        normalizedValue: normAttendance,
        benchmarkValue: 55,
        unit: 'pts',
        color: '#6366f1', // Indigo
        icon: <Users className="w-3.5 h-3.5 text-indigo-500" />,
        description: `${event.expectedAttendance.toLocaleString('fr-FR')} pax attendus à ${event.venueName}.`,
      },
      {
        key: 'saturation',
        label: 'Saturation Compset & Tension',
        shortLabel: 'Saturation Marché',
        rawValue: rawSaturation,
        maxRaw: 20,
        normalizedValue: normSaturation,
        benchmarkValue: 60,
        unit: 'pts',
        color: '#8b5cf6', // Violet
        icon: <Flame className="w-3.5 h-3.5 text-amber-500" />,
        description: 'Pression de remplissage estimée sur le périmètre concurrentiel.',
      },
      {
        key: 'international',
        label: 'Rayonnement International',
        shortLabel: 'International',
        rawValue: rawInternational,
        maxRaw: 20,
        normalizedValue: normInternational,
        benchmarkValue: 45,
        unit: 'pts',
        color: '#06b6d4', // Cyan
        icon: <Globe2 className="w-3.5 h-3.5 text-cyan-500" />,
        description: `${event.internationalRatioPercent}% de clientèle étrangère à fort panier moyen.`,
      },
      {
        key: 'proximity',
        label: 'Proximité & Accès Hôtel',
        shortLabel: 'Proximité',
        rawValue: rawProximity,
        maxRaw: 20,
        normalizedValue: normProximity,
        benchmarkValue: 50,
        unit: 'pts',
        color: '#10b981', // Emerald
        icon: <MapPin className="w-3.5 h-3.5 text-emerald-500" />,
        description: hotelImpact ? `${hotelImpact.distanceKm} km · ${hotelImpact.distanceMins} min du lieu.` : 'Distance optimale du cœur événementiel.',
      },
      {
        key: 'compression',
        label: 'Dynamique Pickup & Vélocité',
        shortLabel: 'Pickup Vélocité',
        rawValue: rawCompression,
        maxRaw: 15,
        normalizedValue: normCompression,
        benchmarkValue: 48,
        unit: 'pts',
        color: '#f59e0b', // Amber
        icon: <TrendingUp className="w-3.5 h-3.5 text-amber-500" />,
        description: 'Rythme d’accélération de la prise de réservations OTB.',
      },
      {
        key: 'pricing_power',
        label: 'Pricing Power & ADR Boost',
        shortLabel: 'Levier ADR',
        rawValue: adrBoost,
        maxRaw: 35,
        normalizedValue: normPricingPower,
        benchmarkValue: 52,
        unit: '%',
        color: '#ec4899', // Pink
        icon: <Award className="w-3.5 h-3.5 text-rose-500" />,
        description: `Potentiel de valorisation tarifaire estimé à +${adrBoost}%.`,
      },
    ];
  }, [event, hotel]);

  // Render D3 Radar chart
  useEffect(() => {
    if (!svgRef.current) return;

    const width = 420;
    const height = 380;
    const margin = 55;
    const radius = Math.min(width, height) / 2 - margin;
    const totalAxes = dimensions.length;
    const angleSlice = (Math.PI * 2) / totalAxes;

    // Radius scale (0 to 100)
    const rScale = d3.scaleLinear().domain([0, 100]).range([0, radius]);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Defs: Gradients and Filters
    const defs = svg.append('defs');

    // Radial gradient for event polygon
    const radialGrad = defs
      .append('radialGradient')
      .attr('id', 'radarGradient')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%');

    radialGrad.append('stop').attr('offset', '0%').attr('stop-color', '#8b5cf6').attr('stop-opacity', 0.65);
    radialGrad.append('stop').attr('offset', '70%').attr('stop-color', '#6366f1').attr('stop-opacity', 0.45);
    radialGrad.append('stop').attr('offset', '100%').attr('stop-color', '#4f46e5').attr('stop-opacity', 0.25);

    // Filter glow
    const filter = defs.append('filter').attr('id', 'radarGlow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    filter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // 1. Concentric circular / polygonal grid lines (20%, 40%, 60%, 80%, 100%)
    const levels = [20, 40, 60, 80, 100];

    levels.forEach((lvl) => {
      const r = rScale(lvl);

      // Compute polygon points for this grid level
      const gridPoints: [number, number][] = dimensions.map((_, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        return [r * Math.cos(angle), r * Math.sin(angle)];
      });

      const lineGenerator = d3
        .line<[number, number]>()
        .x((d) => d[0])
        .y((d) => d[1])
        .curve(d3.curveLinearClosed);

      g.append('path')
        .datum(gridPoints)
        .attr('d', lineGenerator)
        .attr('fill', lvl % 40 === 0 ? (isDark ? '#252e42' : '#f8fafc') : 'none')
        .attr('fill-opacity', isDark ? 0.35 : 0.5)
        .attr('stroke', isDark ? '#333f57' : '#e2e8f0')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', lvl === 100 ? 'none' : '3,3');

      // Grid percentage label
      g.append('text')
        .attr('x', 4)
        .attr('y', -r)
        .attr('dy', '0.4em')
        .attr('fill', isDark ? '#71819e' : '#94a3b8')
        .attr('font-size', '9px')
        .attr('font-weight', '600')
        .text(`${lvl}%`);
    });

    // 2. Radiating Axis lines and labels
    dimensions.forEach((dim, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const x = rScale(100) * Math.cos(angle);
      const y = rScale(100) * Math.sin(angle);

      // Axis line
      g.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', x)
        .attr('y2', y)
        .attr('stroke', isDark ? '#4c5a75' : '#cbd5e1')
        .attr('stroke-width', 1.2);

      // Outer endpoint node
      g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 2.5)
        .attr('fill', dim.color);

      // Text label position (push slightly outward)
      const labelRadius = radius + 22;
      const lx = labelRadius * Math.cos(angle);
      const ly = labelRadius * Math.sin(angle);

      let textAnchor = 'middle';
      if (Math.abs(lx) > 10) {
        textAnchor = lx > 0 ? 'start' : 'end';
      }

      const labelGroup = g
        .append('g')
        .attr('class', 'axis-label cursor-pointer')
        .on('mouseenter', (eventMouseEvent) => {
          setHoveredDimension(dim);
          const rect = svgRef.current?.getBoundingClientRect();
          if (rect) {
            setHoverPosition({
              x: eventMouseEvent.clientX - rect.left,
              y: eventMouseEvent.clientY - rect.top,
            });
          }
        })
        .on('mouseleave', () => {
          setHoveredDimension(null);
        });

      labelGroup
        .append('text')
        .attr('x', lx)
        .attr('y', ly)
        .attr('text-anchor', textAnchor)
        .attr('fill', isDark ? '#c5cedd' : '#334155')
        .attr('font-size', '11px')
        .attr('font-weight', '700')
        .text(dim.shortLabel);

      labelGroup
        .append('text')
        .attr('x', lx)
        .attr('y', ly + 12)
        .attr('text-anchor', textAnchor)
        .attr('fill', dim.color)
        .attr('font-size', '10px')
        .attr('font-weight', '800')
        .text(`${dim.normalizedValue}%`);
    });

    // 3. Benchmark Polygon (Compset Average reference at ~55%)
    const benchmarkPoints: [number, number][] = dimensions.map((dim, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const r = rScale(dim.benchmarkValue);
      return [r * Math.cos(angle), r * Math.sin(angle)];
    });

    const benchmarkLine = d3
      .line<[number, number]>()
      .x((d) => d[0])
      .y((d) => d[1])
      .curve(d3.curveLinearClosed);

    g.append('path')
      .datum(benchmarkPoints)
      .attr('d', benchmarkLine)
      .attr('fill', '#64748b')
      .attr('fill-opacity', 0.08)
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,4');

    // 4. Selected Event Polygon (with entrance transition)
    const eventPoints: [number, number][] = dimensions.map((dim, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const r = rScale(dim.normalizedValue);
      return [r * Math.cos(angle), r * Math.sin(angle)];
    });

    const eventLine = d3
      .line<[number, number]>()
      .x((d) => d[0])
      .y((d) => d[1])
      .curve(d3.curveLinearClosed);

    // Initial zero path for animation
    const zeroPoints: [number, number][] = dimensions.map((_, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      return [0, 0];
    });

    const polygonPath = g
      .append('path')
      .datum(zeroPoints)
      .attr('d', eventLine)
      .attr('fill', 'url(#radarGradient)')
      .attr('stroke', '#6366f1')
      .attr('stroke-width', 2.5)
      .attr('filter', 'url(#radarGlow)')
      .attr('class', 'radar-polygon transition-all');

    // Animate to full coordinates
    polygonPath
      .transition()
      .duration(750)
      .ease(d3.easeCubicOut)
      .attr('d', eventLine(eventPoints));

    // 5. Interactive Vertex points
    eventPoints.forEach((pt, i) => {
      const dim = dimensions[i];

      const vertex = g
        .append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 5)
        .attr('fill', isDark ? '#1c2231' : '#ffffff')
        .attr('stroke', dim.color)
        .attr('stroke-width', 2.5)
        .attr('class', 'cursor-pointer transition-transform hover:scale-150');

      vertex
        .transition()
        .duration(750)
        .ease(d3.easeCubicOut)
        .attr('cx', pt[0])
        .attr('cy', pt[1]);

      // Invisible larger hover target
      g.append('circle')
        .attr('cx', pt[0])
        .attr('cy', pt[1])
        .attr('r', 16)
        .attr('fill', 'transparent')
        .attr('class', 'cursor-pointer')
        .on('mouseenter', (eventMouseEvent) => {
          vertex.attr('r', 7.5).attr('stroke-width', 3.5);
          setHoveredDimension(dim);
          const rect = svgRef.current?.getBoundingClientRect();
          if (rect) {
            setHoverPosition({
              x: eventMouseEvent.clientX - rect.left,
              y: eventMouseEvent.clientY - rect.top,
            });
          }
        })
        .on('mouseleave', () => {
          vertex.attr('r', 5).attr('stroke-width', 2.5);
          setHoveredDimension(null);
        });
    });
  }, [dimensions, isDark]);

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs flex flex-col ${className}`}>
      {/* Header with Title and Score Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Radar d’Impact Revenue Management (D3.js)
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/70">
              6 Dimensions
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Profil multi-axes pour <strong>{event.title}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="text-right">
            <div className="text-xs text-slate-400 font-semibold uppercase">Score RM Global</div>
            <div className="text-lg font-black text-slate-900 dark:text-slate-100 tabular-nums">
              {event.scoreBreakdown.finalRMScore}/100
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 flex items-center justify-center font-bold text-xs border border-violet-200 dark:border-violet-800/70">
            {event.impactLevel === 'hyper'
              ? '⚡ Hyper'
              : event.impactLevel === 'critique'
              ? '🔥 Fort'
              : '⚖️ Modéré'}
          </div>
        </div>
      </div>

      {/* Main Graphic Area with SVG & Relative Tooltip */}
      <div className="relative flex items-center justify-center py-2 overflow-hidden min-h-[360px]">
        <svg
          ref={svgRef}
          viewBox="0 0 420 380"
          className="w-full max-w-[420px] h-auto select-none"
        />

        {/* Hover Tooltip Overlay */}
        {hoveredDimension && hoverPosition && (
          <div
            className="absolute z-30 pointer-events-none bg-slate-900/95 backdrop-blur-sm text-white rounded-xl p-3 shadow-xl border border-slate-700 text-xs w-56 animate-in fade-in duration-150"
            style={{
              left: Math.min(260, Math.max(10, hoverPosition.x - 110)),
              top: Math.max(10, hoverPosition.y - 75),
            }}
          >
            <div className="flex items-center justify-between gap-1 border-b border-slate-800 pb-1.5 mb-1.5">
              <span className="font-bold text-slate-100 flex items-center gap-1.5">
                {hoveredDimension.icon}
                <span>{hoveredDimension.label}</span>
              </span>
              <span
                className="font-black px-1.5 py-0.5 rounded text-[10px]"
                style={{ backgroundColor: hoveredDimension.color, color: '#fff' }}
              >
                {hoveredDimension.normalizedValue}%
              </span>
            </div>
            <div className="text-[11px] text-slate-300 leading-tight">
              {hoveredDimension.description}
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
              <span>Score brut: {hoveredDimension.rawValue} / {hoveredDimension.maxRaw} {hoveredDimension.unit}</span>
              <span>Benchmark: {hoveredDimension.benchmarkValue}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Chart Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 py-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-gradient-to-r from-violet-600 to-indigo-600 border border-violet-700" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">Événement analysé</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 border-t-2 border-dashed border-slate-400" />
          <span>Moyenne Marché & Compset (55%)</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Info className="w-3.5 h-3.5" />
          <span>Survoler les sommets pour le détail</span>
        </div>
      </div>

      {/* Breakdown Metrics Grid (6 Categories) */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        {dimensions.map((dim) => (
          <div
            key={dim.key}
            onMouseEnter={() => setHoveredDimension(dim)}
            onMouseLeave={() => setHoveredDimension(null)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              hoveredDimension?.key === dim.key
                ? 'bg-violet-50/80 dark:bg-violet-950/45 border-violet-300 dark:border-violet-700/70 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-100/70 dark:hover:bg-slate-800/80'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 truncate">
                {dim.icon}
                <span className="truncate">{dim.shortLabel}</span>
              </span>
              <span className="font-black text-slate-900 dark:text-slate-100 tabular-nums shrink-0 ml-1">
                {dim.normalizedValue}%
              </span>
            </div>

            {/* Micro progress bar */}
            <div className="w-full bg-slate-200/80 dark:bg-slate-700/60 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${dim.normalizedValue}%`,
                  backgroundColor: dim.color,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
              <span>{dim.rawValue}/{dim.maxRaw} {dim.unit}</span>
              <span className={dim.normalizedValue >= dim.benchmarkValue ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}>
                {dim.normalizedValue >= dim.benchmarkValue ? `+${dim.normalizedValue - dim.benchmarkValue}%` : `${dim.normalizedValue - dim.benchmarkValue}%`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
