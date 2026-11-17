/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM REVENUE — SERVICE CENTRAL DE CONFIGURATION TARIFAIRE,
 * RELATIONS ENTRE PLANS, FLEX/NRF, PETIT-DÉJEUNER, CHAMBRES & IMPORTATIONS
 */

import * as XLSX from 'xlsx';
import {
  CurrencyCode,
  FlexNrfConfig,
  GroupTariffTemplate,
  Hotel,
  HotelTariffConfiguration,
  MealPlanConfig,
  RateImportItem,
  RateImportJob,
  RatePlanConfig,
  RateReferenceRule,
  RateRestrictionRule,
  RoomCategoryConfig,
  RoomTypeExternalMapping,
  RoundingRuleType,
  SupplementAndPromoItem,
} from '../types';
import { getHotelRMSConfig, saveHotelRMSConfig } from './rmsSettingsService';
import { syncRateImportJobToSupabase, syncTariffConfigToSupabase } from './supabaseSyncService';

const TARIFF_CFG_KEY_PREFIX = 'flowtym_tariff_config_v1_';
const GROUP_TEMPLATE_KEY = 'flowtym_group_tariff_template_v1';
const CONFIG_AUDIT_KEY_PREFIX = 'flowtym_tariff_cfg_audit_v1_';

export const TARIFF_CONFIG_EVENT = 'flowtym:tariff-config-updated';

// Fallback mémoire pour exécution Node/CLI (tests automatisés sans browser localStorage)
const memoryStore = new Map<string, string>();

function storageGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return memoryStore.get(key) ?? null;
}

function storageSet(key: string, val: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, val);
    }
  } catch {
    // ignore
  }
  memoryStore.set(key, val);
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = storageGet(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    storageSet(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export interface TariffConfigAuditEntry {
  id: string;
  hotelId: string;
  actor: string;
  section: string;
  action: string;
  details: string;
  createdAt: string;
}

export function getTariffConfigAuditLog(hotelId: string): TariffConfigAuditEntry[] {
  return readJSON<TariffConfigAuditEntry[]>(`${CONFIG_AUDIT_KEY_PREFIX}${hotelId}`, []);
}

export function appendTariffConfigAudit(entry: TariffConfigAuditEntry): TariffConfigAuditEntry[] {
  const existing = getTariffConfigAuditLog(entry.hotelId);
  const next = [entry, ...existing].slice(0, 200);
  writeJSON(`${CONFIG_AUDIT_KEY_PREFIX}${entry.hotelId}`, next);
  return next;
}

function emitTariffConfigUpdated(hotelId: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TARIFF_CONFIG_EVENT, { detail: { hotelId } }));
  }
}

// -----------------------------------------------------------------------------
// 1. MULTI-HÔTELS : MODÈLE GROUPE & HÉRITAGE
// -----------------------------------------------------------------------------

export function getGroupTariffTemplate(): GroupTariffTemplate {
  const stored = readJSON<GroupTariffTemplate | null>(GROUP_TEMPLATE_KEY, null);
  if (stored) return stored;
  const fresh: GroupTariffTemplate = {
    organizationName: 'Flowtym Hospitality Group',
    defaultCurrency: 'EUR',
    defaultReferencePlanCode: 'BAR',
    defaultFlexNrfMethod: 'percent_discount',
    defaultFlexNrfValue: 12,
    defaultBreakfastPriceEur: 24,
    defaultVatPercent: 10,
    sharedRatePlans: [
      {
        code: 'BAR',
        name: 'Best Available Rate (FLEX)',
        planNature: 'reference',
        referencePlanCode: null,
        calculationMode: 'independent',
        variationValue: 0,
        breakfastMode: 'none',
        cancellationPolicy: 'Flexible',
        paymentPolicy: 'Paiement sur place',
      },
      {
        code: 'NRF',
        name: 'BAR Non-Remboursable',
        planNature: 'derived',
        referencePlanCode: 'BAR',
        calculationMode: 'percent_minus',
        variationValue: 12,
        breakfastMode: 'none',
        cancellationPolicy: 'Non-annulable',
        paymentPolicy: 'Prépaiement total à la réservation',
      },
      {
        code: 'BB',
        name: 'BAR avec Petit-Déjeuner',
        planNature: 'derived',
        referencePlanCode: 'BAR',
        calculationMode: 'fixed_plus',
        variationValue: 24,
        breakfastMode: 'included_2_guests',
        cancellationPolicy: 'Flexible',
        paymentPolicy: 'Paiement sur place',
      },
      {
        code: 'CORP',
        name: 'Tarif Corporate Négocié',
        planNature: 'contractual',
        referencePlanCode: 'BAR',
        calculationMode: 'percent_minus',
        variationValue: 12,
        breakfastMode: 'included_1_guest',
        cancellationPolicy: 'Flexible',
        paymentPolicy: 'Facturation société (Corporate)',
      },
    ],
    updatedAt: new Date().toISOString(),
  };
  writeJSON(GROUP_TEMPLATE_KEY, fresh);
  return fresh;
}

export function saveGroupTariffTemplate(template: GroupTariffTemplate): GroupTariffTemplate {
  const next = { ...template, updatedAt: new Date().toISOString() };
  writeJSON(GROUP_TEMPLATE_KEY, next);
  return next;
}

// -----------------------------------------------------------------------------
// 2. CONFIGURATION PAR DÉFAUT PAR ÉTABLISSEMENT
// -----------------------------------------------------------------------------

export function buildDefaultHotelTariffConfig(hotel: Hotel): HotelTariffConfiguration {
  const rms = getHotelRMSConfig(hotel);
  const now = new Date().toISOString();
  const shortHotelPrefix = hotel.id.replace('hotel-', '').toUpperCase().slice(0, 4);

  const roomCategories: RoomCategoryConfig[] = rms.roomTypologies.map((typ, idx) => ({
    id: `rc-${hotel.id}-${typ.code}`,
    hotelId: hotel.id,
    code: typ.code,
    name: typ.name,
    description:
      idx === 0
        ? 'Chambre standard optimisée pour clientèle individuelle et affaires.'
        : idx === 1
        ? 'Chambre spacieuse avec vue dégagée et équipements premium.'
        : 'Suite / Famille grand confort haute contribution.',
    physicalRooms: typ.totalRooms,
    maxCapacity: idx >= 2 ? 4 : 2,
    maxAdults: idx >= 2 ? 3 : 2,
    maxChildren: idx >= 2 ? 2 : 1,
    standardOccupancy: 2,
    maxOccupancy: idx >= 2 ? 4 : 2,
    surfaceSqm: idx === 0 ? 18 : idx === 1 ? 24 : 34,
    isActive: true,
    isArchived: false,
    pmsRoomId: `PMS-${shortHotelPrefix}-${typ.code.slice(0, 4).toUpperCase()}`,
    cmRoomId: `DE-${shortHotelPrefix}-${typ.code.slice(0, 4).toUpperCase()}`,
    applicableRatePlanCodes: ['BAR', 'NRF', 'BB', 'CORP', 'LONG_STAY', 'GROUP'],
    extraAdultSupplementEur: 40,
    extraChildSupplementEur: 20,
    thirdAdultSupplementEur: 45,
    singleOccupancySupplementEur: -15,
    tripleOccupancySupplementEur: 45,
    baseOffsetEur: typ.baseOffsetEur,
    weightPercent: typ.weightPercent,
    provenance: 'local',
  }));

  const roomMappings: RoomTypeExternalMapping[] = [];
  roomCategories.forEach((rc) => {
    roomMappings.push({
      id: `rmap-pms-${rc.code}`,
      hotelId: hotel.id,
      internalRoomCode: rc.code,
      system: 'pms',
      externalCode: rc.pmsRoomId,
      externalName: rc.name,
      lastVerifiedAt: now,
    });
    roomMappings.push({
      id: `rmap-cm-${rc.code}`,
      hotelId: hotel.id,
      internalRoomCode: rc.code,
      system: 'channel_manager',
      externalCode: rc.cmRoomId,
      externalName: rc.name,
      lastVerifiedAt: now,
    });
  });

  const catCodes = roomCategories.map((c) => c.code);

  const ratePlans: RatePlanConfig[] = [
    {
      id: `rp-${hotel.id}-BAR`,
      hotelId: hotel.id,
      code: 'BAR',
      name: 'BAR Flexible (Meilleur Tarif Flexible)',
      description: 'Tarif public flexible sans petit-déjeuner, annulation sans frais jusqu’à J-1.',
      planNature: 'reference',
      referencePlanCode: null,
      calculationMode: 'independent',
      variationValue: 0,
      relationActive: true,
      currency: 'EUR',
      cancellationPolicy: 'Flexible',
      cancellationDetails: 'Annulation gratuite jusqu’à 24h avant l’arrivée (18h00).',
      paymentPolicy: 'Paiement sur place',
      breakfastMode: 'none',
      includedGuests: 2,
      minStayDefault: 1,
      maxStayDefault: 30,
      advanceBookingMinDays: 0,
      advanceBookingMaxDays: 365,
      roomCategoryCodes: catCodes,
      channels: ['DIRECT_WEB', 'BOOKING', 'EXPEDIA', 'GDS'],
      pmsExternalId: `PMS-${shortHotelPrefix}-BAR`,
      cmExternalId: `DE-${shortHotelPrefix}-BAR`,
      validFrom: null,
      validTo: null,
      floorEur: rms.rmRules.barFloorEur,
      ceilingEur: rms.rmRules.barCeilingEur,
      status: 'active',
      isFlexPlan: true,
      isSystemDefault: true,
      provenance: 'local',
      updatedAt: now,
    },
    {
      id: `rp-${hotel.id}-NRF`,
      hotelId: hotel.id,
      code: 'NRF',
      name: 'BAR Non-Remboursable (-12%)',
      description: 'Tarif prépayé non annulable et non modifiable, indexé automatiquement sur BAR Flexible.',
      planNature: 'derived',
      referencePlanCode: 'BAR',
      calculationMode: 'percent_minus',
      variationValue: 12,
      relationActive: true,
      currency: 'EUR',
      cancellationPolicy: 'Non-annulable',
      cancellationDetails: '100% du séjour facturé à la réservation, non remboursable.',
      paymentPolicy: 'Prépaiement total à la réservation',
      breakfastMode: 'none',
      includedGuests: 2,
      minStayDefault: 1,
      maxStayDefault: 30,
      advanceBookingMinDays: 0,
      advanceBookingMaxDays: 365,
      roomCategoryCodes: catCodes,
      channels: ['DIRECT_WEB', 'BOOKING', 'EXPEDIA'],
      pmsExternalId: `PMS-${shortHotelPrefix}-NRF`,
      cmExternalId: `DE-${shortHotelPrefix}-NRF`,
      validFrom: null,
      validTo: null,
      floorEur: Math.max(90, rms.rmRules.barFloorEur - 25),
      ceilingEur: rms.rmRules.barCeilingEur,
      status: 'active',
      isNrfPlan: true,
      isSystemDefault: true,
      provenance: 'local',
      updatedAt: now,
    },
    {
      id: `rp-${hotel.id}-BB`,
      hotelId: hotel.id,
      code: 'BB',
      name: 'BAR avec Petit-Déjeuner (+24€)',
      description: 'Meilleur tarif flexible incluant le petit-déjeuner buffet pour 2 personnes.',
      planNature: 'derived',
      referencePlanCode: 'BAR',
      calculationMode: 'fixed_plus',
      variationValue: 24,
      relationActive: true,
      currency: 'EUR',
      cancellationPolicy: 'Flexible',
      cancellationDetails: 'Annulation gratuite jusqu’à J-1, petit-déjeuner inclus.',
      paymentPolicy: 'Paiement sur place',
      breakfastMode: 'included_2_guests',
      includedGuests: 2,
      minStayDefault: 1,
      maxStayDefault: 30,
      advanceBookingMinDays: 0,
      advanceBookingMaxDays: 365,
      roomCategoryCodes: catCodes,
      channels: ['DIRECT_WEB', 'BOOKING', 'EXPEDIA'],
      pmsExternalId: `PMS-${shortHotelPrefix}-BB`,
      cmExternalId: `DE-${shortHotelPrefix}-BB`,
      validFrom: null,
      validTo: null,
      floorEur: rms.rmRules.barFloorEur + 20,
      ceilingEur: rms.rmRules.barCeilingEur + 48,
      status: 'active',
      isSystemDefault: true,
      provenance: 'local',
      updatedAt: now,
    },
    {
      id: `rp-${hotel.id}-CORP`,
      hotelId: hotel.id,
      code: 'CORP',
      name: 'Tarif Corporate Négocié (-12%)',
      description: 'Accord entreprise sur BAR Flexible avec petit-déjeuner 1 personne inclus.',
      planNature: 'contractual',
      referencePlanCode: 'BAR',
      calculationMode: 'percent_minus',
      variationValue: 12,
      relationActive: true,
      currency: 'EUR',
      cancellationPolicy: 'Flexible',
      cancellationDetails: 'Annulation gratuite le jour même jusqu’à 16h00.',
      paymentPolicy: 'Facturation société (Corporate)',
      breakfastMode: 'included_1_guest',
      includedGuests: 1,
      minStayDefault: 1,
      maxStayDefault: 14,
      advanceBookingMinDays: 0,
      advanceBookingMaxDays: 365,
      roomCategoryCodes: catCodes.slice(0, 2),
      channels: ['DIRECT_WEB', 'GDS'],
      pmsExternalId: `PMS-${shortHotelPrefix}-CORP`,
      cmExternalId: `DE-${shortHotelPrefix}-CORP`,
      validFrom: '2026-01-01',
      validTo: '2027-12-31',
      floorEur: Math.max(120, rms.rmRules.barFloorEur - 20),
      ceilingEur: rms.rmRules.barCeilingEur,
      status: 'active',
      provenance: 'local',
      updatedAt: now,
    },
    {
      id: `rp-${hotel.id}-LONG_STAY`,
      hotelId: hotel.id,
      code: 'LONG_STAY',
      name: 'Tarif Long Séjour 4+ Nuits (-15%)',
      description: 'Remise automatique dès 4 nuits consécutives sur base BAR Flexible.',
      planNature: 'promotional',
      referencePlanCode: 'BAR',
      calculationMode: 'percent_minus',
      variationValue: 15,
      relationActive: true,
      currency: 'EUR',
      cancellationPolicy: 'Semi-flexible',
      cancellationDetails: 'Annulation sans frais jusqu’à J-5.',
      paymentPolicy: 'Acompte 1ère nuit',
      breakfastMode: 'none',
      includedGuests: 2,
      minStayDefault: 4,
      maxStayDefault: 30,
      advanceBookingMinDays: 0,
      advanceBookingMaxDays: 365,
      roomCategoryCodes: catCodes,
      channels: ['DIRECT_WEB', 'BOOKING'],
      pmsExternalId: `PMS-${shortHotelPrefix}-LS4`,
      cmExternalId: `DE-${shortHotelPrefix}-LS4`,
      validFrom: null,
      validTo: null,
      floorEur: Math.max(115, rms.rmRules.barFloorEur - 30),
      ceilingEur: rms.rmRules.barCeilingEur,
      status: 'active',
      provenance: 'local',
      updatedAt: now,
    },
    {
      id: `rp-${hotel.id}-GROUP`,
      hotelId: hotel.id,
      code: 'GROUP',
      name: 'Tarif Groupe Fixe (Indépendant)',
      description: 'Tarif forfaitaire négocié indépendant du tarif de référence : jamais recalculé automatiquement.',
      planNature: 'independent',
      referencePlanCode: null,
      calculationMode: 'independent',
      variationValue: 0,
      relationActive: false,
      currency: 'EUR',
      cancellationPolicy: 'Semi-flexible',
      cancellationDetails: 'Conditions contractuelles groupe J-30.',
      paymentPolicy: 'Acompte 1ère nuit',
      breakfastMode: 'included_1_guest',
      includedGuests: 1,
      minStayDefault: 2,
      maxStayDefault: 14,
      advanceBookingMinDays: 7,
      advanceBookingMaxDays: 365,
      roomCategoryCodes: catCodes,
      channels: ['DIRECT_WEB'],
      pmsExternalId: `PMS-${shortHotelPrefix}-GRP`,
      cmExternalId: `DE-${shortHotelPrefix}-GRP`,
      validFrom: null,
      validTo: null,
      floorEur: 140,
      ceilingEur: 600,
      status: 'active',
      provenance: 'local',
      updatedAt: now,
    },
  ];

  const referenceRules: RateReferenceRule[] = [
    {
      id: `ref-${hotel.id}-global`,
      hotelId: hotel.id,
      scope: 'all_categories',
      roomCategoryCode: 'ALL',
      referencePlanCode: 'BAR',
      currency: 'EUR',
      validFrom: null,
      validTo: null,
      priority: 1,
      isActive: true,
    },
  ];

  const flexNrf: FlexNrfConfig = {
    hotelId: hotel.id,
    flexPlanCode: 'BAR',
    nrfPlanCode: 'NRF',
    method: 'percent_discount',
    defaultValue: 12,
    categoryOverrides: [
      { roomCategoryCode: catCodes[0] || 'classique', method: 'percent_discount', value: 12 },
    ],
    periodRules: [
      {
        id: `fn-per-${hotel.id}-1`,
        label: 'Haute Compression Salons / Congrès',
        seasonType: 'evenement',
        startDate: '2026-11-18',
        endDate: '2026-11-24',
        discountPercent: 8,
        isActive: true,
      },
    ],
    demandRules: [
      {
        id: `fn-dem-${hotel.id}-1`,
        label: 'Forte demande (Score RM ≥ 80)',
        minDemandScore: 80,
        maxDemandScore: 100,
        discountPercent: 7,
      },
    ],
    nrfFloorEur: Math.max(95, rms.rmRules.barFloorEur - 25),
    roundingRule: 'nearest_euro',
    autoActivate: true,
    autoDeactivate: false,
    validFrom: null,
    validTo: null,
    autoSyncFlexToNrf: true,
  };

  const mealPlan: MealPlanConfig = {
    hotelId: hotel.id,
    name: 'Petit-Déjeuner Buffet Artisan',
    description: 'Buffet chaud & viennoiseries maison — paramétré par catégorie et période.',
    publicAdultPriceEur: 24,
    internalAdultCostEur: 9.5,
    childPriceEur: 12,
    vatPercent: 10,
    currency: 'EUR',
    pricingBasis: 'per_room',
    beneficiaryCategory: 'adultes_et_enfants',
    includedCountDefault: 2,
    applicationConditions: 'Servi de 06h30 à 10h30 en salle ou room-service.',
    categoryPrices: roomCategories.map((rc, i) => ({
      roomCategoryCode: rc.code,
      adultPriceEur: i >= 2 ? 28 : 24,
      childPriceEur: 12,
    })),
    periodPrices: [
      {
        id: `mp-per-${hotel.id}-1`,
        label: 'Période Fêtes Fin d’Année',
        startDate: '2026-12-20',
        endDate: '2027-01-03',
        adultPriceEur: 28,
        childPriceEur: 14,
      },
    ],
    normalizeInRmEngine: true,
  };

  const supplementsAndPromos: SupplementAndPromoItem[] = [
    {
      id: `sup-${hotel.id}-parking`,
      hotelId: hotel.id,
      code: 'PKG_CAR',
      name: 'Parking Privé Sécurisé',
      category: 'parking',
      itemType: 'supplement',
      pricingType: 'fixed_eur',
      value: 28,
      validFrom: null,
      validTo: null,
      roomCategoryCodes: catCodes,
      ratePlanCodes: ['BAR', 'NRF', 'BB'],
      conditions: 'Par nuit, réservation préalable recommandée.',
      combinable: true,
      excludeFromReferenceCalc: true,
      isActive: true,
    },
    {
      id: `sup-${hotel.id}-extrabed`,
      hotelId: hotel.id,
      code: 'EXTRA_BED',
      name: 'Lit supplémentaire',
      category: 'lit_supplementaire',
      itemType: 'supplement',
      pricingType: 'fixed_eur',
      value: 45,
      validFrom: null,
      validTo: null,
      roomCategoryCodes: catCodes.slice(1),
      ratePlanCodes: ['BAR', 'BB'],
      conditions: 'Disponible uniquement en Supérieure et Deluxe/Famille.',
      combinable: true,
      excludeFromReferenceCalc: true,
      isActive: true,
    },
    {
      id: `sup-${hotel.id}-lateco`,
      hotelId: hotel.id,
      code: 'LATE_CO',
      name: 'Late Check-Out (15h00)',
      category: 'late_checkout',
      itemType: 'supplement',
      pricingType: 'fixed_eur',
      value: 35,
      validFrom: null,
      validTo: null,
      roomCategoryCodes: catCodes,
      ratePlanCodes: ['BAR', 'BB', 'CORP'],
      conditions: 'Sous réserve de disponibilité le jour du départ.',
      combinable: true,
      excludeFromReferenceCalc: true,
      isActive: true,
    },
    {
      id: `sup-${hotel.id}-earlybird`,
      hotelId: hotel.id,
      code: 'PROMO_EB21',
      name: 'Promotion Réservation Anticipée J-21',
      category: 'promo_anticipee',
      itemType: 'discount',
      pricingType: 'percent',
      value: 10,
      validFrom: '2026-11-12',
      validTo: '2027-02-28',
      roomCategoryCodes: catCodes,
      ratePlanCodes: ['BAR'],
      advanceDaysRequired: 21,
      conditions: 'Cumulable uniquement hors dates de salons majeurs.',
      combinable: false,
      excludeFromReferenceCalc: true,
      isActive: true,
    },
  ];

  const restrictionRules: RateRestrictionRule[] = [
    {
      id: `rst-${hotel.id}-1`,
      hotelId: hotel.id,
      name: 'Compression Week-End & Salons (Min Stay 2)',
      dateFrom: '2026-11-20',
      dateTo: '2026-11-22',
      roomCategoryCodes: catCodes,
      ratePlanCodes: ['BAR', 'NRF', 'BB'],
      minStay: 2,
      maxStay: 14,
      cta: false,
      ctd: false,
      stopSell: false,
      advanceBookingMinDays: 0,
      allowedArrivalDays: [0, 1, 2, 3, 4, 5, 6],
      allowedDepartureDays: [0, 1, 2, 3, 4, 5, 6],
      isActive: true,
      createdAt: now,
    },
  ];

  return {
    hotelId: hotel.id,
    currency: 'EUR',
    inheritanceMode: 'hotel_override',
    overriddenSections: ['reference', 'flex_nrf', 'meal_plan'],
    referenceMode: 'single_global',
    globalReferencePlanCode: 'BAR',
    referenceRules,
    roomCategories,
    roomMappings,
    ratePlans,
    ratePlanMappings: [],
    flexNrf,
    mealPlan,
    supplementsAndPromos,
    restrictionRules,
    importHistory: [],
    updatedAt: now,
  };
}

export function getHotelTariffConfig(hotel: Hotel): HotelTariffConfiguration {
  const key = `${TARIFF_CFG_KEY_PREFIX}${hotel.id}`;
  const stored = readJSON<HotelTariffConfiguration | null>(key, null);
  if (stored && Array.isArray(stored.ratePlans) && stored.ratePlans.length > 0 && Array.isArray(stored.roomCategories)) {
    return stored;
  }
  const fresh = buildDefaultHotelTariffConfig(hotel);
  writeJSON(key, fresh);
  return fresh;
}

export function saveHotelTariffConfig(
  hotel: Hotel,
  config: HotelTariffConfiguration,
  actor: string = 'Wali Larabi',
  section: string = 'Configuration Tarifaire',
  details: string = 'Paramètres mis à jour'
): HotelTariffConfiguration {
  // Validation avant sauvegarde
  const roomValidationError = validateRoomCategoryMappings(
    config.roomCategories,
    config.roomMappings
  );
  if (roomValidationError) {
    throw new Error(roomValidationError);
  }
  const uniquenessError = validateRatePlanList(config.ratePlans);
  if (uniquenessError) {
    throw new Error(uniquenessError);
  }
  const cycle = detectCircularDependencies(config.ratePlans);
  if (cycle) {
    throw new Error(`Dépendance circulaire interdite détectée : ${cycle.join(' → ')}`);
  }

  const next: HotelTariffConfiguration = {
    ...config,
    hotelId: hotel.id,
    updatedAt: new Date().toISOString(),
  };
  writeJSON(`${TARIFF_CFG_KEY_PREFIX}${hotel.id}`, next);

  // Synchroniser les typologies vers rmsSettingsService pour cohérence globale
  try {
    const rms = getHotelRMSConfig(hotel);
    const updatedTyps = next.roomCategories
      .filter((rc) => !rc.isArchived && rc.isActive)
      .map((rc) => ({
        id: rc.id,
        code: (['classique', 'superieure', 'deluxe_famille', 'suite'].includes(rc.code)
          ? rc.code
          : 'suite') as 'classique' | 'superieure' | 'deluxe_famille' | 'suite',
        name: rc.name,
        totalRooms: rc.physicalRooms,
        baseOffsetEur: rc.baseOffsetEur,
        weightPercent: rc.weightPercent,
      }));
    if (updatedTyps.length > 0) {
      saveHotelRMSConfig(hotel.id, { ...rms, roomTypologies: updatedTyps }, actor, 'A_HOTEL', details);
    }
  } catch {
    // non bloquant
  }

  appendTariffConfigAudit({
    id: `tca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    hotelId: hotel.id,
    actor,
    section,
    action: 'update',
    details,
    createdAt: next.updatedAt,
  });

  // Persistance Supabase + validation serveur non bloquante
  void syncTariffConfigToSupabase(next);
  if (typeof fetch !== 'undefined') {
    void fetch(`/api/tariff-config/${encodeURIComponent(hotel.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: next, actor, reason: details }),
    }).catch(() => {});
  }

  emitTariffConfigUpdated(hotel.id);
  return next;
}

export function applyGroupTemplateToHotel(hotel: Hotel, actor: string = 'Wali Larabi'): HotelTariffConfiguration {
  const tpl = getGroupTariffTemplate();
  const cfg = getHotelTariffConfig(hotel);
  const now = new Date().toISOString();

  const updatedPlans = cfg.ratePlans.map((p) => {
    const shared = tpl.sharedRatePlans.find((sp) => sp.code === p.code);
    if (!shared) return p;
    return {
      ...p,
      name: shared.name,
      planNature: shared.planNature,
      referencePlanCode: shared.referencePlanCode,
      calculationMode: shared.calculationMode,
      variationValue: shared.variationValue,
      breakfastMode: shared.breakfastMode,
      cancellationPolicy: shared.cancellationPolicy,
      paymentPolicy: shared.paymentPolicy,
      currency: tpl.defaultCurrency,
      isGroupInherited: true,
      updatedAt: now,
    };
  });

  const next: HotelTariffConfiguration = {
    ...cfg,
    currency: tpl.defaultCurrency,
    inheritanceMode: 'inherit_group',
    globalReferencePlanCode: tpl.defaultReferencePlanCode,
    ratePlans: updatedPlans,
    flexNrf: {
      ...cfg.flexNrf,
      method: tpl.defaultFlexNrfMethod,
      defaultValue: tpl.defaultFlexNrfValue,
    },
    mealPlan: {
      ...cfg.mealPlan,
      publicAdultPriceEur: tpl.defaultBreakfastPriceEur,
      vatPercent: tpl.defaultVatPercent,
      currency: tpl.defaultCurrency,
    },
  };

  return saveHotelTariffConfig(
    hotel,
    next,
    actor,
    'Multi-Hôtels',
    `Héritage appliqué depuis le modèle groupe "${tpl.organizationName}".`
  );
}

// -----------------------------------------------------------------------------
// 3. CONTRÔLES D'INTÉGRITÉ, DOUBLONS & DÉPENDANCES CIRCULAIRES
// -----------------------------------------------------------------------------

export function validateRatePlanList(plans: RatePlanConfig[]): string | null {
  const seenCodes = new Set<string>();
  const seenPms = new Set<string>();
  const seenCm = new Set<string>();

  for (const p of plans) {
    const code = p.code.trim().toUpperCase();
    if (!code) return 'Le code d’un plan tarifaire ne peut pas être vide.';
    if (seenCodes.has(code)) return `Code de plan tarifaire en doublon : ${code}`;
    seenCodes.add(code);

    const pms = p.pmsExternalId.trim();
    if (pms) {
      if (seenPms.has(pms)) return `Identifiant PMS externe déjà utilisé : ${pms}`;
      seenPms.add(pms);
    }

    const cm = p.cmExternalId.trim();
    if (cm) {
      if (seenCm.has(cm)) return `Identifiant Channel Manager déjà utilisé : ${cm}`;
      seenCm.add(cm);
    }
  }
  return null;
}

export function validateRoomCategoryMappings(
  rooms: RoomCategoryConfig[],
  extraMappings: RoomTypeExternalMapping[] = []
): string | null {
  const seenInternalCodes = new Set<string>();
  const seenPmsIds = new Set<string>();
  const seenCmIds = new Set<string>();

  for (const rc of rooms) {
    const code = rc.code.trim().toLowerCase();
    if (!code) return 'Le code interne d’une catégorie de chambre ne peut pas être vide.';
    if (seenInternalCodes.has(code)) {
      return `Code catégorie interne en doublon : ${code}`;
    }
    seenInternalCodes.add(code);

    const pms = rc.pmsRoomId.trim().toUpperCase();
    if (pms) {
      if (seenPmsIds.has(pms)) {
        return `Identifiant chambre PMS en doublon : ${rc.pmsRoomId.trim()}`;
      }
      seenPmsIds.add(pms);
    }

    const cm = rc.cmRoomId.trim().toUpperCase();
    if (cm) {
      if (seenCmIds.has(cm)) {
        return `Identifiant chambre Channel Manager en doublon : ${rc.cmRoomId.trim()}`;
      }
      seenCmIds.add(cm);
    }
  }

  const seenMappingPairs = new Set<string>();
  for (const m of extraMappings) {
    const ext = m.externalCode.trim().toUpperCase();
    if (!ext) continue;
    const key = `${m.system}::${ext}`;
    if (seenMappingPairs.has(key)) {
      return `Correspondance externe ${m.system.toUpperCase()} en doublon : ${m.externalCode.trim()}`;
    }
    seenMappingPairs.add(key);
  }

  return null;
}

export function detectCircularDependencies(plans: RatePlanConfig[]): string[] | null {
  const byCode = new Map(plans.map((p) => [p.code, p]));
  const state = new Map<string, 'visiting' | 'visited'>();

  function dfs(code: string, trail: string[]): string[] | null {
    const s = state.get(code);
    if (s === 'visiting') {
      const startIdx = trail.indexOf(code);
      return [...trail.slice(startIdx), code];
    }
    if (s === 'visited') return null;

    state.set(code, 'visiting');
    const plan = byCode.get(code);
    if (
      plan &&
      plan.relationActive &&
      plan.referencePlanCode &&
      plan.calculationMode !== 'independent'
    ) {
      const found = dfs(plan.referencePlanCode, [...trail, code]);
      if (found) return found;
    }
    state.set(code, 'visited');
    return null;
  }

  for (const p of plans) {
    const cycle = dfs(p.code, []);
    if (cycle) return cycle;
  }
  return null;
}

export function canDeleteRatePlan(
  config: HotelTariffConfiguration,
  planCode: string
): { allowed: boolean; reason?: string } {
  const activeRefRules = config.referenceRules.filter(
    (r) => r.isActive && r.referencePlanCode === planCode
  );
  if (
    (config.referenceMode === 'single_global' && config.globalReferencePlanCode === planCode) ||
    activeRefRules.length > 0
  ) {
    return {
      allowed: false,
      reason: `Le plan "${planCode}" est utilisé comme tarif de référence actif.`,
    };
  }

  const dependents = config.ratePlans.filter(
    (p) => p.code !== planCode && p.status !== 'archived' && p.referencePlanCode === planCode
  );
  if (dependents.length > 0) {
    return {
      allowed: false,
      reason: `Ce plan pilote ${dependents.length} plan(s) dérivé(s) (${dependents
        .map((d) => d.code)
        .join(', ')}). Archivez-le ou détachez ses dépendances avant suppression.`,
    };
  }

  return { allowed: true };
}

export interface DependencyTreeNode {
  plan: RatePlanConfig;
  formulaLabel: string;
  children: DependencyTreeNode[];
}

export function buildRateDependencyTree(plans: RatePlanConfig[]): DependencyTreeNode[] {
  const activePlans = plans.filter((p) => p.status !== 'archived');
  const formatLabel = (p: RatePlanConfig): string => {
    if (!p.relationActive || p.calculationMode === 'independent' || !p.referencePlanCode) {
      return p.planNature === 'reference' ? 'Tarif de Référence' : 'Tarif Indépendant';
    }
    switch (p.calculationMode) {
      case 'percent_minus':
        return `-${p.variationValue}% vs ${p.referencePlanCode}`;
      case 'percent_plus':
        return `+${p.variationValue}% vs ${p.referencePlanCode}`;
      case 'fixed_minus':
        return `-${p.variationValue}€ vs ${p.referencePlanCode}`;
      case 'fixed_plus':
        return `+${p.variationValue}€ vs ${p.referencePlanCode}`;
      case 'multiplier':
        return `×${p.variationValue} ${p.referencePlanCode}`;
      case 'custom_formula':
        return p.customFormula || `Formule vs ${p.referencePlanCode}`;
      default:
        return 'Indépendant';
    }
  };

  const visited = new Set<string>();
  const buildNode = (plan: RatePlanConfig): DependencyTreeNode => {
    visited.add(plan.code);
    const children = activePlans
      .filter((c) => c.referencePlanCode === plan.code && !visited.has(c.code))
      .map((c) => buildNode(c));
    return { plan, formulaLabel: formatLabel(plan), children };
  };

  const roots = activePlans.filter(
    (p) => !p.referencePlanCode || !activePlans.some((r) => r.code === p.referencePlanCode)
  );
  return roots.map((r) => buildNode(r));
}

// -----------------------------------------------------------------------------
// 4. MOTEUR DE CALCUL SÉCURISÉ : RÉFÉRENCE -> DÉRIVÉS -> FLEX/NRF -> PETIT-DÉJEUNER
// -----------------------------------------------------------------------------

export function evaluateSafeFormula(formula: string, refPrice: number): number {
  const expr = formula
    .replace(/\bREF\b/gi, String(refPrice))
    .replace(/,/g, '.')
    .trim();

  // Autoriser strictement chiffres, opérateurs arithmétiques, espaces et parenthèses
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
    return refPrice;
  }

  // Parseur récursif sécurisé (sans eval ni Function)
  let pos = 0;
  const skipWs = () => {
    while (pos < expr.length && /\s/.test(expr[pos])) pos++;
  };
  const parseExpr = (): number => {
    let val = parseTerm();
    while (true) {
      skipWs();
      const ch = expr[pos];
      if (ch === '+') {
        pos++;
        val += parseTerm();
      } else if (ch === '-') {
        pos++;
        val -= parseTerm();
      } else break;
    }
    return val;
  };
  const parseTerm = (): number => {
    let val = parseFactor();
    while (true) {
      skipWs();
      const ch = expr[pos];
      if (ch === '*') {
        pos++;
        val *= parseFactor();
      } else if (ch === '/') {
        pos++;
        const denom = parseFactor();
        val = denom === 0 ? val : val / denom;
      } else break;
    }
    return val;
  };
  const parseFactor = (): number => {
    skipWs();
    if (expr[pos] === '(') {
      pos++;
      const inner = parseExpr();
      skipWs();
      if (expr[pos] === ')') pos++;
      return inner;
    }
    if (expr[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    const start = pos;
    while (pos < expr.length && /[0-9.]/.test(expr[pos])) pos++;
    const num = Number(expr.slice(start, pos));
    return Number.isFinite(num) ? num : 0;
  };

  const result = parseExpr();
  return Number.isFinite(result) && result > 0 ? result : refPrice;
}

export function applyRoundingRule(value: number, rule: RoundingRuleType): number {
  if (!Number.isFinite(value)) return 0;
  switch (rule) {
    case 'nearest_euro':
      return Math.round(value);
    case 'nearest_5':
      return Math.round(value / 5) * 5;
    case 'end_99':
      return Math.floor(value) + 0.99;
    case 'none':
    default:
      return Math.round(value * 100) / 100;
  }
}

export function getEffectiveBreakfastPrice(params: {
  mealPlan: MealPlanConfig;
  roomCategoryCode: string;
  stayDate: string;
  guestsCount?: number;
}): number {
  const { mealPlan, roomCategoryCode, stayDate, guestsCount = 2 } = params;
  let adultPrice = mealPlan.publicAdultPriceEur;

  // 1. Surcharge par catégorie de chambre
  const catMatch = mealPlan.categoryPrices.find((c) => c.roomCategoryCode === roomCategoryCode);
  if (catMatch) adultPrice = catMatch.adultPriceEur;

  // 2. Surcharge par période si applicable
  const perMatch = mealPlan.periodPrices.find(
    (p) => stayDate >= p.startDate && stayDate <= p.endDate
  );
  if (perMatch) adultPrice = perMatch.adultPriceEur;

  if (mealPlan.pricingBasis === 'per_room') {
    return adultPrice;
  }
  return Math.round(adultPrice * Math.max(1, guestsCount) * 100) / 100;
}

export function getEffectiveFlexNrfDiscount(params: {
  flexNrf: FlexNrfConfig;
  roomCategoryCode: string;
  stayDate: string;
  demandScore?: number;
}): { method: FlexNrfConfig['method']; value: number } {
  const { flexNrf, roomCategoryCode, stayDate, demandScore } = params;

  if (flexNrf.method === 'independent') {
    return { method: 'independent', value: 0 };
  }

  // Vérifier fenêtre de validité globale
  if (flexNrf.validFrom && stayDate < flexNrf.validFrom) {
    return { method: flexNrf.method, value: flexNrf.defaultValue };
  }
  if (flexNrf.validTo && stayDate > flexNrf.validTo) {
    return { method: flexNrf.method, value: flexNrf.defaultValue };
  }

  // 1. Règle selon le niveau de demande (si fournie)
  if (typeof demandScore === 'number') {
    const demandRule = flexNrf.demandRules.find(
      (d) => demandScore >= d.minDemandScore && demandScore <= d.maxDemandScore
    );
    if (demandRule) {
      return { method: 'percent_discount', value: demandRule.discountPercent };
    }
  }

  // 2. Règle par période / saison
  const periodRule = flexNrf.periodRules.find(
    (p) => p.isActive && stayDate >= p.startDate && stayDate <= p.endDate
  );
  if (periodRule) {
    return { method: 'percent_discount', value: periodRule.discountPercent };
  }

  // 3. Surcharge par catégorie
  const catRule = flexNrf.categoryOverrides.find((c) => c.roomCategoryCode === roomCategoryCode);
  if (catRule) {
    return { method: catRule.method, value: catRule.value };
  }

  return { method: flexNrf.method, value: flexNrf.defaultValue };
}

export function resolveReferencePlanCode(
  config: HotelTariffConfiguration,
  roomCategoryCode: string,
  stayDate: string
): string {
  if (config.referenceMode === 'single_global') {
    return config.globalReferencePlanCode || 'BAR';
  }

  const matching = config.referenceRules
    .filter((r) => {
      if (!r.isActive) return false;
      const matchCat =
        r.scope === 'all_categories' ||
        r.roomCategoryCode === 'ALL' ||
        r.roomCategoryCode === roomCategoryCode;
      if (!matchCat) return false;
      if (r.validFrom && stayDate < r.validFrom) return false;
      if (r.validTo && stayDate > r.validTo) return false;
      return true;
    })
    .sort((a, b) => {
      // Prioriser les règles spécifiques par catégorie avant ALL, puis par priorité
      if (a.scope !== b.scope) return a.scope === 'per_category' ? -1 : 1;
      return a.priority - b.priority;
    });

  return matching[0]?.referencePlanCode || config.globalReferencePlanCode || 'BAR';
}

export function normalizeRateExcludingBreakfast(
  rateEur: number,
  plan: RatePlanConfig | undefined,
  mealPlan: MealPlanConfig,
  roomCategoryCode: string,
  stayDate: string
): number {
  if (!plan || !mealPlan.normalizeInRmEngine || plan.breakfastMode === 'none' || plan.breakfastMode === 'supplement_optional') {
    return rateEur;
  }
  const guests =
    plan.breakfastMode === 'included_1_guest' ? 1 : Math.max(1, plan.includedGuests || 2);
  const breakfastAddon = getEffectiveBreakfastPrice({
    mealPlan,
    roomCategoryCode,
    stayDate,
    guestsCount: mealPlan.pricingBasis === 'per_person' ? guests : 1,
  });
  return Math.max(40, Math.round(rateEur - breakfastAddon));
}

export function computeDerivedRateForPlan(params: {
  referenceRateEur: number;
  targetPlan: RatePlanConfig;
  config: HotelTariffConfiguration;
  roomCategoryCode: string;
  stayDate: string;
  demandScore?: number;
}): number | null {
  const { referenceRateEur, targetPlan, config, roomCategoryCode, stayDate, demandScore } = params;

  // Un tarif indépendant ou à relation désactivée NE DOIT JAMAIS être modifié automatiquement
  if (
    targetPlan.planNature === 'independent' ||
    targetPlan.calculationMode === 'independent' ||
    !targetPlan.relationActive
  ) {
    return null;
  }

  let computed = referenceRateEur;
  let rounding: RoundingRuleType = 'nearest_euro';
  let floorVal = targetPlan.floorEur ?? 50;

  // Cas particulier piloté par la configuration avancée FLEX / NRF
  const isManagedNrf =
    targetPlan.code === config.flexNrf.nrfPlanCode &&
    targetPlan.referencePlanCode === config.flexNrf.flexPlanCode;

  if (isManagedNrf) {
    if (!config.flexNrf.autoSyncFlexToNrf || config.flexNrf.method === 'independent') {
      return null;
    }
    const eff = getEffectiveFlexNrfDiscount({
      flexNrf: config.flexNrf,
      roomCategoryCode,
      stayDate,
      demandScore,
    });
    if (eff.method === 'independent') return null;
    if (eff.method === 'percent_discount') {
      computed = referenceRateEur * (1 - eff.value / 100);
    } else if (eff.method === 'fixed_discount') {
      computed = referenceRateEur - eff.value;
    } else if (eff.method === 'custom_formula') {
      computed = evaluateSafeFormula(config.flexNrf.customFormula || 'REF * 0.9', referenceRateEur);
    }
    rounding = config.flexNrf.roundingRule;
    floorVal = Math.max(floorVal, config.flexNrf.nrfFloorEur || 0);
  } else {
    // Dérivation générique des plans tarifaires
    switch (targetPlan.calculationMode) {
      case 'percent_minus':
        computed = referenceRateEur * (1 - targetPlan.variationValue / 100);
        break;
      case 'percent_plus':
        computed = referenceRateEur * (1 + targetPlan.variationValue / 100);
        break;
      case 'fixed_minus':
        computed = referenceRateEur - targetPlan.variationValue;
        break;
      case 'fixed_plus': {
        // Si le plan inclut le petit-déjeuner et correspond au supplément configuré, calculer dynamiquement
        const addon =
          targetPlan.breakfastMode === 'included_1_guest' ||
          targetPlan.breakfastMode === 'included_2_guests' ||
          targetPlan.breakfastMode === 'included_per_occupancy'
            ? getEffectiveBreakfastPrice({
                mealPlan: config.mealPlan,
                roomCategoryCode,
                stayDate,
                guestsCount:
                  config.mealPlan.pricingBasis === 'per_person'
                    ? targetPlan.includedGuests || 2
                    : 1,
              })
            : targetPlan.variationValue;
        // Utiliser le montant configuré sur le plan si différent de l'addon par défaut, sinon dynamique
        const effectivePlus =
          targetPlan.code === 'BB' ? addon : targetPlan.variationValue;
        computed = referenceRateEur + effectivePlus;
        break;
      }
      case 'multiplier':
        computed = referenceRateEur * targetPlan.variationValue;
        break;
      case 'custom_formula':
        computed = evaluateSafeFormula(targetPlan.customFormula || 'REF', referenceRateEur);
        break;
      default:
        return null;
    }
  }

  let rounded = applyRoundingRule(computed, rounding);
  if (floorVal && rounded < floorVal) rounded = floorVal;
  if (targetPlan.ceilingEur && rounded > targetPlan.ceilingEur) rounded = targetPlan.ceilingEur;
  return Math.max(50, Math.round(rounded * 100) / 100);
}

/**
 * Calcule la cascade complète à partir d'un tarif racine modifié (gère multi-niveaux A -> B -> C sans boucle).
 */
export function resolveCascadeForRootPlan(params: {
  rootPlanCode: string;
  rootNewRateEur: number;
  config: HotelTariffConfiguration;
  roomCategoryCode: string;
  stayDate: string;
  demandScore?: number;
}): { planCode: string; computedRateEur: number; level: number }[] {
  const { rootPlanCode, rootNewRateEur, config, roomCategoryCode, stayDate, demandScore } = params;
  const activePlans = config.ratePlans.filter(
    (p) => p.status === 'active' && p.roomCategoryCodes.includes(roomCategoryCode)
  );
  const visited = new Set<string>([rootPlanCode]);
  const queue: { parentCode: string; parentRate: number; level: number }[] = [
    { parentCode: rootPlanCode, parentRate: rootNewRateEur, level: 0 },
  ];
  const results: { planCode: string; computedRateEur: number; level: number }[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const directChildren = activePlans.filter(
      (p) =>
        p.referencePlanCode === current.parentCode &&
        !visited.has(p.code) &&
        p.planNature !== 'independent' &&
        p.calculationMode !== 'independent' &&
        p.relationActive
    );

    for (const child of directChildren) {
      visited.add(child.code);
      const nextRate = computeDerivedRateForPlan({
        referenceRateEur: current.parentRate,
        targetPlan: child,
        config,
        roomCategoryCode,
        stayDate,
        demandScore,
      });
      if (nextRate !== null) {
        results.push({ planCode: child.code, computedRateEur: nextRate, level: current.level + 1 });
        queue.push({ parentCode: child.code, parentRate: nextRate, level: current.level + 1 });
      }
    }
  }

  return results;
}

// -----------------------------------------------------------------------------
// 5. ASSISTANT D'IMPORTATION EN 10 ÉTAPES (EXCEL / CSV / PMS / CHANNEL MANAGER)
// -----------------------------------------------------------------------------

export function parseRatePlansFromSpreadsheetBuffer(
  buffer: ArrayBuffer,
  _fileName: string
): RateImportItem[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);

  return rows
    .map((row, idx) => {
      const code = String(
        row.code || row.Code || row.rate_code || row['Code Plan'] || `IMP_${idx + 1}`
      )
        .trim()
        .toUpperCase();
      const name = String(row.name || row.Nom || row['Nom Commercial'] || code).trim();
      const modeRaw = String(row.calculation_mode || row.Mode || 'independent').toLowerCase();
      const varVal = Number(row.variation || row.Variation || 0) || 0;
      const bfast =
        String(row.breakfast || row['Petit-déjeuner'] || 'false').toLowerCase() === 'true' ||
        String(row.breakfast || row['Petit-déjeuner'] || '').toLowerCase() === 'oui';

      const calculationMode =
        modeRaw.includes('percent_minus') || modeRaw.includes('-%')
          ? 'percent_minus'
          : modeRaw.includes('fixed_plus') || modeRaw.includes('+€')
          ? 'fixed_plus'
          : 'independent';

      return {
        id: `imp-item-${idx}-${Date.now()}`,
        externalCode: code,
        name,
        planNature: calculationMode === 'independent' ? 'independent' : 'derived',
        calculationMode,
        variationValue: varVal,
        roomCategories: String(row.categories || row.Categories || 'classique,superieure')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        breakfastIncluded: bfast,
        cancellationPolicy:
          String(row.cancellation || row.Annulation || '').toLowerCase().includes('non')
            ? 'Non-annulable'
            : 'Flexible',
        action: 'add' as const,
      } satisfies RateImportItem;
    })
    .filter((i) => i.externalCode.length > 0);
}

export function buildImportPreviewDiff(
  existingPlans: RatePlanConfig[],
  incoming: Omit<RateImportItem, 'action' | 'matchedInternalCode'>[],
  importMode: RateImportJob['mode']
): RateImportItem[] {
  const existingByCode = new Map(existingPlans.map((p) => [p.code.toUpperCase(), p]));
  return incoming.map((item) => {
    const normCode = item.externalCode.trim().toUpperCase();
    const match = existingByCode.get(normCode);
    if (!match) {
      return { ...item, externalCode: normCode, action: 'add' };
    }
    if (importMode === 'add_only' || importMode === 'ignore_existing') {
      return {
        ...item,
        externalCode: normCode,
        action: 'ignore',
        matchedInternalCode: match.code,
      };
    }
    return {
      ...item,
      externalCode: normCode,
      action: 'update',
      matchedInternalCode: match.code,
    };
  });
}

export function executeRatePlanImport(
  hotel: Hotel,
  params: {
    source: RateImportJob['source'];
    fileName?: string;
    mode: RateImportJob['mode'];
    items: RateImportItem[];
    newRoomCategories?: { externalCode: string; name: string; physicalRooms: number; maxAdults: number; maxChildren: number }[];
  },
  actor: string = 'Wali Larabi'
): { config: HotelTariffConfiguration; job: RateImportJob } {
  const cfg = getHotelTariffConfig(hotel);
  const now = new Date().toISOString();
  let updatedPlans = [...cfg.ratePlans];
  let addedCount = 0;
  let updatedCount = 0;
  let ignoredCount = 0;

  params.items.forEach((item) => {
    const code = item.externalCode.trim().toUpperCase();
    const idx = updatedPlans.findIndex((p) => p.code.toUpperCase() === code);

    if (item.action === 'ignore' || (idx >= 0 && params.mode !== 'update_existing')) {
      ignoredCount++;
      return;
    }

    if (idx >= 0 && params.mode === 'update_existing') {
      updatedPlans[idx] = {
        ...updatedPlans[idx],
        name: item.name,
        calculationMode: item.calculationMode,
        variationValue: item.variationValue,
        breakfastMode: item.breakfastIncluded ? 'included_2_guests' : 'none',
        cancellationPolicy: item.cancellationPolicy,
        pmsExternalId: params.source === 'pms' ? code : updatedPlans[idx].pmsExternalId,
        cmExternalId: params.source === 'channel_manager' ? code : updatedPlans[idx].cmExternalId,
        provenance: params.source,
        updatedAt: now,
      };
      updatedCount++;
      return;
    }

    if (idx < 0) {
      addedCount++;
      updatedPlans.push({
        id: `rp-${hotel.id}-${code}-${Date.now()}`,
        hotelId: hotel.id,
        code,
        name: item.name,
        description: `Plan importé depuis ${params.source.toUpperCase()}${params.fileName ? ` (${params.fileName})` : ''}.`,
        planNature: item.planNature,
        referencePlanCode: item.calculationMode === 'independent' ? null : cfg.globalReferencePlanCode,
        calculationMode: item.calculationMode,
        variationValue: item.variationValue,
        relationActive: item.calculationMode !== 'independent',
        currency: cfg.currency,
        cancellationPolicy: item.cancellationPolicy,
        cancellationDetails: 'Conditions importées — modifiables dans Configuration.',
        paymentPolicy:
          item.cancellationPolicy === 'Non-annulable'
            ? 'Prépaiement total à la réservation'
            : 'Paiement sur place',
        breakfastMode: item.breakfastIncluded ? 'included_2_guests' : 'none',
        includedGuests: 2,
        minStayDefault: 1,
        maxStayDefault: 30,
        advanceBookingMinDays: 0,
        advanceBookingMaxDays: 365,
        roomCategoryCodes:
          item.roomCategories.length > 0
            ? item.roomCategories
            : cfg.roomCategories.map((c) => c.code),
        channels: ['DIRECT_WEB', 'BOOKING', 'EXPEDIA'],
        pmsExternalId: params.source === 'pms' ? `PMS-IMP-${code}` : '',
        cmExternalId: params.source === 'channel_manager' ? `CM-IMP-${code}` : '',
        validFrom: null,
        validTo: null,
        status: 'active',
        provenance: params.source,
        updatedAt: now,
      });
    }
  });

  // Ajout de nouvelles catégories externes SANS jamais créer de doublon
  let updatedRooms = [...cfg.roomCategories];
  if (params.newRoomCategories && params.newRoomCategories.length > 0) {
    params.newRoomCategories.forEach((extCat) => {
      const alreadyMapped = updatedRooms.some(
        (rc) =>
          rc.pmsRoomId === extCat.externalCode ||
          rc.cmRoomId === extCat.externalCode ||
          rc.name.toLowerCase() === extCat.name.toLowerCase()
      );
      if (!alreadyMapped) {
        const cleanCode = extCat.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .slice(0, 24);
        updatedRooms.push({
          id: `rc-${hotel.id}-${cleanCode}-${Date.now()}`,
          hotelId: hotel.id,
          code: cleanCode,
          name: extCat.name,
          description: `Catégorie importée depuis ${params.source.toUpperCase()}`,
          physicalRooms: extCat.physicalRooms || 5,
          maxCapacity: (extCat.maxAdults || 2) + (extCat.maxChildren || 0),
          maxAdults: extCat.maxAdults || 2,
          maxChildren: extCat.maxChildren || 0,
          standardOccupancy: 2,
          maxOccupancy: extCat.maxAdults || 2,
          isActive: true,
          pmsRoomId: params.source === 'pms' ? extCat.externalCode : '',
          cmRoomId: params.source === 'channel_manager' ? extCat.externalCode : '',
          applicableRatePlanCodes: updatedPlans.map((p) => p.code),
          extraAdultSupplementEur: 40,
          extraChildSupplementEur: 20,
          thirdAdultSupplementEur: 45,
          singleOccupancySupplementEur: -15,
          tripleOccupancySupplementEur: 45,
          baseOffsetEur: 25,
          weightPercent: 15,
          provenance: params.source === 'pms' ? 'pms' : params.source === 'channel_manager' ? 'channel_manager' : 'excel',
        });
      }
    });
  }

  const job: RateImportJob = {
    id: `IMP-${Date.now()}`,
    hotelId: hotel.id,
    source: params.source,
    fileName: params.fileName,
    mode: params.mode,
    itemsCount: params.items.length,
    addedCount,
    updatedCount,
    ignoredCount,
    status: 'completed',
    actor,
    createdAt: now,
    summary: `Import ${params.source.toUpperCase()} : ${addedCount} ajouté(s), ${updatedCount} mis à jour, ${ignoredCount} ignoré(s).`,
  };

  const nextConfig = saveHotelTariffConfig(
    hotel,
    {
      ...cfg,
      roomCategories: updatedRooms,
      ratePlans: updatedPlans,
      importHistory: [job, ...cfg.importHistory].slice(0, 50),
    },
    actor,
    'Importation Plans',
    job.summary
  );

  void syncRateImportJobToSupabase(job);
  return { config: nextConfig, job };
}

export function exportRatePlansToExcel(hotel: Hotel, plans: RatePlanConfig[]): void {
  const rows = plans.map((p) => ({
    Code: p.code,
    Nom: p.name,
    Nature: p.planNature,
    Reference: p.referencePlanCode || 'Aucune',
    Mode_Calcul: p.calculationMode,
    Variation: p.variationValue,
    Devise: p.currency,
    Annulation: p.cancellationPolicy,
    Paiement: p.paymentPolicy,
    Petit_Dejeuner: p.breakfastMode,
    ID_PMS: p.pmsExternalId,
    ID_Channel_Manager: p.cmExternalId,
    Statut: p.status,
    Provenance: p.provenance,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plans_Tarifaires');
  XLSX.writeFile(wb, `flowtym-plans-tarifaires-${hotel.id}.xlsx`);
}
