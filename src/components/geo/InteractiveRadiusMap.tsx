/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Building,
  Navigation,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Car,
  Train,
  CheckCircle2,
  Users,
  Compass,
} from 'lucide-react';
import { Hotel, VenueGeoDetail } from '../../types';

interface InteractiveRadiusMapProps {
  hotel: Hotel;
  otherHotels: Hotel[];
  venues: VenueGeoDetail[];
  mainRadiusKm: number;
  extendedRadiusKm: number;
  onSelectVenue?: (venue: VenueGeoDetail) => void;
}

export const InteractiveRadiusMap: React.FC<InteractiveRadiusMapProps> = ({
  hotel,
  otherHotels,
  venues,
  mainRadiusKm,
  extendedRadiusKm,
  onSelectVenue,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredVenue, setHoveredVenue] = useState<VenueGeoDetail | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<VenueGeoDetail | null>(null);
  const [showMainRadius, setShowMainRadius] = useState(true);
  const [showExtendedRadius, setShowExtendedRadius] = useState(true);
  const [showOtherHotels, setShowOtherHotels] = useState(true);

  // Center coordinate
  const centerLat = hotel.lat;
  const centerLng = hotel.lng;

  // 1 degree latitude ~ 111.2 km
  // 1 degree longitude at 48.8°N ~ 111.2 * cos(48.8°) ~ 73.2 km
  const kmPerLat = 111.2;
  const kmPerLng = 73.2;

  // Viewport bounds: 35 km radius in SVG canvas (viewBox 0 0 800 600, center at 400, 300)
  const svgWidth = 800;
  const svgHeight = 600;
  const cx = svgWidth / 2;
  const cy = svgHeight / 2;

  // Scale: 35 km corresponds to 260 pixels at zoom = 1
  const pixelsPerKm = (260 / 35) * zoomLevel;

  // Convert (lat, lng) to SVG (x, y)
  const coordsToSvg = (lat: number, lng: number) => {
    const deltaLatKm = (lat - centerLat) * kmPerLat;
    const deltaLngKm = (lng - centerLng) * kmPerLng;

    const x = cx + deltaLngKm * pixelsPerKm;
    const y = cy - deltaLatKm * pixelsPerKm; // SVG y goes downwards
    return { x, y };
  };

  const mainRadiusPixels = mainRadiusKm * pixelsPerKm;
  const extendedRadiusPixels = extendedRadiusKm * pixelsPerKm;

  // Communes labels to render on the map
  const COMMUNE_LABELS = [
    { name: 'Paris (Intra-muros)', lat: 48.8566, lng: 2.3522 },
    { name: 'Saint-Denis', lat: 48.936, lng: 2.357 },
    { name: 'Nanterre', lat: 48.892, lng: 2.206 },
    { name: 'Villepinte', lat: 48.965, lng: 2.53 },
    { name: 'Le Bourget', lat: 48.935, lng: 2.425 },
    { name: 'Boulogne-Billancourt', lat: 48.839, lng: 2.239 },
    { name: 'Versailles', lat: 48.801, lng: 2.13 },
  ];

  return (
    <div className="relative bg-slate-900 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-800 shadow-md select-none">
      {/* Map Header Overlay */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
        <div className="bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/80 text-white shadow-lg flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-violet-400 animate-pulse" />
          <div className="text-xs">
            <span className="text-slate-400 font-medium">Établissement actif :</span>{' '}
            <strong className="text-white font-bold">{hotel.name}</strong>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs text-slate-300">
          <Navigation className="w-3.5 h-3.5 text-violet-400" />
          <span>
            {hotel.lat.toFixed(4)}°N, {hotel.lng.toFixed(4)}°E
          </span>
        </div>
      </div>

      {/* Map Control Tools (Zoom & Toggles) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 pointer-events-auto">
        <div className="flex flex-col bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/80 overflow-hidden shadow-lg">
          <button
            onClick={() => setZoomLevel((z) => Math.min(2.2, z + 0.25))}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            title="Zoom avant"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="h-px bg-slate-800" />
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.25))}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            title="Zoom arrière"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-px bg-slate-800" />
          <button
            onClick={() => setZoomLevel(1)}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            title="Réinitialiser le zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Layer Toggles */}
        <div className="flex flex-col bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/80 p-1.5 space-y-1 text-[11px] shadow-lg">
          <button
            onClick={() => setShowMainRadius(!showMainRadius)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors text-left ${
              showMainRadius ? 'bg-violet-950/80 text-violet-300 border border-violet-800/60' : 'text-slate-400 hover:bg-slate-800 dark:hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-violet-500" />
            <span>Rayon 10 km</span>
          </button>
          <button
            onClick={() => setShowExtendedRadius(!showExtendedRadius)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors text-left ${
              showExtendedRadius ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60' : 'text-slate-400 hover:bg-slate-800 dark:hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Rayon 30 km</span>
          </button>
          <button
            onClick={() => setShowOtherHotels(!showOtherHotels)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors text-left ${
              showOtherHotels ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60' : 'text-slate-400 hover:bg-slate-800 dark:hover:bg-slate-700'
            }`}
          >
            <Building className="w-3 h-3 text-blue-400" />
            <span>Autres hôtels</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Map */}
      <div className="w-full h-[540px] overflow-hidden relative cursor-crosshair">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#252e42" strokeWidth="0.75" />
            </pattern>

            {/* Radial Gradient for 10km Primary Zone */}
            <radialGradient id="mainRadiusGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.28" />
              <stop offset="70%" stopColor="#8b5cf6" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
            </radialGradient>

            {/* Radial Gradient for 30km Extended Zone */}
            <radialGradient id="extendedRadiusGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.08" />
              <stop offset="75%" stopColor="#f59e0b" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.01" />
            </radialGradient>

            {/* Hotel Pulse Glow Filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
            </filter>
          </defs>

          {/* Background Grid */}
          <rect width={svgWidth} height={svgHeight} fill="#141824" />
          <rect width={svgWidth} height={svgHeight} fill="url(#grid)" />

          {/* Concentric Distance Rings (5km, 10km, 20km, 30km) */}
          {[5, 10, 20, 30].map((dist) => {
            const r = dist * pixelsPerKm;
            return (
              <g key={`ring-${dist}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity={0.4}
                />
                <text
                  x={cx + r + 4}
                  y={cy - 6}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {dist} km
                </text>
              </g>
            );
          })}

          {/* Extended Radius 30 km (Amber fill and dashed stroke) */}
          {showExtendedRadius && (
            <g>
              <circle
                cx={cx}
                cy={cy}
                r={extendedRadiusPixels}
                fill="url(#extendedRadiusGradient)"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                opacity={0.85}
              />
              <text
                x={cx}
                y={cy - extendedRadiusPixels - 8}
                textAnchor="middle"
                fill="#f59e0b"
                fontSize="11"
                fontWeight="bold"
                letterSpacing="0.05em"
              >
                PÉRIMÈTRE ÉTENDU : {extendedRadiusKm} KM (SALONS MAJEURS & CONGRÈS)
              </text>
            </g>
          )}

          {/* Primary Radius 10 km (Violet fill and dashed stroke) */}
          {showMainRadius && (
            <g>
              <circle
                cx={cx}
                cy={cy}
                r={mainRadiusPixels}
                fill="url(#mainRadiusGradient)"
                stroke="#8b5cf6"
                strokeWidth="2"
                strokeDasharray="4 3"
                opacity={0.9}
              />
              <text
                x={cx}
                y={cy - mainRadiusPixels - 8}
                textAnchor="middle"
                fill="#a78bfa"
                fontSize="11"
                fontWeight="bold"
                letterSpacing="0.05em"
              >
                PÉRIMÈTRE PRINCIPAL : {mainRadiusKm} KM (RECHERCHE EXHAUSTIVE)
              </text>
            </g>
          )}

          {/* Communes and Neighboring Cities Text Labels */}
          {COMMUNE_LABELS.map((com) => {
            const pt = coordsToSvg(com.lat, com.lng);
            return (
              <g key={com.name}>
                <circle cx={pt.x} cy={pt.y} r="2.5" fill="#475569" />
                <text
                  x={pt.x}
                  y={pt.y + 14}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="9.5"
                  fontWeight="500"
                  opacity={0.75}
                >
                  {com.name}
                </text>
              </g>
            );
          })}

          {/* Connection Lines from Center Hotel to Venues */}
          {venues.map((venue) => {
            const pt = coordsToSvg(venue.lat, venue.lng);
            const isHovered = hoveredVenue?.id === venue.id;
            const isSelected = selectedVenue?.id === venue.id;
            const lineColor =
              venue.zone === 'main_10km'
                ? '#8b5cf6'
                : venue.zone === 'extended_30km'
                ? '#f59e0b'
                : '#64748b';

            if (!isHovered && !isSelected && venue.distanceKm > 20) return null;

            return (
              <line
                key={`line-${venue.id}`}
                x1={cx}
                y1={cy}
                x2={pt.x}
                y2={pt.y}
                stroke={lineColor}
                strokeWidth={isHovered || isSelected ? 2 : 0.75}
                strokeDasharray={isHovered || isSelected ? 'none' : '3 3'}
                opacity={isHovered || isSelected ? 0.9 : 0.25}
              />
            );
          })}

          {/* Other Hotels Markers */}
          {showOtherHotels &&
            otherHotels.map((oth) => {
              const pt = coordsToSvg(oth.lat, oth.lng);
              return (
                <g key={`oth-${oth.id}`} className="cursor-pointer">
                  <circle cx={pt.x} cy={pt.y} r="14" fill="#1e3a8a" opacity={0.3} />
                  <circle cx={pt.x} cy={pt.y} r="8" fill="#3b82f6" stroke="#93c5fd" strokeWidth="1.5" />
                  <text
                    x={pt.x}
                    y={pt.y - 12}
                    textAnchor="middle"
                    fill="#93c5fd"
                    fontSize="9"
                    fontWeight="bold"
                  >
                    {oth.name.replace('Hôtel Flowtym ', '')}
                  </text>
                </g>
              );
            })}

          {/* Venue Pins */}
          {venues.map((venue) => {
            const pt = coordsToSvg(venue.lat, venue.lng);
            const isHovered = hoveredVenue?.id === venue.id;
            const isSelected = selectedVenue?.id === venue.id;

            let pinColor = '#8b5cf6'; // Violet: 10km
            if (venue.zone === 'extended_30km') pinColor = '#f59e0b'; // Ambre: 30km
            if (venue.zone === 'out_of_radius') pinColor = '#64748b'; // Gris: >30km

            return (
              <g
                key={venue.id}
                transform={`translate(${pt.x}, ${pt.y})`}
                className="cursor-pointer transition-transform"
                onMouseEnter={() => setHoveredVenue(venue)}
                onMouseLeave={() => setHoveredVenue(null)}
                onClick={() => {
                  setSelectedVenue(venue);
                  if (onSelectVenue) onSelectVenue(venue);
                }}
              >
                {/* Glow ring when active/hovered */}
                {(isHovered || isSelected) && (
                  <circle r="18" fill={pinColor} opacity={0.35} />
                )}

                {/* Outer Pin Circle */}
                <circle
                  r={isHovered || isSelected ? 10 : 7}
                  fill={pinColor}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="transition-all"
                />

                {/* Inner white dot */}
                <circle r={isHovered || isSelected ? 4 : 2.5} fill="#ffffff" />

                {/* Venue Name Label */}
                <text
                  x={12}
                  y={4}
                  fill={isHovered || isSelected ? '#ffffff' : '#cbd5e1'}
                  fontSize={isHovered || isSelected ? '11' : '9.5'}
                  fontWeight={isHovered || isSelected ? 'bold' : '500'}
                  className="pointer-events-none drop-shadow-md"
                >
                  {venue.name.length > 24 ? `${venue.name.slice(0, 24)}…` : venue.name}
                </text>
              </g>
            );
          })}

          {/* Central Active Hotel Marker (with Radar Pulse) */}
          <g transform={`translate(${cx}, ${cy})`}>
            {/* Animated Radar Wave */}
            <circle r="28" fill="#8b5cf6" opacity={0.15} className="animate-ping" />
            <circle r="18" fill="#8b5cf6" opacity={0.3} />
            <circle r="11" fill="#7c3aed" stroke="#ffffff" strokeWidth="2.5" />
            <circle r="4" fill="#ffffff" />

            {/* Hotel Label badge */}
            <g transform="translate(0, 24)">
              <rect
                x="-65"
                y="-10"
                width="130"
                height="20"
                rx="6"
                fill="#4c1d95"
                stroke="#a78bfa"
                strokeWidth="1"
              />
              <text
                x="0"
                y="4"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
              >
                {hotel.name}
              </text>
            </g>
          </g>
        </svg>

        {/* Hover / Selected Venue Detail Card Overlay */}
        {(hoveredVenue || selectedVenue) && (
          <div className="absolute bottom-4 left-4 z-20 max-w-sm bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border border-slate-700/80 shadow-2xl text-white pointer-events-auto animate-in fade-in zoom-in-95 duration-150">
            {(() => {
              const activeV = hoveredVenue || selectedVenue!;
              return (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            activeV.zone === 'main_10km'
                              ? 'bg-violet-400'
                              : activeV.zone === 'extended_30km'
                              ? 'bg-amber-400'
                              : 'bg-slate-400'
                          }`}
                        />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          {activeV.zone === 'main_10km'
                            ? 'Rayon principal (10 km)'
                            : activeV.zone === 'extended_30km'
                            ? 'Rayon étendu (30 km)'
                            : 'Hors rayon métropolitain'}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-0.5">{activeV.name}</h4>
                      <p className="text-xs text-slate-400">{activeV.commune || activeV.city}</p>
                    </div>
                    {activeV.isVerified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Vérifié</span>
                      </span>
                    )}
                  </div>

                  {/* Calculations Grid: Haversine, Drive, Transit */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400">Vol d’oiseau</div>
                      <div className="text-xs font-bold text-violet-300 mt-0.5">
                        {activeV.distanceKm} km
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                        <Car className="w-3 h-3 text-slate-400" />
                        <span>Voiture</span>
                      </div>
                      <div className="text-xs font-bold text-amber-300 mt-0.5">
                        ~{activeV.driveTimeMins} min
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                        <Train className="w-3 h-3 text-slate-400" />
                        <span>Transports</span>
                      </div>
                      <div className="text-xs font-bold text-sky-300 mt-0.5">
                        ~{activeV.transitTimeMins} min
                      </div>
                    </div>
                  </div>

                  {/* Mutualization & Sources Information */}
                  <div className="flex items-center justify-between text-xs text-slate-300 pt-1 border-t border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-violet-400" />
                      <span>
                        Mutualisé : <strong>{activeV.mutualizedHotelsCount} hôtels</strong>
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Capacité : <strong>{activeV.capacity.toLocaleString('fr-FR')}</strong>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Legend Footer */}
        <div className="absolute bottom-4 right-4 z-20 hidden md:flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/80 text-xs text-slate-300 shadow-lg">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
            <span>Zone 10 km (Exhaustif)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Zone 30 km (Majeur)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Établissements</span>
          </div>
        </div>
      </div>
    </div>
  );
};
