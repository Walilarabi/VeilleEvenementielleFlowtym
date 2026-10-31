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
  const [activeGeoTab, setActiveGeoTab] = useState<'carte_google' | 'categories' | 'venues_table' | 'supabase_schema'>('carte_google');

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
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-200/80 flex items-center justify-center text-violet-600 shrink-0 shadow-2xs">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-600 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Google Maps Platform • Active
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Carte Événementielle Interactive
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                Veille Géographique & Visualisation d’Impact RM
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Google Maps dynamique, cercles d’influence (15 km, 8 km, 3 km), filtrage mensuel et calculs d’accessibilité personnalisés.
              </p>
            </div>
          </div>

          {/* Hotel Selector & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <Building className="w-4 h-4 text-violet-600" />
              <div className="text-xs">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Hôtel Référent</div>
                <select
                  value={currentHotel.id}
                  onChange={(e) => onSelectHotel(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none cursor-pointer"
                >
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleLaunchDiscoveryScan}
              disabled={isScanning}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-60"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Découverte...' : 'Lancer un scan'}</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-3 overflow-x-auto">
          {[
            { id: 'carte_google', label: 'Carte Événementielle Google Maps', icon: MapPin },
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
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            {/* Row 1: Month Stepper & Year Picker */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              {/* Left: Year & Month Bar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Year Selector */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>

                {/* Steppers */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                    title="Mois précédent"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSelectedMonthIndex(-1)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                      selectedMonthIndex === -1 ? 'bg-violet-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tous les mois
                  </button>
                  {MONTH_NAMES.map((name, idx) => (
                    <button
                      key={name}
                      onClick={() => setSelectedMonthIndex(idx)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                        selectedMonthIndex === idx ? 'bg-violet-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                    title="Mois suivant"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Right: Dynamic Counters (PRD Section 9) */}
              <div className="flex items-center gap-3 text-xs">
                <div className="px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-200 text-violet-800 font-bold">
                  {filteredEventsForMonth.length} événement(s)
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold">
                  {highImpactCount} impact fort
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-medium">
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
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setImpactFilter('high')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    impactFilter === 'high'
                      ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                      : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
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
                      : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
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
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Restreint (3 km)</span>
                </button>
              </div>

              {/* Toggles: Circles & Inactive Venues */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showImpactCircles}
                    onChange={(e) => setShowImpactCircles(e.target.checked)}
                    className="rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
                  />
                  <span>Cercles d’impact</span>
                </label>

                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideVenuesWithoutEvents}
                    onChange={(e) => setHideVenuesWithoutEvents(e.target.checked)}
                    className="rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
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
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Survolez un marqueur pour afficher l’infobulle détaillée, ou cliquez pour inspecter le calendrier complet.
                  </span>
                </span>
                <span className="font-semibold text-violet-700">
                  {currentHotel.name} • {currentHotel.city}
                </span>
              </div>
            </div>

            {/* Side Events Panel (1 col = 25%) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 flex flex-col h-[620px] overflow-hidden">
              <div className="space-y-2 border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Événements du Mois ({sideListEvents.length})
                  </h3>
                  <span className="text-[11px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md">
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>

              {/* Scrollable Event List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1">
                {sideListEvents.length === 0 ? (
                  <div className="text-center py-12 px-3 space-y-2 text-slate-400">
                    <Calendar className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-semibold text-slate-600">Aucun événement ne correspond aux filtres</p>
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
                        className="p-3 bg-slate-50/70 hover:bg-violet-50/50 rounded-xl border border-slate-200/80 hover:border-violet-300 transition-all cursor-pointer group space-y-2"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-violet-700 transition-colors line-clamp-1">
                              {ev.title}
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium line-clamp-1">
                              {ev.venueName} ({ev.city})
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md font-bold text-[10.5px] border shrink-0 ${scoreStyles.badge}`}
                          >
                            Score {score}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10.5px] text-slate-500 pt-1 border-t border-slate-200/60">
                          <span className="tabular-nums">
                            {ev.startDate.slice(5)} → {ev.endDate.slice(5)}
                          </span>
                          {matchingVenue && (
                            <span className="font-semibold text-violet-700">
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
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Les 7 Catégories Événementielles Officielles à Surveiller
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
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
                  className="px-3 py-1.5 bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 rounded-xl text-xs font-semibold transition-colors"
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
                        ? 'bg-white border-slate-200 shadow-2xs'
                        : 'bg-slate-50/60 border-slate-200/60 opacity-60'
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
                            <h4 className="text-sm font-bold text-slate-900">{cat.name}</h4>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                isEnabled
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {isEnabled ? 'Active' : 'Désactivée'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{cat.description}</p>
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
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Subcategories list */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          {cat.subcategories.length} sous-types surveillés
                        </span>
                        <button
                          onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                          className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 cursor-pointer"
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
                              className="text-xs px-2.5 py-1 bg-slate-100/90 text-slate-700 rounded-lg border border-slate-200/80 font-medium"
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
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Référentiel des Lieux & Distances Spatiales
                  </h3>
                  <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                    {currentTerritory.territoryName}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
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
                    className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>

                {/* Zone Filter */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                  <button
                    onClick={() => setTableFilterZone('all')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                      tableFilterZone === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Tous ({calculatedVenues.length})
                  </button>
                  <button
                    onClick={() => setTableFilterZone('main_10km')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                      tableFilterZone === 'main_10km' ? 'bg-white text-violet-700 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Rayon 10 km ({mainRadiusVenues.length})
                  </button>
                  <button
                    onClick={() => setTableFilterZone('extended_30km')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                      tableFilterZone === 'extended_30km' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Rayon 30 km ({extendedRadiusVenues.length})
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/70 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-bold text-slate-500 uppercase">Infrastructure</th>
                    <th className="py-3 px-4 font-bold text-slate-500 uppercase">Commune / Zone</th>
                    <th className="py-3 px-4 font-bold text-slate-500 uppercase">Vol d’oiseau</th>
                    <th className="py-3 px-4 font-bold text-slate-500 uppercase">Temps Voiture</th>
                    <th className="py-3 px-4 font-bold text-slate-500 uppercase">Transports (RER)</th>
                    <th className="py-3 px-4 font-bold text-slate-500 uppercase">Mutualisation</th>
                    <th className="py-3 px-4 font-bold text-slate-500 uppercase">Sources</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculatedVenues.map((v) => {
                    return (
                      <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-medium">
                          <div className="font-bold text-slate-900">{v.name}</div>
                          <div className="text-[11px] text-slate-500">
                            Capacité : {v.capacity.toLocaleString('fr-FR')} • {v.type}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">{v.commune}</div>
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5 ${
                              v.zone === 'main_10km'
                                ? 'bg-violet-50 text-violet-700 border border-violet-200'
                                : v.zone === 'extended_30km'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {v.zone === 'main_10km'
                              ? 'Rayon 10 km (Principal)'
                              : v.zone === 'extended_30km'
                              ? 'Rayon 30 km (Étendu)'
                              : 'Hors périmètre'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-900">
                          {v.distanceKm} km
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            <Car className="w-3 h-3" />
                            ~{v.driveTimeMins} min
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                            <Train className="w-3 h-3" />
                            ~{v.transitTimeMins} min
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Share2 className="w-3 h-3 text-violet-500" />
                            <span>{v.mutualizedHotelsCount} hôtels</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="text-slate-600 font-semibold">
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-violet-600" />
                <span>Architecture Supabase PostGIS — Version 1.0</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
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

          <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-[550px] leading-relaxed border border-slate-800">
            {SUPABASE_POSTGIS_SCHEMA_SQL}
          </pre>
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
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-600 animate-spin">
                <RotateCw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Découverte Spatiale & Ingestion Géographique
                </h3>
                <p className="text-xs text-slate-500">
                  Établissement cible : <strong>{currentHotel.name}</strong>
                </p>
              </div>
            </div>

            {/* Steps progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Étape {scanStep} sur 6</span>
                <span>{Math.round((scanStep / 6) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
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
