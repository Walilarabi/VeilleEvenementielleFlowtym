/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OfficialCategorySpec, HotelGeoSettings, VenueGeoDetail, GeographicTerritory, Hotel } from '../types';

/**
 * RÉFÉRENTIEL OFFICIEL DES TERRITOIRES DE RÉFÉRENCE (Section 3 du Complément Technique)
 * Conforme à la hiérarchie :
 * 1. Ville et agglomération directe
 * 2. Métropole ou bassin économique
 * 3. Région administrative si le rayonnement événementiel le justifie
 * 4. Zone géographique élargie définie par les infrastructures génératrices de flux
 */
export const OFFICIAL_TERRITORIES_DIRECTORY: Record<string, GeographicTerritory> = {
  Paris: {
    id: 'terr-idf',
    cityKey: 'Paris',
    territoryName: 'Île-de-France',
    territoryType: 'region_administrative',
    description: 'Paris, La Défense, Saint-Denis, Villepinte, Le Bourget, Versailles, Roissy CDG, Marne-la-Vallée',
    keyCommunes: [
      'Paris (75)',
      'Nanterre / La Défense (92)',
      'Saint-Denis (93)',
      'Villepinte (93)',
      'Le Bourget (93)',
      'Versailles (78)',
      'Roissy-en-France (95)',
      'Chessy / Marne-la-Vallée (77)',
    ],
    bounds: {
      south: 48.70,
      west: 2.05,
      north: 49.08,
      east: 2.82,
    },
    center: { lat: 48.86, lng: 2.35 },
    defaultZoom: 11,
    minZoom: 9.5,
    maxZoom: 18,
  },
  Lyon: {
    id: 'terr-lyon',
    cityKey: 'Lyon',
    territoryName: 'Métropole de Lyon et bassin lyonnais',
    territoryType: 'metropole_bassin',
    description: 'Lyon, Chassieu (Eurexpo), Villeurbanne, Décines (Groupama Stadium), Saint-Priest',
    keyCommunes: ['Lyon', 'Chassieu', 'Villeurbanne', 'Décines-Charpieu', 'Saint-Priest', 'Vénissieux'],
    bounds: {
      south: 45.62,
      west: 4.70,
      north: 45.88,
      east: 5.05,
    },
    center: { lat: 45.7578, lng: 4.8320 },
    defaultZoom: 11,
    minZoom: 9.5,
    maxZoom: 18,
  },
  Marseille: {
    id: 'terr-marseille',
    cityKey: 'Marseille',
    territoryName: 'Marseille & Bouches-du-Rhône',
    territoryType: 'metropole_bassin',
    description: 'Marseille, Aix-en-Provence, Marignane, Aubagne, Vitrolles',
    keyCommunes: ['Marseille', 'Aix-en-Provence', 'Marignane', 'Aubagne', 'Vitrolles'],
    bounds: {
      south: 43.18,
      west: 5.15,
      north: 43.58,
      east: 5.58,
    },
    center: { lat: 43.30, lng: 5.38 },
    defaultZoom: 11,
    minZoom: 9.5,
    maxZoom: 18,
  },
  Barcelone: {
    id: 'terr-barcelone',
    cityKey: 'Barcelone',
    territoryName: 'Barcelone & Catalogne',
    territoryType: 'metropole_bassin',
    description: 'Barcelone, Fira Barcelona Gran Via, L’Hospitalet, Badalona, Sabadell, Terrassa',
    keyCommunes: ['Barcelone', 'Barcelona', 'L’Hospitalet de Llobregat', 'Badalona', 'Sabadell', 'Terrassa', 'El Prat de Llobregat'],
    bounds: {
      south: 41.25,
      west: 2.00,
      north: 41.52,
      east: 2.30,
    },
    center: { lat: 41.3851, lng: 2.1734 },
    defaultZoom: 11,
    minZoom: 9.5,
    maxZoom: 18,
  },
  Lille: {
    id: 'terr-lille',
    cityKey: 'Lille',
    territoryName: 'Métropole européenne de Lille et bassin pertinent',
    territoryType: 'metropole_bassin',
    description: 'Lille, Villeneuve-d’Ascq (Stade Pierre-Mauroy), Roubaix, Tourcoing',
    keyCommunes: ['Lille', 'Villeneuve-d’Ascq', 'Roubaix', 'Tourcoing', 'Marcq-en-Barœul'],
    bounds: {
      south: 50.55,
      west: 2.95,
      north: 50.75,
      east: 3.25,
    },
    center: { lat: 50.63, lng: 3.07 },
    defaultZoom: 11,
    minZoom: 9.5,
    maxZoom: 18,
  },
  Bordeaux: {
    id: 'terr-bordeaux',
    cityKey: 'Bordeaux',
    territoryName: 'Métropole de Bordeaux et bassin pertinent',
    territoryType: 'metropole_bassin',
    description: 'Bordeaux, Bordeaux-Lac (Parc des Expos), Mérignac, Pessac, Floirac',
    keyCommunes: ['Bordeaux', 'Mérignac', 'Pessac', 'Floirac', 'Cenon'],
    bounds: {
      south: 44.75,
      west: -0.70,
      north: 44.95,
      east: -0.45,
    },
    center: { lat: 44.84, lng: -0.58 },
    defaultZoom: 11,
    minZoom: 9.5,
    maxZoom: 18,
  },
  Nice: {
    id: 'terr-nice',
    cityKey: 'Nice',
    territoryName: 'Métropole Nice Côte d’Azur et bassin pertinent',
    territoryType: 'metropole_bassin',
    description: 'Nice, Cannes (Palais des Festivals), Antibes, Monaco, Cagnes-sur-Mer',
    keyCommunes: ['Nice', 'Cannes', 'Antibes', 'Monaco', 'Cagnes-sur-Mer'],
    bounds: {
      south: 43.50,
      west: 7.00,
      north: 43.78,
      east: 7.45,
    },
    center: { lat: 43.70, lng: 7.26 },
    defaultZoom: 11,
    minZoom: 9.5,
    maxZoom: 18,
  },
  Londres: {
    id: 'terr-london',
    cityKey: 'Londres',
    territoryName: 'Greater London',
    territoryType: 'greater_capital',
    description: 'Central London, Westminster, Canary Wharf, ExCeL London, Wembley, O2 Arena',
    keyCommunes: ['City of London', 'Westminster', 'Newham (ExCeL)', 'Greenwich (O2)', 'Brent (Wembley)'],
    bounds: {
      south: 51.35,
      west: -0.45,
      north: 51.65,
      east: 0.15,
    },
    center: { lat: 51.5074, lng: -0.1278 },
    defaultZoom: 11,
    minZoom: 9.5,
    maxZoom: 18,
  },
  Bruxelles: {
    id: 'terr-bruxelles',
    cityKey: 'Bruxelles',
    territoryName: 'Région de Bruxelles-Capitale',
    territoryType: 'region_administrative',
    description: 'Ville de Bruxelles, Heysel (Bruxelles Expo), Ixelles, Tour & Taxis, Quartier Européen',
    keyCommunes: ['Bruxelles-Ville', 'Laeken / Heysel', 'Ixelles', 'Saint-Gilles', 'Schaerbeek'],
    bounds: {
      south: 50.78,
      west: 4.28,
      north: 50.92,
      east: 4.45,
    },
    center: { lat: 50.8503, lng: 4.3517 },
    defaultZoom: 11,
    minZoom: 9.5,
    maxZoom: 18,
  },
};

/**
 * Récupère le territoire de référence d'une ville selon le tableau officiel
 */
export function getTerritoryForCity(city: string): GeographicTerritory {
  const normalized = city.trim().toLowerCase();
  for (const [key, territory] of Object.entries(OFFICIAL_TERRITORIES_DIRECTORY)) {
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
      return territory;
    }
  }

  // Fallback dynamique centré sur la ville
  return {
    id: `terr-${normalized}`,
    cityKey: city,
    territoryName: `Bassin métropolitain de ${city}`,
    territoryType: 'metropole_bassin',
    description: `Bassin économique et infrastructures de la région de ${city}`,
    keyCommunes: [city],
    bounds: {
      south: 48.0,
      west: 2.0,
      north: 49.0,
      east: 3.0,
    },
    center: { lat: 48.8566, lng: 2.3522 },
    defaultZoom: 11,
    minZoom: 9.5,
    maxZoom: 18,
  };
}

/**
 * Détermine automatiquement le territoire d'un établissement hôtelier
 */
export function getTerritoryForHotel(hotel: Hotel): GeographicTerritory {
  const terr = getTerritoryForCity(hotel.city);
  // Si c'est un fallback généré, on ajuste le centre et le bounding box d'environ 30 km autour de l'hôtel
  if (terr.id === `terr-${hotel.city.trim().toLowerCase()}`) {
    if (hotel.lat === null || hotel.lng === null) return terr;
    const latDelta = 0.25; // ~28 km
    const lngDelta = 0.35; // ~28 km
    return {
      ...terr,
      center: { lat: hotel.lat, lng: hotel.lng },
      bounds: {
        south: hotel.lat - latDelta,
        west: hotel.lng - lngDelta,
        north: hotel.lat + latDelta,
        east: hotel.lng + lngDelta,
      },
    };
  }
  return terr;
}

/**
 * Calcule les coordonnées de cadrage selon le périmètre sélectionné
 */
export function getTerritoryBoundsForScope(
  territory: GeographicTerritory,
  scope: 'metropole_standard' | 'intra_muros_10km' | 'bassin_elargi_50km',
  hotelLat?: number,
  hotelLng?: number
): { south: number; west: number; north: number; east: number } {
  if (scope === 'intra_muros_10km' && hotelLat !== undefined && hotelLng !== undefined) {
    // Périmètre restreint 10 km (~0.09 degré de latitude)
    return {
      south: hotelLat - 0.09,
      west: hotelLng - 0.13,
      north: hotelLat + 0.09,
      east: hotelLng + 0.13,
    };
  }

  if (scope === 'bassin_elargi_50km') {
    // Périmètre élargi (+0.12 degré)
    return {
      south: territory.bounds.south - 0.10,
      west: territory.bounds.west - 0.15,
      north: territory.bounds.north + 0.10,
      east: territory.bounds.east + 0.15,
    };
  }

  // Périmètre standard officiel (ex: Île-de-France métropole)
  return territory.bounds;
}

/**
 * Vérifie si un lieu (coordonnées ou région) se situe dans le territoire de référence
 */
export function isLocationInTerritory(
  lat: number,
  lng: number,
  venueRegion: string,
  territory: GeographicTerritory
): boolean {
  // 1. Vérification par nom de région / métropole
  if (
    territory.territoryName === 'Île-de-France' &&
    (venueRegion === 'Île-de-France' || venueRegion.toLowerCase().includes('paris') || venueRegion.toLowerCase().includes('francil'))
  ) {
    return true;
  }

  // 2. Vérification spatiale des bornes géographiques
  return (
    lat >= territory.bounds.south - 0.05 &&
    lat <= territory.bounds.north + 0.05 &&
    lng >= territory.bounds.west - 0.05 &&
    lng <= territory.bounds.east + 0.05
  );
}

/**
 * LES 7 CATÉGORIES ÉVÉNEMENTIELLES OFFICIELLES (Section 2 du Cahier des Charges)
 * Enregistrées dans une table de référence Supabase, activées par défaut.
 */
export const OFFICIAL_7_CATEGORIES: OfficialCategorySpec[] = [
  {
    id: 'cat-1',
    code: 'expositions_congres',
    number: 1,
    name: 'Expositions et congrès',
    description: 'Palais et parcs des expositions, salons professionnels et centres de congrès majeurs.',
    color: '#3b82f6', // Bleu
    enabled: true,
    subcategories: [
      'Palais des expositions',
      'Parcs d’exposition',
      'Salons professionnels',
      'Centres de congrès',
      'Congrès internationaux',
      'Conférences',
      'Conventions',
      'Forums professionnels',
      'Salons commerciaux',
      'Expositions internationales',
    ],
  },
  {
    id: 'cat-2',
    code: 'concerts_spectacles',
    number: 2,
    name: 'Concerts et spectacles',
    description: 'Concerts, tournées mondiales, spectacles, comédies musicales et grandes productions arena/stade.',
    color: '#8b5cf6', // Violet
    enabled: true,
    subcategories: [
      'Concerts',
      'Tournées internationales',
      'Spectacles',
      'Comédies musicales',
      'Opéras',
      'Festivals en salle',
      'Grandes productions',
      'Événements dans les arenas',
      'Événements dans les stades',
    ],
  },
  {
    id: 'cat-3',
    code: 'sport',
    number: 3,
    name: 'Événements sportifs',
    description: 'Compétitions nationales et internationales, tournois, marathons et sports mécaniques.',
    color: '#ef4444', // Rouge
    enabled: true,
    subcategories: [
      'Football',
      'Rugby',
      'Tennis',
      'Basketball',
      'Handball',
      'Volleyball',
      'Athlétisme',
      'Sports automobiles',
      'Sports mécaniques',
      'Compétitions internationales',
      'Marathons',
      'Championnats nationaux et internationaux',
      'Jeux et tournois sportifs',
    ],
  },
  {
    id: 'cat-4',
    code: 'festivals_culture',
    number: 4,
    name: 'Festivals et culture',
    description: 'Festivals de musique et cinéma, biennales artistiques et manifestations patrimoniales.',
    color: '#ec4899', // Rose
    enabled: true,
    subcategories: [
      'Festivals musicaux',
      'Festivals de cinéma',
      'Festivals culturels',
      'Biennales',
      'Expositions artistiques',
      'Événements culturels',
      'Manifestations patrimoniales',
      'Grands événements artistiques',
    ],
  },
  {
    id: 'cat-5',
    code: 'evenements_professionnels',
    number: 5,
    name: 'Événements professionnels',
    description: 'Conventions d’entreprises, séminaires, forums économiques et lancements de produits mondiaux.',
    color: '#f59e0b', // Ambre
    enabled: true,
    subcategories: [
      'Événements d’entreprises',
      'Conventions commerciales',
      'Séminaires',
      'Forums économiques',
      'Rencontres professionnelles',
      'Assemblées générales importantes',
      'Événements de networking',
      'Lancements internationaux',
      'Événements sectoriels',
    ],
  },
  {
    id: 'cat-6',
    code: 'evenements_institutionnels',
    number: 6,
    name: 'Événements institutionnels',
    description: 'Sommets internationaux, rencontres diplomatiques, visites d’État et conférences de haut niveau.',
    color: '#6366f1', // Indigo
    enabled: true,
    subcategories: [
      'Sommets internationaux',
      'Rencontres diplomatiques',
      'Visites officielles',
      'Réunions gouvernementales',
      'Conférences internationales',
      'Événements institutionnels',
      'Grandes manifestations politiques',
      'Rencontres économiques internationales',
    ],
  },
  {
    id: 'cat-7',
    code: 'evenements_touristiques',
    number: 7,
    name: 'Événements touristiques',
    description: 'Fêtes nationales, carnavals, marchés de Noël, célébrations saisonnières et festivités régionales.',
    color: '#10b981', // Émeraude
    enabled: true,
    subcategories: [
      'Fêtes nationales',
      'Grandes célébrations',
      'Carnaval',
      'Marchés de Noël',
      'Fêtes traditionnelles',
      'Événements saisonniers',
      'Grandes manifestations touristiques',
      'Célébrations locales à rayonnement national ou international',
    ],
  },
];

/**
 * CONFIGURATION STANDARD INITIALE (Section 1 du Cahier des Charges)
 */
export const DEFAULT_HOTEL_GEO_SETTINGS: Omit<HotelGeoSettings, 'hotelId'> = {
  mainRadiusKm: 10,
  extendedRadiusKm: 30,
  distanceUnit: 'km',
  autoDiscoverVenues: true,
  autoDiscoverSources: true,
  autoDiscoverEvents: true,
  includeNeighboringCities: true,
  multilingualSearch: true,
  mandatoryVenueGeolocation: true,
  autoDistanceCalculation: true,
  mutualizeData: true,
  mandatoryHotelImpactAnalysis: true,
  enabledCategoryCodes: OFFICIAL_7_CATEGORIES.map((c) => c.code),
  territoryScope: 'metropole_standard',
  territoryName: 'Île-de-France',
  lastSearchAt: '2026-10-31T03:30:00Z',
  nextSearchScheduledAt: '2026-11-01T04:00:00Z',
  discoveredVenuesCount: 16,
  activeSourcesCount: 42,
};


/**
 * RÉFÉRENTIEL MUTUALISÉ DES INFRASTRUCTURES ÉVÉNEMENTIELLES
 * Avec coordonnées GPS exactes, commune, région, et métadonnées de mutualisation
 */
export const MUTUALIZED_VENUES_DATABASE: Omit<VenueGeoDetail, 'distanceKm' | 'driveTimeMins' | 'transitTimeMins' | 'zone'>[] = [
  {
    id: 'venue-porte-versailles',
    name: 'Paris Expo Porte de Versailles',
    city: 'Paris',
    commune: 'Paris 15e',
    region: 'Île-de-France',
    country: 'France',
    address: '1 Place de la Porte de Versailles, 75015 Paris',
    lat: 48.8322,
    lng: 2.2886,
    capacity: 220000,
    type: 'parc_expositions',
    mutualizedHotelsCount: 4,
    associatedSourcesCount: 14,
    isVerified: true,
    discoveredVia: 'OpenStreetMap & Viparis',
  },
  {
    id: 'venue-nord-villepinte',
    name: 'Paris Nord Villepinte',
    city: 'Villepinte',
    commune: 'Villepinte (93)',
    region: 'Île-de-France',
    country: 'France',
    address: 'ZAC Paris Nord 2, 93420 Villepinte',
    lat: 48.9719,
    lng: 2.5186,
    capacity: 250000,
    type: 'parc_expositions',
    mutualizedHotelsCount: 4,
    associatedSourcesCount: 12,
    isVerified: true,
    discoveredVia: 'Viparis & CCI Paris',
  },
  {
    id: 'venue-defense-arena',
    name: 'Paris La Défense Arena',
    city: 'Nanterre',
    commune: 'Nanterre (92)',
    region: 'Île-de-France',
    country: 'France',
    address: '99 Jardins de l’Arche, 92000 Nanterre',
    lat: 48.8958,
    lng: 2.2297,
    capacity: 40000,
    type: 'arena',
    mutualizedHotelsCount: 4,
    associatedSourcesCount: 9,
    isVerified: true,
    discoveredVia: 'OpenStreetMap & Exploitant',
  },
  {
    id: 'venue-stade-france',
    name: 'Stade de France',
    city: 'Saint-Denis',
    commune: 'Saint-Denis (93)',
    region: 'Île-de-France',
    country: 'France',
    address: 'ZAC du Cornillon Nord, 93200 Saint-Denis',
    lat: 48.9244,
    lng: 2.3601,
    capacity: 80698,
    type: 'stade',
    mutualizedHotelsCount: 4,
    associatedSourcesCount: 11,
    isVerified: true,
    discoveredVia: 'Consortium Stade de France',
  },
  {
    id: 'venue-accor-arena',
    name: 'Accor Arena (Bercy)',
    city: 'Paris',
    commune: 'Paris 12e',
    region: 'Île-de-France',
    country: 'France',
    address: '8 Boulevard de Bercy, 75012 Paris',
    lat: 48.8388,
    lng: 2.3783,
    capacity: 20300,
    type: 'arena',
    mutualizedHotelsCount: 4,
    associatedSourcesCount: 8,
    isVerified: true,
    discoveredVia: 'Accor Arena SAEM',
  },
  {
    id: 'venue-grand-palais',
    name: 'Grand Palais',
    city: 'Paris',
    commune: 'Paris 8e',
    region: 'Île-de-France',
    country: 'France',
    address: '3 Avenue du Général Eisenhower, 75008 Paris',
    lat: 48.8661,
    lng: 2.3125,
    capacity: 15000,
    type: 'espace_public',
    mutualizedHotelsCount: 4,
    associatedSourcesCount: 6,
    isVerified: true,
    discoveredVia: 'RMN Grand Palais',
  },
  {
    id: 'venue-palais-congres',
    name: 'Palais des Congrès de Paris',
    city: 'Paris',
    commune: 'Paris 17e',
    region: 'Île-de-France',
    country: 'France',
    address: '2 Place de la Porte Maillot, 75017 Paris',
    lat: 48.8797,
    lng: 2.2838,
    capacity: 3723,
    type: 'centre_congres',
    mutualizedHotelsCount: 4,
    associatedSourcesCount: 7,
    isVerified: true,
    discoveredVia: 'Viparis Congrès',
  },
  {
    id: 'venue-bourget',
    name: 'Paris Le Bourget Exhibition Centre',
    city: 'Le Bourget',
    commune: 'Le Bourget (93)',
    region: 'Île-de-France',
    country: 'France',
    address: 'Carrefour Charles Lindbergh, 93350 Le Bourget',
    lat: 48.9377,
    lng: 2.4334,
    capacity: 120000,
    type: 'parc_expositions',
    mutualizedHotelsCount: 4,
    associatedSourcesCount: 6,
    isVerified: true,
    discoveredVia: 'SIAE & Viparis',
  },
  {
    id: 'venue-roland-garros',
    name: 'Stade Roland-Garros',
    city: 'Paris',
    commune: 'Paris 16e',
    region: 'Île-de-France',
    country: 'France',
    address: '2 Avenue Gordon Bennett, 75016 Paris',
    lat: 48.8471,
    lng: 2.2494,
    capacity: 35000,
    type: 'stade',
    mutualizedHotelsCount: 4,
    associatedSourcesCount: 5,
    isVerified: true,
    discoveredVia: 'FFT (Fédération Française de Tennis)',
  },
  {
    id: 'venue-zenith-paris',
    name: 'Zénith Paris — La Villette',
    city: 'Paris',
    commune: 'Paris 19e',
    region: 'Île-de-France',
    country: 'France',
    address: '211 Avenue Jean Jaurès, 75019 Paris',
    lat: 48.8936,
    lng: 2.3934,
    capacity: 6804,
    type: 'arena',
    mutualizedHotelsCount: 4,
    associatedSourcesCount: 5,
    isVerified: true,
    discoveredVia: 'Colling & Cie',
  },
  {
    id: 'venue-olympia',
    name: 'L’Olympia Bruno Coquatrix',
    city: 'Paris',
    commune: 'Paris 9e',
    region: 'Île-de-France',
    country: 'France',
    address: '28 Boulevard des Capucines, 75009 Paris',
    lat: 48.8702,
    lng: 2.3283,
    capacity: 2824,
    type: 'theatre',
    mutualizedHotelsCount: 4,
    associatedSourcesCount: 4,
    isVerified: true,
    discoveredVia: 'Vivendi Village',
  },
  {
    id: 'venue-versailles-palais',
    name: 'Palais des Congrès de Versailles',
    city: 'Versailles',
    commune: 'Versailles (78)',
    region: 'Île-de-France',
    country: 'France',
    address: '10 Rue de la Chancellerie, 78000 Versailles',
    lat: 48.8049,
    lng: 2.1204,
    capacity: 1500,
    type: 'centre_congres',
    mutualizedHotelsCount: 4,
    associatedSourcesCount: 4,
    isVerified: true,
    discoveredVia: 'Ville de Versailles & Tourisme',
  },
  {
    id: 'venue-marne-vallee',
    name: 'Disney Event Arena / Newport Bay Center',
    city: 'Chessy',
    commune: 'Chessy (77)',
    region: 'Île-de-France',
    country: 'France',
    address: 'Avenue René Goscinny, 77700 Chessy',
    lat: 48.8722,
    lng: 2.7758,
    capacity: 6500,
    type: 'centre_congres',
    mutualizedHotelsCount: 4,
    associatedSourcesCount: 5,
    isVerified: true,
    discoveredVia: 'Disney Business Solutions',
  },
  // --- MÉTROPOLE DE LYON & BASSIN LYONNAIS ---
  {
    id: 'venue-eurexpo-lyon',
    name: 'Eurexpo Lyon',
    city: 'Lyon',
    commune: 'Chassieu (69)',
    region: 'Auvergne-Rhône-Alpes',
    country: 'France',
    address: 'Boulevard de l’Europe, 69680 Chassieu',
    lat: 45.7331,
    lng: 4.9514,
    capacity: 140000,
    type: 'parc_expositions',
    mutualizedHotelsCount: 2,
    associatedSourcesCount: 10,
    isVerified: true,
    discoveredVia: 'GL Events & Grand Lyon',
  },
  {
    id: 'venue-groupama-stadium',
    name: 'Groupama Stadium & LDLC Arena',
    city: 'Lyon',
    commune: 'Décines-Charpieu (69)',
    region: 'Auvergne-Rhône-Alpes',
    country: 'France',
    address: '10 Avenue Simone Veil, 69150 Décines-Charpieu',
    lat: 45.7653,
    lng: 4.9820,
    capacity: 59186,
    type: 'stade',
    mutualizedHotelsCount: 2,
    associatedSourcesCount: 8,
    isVerified: true,
    discoveredVia: 'OL Groupe',
  },
  {
    id: 'venue-centre-congres-lyon',
    name: 'Centre de Congrès de Lyon',
    city: 'Lyon',
    commune: 'Lyon 6e',
    region: 'Auvergne-Rhône-Alpes',
    country: 'France',
    address: '50 Quai Charles de Gaulle, 69006 Lyon',
    lat: 45.7844,
    lng: 4.8524,
    capacity: 19000,
    type: 'centre_congres',
    mutualizedHotelsCount: 2,
    associatedSourcesCount: 7,
    isVerified: true,
    discoveredVia: 'GL Events & OnlyLyon',
  },
  {
    id: 'venue-halle-tony-garnier',
    name: 'Halle Tony Garnier',
    city: 'Lyon',
    commune: 'Lyon 7e',
    region: 'Auvergne-Rhône-Alpes',
    country: 'France',
    address: '20 Place Docteurs Charles et Christophe Mérieux, 69007 Lyon',
    lat: 45.7302,
    lng: 4.8252,
    capacity: 17000,
    type: 'arena',
    mutualizedHotelsCount: 2,
    associatedSourcesCount: 6,
    isVerified: true,
    discoveredVia: 'Ville de Lyon',
  },
  // --- MÉTROPOLE NICE CÔTE D'AZUR & BASSIN PERTINENT ---
  {
    id: 'venue-palais-festivals-cannes',
    name: 'Palais des Festivals et des Congrès de Cannes',
    city: 'Cannes',
    commune: 'Cannes (06)',
    region: 'Provence-Alpes-Côte d’Azur',
    country: 'France',
    address: '1 Boulevard de la Croisette, 06400 Cannes',
    lat: 43.5516,
    lng: 7.0178,
    capacity: 35000,
    type: 'centre_congres',
    mutualizedHotelsCount: 2,
    associatedSourcesCount: 12,
    isVerified: true,
    discoveredVia: 'SEMAPEC Cannes',
  },
  {
    id: 'venue-allianz-riviera',
    name: 'Allianz Riviera & Palais Nikaïa',
    city: 'Nice',
    commune: 'Nice (06)',
    region: 'Provence-Alpes-Côte d’Azur',
    country: 'France',
    address: 'Boulevard des Jardiniers, 06200 Nice',
    lat: 43.7053,
    lng: 7.1925,
    capacity: 36178,
    type: 'stade',
    mutualizedHotelsCount: 2,
    associatedSourcesCount: 7,
    isVerified: true,
    discoveredVia: 'Nice Éco Stadium',
  },
  {
    id: 'venue-acropolis-nice',
    name: 'Palais des Congrès Nice Acropolis / Port Lympia',
    city: 'Nice',
    commune: 'Nice (06)',
    region: 'Provence-Alpes-Côte d’Azur',
    country: 'France',
    address: '1 Esplanade Kennedy, 06300 Nice',
    lat: 43.7022,
    lng: 7.2801,
    capacity: 12000,
    type: 'centre_congres',
    mutualizedHotelsCount: 2,
    associatedSourcesCount: 6,
    isVerified: true,
    discoveredVia: 'Métropole Nice Côte d’Azur',
  },
];

/**
 * Calcul de la distance à vol d'oiseau (Formule Haversine, équivalent ST_Distance PostGIS)
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Rayon de la Terre en kilomètres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10;
}

/**
 * Estimation du temps de trajet en voiture et transport en commun (Métro/RER)
 */
export function estimateTravelTimes(
  distanceKm: number,
  isSameCity: boolean
): { driveTimeMins: number; transitTimeMins: number } {
  // En zone urbaine / métropolitaine dense (Île-de-France)
  // Vitesse moyenne en voiture : ~20-25 km/h en intra-muros, ~45 km/h en banlieue
  const avgSpeedKmH = isSameCity ? 22 : 38;
  const driveTimeMins = Math.max(5, Math.round((distanceKm / avgSpeedKmH) * 60 + 5));

  // Transports en commun (Métro ~25 km/h avec arrêts, RER ~45 km/h)
  const transitSpeedKmH = distanceKm <= 8 ? 24 : 36;
  const transitTimeMins = Math.max(8, Math.round((distanceKm / transitSpeedKmH) * 60 + 7));

  return { driveTimeMins, transitTimeMins };
}

/**
 * Calcule pour un hôtel donné toutes les infrastructures avec leurs distances précises
 */
export function computeVenuesForHotel(
  hotelLat: number,
  hotelLng: number,
  hotelCity: string,
  mainRadiusKm: number = 10,
  extendedRadiusKm: number = 30
): VenueGeoDetail[] {
  return MUTUALIZED_VENUES_DATABASE.map((v) => {
    const distanceKm = calculateHaversineDistanceKm(hotelLat, hotelLng, v.lat, v.lng);
    const { driveTimeMins, transitTimeMins } = estimateTravelTimes(
      distanceKm,
      v.city.toLowerCase() === hotelCity.toLowerCase()
    );

    let zone: VenueGeoDetail['zone'] = 'out_of_radius';
    if (distanceKm <= mainRadiusKm) {
      zone = 'main_10km';
    } else if (distanceKm <= extendedRadiusKm) {
      zone = 'extended_30km';
    }

    return {
      ...v,
      distanceKm,
      driveTimeMins,
      transitTimeMins,
      zone,
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * ARCHITECTURE SUPABASE & SCHÉMA POSTGIS COMPLET (Section 7 du Cahier des Charges)
 */
export const SUPABASE_POSTGIS_SCHEMA_SQL = `-- =====================================================================
-- FLOWTYM EVENT INTELLIGENCE — ARCHITECTURE SUPABASE POSTGIS (V1.0)
-- Conforme aux spécifications du module géographique et moteur de découverte
-- =====================================================================

-- 1. EXTENSIONS REQUISES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- Pour géolocalisation et calculs spatiaux ST_Distance

-- 2. RÉFÉRENTIEL GÉOGRAPHIQUE MUTUALISÉ
CREATE TABLE IF NOT EXISTS public.countries (
    id VARCHAR(3) PRIMARY KEY, -- Code ISO-3 (ex: FRA, ESP, DEU)
    name VARCHAR(100) NOT NULL,
    default_distance_unit VARCHAR(10) DEFAULT 'km' CHECK (default_distance_unit IN ('km', 'miles')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_id VARCHAR(3) REFERENCES public.countries(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
    country_id VARCHAR(3) REFERENCES public.countries(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    commune VARCHAR(150),
    postal_code VARCHAR(20),
    location GEOGRAPHY(Point, 4326) NOT NULL, -- Coordonnées GPS PostGIS (lon, lat)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cities_location ON public.cities USING GIST(location);

CREATE TABLE IF NOT EXISTS public.geographic_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    polygon GEOGRAPHY(Polygon, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CATÉGORIES ÉVÉNEMENTIELLES OFFICIELLES (7 Catégories du PRD)
CREATE TABLE IF NOT EXISTS public.venue_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_number INTEGER NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    subcategories TEXT[] NOT NULL DEFAULT '{}',
    is_active_by_default BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. RÉFÉRENTIEL DES INFRASTRUCTURES ÉVÉNEMENTIELLES (Mutualisé)
CREATE TABLE IF NOT EXISTS public.venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    address TEXT NOT NULL,
    commune VARCHAR(150),
    city_id UUID REFERENCES public.cities(id) ON DELETE RESTRICT,
    location GEOGRAPHY(Point, 4326) NOT NULL, -- PostGIS Point (longitude, latitude)
    capacity INTEGER NOT NULL,
    venue_type VARCHAR(50) NOT NULL,
    is_verified BOOLEAN DEFAULT TRUE,
    discovered_via VARCHAR(100) DEFAULT 'system_seed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_venues_location ON public.venues USING GIST(location);

-- 5. RÉFÉRENTIEL DES SOURCES MUTUALISÉES
CREATE TABLE IF NOT EXISTS public.event_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- official_organizer, venue_calendar, ticketing, etc.
    country_id VARCHAR(3) REFERENCES public.countries(id),
    language VARCHAR(10) DEFAULT 'fr',
    collection_method VARCHAR(50) DEFAULT 'crawler',
    crawl_frequency VARCHAR(50) DEFAULT 'daily',
    reliability_level NUMERIC(4,2) DEFAULT 95.00,
    is_verified BOOLEAN DEFAULT TRUE,
    last_crawled_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'healthy',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.source_venues (
    source_id UUID REFERENCES public.event_sources(id) ON DELETE CASCADE,
    venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE,
    PRIMARY KEY (source_id, venue_id)
);

-- 6. CONFIGURATION GÉOGRAPHIQUE PAR ÉTABLISSEMENT
CREATE TABLE IF NOT EXISTS public.hotel_search_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL UNIQUE,
    organization_id UUID NOT NULL,
    main_radius_km NUMERIC(5,2) NOT NULL DEFAULT 10.00, -- Rayon principal : 10 km
    extended_radius_km NUMERIC(5,2) NOT NULL DEFAULT 30.00, -- Rayon étendu : 30 km
    distance_unit VARCHAR(10) NOT NULL DEFAULT 'km',
    auto_discover_venues BOOLEAN NOT NULL DEFAULT TRUE,
    auto_discover_sources BOOLEAN NOT NULL DEFAULT TRUE,
    auto_discover_events BOOLEAN NOT NULL DEFAULT TRUE,
    include_neighboring_cities BOOLEAN NOT NULL DEFAULT TRUE,
    multilingual_search BOOLEAN NOT NULL DEFAULT TRUE,
    mandatory_venue_geolocation BOOLEAN NOT NULL DEFAULT TRUE,
    auto_distance_calculation BOOLEAN NOT NULL DEFAULT TRUE,
    mutualize_data BOOLEAN NOT NULL DEFAULT TRUE,
    mandatory_hotel_impact_analysis BOOLEAN NOT NULL DEFAULT TRUE,
    enabled_categories TEXT[] NOT NULL DEFAULT ARRAY[
        'expositions_congres',
        'concerts_spectacles',
        'sport',
        'festivals_culture',
        'evenements_professionnels',
        'evenements_institutionnels',
        'evenements_touristiques'
    ],
    last_search_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_search_scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 day',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. DISTANCES CALCULÉES ET TEMPS DE ROUTAGE ENTRE HÔTELS ET INFRASTRUCTURES
CREATE TABLE IF NOT EXISTS public.hotel_venue_distances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL,
    venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE,
    distance_km NUMERIC(6,2) NOT NULL, -- Calculé via ST_Distance(h.location, v.location) / 1000
    drive_time_mins INTEGER, -- Routage routier
    transit_time_mins INTEGER, -- Métro / RER / Transports en commun
    zone VARCHAR(30) NOT NULL CHECK (zone IN ('main_10km', 'extended_30km', 'out_of_radius')),
    commune VARCHAR(150),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (hotel_id, venue_id)
);
CREATE INDEX IF NOT EXISTS idx_hotel_venue_dist_zone ON public.hotel_venue_distances(hotel_id, zone);

-- 8. GESTION DES RECHERCHES ASYNCHRONES (WORKERS)
CREATE TABLE IF NOT EXISTS public.search_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL,
    job_type VARCHAR(50) NOT NULL, -- 'initial_discovery', 'daily_events', 'venue_scan'
    status VARCHAR(50) DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    venues_discovered INTEGER DEFAULT 0,
    sources_discovered INTEGER DEFAULT 0,
    events_found INTEGER DEFAULT 0,
    logs JSONB DEFAULT '[]'::jsonb
);

-- 9. FONCTION SPATIALE POSTGIS : DÉCOUVERTE DANS LES 2 PÉRIMÈTRES (10 km & 30 km)
CREATE OR REPLACE FUNCTION get_venues_within_radii(
    p_hotel_lat NUMERIC,
    p_hotel_lon NUMERIC,
    p_main_radius_km NUMERIC DEFAULT 10.0,
    p_extended_radius_km NUMERIC DEFAULT 30.0
)
RETURNS TABLE (
    venue_id UUID,
    venue_name VARCHAR,
    venue_type VARCHAR,
    commune VARCHAR,
    distance_km NUMERIC,
    zone VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        v.name,
        v.venue_type,
        v.commune,
        ROUND((ST_Distance(v.location, ST_SetSRID(ST_MakePoint(p_hotel_lon, p_hotel_lat), 4326)::geography) / 1000.0)::numeric, 1) AS distance_km,
        CASE 
            WHEN ST_DWithin(v.location, ST_SetSRID(ST_MakePoint(p_hotel_lon, p_hotel_lat), 4326)::geography, p_main_radius_km * 1000) THEN 'main_10km'
            WHEN ST_DWithin(v.location, ST_SetSRID(ST_MakePoint(p_hotel_lon, p_hotel_lat), 4326)::geography, p_extended_radius_km * 1000) THEN 'extended_30km'
            ELSE 'out_of_radius'
        END AS zone
    FROM public.venues v
    WHERE ST_DWithin(v.location, ST_SetSRID(ST_MakePoint(p_hotel_lon, p_hotel_lat), 4326)::geography, p_extended_radius_km * 1000)
    ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;
`;
