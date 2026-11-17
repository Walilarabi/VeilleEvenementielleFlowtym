/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Types complets pour le Planning Tarifaire Connecté, le Centre de Configuration
 * et la Synchronisation Bidirectionnelle FLOWTYM REVENUE
 */

export type ConnectivityMode = 'pms' | 'channel_manager' | 'dual_coordinated';

export type ConflictPriorityStrategy =
  | 'manual'
  | 'priority_flowtym'
  | 'priority_pms'
  | 'priority_channel_manager';

export type RatePlanCode = string;

export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'CHF';

export type RatePlanNature =
  | 'reference'
  | 'derived'
  | 'independent'
  | 'promotional'
  | 'contractual';

export type RelationCalculationMode =
  | 'independent'
  | 'percent_minus'
  | 'percent_plus'
  | 'fixed_minus'
  | 'fixed_plus'
  | 'multiplier'
  | 'custom_formula';

export type BreakfastInclusionMode =
  | 'none'
  | 'included_1_guest'
  | 'included_2_guests'
  | 'included_per_occupancy'
  | 'supplement_optional';

export type CancellationPolicyType =
  | 'Flexible'
  | 'Semi-flexible'
  | 'Non-annulable'
  | 'Personnalisée';

export type PaymentPolicyType =
  | 'Paiement sur place'
  | 'Prépaiement total à la réservation'
  | 'Acompte 1ère nuit'
  | 'Garantie CB sans débit'
  | 'Facturation société (Corporate)';

export type RoundingRuleType = 'none' | 'nearest_euro' | 'nearest_5' | 'end_99';

export type RateModificationOrigin =
  | 'flowtym_auto'
  | 'flowtym_manual'
  | 'pms'
  | 'channel_manager';

export type RateSyncStatus =
  | 'saved_local'
  | 'queued'
  | 'pending'
  | 'sending'
  | 'synced'
  | 'failed'
  | 'rejected'
  | 'conflict';

export type DistributionChannelCode = 'DIRECT_WEB' | 'BOOKING' | 'EXPEDIA' | 'GDS';

export interface HotelConnectivityConfig {
  activeMode: ConnectivityMode;
  pmsProvider:
    | 'Opera PMS'
    | 'Mews PMS'
    | 'Protel PMS'
    | 'Medialog PMS'
    | 'Clock PMS'
    | 'Cloudbeds'
    | 'RoomRaccoon'
    | 'Apaleo'
    | string;
  channelManagerProvider:
    | 'D-EDGE CRS'
    | 'SiteMinder'
    | 'Availpro'
    | 'RateGain'
    | 'Cubilis'
    | 'Vertical Booking'
    | 'RoomCloud'
    | 'Channex'
    | string;
  rateShopperProvider?: 'Lighthouse' | 'OTA Insight' | 'API Custom' | string;
  sourceOfTruth: 'flowtym' | 'pms' | 'channel_manager';
  pmsResponsibilities: ('inventory' | 'restrictions' | 'rates')[];
  cmResponsibilities: ('ota_distribution' | 'rates' | 'restrictions')[];
  conflictPriorityStrategy: ConflictPriorityStrategy;
  antiLoopEnabled: boolean;
  webhookEnabled: boolean;
  webhookUrl: string;
  pollingIntervalMinutes: 5 | 15 | 30 | 60;
  dualModeConfirmed: boolean;
  lastPushAt: string | null;
  lastPullAt: string | null;
  connectionHealth: 'connected' | 'degraded' | 'offline';
  lastExternalLatencyMs?: number;
}

export interface RoomCategoryConfig {
  id: string;
  hotelId: string;
  code: string;
  name: string;
  description: string;
  physicalRooms: number;
  sellableRooms?: number;
  maxCapacity: number;
  maxAdults: number;
  maxChildren: number;
  standardOccupancy: number;
  maxOccupancy: number;
  surfaceSqm?: number;
  isActive: boolean;
  isArchived?: boolean;
  pmsRoomId: string;
  cmRoomId: string;
  externalMappings?: RoomTypeExternalMapping[];
  applicableRatePlanCodes: string[];
  extraAdultSupplementEur: number;
  extraChildSupplementEur: number;
  thirdAdultSupplementEur: number;
  singleOccupancySupplementEur: number;
  tripleOccupancySupplementEur: number;
  baseOffsetEur: number;
  weightPercent: number;
  provenance: 'local' | 'pms' | 'channel_manager' | 'excel';
}

export interface RoomTypeExternalMapping {
  id: string;
  hotelId: string;
  internalRoomCode: string;
  system: 'pms' | 'channel_manager';
  connectorId?: string;
  connectorName?: string;
  providerId?: string;
  externalCode: string;
  externalName: string;
  isPrimary?: boolean;
  lastVerifiedAt: string;
}

export interface RatePlanConfig {
  id: string;
  hotelId: string;
  code: string;
  name: string;
  description: string;
  planNature: RatePlanNature;
  referencePlanCode: string | null;
  calculationMode: RelationCalculationMode;
  variationValue: number; // ex: 10 pour -10%, 15 pour +15€, 1.15 pour ×1.15
  customFormula?: string; // ex: "REF * 0.90 + 5"
  relationActive: boolean;
  currency: CurrencyCode;
  cancellationPolicy: CancellationPolicyType;
  cancellationDetails: string;
  paymentPolicy: PaymentPolicyType;
  breakfastMode: BreakfastInclusionMode;
  includedGuests: number;
  minStayDefault: number;
  maxStayDefault: number | null;
  advanceBookingMinDays: number;
  advanceBookingMaxDays: number | null;
  roomCategoryCodes: string[];
  channels: DistributionChannelCode[];
  pmsExternalId: string;
  cmExternalId: string;
  externalMappings?: RatePlanExternalMapping[];
  roundingRule?: RoundingRuleType;
  rulePriority?: number;
  validFrom: string | null;
  validTo: string | null;
  floorEur?: number | null;
  ceilingEur?: number | null;
  status: 'active' | 'inactive' | 'archived';
  isFlexPlan?: boolean;
  isNrfPlan?: boolean;
  isSystemDefault?: boolean;
  isGroupInherited?: boolean;
  provenance: 'local' | 'pms' | 'channel_manager' | 'excel' | 'csv' | 'group_template';
  updatedAt: string;
}

export interface RatePlanExternalMapping {
  id: string;
  hotelId: string;
  internalPlanCode: string;
  system: 'pms' | 'channel_manager';
  connectorId?: string;
  connectorName?: string;
  providerId?: string;
  externalCode: string;
  externalName: string;
  isPrimary?: boolean;
  lastVerifiedAt: string;
}

export interface RateReferenceRule {
  id: string;
  hotelId: string;
  scope: 'all_categories' | 'per_category';
  roomCategoryCode: string; // 'ALL' ou code catégorie
  referencePlanCode: string;
  currency: CurrencyCode;
  validFrom: string | null;
  validTo: string | null;
  priority: number;
  isActive: boolean;
}

export interface FlexNrfCategoryOverride {
  roomCategoryCode: string;
  method: 'percent_discount' | 'fixed_discount' | 'independent' | 'custom_formula';
  value: number;
}

export interface FlexNrfPeriodRule {
  id: string;
  label: string;
  seasonType: 'basse' | 'moyenne' | 'haute' | 'evenement';
  startDate: string;
  endDate: string;
  discountPercent: number;
  isActive: boolean;
}

export interface FlexNrfDemandRule {
  id: string;
  label: string;
  minDemandScore: number;
  maxDemandScore: number;
  discountPercent: number;
}

export interface FlexNrfConfig {
  hotelId: string;
  flexPlanCode: string;
  nrfPlanCode: string;
  method: 'percent_discount' | 'fixed_discount' | 'independent' | 'custom_formula';
  defaultValue: number;
  customFormula?: string;
  categoryOverrides: FlexNrfCategoryOverride[];
  periodRules: FlexNrfPeriodRule[];
  demandRules: FlexNrfDemandRule[];
  nrfFloorEur: number;
  roundingRule: RoundingRuleType;
  autoActivate: boolean;
  autoDeactivate: boolean;
  validFrom: string | null;
  validTo: string | null;
  autoSyncFlexToNrf: boolean;
}

export interface MealPlanCategoryPrice {
  roomCategoryCode: string;
  adultPriceEur: number;
  childPriceEur: number;
}

export interface MealPlanPeriodPrice {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  adultPriceEur: number;
  childPriceEur: number;
}

export interface MealPlanConfig {
  hotelId: string;
  name: string;
  description: string;
  publicAdultPriceEur: number;
  internalAdultCostEur: number;
  childPriceEur: number;
  vatPercent: number;
  currency: CurrencyCode;
  pricingBasis: 'per_person' | 'per_room';
  beneficiaryCategory: 'adultes_et_enfants' | 'adultes_uniquement' | 'corporate';
  includedCountDefault: number;
  applicationConditions: string;
  categoryPrices: MealPlanCategoryPrice[];
  periodPrices: MealPlanPeriodPrice[];
  normalizeInRmEngine: boolean;
}

export interface SupplementAndPromoItem {
  id: string;
  hotelId: string;
  code: string;
  name: string;
  category:
    | 'petit_dejeuner'
    | 'parking'
    | 'lit_supplementaire'
    | 'late_checkout'
    | 'early_checkin'
    | 'package_romantique'
    | 'package_sejour'
    | 'reduction_long_sejour'
    | 'promo_anticipee'
    | 'promo_derniere_minute'
    | 'autre';
  itemType: 'supplement' | 'package' | 'discount';
  pricingType: 'fixed_eur' | 'percent';
  value: number;
  validFrom: string | null;
  validTo: string | null;
  roomCategoryCodes: string[];
  ratePlanCodes: string[];
  minNights?: number;
  advanceDaysRequired?: number;
  conditions: string;
  combinable: boolean;
  excludeFromReferenceCalc: boolean;
  isActive: boolean;
}

export interface RateRestrictionRule {
  id: string;
  hotelId: string;
  name: string;
  dateFrom: string;
  dateTo: string;
  roomCategoryCodes: string[];
  ratePlanCodes: string[];
  minStay: number | null;
  maxStay: number | null;
  cta: boolean;
  ctd: boolean;
  stopSell: boolean;
  advanceBookingMinDays: number | null;
  allowedArrivalDays: number[]; // 0..6 (0=Dimanche)
  allowedDepartureDays: number[];
  cancellationPolicyOverride?: CancellationPolicyType;
  paymentPolicyOverride?: PaymentPolicyType;
  isActive: boolean;
  createdAt: string;
}

export interface RateImportItem {
  id: string;
  externalCode: string;
  name: string;
  planNature: RatePlanNature;
  calculationMode: RelationCalculationMode;
  variationValue: number;
  roomCategories: string[];
  breakfastIncluded: boolean;
  cancellationPolicy: CancellationPolicyType;
  action: 'add' | 'update' | 'ignore' | 'duplicate_conflict';
  matchedInternalCode?: string;
}

export interface RateImportJob {
  id: string;
  hotelId: string;
  source: 'pms' | 'channel_manager' | 'excel' | 'csv';
  fileName?: string;
  mode: 'add_only' | 'update_existing' | 'ignore_existing';
  itemsCount: number;
  addedCount: number;
  updatedCount: number;
  ignoredCount: number;
  status: 'completed' | 'failed';
  actor: string;
  createdAt: string;
  summary: string;
}

export interface HotelTariffConfiguration {
  hotelId: string;
  currency: CurrencyCode;
  inheritanceMode: 'hotel_override' | 'inherit_group';
  overriddenSections: string[];
  referenceMode: 'single_global' | 'per_category';
  globalReferencePlanCode: string;
  referenceRules: RateReferenceRule[];
  roomCategories: RoomCategoryConfig[];
  roomMappings: RoomTypeExternalMapping[];
  ratePlans: RatePlanConfig[];
  ratePlanMappings: RatePlanExternalMapping[];
  flexNrf: FlexNrfConfig;
  mealPlan: MealPlanConfig;
  supplementsAndPromos: SupplementAndPromoItem[];
  restrictionRules: RateRestrictionRule[];
  importHistory: RateImportJob[];
  updatedAt: string;
}

export interface GroupTariffTemplate {
  organizationName: string;
  defaultCurrency: CurrencyCode;
  defaultReferencePlanCode: string;
  defaultFlexNrfMethod: FlexNrfConfig['method'];
  defaultFlexNrfValue: number;
  defaultBreakfastPriceEur: number;
  defaultVatPercent: number;
  sharedRatePlans: Pick<
    RatePlanConfig,
    'code' | 'name' | 'planNature' | 'referencePlanCode' | 'calculationMode' | 'variationValue' | 'breakfastMode' | 'cancellationPolicy' | 'paymentPolicy'
  >[];
  updatedAt: string;
}

export interface RateRecommendationMetadata {
  recommendationId: string;
  hotelId: string;
  stayDate: string;
  roomTypeCode: string;
  ratePlanCode: RatePlanCode;
  currentRateEur: number;
  recommendedRateEur: number;
  deltaEur: number;
  deltaPct: number;
  confidenceScore: number;
  justification: string;
  createdAt: string;
  algorithmVersion: string;
  suggestedMinStay: number;
  suggestedStopSell: boolean;
  targetRole?: 'reference' | 'derived' | 'independent';
  normalizedExclBreakfastEur?: number;
  status: 'pending' | 'accepted' | 'modified' | 'rejected' | 'expired';
  rejectionReason?: string;
}

export interface RateCalendarCell {
  cellKey: string; // `${hotelId}::${roomTypeCode}::${ratePlanCode}::${stayDate}`
  hotelId: string;
  roomTypeCode: string;
  roomTypeName: string;
  ratePlanCode: RatePlanCode;
  ratePlanName: string;
  stayDate: string; // YYYY-MM-DD

  // Valeurs tarifaires & restrictions
  currentRateEur: number;
  previousRateEur: number | null;
  inventoryAvailable: number;
  totalRoomsInCategory: number;
  minStay: number;
  maxStay: number | null;
  cta: boolean;
  ctd: boolean;
  isClosed: boolean;

  // Ventilation par canal de distribution (prix dérivés / surcharges canal & allocations)
  channelRates: Record<DistributionChannelCode, number>;
  channelAllocations?: Partial<Record<DistributionChannelCode, number>>;

  // Recommandation RM associée (le cas échéant)
  recommendation: RateRecommendationMetadata | null;

  // États explicites de vérité (Enregistré Flowtym vs Transmis vs Confirmé Externe PMS/CM)
  flowtymSavedRateEur: number;
  transmittedRateEur: number | null;
  confirmedExternalRateEur: number | null;
  pmsReturnedRateEur?: number | null;
  cmReturnedRateEur?: number | null;
  pmsUpdatedAt?: string | null;
  cmUpdatedAt?: string | null;
  inventoryLeftForSale?: number;
  lastSentAt?: string | null;

  // Synchronisation & anti-boucle
  syncStatus: RateSyncStatus;
  syncErrorMessage: string | null;
  lastSyncAt: string | null;
  lastSyncAckId: string | null;
  modificationOrigin: RateModificationOrigin;
  isManualOverride: boolean;

  // Versionnement optimiste & détection de conflits
  version: number;
  externalVersion: number;
  lastExternalRateEur: number | null;
  lastExternalUpdatedAt: string | null;
  lastExternalActor: string | null;
  updatedBy: string;
  updatedAt: string;
}

export interface RateSyncOperation {
  id: string;
  hotelId: string;
  cellKey: string;
  stayDate: string;
  roomTypeCode: string;
  ratePlanCode: RatePlanCode;
  direction: 'outbound_push' | 'inbound_pull' | 'webhook_inbound';
  targetSystem: 'pms' | 'channel_manager';
  origin: RateModificationOrigin;
  idempotencyKey: string;
  previousRateEur: number | null;
  newRateEur: number;
  status: RateSyncStatus;
  externalAckId: string | null;
  errorMessage: string | null;
  attempts: number;
  createdAt: string;
  confirmedAt: string | null;
}

export interface RateSyncConflict {
  id: string;
  hotelId: string;
  cellKey: string;
  stayDate: string;
  roomTypeCode: string;
  roomTypeName: string;
  ratePlanCode: RatePlanCode;
  flowtymRateEur: number;
  flowtymTimestamp: string;
  flowtymActor: string;
  externalRateEur: number;
  externalSource: 'pms' | 'channel_manager';
  externalTimestamp: string;
  externalActor: string;
  baseVersion: number;
  externalVersion: number;
  pendingRecommendationId?: string;
  status: 'open' | 'resolved';
  resolutionChoice?: 'keep_flowtym' | 'adopt_external' | 'priority_rule';
  resolvedRateEur?: number;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface RateAuditHistoryEntry {
  id: string;
  hotelId: string;
  cellKey: string;
  stayDate: string;
  roomTypeCode: string;
  ratePlanCode: RatePlanCode;
  actionType:
    | 'recommendation_accepted'
    | 'recommendation_rejected'
    | 'manual_edit'
    | 'bulk_edit'
    | 'inbound_external_sync'
    | 'conflict_resolved'
    | 'reverted'
    | 'sync_retry'
    | 'config_recalculation'
    | 'restriction_applied';
  previousRateEur: number | null;
  newRateEur: number;
  origin: RateModificationOrigin;
  syncStatus: RateSyncStatus;
  recommendationId?: string;
  syncOperationId?: string;
  revertedFromHistoryId?: string;
  actor: string;
  reason: string;
  createdAt: string;
}
