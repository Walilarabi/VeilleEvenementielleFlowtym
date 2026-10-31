/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  MapPin,
  Building,
  Calendar,
  Clock,
  Car,
  Train,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Eye,
  EyeOff,
  Maximize2,
  RotateCcw,
  Compass,
  Navigation,
  Crosshair,
  ShieldAlert,
} from 'lucide-react';
import { Hotel, EventItem, VenueGeoDetail, GeographicTerritory } from '../../types';
import { loadGoogleMaps } from '../../services/googleMapsLoader';
import { getTerritoryBoundsForScope, isLocationInTerritory } from '../../data/geoData';

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleEventMapProps {
  hotel: Hotel;
  otherHotels?: Hotel[];
  venues: VenueGeoDetail[];
  events: EventItem[];
  territory: GeographicTerritory;
  territoryScope: 'metropole_standard' | 'intra_muros_10km' | 'bassin_elargi_50km';
  selectedMonthIndex: number; // -1 for all, 0-11 for Jan-Dec
  selectedYear: number;
  showImpactCircles: boolean;
  impactFilter: 'all' | 'high' | 'medium' | 'low';
  hideVenuesWithoutEvents: boolean;
  onSelectEvent: (event: EventItem) => void;
  onSelectVenue: (venue: VenueGeoDetail, venueEvents: EventItem[]) => void;
  hoveredEventId?: string | null;
}

export const GoogleEventMap: React.FC<GoogleEventMapProps> = ({
  hotel,
  otherHotels = [],
  venues,
  events,
  territory,
  territoryScope,
  selectedMonthIndex,
  selectedYear,
  showImpactCircles,
  impactFilter,
  hideVenuesWithoutEvents,
  onSelectEvent,
  onSelectVenue,
  hoveredEventId,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circlesRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const venueMarkerMapRef = useRef<Map<string, any>>(new Map());

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(11);

  // Group events by venueId
  const eventsByVenue = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    events.forEach((ev) => {
      const existing = map.get(ev.venueId) || [];
      existing.push(ev);
      map.set(ev.venueId, existing);
    });
    return map;
  }, [events]);

  // Filter venues to only those belonging to the hotel's economic territory
  const territorialVenues = useMemo(() => {
    return venues.filter((v) => isLocationInTerritory(v.lat, v.lng, v.region, territory));
  }, [venues, territory]);

  // Filter hotels belonging to this territory
  const territorialOtherHotels = useMemo(() => {
    return otherHotels.filter((oth) => isLocationInTerritory(oth.lat, oth.lng, territory.territoryName, territory));
  }, [otherHotels, territory]);

  // Determine highest impact level for a list of events
  const getHighestImpact = (venueEvents: EventItem[]) => {
    if (!venueEvents || venueEvents.length === 0) return null;
    if (venueEvents.some((e) => e.impactLevel === 'hyper' || e.impactLevel === 'critique' || e.scoreBreakdown.finalRMScore >= 60)) {
      return 'high';
    }
    if (venueEvents.some((e) => e.impactLevel === 'modere' || e.scoreBreakdown.finalRMScore >= 30)) {
      return 'medium';
    }
    return 'low';
  };

  // Helper to recenter and bound to territory
  const fitToTerritoryBounds = useCallback(() => {
    const map = mapInstanceRef.current;
    const google = window.google;
    if (!map || !google || !google.maps) return;

    const b = getTerritoryBoundsForScope(territory, territoryScope, hotel.lat, hotel.lng);
    const googleBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(b.south, b.west),
      new google.maps.LatLng(b.north, b.east)
    );

    // Also include active hotel position
    googleBounds.extend(new google.maps.LatLng(hotel.lat, hotel.lng));

    map.fitBounds(googleBounds, {
      top: 50,
      right: 50,
      bottom: 50,
      left: 50,
    });
  }, [hotel.lat, hotel.lng, territory, territoryScope]);

  // Initialize Map instance once
  useEffect(() => {
    let isCancelled = false;

    loadGoogleMaps()
      .then((g) => {
        if (isCancelled || !mapContainerRef.current) return;
        const google = g || window.google;
        if (!google || !google.maps) {
          throw new Error('Google Maps API introuvable après chargement.');
        }

        // Custom clean map styling suited for SaaS Revenue Management
        const mapStyles = [
          { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
          { featureType: 'poi.attraction', stylers: [{ visibility: 'on' }, { lightness: 10 }] },
          { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'on' }, { lightness: 15 }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ lightness: 10 }] },
          { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#f8fafc' }] },
          { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#cbd5e1' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c7d2fe' }] },
          { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#1e293b' }] },
          { featureType: 'administrative.locality', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
        ];

        const initialBounds = getTerritoryBoundsForScope(territory, territoryScope, hotel.lat, hotel.lng);
        const restrictionBounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(initialBounds.south - 0.1, initialBounds.west - 0.15),
          new google.maps.LatLng(initialBounds.north + 0.1, initialBounds.east + 0.15)
        );

        const mapOptions: any = {
          center: { lat: hotel.lat, lng: hotel.lng },
          zoom: territory.defaultZoom || 11,
          minZoom: territory.minZoom || 9.5, // EMPRISE GÉOGRAPHIQUE : empêche le dézoom au niveau national
          maxZoom: 18,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          styles: mapStyles,
          fullscreenControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          zoomControl: true,
          restriction: {
            latLngBounds: restrictionBounds,
            strictBounds: false,
          },
          internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
        };

        const map = new google.maps.Map(mapContainerRef.current, mapOptions);
        mapInstanceRef.current = map;
        infoWindowRef.current = new google.maps.InfoWindow();

        map.addListener('zoom_changed', () => {
          const z = map.getZoom();
          if (z !== undefined) setCurrentZoom(z);
        });

        setMapLoaded(true);
      })
      .catch((err) => {
        console.error('Google Maps load error:', err);
        if (!isCancelled) {
          setMapError(err?.message || 'Impossible d’initialiser Google Maps Platform.');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Update camera and restriction when territory or scope changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = window.google;
    if (!map || !mapLoaded || !google || !google.maps) return;

    const b = getTerritoryBoundsForScope(territory, territoryScope, hotel.lat, hotel.lng);
    const restrictionBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(b.south - 0.15, b.west - 0.2),
      new google.maps.LatLng(b.north + 0.15, b.east + 0.2)
    );

    map.setOptions({
      minZoom: territory.minZoom || 9.5,
      restriction: {
        latLngBounds: restrictionBounds,
        strictBounds: false,
      },
    });

    fitToTerritoryBounds();
  }, [territory, territoryScope, hotel.lat, hotel.lng, mapLoaded, fitToTerritoryBounds]);

  // Highlight marker when an event is hovered in the side list
  useEffect(() => {
    if (!hoveredEventId || !mapInstanceRef.current) return;
    const targetEvent = events.find((e) => e.id === hoveredEventId);
    if (!targetEvent) return;

    const targetMarker = venueMarkerMapRef.current.get(targetEvent.venueId);
    if (targetMarker && targetMarker.getAnimation() === null) {
      targetMarker.setAnimation(window.google?.maps?.Animation?.BOUNCE);
      setTimeout(() => {
        targetMarker.setAnimation(null);
      }, 1400);
    }
  }, [hoveredEventId, events]);

  // Render Markers and Impact Circles
  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = window.google;
    if (!map || !mapLoaded || !google || !google.maps) return;

    // Clear previous markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    venueMarkerMapRef.current.clear();

    // Clear previous circles
    circlesRef.current.forEach((c) => c.setMap(null));
    circlesRef.current = [];

    const bounds = new google.maps.LatLngBounds();

    // 1. HOTEL REFERENT MARKER (Target hotel)
    const hotelPos = new google.maps.LatLng(hotel.lat, hotel.lng);
    bounds.extend(hotelPos);

    const hotelMarkerSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="54" viewBox="0 0 48 54">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.38"/>
          </filter>
        </defs>
        <path d="M24 0C10.745 0 0 10.745 0 24c0 14.9 20.4 28.4 22.8 29.9a2.2 2.2 0 0 0 2.4 0C27.6 52.4 48 38.9 48 24 48 10.745 37.255 0 24 0z" fill="#6d28d9" filter="url(#shadow)"/>
        <circle cx="24" cy="21" r="17" fill="#7c3aed"/>
        <path d="M18 28V15h12v13h-3v-4h-6v4h-3zm3-9h2v-2h-2v2zm0 4h2v-2h-2v2zm4-4h2v-2h-2v2zm0 4h2v-2h-2v2z" fill="#ffffff"/>
      </svg>
    `;

    const hotelMarker = new google.maps.Marker({
      position: hotelPos,
      map,
      title: `${hotel.name} (Hôtel Référent)`,
      zIndex: 1000,
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(hotelMarkerSvg)}`,
        scaledSize: new google.maps.Size(48, 54),
        anchor: new google.maps.Point(24, 54),
      },
    });

    hotelMarker.addListener('mouseover', () => {
      if (!infoWindowRef.current) return;
      infoWindowRef.current.setContent(`
        <div style="font-family: system-ui, sans-serif; padding: 6px; max-width: 250px; color: #0f172a;">
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #7c3aed; letter-spacing: 0.05em;">Hôtel Référent Flowtym</div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px;">${hotel.name}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${hotel.address}, ${hotel.city}</div>
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 11px; display: flex; justify-content: space-between;">
            <span>Chambres : <strong>${hotel.roomCount}</strong></span>
            <span>Segment : <strong>${hotel.segment}</strong></span>
          </div>
          <div style="margin-top: 4px; font-size: 10.5px; color: #6d28d9; font-weight: 600;">
            Territoire : ${territory.territoryName}
          </div>
        </div>
      `);
      infoWindowRef.current.open(map, hotelMarker);
    });

    markersRef.current.push(hotelMarker);

    // 2. OTHER HOTELS IN PORTFOLIO (Within this territory)
    territorialOtherHotels.forEach((oth) => {
      const othPos = new google.maps.LatLng(oth.lat, oth.lng);
      bounds.extend(othPos);

      const othSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="34" height="40" viewBox="0 0 34 40">
          <path d="M17 0C7.611 0 0 7.611 0 17c0 11.2 14.3 21.8 16.1 23.1a1.6 1.6 0 0 0 1.8 0C19.7 38.8 34 28.2 34 17 34 7.611 26.389 0 17 0z" fill="#2563eb"/>
          <circle cx="17" cy="15" r="12" fill="#3b82f6"/>
          <path d="M13 19v-8h8v8h-2v-3h-4v3h-2zm2-5h1v-1h-1v1zm3 0h1v-1h-1v1z" fill="#ffffff"/>
        </svg>
      `;

      const m = new google.maps.Marker({
        position: othPos,
        map,
        title: oth.name,
        zIndex: 500,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(othSvg)}`,
          scaledSize: new google.maps.Size(34, 40),
          anchor: new google.maps.Point(17, 40),
        },
      });

      m.addListener('mouseover', () => {
        if (!infoWindowRef.current) return;
        infoWindowRef.current.setContent(`
          <div style="font-family: system-ui, sans-serif; padding: 4px; max-width: 210px;">
            <div style="font-size: 10px; font-weight: 700; color: #2563eb;">Établissement du groupe</div>
            <div style="font-size: 12px; font-weight: 700; color: #0f172a;">${oth.name}</div>
            <div style="font-size: 11px; color: #64748b;">${oth.city}</div>
          </div>
        `);
        infoWindowRef.current.open(map, m);
      });

      markersRef.current.push(m);
    });

    // 3. VENUE MARKERS & IMPACT CIRCLES (Filtered by territory)
    territorialVenues.forEach((venue) => {
      const venueEvents = eventsByVenue.get(venue.id) || [];
      const hasEvents = venueEvents.length > 0;

      // Filter venues without events if toggled
      if (!hasEvents && hideVenuesWithoutEvents) {
        return;
      }

      // Filter by impact level
      const impact = getHighestImpact(venueEvents);
      if (impactFilter === 'high' && impact !== 'high') return;
      if (impactFilter === 'medium' && impact !== 'medium') return;
      if (impactFilter === 'low' && impact !== 'low') return;

      const pos = new google.maps.LatLng(venue.lat, venue.lng);
      bounds.extend(pos);

      // Pin Color & Icon
      let pinColor = '#64748b'; // Gray (no active events in selected month)
      let radiusMeters = 0;
      let circleFillColor = '#94a3b8';
      let impactLabel = 'Aucun événement majeur';

      if (impact === 'high') {
        pinColor = '#e11d48'; // Rose / Rouge fort
        radiusMeters = 15000; // 15 km
        circleFillColor = '#e11d48';
        impactLabel = 'Impact Élevé (Score RM ≥ 60)';
      } else if (impact === 'medium') {
        pinColor = '#f59e0b'; // Ambre / Orange
        radiusMeters = 8000; // 8 km
        circleFillColor = '#f59e0b';
        impactLabel = 'Impact Moyen (Score RM 30-59)';
      } else if (impact === 'low') {
        pinColor = '#10b981'; // Émeraude / Vert
        radiusMeters = 3000; // 3 km
        circleFillColor = '#10b981';
        impactLabel = 'Impact Restreint (Score RM < 30)';
      }

      // Draw Impact Circle if enabled and venue has events
      if (showImpactCircles && radiusMeters > 0) {
        const circle = new google.maps.Circle({
          strokeColor: circleFillColor,
          strokeOpacity: 0.55,
          strokeWeight: 1.5,
          fillColor: circleFillColor,
          fillOpacity: 0.08,
          map,
          center: pos,
          radius: radiusMeters,
          clickable: false,
          zIndex: 10,
        });
        circlesRef.current.push(circle);
      }

      // SVG Pin for Venue
      const venueSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="38" height="44" viewBox="0 0 38 44">
          <defs>
            <filter id="venue-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-opacity="0.3"/>
            </filter>
          </defs>
          <path d="M19 0C8.507 0 0 8.507 0 19c0 12.5 16 23.5 18 24.8a1.6 1.6 0 0 0 2 0C22 42.5 38 31.5 38 19 38 8.507 29.493 0 19 0z" fill="${pinColor}" filter="url(#venue-shadow)"/>
          <circle cx="19" cy="17" r="13" fill="#ffffff"/>
          <circle cx="19" cy="17" r="8" fill="${pinColor}"/>
          ${hasEvents ? `<circle cx="29" cy="9" r="6" fill="#fbbf24" stroke="#ffffff" stroke-width="1.5"/>` : ''}
        </svg>
      `;

      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: venue.name,
        zIndex: hasEvents ? 300 : 100,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(venueSvg)}`,
          scaledSize: new google.maps.Size(38, 44),
          anchor: new google.maps.Point(19, 44),
        },
      });

      venueMarkerMapRef.current.set(venue.id, marker);

      // InfoWindow on hover
      marker.addListener('mouseover', () => {
        if (!infoWindowRef.current) return;

        let eventsHtml = '';
        if (hasEvents) {
          eventsHtml = `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
              <div style="font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 4px;">
                ${venueEvents.length} Événement(s) programmé(s) :
              </div>
              <div style="max-height: 140px; overflow-y: auto;">
                ${venueEvents
                  .slice(0, 3)
                  .map((ev) => {
                    const score = ev.scoreBreakdown.finalRMScore;
                    const badgeBg = score >= 60 ? '#ffe4e6' : score >= 30 ? '#fef3c7' : '#d1fae5';
                    const badgeColor = score >= 60 ? '#be123c' : score >= 30 ? '#b45309' : '#047857';

                    return `
                      <div style="padding: 4px 0; border-bottom: 1px dashed #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                          <div style="font-weight: 700; font-size: 11px; color: #0f172a;">${ev.title}</div>
                          <div style="font-size: 10px; color: #64748b;">${ev.startDate} → ${ev.endDate}</div>
                        </div>
                        <span style="font-size: 10px; font-weight: 800; background: ${badgeBg}; color: ${badgeColor}; padding: 1px 6px; border-radius: 4px;">
                          Score ${score}
                        </span>
                      </div>
                    `;
                  })
                  .join('')}
                ${venueEvents.length > 3 ? `<div style="font-size: 10px; color: #7c3aed; margin-top: 4px; font-weight: 600;">+ ${venueEvents.length - 3} autre(s) événement(s)...</div>` : ''}
              </div>
            </div>
          `;
        } else {
          eventsHtml = `
            <div style="font-size: 11px; color: #94a3b8; font-style: italic; margin-top: 6px;">
              Aucun événement recensé sur cette période
            </div>
          `;
        }

        const content = `
          <div style="font-family: system-ui, sans-serif; padding: 4px; max-width: 290px; color: #0f172a;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${pinColor}; display: inline-block;"></span>
              <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">
                ${venue.type} • ${impactLabel}
              </span>
            </div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px;">
              ${venue.name}
            </div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">
              ${venue.commune || venue.city} (Capacité : ${venue.capacity.toLocaleString('fr-FR')})
            </div>

            <div style="display: flex; gap: 10px; margin-top: 6px; font-size: 10.5px; color: #475569; background: #f8fafc; padding: 4px 8px; border-radius: 6px;">
              <span>Vol d'oiseau : <strong>${venue.distanceKm} km</strong></span>
              <span>Voiture : <strong>~${venue.driveTimeMins} min</strong></span>
            </div>

            ${eventsHtml}

            <div style="margin-top: 8px; text-align: right;">
              <span style="font-size: 10px; color: #6d28d9; font-weight: 700; cursor: pointer;">
                Cliquer pour ouvrir la fiche détaillée →
              </span>
            </div>
          </div>
        `;

        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open(map, marker);
      });

      // Click opens detailed venue drawer
      marker.addListener('click', () => {
        onSelectVenue(venue, venueEvents);
      });

      markersRef.current.push(marker);
    });
  }, [
    mapLoaded,
    hotel,
    territorialOtherHotels,
    territorialVenues,
    eventsByVenue,
    showImpactCircles,
    impactFilter,
    hideVenuesWithoutEvents,
    onSelectVenue,
    territory,
  ]);

  return (
    <div className="relative w-full h-[620px] rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm bg-slate-100">
      {/* Map DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 z-30 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-3 border-violet-600 border-t-transparent rounded-full animate-spin" />
          <div className="text-sm font-bold text-slate-800">
            Initialisation de Google Maps Platform...
          </div>
          <div className="text-xs text-slate-500">
            Cadrage sur le territoire de référence : {territory.territoryName}
          </div>
        </div>
      )}

      {/* Error state */}
      {mapError && (
        <div className="absolute inset-0 z-30 bg-slate-900/90 text-white p-6 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold">Impossible de charger Google Maps Platform</h3>
          <p className="text-xs text-slate-300 max-w-md">{mapError}</p>
        </div>
      )}

      {/* TOP FLOATING OVERLAY: DYNAMIC TERRITORY BADGE & QUICK RECENTER (PRD Complément Technique Sections 1-6) */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-violet-200 shadow-sm flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse" />
          <div>
            <div className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">
              Territoire actif
            </div>
            <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
              <span>{territory.territoryName}</span>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                Zoom {currentZoom}
              </span>
            </div>
          </div>
        </div>

        {/* Quick button: Recentrer sur le territoire */}
        <button
          onClick={fitToTerritoryBounds}
          className="bg-white/95 hover:bg-violet-50 text-slate-700 hover:text-violet-700 font-bold text-xs px-3 py-2 rounded-xl border border-slate-200 hover:border-violet-300 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          title={`Recentrer et recadrer sur ${territory.territoryName}`}
        >
          <Crosshair className="w-3.5 h-3.5 text-violet-600" />
          <span>Recentrer sur le territoire</span>
        </button>

        {/* Anti-dezoom Lock Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-slate-700/60 shadow-2xs">
          <Navigation className="w-3 h-3 text-emerald-400" />
          <span>Verrouillage métropolitain actif</span>
        </div>
      </div>

      {/* Floating Map Legend (PRD Section 9) */}
      <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-md text-xs text-slate-700 pointer-events-auto space-y-1.5 hidden sm:block max-w-xs">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
          <span>Légende d’impact RM</span>
          <span className="text-[9px] text-violet-600 font-bold bg-violet-50 px-1 rounded">Google Maps</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500 shadow-2xs shrink-0" />
          <span className="font-medium text-slate-800 text-[11px]">Impact Élevé (Rayon 15 km)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500 shadow-2xs shrink-0" />
          <span className="font-medium text-slate-800 text-[11px]">Impact Moyen (Rayon 8 km)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-2xs shrink-0" />
          <span className="font-medium text-slate-800 text-[11px]">Impact Restreint (Rayon 3 km)</span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <span className="w-3 h-3 rounded-full bg-violet-700 shrink-0" />
          <span className="font-bold text-violet-900 text-[11px] truncate">{hotel.name}</span>
        </div>
      </div>
    </div>
  );
};
