export type EventCategory =
  | 'salons_foires'
  | 'congres_medical'
  | 'concerts_spectacles'
  | 'sport'
  | 'festivals'
  | 'mode_luxe'
  | 'corporate_sommet'
  | 'culturel'
  | 'vacances_scolaires';

export type RMImpactLevel = 'hyper' | 'critique' | 'modere' | 'faible';

export type ConfirmationStatus =
  | 'confirmed'
  | 'probable'
  | 'estime'
  | 'a_verifier'
  | 'estimated_recurrent'
  | 'announced_pending'
  | 'rumored';

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
  group: string | null;
  city: string;
  country: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  stars: number | null;
  roomCount: number | null;
  segment: 'Luxe' | 'Boutique' | 'Affaires' | 'Économique' | 'Resort' | null;
  baseADR: number | null;
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
  distanceMins?: number;
  directDemandShare?: number; // % estimated demand; nullable until supported by evidence
  directImpact?: boolean; // legacy fixture flag, never treated as a verified metric
  recommendedStrategy?: string; // legacy fixture text, not a verified action
  compressionIndex?: number; // 1-10; optional until calibrated
  recommendedAction?: string;
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
  durationScore?: number;
  recurrenceScore?: number;
  capacityScore?: number;
  notorietyScore?: number;
  extraNightsScore?: number;
  segmentFitScore?: number;
  sourceConfidenceScore?: number;
  historicalDemandScore?: number;
  historicalDemandSampleCount?: number;
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
  showSchoolHolidays?: boolean;
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

// ==========================================
// REVENUE MANAGEMENT & AIDE À LA DÉCISION
// ==========================================

export type StandardDemandLevel = 'faible' | 'normal' | 'eleve' | 'exceptionnel';

export interface CompetitorHotel {
  id: string;
  name: string;
  stars: number;
  roomCount: number;
  distanceMeters: number;
  address: string;
  currentRate: number; // e.g. 310€
  baselineRate: number; // e.g. 250€
  isSoldOut: boolean;
  rateTrend: 'up' | 'stable' | 'down';
  deltaPercent: number; // vs baseline
  roomType: string;
  scrapedSource: string;
  lastObservedAt: string;
}

export interface MarketCompressionAlert {
  id: string;
  dateStr: string;
  compressionIndex: number; // 1 to 10
  demandLevel: StandardDemandLevel;
  primaryDrivers: string[];
  totalEstimatedPax: number;
  soldOutRatioPercent: number; // e.g. 40% of compset sold out
  compsetAverageRate: number;
  rateSpreadVsBaselinePercent: number;
  isMultiEventOverlap: boolean;
  recommendedAction: string;
  suggestedMinStay: number;
  ctaRecommended: boolean;
}

export type RMDecisionAction = 'accepted' | 'modified' | 'rejected' | 'postponed';

export interface RMDecisionRecord {
  id: string;
  alertId: string;
  eventId?: string;
  eventTitle: string;
  dateStr: string;
  hotelId: string;
  action: RMDecisionAction;
  originalCurrentRate: number;
  recommendedRate: number;
  appliedRate: number;
  comment?: string;
  decidedAt: string;
  decidedBy: string;
}

export interface RMAlertItem {
  id: string;
  hotelId: string;
  eventId: string;
  eventTitle: string;
  venueName: string;
  category: EventCategory;
  dateStr: string;
  demandLevel: StandardDemandLevel;
  currentRate: number;
  recommendedRate: number;
  gapEur: number;
  gapPercent: number;
  confidenceScore: number; // 0-100%
  sources: string[];
  urgency: 'critique' | 'haute' | 'moyenne';
  status: 'active' | 'accepted' | 'modified' | 'rejected' | 'postponed';
  reason: string;
  compressionFactor: string;
  compsetAverageRate: number;
  soldOutCompetitorsCount: number;
  minStayRecommended?: number;
  ctaRecommended?: boolean;
}

export interface ForecastDriver {
  name: string;
  category: EventCategory;
  expectedAttendance: number;
  impactScore: number;
  distanceKm: number;
  venueName: string;
  status: ConfirmationStatus;
}

export interface DemandForecastItem {
  dateStr: string;
  dayOfWeekFr: string;
  demandLevel: StandardDemandLevel;
  confidenceScore: number; // 0-100%
  expectedOccupancyRange: [number, number]; // [min, max] %
  projectedRevPAR: number;
  baseADR: number;
  recommendedADR: number;
  revenueOpportunityEur: number; // Delta RevPAR * roomCount
  marketPressureScore: number; // 0-100
  drivers: ForecastDriver[];
  isPmsIntegrated: boolean; // false = Event-driven & compset forecast, ready for PMS
  pmsPickupStatus: 'not_connected' | 'connected_live';
  pmsStatusNote: string;
}

// ==========================================
// CONNECTIVITÉ LIGHTHOUSE (RATE SHOPPING API)
// ==========================================
export interface LighthouseRateConfig {
  apiKey: string; // Header X-Oi-Authorization
  accountEmail: string;
  baseUrl: string; // https://api.mylighthouse.com/v3
  authType: 'api_token' | 'oauth';
  isConnected: boolean;
  status: 'connected' | 'configured_ready' | 'invalid_token' | 'disconnected';
  lastSyncAt?: string;
  rateLimitRemaining?: number;
  rateLimitReset?: string;
  compsetIds: string[];
}

export interface LighthouseRateItem {
  hotelId: string;
  hotelName: string;
  dateStr: string;
  roomType: string;
  ratePlan: string; // BAR, Non-Refundable, Breakfast Included
  rateEur: number;
  currency: string;
  isSoldOut: boolean;
  pos: string; // Direct Web, Booking.com, Expedia
  observedAt: string;
  deltaPercentVsPriorScrape: number;
  sourceStatus?: 'live' | 'imported' | 'fixture' | 'simulation';
}

// ==========================================
// CONNECTIVITÉ D-EDGE (CRS & CHANNEL MANAGER)
// ==========================================
export interface DEdgeConfig {
  hotelCode: string;
  engineId: string;
  apiToken: string;
  webhookUrl: string;
  authType: 'bearer_token' | 'oauth_client';
  status: 'connected' | 'configured_ready' | 'pending_certification' | 'disconnected';
  syncMode: 'direct_api' | 'partner_connector' | 'night_audit_export';
  lastSyncAt?: string;
  lastHeartbeatStatus: 'ok' | 'degraded' | 'error';
}

export interface DEdgeInventoryDay {
  dateStr: string;
  hotelId: string;
  totalRooms: number;
  roomsSold: number; // OTB (On The Books)
  roomsAvailable: number; // Stock restant
  occupancyPercent: number; // OTB Occ %
  currentBAR: number;
  pickup24h: number; // Nuitées enregistrées dans les dernières 24h
  pickup72h: number;
  pickup7d: number;
  cancellations24h: number;
  bookingVelocity: 'tres_rapide' | 'rapide' | 'normale' | 'faible' | 'stagnante';
  minStayRestriction: number;
  stopSellActive: boolean;
  averageLeadTimeDays: number;
  lastUpdated: string;
  sourceStatus?: 'live' | 'imported' | 'fixture' | 'simulation';
}

// ==========================================
// JUSTIFICATION ÉPISTÉMOLOGIQUE RM (5 NIVEAUX)
// ==========================================
export interface RMEpistemologicalBreakdown {
  faitObserve: string[]; // Fait observé et vérifié (donnée brute)
  analyse: string[]; // Analyse & interprétation du marché
  prevision: string[]; // Prévision chiffrée
  recommandation: string; // Recommandation d'action RM
  hypothese: string[]; // Hypothèse et limites
  confidenceScore: number; // 0-100%
  primaryDrivers: string[];
}

export * from './schoolHolidays';
