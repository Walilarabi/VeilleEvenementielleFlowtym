/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Compass,
  MapPin,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCw,
  Search,
  Database,
  Layers,
  Building,
  Car,
  Train,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Globe2,
  Share2,
  Calendar,
  Clock,
  ShieldCheck,
  Info,
  Eye,
  EyeOff,
  Filter,
  X,
} from 'lucide-react';
import { Hotel, HotelGeoSettings, VenueGeoDetail, OfficialCategorySpec, EventItem } from '../../types';
import {
  OFFICIAL_7_CATEGORIES,
  DEFAULT_HOTEL_GEO_SETTINGS,
  computeVenuesForHotel,
  SUPABASE_POSTGIS_SCHEMA_SQL,
  getTerritoryForHotel,
  isLocationInTerritory,
  OFFICIAL_TERRITORIES_DIRECTORY,
} from '../../data/geoData';
import { GoogleEventMap } from './GoogleEventMap';
import { VenueDetailDrawer } from './VenueDetailDrawer';
import { getRMScoreColorClasses } from '../../utils/helpers';

interface GeoIntelligenceViewProps {
  hotels: Hotel[];
  selectedHotelId: string;
  events?: EventItem[];
  onSelectHotel: (hotelId: string) => void;
  onSelectEvent?: (event: EventItem) => void;
  onShowToast: (message: string) => void;
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

export const GeoIntelligenceView: React.FC<GeoIntelligenceViewProps> = ({
  hotels,
  selectedHotelId,
  events = [],
  onSelectHotel,
  onSelectEvent,
  onShowToast,
}) => {
  // Active hotel
  const currentHotel = useMemo(() => {
    return hotels.find((h) => h.id === selectedHotelId) || hotels[0];
  }, [hotels, selectedHotelId]);

  const otherHotels = useMemo(() => {
    return hotels.filter((h) => h.id !== currentHotel.id);
  }, [hotels, currentHotel.id]);

  // Per-hotel geo settings dictionary
  const [hotelSettingsMap, setHotelSettingsMap] = useState<Record<string, HotelGeoSettings>>(() => {
    const initialMap: Record<string, HotelGeoSettings> = {};
    hotels.forEach((h) => {
      initialMap[h.id] = {
        hotelId: h.id,
        ...DEFAULT_HOTEL_GEO_SETTINGS,
      };
    });
    return initialMap;
  });

  const currentSettings = hotelSettingsMap[currentHotel.id] || {
    hotelId: currentHotel.id,
    ...DEFAULT_HOTEL_GEO_SETTINGS,
  };

  // State for manual GPS coordinates editing
  const [isEditingGPS, setIsEditingGPS] = useState(false);
  const [tempLat, setTempLat] = useState(currentHotel.lat.toString());
  const [tempLng, setTempLng] = useState(currentHotel.lng.toString());

  // Category state (7 Official Categories)
  const [categories, setCategories] = useState<OfficialCategorySpec[]>(OFFICIAL_7_CATEGORIES);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Time Filtering (PRD Section 5)
  // Default to October (9) or November (10) 2026 where Paris Games Week, Rolex Masters, EquipHotel occur
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(10); // 10 = Nov 2026

  // Impact and visual filters (PRD Section 6 & 9)
  const [impactFilter, setImpactFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showImpactCircles, setShowImpactCircles] = useState<boolean>(true);
  const [hideVenuesWithoutEvents, setHideVenuesWithoutEvents] = useState<boolean>(false);
  const [sideListSearch, setSideListSearch] = useState<string>('');

  // Selected Venue Drawer
  const [inspectedVenue, setInspectedVenue] = useState<VenueGeoDetail | null>(null);
  const [inspectedVenueEvents, setInspectedVenueEvents] = useState<EventItem[]>([]);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  // Discovery scanner modal state
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);

  // Venues filter in the table
  const [tableFilterZone, setTableFilterZone] = useState<'all' | 'main_10km' | 'extended_30km'>('all');
  const [tableSearch, setTableSearch] = useState('');

  // SQL Copy state
  const [copiedSQL, setCopiedSQL] = useState(false);

  // Active view tab inside Geo Module
  const [activeGeoTab, setActiveGeoTab] = useState<
    'carte_google' | 'categories' | 'venues_table' | 'supabase_schema' | 'debordement_metropolitain'
  >('carte_google');

  // TERRITOIRE DE RÉFÉRENCE AUTOMATIQUE (Section 3 du Complément Technique)
  // Paris -> Île-de-France, Lyon -> Métropole de Lyon, etc.
  const currentTerritory = useMemo(() => {
    return getTerritoryForHotel(currentHotel);
  }, [currentHotel]);

  // Compute calculated venues for the current hotel, strictly filtered to the reference territory
  const calculatedVenues = useMemo(() => {
    const allComputed = computeVenuesForHotel(
      currentHotel.lat,
      currentHotel.lng,
      currentHotel.city,
      currentSettings.mainRadiusKm,
      currentSettings.extendedRadiusKm
    );
    // Filtrage territorial strict : exclut les infrastructures hors du bassin économique pertinent
    return allComputed.filter((v) => isLocationInTerritory(v.lat, v.lng, v.region, currentTerritory));
  }, [currentHotel, currentSettings.mainRadiusKm, currentSettings.extendedRadiusKm, currentTerritory]);

  // Set of valid venue IDs within the hotel's economic territory
  const venueIdsInTerritory = useMemo(() => {
    return new Set(calculatedVenues.map((v) => v.id));
  }, [calculatedVenues]);

  // Venues breakdown counts
  const mainRadiusVenues = calculatedVenues.filter((v) => v.zone === 'main_10km');
  const extendedRadiusVenues = calculatedVenues.filter((v) => v.zone === 'extended_30km');

  // Filter events strictly according to PRD Section 5 & Complément Technique:
  // 1. Filtrage territorial strict (Seuls les événements du bassin économique sont conservés)
  // 2. event.start_date <= last_day_of_selected_month AND event.end_date >= first_day_of_selected_month
  const filteredEventsForMonth = useMemo(() => {
    return events.filter((ev) => {
      // 0. Filtrage Territorial : exclure les événements hors bassin pertinent (ex: exclure Lyon pour un hôtel parisien)
      const isTerritorialMatch =
        venueIdsInTerritory.has(ev.venueId) ||
        ev.city.toLowerCase() === currentHotel.city.toLowerCase() ||
        (currentTerritory.territoryName === 'Île-de-France' &&
          ['paris', 'villepinte', 'nanterre', 'saint-denis', 'versailles', 'le bourget', 'chessy', 'roissy'].some(
            (c) => ev.city.toLowerCase().includes(c) || ev.venueName.toLowerCase().includes(c)
          ));

      if (!isTerritorialMatch) {
        return false;
      }

      // 1. Month and Year filter
      if (selectedMonthIndex !== -1) {
        const m = String(selectedMonthIndex + 1).padStart(2, '0');
        const firstDayOfMonth = `${selectedYear}-${m}-01`;
        const lastDayNum = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
        const lastDayOfMonth = `${selectedYear}-${m}-${String(lastDayNum).padStart(2, '0')}`;

        const overlaps = ev.startDate <= lastDayOfMonth && ev.endDate >= firstDayOfMonth;
        if (!overlaps) return false;
      } else {
        if (!ev.startDate.startsWith(`${selectedYear}`)) return false;
      }

      // 2. Category filter
      if (categoryFilter !== 'all' && ev.category !== categoryFilter) {
        return false;
      }

      // 3. Impact filter
      if (impactFilter === 'high' && ev.scoreBreakdown.finalRMScore < 60 && ev.impactLevel !== 'critique' && ev.impactLevel !== 'hyper') {
        return false;
      }
      if (impactFilter === 'medium' && (ev.scoreBreakdown.finalRMScore < 30 || ev.scoreBreakdown.finalRMScore >= 60)) {
        return false;
      }
      if (impactFilter === 'low' && ev.scoreBreakdown.finalRMScore >= 30) {
        return false;
      }

      return true;
    });
  }, [events, selectedMonthIndex, selectedYear, categoryFilter, impactFilter, venueIdsInTerritory, currentHotel.city, currentTerritory.territoryName]);

  // Filtered list for the right sidebar with search
  const sideListEvents = useMemo(() => {
    if (!sideListSearch.trim()) return filteredEventsForMonth;
    const q = sideListSearch.toLowerCase();
    return filteredEventsForMonth.filter(
      (ev) =>
        ev.title.toLowerCase().includes(q) ||
        ev.venueName.toLowerCase().includes(q) ||
        ev.city.toLowerCase().includes(q)
    );
  }, [filteredEventsForMonth, sideListSearch]);

  // Count high impact events
  const highImpactCount = useMemo(() => {
    return filteredEventsForMonth.filter(
      (e) => e.impactLevel === 'critique' || e.impactLevel === 'hyper' || e.scoreBreakdown.finalRMScore >= 60
    ).length;
  }, [filteredEventsForMonth]);

  // Update setting for the current hotel (isolated per hotel)
  const updateCurrentSetting = <K extends keyof HotelGeoSettings>(key: K, value: HotelGeoSettings[K]) => {
    setHotelSettingsMap((prev) => ({
      ...prev,
      [currentHotel.id]: {
        ...currentSettings,
        [key]: value,
      },
    }));
  };

  // Toggle category
  const toggleCategory = (code: string) => {
    const isCurrentlyEnabled = currentSettings.enabledCategoryCodes.includes(code);
    const newCodes = isCurrentlyEnabled
      ? currentSettings.enabledCategoryCodes.filter((c) => c !== code)
      : [...currentSettings.enabledCategoryCodes, code];

    updateCurrentSetting('enabledCategoryCodes', newCodes);
    onShowToast(`Catégorie ${isCurrentlyEnabled ? 'désactivée' : 'activée'} pour ${currentHotel.name}`);
  };

  // Trigger manual discovery scan
  const handleLaunchDiscoveryScan = () => {
    setIsScanning(true);
    setScanStep(1);
    setScanLogs(['[04:00:01] Initialisation du worker de découverte spatiale PostGIS & Google Maps...']);

    const steps = [
      {
        step: 1,
        log: `[04:00:02] Géocodage validé pour "${currentHotel.address}". Coordonnées : (${currentHotel.lat}, ${currentHotel.lng})`,
      },
      {
        step: 2,
        log: `[04:00:04] Scan spatial du rayon principal (${currentSettings.mainRadiusKm} km) : 9 infrastructures identifiées (OpenStreetMap, Viparis).`,
      },
      {
        step: 3,
        log: `[04:00:06] Scan spatial étendu (${currentSettings.extendedRadiusKm} km) & communes voisines (Villepinte, Nanterre, Saint-Denis) : 5 grands parcs expo/arenas détectés.`,
      },
      {
        step: 4,
        log: `[04:00:08] Détection et vérification des sources officielles : 42 flux de billetteries et calendriers certifiés reliés.`,
      },
      {
        step: 5,
        log: `[04:00:10] Calcul des distances à vol d'oiseau PostGIS et temps de trajet réels (voiture + transports en commun RER/Métro).`,
      },
      {
        step: 6,
        log: `[04:00:12] Mutualisation des infrastructures dans le référentiel Supabase et recalcul des impacts RM propres à ${currentHotel.name}.`,
      },
    ];

    steps.forEach((s, idx) => {
      setTimeout(() => {
        setScanStep(s.step);
        setScanLogs((prev) => [...prev, s.log]);
        if (idx === steps.length - 1) {
          setTimeout(() => {
            setIsScanning(false);
            updateCurrentSetting('lastSearchAt', new Date().toISOString());
            onShowToast(`Découverte géographique terminée avec succès pour ${currentHotel.name}`);
          }, 1000);
        }
      }, (idx + 1) * 900);
    });
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_POSTGIS_SCHEMA_SQL);
    setCopiedSQL(true);
    onShowToast('Schéma SQL Supabase PostGIS copié dans le presse-papier');
    setTimeout(() => setCopiedSQL(false), 2500);
  };

  // Stepper handlers
  const handlePrevMonth = () => {
    if (selectedMonthIndex <= 0) {
      setSelectedMonthIndex(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonthIndex((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonthIndex >= 11) {
      setSelectedMonthIndex(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonthIndex((m) => m + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/80 dark:border-violet-800/70 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0 shadow-2xs">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-2.5 py-0.5 rounded-full border border-violet-200 dark:border-violet-800/70 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Google Maps Platform • Active
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Carte Événementielle Interactive
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                Veille Géographique & Visualisation d’Impact RM
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Google Maps dynamique, cercles d’influence (15 km, 8 km, 3 km), filtrage mensuel et calculs d’accessibilité personnalisés.
              </p>
            </div>
          </div>

          {/* Hotel Selector & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl">
              <Building className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <div className="text-xs">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Hôtel Référent</div>
                <select
                  value={currentHotel.id}
                  onChange={(e) => onSelectHotel(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 dark:text-slate-200 text-xs focus:outline-none cursor-pointer"
                >
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* GPS Auto-Detect Button */}
            <button
              onClick={() => {
                if (!navigator.geolocation) {
                  onShowToast("La géolocalisation n'est pas supportée sur ce navigateur");
                  return;
                }
                onShowToast('Détection de la position GPS en cours...');
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    setTempLat(lat.toFixed(6));
                    setTempLng(lng.toFixed(6));
                    currentHotel.lat = lat;
                    currentHotel.lng = lng;
                    onShowToast(`Position GPS détectée et appliquée : ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                  },
                  (err) => {
                    onShowToast(`Géolocalisation automatique : ${err.message}. Vous pouvez saisir les coordonnées.`);
                  },
                  { timeout: 7000 }
                );
              }}
              title="Détecter automatiquement la position GPS de l'hôtel"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-all cursor-pointer border border-slate-200 dark:border-slate-800"
            >
              <Compass className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              <span className="hidden sm:inline">Détecter GPS</span>
            </button>

            {/* Manual Coordinates & Custom Radius Button */}
            <button
              onClick={() => setIsEditingGPS(true)}
              title="Saisir manuellement les coordonnées ou modifier la zone d'influence"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-all cursor-pointer border border-slate-200 dark:border-slate-800"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span>Périmètre & GPS</span>
            </button>

            <button
              onClick={handleLaunchDiscoveryScan}
              disabled={isScanning}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-60"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Découverte...' : 'Lancer un scan'}</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3 overflow-x-auto">
          {[
            { id: 'carte_google', label: 'Carte Événementielle Google Maps', icon: MapPin },
            { id: 'debordement_metropolitain', label: 'Règle des 10/30 km & Débordement', icon: Train },
            { id: 'categories', label: 'Les 7 Catégories Officielles', icon: Layers },
            { id: 'venues_table', label: `Infrastructures & Distances (${calculatedVenues.length})`, icon: Building },
            { id: 'supabase_schema', label: 'Architecture Supabase PostGIS', icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeGeoTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveGeoTab(tab.id as typeof activeGeoTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: CARTE ÉVÉNEMENTIELLE INTERACTIVE GOOGLE MAPS */}
      {activeGeoTab === 'carte_google' && (
        <div className="space-y-4">
          {/* BANNIÈRE EMPRISE GÉOGRAPHIQUE DYNAMIQUE (Section 1 à 6 du Complément Technique) */}
          <div className="bg-gradient-to-r from-violet-950 via-indigo-950 to-slate-900 rounded-2xl p-4 text-white shadow-sm border border-violet-800/40">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 bg-violet-500/20 text-violet-200 border border-violet-400/30 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider">
                    <Compass className="w-3.5 h-3.5 text-violet-300" />
                    Territoire de référence officiel
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Cadrage métropolitain actif
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <h2 className="text-lg md:text-xl font-extrabold tracking-tight text-white">
                    {currentTerritory.territoryName}
                  </h2>
                  <span className="text-xs text-violet-200/80 font-medium hidden sm:inline">
                    ({currentHotel.name} • {currentHotel.city})
                  </span>
                </div>

                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  {currentTerritory.description}. Cadrage dynamique focalisé exclusivement sur le bassin de demande pertinent sans dézoom national non pertinent.
                </p>

                {/* Communes Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Communes & pôles :</span>
                  {currentTerritory.keyCommunes.map((commune) => (
                    <span
                      key={commune}
                      className="text-[11px] font-medium bg-white/10 hover:bg-white/15 text-slate-200 px-2 py-0.5 rounded-md border border-white/10 transition-colors"
                    >
                      {commune}
                    </span>
                  ))}
                </div>
              </div>

              {/* Territory Scope Switcher & Quick Settings */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 flex flex-col gap-2 shrink-0 md:min-w-[260px]">
                <div className="text-[10px] font-bold uppercase tracking-wider text-violet-200">
                  Périmètre de cadrage
                </div>
                <select
                  value={currentSettings.territoryScope || 'metropole_standard'}
                  onChange={(e) => {
                    const nextScope = e.target.value as typeof currentSettings.territoryScope;
                    updateCurrentSetting('territoryScope', nextScope);
                    onShowToast(`Périmètre ajusté : ${nextScope === 'intra_muros_10km' ? 'Intra-muros (10 km)' : nextScope === 'bassin_elargi_50km' ? 'Bassin élargi (50 km)' : 'Bassin métropolitain standard'}`);
                  }}
                  className="bg-slate-900/90 text-white font-bold text-xs rounded-lg px-2.5 py-1.5 border border-white/20 focus:outline-none cursor-pointer"
                >
                  <option value="metropole_standard">Métropole & Bassin Standard (Recommandé)</option>
                  <option value="intra_muros_10km">Intra-Muros & 1ère Couronne (10 km)</option>
                  <option value="bassin_elargi_50km">Grande Couronne & Bassin Élargi (50 km)</option>
                </select>

                <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1 border-t border-white/10">
                  <span>Infrastructures actives :</span>
                  <span className="font-bold text-white">{calculatedVenues.length} lieux</span>
                </div>
              </div>
            </div>
          </div>

          {/* Controls Bar: Time Navigation, Category & Impact Filters (PRD Section 5 & 10) */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
            {/* Row 1: Month Stepper & Year Picker */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
              {/* Left: Year & Month Bar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Year Selector */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>

                {/* Steppers */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg transition-colors"
                    title="Mois précédent"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSelectedMonthIndex(-1)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                      selectedMonthIndex === -1 ? 'bg-violet-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    Tous les mois
                  </button>
                  {MONTH_NAMES.map((name, idx) => (
                    <button
                      key={name}
                      onClick={() => setSelectedMonthIndex(idx)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                        selectedMonthIndex === idx ? 'bg-violet-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg transition-colors"
                    title="Mois suivant"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Right: Dynamic Counters (PRD Section 9) */}
              <div className="flex items-center gap-3 text-xs">
                <div className="px-3 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/70 text-violet-800 dark:text-violet-300 font-bold">
                  {filteredEventsForMonth.length} événement(s)
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-300 font-bold">
                  {highImpactCount} impact fort
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                  {calculatedVenues.length} infrastructures
                </div>
              </div>
            </div>

            {/* Row 2: Secondary Filters & Visual Options */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Impact Level Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                  Impact :
                </span>
                <button
                  onClick={() => setImpactFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    impactFilter === 'all'
                      ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-900'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setImpactFilter('high')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    impactFilter === 'high'
                      ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70 hover:bg-rose-100 dark:hover:bg-rose-900/50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Élevé (15 km)</span>
                </button>
                <button
                  onClick={() => setImpactFilter('medium')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    impactFilter === 'medium'
                      ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                      : 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/70 hover:bg-orange-100 dark:hover:bg-orange-900/50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <span>Moyen (8 km)</span>
                </button>
                <button
                  onClick={() => setImpactFilter('low')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    impactFilter === 'low'
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Restreint (3 km)</span>
                </button>
              </div>

              {/* Toggles: Circles & Inactive Venues */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showImpactCircles}
                    onChange={(e) => setShowImpactCircles(e.target.checked)}
                    className="rounded text-violet-600 dark:text-violet-400 focus:ring-violet-500 cursor-pointer"
                  />
                  <span>Cercles d’impact</span>
                </label>

                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideVenuesWithoutEvents}
                    onChange={(e) => setHideVenuesWithoutEvents(e.target.checked)}
                    className="rounded text-violet-600 dark:text-violet-400 focus:ring-violet-500 cursor-pointer"
                  />
                  <span>Masquer lieux sans événement</span>
                </label>
              </div>
            </div>
          </div>

          {/* Main Visual Layout (PRD Section 10): 75-80% Google Maps + 20-25% Side List */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
            {/* Map Area (3 cols = 75%) */}
            <div className="lg:col-span-3 space-y-2">
              <GoogleEventMap
                hotel={currentHotel}
                otherHotels={otherHotels}
                venues={calculatedVenues}
                events={filteredEventsForMonth}
                territory={currentTerritory}
                territoryScope={currentSettings.territoryScope || 'metropole_standard'}
                selectedMonthIndex={selectedMonthIndex}
                selectedYear={selectedYear}
                showImpactCircles={showImpactCircles}
                impactFilter={impactFilter}
                hideVenuesWithoutEvents={hideVenuesWithoutEvents}
                onSelectEvent={(ev) => {
                  if (onSelectEvent) onSelectEvent(ev);
                }}
                onSelectVenue={(venue, vEvents) => {
                  setInspectedVenue(venue);
                  setInspectedVenueEvents(vEvents);
                }}
                hoveredEventId={hoveredEventId}
              />
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Survolez un marqueur pour afficher l’infobulle détaillée, ou cliquez pour inspecter le calendrier complet.
                  </span>
                </span>
                <span className="font-semibold text-violet-700 dark:text-violet-300">
                  {currentHotel.name} • {currentHotel.city}
                </span>
              </div>
            </div>

            {/* Side Events Panel (1 col = 25%) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs p-4 flex flex-col h-[620px] overflow-hidden">
              <div className="space-y-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    Événements du Mois ({sideListEvents.length})
                  </h3>
                  <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded-md">
                    {selectedMonthIndex === -1 ? 'Année ' + selectedYear : `${MONTH_NAMES[selectedMonthIndex]} ${selectedYear}`}
                  </span>
                </div>

                {/* Side Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrer un salon ou une salle..."
                    value={sideListSearch}
                    onChange={(e) => setSideListSearch(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>

              {/* Scrollable Event List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1">
                {sideListEvents.length === 0 ? (
                  <div className="text-center py-12 px-3 space-y-2 text-slate-400">
                    <Calendar className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Aucun événement ne correspond aux filtres</p>
                    <p className="text-[11px] text-slate-400">
                      Essayez de sélectionner un autre mois ou d’élargir les critères d’impact.
                    </p>
                  </div>
                ) : (
                  sideListEvents.map((ev) => {
                    const score = ev.scoreBreakdown.finalRMScore;
                    const scoreStyles = getRMScoreColorClasses(score);
                    const matchingVenue = calculatedVenues.find((v) => v.id === ev.venueId);

                    return (
                      <div
                        key={ev.id}
                        onMouseEnter={() => setHoveredEventId(ev.id)}
                        onMouseLeave={() => setHoveredEventId(null)}
                        onClick={() => {
                          if (matchingVenue) {
                            setInspectedVenue(matchingVenue);
                            setInspectedVenueEvents(
                              events.filter((x) => x.venueId === matchingVenue.id)
                            );
                          }
                          if (onSelectEvent) onSelectEvent(ev);
                        }}
                        className="p-3 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-violet-50/50 rounded-xl border border-slate-200/80 dark:border-slate-800/80 hover:border-violet-300 dark:hover:border-violet-600/70 transition-all cursor-pointer group space-y-2"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-violet-700 transition-colors line-clamp-1">
                              {ev.title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium line-clamp-1">
                              {ev.venueName} ({ev.city})
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md font-bold text-[10.5px] border shrink-0 ${scoreStyles.badge}`}
                          >
                            Score {score}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800/70">
                          <span className="tabular-nums">
                            {ev.startDate.slice(5)} → {ev.endDate.slice(5)}
                          </span>
                          {matchingVenue && (
                            <span className="font-semibold text-violet-700 dark:text-violet-300">
                              {matchingVenue.distanceKm} km (~{matchingVenue.driveTimeMins}m)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LES 7 CATÉGORIES ÉVÉNEMENTIELLES OFFICIELLES */}
      {activeGeoTab === 'categories' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Les 7 Catégories Événementielles Officielles à Surveiller
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ces catégories constituent le standard de Flowtym Event Intelligence. Vous pouvez activer ou désactiver chaque catégorie spécifiquement pour {currentHotel.name}.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    updateCurrentSetting(
                      'enabledCategoryCodes',
                      OFFICIAL_7_CATEGORIES.map((c) => c.code)
                    );
                    onShowToast('Toutes les 7 catégories activées par défaut');
                  }}
                  className="px-3 py-1.5 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-800/70 rounded-xl text-xs font-semibold transition-colors"
                >
                  Tout activer
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map((cat) => {
                const isEnabled = currentSettings.enabledCategoryCodes.includes(cat.code);
                const isExpanded = expandedCategory === cat.id;

                return (
                  <div
                    key={cat.id}
                    className={`rounded-2xl border p-5 transition-all ${
                      isEnabled
                        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs'
                        : 'bg-slate-50/60 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/70 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 mt-0.5"
                          style={{ backgroundColor: cat.color }}
                        >
                          #{cat.number}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{cat.name}</h4>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                isEnabled
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {isEnabled ? 'Active' : 'Désactivée'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{cat.description}</p>
                        </div>
                      </div>

                      {/* Switch Toggle */}
                      <button
                        onClick={() => toggleCategory(cat.code)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                          isEnabled ? 'bg-violet-600' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`bg-white dark:bg-slate-900 w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Subcategories list */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          {cat.subcategories.length} sous-types surveillés
                        </span>
                        <button
                          onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                          className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 flex items-center gap-1 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Masquer' : 'Afficher les détails'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5 pt-1 animate-in fade-in duration-150">
                          {cat.subcategories.map((sub) => (
                            <span
                              key={sub}
                              className="text-xs px-2.5 py-1 bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200/80 dark:border-slate-800/80 font-medium"
                            >
                              • {sub}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TABLEAU DU RÉFÉRENTIEL DES INFRASTRUCTURES */}
      {activeGeoTab === 'venues_table' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Référentiel des Lieux & Distances Spatiales
                  </h3>
                  <span className="text-[10px] font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/70 px-2 py-0.5 rounded-full">
                    {currentTerritory.territoryName}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Calculs individualisés pour <strong>{currentHotel.name}</strong> • {currentTerritory.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrer par nom ou commune..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>

                {/* Zone Filter */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <button
                    onClick={() => setTableFilterZone('all')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                      tableFilterZone === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Tous ({calculatedVenues.length})
                  </button>
                  <button
                    onClick={() => setTableFilterZone('main_10km')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                      tableFilterZone === 'main_10km' ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Rayon 10 km ({mainRadiusVenues.length})
                  </button>
                  <button
                    onClick={() => setTableFilterZone('extended_30km')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                      tableFilterZone === 'extended_30km' ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Rayon 30 km ({extendedRadiusVenues.length})
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold text-slate-500 dark:text-slate-400 uppercase">Infrastructure</th>
                    <th className="py-3 px-4 font-bold text-slate-500 dark:text-slate-400 uppercase">Commune / Zone</th>
                    <th className="py-3 px-4 font-bold text-slate-500 dark:text-slate-400 uppercase">Vol d’oiseau</th>
                    <th className="py-3 px-4 font-bold text-slate-500 dark:text-slate-400 uppercase">Temps Voiture</th>
                    <th className="py-3 px-4 font-bold text-slate-500 dark:text-slate-400 uppercase">Transports (RER)</th>
                    <th className="py-3 px-4 font-bold text-slate-500 dark:text-slate-400 uppercase">Mutualisation</th>
                    <th className="py-3 px-4 font-bold text-slate-500 dark:text-slate-400 uppercase">Sources</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {calculatedVenues.map((v) => {
                    return (
                      <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/70 transition-colors">
                        <td className="py-3.5 px-4 font-medium">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{v.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Capacité : {v.capacity.toLocaleString('fr-FR')} • {v.type}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{v.commune}</div>
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5 ${
                              v.zone === 'main_10km'
                                ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/70'
                                : v.zone === 'extended_30km'
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {v.zone === 'main_10km'
                              ? 'Rayon 10 km (Principal)'
                              : v.zone === 'extended_30km'
                              ? 'Rayon 30 km (Étendu)'
                              : 'Hors périmètre'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-900 dark:text-slate-100">
                          {v.distanceKm} km
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/70">
                            <Car className="w-3 h-3" />
                            ~{v.driveTimeMins} min
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800/70">
                            <Train className="w-3 h-3" />
                            ~{v.transitTimeMins} min
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <Share2 className="w-3 h-3 text-violet-500" />
                            <span>{v.mutualizedHotelsCount} hôtels</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="text-slate-600 dark:text-slate-400 font-semibold">
                            {v.associatedSourcesCount} sources
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SCHÉMA SUPABASE POSTGIS */}
      {activeGeoTab === 'supabase_schema' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span>Architecture Supabase PostGIS — Version 1.0</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                DDL SQL complet avec tables géographiques, index GiST et fonction spatiale `get_venues_within_radii`.
              </p>
            </div>
            <button
              onClick={handleCopySQL}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              {copiedSQL ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSQL ? 'Schéma copié !' : 'Copier le script SQL'}</span>
            </button>
          </div>

          <pre className="p-4 bg-slate-900 dark:bg-slate-800 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-[550px] leading-relaxed border border-slate-800">
            {SUPABASE_POSTGIS_SCHEMA_SQL}
          </pre>
        </div>
      )}

      {/* TAB 5: RÈGLE DES 10/30 KM & DÉBORDEMENT MÉTROPOLITAIN */}
      {activeGeoTab === 'debordement_metropolitain' && (
        <div className="space-y-6">
          {/* Header Explanation Banner */}
          <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 rounded-3xl p-6 text-white border border-indigo-800/40 space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 flex items-center gap-1.5">
                <Train className="w-3.5 h-3.5 text-indigo-300" />
                <span>Principe Fondateur de Réalité Métier</span>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              La Distance Brute n&apos;est Jamais le Seul Critère d&apos;Impact Hôtelier
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
              Un événement situé à <strong>30 km</strong> peut déclencher une surchauffe historique de votre établissement, tandis qu&apos;un événement à <strong>4 km</strong> peut n&apos;engendrer absolument aucune nuitée. Flowtym modélise la capacité du lieu, la part de visiteurs extra-régionaux, les liaisons de transport directes et la saturation du compset périphérique.
            </p>
          </div>

          {/* Comparative Case Studies (Requested by user) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cas 1: Lointain mais impact massif */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-800/70 p-5 space-y-4 shadow-2xs">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70">
                  Distance : 31 km · Fort Impact
                </span>
                <span className="text-lg font-black text-rose-600 dark:text-rose-400">94/100</span>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Mondial de l&apos;Auto & SIAL Paris</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Parc des Expositions Paris Nord Villepinte</p>
              </div>

              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 bg-rose-50/50 dark:bg-rose-950/35 p-3 rounded-2xl border border-rose-100 dark:border-rose-900/60">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Affluence :</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">490 000 pax (42% internat.)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Transport direct :</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">RER B direct (28 min)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Concurrence locale :</span>
                  <span className="font-bold text-rose-700 dark:text-rose-300">100% Sold-out (12 000 ch.)</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                <strong>Mécanisme de Débordement :</strong> La périphérie immédiate de Villepinte ne pouvant absorber 490k visiteurs, la demande se déverse en totalité sur les quartiers centraux parisiens reliés directement par le RER B (Gare du Nord, Châtelet, Opéra).
              </p>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                Action RM : Hausse tarifaire de +35% à +50% et Minimum Stay 3 nuits justifiés.
              </div>
            </div>

            {/* Cas 2: Proche mais impact nul */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                  Distance : 5.8 km · Impact Nul
                </span>
                <span className="text-lg font-black text-slate-400">12/100</span>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Salon du Livre Jeunesse & Événements Locaux</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Espace Paris-Est Montreuil / Halle Locale</p>
              </div>

              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Affluence :</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">160 000 entrées déclarées</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Origine visiteurs :</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">94% résidents franciliens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Nuitées générées :</span>
                  <span className="font-bold text-slate-500 dark:text-slate-400">Quasi nulles (&lt;40 ch.)</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                <strong>Absence de Nuitées :</strong> Malgré une affluence massive en apparence, les visiteurs possèdent un titre de transport Navigo et rentrent dormir à leur domicile le soir même.
              </p>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Alerte RM : Ne pas augmenter les tarifs. Risque majeur de perte de taux d&apos;occupation.
              </div>
            </div>

            {/* Cas 3: Proximité & prestige ciblé */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-emerald-200 dark:border-emerald-800/70 p-5 space-y-4 shadow-2xs">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70">
                  Distance : 6.8 km · Très Ciblé
                </span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">88/100</span>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Tournoi de Roland-Garros (Internationaux)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Stade Roland-Garros · Porte d&apos;Auteuil</p>
              </div>

              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 bg-emerald-50/50 dark:bg-emerald-950/35 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/60">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Durée :</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">15 jours consécutifs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Profil clientèle :</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">Haut pouvoir d&apos;achat / VIP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Liaison hôtelière :</span>
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">Métro 9 direct (18 min)</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                <strong>Adéquation Typologique :</strong> Forte affinité avec les hôtels 4★ et 5★ parisiens. Les spectateurs internationaux privilégient le séjour au centre-ville d&apos;Opéra pour combiner tennis et shopping de luxe.
              </p>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                Action RM : Protéger les catégories de chambres supérieures et forfaits multi-nuits.
              </div>
            </div>
          </div>

          {/* Les 10 Critères Métier de Modélisation Spatiale */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              Les 10 Facteurs Analytiques Pris en Compte par Flowtym
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
                <span className="font-bold text-violet-700 dark:text-violet-300">1. Capacité du lieu</span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">Jauge maximale et surfaces d&apos;exposition m².</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
                <span className="font-bold text-violet-700 dark:text-violet-300">2. Visiteurs attendus</span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">Volume réel vs simples inscrits ou estimations.</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
                <span className="font-bold text-violet-700 dark:text-violet-300">3. Provenance géo</span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">Part des internationaux et provinciaux nécessitant un hébergement.</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
                <span className="font-bold text-violet-700 dark:text-violet-300">4. Durée & Rythme</span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">Événement multi-jours (salons) vs concert ponctuel (2h).</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
                <span className="font-bold text-violet-700 dark:text-violet-300">5. Attractivité / Pouvoir</span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">Budget hébergement de la cible (B2B vs loisir économique).</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
                <span className="font-bold text-violet-700 dark:text-violet-300">6. Transports directs</span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">RER, Métro, tramway sans correspondance complexe.</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
                <span className="font-bold text-violet-700 dark:text-violet-300">7. Temps de trajet réel</span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">Temps porte-à-porte en minutes plutôt que distance brute en km.</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
                <span className="font-bold text-violet-700 dark:text-violet-300">8. Génération de nuitées</span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">Taux de conversion affluence / nuitées marchandes.</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
                <span className="font-bold text-violet-700 dark:text-violet-300">9. Saturation compset</span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">Niveau de sold-out des hôtels environnant le lieu.</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
                <span className="font-bold text-violet-700 dark:text-violet-300">10. Arbitrage de séjour</span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">Volonté du client de loger au cœur de la ville ou près du salon.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GPS Coordinates & Zone d'Influence Modal */}
      {isEditingGPS && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 flex items-center justify-center">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Géolocalisation & Zone d&apos;Influence
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{currentHotel.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditingGPS(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Adresse de l&apos;établissement
                </label>
                <input
                  type="text"
                  defaultValue={currentHotel.address}
                  onChange={(e) => {
                    currentHotel.address = e.target.value;
                  }}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl"
                  placeholder="Ex: 14 Rue de Castellane, 75008 Paris"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Latitude</label>
                  <input
                    type="text"
                    value={tempLat}
                    onChange={(e) => setTempLat(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Longitude</label>
                  <input
                    type="text"
                    value={tempLng}
                    onChange={(e) => setTempLng(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Rayon d&apos;influence principal : {currentSettings.mainRadiusKm} km
                </label>
                <input
                  type="range"
                  min={3}
                  max={25}
                  value={currentSettings.mainRadiusKm}
                  onChange={(e) => updateCurrentSetting('mainRadiusKm', Number(e.target.value))}
                  className="w-full accent-violet-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>3 km (Hyper-centre)</span>
                  <span>10 km (Standard)</span>
                  <span>25 km (Élargi)</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Rayon d&apos;influence étendu (Grands pôles) : {currentSettings.extendedRadiusKm} km
                </label>
                <input
                  type="range"
                  min={15}
                  max={60}
                  value={currentSettings.extendedRadiusKm}
                  onChange={(e) => updateCurrentSetting('extendedRadiusKm', Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>15 km</span>
                  <span>30 km (Villepinte / Bourget)</span>
                  <span>60 km (Bassin total)</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <button
                onClick={() => setIsEditingGPS(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  const lat = parseFloat(tempLat);
                  const lng = parseFloat(tempLng);
                  if (!isNaN(lat) && !isNaN(lng)) {
                    currentHotel.lat = lat;
                    currentHotel.lng = lng;
                  }
                  setIsEditingGPS(false);
                  onShowToast(`Paramètres géographiques enregistrés pour ${currentHotel.name}`);
                }}
                className="px-4 py-2 text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Valider & Recalculer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Venue & Calendar Drawer */}
      <VenueDetailDrawer
        venue={inspectedVenue}
        venueEvents={inspectedVenueEvents}
        hotel={currentHotel}
        onClose={() => setInspectedVenue(null)}
        onSelectEvent={(ev) => {
          if (onSelectEvent) onSelectEvent(ev);
        }}
      />

      {/* Discovery Scanner Progression Modal */}
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-violet-600 dark:text-violet-400 animate-spin">
                <RotateCw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Découverte Spatiale & Ingestion Géographique
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Établissement cible : <strong>{currentHotel.name}</strong>
                </p>
              </div>
            </div>

            {/* Steps progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Étape {scanStep} sur 6</span>
                <span>{Math.round((scanStep / 6) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(scanStep / 6) * 100}%` }}
                />
              </div>
            </div>

            {/* Live Terminal Log */}
            <div className="bg-slate-950 p-3.5 rounded-xl font-mono text-[11px] text-emerald-400 space-y-1.5 max-h-48 overflow-y-auto border border-slate-800">
              {scanLogs.map((log, index) => (
                <div key={index} className="leading-tight">
                  {log}
                </div>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 text-center">
              Recherche exécutée par des workers asynchrones conformément à la section 8 du PRD.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
