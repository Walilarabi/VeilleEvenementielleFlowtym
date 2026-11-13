/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM RMS — Service Centralisé de Paramétrage & Gouvernance Multi-Hôtels
 *
 * Centralise la configuration isolée par établissement (Multi-Tenant) et les paramètres globaux :
 *  A. Configuration de l'hôtel & typologies de chambres
 *  B. Revenue Management (objectifs CA, stratégie, plancher/plafond BAR, variations, restrictions)
 *  C. Concurrence & CompSet (jusqu'à 10 concurrents configurables par hôtel)
 *  D. Veille événementielle & filtrage géographique strict
 *  E. Intégrations & connecteurs (statut réel local vs API externe non configurée)
 *  F. Utilisateurs, rôles & permissions multi-hôtels
 *  G. Notifications & alertes RM
 *  H. Système, journal d'opérations & administration
 */

import { EventCategory, Hotel } from '../types';
import { DEFAULT_SUPABASE_URL, isSupabaseConfigured } from './supabaseClient';
import { syncHotelRMSConfigToSupabase } from './supabaseSyncService';

export type RMSPricingStrategy = 'equilibre' | 'volume' | 'marge' | 'agressif';
export type GeoCatchmentScope = 'intra_muros' | 'metropole' | 'bassin_elargi' | 'custom';

export interface HotelRoomTypology {
  id: string;
  code: 'classique' | 'superieure' | 'deluxe_famille' | 'suite';
  name: string;
  totalRooms: number;
  baseOffsetEur: number;
  weightPercent: number;
}

export interface CompetitorProfileConfig {
  id: string;
  name: string;
  stars: number;
  city: string;
  distanceKm: number;
  defaultRoomType: string;
  cancellationPolicy: 'Flexible' | 'Semi-flexible' | 'Non-annulable';
  breakfastIncluded: boolean;
  isFullyComparable: boolean;
  nonComparableReason?: string;
  baseRateEur: number;
  color: string;
  weight: number; // 0.5 to 1.5
  isActive: boolean;
}

export interface HotelRMRulesConfig {
  annualRevenueTargetEur: number;
  monthlyOccupancyTargetPct: number;
  targetAdrEur: number;
  pricingStrategy: RMSPricingStrategy;
  barFloorEur: number;
  barCeilingEur: number;
  maxSingleAdjustmentEur: number;
  maxSingleAdjustmentPct: number;
  priorityScoreThreshold: number;
  stopSellScoreThreshold: number;
  highDemandOccAlertPct: number;
  pickupSpikeThresholdRooms: number;
  defaultMinStay: number;
  weekendMinStay: number;
  autoStopSellPromosAtScore: number;
  requireHumanValidation: boolean;
}

export interface HotelEventWatchConfig {
  geoScope: GeoCatchmentScope;
  mainRadiusKm: number;
  extendedRadiusKm: number;
  strictTerritoryIsolation: boolean;
  allowJustifiedEconomicException: boolean;
  economicExceptionMinAttendance: number;
  enabledCategories: EventCategory[];
  minScoreThreshold: number;
  refreshFrequency: 'hourly' | 'daily_6am' | 'manual';
  activeSources: string[];
}

export interface HotelNotificationsConfig {
  alertHighDemandEnabled: boolean;
  highDemandOccThresholdPct: number;
  alertPricingOpportunityEnabled: boolean;
  pricingOpportunityMinGapEur: number;
  alertCompsetSoldOutEnabled: boolean;
  compsetSoldOutMinCount: number;
  alertSyncErrorsEnabled: boolean;
}

export interface HotelRMSConfig {
  hotelId: string;
  updatedAt: string;
  roomTypologies: HotelRoomTypology[];
  rmRules: HotelRMRulesConfig;
  compSet: CompetitorProfileConfig[];
  compSetSettings: {
    maxCompetitors: number;
    excludeSoldOutFromMedian: boolean;
    requireStrictComparability: boolean;
    rateParityToleranceEur: number;
  };
  eventWatch: HotelEventWatchConfig;
  notifications: HotelNotificationsConfig;
}

export interface IntegrationConnectorState {
  id: string;
  name: string;
  category: 'pms_crs' | 'rate_shopping' | 'database' | 'import_export';
  mode: 'local_file' | 'external_api';
  status: 'active_local' | 'configured' | 'unavailable_no_credentials' | 'error';
  description: string;
  lastSyncAt: string | null;
  lastError: string | null;
  endpointHint?: string;
}

export type SystemUserRole = 'admin' | 'revenue_manager' | 'general_manager' | 'analyst' | 'viewer';

export interface SystemUserAccount {
  id: string;
  name: string;
  email: string;
  role: SystemUserRole;
  allowedHotelIds: string[] | 'all';
  isActive: boolean;
  lastActiveAt: string;
  permissions: {
    canApproveRates: boolean;
    canEditCompset: boolean;
    canEditRMRules: boolean;
    canManageUsers: boolean;
    canExportData: boolean;
  };
}

export interface SystemOperationLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  hotelId: string;
  category: 'A_HOTEL' | 'B_RM' | 'C_COMPSET' | 'D_VEILLE' | 'E_INTEGRATIONS' | 'F_USERS' | 'G_ALERTS' | 'H_SYSTEM';
  action: string;
  details: string;
  status: 'success' | 'warning' | 'error';
}

export interface SystemAdminConfig {
  currency: 'EUR';
  timezone: 'Europe/Paris';
  referenceDateMode: 'fixed_demo_2026_11_12' | 'live_clock';
  enablePredictiveScenarios: boolean;
  enableSeasonalFestiveOverlay: boolean;
  enableSchoolHolidaysOverlay: boolean;
  enableBacktestingEngine: boolean;
  sessionTimeoutMinutes: number;
  enforceAuditTrail: boolean;
  integrations: IntegrationConnectorState[];
}

export const ALL_EVENT_CATEGORIES: EventCategory[] = [
  'salons_foires',
  'congres_medical',
  'concerts_spectacles',
  'sport',
  'festivals',
  'mode_luxe',
  'corporate_sommet',
  'culturel',
  'vacances_scolaires',
  'periodes_saisonnieres_fetes',
];

const COMPSET_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
  '#f97316',
  '#6366f1',
];

export const DEFAULT_COMPSET_BY_CITY: Record<string, Omit<CompetitorProfileConfig, 'id' | 'color' | 'weight' | 'isActive'>[]> = {
  paris_opera: [
    { name: 'Hôtel Saint-Pétersbourg Opéra & Spa', stars: 4, city: 'Paris', distanceKm: 0.3, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 305 },
    { name: 'Hôtel Charing Cross', stars: 4, city: 'Paris', distanceKm: 0.4, defaultRoomType: 'Supérieure', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 285 },
    { name: 'Hôtel Astra Opéra (Astotel)', stars: 4, city: 'Paris', distanceKm: 0.2, defaultRoomType: 'Standard', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 295 },
    { name: 'Hotel Indigo Paris-Opéra (IHG)', stars: 4, city: 'Paris', distanceKm: 0.5, defaultRoomType: 'Deluxe', cancellationPolicy: 'Non-annulable', breakfastIncluded: true, isFullyComparable: false, nonComparableReason: 'Chambre Deluxe + petit-déjeuner non-annulable', baseRateEur: 345 },
    { name: 'Hôtel Saint-Augustin Elysées', stars: 3, city: 'Paris', distanceKm: 0.6, defaultRoomType: 'Standard', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 255 },
    { name: 'Hôtel Pulitzer Paris', stars: 4, city: 'Paris', distanceKm: 0.8, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 280 },
    { name: 'Hôtel Bedford Opéra Madeleine', stars: 4, city: 'Paris', distanceKm: 0.4, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 290 },
    { name: 'Hôtel Le Marquis Faubourg Saint-Honoré', stars: 4, city: 'Paris', distanceKm: 0.7, defaultRoomType: 'Supérieure', cancellationPolicy: 'Semi-flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 325 },
    { name: 'Hôtel Caumartin Opéra Astotel', stars: 3, city: 'Paris', distanceKm: 0.3, defaultRoomType: 'Standard', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 265 },
    { name: 'Maison Albar Hotels Le Vendôme', stars: 5, city: 'Paris', distanceKm: 0.7, defaultRoomType: 'Exécutive', cancellationPolicy: 'Semi-flexible', breakfastIncluded: false, isFullyComparable: false, nonComparableReason: 'Positionnement 5★ supérieur', baseRateEur: 390 },
  ],
  paris_marais: [
    { name: 'Hôtel Bastille Boutet MGallery', stars: 5, city: 'Paris', distanceKm: 1.1, defaultRoomType: 'Supérieure', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 345 },
    { name: 'Cour des Vosges', stars: 5, city: 'Paris', distanceKm: 0.3, defaultRoomType: 'Deluxe', cancellationPolicy: 'Semi-flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 440 },
    { name: 'Hôtel Bourg Tibourg', stars: 4, city: 'Paris', distanceKm: 0.6, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 315 },
    { name: 'Hôtel Jules & Jim', stars: 4, city: 'Paris', distanceKm: 0.9, defaultRoomType: 'Standard', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 295 },
    { name: 'Hôtel du Petit Moulin', stars: 4, city: 'Paris', distanceKm: 0.5, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 325 },
    { name: 'Hôtel Georgette', stars: 4, city: 'Paris', distanceKm: 1.0, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 285 },
    { name: 'Le Pavillon de la Reine', stars: 5, city: 'Paris', distanceKm: 0.2, defaultRoomType: 'Deluxe', cancellationPolicy: 'Semi-flexible', breakfastIncluded: true, isFullyComparable: false, nonComparableReason: 'Palace Place des Vosges + PDJ', baseRateEur: 495 },
    { name: 'Hôtel Jacques de Molay', stars: 3, city: 'Paris', distanceKm: 0.8, defaultRoomType: 'Standard', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 245 },
    { name: 'Grand Hôtel Malher', stars: 3, city: 'Paris', distanceKm: 0.4, defaultRoomType: 'Standard', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 255 },
    { name: 'Hôtel National des Arts et Métiers', stars: 4, city: 'Paris', distanceKm: 1.3, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 335 },
  ],
  lyon: [
    { name: 'Boscolo Lyon Hotel & Spa', stars: 5, city: 'Lyon', distanceKm: 0.5, defaultRoomType: 'Supérieure', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: false, nonComparableReason: 'Positionnement 5★ Spa', baseRateEur: 265 },
    { name: 'Hôtel Carlton Lyon MGallery', stars: 4, city: 'Lyon', distanceKm: 0.3, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 225 },
    { name: 'Mercure Lyon Centre Beaux-Arts', stars: 4, city: 'Lyon', distanceKm: 0.4, defaultRoomType: 'Standard', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 205 },
    { name: 'OKKO Hotels Lyon Pont Lafayette', stars: 4, city: 'Lyon', distanceKm: 0.7, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: true, isFullyComparable: false, nonComparableReason: 'Inclut Club & petit-déjeuner', baseRateEur: 215 },
    { name: 'Grand Hôtel des Terreaux', stars: 4, city: 'Lyon', distanceKm: 0.9, defaultRoomType: 'Standard', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 195 },
    { name: 'Hôtel Le Royal Lyon MGallery', stars: 5, city: 'Lyon', distanceKm: 0.1, defaultRoomType: 'Classique', cancellationPolicy: 'Semi-flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 255 },
    { name: 'Globe et Cecil Hôtel', stars: 4, city: 'Lyon', distanceKm: 0.2, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 200 },
    { name: 'Hôtel Silky by HappyCulture', stars: 4, city: 'Lyon', distanceKm: 0.6, defaultRoomType: 'Standard', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 190 },
    { name: 'Radisson Blu Hotel Lyon', stars: 4, city: 'Lyon', distanceKm: 1.8, defaultRoomType: 'Supérieure', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 218 },
    { name: 'InterContinental Lyon - Hotel Dieu', stars: 5, city: 'Lyon', distanceKm: 0.4, defaultRoomType: 'Classique', cancellationPolicy: 'Semi-flexible', breakfastIncluded: false, isFullyComparable: false, nonComparableReason: 'Segment Palace / Luxe', baseRateEur: 310 },
  ],
  nice: [
    { name: 'Hôtel Le Negresco', stars: 5, city: 'Nice', distanceKm: 0.3, defaultRoomType: 'Classique', cancellationPolicy: 'Semi-flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 495 },
    { name: 'Hyatt Regency Nice Palais de la Méditerranée', stars: 5, city: 'Nice', distanceKm: 0.6, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 440 },
    { name: 'Anantara Plaza Nice Hotel', stars: 5, city: 'Nice', distanceKm: 1.1, defaultRoomType: 'Deluxe', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 430 },
    { name: 'Boscolo Nice Hôtel & Spa', stars: 5, city: 'Nice', distanceKm: 1.2, defaultRoomType: 'Supérieure', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 380 },
    { name: 'Le Méridien Nice', stars: 4, city: 'Nice', distanceKm: 0.8, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: false, nonComparableReason: 'Catégorie 4★ supérieure', baseRateEur: 340 },
    { name: 'Westminster Hotel & Spa Nice', stars: 4, city: 'Nice', distanceKm: 0.2, defaultRoomType: 'Vue Mer', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 335 },
    { name: 'Hôtel Suisse Nice', stars: 4, city: 'Nice', distanceKm: 1.7, defaultRoomType: 'Supérieure', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 320 },
    { name: 'Maison Albar Le Victoria', stars: 5, city: 'Nice', distanceKm: 1.3, defaultRoomType: 'Deluxe', cancellationPolicy: 'Semi-flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 455 },
    { name: 'Hotel Aston La Scala', stars: 4, city: 'Nice', distanceKm: 1.4, defaultRoomType: 'Supérieure', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 295 },
    { name: 'Radisson Blu Hotel Nice', stars: 4, city: 'Nice', distanceKm: 2.1, defaultRoomType: 'Standard', cancellationPolicy: 'Flexible', breakfastIncluded: true, isFullyComparable: false, nonComparableReason: 'Tarif incluant petit-déjeuner', baseRateEur: 310 },
  ],
  marseille: [
    { name: 'InterContinental Marseille - Hotel Dieu', stars: 5, city: 'Marseille', distanceKm: 0.6, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 290 },
    { name: 'Sofitel Marseille Vieux-Port', stars: 5, city: 'Marseille', distanceKm: 0.9, defaultRoomType: 'Supérieure', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 305 },
    { name: 'Radisson Blu Hotel Marseille Vieux Port', stars: 4, city: 'Marseille', distanceKm: 0.5, defaultRoomType: 'Standard', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 215 },
    { name: 'nhow Marseille', stars: 4, city: 'Marseille', distanceKm: 2.4, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 225 },
    { name: 'Hôtel C2 Marseille', stars: 5, city: 'Marseille', distanceKm: 0.8, defaultRoomType: 'Classique', cancellationPolicy: 'Semi-flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 270 },
    { name: 'Grand Hôtel Beauvau Marseille Vieux-Port', stars: 4, city: 'Marseille', distanceKm: 0.2, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 210 },
    { name: 'Maisons du Monde Hôtel & Suites Vieux Port', stars: 4, city: 'Marseille', distanceKm: 0.3, defaultRoomType: 'Standard', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 195 },
    { name: 'New Hotel of Marseille', stars: 4, city: 'Marseille', distanceKm: 1.0, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 185 },
    { name: 'AC Hotel by Marriott Marseille Prado Vélodrome', stars: 4, city: 'Marseille', distanceKm: 3.1, defaultRoomType: 'Standard', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 198 },
    { name: 'Les Bords de Mer', stars: 4, city: 'Marseille', distanceKm: 1.6, defaultRoomType: 'Vue Mer', cancellationPolicy: 'Non-annulable', breakfastIncluded: true, isFullyComparable: false, nonComparableReason: 'Forfait Vue Mer + PDJ', baseRateEur: 280 },
  ],
  lille: [
    { name: 'Clarance Hôtel Lille', stars: 5, city: 'Lille', distanceKm: 0.4, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: false, nonComparableReason: 'Relais & Châteaux 5★', baseRateEur: 285 },
    { name: 'L’Hermitage Gantois Autograph Collection', stars: 5, city: 'Lille', distanceKm: 0.7, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 255 },
    { name: 'Hôtel Barrière Lille', stars: 5, city: 'Lille', distanceKm: 1.0, defaultRoomType: 'Supérieure', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 245 },
    { name: 'Grand Hôtel Bellevue Grand Place', stars: 4, city: 'Lille', distanceKm: 0.2, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 195 },
    { name: 'Mercure Lille Centre Grand Place', stars: 4, city: 'Lille', distanceKm: 0.3, defaultRoomType: 'Standard', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 185 },
    { name: 'OKKO Hotels Lille Centre', stars: 4, city: 'Lille', distanceKm: 0.4, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: true, isFullyComparable: false, nonComparableReason: 'Inclut Club & petit-déjeuner', baseRateEur: 190 },
    { name: 'Novotel Lille Centre Gares', stars: 4, city: 'Lille', distanceKm: 0.6, defaultRoomType: 'Standard', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 175 },
    { name: 'Hôtel Carlton Lille', stars: 4, city: 'Lille', distanceKm: 0.2, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 205 },
    { name: 'Couvent des Minimes Alliance Lille', stars: 4, city: 'Lille', distanceKm: 0.8, defaultRoomType: 'Classique', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 180 },
    { name: 'Crowne Plaza Euralille', stars: 4, city: 'Lille', distanceKm: 0.9, defaultRoomType: 'Standard', cancellationPolicy: 'Flexible', breakfastIncluded: false, isFullyComparable: true, baseRateEur: 178 },
  ],
};

function getCompsetCatalogKey(hotel: Pick<Hotel, 'id' | 'city'>): string {
  if (hotel.id === 'hotel-marais') return 'paris_marais';
  const c = (hotel.city || '').toLowerCase();
  if (c.includes('lyon')) return 'lyon';
  if (c.includes('nice') || c.includes('cannes')) return 'nice';
  if (c.includes('marseille')) return 'marseille';
  if (c.includes('lille')) return 'lille';
  return 'paris_opera';
}

export function buildDefaultCompSetForHotel(hotel: Pick<Hotel, 'id' | 'city' | 'baseADR'>): CompetitorProfileConfig[] {
  const key = getCompsetCatalogKey(hotel);
  const template = DEFAULT_COMPSET_BY_CITY[key] || DEFAULT_COMPSET_BY_CITY.paris_opera;
  return template.map((item, idx) => ({
    ...item,
    id: `comp-${hotel.id}-${idx + 1}`,
    color: COMPSET_PALETTE[idx % COMPSET_PALETTE.length],
    weight: 1.0,
    isActive: true,
  }));
}

export function buildDefaultHotelRMSConfig(hotel: Hotel): HotelRMSConfig {
  const isNice = hotel.city.toLowerCase().includes('nice');
  const isParis = hotel.city.toLowerCase().includes('paris');
  const baseADR = hotel.baseADR || 240;
  const totalRooms = hotel.roomCount || 45;

  const classicCount = Math.round(totalRooms * 0.51);
  const supCount = Math.round(totalRooms * 0.18);
  const deluxeCount = Math.max(1, totalRooms - classicCount - supCount);

  return {
    hotelId: hotel.id,
    updatedAt: '2026-11-12T08:30:00Z',
    roomTypologies: [
      { id: `${hotel.id}-cat-1`, code: 'classique', name: 'Chambre Classique Double', totalRooms: classicCount, baseOffsetEur: 0, weightPercent: 51 },
      { id: `${hotel.id}-cat-2`, code: 'superieure', name: 'Chambre Supérieure', totalRooms: supCount, baseOffsetEur: 35, weightPercent: 18 },
      { id: `${hotel.id}-cat-3`, code: 'deluxe_famille', name: 'Chambre Deluxe / Familiale', totalRooms: deluxeCount, baseOffsetEur: 75, weightPercent: 31 },
    ],
    rmRules: {
      annualRevenueTargetEur: Math.round(totalRooms * 365 * 0.78 * baseADR),
      monthlyOccupancyTargetPct: isParis ? 82 : 76,
      targetAdrEur: Math.round(baseADR * 1.06),
      pricingStrategy: 'equilibre',
      barFloorEur: isNice ? 240 : isParis ? 180 : 130,
      barCeilingEur: isNice ? 950 : isParis ? 550 : 420,
      maxSingleAdjustmentEur: isNice ? 180 : 120,
      maxSingleAdjustmentPct: 38,
      priorityScoreThreshold: 50,
      stopSellScoreThreshold: 85,
      highDemandOccAlertPct: 80,
      pickupSpikeThresholdRooms: 4,
      defaultMinStay: 1,
      weekendMinStay: 2,
      autoStopSellPromosAtScore: 80,
      requireHumanValidation: true,
    },
    compSet: buildDefaultCompSetForHotel(hotel),
    compSetSettings: {
      maxCompetitors: 10,
      excludeSoldOutFromMedian: true,
      requireStrictComparability: true,
      rateParityToleranceEur: 15,
    },
    eventWatch: {
      geoScope: 'metropole',
      mainRadiusKm: isParis ? 15 : 12,
      extendedRadiusKm: isParis ? 45 : 35,
      strictTerritoryIsolation: true,
      allowJustifiedEconomicException: false,
      economicExceptionMinAttendance: 150000,
      enabledCategories: [...ALL_EVENT_CATEGORIES],
      minScoreThreshold: 0,
      refreshFrequency: 'daily_6am',
      activeSources: [
        'Viparis & Parcs des Expositions',
        'Open Data Municipal & Agendas Officiels',
        'Fédérations Sportives & Billetteries Arena',
        'Calendrier Officiel Vacances & Périodes Festives',
      ],
    },
    notifications: {
      alertHighDemandEnabled: true,
      highDemandOccThresholdPct: 82,
      alertPricingOpportunityEnabled: true,
      pricingOpportunityMinGapEur: 25,
      alertCompsetSoldOutEnabled: true,
      compsetSoldOutMinCount: 2,
      alertSyncErrorsEnabled: true,
    },
  };
}

const HOTEL_CONFIGS_KEY = 'flowtym_hotel_rms_configs_v2';
const SYSTEM_CONFIG_KEY = 'flowtym_system_admin_config_v2';
const USERS_KEY = 'flowtym_rbac_users_v2';
const OP_LOGS_KEY = 'flowtym_system_operation_logs_v2';

export function getDefaultIntegrations(): IntegrationConnectorState[] {
  return [
    {
      id: 'int-lighthouse-xlsx',
      name: 'Lighthouse Rate Insight (Import Excel .XLSX)',
      category: 'rate_shopping',
      mode: 'local_file',
      status: 'active_local',
      description: 'Import multi-onglets (Aperçu, Tarifs, vs Hier, vs 3j, vs 7j) jusqu’à 10 concurrents.',
      lastSyncAt: '2026-11-12 08:30',
      lastError: null,
    },
    {
      id: 'int-dedge-import',
      name: 'D-EDGE Planning & Réservations (Import CSV/XLSX)',
      category: 'pms_crs',
      mode: 'local_file',
      status: 'active_local',
      description: 'Exploitation des disponibilités, Pickup J-1/J-7 et chiffre d’affaires hébergement net.',
      lastSyncAt: '2026-11-12 08:30',
      lastError: null,
    },
    {
      id: 'int-supabase',
      name: 'Supabase PostgreSQL + PostGIS',
      category: 'database',
      mode: 'external_api',
      status: isSupabaseConfigured() ? 'configured' : 'unavailable_no_credentials',
      description: 'Base PostgreSQL distante pour persistance multi-postes et calculs spatiaux SQL.',
      lastSyncAt: isSupabaseConfigured() ? new Date().toISOString().replace('T', ' ').slice(0, 16) : null,
      lastError: isSupabaseConfigured()
        ? null
        : 'Clé Anon Key Supabase non renseignée — URL cible configurée (aliploqizujgovnlgjvg.supabase.co).',
      endpointHint: DEFAULT_SUPABASE_URL,
    },
    {
      id: 'int-dedge-api',
      name: 'D-EDGE CRS API Temps Réel (Push ARI)',
      category: 'pms_crs',
      mode: 'external_api',
      status: 'unavailable_no_credentials',
      description: 'Poussée automatique des tarifs BAR & restrictions MLOS vers le Channel Manager.',
      lastSyncAt: null,
      lastError: 'Connecteur API D-EDGE indisponible sans clé partenaire CRS.',
      endpointHint: 'https://api.d-edge.com/v2',
    },
    {
      id: 'int-lighthouse-api',
      name: 'Lighthouse Rate Insight API Live',
      category: 'rate_shopping',
      mode: 'external_api',
      status: 'unavailable_no_credentials',
      description: 'Récupération automatisée quotidienne du relevé concurrentiel 10 hôtels.',
      lastSyncAt: null,
      lastError: 'Flux API Lighthouse live non raccordé — utiliser l’import .XLSX officiel.',
    },
  ];
}

export function getDefaultSystemAdminConfig(): SystemAdminConfig {
  return {
    currency: 'EUR',
    timezone: 'Europe/Paris',
    referenceDateMode: 'fixed_demo_2026_11_12',
    enablePredictiveScenarios: true,
    enableSeasonalFestiveOverlay: true,
    enableSchoolHolidaysOverlay: true,
    enableBacktestingEngine: true,
    sessionTimeoutMinutes: 120,
    enforceAuditTrail: true,
    integrations: getDefaultIntegrations(),
  };
}

export function getDefaultUsers(): SystemUserAccount[] {
  return [
    {
      id: 'usr-1',
      name: 'Wali Larabi',
      email: 'wali.larabi@flowtym.com',
      role: 'admin',
      allowedHotelIds: 'all',
      isActive: true,
      lastActiveAt: '2026-11-12 09:14',
      permissions: {
        canApproveRates: true,
        canEditCompset: true,
        canEditRMRules: true,
        canManageUsers: true,
        canExportData: true,
      },
    },
    {
      id: 'usr-2',
      name: 'Nabil Amrani',
      email: 'revenue@flowtym.fr',
      role: 'revenue_manager',
      allowedHotelIds: ['hotel-opera', 'hotel-marais'],
      isActive: true,
      lastActiveAt: '2026-11-12 08:45',
      permissions: {
        canApproveRates: true,
        canEditCompset: true,
        canEditRMRules: true,
        canManageUsers: false,
        canExportData: true,
      },
    },
    {
      id: 'usr-3',
      name: 'Claire Moreau',
      email: 'direction.lyon@flowtym.fr',
      role: 'general_manager',
      allowedHotelIds: ['hotel-lyon'],
      isActive: true,
      lastActiveAt: '2026-11-11 17:30',
      permissions: {
        canApproveRates: true,
        canEditCompset: false,
        canEditRMRules: false,
        canManageUsers: false,
        canExportData: true,
      },
    },
    {
      id: 'usr-4',
      name: 'Lucas Bernard',
      email: 'analyst.azur@flowtym.fr',
      role: 'analyst',
      allowedHotelIds: ['hotel-nice'],
      isActive: true,
      lastActiveAt: '2026-11-10 15:10',
      permissions: {
        canApproveRates: false,
        canEditCompset: false,
        canEditRMRules: false,
        canManageUsers: false,
        canExportData: true,
      },
    },
  ];
}

export function getDefaultOperationLogs(): SystemOperationLogEntry[] {
  return [
    {
      id: 'op-1',
      timestamp: '2026-11-12 08:30:12',
      actor: 'Système Flowtym',
      hotelId: 'hotel-opera',
      category: 'D_VEILLE',
      action: 'Mise à jour périmètre géographique strict',
      details: 'Périmètre Île-de-France (15 km / 45 km) appliqué — événements hors bassin exclus.',
      status: 'success',
    },
    {
      id: 'op-2',
      timestamp: '2026-11-12 08:30:05',
      actor: 'Système Flowtym',
      hotelId: 'hotel-opera',
      category: 'C_COMPSET',
      action: 'Initialisation panel 10 concurrents',
      details: 'Panel étendu à 10 concurrents directs autour de Paris Opéra avec contrôle de comparabilité.',
      status: 'success',
    },
    {
      id: 'op-3',
      timestamp: '2026-11-12 08:29:40',
      actor: 'Système Flowtym',
      hotelId: 'all',
      category: 'E_INTEGRATIONS',
      action: 'Vérification connecteurs externes',
      details: 'D-EDGE CRS API & Lighthouse API non raccordés (clés absentes). Mode fichiers locaux opérationnel.',
      status: 'warning',
    },
  ];
}

function safeReadJSON<T>(key: string): T | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeWriteJSON(key: string, value: unknown): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota / non-browser envs
  }
}

export function getHotelRMSConfig(hotel: Hotel): HotelRMSConfig {
  const all = safeReadJSON<Record<string, HotelRMSConfig>>(HOTEL_CONFIGS_KEY) || {};
  const existing = all[hotel.id];
  if (existing && existing.compSet && existing.eventWatch && existing.rmRules) {
    // Ensure 'periodes_saisonnieres_fetes' is enabled if migrating older saved config
    const hasSeasonal = existing.eventWatch.enabledCategories.includes('periodes_saisonnieres_fetes');
    if (!hasSeasonal) {
      existing.eventWatch.enabledCategories = [...existing.eventWatch.enabledCategories, 'periodes_saisonnieres_fetes'];
    }
    return existing;
  }
  const fresh = buildDefaultHotelRMSConfig(hotel);
  all[hotel.id] = fresh;
  safeWriteJSON(HOTEL_CONFIGS_KEY, all);
  return fresh;
}

export function saveHotelRMSConfig(
  hotelId: string,
  config: HotelRMSConfig,
  actor: string = 'Wali Larabi',
  logCategory: SystemOperationLogEntry['category'] = 'H_SYSTEM',
  logAction?: string,
  logDetails?: string
): HotelRMSConfig {
  const all = safeReadJSON<Record<string, HotelRMSConfig>>(HOTEL_CONFIGS_KEY) || {};
  const updated: HotelRMSConfig = {
    ...config,
    hotelId,
    updatedAt: new Date().toISOString(),
  };
  all[hotelId] = updated;
  safeWriteJSON(HOTEL_CONFIGS_KEY, all);
  void syncHotelRMSConfigToSupabase(hotelId, updated);

  if (logAction) {
    appendSystemOperationLog({
      id: `op-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      actor,
      hotelId,
      category: logCategory,
      action: logAction,
      details: logDetails || 'Configuration sauvegardée.',
      status: 'success',
    });
  }

  return updated;
}

export function resetHotelRMSConfig(hotel: Hotel, actor: string = 'Wali Larabi'): HotelRMSConfig {
  const fresh = buildDefaultHotelRMSConfig(hotel);
  return saveHotelRMSConfig(
    hotel.id,
    fresh,
    actor,
    'H_SYSTEM',
    'Réinitialisation configuration hôtel',
    `Paramètres RM, CompSet 10 concurrents et Veille géo réinitialisés pour ${hotel.name}.`
  );
}

export function getSystemAdminConfig(): SystemAdminConfig {
  return safeReadJSON<SystemAdminConfig>(SYSTEM_CONFIG_KEY) || getDefaultSystemAdminConfig();
}

export function saveSystemAdminConfig(config: SystemAdminConfig, actor: string = 'Wali Larabi'): SystemAdminConfig {
  safeWriteJSON(SYSTEM_CONFIG_KEY, config);
  appendSystemOperationLog({
    id: `op-${Date.now()}`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    actor,
    hotelId: 'all',
    category: 'H_SYSTEM',
    action: 'Mise à jour configuration système globale',
    details: 'Options applicatives et paramètres système enregistrés.',
    status: 'success',
  });
  return config;
}

export function getSystemUsers(): SystemUserAccount[] {
  return safeReadJSON<SystemUserAccount[]>(USERS_KEY) || getDefaultUsers();
}

export function saveSystemUsers(users: SystemUserAccount[], actor: string = 'Wali Larabi', detail?: string): SystemUserAccount[] {
  safeWriteJSON(USERS_KEY, users);
  appendSystemOperationLog({
    id: `op-${Date.now()}`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    actor,
    hotelId: 'all',
    category: 'F_USERS',
    action: 'Mise à jour utilisateurs & permissions RBAC',
    details: detail || `${users.length} comptes utilisateurs enregistrés.`,
    status: 'success',
  });
  return users;
}

export function getSystemOperationLogs(): SystemOperationLogEntry[] {
  return safeReadJSON<SystemOperationLogEntry[]>(OP_LOGS_KEY) || getDefaultOperationLogs();
}

export function appendSystemOperationLog(entry: SystemOperationLogEntry): SystemOperationLogEntry[] {
  const current = getSystemOperationLogs();
  const next = [entry, ...current].slice(0, 100);
  safeWriteJSON(OP_LOGS_KEY, next);
  return next;
}

export function clearSystemOperationLogs(): SystemOperationLogEntry[] {
  safeWriteJSON(OP_LOGS_KEY, []);
  return [];
}
