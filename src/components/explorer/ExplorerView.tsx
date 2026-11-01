import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Compass,
  MapPin,
  Calendar,
  Building2,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Filter,
  LayoutGrid,
  Table as TableIcon,
  Repeat,
  Info,
  Clock,
  Layers,
  Flame,
  AlertTriangle,
} from 'lucide-react';
import { EventItem, Hotel, EventCategory, RMImpactLevel } from '../../types';
import {
  formatEventDateRange,
  getCategoryLabel,
  getImpactColorClasses,
  getRMScoreColorClasses,
} from '../../utils/helpers';
import { getTerritoryForHotel, OFFICIAL_TERRITORIES_DIRECTORY } from '../../data/geoData';

interface ExplorerViewProps {
  events: EventItem[];
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectEvent: (event: EventItem) => void;
}

export const ExplorerView: React.FC<ExplorerViewProps> = ({
  events,
  hotels,
  selectedHotelId,
  onSelectEvent,
}) => {
  const currentHotel = hotels.find((h) => h.id === selectedHotelId) || hotels[0];

  // Determine the geographic catchment territory automatically based on hotel location
  const hotelTerritory = useMemo(() => {
    return getTerritoryForHotel(currentHotel);
  }, [currentHotel]);

  // View mode: 'cards' or 'table'
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  const [query, setQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [radiusKm, setRadiusKm] = useState<number>(30);
  const [minRMScore, setMinRMScore] = useState<number>(0);

  // Dynamic quick searches tailored to the active hotel's destination
  const quickSearches = useMemo(() => {
    const cityName = currentHotel.city.toLowerCase();
    if (cityName.includes('paris')) {
      return [
        'Salon des Maires & Salons institutionnels',
        'Paris · Salons & Foires > 100k pax',
        'Concerts & Arena (Bercy / La Défense)',
        'Stade de France & Événements sportifs',
        'Fashion Week & Semaines du Luxe',
      ];
    }
    if (cityName.includes('lyon')) {
      return [
        'Lyon · Eurexpo & Salons professionnels',
        'Congrès Médical & ESMO Lyon',
        'Fête des Lumières Presqu’île',
        'Groupama Stadium & Sport',
      ];
    }
    if (cityName.includes('nice')) {
      return [
        'Nice · Salons & Congrès Acropolis',
        'Cannes & Festivals internationaux',
        'Marathon des Alpes-Maritimes',
        'Grands Événements Riviera',
      ];
    }
    if (cityName.includes('marseille')) {
      return [
        'Marseille · Parc Chanot & Foires',
        'Orange Vélodrome & Grands Événements',
        'Congrès Médicaux Bouches-du-Rhône',
        'Festivals & Culture Méditerranée',
      ];
    }
    if (cityName.includes('barcelon')) {
      return [
        'Barcelone · Fira Gran Via & MWC',
        'Congrès Internationaux Catalogne',
        'Palau Sant Jordi & Concerts',
        'Grands Salons Professionnels',
      ];
    }
    return [
      `${currentHotel.city} · Salons & Foires`,
      `${currentHotel.city} · Congrès Médicaux & Corporate`,
      `${currentHotel.city} · Concerts & Spectacles`,
      `${currentHotel.city} · Événements sportifs`,
    ];
  }, [currentHotel.city]);

  const handleApplyQuickSearch = (text: string) => {
    if (text.includes('Salon des Maires')) {
      setQuery('Salon des Maires');
    } else {
      setQuery(text);
    }
  };

  // Helper to check whether an event belongs to the current hotel's geographic catchment zone
  const isEventInCatchment = (ev: EventItem): boolean => {
    // 1. If explicit hotel impact is computed for this specific hotel
    if (ev.hotelImpacts && ev.hotelImpacts[currentHotel.id]) {
      return true;
    }

    const evCity = (ev.city || '').trim().toLowerCase();
    const hotelCity = (currentHotel.city || '').trim().toLowerCase();

    // 2. Exact match with hotel city
    if (evCity === hotelCity || evCity.includes(hotelCity) || hotelCity.includes(evCity)) {
      return true;
    }

    // 3. Known key communes of this territory
    const keyCommunes = hotelTerritory.keyCommunes || [];
    const isInKeyCommunes = keyCommunes.some((commune) => {
      const c = commune.toLowerCase();
      return c.includes(evCity) || evCity.includes(c.split(' ')[0]);
    });
    if (isInKeyCommunes) {
      return true;
    }

    // 4. Exclusion of other distinct metropolitan hubs
    const distinctHubs = [
      'paris',
      'lyon',
      'nice',
      'marseille',
      'bordeaux',
      'lille',
      'barcelone',
      'barcelona',
      'londres',
      'london',
      'bruxelles',
      'brussels',
    ];

    const isEvInOtherHub = distinctHubs.some((hub) => {
      if (hotelCity.includes(hub) || hub.includes(hotelCity)) return false;
      return evCity.includes(hub) || hub.includes(evCity);
    });

    if (isEvInOtherHub) {
      return false;
    }

    // Default: if it doesn't conflict with other hubs and has no distance conflict
    return true;
  };

  // 1. Automatically restrict events to the hotel's geographic zone
  const catchmentEvents = useMemo(() => {
    return events.filter(isEventInCatchment);
  }, [events, currentHotel.id, currentHotel.city, hotelTerritory]);

  // 2. Extract strictly the cities present in this hotel's geographic zone
  const availableCities = useMemo(() => {
    const citySet = new Set<string>();

    // Add current hotel's city
    if (currentHotel.city) {
      citySet.add(currentHotel.city);
    }

    // Add all cities found in catchment events
    catchmentEvents.forEach((ev) => {
      if (ev.city && ev.city.trim()) {
        citySet.add(ev.city.trim());
      }
    });

    // Sort: hotel city first, then alphabetically
    const list = Array.from(citySet);
    return list.sort((a, b) => {
      if (a.toLowerCase() === currentHotel.city.toLowerCase()) return -1;
      if (b.toLowerCase() === currentHotel.city.toLowerCase()) return 1;
      return a.localeCompare(b);
    });
  }, [catchmentEvents, currentHotel.city]);

  // When changing hotels, reset selected city if the previous city is not in the new catchment
  useEffect(() => {
    if (selectedCity !== 'all' && !availableCities.includes(selectedCity)) {
      setSelectedCity('all');
    }
  }, [availableCities, selectedCity]);

  // Filter logic across the catchment events
  const filteredEvents = useMemo(() => {
    return catchmentEvents.filter((ev) => {
      // Text search
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        const matchTitle = ev.title.toLowerCase().includes(q);
        const matchSubtitle = (ev.subtitle || '').toLowerCase().includes(q);
        const matchVenue = ev.venueName.toLowerCase().includes(q);
        const matchCity = ev.city.toLowerCase().includes(q);
        const matchCat = getCategoryLabel(ev.category).toLowerCase().includes(q);
        const matchSources = (ev.sources || []).some((s) => s.toLowerCase().includes(q));
        const matchNotes = (ev.notes || '').toLowerCase().includes(q);

        // Special handling for acronyms and keywords (e.g. "SMCL", "Maires", "Collectivités", "AMF")
        const isSmclMatch =
          (q.includes('smcl') || q.includes('maire') || q.includes('collectiv')) &&
          (ev.title.toLowerCase().includes('maire') || (ev.subtitle || '').toLowerCase().includes('maire'));

        if (!matchTitle && !matchSubtitle && !matchVenue && !matchCity && !matchCat && !matchSources && !matchNotes && !isSmclMatch) {
          return false;
        }
      }

      // City filter: strictly matching selected city in this zone
      if (selectedCity !== 'all' && ev.city.toLowerCase() !== selectedCity.toLowerCase()) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && ev.category !== selectedCategory) {
        return false;
      }

      // Min RM Score
      if (ev.scoreBreakdown.finalRMScore < minRMScore) {
        return false;
      }

      // Radius filter: check hotelImpacts distance if recorded
      const hotelImp = ev.hotelImpacts ? ev.hotelImpacts[currentHotel.id] : undefined;
      if (hotelImp && hotelImp.distanceKm > radiusKm) {
        return false;
      }

      return true;
    });
  }, [catchmentEvents, query, selectedCity, selectedCategory, minRMScore, radiusKm, currentHotel.id]);

  return (
    <div className="space-y-6">
      {/* Explorer Central Search Hero */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600 flex items-center justify-center text-white shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Explorer & Découverte Événementielle
                </h2>
                <span className="text-[11px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                  Zone auto-adaptée
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Périmètre restreint automatiquement à la zone géographique proche de{' '}
                <strong className="text-slate-700 font-semibold">{currentHotel.name}</strong> ({currentHotel.city})
              </p>
            </div>
          </div>

          {/* Catchment Info Chip */}
          <div className="inline-flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 shrink-0">
            <MapPin className="w-3.5 h-3.5 text-violet-600" />
            <span>
              Bassin actif : <strong className="text-slate-900">{hotelTerritory.territoryName}</strong>
            </span>
          </div>
        </div>

        {/* Central Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-violet-600 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Ex: Rechercher des salons, congrès ou spectacles à ${currentHotel.city} et environs...`}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-24 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 shadow-2xs"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700 px-2 py-1"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Quick Suggestion Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Recherches types :
          </span>
          {quickSearches.map((qs) => (
            <button
              key={qs}
              onClick={() => handleApplyQuickSearch(qs)}
              className="text-xs text-slate-600 bg-slate-100 hover:bg-violet-50 hover:text-violet-700 px-3 py-1 rounded-lg transition-colors border border-transparent hover:border-violet-200 cursor-pointer"
            >
              {qs}
            </button>
          ))}
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Ville ou Région (Périmètre {currentHotel.city})
            </label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium"
            >
              <option value="all">
                Toutes les villes ({hotelTerritory.territoryName})
              </option>
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  {city} {city.toLowerCase() === currentHotel.city.toLowerCase() ? '· Établissement' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Catégorie Métier
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium"
            >
              <option value="all">Toutes les catégories</option>
              <option value="salons_foires">Salons & Foires</option>
              <option value="congres_medical">Congrès & Médical</option>
              <option value="concerts_spectacles">Concerts & Spectacles</option>
              <option value="sport">Sport & Compétitions</option>
              <option value="mode_luxe">Mode & Luxe</option>
              <option value="corporate_sommet">Sommets & Corporate</option>
              <option value="festivals">Festivals & Culture</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Rayon d&apos;impact hôtel
              </label>
              <span className="text-xs font-bold text-violet-700 tabular-nums">
                &le; {radiusKm} km
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={50}
              step={2}
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseInt(e.target.value, 10))}
              className="w-full accent-violet-600 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Score RM Minimum
              </label>
              <span className="text-xs font-bold text-violet-700 tabular-nums">
                &ge; {minRMScore}/100
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={minRMScore}
              onChange={(e) => setMinRMScore(parseInt(e.target.value, 10))}
              className="w-full accent-violet-600 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Results Header with View Mode Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-600">
            <span>Résultats : </span>
            <strong className="text-slate-900 font-bold tabular-nums">
              {filteredEvents.length} événements qualifiés
            </strong>{' '}
            <span className="hidden sm:inline">sur la zone {hotelTerritory.territoryName}</span>
          </div>
        </div>

        {/* View Mode Toggle: Table vs Cards */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 hidden md:inline">
            Affichage :
          </span>
          <div className="bg-slate-100 p-1 rounded-xl inline-flex items-center gap-1 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-violet-700 shadow-2xs font-bold border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Afficher la vue liste structurée sous forme de tableau"
            >
              <TableIcon className="w-3.5 h-3.5 text-violet-600" />
              <span>Vue Tableau</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-violet-700 shadow-2xs font-bold border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Afficher la vue en grille de cartes"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-violet-600" />
              <span>Vue Cartes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Results Display: Empty State or Active View */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">
            Aucun événement ne correspond à cette sélection dans la zone {hotelTerritory.territoryName}
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Élargissez le rayon kilométrique ou réinitialisez les filtres pour découvrir davantage d&apos;opportunités locales.
          </p>
          <button
            onClick={() => {
              setQuery('');
              setSelectedCity('all');
              setSelectedCategory('all');
              setMinRMScore(0);
              setRadiusKm(50);
            }}
            className="px-4 py-2 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors cursor-pointer"
          >
            Réinitialiser les critères
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* ================= VUE TABLEAU ================= */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Événement</th>
                  <th className="py-3 px-3">Dates</th>
                  <th className="py-3 px-3">Ville & Lieu</th>
                  <th className="py-3 px-3">Catégorie</th>
                  <th className="py-3 px-3 text-right">Affluence estimée</th>
                  <th className="py-3 px-3 text-center">Score RM</th>
                  <th className="py-3 px-3 text-center">Impact RM</th>
                  <th className="py-3 px-3 text-center">Statut</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredEvents.map((ev) => {
                  const impactStyles = getImpactColorClasses(ev.impactLevel);
                  const scoreClasses = getRMScoreColorClasses(ev.scoreBreakdown.finalRMScore);
                  const hotelImp = ev.hotelImpacts ? ev.hotelImpacts[currentHotel.id] : undefined;

                  return (
                    <tr
                      key={ev.id}
                      onClick={() => onSelectEvent(ev)}
                      className="hover:bg-violet-50/30 transition-colors cursor-pointer group"
                    >
                      {/* 1. Nom de l'événement */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-start gap-2">
                          {ev.isRecurring && (
                            <span
                              title="Événement récurrent identifié"
                              className="mt-0.5 p-1 rounded-md bg-violet-50 text-violet-600 border border-violet-100 shrink-0"
                            >
                              <Repeat className="w-3 h-3" />
                            </span>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-violet-700 transition-colors leading-snug">
                              {ev.title}
                            </div>
                            {ev.subtitle && (
                              <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                {ev.subtitle}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Dates de début et de fin */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-700 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formatEventDateRange(ev.startDate, ev.endDate)}</span>
                        </div>
                      </td>

                      {/* 3. Ville et lieu */}
                      <td className="py-3.5 px-3 max-w-[200px]">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <div className="truncate">
                            <span className="font-semibold text-slate-800">{ev.city}</span>
                            <span className="text-slate-400"> · </span>
                            <span className="text-slate-500 text-[11px]">{ev.venueName}</span>
                            {hotelImp && (
                              <span className="text-[10px] text-violet-600 font-medium ml-1">
                                ({hotelImp.distanceKm} km)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. Catégorie */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/70">
                          {getCategoryLabel(ev.category)}
                        </span>
                      </td>

                      {/* 5. Visiteurs estimés */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        {ev.expectedAttendance ? (
                          <div>
                            <div className="font-bold text-slate-800 tabular-nums">
                              {ev.expectedAttendance.toLocaleString('fr-FR')} pax
                            </div>
                            {ev.internationalRatioPercent !== undefined && (
                              <div className="text-[10px] text-slate-400 font-medium">
                                {ev.internationalRatioPercent}% intl
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">NC</span>
                        )}
                      </td>

                      {/* 6. Score RM avec code couleur conservé (vert, orange, rouge) */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border tabular-nums ${scoreClasses.bg} ${scoreClasses.text} ${scoreClasses.border}`}
                          >
                            <span>{ev.scoreBreakdown.finalRMScore}</span>
                            <span className="text-[10px] opacity-70">/100</span>
                          </span>
                          <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full ${scoreClasses.barColor}`}
                              style={{ width: `${Math.min(100, ev.scoreBreakdown.finalRMScore)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 7. Impact potentiel sur l'activité hôtelière */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full inline-block ${impactStyles.badgeBg}`}
                        >
                          {ev.impactLevel}
                        </span>
                        {hotelImp && hotelImp.estimatedADRBoostPercent > 0 && (
                          <div className="text-[10px] font-semibold text-violet-700 mt-0.5">
                            ADR +{hotelImp.estimatedADRBoostPercent}%
                          </div>
                        )}
                      </td>

                      {/* 8. Statut ou niveau de pertinence */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            ev.status === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : ev.status === 'estimated_recurrent'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {ev.status === 'confirmed' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Confirmé</span>
                            </>
                          ) : ev.status === 'estimated_recurrent' ? (
                            <>
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Estimé récurrent</span>
                            </>
                          ) : ev.status === 'announced_pending' ? (
                            <span>Annoncé</span>
                          ) : (
                            <span>À confirmer</span>
                          )}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(ev);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors border border-violet-100 cursor-pointer"
                        >
                          <span>Détails</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= VUE CARTES ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((ev) => {
            const impactStyles = getImpactColorClasses(ev.impactLevel);
            const scoreClasses = getRMScoreColorClasses(ev.scoreBreakdown.finalRMScore);
            const hotelImp = ev.hotelImpacts ? ev.hotelImpacts[currentHotel.id] : undefined;

            return (
              <div
                key={ev.id}
                onClick={() => onSelectEvent(ev)}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 hover:border-violet-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-2.5">
                  {/* Top metadata tags */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${impactStyles.badgeBg}`}
                    >
                      {ev.impactLevel}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-lg border tabular-nums ${scoreClasses.bg} ${scoreClasses.text} ${scoreClasses.border}`}
                    >
                      Score RM {ev.scoreBreakdown.finalRMScore}/100
                    </span>
                  </div>

                  {/* Title & Dates */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-violet-700 transition-colors leading-snug">
                      {ev.title}
                    </h3>
                    <div className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatEventDateRange(ev.startDate, ev.endDate)}</span>
                    </div>
                  </div>

                  {/* Venue & City */}
                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {ev.venueName} · <strong className="text-slate-800">{ev.city}</strong>
                    </span>
                  </div>

                  {/* Key Stats */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-xs border border-slate-100">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Affluence</div>
                      <div className="font-bold text-slate-800 tabular-nums mt-0.5">
                        {ev.expectedAttendance ? `${ev.expectedAttendance.toLocaleString('fr-FR')} pax` : 'NC'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Clientèle Intl</div>
                      <div className="font-bold text-slate-800 tabular-nums mt-0.5">
                        {ev.internationalRatioPercent !== undefined ? `${ev.internationalRatioPercent}%` : 'NC'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hotel specific distance & yield teaser */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="text-slate-500 truncate mr-2">
                    {hotelImp ? (
                      <span className="font-medium text-violet-700">
                        {hotelImp.distanceKm} km · ADR +{hotelImp.estimatedADRBoostPercent}%
                      </span>
                    ) : (
                      <span className="text-slate-400">Périmètre {hotelTerritory.territoryName}</span>
                    )}
                  </div>

                  <span className="text-violet-600 font-bold text-xs inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform shrink-0">
                    <span>Détails</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
