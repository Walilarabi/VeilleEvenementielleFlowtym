export type EventCategory =
  | 'salons_foires'
  | 'congres_medical'
  | 'concerts_spectacles'
  | 'sport'
  | 'festivals'
  | 'mode_luxe'
  | 'corporate_sommet'
  | 'culturel';

export type RMImpactLevel = 'hyper' | 'critique' | 'modere' | 'faible';

export type ConfirmationStatus = 'confirmed' | 'estimated_recurrent' | 'announced_pending' | 'rumored';

export interface Venue {
  id: string;
  name: string;
  city: string;
  country: string;
  address: string;
  lat: number;
  lng: number;
  capacity: number;
  type: 'parc_expositions' | 'arena' | 'stade' | 'centre_congres' | 'theatre' | 'espace_public';
}

export interface Hotel {
  id: string;
  name: string;
  group: string;
  city: string;
  country: string;
  address: string;
  lat: number;
  lng: number;
  stars: number;
  roomCount: number;
  segment: 'Luxe' | 'Boutique' | 'Affaires' | 'Économique' | 'Resort';
  baseADR: number;
}

export interface EventEvidence {
  id: string;
  sourceName: string;
  sourceUrl: string;
  sourceType: 'official_organizer' | 'venue_calendar' | 'press' | 'ticketing' | 'city_agenda';
  verifiedAt: string;
  excerpt: string;
  trustScore: number; // 0-100
}

export interface EventHotelImpact {
  hotelId: string;
  distanceKm: number;
  distanceMins: number;
  directDemandShare: number; // % estimated demand
  compressionIndex: number; // 1-10
  recommendedAction: string;
  estimatedADRBoostPercent: number;
  minStayRecommended?: number;
  stopSellSuggested?: boolean;
}

export interface EventScoreBreakdown {
  attendanceScore: number; // e.g. 0-25
  internationalScore: number; // e.g. 0-20
  saturationScore: number; // e.g. 0-20
  proximityScore: number; // e.g. 0-20
  compressionScore: number; // e.g. 0-15
  finalRMScore: number; // 0-100
  confidenceScore: number; // 0-100
}

export interface EventItem {
  id: string;
  title: string;
  subtitle?: string;
  category: EventCategory;
  venueId: string;
  venueName: string;
  city: string;
  country: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  expectedAttendance: number;
  internationalRatioPercent: number;
  status: ConfirmationStatus;
  impactLevel: RMImpactLevel;
  scoreBreakdown: EventScoreBreakdown;
  sources: string[];
  evidences: EventEvidence[];
  hotelImpacts: Record<string, EventHotelImpact>;
  isRecurring: boolean;
  recurrenceFrequency?: 'annual' | 'biennial' | 'one_time';
  historicalGrowth?: string;
  isFavorite?: boolean;
  isWatchlist?: boolean; // À surveiller
  isYieldActive?: boolean; // Yield actif
  isAnomaly?: boolean;
  notes?: string;
  officialUrl?: string;
  createdAt: string;
  lastVerifiedAt: string;
}

export interface EventProposal {
  id: string;
  title: string;
  subtitle?: string;
  category: EventCategory;
  city: string;
  venueName: string;
  startDate: string;
  endDate: string;
  expectedAttendance: number;
  score: number; // 30-59
  status: 'pending' | 'accepted' | 'refused';
  detectedSource: string;
  impactLevel: RMImpactLevel;
}

export interface EventSuggestion {
  id: string;
  eventTitle: string;
  category: EventCategory;
  city: string;
  venueName: string;
  suggestedDates: { start: string; end: string };
  detectedVia: string;
  confidence: number;
  reason: string;
  impactPredicted: RMImpactLevel;
  status: 'pending' | 'approved' | 'dismissed';
}

export interface EventSource {
  id: string;
  name: string;
  url: string;
  category: string;
  city: string;
  reliabilityScore: number;
  lastCrawledAt: string;
  status: 'healthy' | 'warning' | 'error';
  detectedEventsCount: number;
  isOfficial: boolean;
}

export interface FilterState {
  search: string;
  periodTab: 'upcoming' | 'ongoing' | 'past' | 'all';
  impact: 'all' | RMImpactLevel;
  category: 'all' | EventCategory;
  city: string;
  status: 'all' | ConfirmationStatus;
  recurrenceOnly: boolean;
  rmsPrioritiesOnly: boolean; // Score >= 50
  anomaliesOnly: boolean;
  watchlistOnly: boolean; // À surveiller
  selectedHotelId: string;
  currentYear: number;
  currentMonth: number; // 0-11
}

// ==========================================
// MODULE GÉOGRAPHIQUE & CATÉGORIES OFFICIELLES
// ==========================================

export interface OfficialCategorySpec {
  id: string;
  code: string;
  number: number;
  name: string;
  description: string;
  subcategories: string[];
  enabled: boolean;
  color: string;
}

export interface GeographicTerritory {
  id: string;
  cityKey: string;
  territoryName: string;
  territoryType: 'region_administrative' | 'metropole_bassin' | 'greater_capital';
  description: string;
  keyCommunes: string[];
  bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
  };
  center: { lat: number; lng: number };
  defaultZoom: number;
  minZoom: number;
  maxZoom: number;
}

export interface HotelGeoSettings {
  hotelId: string;
  mainRadiusKm: number; // 10 km par défaut
  extendedRadiusKm: number; // 30 km par défaut
  distanceUnit: 'km' | 'miles'; // Kilomètres par défaut
  autoDiscoverVenues: boolean; // Activée
  autoDiscoverSources: boolean; // Activée
  autoDiscoverEvents: boolean; // Activée
  includeNeighboringCities: boolean; // Activée
  multilingualSearch: boolean; // Activée
  mandatoryVenueGeolocation: boolean; // Obligatoire lorsque possible
  autoDistanceCalculation: boolean; // Automatique
  mutualizeData: boolean; // Activée
  mandatoryHotelImpactAnalysis: boolean; // Obligatoire
  enabledCategoryCodes: string[];
  territoryScope: 'metropole_standard' | 'intra_muros_10km' | 'bassin_elargi_50km';
  territoryName: string;
  lastSearchAt: string;
  nextSearchScheduledAt: string;
  discoveredVenuesCount: number;
  activeSourcesCount: number;
}

export interface VenueGeoDetail extends Venue {
  commune: string;
  region: string;
  distanceKm: number; // Calcul vol d'oiseau (Haversine / PostGIS)
  driveTimeMins: number; // Temps de trajet voiture estimé
  transitTimeMins: number; // Temps transports en commun / RER / Métro
  zone: 'main_10km' | 'extended_30km' | 'out_of_radius';
  mutualizedHotelsCount: number; // Mutualisation multi-hôtels
  associatedSourcesCount: number;
  isVerified: boolean;
  discoveredVia: string;
}

export interface DiscoveryScanLog {
  timestamp: string;
  type: 'venue' | 'source' | 'event' | 'system';
  message: string;
  status: 'success' | 'info' | 'warning';
}

