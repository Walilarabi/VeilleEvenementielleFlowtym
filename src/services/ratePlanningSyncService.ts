/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM REVENUE — SERVICE CENTRAL DE PLANNING TARIFAIRE & SYNCHRONISATION BIDIRECTIONNELLE
 * Relie : Configuration Tarifaire <-> Moteur RM <-> Grille Planning Tarifaire <-> Connecteur PMS / CM <-> Supabase
 */

import {
  DistributionChannelCode,
  Hotel,
  HotelConnectivityConfig,
  RateAuditHistoryEntry,
  RateCalendarCell,
  RateModificationOrigin,
  RatePlanCode,
  RatePlanConfig,
  RateRecommendationMetadata,
  RateRestrictionRule,
  RateSyncConflict,
  RateSyncOperation,
  RateSyncStatus,
} from '../types';
import {
  buildDefaultConnectivityConfig,
  getHotelRMSConfig,
  saveHotelRMSConfig,
} from './rmsSettingsService';
import {
  DailyRateIntelligence,
  getRateIntelligenceRecords,
  saveRateIntelligenceRecords,
} from './rateIntelligenceService';
import {
  computeDerivedRateForPlan,
  getHotelTariffConfig,
  normalizeRateExcludingBreakfast,
  resolveCascadeForRootPlan,
  resolveReferencePlanCode,
} from './tariffConfigurationService';
import {
  syncConnectivityConfigToSupabase,
  syncRateAuditHistoryToSupabase,
  syncRateConflictToSupabase,
  syncRatePlanningCellsToSupabase,
  syncRateSyncOperationToSupabase,
} from './supabaseSyncService';
import {
  appendLocalSyncLog,
  getCachedConnectorsForHotel,
} from './connectors/connectorRegistry';

const CELLS_KEY_PREFIX = 'flowtym_rate_planning_cells_v1_';
const OPS_KEY_PREFIX = 'flowtym_rate_sync_ops_v1_';
const CONFLICTS_KEY_PREFIX = 'flowtym_rate_conflicts_v1_';
const HISTORY_KEY_PREFIX = 'flowtym_rate_audit_history_v1_';
const PROCESSED_INBOUND_KEY_PREFIX = 'flowtym_processed_inbound_keys_v1_';

export const RATE_PLANNING_EVENT = 'flowtym:rate-planning-updated';

// Fallback mémoire pour exécution Node/CLI (tests automatisés sans browser localStorage)
const planningMemoryStore = new Map<string, string>();

export const RATE_PLAN_DEFS: {
  code: RatePlanCode;
  name: string;
  derivationLabel: string;
  computeRate: (barRate: number) => number;
}[] = [
  {
    code: 'BAR',
    name: 'Best Available Rate',
    derivationLabel: 'Tarif de référence flexible',
    computeRate: (bar) => Math.round(bar),
  },
  {
    code: 'NRF',
    name: 'Non-Remboursable (-12%)',
    derivationLabel: '-12% vs BAR · Non-annulable',
    computeRate: (bar) => Math.round(bar * 0.88),
  },
  {
    code: 'BB',
    name: 'Tarif Petit-Déjeuner (+24€)',
    derivationLabel: '+24€ vs BAR · PDJ inclus',
    computeRate: (bar) => Math.round(bar + 24),
  },
];

export const DISTRIBUTION_CHANNEL_DEFS: {
  code: DistributionChannelCode;
  name: string;
  markupPct: number;
}[] = [
  { code: 'DIRECT_WEB', name: 'Site Officiel Direct', markupPct: -3 },
  { code: 'BOOKING', name: 'Booking.com', markupPct: 0 },
  { code: 'EXPEDIA', name: 'Expedia', markupPct: 0 },
  { code: 'GDS', name: 'GDS Corporate', markupPct: 4 },
];

export function buildCellKey(
  hotelId: string,
  roomTypeCode: string,
  ratePlanCode: RatePlanCode,
  stayDate: string
): string {
  return `${hotelId}::${roomTypeCode}::${ratePlanCode}::${stayDate}`;
}

export function computeChannelRates(baseRateEur: number): Record<DistributionChannelCode, number> {
  return {
    DIRECT_WEB: Math.round(baseRateEur * 0.97),
    BOOKING: Math.round(baseRateEur),
    EXPEDIA: Math.round(baseRateEur),
    GDS: Math.round(baseRateEur * 1.04),
  };
}

function resolveApiUrl(path: string): string {
  if (typeof window !== 'undefined') return path;
  const base =
    (typeof process !== 'undefined' && process.env?.FLOWTYM_API_BASE) || 'http://127.0.0.1:3000';
  return `${base}${path}`;
}

function safeRead<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    }
    const mem = planningMemoryStore.get(key);
    return mem ? (JSON.parse(mem) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    const serialized = JSON.stringify(value);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, serialized);
    }
    planningMemoryStore.set(key, serialized);
  } catch {
    // ignore storage quota errors
  }
}

function emitPlanningUpdate(hotelId: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RATE_PLANNING_EVENT, { detail: { hotelId } }));
  }
}

export function getHotelConnectivityConfig(hotel: Hotel): HotelConnectivityConfig {
  const rms = getHotelRMSConfig(hotel);
  return rms.connectivity || buildDefaultConnectivityConfig(hotel.id);
}

export function saveHotelConnectivityConfig(
  hotel: Hotel,
  connectivity: HotelConnectivityConfig,
  actor: string = 'Wali Larabi'
): HotelConnectivityConfig {
  const rms = getHotelRMSConfig(hotel);
  const modeLabel =
    connectivity.activeMode === 'pms'
      ? `Mode A — PMS (${connectivity.pmsProvider})`
      : connectivity.activeMode === 'channel_manager'
      ? `Mode B — Channel Manager (${connectivity.channelManagerProvider})`
      : `Mode Étendu — Coexistence (${connectivity.pmsProvider} + ${connectivity.channelManagerProvider})`;

  saveHotelRMSConfig(
    hotel.id,
    { ...rms, connectivity },
    actor,
    'E_INTEGRATIONS',
    `Configuration connectivité : ${modeLabel}`,
    `Source de vérité : ${connectivity.sourceOfTruth} • Anti-boucle : ${connectivity.antiLoopEnabled ? 'actif' : 'inactif'} • Priorité conflits : ${connectivity.conflictPriorityStrategy}`
  );
  void syncConnectivityConfigToSupabase(hotel.id, connectivity);
  emitPlanningUpdate(hotel.id);
  return connectivity;
}

export function resolveTargetConnectorSystem(
  connectivity: HotelConnectivityConfig,
  actionScope: 'rates' | 'restrictions' | 'inventory' = 'rates'
): 'pms' | 'channel_manager' {
  if (connectivity.activeMode === 'pms') return 'pms';
  if (connectivity.activeMode === 'channel_manager') return 'channel_manager';
  if (actionScope === 'rates') {
    return connectivity.cmResponsibilities.includes('rates') ? 'channel_manager' : 'pms';
  }
  return connectivity.pmsResponsibilities.includes('restrictions') ? 'pms' : 'channel_manager';
}

export function getCellRoleForPlan(
  hotel: Hotel,
  roomCategoryCode: string,
  ratePlanCode: string,
  stayDate: string
): 'reference' | 'derived' | 'independent' {
  const cfg = getHotelTariffConfig(hotel);
  const refCode = resolveReferencePlanCode(cfg, roomCategoryCode, stayDate);
  if (refCode === ratePlanCode) return 'reference';
  const plan = cfg.ratePlans.find((p) => p.code === ratePlanCode);
  if (!plan) return 'independent';
  if (
    plan.planNature === 'independent' ||
    plan.calculationMode === 'independent' ||
    !plan.relationActive ||
    !plan.referencePlanCode
  ) {
    return 'independent';
  }
  return 'derived';
}

function computeInitialPlanRate(
  plan: RatePlanConfig,
  refRateEur: number,
  cfg: ReturnType<typeof getHotelTariffConfig>,
  roomCategoryCode: string,
  stayDate: string,
  demandScore?: number
): number {
  if (plan.code === cfg.globalReferencePlanCode || plan.planNature === 'reference') {
    return Math.round(refRateEur);
  }
  if (plan.planNature === 'independent' || plan.calculationMode === 'independent') {
    const base = plan.code === 'GROUP' ? Math.round(refRateEur * 0.9) : Math.round(refRateEur);
    return Math.max(plan.floorEur ?? 50, Math.min(plan.ceilingEur ?? 2500, base));
  }
  const derived = computeDerivedRateForPlan({
    referenceRateEur: refRateEur,
    targetPlan: plan,
    config: cfg,
    roomCategoryCode,
    stayDate,
    demandScore,
  });
  return derived !== null ? Math.round(derived) : Math.round(refRateEur);
}

function buildInitialCellsForHotel(hotel: Hotel): RateCalendarCell[] {
  const cfg = getHotelTariffConfig(hotel);
  const dailyRecords = getRateIntelligenceRecords(hotel);
  const activeCategories = cfg.roomCategories.filter((rc) => rc.isActive && !rc.isArchived);
  const activePlans = cfg.ratePlans.filter((p) => p.status === 'active');
  const cells: RateCalendarCell[] = [];
  const createdAt = new Date().toISOString();

  dailyRecords.forEach((dayRec: DailyRateIntelligence) => {
    activeCategories.forEach((cat) => {
      const catBarCurrent = Math.max(80, Math.round(dayRec.currentBarEur + cat.baseOffsetEur));
      const catBarSuggested = Math.max(80, Math.round(dayRec.suggestedBarEur + cat.baseOffsetEur));
      const catRoomsAvail = Math.max(
        0,
        Math.min(cat.physicalRooms, Math.round((dayRec.remainingRooms * cat.weightPercent) / 100))
      );

      activePlans.forEach((plan) => {
        if (plan.roomCategoryCodes.length > 0 && !plan.roomCategoryCodes.includes(cat.code)) {
          return;
        }
        const planCurrent = computeInitialPlanRate(
          plan,
          catBarCurrent,
          cfg,
          cat.code,
          dayRec.dateStr,
          dayRec.rmScore
        );
        const role = getCellRoleForPlan(hotel, cat.code, plan.code, dayRec.dateStr);
        const planSuggested =
          role === 'independent'
            ? planCurrent
            : computeInitialPlanRate(
                plan,
                catBarSuggested,
                cfg,
                cat.code,
                dayRec.dateStr,
                dayRec.rmScore
              );
        const deltaEur = planSuggested - planCurrent;
        const deltaPct = planCurrent > 0 ? Math.round((deltaEur / planCurrent) * 1000) / 10 : 0;
        const key = buildCellKey(hotel.id, cat.code, plan.code, dayRec.dateStr);

        const recMeta: RateRecommendationMetadata | null =
          dayRec.status === 'pending' && deltaEur !== 0 && role !== 'independent'
            ? {
                recommendationId: `REC-${hotel.id.toUpperCase()}-${dayRec.dateStr}-${cat.code.toUpperCase()}-${plan.code}`,
                hotelId: hotel.id,
                stayDate: dayRec.dateStr,
                roomTypeCode: cat.code,
                ratePlanCode: plan.code,
                currentRateEur: planCurrent,
                recommendedRateEur: planSuggested,
                deltaEur,
                deltaPct,
                confidenceScore: dayRec.confidenceScore,
                justification:
                  dayRec.justification ||
                  `${dayRec.rmRecommendation.strategyLabel} (${dayRec.occupancyPercent}% OTB, médiane compset ${dayRec.compsetMedianEur}€)`,
                createdAt: `${dayRec.dateStr}T06:00:00Z`,
                algorithmVersion: 'FLOWTYM-RM-v4.4',
                suggestedMinStay: dayRec.suggestedMinStay,
                suggestedStopSell: dayRec.suggestedStopSellPromos,
                status: 'pending',
                targetRole: role,
                normalizedExclBreakfastEur: normalizeRateExcludingBreakfast(
                  planSuggested,
                  plan,
                  cfg.mealPlan,
                  cat.code,
                  dayRec.dateStr
                ),
              }
            : null;

        cells.push({
          cellKey: key,
          hotelId: hotel.id,
          roomTypeCode: cat.code,
          roomTypeName: cat.name,
          ratePlanCode: plan.code,
          ratePlanName: plan.name,
          stayDate: dayRec.dateStr,
          currentRateEur: planCurrent,
          previousRateEur: null,
          inventoryAvailable: catRoomsAvail,
          totalRoomsInCategory: cat.physicalRooms,
          minStay: Math.max(dayRec.currentMinStay, plan.minStayDefault || 1),
          maxStay: plan.maxStayDefault ?? null,
          cta: false,
          ctd: false,
          isClosed: dayRec.currentStopSell,
          channelRates: computeChannelRates(planCurrent),
          recommendation: recMeta,
          flowtymSavedRateEur: planCurrent,
          transmittedRateEur: planCurrent,
          confirmedExternalRateEur: planCurrent,
          syncStatus: 'synced',
          syncErrorMessage: null,
          lastSyncAt: createdAt,
          lastSyncAckId: `INIT-${plan.code}-${dayRec.dateStr.replace(/-/g, '')}`,
          modificationOrigin: 'flowtym_auto',
          isManualOverride: false,
          version: 1,
          externalVersion: 1,
          lastExternalRateEur: planCurrent,
          lastExternalUpdatedAt: createdAt,
          lastExternalActor: 'Synchronisation initiale CRS',
          updatedBy: 'Système Flowtym',
          updatedAt: createdAt,
        });
      });
    });
  });

  return cells;
}

/**
 * Synchronise paresseusement les cellules du Planning avec les catégories & plans configurés
 * (ajoute les nouveaux plans/catégories créés ou importés sans écraser les tarifs déjà pilotés).
 */
export function syncCellsWithTariffConfig(hotel: Hotel): RateCalendarCell[] {
  const cfg = getHotelTariffConfig(hotel);
  const stored = safeRead<RateCalendarCell[]>(`${CELLS_KEY_PREFIX}${hotel.id}`, []);
  if (stored.length === 0) {
    const fresh = buildInitialCellsForHotel(hotel);
    safeWrite(`${CELLS_KEY_PREFIX}${hotel.id}`, fresh);
    return fresh;
  }

  const dailyRecords = getRateIntelligenceRecords(hotel);
  const byKey = new Map(stored.map((c) => [c.cellKey, c]));
  const catByCode = new Map(cfg.roomCategories.map((c) => [c.code, c]));
  const planByCode = new Map(cfg.ratePlans.map((p) => [p.code, p]));
  let changed = false;

  // Mise à jour des libellés si catégorie ou plan renommé
  const updatedExisting = stored.map((cell) => {
    const cat = catByCode.get(cell.roomTypeCode);
    const plan = planByCode.get(cell.ratePlanCode);
    if (!cat && !plan) return cell;
    const nextRoomName = cat ? cat.name : cell.roomTypeName;
    const nextPlanName = plan ? plan.name : cell.ratePlanName;
    const nextTotal = cat ? cat.physicalRooms : cell.totalRoomsInCategory;
    if (
      nextRoomName !== cell.roomTypeName ||
      nextPlanName !== cell.ratePlanName ||
      nextTotal !== cell.totalRoomsInCategory
    ) {
      changed = true;
      return {
        ...cell,
        roomTypeName: nextRoomName,
        ratePlanName: nextPlanName,
        totalRoomsInCategory: nextTotal,
      };
    }
    return cell;
  });

  const activeCategories = cfg.roomCategories.filter((rc) => rc.isActive && !rc.isArchived);
  const activePlans = cfg.ratePlans.filter((p) => p.status === 'active');
  const now = new Date().toISOString();

  dailyRecords.forEach((dayRec) => {
    activeCategories.forEach((cat) => {
      const refCode = resolveReferencePlanCode(cfg, cat.code, dayRec.dateStr);
      const refCell = byKey.get(buildCellKey(hotel.id, cat.code, refCode, dayRec.dateStr));
      const baseRate =
        refCell?.currentRateEur ?? Math.max(80, Math.round(dayRec.currentBarEur + cat.baseOffsetEur));
      const baseSuggested = Math.max(80, Math.round(dayRec.suggestedBarEur + cat.baseOffsetEur));
      const catRoomsAvail = Math.max(
        0,
        Math.min(cat.physicalRooms, Math.round((dayRec.remainingRooms * cat.weightPercent) / 100))
      );

      activePlans.forEach((plan) => {
        if (plan.roomCategoryCodes.length > 0 && !plan.roomCategoryCodes.includes(cat.code)) {
          return;
        }
        const key = buildCellKey(hotel.id, cat.code, plan.code, dayRec.dateStr);
        if (byKey.has(key)) return;

        changed = true;
        // Si ce plan dérive d'un parent déjà présent dans la grille, prendre son tarif réel
        const parentCell = plan.referencePlanCode
          ? byKey.get(buildCellKey(hotel.id, cat.code, plan.referencePlanCode, dayRec.dateStr))
          : refCell;
        const parentRate = parentCell?.currentRateEur ?? baseRate;
        const planCurrent = computeInitialPlanRate(
          plan,
          parentRate,
          cfg,
          cat.code,
          dayRec.dateStr,
          dayRec.rmScore
        );
        const role = getCellRoleForPlan(hotel, cat.code, plan.code, dayRec.dateStr);
        const planSuggested =
          role === 'independent'
            ? planCurrent
            : computeInitialPlanRate(
                plan,
                baseSuggested,
                cfg,
                cat.code,
                dayRec.dateStr,
                dayRec.rmScore
              );
        const deltaEur = planSuggested - planCurrent;
        const deltaPct = planCurrent > 0 ? Math.round((deltaEur / planCurrent) * 1000) / 10 : 0;

        const newCell: RateCalendarCell = {
          cellKey: key,
          hotelId: hotel.id,
          roomTypeCode: cat.code,
          roomTypeName: cat.name,
          ratePlanCode: plan.code,
          ratePlanName: plan.name,
          stayDate: dayRec.dateStr,
          currentRateEur: planCurrent,
          previousRateEur: null,
          inventoryAvailable: catRoomsAvail,
          totalRoomsInCategory: cat.physicalRooms,
          minStay: Math.max(dayRec.currentMinStay, plan.minStayDefault || 1),
          maxStay: plan.maxStayDefault ?? null,
          cta: false,
          ctd: false,
          isClosed: dayRec.currentStopSell,
          channelRates: computeChannelRates(planCurrent),
          recommendation:
            dayRec.status === 'pending' && deltaEur !== 0 && role !== 'independent'
              ? {
                  recommendationId: `REC-${hotel.id.toUpperCase()}-${dayRec.dateStr}-${cat.code.toUpperCase()}-${plan.code}`,
                  hotelId: hotel.id,
                  stayDate: dayRec.dateStr,
                  roomTypeCode: cat.code,
                  ratePlanCode: plan.code,
                  currentRateEur: planCurrent,
                  recommendedRateEur: planSuggested,
                  deltaEur,
                  deltaPct,
                  confidenceScore: dayRec.confidenceScore,
                  justification: dayRec.justification,
                  createdAt: `${dayRec.dateStr}T06:00:00Z`,
                  algorithmVersion: 'FLOWTYM-RM-v4.4',
                  suggestedMinStay: dayRec.suggestedMinStay,
                  suggestedStopSell: dayRec.suggestedStopSellPromos,
                  status: 'pending',
                  targetRole: role,
                }
              : null,
          flowtymSavedRateEur: planCurrent,
          transmittedRateEur: planCurrent,
          confirmedExternalRateEur: planCurrent,
          syncStatus: 'synced',
          syncErrorMessage: null,
          lastSyncAt: now,
          lastSyncAckId: `CFG-${plan.code}-${dayRec.dateStr.replace(/-/g, '')}`,
          modificationOrigin: 'flowtym_auto',
          isManualOverride: false,
          version: 1,
          externalVersion: 1,
          lastExternalRateEur: planCurrent,
          lastExternalUpdatedAt: now,
          lastExternalActor: 'Matérialisation Configuration Tarifaire',
          updatedBy: 'Système Flowtym',
          updatedAt: now,
        };
        updatedExisting.push(newCell);
        byKey.set(key, newCell);
      });
    });
  });

  if (changed) {
    safeWrite(`${CELLS_KEY_PREFIX}${hotel.id}`, updatedExisting);
  }
  return updatedExisting;
}

export function getRatePlanningCells(hotel: Hotel): RateCalendarCell[] {
  return syncCellsWithTariffConfig(hotel);
}

export function saveRatePlanningCells(hotelId: string, cells: RateCalendarCell[]): void {
  safeWrite(`${CELLS_KEY_PREFIX}${hotelId}`, cells);
  emitPlanningUpdate(hotelId);
}

export function getRateSyncOperations(hotelId: string): RateSyncOperation[] {
  return safeRead<RateSyncOperation[]>(`${OPS_KEY_PREFIX}${hotelId}`, []);
}

export function getRateSyncConflicts(hotelId: string): RateSyncConflict[] {
  return safeRead<RateSyncConflict[]>(`${CONFLICTS_KEY_PREFIX}${hotelId}`, []);
}

export function getRateAuditHistory(hotelId: string): RateAuditHistoryEntry[] {
  return safeRead<RateAuditHistoryEntry[]>(`${HISTORY_KEY_PREFIX}${hotelId}`, []);
}

function appendSyncOperations(hotelId: string, newOps: RateSyncOperation[]): RateSyncOperation[] {
  const existing = getRateSyncOperations(hotelId);
  const map = new Map(existing.map((o) => [o.id, o]));
  newOps.forEach((op) => {
    map.set(op.id, op);
    void syncRateSyncOperationToSupabase(op);
  });
  const merged = Array.from(map.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 350);
  safeWrite(`${OPS_KEY_PREFIX}${hotelId}`, merged);
  return merged;
}

function appendAuditHistory(hotelId: string, entries: RateAuditHistoryEntry[]): RateAuditHistoryEntry[] {
  const existing = getRateAuditHistory(hotelId);
  entries.forEach((e) => void syncRateAuditHistoryToSupabase(e));
  const merged = [...entries, ...existing].slice(0, 400);
  safeWrite(`${HISTORY_KEY_PREFIX}${hotelId}`, merged);
  return merged;
}

function upsertConflict(hotelId: string, conflict: RateSyncConflict): RateSyncConflict[] {
  const existing = getRateSyncConflicts(hotelId);
  const next = [conflict, ...existing.filter((c) => c.id !== conflict.id)].slice(0, 100);
  safeWrite(`${CONFLICTS_KEY_PREFIX}${hotelId}`, next);
  void syncRateConflictToSupabase(conflict);
  return next;
}

function mirrorPlanningBarToIntelligenceGrid(
  hotelId: string,
  stayDate: string,
  newBarRate: number,
  minStay: number,
  status: 'applied' | 'modified' | 'rejected',
  note: string,
  actor: string
): void {
  const records = getRateIntelligenceRecords(hotelId);
  if (!records.length) return;
  const updated = records.map((rec) => {
    if (rec.dateStr !== stayDate) return rec;
    return {
      ...rec,
      status,
      appliedRateEur: status === 'rejected' ? rec.appliedRateEur : newBarRate,
      appliedMinStay: status === 'rejected' ? rec.appliedMinStay : minStay,
      currentBarEur: status === 'rejected' ? rec.currentBarEur : newBarRate,
      currentMinStay: status === 'rejected' ? rec.currentMinStay : minStay,
      deltaVsCurrentEur: status === 'rejected' ? rec.deltaVsCurrentEur : rec.suggestedBarEur - newBarRate,
      decisionNote: note,
      decidedBy: actor,
      lastDecisionAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };
  });
  saveRateIntelligenceRecords(hotelId, updated);
}

export interface RateChangeImpactPreview {
  targetRole: 'reference' | 'derived' | 'independent';
  referencePlanCode: string;
  normalizedExclBreakfastEur: number;
  impactedDerived: {
    planCode: string;
    planName: string;
    currentRateEur: number;
    newRateEur: number;
    deltaEur: number;
    level: number;
    isNrfManaged: boolean;
  }[];
  untouchedIndependent: {
    planCode: string;
    planName: string;
    currentRateEur: number;
  }[];
  warnings: string[];
}

export function previewRateChangeCascade(
  hotel: Hotel,
  cellKey: string,
  candidateRateEur: number
): RateChangeImpactPreview | null {
  const allCells = getRatePlanningCells(hotel);
  const target = allCells.find((c) => c.cellKey === cellKey);
  if (!target) return null;

  const cfg = getHotelTariffConfig(hotel);
  const role = getCellRoleForPlan(hotel, target.roomTypeCode, target.ratePlanCode, target.stayDate);
  const refCode = resolveReferencePlanCode(cfg, target.roomTypeCode, target.stayDate);
  const targetPlan = cfg.ratePlans.find((p) => p.code === target.ratePlanCode);

  const normalizedExclBreakfastEur = normalizeRateExcludingBreakfast(
    candidateRateEur,
    targetPlan,
    cfg.mealPlan,
    target.roomTypeCode,
    target.stayDate
  );

  const cascadeList = resolveCascadeForRootPlan({
    rootPlanCode: target.ratePlanCode,
    rootNewRateEur: candidateRateEur,
    config: cfg,
    roomCategoryCode: target.roomTypeCode,
    stayDate: target.stayDate,
  });

  const impactedDerived = cascadeList
    .map((item) => {
      const sibling = allCells.find(
        (c) =>
          c.stayDate === target.stayDate &&
          c.roomTypeCode === target.roomTypeCode &&
          c.ratePlanCode === item.planCode
      );
      if (!sibling) return null;
      const planCfg = cfg.ratePlans.find((p) => p.code === item.planCode);
      return {
        planCode: item.planCode,
        planName: planCfg?.name || item.planCode,
        currentRateEur: sibling.currentRateEur,
        newRateEur: Math.round(item.computedRateEur),
        deltaEur: Math.round(item.computedRateEur) - sibling.currentRateEur,
        level: item.level,
        isNrfManaged: item.planCode === cfg.flexNrf.nrfPlanCode,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const untouchedIndependent = cfg.ratePlans
    .filter(
      (p) =>
        p.status === 'active' &&
        p.code !== target.ratePlanCode &&
        (p.planNature === 'independent' || p.calculationMode === 'independent' || !p.relationActive)
    )
    .map((p) => {
      const sibling = allCells.find(
        (c) =>
          c.stayDate === target.stayDate &&
          c.roomTypeCode === target.roomTypeCode &&
          c.ratePlanCode === p.code
      );
      return {
        planCode: p.code,
        planName: p.name,
        currentRateEur: sibling?.currentRateEur ?? 0,
      };
    });

  const warnings: string[] = [];
  if (targetPlan?.floorEur && candidateRateEur < targetPlan.floorEur) {
    warnings.push(`Sous le plancher configuré (${targetPlan.floorEur}€) pour ${targetPlan.code}.`);
  }
  if (targetPlan?.ceilingEur && candidateRateEur > targetPlan.ceilingEur) {
    warnings.push(`Au-dessus du plafond configuré (${targetPlan.ceilingEur}€) pour ${targetPlan.code}.`);
  }

  return {
    targetRole: role,
    referencePlanCode: refCode,
    normalizedExclBreakfastEur,
    impactedDerived,
    untouchedIndependent,
    warnings,
  };
}

export interface PushSyncOutcome {
  cells: RateCalendarCell[];
  operations: RateSyncOperation[];
  conflicts: RateSyncConflict[];
  history: RateAuditHistoryEntry[];
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  lastError?: string;
}

/**
 * Sens 1 : Transmission réelle vers le backend PMS / Channel Manager (/api/rate-planning/push)
 */
export async function dispatchOutboundPush(
  hotel: Hotel,
  targetCells: RateCalendarCell[],
  origin: 'flowtym_auto' | 'flowtym_manual',
  actionType: RateAuditHistoryEntry['actionType'],
  actor: string,
  reason: string,
  options?: {
    forceOverwrite?: boolean;
    simulateOutcome?: 'failed' | 'rejected';
    recommendationId?: string;
    revertedFromHistoryId?: string;
  }
): Promise<PushSyncOutcome> {
  const connectivity = getHotelConnectivityConfig(hotel);
  const targetSystem = resolveTargetConnectorSystem(connectivity, 'rates');
  const now = new Date().toISOString();

  const opByCellKey = new Map<string, RateSyncOperation>();
  targetCells.forEach((cell) => {
    const idempotencyKey = `push-${hotel.id}-${cell.cellKey}-v${cell.version}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 5)}`;
    const op: RateSyncOperation = {
      id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      hotelId: hotel.id,
      cellKey: cell.cellKey,
      stayDate: cell.stayDate,
      roomTypeCode: cell.roomTypeCode,
      ratePlanCode: cell.ratePlanCode,
      direction: 'outbound_push',
      targetSystem,
      origin,
      idempotencyKey,
      previousRateEur: cell.previousRateEur,
      newRateEur: cell.currentRateEur,
      status: 'sending',
      externalAckId: null,
      errorMessage: null,
      attempts: 1,
      createdAt: now,
      confirmedAt: null,
    };
    opByCellKey.set(cell.cellKey, op);
  });

  let currentCells = getRatePlanningCells(hotel).map((cell) => {
    const updatedTarget = targetCells.find((t) => t.cellKey === cell.cellKey);
    if (!updatedTarget) return cell;
    return {
      ...updatedTarget,
      syncStatus: 'sending' as RateSyncStatus,
      transmittedRateEur: updatedTarget.currentRateEur,
      lastSentAt: new Date().toISOString(),
    };
  });
  saveRatePlanningCells(hotel.id, currentCells);
  appendSyncOperations(hotel.id, Array.from(opByCellKey.values()));

  let results: any[] = [];
  let networkError: string | null = null;

  try {
    const resp = await fetch(resolveApiUrl('/api/rate-planning/push'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotelId: hotel.id,
        targetSystem,
        origin,
        actor,
        forceOverwrite: Boolean(options?.forceOverwrite),
        simulateOutcome: options?.simulateOutcome,
        cells: targetCells.map((c) => ({
          cellKey: c.cellKey,
          stayDate: c.stayDate,
          roomTypeCode: c.roomTypeCode,
          ratePlanCode: c.ratePlanCode,
          newRateEur: c.currentRateEur,
          minStay: c.minStay,
          maxStay: c.maxStay,
          cta: c.cta,
          ctd: c.ctd,
          isClosed: c.isClosed,
          baseExternalVersion: c.externalVersion,
          idempotencyKey: opByCellKey.get(c.cellKey)?.idempotencyKey,
        })),
      }),
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const json = await resp.json();
    results = Array.isArray(json.results) ? json.results : [];
  } catch (err: any) {
    networkError = err?.message || 'Serveur connecteur injoignable';
  }

  let syncedCount = 0;
  let failedCount = 0;
  let conflictCount = 0;
  let lastError: string | undefined;
  const completedOps: RateSyncOperation[] = [];
  const auditEntries: RateAuditHistoryEntry[] = [];
  let updatedConflicts = getRateSyncConflicts(hotel.id);

  const resultMap = new Map(results.map((r: any) => [r.cellKey, r]));

  currentCells = getRatePlanningCells(hotel).map((cell) => {
    const target = targetCells.find((t) => t.cellKey === cell.cellKey);
    if (!target) return cell;

    const op = opByCellKey.get(cell.cellKey)!;
    const res = resultMap.get(cell.cellKey);

    if (networkError || !res) {
      failedCount++;
      const errMsg = networkError || 'Réponse connecteur manquante';
      lastError = errMsg;
      const failedOp: RateSyncOperation = { ...op, status: 'failed', errorMessage: errMsg };
      completedOps.push(failedOp);
      auditEntries.push({
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        hotelId: hotel.id,
        cellKey: cell.cellKey,
        stayDate: cell.stayDate,
        roomTypeCode: cell.roomTypeCode,
        ratePlanCode: cell.ratePlanCode,
        actionType,
        previousRateEur: cell.previousRateEur,
        newRateEur: cell.currentRateEur,
        origin,
        syncStatus: 'failed',
        recommendationId: options?.recommendationId,
        syncOperationId: op.id,
        revertedFromHistoryId: options?.revertedFromHistoryId,
        actor,
        reason: `${reason} — Échec transmission : ${errMsg}`,
        createdAt: new Date().toISOString(),
      });
      return {
        ...cell,
        syncStatus: 'failed' as RateSyncStatus,
        syncErrorMessage: errMsg,
      };
    }

    if (res.status === 'conflict' && res.conflict) {
      conflictCount++;
      lastError = res.errorMessage;
      const conflictOp: RateSyncOperation = {
        ...op,
        status: 'conflict',
        errorMessage: res.errorMessage,
      };
      completedOps.push(conflictOp);

      const newConflict: RateSyncConflict = {
        id: `conf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        hotelId: hotel.id,
        cellKey: cell.cellKey,
        stayDate: cell.stayDate,
        roomTypeCode: cell.roomTypeCode,
        roomTypeName: cell.roomTypeName,
        ratePlanCode: cell.ratePlanCode,
        flowtymRateEur: cell.currentRateEur,
        flowtymTimestamp: new Date().toISOString(),
        flowtymActor: actor,
        externalRateEur: res.conflict.externalRateEur,
        externalSource: res.conflict.externalSource,
        externalTimestamp: res.conflict.externalTimestamp,
        externalActor: res.conflict.externalActor,
        baseVersion: res.conflict.baseVersion,
        externalVersion: res.conflict.externalVersion,
        pendingRecommendationId: options?.recommendationId,
        status: 'open',
      };
      updatedConflicts = upsertConflict(hotel.id, newConflict);

      auditEntries.push({
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        hotelId: hotel.id,
        cellKey: cell.cellKey,
        stayDate: cell.stayDate,
        roomTypeCode: cell.roomTypeCode,
        ratePlanCode: cell.ratePlanCode,
        actionType,
        previousRateEur: cell.previousRateEur,
        newRateEur: cell.currentRateEur,
        origin,
        syncStatus: 'conflict',
        recommendationId: options?.recommendationId,
        syncOperationId: op.id,
        actor,
        reason: `Conflit détecté (${cell.currentRateEur}€ vs externe ${res.conflict.externalRateEur}€)`,
        createdAt: new Date().toISOString(),
      });

      return {
        ...cell,
        syncStatus: 'conflict' as RateSyncStatus,
        syncErrorMessage: res.errorMessage,
        lastExternalRateEur: res.conflict.externalRateEur,
        lastExternalUpdatedAt: res.conflict.externalTimestamp,
        lastExternalActor: res.conflict.externalActor,
        externalVersion: res.conflict.externalVersion,
      };
    }

    if (res.status === 'rejected' || res.status === 'failed') {
      failedCount++;
      lastError = res.errorMessage;
      const errOp: RateSyncOperation = {
        ...op,
        status: res.status,
        errorMessage: res.errorMessage,
      };
      completedOps.push(errOp);
      auditEntries.push({
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        hotelId: hotel.id,
        cellKey: cell.cellKey,
        stayDate: cell.stayDate,
        roomTypeCode: cell.roomTypeCode,
        ratePlanCode: cell.ratePlanCode,
        actionType,
        previousRateEur: cell.previousRateEur,
        newRateEur: cell.currentRateEur,
        origin,
        syncStatus: res.status,
        recommendationId: options?.recommendationId,
        syncOperationId: op.id,
        actor,
        reason: `${reason} — ${res.errorMessage}`,
        createdAt: new Date().toISOString(),
      });
      return {
        ...cell,
        syncStatus: res.status as RateSyncStatus,
        syncErrorMessage: res.errorMessage,
      };
    }

    syncedCount++;
    const ackTime = res.confirmedAt || new Date().toISOString();
    const okOp: RateSyncOperation = {
      ...op,
      status: 'synced',
      externalAckId: res.externalAckId,
      confirmedAt: ackTime,
    };
    completedOps.push(okOp);
    auditEntries.push({
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      hotelId: hotel.id,
      cellKey: cell.cellKey,
      stayDate: cell.stayDate,
      roomTypeCode: cell.roomTypeCode,
      ratePlanCode: cell.ratePlanCode,
      actionType,
      previousRateEur: cell.previousRateEur,
      newRateEur: res.confirmedRateEur,
      origin,
      syncStatus: 'synced',
      recommendationId: options?.recommendationId,
      syncOperationId: op.id,
      revertedFromHistoryId: options?.revertedFromHistoryId,
      actor,
      reason: `${reason} (ACK ${res.externalAckId})`,
      createdAt: ackTime,
    });

    return {
      ...cell,
      confirmedExternalRateEur: res.confirmedRateEur,
      pmsReturnedRateEur:
        targetSystem === 'pms' ? res.confirmedRateEur : cell.pmsReturnedRateEur ?? null,
      cmReturnedRateEur:
        targetSystem === 'channel_manager' ? res.confirmedRateEur : cell.cmReturnedRateEur ?? null,
      pmsUpdatedAt: targetSystem === 'pms' ? ackTime : cell.pmsUpdatedAt ?? null,
      cmUpdatedAt: targetSystem === 'channel_manager' ? ackTime : cell.cmUpdatedAt ?? null,
      lastExternalRateEur: res.confirmedRateEur,
      lastExternalUpdatedAt: ackTime,
      lastExternalActor: actor,
      externalVersion: res.externalVersion || cell.externalVersion + 1,
      syncStatus: 'synced' as RateSyncStatus,
      syncErrorMessage: null,
      lastSyncAt: ackTime,
      lastSyncAckId: res.externalAckId,
      lastSentAt: ackTime,
    };
  });

  saveRatePlanningCells(hotel.id, currentCells);
  void syncRatePlanningCellsToSupabase(
    currentCells.filter((c) => targetCells.some((t) => t.cellKey === c.cellKey))
  );
  const operations = appendSyncOperations(hotel.id, completedOps);
  const history = appendAuditHistory(hotel.id, auditEntries);

  const activeConns = getCachedConnectorsForHotel(hotel.id);
  const matchedConn =
    activeConns.find((c) => c.family === targetSystem && c.isActive) || activeConns[0];
  appendLocalSyncLog(hotel.id, {
    id: `slog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    hotelId: hotel.id,
    connectorId: matchedConn?.id || targetSystem,
    providerId: matchedConn?.providerId || (targetSystem === 'pms' ? 'opera_cloud' : 'dedge'),
    providerName:
      matchedConn?.displayName ||
      (targetSystem === 'pms' ? connectivity.pmsProvider : connectivity.channelManagerProvider),
    family: targetSystem,
    operationType: 'push_rates',
    direction: 'outbound',
    status: failedCount > 0 ? 'failed' : conflictCount > 0 ? 'conflict' : 'synced',
    executionMode: matchedConn?.executionMode || 'sandbox_simulation',
    roomTypeCode: targetCells[0]?.roomTypeCode,
    ratePlanCode: targetCells[0]?.ratePlanCode,
    stayDateFrom: targetCells[0]?.stayDate,
    stayDateTo: targetCells[targetCells.length - 1]?.stayDate,
    cellsAffected: targetCells.length,
    traceabilityId: completedOps[0]?.externalAckId || `PUSH-${Date.now()}`,
    externalAckId: completedOps[0]?.externalAckId || null,
    durationMs: 120,
    actor,
    message: `${syncedCount} confirmée(s), ${failedCount} échec(s), ${conflictCount} conflit(s) — ${reason}`,
    createdAt: new Date().toISOString(),
  });

  if (syncedCount > 0) {
    const rms = getHotelRMSConfig(hotel);
    const conn = rms.connectivity || buildDefaultConnectivityConfig(hotel.id);
    saveHotelRMSConfig(hotel.id, {
      ...rms,
      connectivity: {
        ...conn,
        lastPushAt: new Date().toISOString(),
        connectionHealth: failedCount > 0 ? 'degraded' : 'connected',
      },
    });
  }

  return {
    cells: currentCells,
    operations,
    conflicts: updatedConflicts,
    history,
    syncedCount,
    failedCount,
    conflictCount,
    lastError,
  };
}

/**
 * ACTION : ACCEPTER UNE RECOMMANDATION RM
 * Sait si la cible est Référence / Dérivé / Indépendant, recalcule les dérivés autorisés
 * sans jamais toucher aux tarifs indépendants, et pousse en 2-Way Sync.
 */
export async function acceptRecommendationInPlanning(
  hotel: Hotel,
  cellKey: string,
  options?: {
    actor?: string;
    cascadeDerivedPlans?: boolean;
    forceOverwrite?: boolean;
    simulateOutcome?: 'failed' | 'rejected';
  }
): Promise<PushSyncOutcome & { blockedByStaleCheck?: boolean }> {
  const actor = options?.actor || 'Wali Larabi (Head of RM)';
  const allCells = getRatePlanningCells(hotel);
  const targetCell = allCells.find((c) => c.cellKey === cellKey);
  if (!targetCell || !targetCell.recommendation) {
    throw new Error('Recommandation introuvable pour cette cellule.');
  }
  const rec = targetCell.recommendation;

  if (
    rec.status !== 'pending' ||
    rec.hotelId !== hotel.id ||
    rec.stayDate !== targetCell.stayDate ||
    rec.roomTypeCode !== targetCell.roomTypeCode ||
    rec.ratePlanCode !== targetCell.ratePlanCode
  ) {
    throw new Error('Recommandation expirée ou ne correspondant pas à la cellule cible.');
  }

  if (
    !options?.forceOverwrite &&
    targetCell.currentRateEur !== rec.currentRateEur &&
    (targetCell.modificationOrigin === 'pms' || targetCell.modificationOrigin === 'channel_manager')
  ) {
    const openConflict: RateSyncConflict = {
      id: `conf-stale-${Date.now()}`,
      hotelId: hotel.id,
      cellKey: targetCell.cellKey,
      stayDate: targetCell.stayDate,
      roomTypeCode: targetCell.roomTypeCode,
      roomTypeName: targetCell.roomTypeName,
      ratePlanCode: targetCell.ratePlanCode,
      flowtymRateEur: rec.recommendedRateEur,
      flowtymTimestamp: new Date().toISOString(),
      flowtymActor: actor,
      externalRateEur: targetCell.currentRateEur,
      externalSource: targetCell.modificationOrigin,
      externalTimestamp: targetCell.lastExternalUpdatedAt || targetCell.updatedAt,
      externalActor: targetCell.lastExternalActor || 'Système externe',
      baseVersion: targetCell.version,
      externalVersion: targetCell.externalVersion,
      pendingRecommendationId: rec.recommendationId,
      status: 'open',
    };
    const conflicts = upsertConflict(hotel.id, openConflict);
    const updatedCells = allCells.map((c) =>
      c.cellKey === cellKey
        ? {
            ...c,
            syncStatus: 'conflict' as RateSyncStatus,
            syncErrorMessage: `Tarif modifié entre temps par ${targetCell.modificationOrigin} (${rec.currentRateEur}€ → ${targetCell.currentRateEur}€). Confirmation requise.`,
          }
        : c
    );
    saveRatePlanningCells(hotel.id, updatedCells);
    return {
      cells: updatedCells,
      operations: getRateSyncOperations(hotel.id),
      conflicts,
      history: getRateAuditHistory(hotel.id),
      syncedCount: 0,
      failedCount: 0,
      conflictCount: 1,
      blockedByStaleCheck: true,
      lastError: 'Modification externe concurrente détectée avant application.',
    };
  }

  const cfg = getHotelTariffConfig(hotel);
  const role = getCellRoleForPlan(hotel, targetCell.roomTypeCode, targetCell.ratePlanCode, targetCell.stayDate);
  const targetPlanCfg = cfg.ratePlans.find((p) => p.code === targetCell.ratePlanCode);
  const normalizedExcl = normalizeRateExcludingBreakfast(
    rec.recommendedRateEur,
    targetPlanCfg,
    cfg.mealPlan,
    targetCell.roomTypeCode,
    targetCell.stayDate
  );

  const now = new Date().toISOString();
  const newRate = rec.recommendedRateEur;
  const cellsToPush: RateCalendarCell[] = [];

  // Résoudre la cascade dynamique uniquement si le plan n'est pas indépendant
  const shouldCascade = options?.cascadeDerivedPlans !== false && role !== 'independent';
  const cascadeMap = new Map<string, number>();
  if (shouldCascade) {
    resolveCascadeForRootPlan({
      rootPlanCode: targetCell.ratePlanCode,
      rootNewRateEur: newRate,
      config: cfg,
      roomCategoryCode: targetCell.roomTypeCode,
      stayDate: targetCell.stayDate,
    }).forEach((item) => {
      cascadeMap.set(item.planCode, Math.round(item.computedRateEur));
    });
  }

  const updatedCellsList = allCells.map((cell) => {
    if (cell.cellKey === cellKey) {
      const nextCell: RateCalendarCell = {
        ...cell,
        previousRateEur: cell.currentRateEur,
        currentRateEur: newRate,
        flowtymSavedRateEur: newRate,
        minStay: Math.max(cell.minStay, rec.suggestedMinStay || 1),
        channelRates: computeChannelRates(newRate),
        recommendation: {
          ...rec,
          status: 'accepted',
          targetRole: role,
          normalizedExclBreakfastEur: normalizedExcl,
        },
        modificationOrigin: 'flowtym_auto',
        isManualOverride: false,
        version: cell.version + 1,
        updatedBy: actor,
        updatedAt: now,
      };
      cellsToPush.push(nextCell);
      return nextCell;
    }

    if (
      shouldCascade &&
      cell.stayDate === targetCell.stayDate &&
      cell.roomTypeCode === targetCell.roomTypeCode &&
      cascadeMap.has(cell.ratePlanCode)
    ) {
      const derivedRate = cascadeMap.get(cell.ratePlanCode)!;
      const nextDerived: RateCalendarCell = {
        ...cell,
        previousRateEur: cell.currentRateEur,
        currentRateEur: derivedRate,
        flowtymSavedRateEur: derivedRate,
        minStay: Math.max(cell.minStay, rec.suggestedMinStay || 1),
        channelRates: computeChannelRates(derivedRate),
        recommendation: cell.recommendation ? { ...cell.recommendation, status: 'accepted' } : null,
        modificationOrigin: 'flowtym_auto',
        isManualOverride: false,
        version: cell.version + 1,
        updatedBy: actor,
        updatedAt: now,
      };
      cellsToPush.push(nextDerived);
      return nextDerived;
    }

    return cell;
  });

  saveRatePlanningCells(hotel.id, updatedCellsList);

  const activeRefCode = resolveReferencePlanCode(cfg, targetCell.roomTypeCode, targetCell.stayDate);
  const firstCatCode = cfg.roomCategories[0]?.code || 'classique';
  if (targetCell.ratePlanCode === activeRefCode && targetCell.roomTypeCode === firstCatCode) {
    mirrorPlanningBarToIntelligenceGrid(
      hotel.id,
      targetCell.stayDate,
      newRate,
      rec.suggestedMinStay || 1,
      'applied',
      `Recommandation ${rec.recommendationId} (${role.toUpperCase()}) acceptée dans le Planning Tarifaire`,
      actor
    );
  }

  return dispatchOutboundPush(
    hotel,
    cellsToPush,
    'flowtym_auto',
    'recommendation_accepted',
    actor,
    `Acceptation recommandation ${rec.recommendationId} [${role}] (${rec.currentRateEur}€ → ${newRate}€)`,
    {
      forceOverwrite: options?.forceOverwrite,
      simulateOutcome: options?.simulateOutcome,
      recommendationId: rec.recommendationId,
    }
  );
}

/**
 * ACTION : REFUSER UNE RECOMMANDATION RM
 */
export function rejectRecommendationInPlanning(
  hotel: Hotel,
  cellKey: string,
  reason: string,
  actor: string = 'Wali Larabi (Head of RM)'
): { cells: RateCalendarCell[]; history: RateAuditHistoryEntry[] } {
  const allCells = getRatePlanningCells(hotel);
  const target = allCells.find((c) => c.cellKey === cellKey);
  if (!target || !target.recommendation) {
    return { cells: allCells, history: getRateAuditHistory(hotel.id) };
  }

  const now = new Date().toISOString();
  const updated = allCells.map((c) => {
    if (c.cellKey !== cellKey || !c.recommendation) return c;
    return {
      ...c,
      recommendation: {
        ...c.recommendation,
        status: 'rejected' as const,
        rejectionReason: reason || 'Maintien tarifaire décidé par le Revenue Manager',
      },
      updatedAt: now,
    };
  });

  saveRatePlanningCells(hotel.id, updated);
  void syncRatePlanningCellsToSupabase(updated.filter((c) => c.cellKey === cellKey));

  const history = appendAuditHistory(hotel.id, [
    {
      id: `hist-rej-${Date.now()}`,
      hotelId: hotel.id,
      cellKey,
      stayDate: target.stayDate,
      roomTypeCode: target.roomTypeCode,
      ratePlanCode: target.ratePlanCode,
      actionType: 'recommendation_rejected',
      previousRateEur: target.currentRateEur,
      newRateEur: target.currentRateEur,
      origin: 'flowtym_manual',
      syncStatus: target.syncStatus,
      recommendationId: target.recommendation.recommendationId,
      actor,
      reason: `Recommandation refusée (${target.recommendation.recommendedRateEur}€ ignoré) : ${reason}`,
      createdAt: now,
    },
  ]);

  const cfg = getHotelTariffConfig(hotel);
  const activeRefCode = resolveReferencePlanCode(cfg, target.roomTypeCode, target.stayDate);
  const firstCatCode = cfg.roomCategories[0]?.code || 'classique';
  if (target.ratePlanCode === activeRefCode && target.roomTypeCode === firstCatCode) {
    mirrorPlanningBarToIntelligenceGrid(
      hotel.id,
      target.stayDate,
      target.currentRateEur,
      target.minStay,
      'rejected',
      `Recommandation refusée : ${reason}`,
      actor
    );
  }

  return { cells: updated, history };
}

/**
 * ACTION : MODIFICATION MANUELLE D'UNE CELLULE + CASCADE DYNAMIQUE + SYNCHRONISATION EXTERNE
 */
export async function updateCellManuallyInPlanning(
  hotel: Hotel,
  cellKey: string,
  patch: {
    newRateEur: number;
    inventoryAvailable?: number;
    minStay?: number;
    maxStay?: number | null;
    cta?: boolean;
    ctd?: boolean;
    isClosed?: boolean;
    reason?: string;
    cascadeDerivedPlans?: boolean;
    forceOverwrite?: boolean;
    saveOnly?: boolean;
    simulateOutcome?: 'failed' | 'rejected';
  },
  actor: string = 'Wali Larabi (Head of RM)'
): Promise<PushSyncOutcome> {
  const allCells = getRatePlanningCells(hotel);
  const target = allCells.find((c) => c.cellKey === cellKey);
  if (!target) throw new Error('Cellule introuvable.');

  const cfg = getHotelTariffConfig(hotel);
  const role = getCellRoleForPlan(hotel, target.roomTypeCode, target.ratePlanCode, target.stayDate);
  const now = new Date().toISOString();
  const nextRate = Math.round(patch.newRateEur);
  const nextInv =
    patch.inventoryAvailable !== undefined
      ? Math.max(0, Math.min(target.totalRoomsInCategory, Math.round(patch.inventoryAvailable)))
      : target.inventoryAvailable;
  const shouldCascade = patch.cascadeDerivedPlans !== false && role !== 'independent';
  const cellsToPush: RateCalendarCell[] = [];

  const cascadeMap = new Map<string, number>();
  if (shouldCascade) {
    resolveCascadeForRootPlan({
      rootPlanCode: target.ratePlanCode,
      rootNewRateEur: nextRate,
      config: cfg,
      roomCategoryCode: target.roomTypeCode,
      stayDate: target.stayDate,
    }).forEach((item) => {
      cascadeMap.set(item.planCode, Math.round(item.computedRateEur));
    });
  }

  const updatedCells = allCells.map((cell) => {
    if (cell.cellKey === cellKey) {
      const next: RateCalendarCell = {
        ...cell,
        previousRateEur: cell.currentRateEur,
        currentRateEur: nextRate,
        flowtymSavedRateEur: nextRate,
        inventoryAvailable: nextInv,
        inventoryLeftForSale: nextInv,
        minStay: patch.minStay ?? cell.minStay,
        maxStay: patch.maxStay !== undefined ? patch.maxStay : cell.maxStay,
        cta: patch.cta !== undefined ? patch.cta : cell.cta,
        ctd: patch.ctd !== undefined ? patch.ctd : cell.ctd,
        isClosed: patch.isClosed !== undefined ? patch.isClosed : cell.isClosed,
        channelRates: computeChannelRates(nextRate),
        recommendation: cell.recommendation
          ? { ...cell.recommendation, status: 'modified' }
          : null,
        syncStatus: patch.saveOnly ? ('saved_local' as RateSyncStatus) : cell.syncStatus,
        modificationOrigin: 'flowtym_manual',
        isManualOverride: true,
        version: cell.version + 1,
        updatedBy: actor,
        updatedAt: now,
      };
      cellsToPush.push(next);
      return next;
    }

    if (
      patch.inventoryAvailable !== undefined &&
      cell.stayDate === target.stayDate &&
      cell.roomTypeCode === target.roomTypeCode
    ) {
      // L'inventaire Left for sale est partagé au niveau de la catégorie de chambre sur la date
      const derivedRate = cascadeMap.get(cell.ratePlanCode);
      const effectiveRate = derivedRate !== undefined ? derivedRate : cell.currentRateEur;
      const nextSibling: RateCalendarCell = {
        ...cell,
        previousRateEur: derivedRate !== undefined ? cell.currentRateEur : cell.previousRateEur,
        currentRateEur: effectiveRate,
        flowtymSavedRateEur: effectiveRate,
        inventoryAvailable: nextInv,
        inventoryLeftForSale: nextInv,
        channelRates: computeChannelRates(effectiveRate),
        syncStatus: patch.saveOnly ? ('saved_local' as RateSyncStatus) : cell.syncStatus,
        version: cell.version + 1,
        updatedBy: actor,
        updatedAt: now,
      };
      cellsToPush.push(nextSibling);
      return nextSibling;
    }

    if (
      shouldCascade &&
      cell.stayDate === target.stayDate &&
      cell.roomTypeCode === target.roomTypeCode &&
      cascadeMap.has(cell.ratePlanCode)
    ) {
      const derivedRate = cascadeMap.get(cell.ratePlanCode)!;
      const nextDerived: RateCalendarCell = {
        ...cell,
        previousRateEur: cell.currentRateEur,
        currentRateEur: derivedRate,
        flowtymSavedRateEur: derivedRate,
        minStay: patch.minStay ?? cell.minStay,
        isClosed: patch.isClosed !== undefined ? patch.isClosed : cell.isClosed,
        channelRates: computeChannelRates(derivedRate),
        syncStatus: patch.saveOnly ? ('saved_local' as RateSyncStatus) : cell.syncStatus,
        modificationOrigin: 'flowtym_auto',
        isManualOverride: false,
        version: cell.version + 1,
        updatedBy: actor,
        updatedAt: now,
      };
      cellsToPush.push(nextDerived);
      return nextDerived;
    }

    return cell;
  });

  saveRatePlanningCells(hotel.id, updatedCells);

  const activeRefCode = resolveReferencePlanCode(cfg, target.roomTypeCode, target.stayDate);
  const firstCatCode = cfg.roomCategories[0]?.code || 'classique';
  if (target.ratePlanCode === activeRefCode && target.roomTypeCode === firstCatCode) {
    mirrorPlanningBarToIntelligenceGrid(
      hotel.id,
      target.stayDate,
      nextRate,
      patch.minStay ?? target.minStay,
      'modified',
      patch.reason || `Modification manuelle dans le Planning Tarifaire (${nextRate}€)`,
      actor
    );
  }

  if (patch.saveOnly) {
    const history = appendAuditHistory(hotel.id, [
      {
        id: `hist-loc-${Date.now()}`,
        hotelId: hotel.id,
        cellKey: target.cellKey,
        stayDate: target.stayDate,
        roomTypeCode: target.roomTypeCode,
        ratePlanCode: target.ratePlanCode,
        actionType: 'manual_edit',
        previousRateEur: target.currentRateEur,
        newRateEur: nextRate,
        origin: 'flowtym_manual',
        syncStatus: 'saved_local',
        actor,
        reason: patch.reason || `Enregistré dans FLOWTYM sans envoi immédiat (${nextRate}€, stock ${nextInv})`,
        createdAt: now,
      },
    ]);
    return {
      cells: updatedCells,
      operations: getRateSyncOperations(hotel.id),
      conflicts: getRateSyncConflicts(hotel.id),
      history,
      syncedCount: 0,
      failedCount: 0,
      conflictCount: 0,
    };
  }

  return dispatchOutboundPush(
    hotel,
    cellsToPush,
    'flowtym_manual',
    'manual_edit',
    actor,
    patch.reason || `Modification manuelle : ${target.currentRateEur}€ → ${nextRate}€`,
    {
      forceOverwrite: patch.forceOverwrite,
      simulateOutcome: patch.simulateOutcome,
    }
  );
}

/**
 * PRÉVISUALISATION AVANT MODIFICATION GROUPÉE (Section 12)
 */
function matchesWeekdayFilter(stayDate: string, weekdays?: number[]): boolean {
  if (!weekdays || weekdays.length === 0 || weekdays.length === 7) return true;
  const dow = new Date(`${stayDate}T00:00:00Z`).getUTCDay();
  return weekdays.includes(dow);
}

export function previewBulkEditInPlanning(
  hotel: Hotel,
  params: {
    startDate: string;
    endDate: string;
    roomTypeCodes: string[];
    ratePlanCodes: RatePlanCode[];
    adjustmentMode: 'fixed' | 'delta_eur' | 'delta_pct' | 'inventory_set';
    value: number;
    weekdays?: number[];
    cascadeDerivedPlans?: boolean;
  }
): {
  directCount: number;
  derivedCount: number;
  avgCurrentRateEur: number;
  avgNewRateEur: number;
  sampleChanges: { label: string; beforeEur: number; afterEur: number }[];
} {
  const allCells = getRatePlanningCells(hotel);
  const cfg = getHotelTariffConfig(hotel);
  const matching = allCells.filter(
    (c) =>
      c.stayDate >= params.startDate &&
      c.stayDate <= params.endDate &&
      matchesWeekdayFilter(c.stayDate, params.weekdays) &&
      params.roomTypeCodes.includes(c.roomTypeCode) &&
      params.ratePlanCodes.includes(c.ratePlanCode)
  );

  let derivedCount = 0;
  let sumBefore = 0;
  let sumAfter = 0;
  const sampleChanges: { label: string; beforeEur: number; afterEur: number }[] = [];

  matching.forEach((cell, idx) => {
    let computedRate = cell.currentRateEur;
    if (params.adjustmentMode === 'fixed') computedRate = params.value;
    else if (params.adjustmentMode === 'delta_eur') computedRate = cell.currentRateEur + params.value;
    else if (params.adjustmentMode === 'delta_pct') {
      computedRate = Math.round(cell.currentRateEur * (1 + params.value / 100));
    }
    computedRate = Math.max(50, Math.round(computedRate));
    sumBefore += cell.currentRateEur;
    sumAfter += computedRate;
    if (idx < 6) {
      sampleChanges.push({
        label: `${cell.roomTypeCode.toUpperCase()} · ${cell.ratePlanCode} · ${cell.stayDate}`,
        beforeEur: params.adjustmentMode === 'inventory_set' ? cell.inventoryAvailable : cell.currentRateEur,
        afterEur: params.adjustmentMode === 'inventory_set' ? Math.max(0, Math.round(params.value)) : computedRate,
      });
    }
    if (params.cascadeDerivedPlans && params.adjustmentMode !== 'inventory_set') {
      const kids = resolveCascadeForRootPlan({
        rootPlanCode: cell.ratePlanCode,
        rootNewRateEur: computedRate,
        config: cfg,
        roomCategoryCode: cell.roomTypeCode,
        stayDate: cell.stayDate,
      }).filter((k) => !params.ratePlanCodes.includes(k.planCode));
      derivedCount += kids.length;
    }
  });

  return {
    directCount: matching.length,
    derivedCount,
    avgCurrentRateEur: matching.length ? Math.round(sumBefore / matching.length) : 0,
    avgNewRateEur: matching.length ? Math.round(sumAfter / matching.length) : 0,
    sampleChanges,
  };
}

/**
 * ACTION : MODIFICATION EN MASSE SUR UNE PLAGE DE DATES (AVEC FILTRE JOURS DE SEMAINE & CASCADE)
 */
export async function applyBulkEditInPlanning(
  hotel: Hotel,
  params: {
    startDate: string;
    endDate: string;
    roomTypeCodes: string[];
    ratePlanCodes: RatePlanCode[];
    adjustmentMode: 'fixed' | 'delta_eur' | 'delta_pct' | 'inventory_set';
    value: number;
    weekdays?: number[];
    inventoryAvailable?: number;
    minStay?: number;
    isClosed?: boolean;
    cascadeDerivedPlans?: boolean;
    reason?: string;
  },
  actor: string = 'Wali Larabi (Head of RM)'
): Promise<PushSyncOutcome> {
  const allCells = ensurePlanningCellsForDateRange(hotel, params.startDate, params.endDate);
  const cfg = getHotelTariffConfig(hotel);
  const now = new Date().toISOString();
  const cellsToPushMap = new Map<string, RateCalendarCell>();
  const cascadeUpdates = new Map<string, number>();

  const firstPass = allCells.map((cell) => {
    const matchDate = cell.stayDate >= params.startDate && cell.stayDate <= params.endDate;
    const matchDow = matchesWeekdayFilter(cell.stayDate, params.weekdays);
    const matchRoom = params.roomTypeCodes.includes(cell.roomTypeCode);
    const matchPlan = params.ratePlanCodes.includes(cell.ratePlanCode);
    if (!matchDate || !matchDow || !matchRoom || !matchPlan) return cell;

    let computedRate = cell.currentRateEur;
    if (params.adjustmentMode === 'fixed') computedRate = params.value;
    else if (params.adjustmentMode === 'delta_eur') computedRate = cell.currentRateEur + params.value;
    else if (params.adjustmentMode === 'delta_pct') {
      computedRate = Math.round(cell.currentRateEur * (1 + params.value / 100));
    }
    computedRate = Math.max(50, Math.round(computedRate));

    const nextInv =
      params.adjustmentMode === 'inventory_set'
        ? Math.max(0, Math.min(cell.totalRoomsInCategory, Math.round(params.value)))
        : params.inventoryAvailable !== undefined
        ? Math.max(0, Math.min(cell.totalRoomsInCategory, Math.round(params.inventoryAvailable)))
        : cell.inventoryAvailable;

    if (params.cascadeDerivedPlans && params.adjustmentMode !== 'inventory_set') {
      resolveCascadeForRootPlan({
        rootPlanCode: cell.ratePlanCode,
        rootNewRateEur: computedRate,
        config: cfg,
        roomCategoryCode: cell.roomTypeCode,
        stayDate: cell.stayDate,
      }).forEach((k) => {
        if (!params.ratePlanCodes.includes(k.planCode)) {
          cascadeUpdates.set(
            buildCellKey(hotel.id, cell.roomTypeCode, k.planCode, cell.stayDate),
            Math.round(k.computedRateEur)
          );
        }
      });
    }

    const next: RateCalendarCell = {
      ...cell,
      previousRateEur: cell.currentRateEur,
      currentRateEur: computedRate,
      flowtymSavedRateEur: computedRate,
      inventoryAvailable: nextInv,
      inventoryLeftForSale: nextInv,
      minStay: params.minStay !== undefined ? params.minStay : cell.minStay,
      isClosed: params.isClosed !== undefined ? params.isClosed : cell.isClosed,
      channelRates: computeChannelRates(computedRate),
      modificationOrigin: 'flowtym_manual',
      isManualOverride: true,
      version: cell.version + 1,
      updatedBy: actor,
      updatedAt: now,
    };
    cellsToPushMap.set(next.cellKey, next);
    return next;
  });

  const updated = firstPass.map((cell) => {
    const cascadeRate = cascadeUpdates.get(cell.cellKey);
    if (cascadeRate === undefined || cellsToPushMap.has(cell.cellKey)) return cell;
    const next: RateCalendarCell = {
      ...cell,
      previousRateEur: cell.currentRateEur,
      currentRateEur: cascadeRate,
      flowtymSavedRateEur: cascadeRate,
      channelRates: computeChannelRates(cascadeRate),
      modificationOrigin: 'flowtym_auto',
      isManualOverride: false,
      version: cell.version + 1,
      updatedBy: actor,
      updatedAt: now,
    };
    cellsToPushMap.set(next.cellKey, next);
    return next;
  });

  const cellsToPush = Array.from(cellsToPushMap.values());
  if (cellsToPush.length === 0) {
    return {
      cells: allCells,
      operations: getRateSyncOperations(hotel.id),
      conflicts: getRateSyncConflicts(hotel.id),
      history: getRateAuditHistory(hotel.id),
      syncedCount: 0,
      failedCount: 0,
      conflictCount: 0,
    };
  }

  saveRatePlanningCells(hotel.id, updated);
  return dispatchOutboundPush(
    hotel,
    cellsToPush,
    'flowtym_manual',
    'bulk_edit',
    actor,
    params.reason ||
      `Modification en masse (${params.startDate} → ${params.endDate}, ${cellsToPush.length} cellules)`
  );
}

/**
 * EXTENSION DYNAMIQUE DE L'HORIZON (90J, 365J, PLAGE PERSONNALISÉE)
 * Génère paresseusement les dates futures manquantes sans écraser les cellules existantes.
 */
export function ensurePlanningCellsForDateRange(
  hotel: Hotel,
  startDateStr: string,
  endDateStr: string
): RateCalendarCell[] {
  const existing = getRatePlanningCells(hotel);
  const cfg = getHotelTariffConfig(hotel);
  const activeCategories = cfg.roomCategories.filter((rc) => rc.isActive && !rc.isArchived);
  const activePlans = cfg.ratePlans.filter((p) => p.status === 'active');

  const existingKeys = new Set(existing.map((c) => c.cellKey));
  const toUtcMs = (dStr: string) => {
    const [y, m, d] = dStr.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const startMs = toUtcMs(startDateStr);
  const endMs = Math.min(toUtcMs(endDateStr), startMs + 370 * 86400000);
  const newCells: RateCalendarCell[] = [];
  const now = new Date().toISOString();

  // Base de référence pour les nouvelles dates
  const baseCellByRoomPlan = new Map<string, RateCalendarCell>();
  existing.forEach((c) => {
    const key = `${c.roomTypeCode}::${c.ratePlanCode}`;
    if (!baseCellByRoomPlan.has(key)) baseCellByRoomPlan.set(key, c);
  });

  for (let ms = startMs; ms <= endMs; ms += 86400000) {
    const dStr = new Date(ms).toISOString().slice(0, 10);
    const dow = new Date(ms).getUTCDay();
    const isWeekend = dow === 5 || dow === 6;

    activeCategories.forEach((cat) => {
      const refCode = resolveReferencePlanCode(cfg, cat.code, dStr);
      const refBase = baseCellByRoomPlan.get(`${cat.code}::${refCode}`);
      const baseRefRate = Math.max(
        90,
        Math.round((refBase?.currentRateEur || (hotel.baseADR || 220) + cat.baseOffsetEur) * (isWeekend ? 1.12 : 1))
      );

      activePlans.forEach((plan) => {
        if (plan.roomCategoryCodes.length > 0 && !plan.roomCategoryCodes.includes(cat.code)) return;
        const cellKey = buildCellKey(hotel.id, cat.code, plan.code, dStr);
        if (existingKeys.has(cellKey)) return;

        const parentRate =
          plan.calculationMode === 'independent'
            ? baseCellByRoomPlan.get(`${cat.code}::${plan.code}`)?.currentRateEur || baseRefRate
            : baseRefRate;
        const planRate = computeInitialPlanRate(plan, parentRate, cfg, cat.code, dStr, isWeekend ? 72 : 52);
        const avail = Math.max(2, Math.round(cat.physicalRooms * (isWeekend ? 0.35 : 0.6)));

        newCells.push({
          cellKey,
          hotelId: hotel.id,
          roomTypeCode: cat.code,
          roomTypeName: cat.name,
          ratePlanCode: plan.code,
          ratePlanName: plan.name,
          stayDate: dStr,
          currentRateEur: planRate,
          previousRateEur: null,
          inventoryAvailable: avail,
          inventoryLeftForSale: avail,
          totalRoomsInCategory: cat.physicalRooms,
          minStay: plan.minStayDefault || 1,
          maxStay: plan.maxStayDefault ?? null,
          cta: false,
          ctd: false,
          isClosed: false,
          channelRates: computeChannelRates(planRate),
          recommendation: null,
          flowtymSavedRateEur: planRate,
          transmittedRateEur: planRate,
          confirmedExternalRateEur: planRate,
          syncStatus: 'synced',
          syncErrorMessage: null,
          lastSyncAt: now,
          lastSyncAckId: `INIT-HORIZON-${dStr}`,
          modificationOrigin: 'flowtym_auto',
          isManualOverride: false,
          version: 1,
          externalVersion: 1,
          lastExternalRateEur: planRate,
          lastExternalUpdatedAt: now,
          lastExternalActor: 'Horizon Planning',
          updatedBy: 'Système Flowtym',
          updatedAt: now,
        });
      });
    });
  }

  if (newCells.length === 0) return existing;
  const merged = [...existing, ...newCells].sort((a, b) => a.stayDate.localeCompare(b.stayDate));
  saveRatePlanningCells(hotel.id, merged);
  return merged;
}

/**
 * DUPLICATION DES TARIFS D'UNE CHAMBRE VERS UNE AUTRE CHAMBRE (OU UN AUTRE PLAN)
 */
export async function duplicateRoomRatesInPlanning(
  hotel: Hotel,
  params: {
    startDate: string;
    endDate: string;
    sourceRoomCode: string;
    targetRoomCodes: string[];
    ratePlanCodes: RatePlanCode[];
    offsetEur?: number;
    copyRestrictions?: boolean;
    actor?: string;
  }
): Promise<PushSyncOutcome> {
  const actor = params.actor || 'Wali Larabi (Head of RM)';
  const allCells = ensurePlanningCellsForDateRange(hotel, params.startDate, params.endDate);
  const srcMap = new Map<string, RateCalendarCell>();
  allCells.forEach((c) => {
    if (
      c.roomTypeCode === params.sourceRoomCode &&
      c.stayDate >= params.startDate &&
      c.stayDate <= params.endDate &&
      params.ratePlanCodes.includes(c.ratePlanCode)
    ) {
      srcMap.set(`${c.ratePlanCode}::${c.stayDate}`, c);
    }
  });

  const now = new Date().toISOString();
  const offset = params.offsetEur || 0;
  const cellsToPush: RateCalendarCell[] = [];
  const updated = allCells.map((cell) => {
    if (
      !params.targetRoomCodes.includes(cell.roomTypeCode) ||
      cell.stayDate < params.startDate ||
      cell.stayDate > params.endDate ||
      !params.ratePlanCodes.includes(cell.ratePlanCode)
    ) {
      return cell;
    }
    const src = srcMap.get(`${cell.ratePlanCode}::${cell.stayDate}`);
    if (!src) return cell;
    const nextRate = Math.max(50, Math.round(src.currentRateEur + offset));
    const next: RateCalendarCell = {
      ...cell,
      previousRateEur: cell.currentRateEur,
      currentRateEur: nextRate,
      flowtymSavedRateEur: nextRate,
      minStay: params.copyRestrictions ? src.minStay : cell.minStay,
      maxStay: params.copyRestrictions ? src.maxStay : cell.maxStay,
      cta: params.copyRestrictions ? src.cta : cell.cta,
      ctd: params.copyRestrictions ? src.ctd : cell.ctd,
      isClosed: params.copyRestrictions ? src.isClosed : cell.isClosed,
      channelRates: computeChannelRates(nextRate),
      modificationOrigin: 'flowtym_manual',
      isManualOverride: true,
      version: cell.version + 1,
      updatedBy: actor,
      updatedAt: now,
    };
    cellsToPush.push(next);
    return next;
  });

  if (cellsToPush.length === 0) {
    return {
      cells: allCells,
      operations: getRateSyncOperations(hotel.id),
      conflicts: getRateSyncConflicts(hotel.id),
      history: getRateAuditHistory(hotel.id),
      syncedCount: 0,
      failedCount: 0,
      conflictCount: 0,
    };
  }
  saveRatePlanningCells(hotel.id, updated);
  return dispatchOutboundPush(
    hotel,
    cellsToPush,
    'flowtym_manual',
    'bulk_edit',
    actor,
    `Duplication chambre ${params.sourceRoomCode.toUpperCase()} → ${params.targetRoomCodes.join(', ').toUpperCase()} (${offset >= 0 ? '+' : ''}${offset}€)`
  );
}

/**
 * ACTION SECTION 12 : COPIER UNE PÉRIODE / DUPLIQUER SEMAINE OU MOIS
 */
export async function copyRatesOverPeriod(
  hotel: Hotel,
  params: {
    sourceStartDate: string;
    sourceEndDate: string;
    targetStartDate: string;
    roomTypeCodes: string[];
    ratePlanCodes: RatePlanCode[];
    copyRestrictions?: boolean;
    actor?: string;
  }
): Promise<PushSyncOutcome> {
  const actor = params.actor || 'Wali Larabi (Head of RM)';
  const allCells = getRatePlanningCells(hotel);
  const toUtcMs = (dStr: string) => {
    const [y, m, d] = dStr.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const offsetDays = Math.round(
    (toUtcMs(params.targetStartDate) - toUtcMs(params.sourceStartDate)) / 86400000
  );
  const addDaysStr = (dStr: string, delta: number) =>
    new Date(toUtcMs(dStr) + delta * 86400000).toISOString().slice(0, 10);

  const sourceMap = new Map<string, RateCalendarCell>();
  allCells.forEach((c) => {
    if (
      c.stayDate >= params.sourceStartDate &&
      c.stayDate <= params.sourceEndDate &&
      params.roomTypeCodes.includes(c.roomTypeCode) &&
      params.ratePlanCodes.includes(c.ratePlanCode)
    ) {
      const targetDate = addDaysStr(c.stayDate, offsetDays);
      sourceMap.set(buildCellKey(hotel.id, c.roomTypeCode, c.ratePlanCode, targetDate), c);
    }
  });

  const now = new Date().toISOString();
  const cellsToPush: RateCalendarCell[] = [];
  const updated = allCells.map((cell) => {
    const src = sourceMap.get(cell.cellKey);
    if (!src) return cell;
    const next: RateCalendarCell = {
      ...cell,
      previousRateEur: cell.currentRateEur,
      currentRateEur: src.currentRateEur,
      flowtymSavedRateEur: src.currentRateEur,
      minStay: params.copyRestrictions ? src.minStay : cell.minStay,
      maxStay: params.copyRestrictions ? src.maxStay : cell.maxStay,
      cta: params.copyRestrictions ? src.cta : cell.cta,
      ctd: params.copyRestrictions ? src.ctd : cell.ctd,
      isClosed: params.copyRestrictions ? src.isClosed : cell.isClosed,
      channelRates: computeChannelRates(src.currentRateEur),
      modificationOrigin: 'flowtym_manual',
      isManualOverride: true,
      version: cell.version + 1,
      updatedBy: actor,
      updatedAt: now,
    };
    cellsToPush.push(next);
    return next;
  });

  if (cellsToPush.length === 0) {
    return {
      cells: allCells,
      operations: getRateSyncOperations(hotel.id),
      conflicts: getRateSyncConflicts(hotel.id),
      history: getRateAuditHistory(hotel.id),
      syncedCount: 0,
      failedCount: 0,
      conflictCount: 0,
    };
  }

  saveRatePlanningCells(hotel.id, updated);
  return dispatchOutboundPush(
    hotel,
    cellsToPush,
    'flowtym_manual',
    'bulk_edit',
    actor,
    `Duplication période (${params.sourceStartDate} → ${params.sourceEndDate} vers ${params.targetStartDate}, ${cellsToPush.length} cellules)`
  );
}

/**
 * ACTION SECTION 12 : RECALCULER TOUS LES PLANS DÉRIVÉS SELON LES RÈGLES ACTIVES
 * Ne modifie jamais les plans indépendants !
 */
export async function recalculateDerivedPlansInPlanning(
  hotel: Hotel,
  params?: {
    startDate?: string;
    endDate?: string;
    roomTypeCodes?: string[];
    actor?: string;
  }
): Promise<PushSyncOutcome> {
  const actor = params?.actor || 'Wali Larabi (Head of RM)';
  const allCells = getRatePlanningCells(hotel);
  const cfg = getHotelTariffConfig(hotel);
  const cellByKey = new Map(allCells.map((c) => [c.cellKey, c]));

  const targetDates = Array.from(
    new Set(
      allCells
        .filter((c) => {
          if (params?.startDate && c.stayDate < params.startDate) return false;
          if (params?.endDate && c.stayDate > params.endDate) return false;
          return true;
        })
        .map((c) => c.stayDate)
    )
  );
  const targetCats =
    params?.roomTypeCodes && params.roomTypeCodes.length > 0
      ? params.roomTypeCodes
      : cfg.roomCategories.filter((rc) => rc.isActive && !rc.isArchived).map((rc) => rc.code);

  const computedUpdates = new Map<string, number>();

  targetDates.forEach((dStr) => {
    targetCats.forEach((catCode) => {
      const refCode = resolveReferencePlanCode(cfg, catCode, dStr);
      const refCell = cellByKey.get(buildCellKey(hotel.id, catCode, refCode, dStr));
      if (!refCell) return;
      const cascade = resolveCascadeForRootPlan({
        rootPlanCode: refCode,
        rootNewRateEur: refCell.currentRateEur,
        config: cfg,
        roomCategoryCode: catCode,
        stayDate: dStr,
      });
      cascade.forEach((item) => {
        const key = buildCellKey(hotel.id, catCode, item.planCode, dStr);
        const existing = cellByKey.get(key);
        const nextVal = Math.round(item.computedRateEur);
        if (existing && existing.currentRateEur !== nextVal) {
          computedUpdates.set(key, nextVal);
        }
      });
    });
  });

  if (computedUpdates.size === 0) {
    return {
      cells: allCells,
      operations: getRateSyncOperations(hotel.id),
      conflicts: getRateSyncConflicts(hotel.id),
      history: getRateAuditHistory(hotel.id),
      syncedCount: 0,
      failedCount: 0,
      conflictCount: 0,
    };
  }

  const now = new Date().toISOString();
  const cellsToPush: RateCalendarCell[] = [];
  const updated = allCells.map((cell) => {
    const newVal = computedUpdates.get(cell.cellKey);
    if (newVal === undefined) return cell;
    const next: RateCalendarCell = {
      ...cell,
      previousRateEur: cell.currentRateEur,
      currentRateEur: newVal,
      flowtymSavedRateEur: newVal,
      channelRates: computeChannelRates(newVal),
      modificationOrigin: 'flowtym_auto',
      isManualOverride: false,
      version: cell.version + 1,
      updatedBy: actor,
      updatedAt: now,
    };
    cellsToPush.push(next);
    return next;
  });

  saveRatePlanningCells(hotel.id, updated);
  return dispatchOutboundPush(
    hotel,
    cellsToPush,
    'flowtym_auto',
    'config_recalculation',
    actor,
    `Recalcul automatique des plans dérivés (${cellsToPush.length} cellules recalculées, plans indépendants préservés)`
  );
}

/**
 * ACTION SECTION 12 : APPLIQUER UNE RÈGLE DE RESTRICTION SUR LE PLANNING & PUSH 2-WAY
 */
export async function applyRestrictionRuleToPlanning(
  hotel: Hotel,
  rule: RateRestrictionRule,
  actor: string = 'Wali Larabi (Head of RM)'
): Promise<PushSyncOutcome> {
  const allCells = getRatePlanningCells(hotel);
  const now = new Date().toISOString();
  const cellsToPush: RateCalendarCell[] = [];

  const updated = allCells.map((cell) => {
    const matchDate = cell.stayDate >= rule.dateFrom && cell.stayDate <= rule.dateTo;
    const matchCat =
      rule.roomCategoryCodes.length === 0 || rule.roomCategoryCodes.includes(cell.roomTypeCode);
    const matchPlan =
      rule.ratePlanCodes.length === 0 || rule.ratePlanCodes.includes(cell.ratePlanCode);
    if (!matchDate || !matchCat || !matchPlan) return cell;

    const next: RateCalendarCell = {
      ...cell,
      minStay: rule.minStay ?? cell.minStay,
      maxStay: rule.maxStay !== undefined ? rule.maxStay : cell.maxStay,
      cta: rule.cta,
      ctd: rule.ctd,
      isClosed: rule.stopSell,
      modificationOrigin: 'flowtym_manual',
      version: cell.version + 1,
      updatedBy: actor,
      updatedAt: now,
    };
    cellsToPush.push(next);
    return next;
  });

  if (cellsToPush.length === 0) {
    return {
      cells: allCells,
      operations: getRateSyncOperations(hotel.id),
      conflicts: getRateSyncConflicts(hotel.id),
      history: getRateAuditHistory(hotel.id),
      syncedCount: 0,
      failedCount: 0,
      conflictCount: 0,
    };
  }

  saveRatePlanningCells(hotel.id, updated);
  return dispatchOutboundPush(
    hotel,
    cellsToPush,
    'flowtym_manual',
    'restriction_applied',
    actor,
    `Application restriction « ${rule.name} » (${rule.dateFrom} → ${rule.dateTo}, MinStay ${rule.minStay})`
  );
}

/**
 * SENS 2 : RÉCUPÉRATION BIDIRECTIONNELLE DEPUIS PMS / CHANNEL MANAGER (Anti-boucle strict)
 */
export async function pullExternalUpdatesInPlanning(hotel: Hotel): Promise<{
  cells: RateCalendarCell[];
  importedCount: number;
  history: RateAuditHistoryEntry[];
  operations: RateSyncOperation[];
  pulledAt: string;
}> {
  const connectivity = getHotelConnectivityConfig(hotel);
  const processedKeys = new Set<string>(
    safeRead<string[]>(`${PROCESSED_INBOUND_KEY_PREFIX}${hotel.id}`, [])
  );

  const resp = await fetch(resolveApiUrl('/api/rate-planning/pull'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hotelId: hotel.id,
      sinceTimestamp: connectivity.lastPullAt,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Erreur HTTP ${resp.status} lors du pull externe.`);
  }

  const data = await resp.json();
  const inboundEvents: any[] = Array.isArray(data.inboundEvents) ? data.inboundEvents : [];
  const externalCells: any[] = Array.isArray(data.externalCells) ? data.externalCells : [];
  const pulledAt = data.pulledAt || new Date().toISOString();

  const unseenEvents = inboundEvents.filter(
    (ev) =>
      (ev.origin === 'pms' || ev.origin === 'channel_manager') &&
      !processedKeys.has(ev.idempotencyKey)
  );

  const eventIdsToAck: string[] = [];
  const newOps: RateSyncOperation[] = [];
  const newHistory: RateAuditHistoryEntry[] = [];
  let allCells = getRatePlanningCells(hotel);
  let importedCount = 0;

  if (unseenEvents.length > 0 || externalCells.length > 0) {
    const extCellByKey = new Map(externalCells.map((ec: any) => [ec.cellKey, ec]));
    const evtByKey = new Map<string, any>();
    unseenEvents.forEach((ev) => {
      evtByKey.set(ev.cellKey, ev);
      processedKeys.add(ev.idempotencyKey);
      eventIdsToAck.push(ev.eventId);
    });

    allCells = allCells.map((cell) => {
      const evt = evtByKey.get(cell.cellKey);
      const extSnap = extCellByKey.get(cell.cellKey);

      const candidateRate = evt?.newRateEur ?? extSnap?.rateEur;
      const candidateOrigin: RateModificationOrigin | undefined = evt?.origin ?? extSnap?.origin;
      const candidateExtVersion = evt?.externalVersion ?? extSnap?.externalVersion ?? cell.externalVersion;

      if (
        candidateRate === undefined ||
        (candidateOrigin !== 'pms' && candidateOrigin !== 'channel_manager')
      ) {
        return cell;
      }

      if (!evt && candidateExtVersion <= cell.externalVersion) {
        return cell;
      }

      importedCount++;
      const actorLabel = evt?.actor || extSnap?.actor || `Connecteur ${candidateOrigin}`;
      const ts = evt?.receivedAt || extSnap?.updatedAt || pulledAt;
      const opId = `op-in-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      newOps.push({
        id: opId,
        hotelId: hotel.id,
        cellKey: cell.cellKey,
        stayDate: cell.stayDate,
        roomTypeCode: cell.roomTypeCode,
        ratePlanCode: cell.ratePlanCode,
        direction: evt ? 'webhook_inbound' : 'inbound_pull',
        targetSystem: candidateOrigin,
        origin: candidateOrigin,
        idempotencyKey: evt?.idempotencyKey || `pull-${cell.cellKey}-v${candidateExtVersion}`,
        previousRateEur: cell.currentRateEur,
        newRateEur: candidateRate,
        status: 'synced',
        externalAckId: evt?.eventId || extSnap?.lastAckId || null,
        errorMessage: null,
        attempts: 1,
        createdAt: ts,
        confirmedAt: ts,
      });

      newHistory.push({
        id: `hist-in-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        hotelId: hotel.id,
        cellKey: cell.cellKey,
        stayDate: cell.stayDate,
        roomTypeCode: cell.roomTypeCode,
        ratePlanCode: cell.ratePlanCode,
        actionType: 'inbound_external_sync',
        previousRateEur: cell.currentRateEur,
        newRateEur: candidateRate,
        origin: candidateOrigin,
        syncStatus: 'synced',
        syncOperationId: opId,
        actor: actorLabel,
        reason: `Import bidirectionnel depuis ${
          candidateOrigin === 'pms' ? 'PMS' : 'Channel Manager'
        } (${cell.currentRateEur}€ → ${candidateRate}€, anti-boucle vérifié)`,
        createdAt: ts,
      });

      return {
        ...cell,
        previousRateEur: cell.currentRateEur,
        currentRateEur: candidateRate,
        flowtymSavedRateEur: candidateRate,
        transmittedRateEur: candidateRate,
        confirmedExternalRateEur: candidateRate,
        pmsReturnedRateEur:
          candidateOrigin === 'pms' ? candidateRate : cell.pmsReturnedRateEur ?? null,
        cmReturnedRateEur:
          candidateOrigin === 'channel_manager' ? candidateRate : cell.cmReturnedRateEur ?? null,
        pmsUpdatedAt: candidateOrigin === 'pms' ? ts : cell.pmsUpdatedAt ?? null,
        cmUpdatedAt: candidateOrigin === 'channel_manager' ? ts : cell.cmUpdatedAt ?? null,
        channelRates: computeChannelRates(candidateRate),
        minStay: evt?.minStay ?? extSnap?.minStay ?? cell.minStay,
        isClosed: evt?.isClosed ?? extSnap?.isClosed ?? cell.isClosed,
        syncStatus: 'synced' as RateSyncStatus,
        syncErrorMessage: null,
        lastSyncAt: ts,
        lastSyncAckId: evt?.eventId || cell.lastSyncAckId,
        modificationOrigin: candidateOrigin,
        isManualOverride: false,
        version: cell.version + 1,
        externalVersion: candidateExtVersion,
        lastExternalRateEur: candidateRate,
        lastExternalUpdatedAt: ts,
        lastExternalActor: actorLabel,
        updatedBy: actorLabel,
        updatedAt: ts,
      };
    });

    if (importedCount > 0) {
      saveRatePlanningCells(hotel.id, allCells);
      safeWrite(`${PROCESSED_INBOUND_KEY_PREFIX}${hotel.id}`, Array.from(processedKeys).slice(-500));
      void syncRatePlanningCellsToSupabase(
        allCells.filter((c) => newOps.some((op) => op.cellKey === c.cellKey))
      );
      appendLocalSyncLog(hotel.id, {
        id: `slog-in-${Date.now()}`,
        hotelId: hotel.id,
        connectorId: 'inbound_pull',
        providerId: 'dedge',
        providerName: 'Synchronisation Entrante PMS / CM',
        family: 'channel_manager',
        operationType: 'pull_rates',
        direction: 'inbound',
        status: 'synced',
        executionMode: 'sandbox_simulation',
        cellsAffected: importedCount,
        traceabilityId: `PULL-${Date.now()}`,
        externalAckId: newOps[0]?.externalAckId || null,
        durationMs: 95,
        actor: 'Pull Bidirectionnel',
        message: `${importedCount} mise(s) à jour externe(s) intégrée(s) avec protection anti-boucle.`,
        createdAt: pulledAt,
      });
      if (eventIdsToAck.length > 0) {
        void fetch(resolveApiUrl('/api/rate-planning/ack-inbound'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hotelId: hotel.id, eventIds: eventIdsToAck }),
        }).catch(() => {});
      }
    }
  }

  const operations = newOps.length ? appendSyncOperations(hotel.id, newOps) : getRateSyncOperations(hotel.id);
  const history = newHistory.length ? appendAuditHistory(hotel.id, newHistory) : getRateAuditHistory(hotel.id);

  const rms = getHotelRMSConfig(hotel);
  const conn = rms.connectivity || buildDefaultConnectivityConfig(hotel.id);
  saveHotelRMSConfig(hotel.id, {
    ...rms,
    connectivity: {
      ...conn,
      lastPullAt: pulledAt,
      connectionHealth: 'connected',
    },
  });

  emitPlanningUpdate(hotel.id);
  return { cells: allCells, importedCount, history, operations, pulledAt };
}

/**
 * RÉSOLUTION EXPLICITE DE CONFLIT CONCURRENT
 */
export async function resolveRateConflictInPlanning(
  hotel: Hotel,
  conflictId: string,
  choice: 'keep_flowtym' | 'adopt_external',
  actor: string = 'Wali Larabi (Head of RM)'
): Promise<{
  cells: RateCalendarCell[];
  conflicts: RateSyncConflict[];
  history: RateAuditHistoryEntry[];
}> {
  const conflicts = getRateSyncConflicts(hotel.id);
  const conflict = conflicts.find((c) => c.id === conflictId);
  if (!conflict) {
    throw new Error('Conflit introuvable.');
  }

  const now = new Date().toISOString();
  const updatedConflicts = conflicts.map((c) =>
    c.id === conflictId
      ? {
          ...c,
          status: 'resolved' as const,
          resolutionChoice: choice,
          resolvedRateEur: choice === 'keep_flowtym' ? c.flowtymRateEur : c.externalRateEur,
          resolvedAt: now,
          resolvedBy: actor,
        }
      : c
  );
  safeWrite(`${CONFLICTS_KEY_PREFIX}${hotel.id}`, updatedConflicts);
  const resolvedConf = updatedConflicts.find((c) => c.id === conflictId);
  if (resolvedConf) void syncRateConflictToSupabase(resolvedConf);

  if (choice === 'adopt_external') {
    const updatedCells = getRatePlanningCells(hotel).map((cell) => {
      if (cell.cellKey !== conflict.cellKey) return cell;
      return {
        ...cell,
        previousRateEur: cell.currentRateEur,
        currentRateEur: conflict.externalRateEur,
        flowtymSavedRateEur: conflict.externalRateEur,
        transmittedRateEur: conflict.externalRateEur,
        confirmedExternalRateEur: conflict.externalRateEur,
        channelRates: computeChannelRates(conflict.externalRateEur),
        syncStatus: 'synced' as RateSyncStatus,
        syncErrorMessage: null,
        modificationOrigin: conflict.externalSource,
        externalVersion: conflict.externalVersion,
        version: cell.version + 1,
        updatedBy: actor,
        updatedAt: now,
      };
    });
    saveRatePlanningCells(hotel.id, updatedCells);
    const history = appendAuditHistory(hotel.id, [
      {
        id: `hist-conf-${Date.now()}`,
        hotelId: hotel.id,
        cellKey: conflict.cellKey,
        stayDate: conflict.stayDate,
        roomTypeCode: conflict.roomTypeCode,
        ratePlanCode: conflict.ratePlanCode,
        actionType: 'conflict_resolved',
        previousRateEur: conflict.flowtymRateEur,
        newRateEur: conflict.externalRateEur,
        origin: conflict.externalSource,
        syncStatus: 'synced',
        actor,
        reason: `Conflit résolu : tarif externe (${conflict.externalSource} : ${conflict.externalRateEur}€) adopté sans réémission.`,
        createdAt: now,
      },
    ]);
    return { cells: updatedCells, conflicts: updatedConflicts, history };
  }

  const updatedCells = getRatePlanningCells(hotel).map((cell) => {
    if (cell.cellKey !== conflict.cellKey) return cell;
    return {
      ...cell,
      currentRateEur: conflict.flowtymRateEur,
      flowtymSavedRateEur: conflict.flowtymRateEur,
      channelRates: computeChannelRates(conflict.flowtymRateEur),
      externalVersion: conflict.externalVersion,
      version: cell.version + 1,
      updatedBy: actor,
      updatedAt: now,
    };
  });
  saveRatePlanningCells(hotel.id, updatedCells);
  const targetCell = updatedCells.find((c) => c.cellKey === conflict.cellKey)!;
  const res = await dispatchOutboundPush(
    hotel,
    [targetCell],
    'flowtym_manual',
    'conflict_resolved',
    actor,
    `Conflit résolu : priorité donnée à FLOWTYM (${conflict.flowtymRateEur}€ écrasant ${conflict.externalRateEur}€)`,
    { forceOverwrite: true }
  );

  return {
    cells: res.cells,
    conflicts: updatedConflicts,
    history: res.history,
  };
}

/**
 * ANNULATION D'UNE MODIFICATION SANS EFFACER L'HISTORIQUE IMMUTABLE
 */
export async function revertHistoryEntryInPlanning(
  hotel: Hotel,
  historyId: string,
  actor: string = 'Wali Larabi (Head of RM)'
): Promise<PushSyncOutcome> {
  const hist = getRateAuditHistory(hotel.id);
  const entry = hist.find((h) => h.id === historyId);
  if (!entry || entry.previousRateEur === null) {
    throw new Error('Impossible d’annuler cette opération (valeur précédente absente).');
  }

  const allCells = getRatePlanningCells(hotel);
  const target = allCells.find((c) => c.cellKey === entry.cellKey);
  if (!target) throw new Error('Cellule cible introuvable.');

  const revertRate = entry.previousRateEur;
  const now = new Date().toISOString();
  let updatedTarget!: RateCalendarCell;

  const updated = allCells.map((c) => {
    if (c.cellKey !== entry.cellKey) return c;
    updatedTarget = {
      ...c,
      previousRateEur: c.currentRateEur,
      currentRateEur: revertRate,
      flowtymSavedRateEur: revertRate,
      channelRates: computeChannelRates(revertRate),
      modificationOrigin: 'flowtym_manual',
      isManualOverride: true,
      version: c.version + 1,
      updatedBy: actor,
      updatedAt: now,
    };
    return updatedTarget;
  });

  saveRatePlanningCells(hotel.id, updated);
  return dispatchOutboundPush(
    hotel,
    [updatedTarget],
    'flowtym_manual',
    'reverted',
    actor,
    `Annulation modification (${target.currentRateEur}€ → retour à ${revertRate}€)`,
    { revertedFromHistoryId: historyId, forceOverwrite: true }
  );
}

/**
 * RELANCE D'UNE SYNCHRONISATION EN ÉCHEC / REJETÉE
 */
export async function retryFailedCellSync(
  hotel: Hotel,
  cellKey: string,
  actor: string = 'Wali Larabi (Head of RM)'
): Promise<PushSyncOutcome> {
  const allCells = getRatePlanningCells(hotel);
  const target = allCells.find((c) => c.cellKey === cellKey);
  if (!target) throw new Error('Cellule introuvable.');
  return dispatchOutboundPush(
    hotel,
    [target],
    'flowtym_manual',
    'sync_retry',
    actor,
    `Nouvelle tentative de synchronisation (${target.currentRateEur}€)`
  );
}

/**
 * DÉCLENCHEUR QA RÉEL : SIMULE UNE MODIFICATION DIRECTE DANS LE PMS OU LE CHANNEL MANAGER
 */
export async function simulateExternalSystemChange(params: {
  hotelId: string;
  stayDate: string;
  roomTypeCode: string;
  ratePlanCode: RatePlanCode;
  newRateEur: number;
  source: 'pms' | 'channel_manager';
  actor?: string;
}): Promise<{ success: boolean; message: string }> {
  const resp = await fetch(resolveApiUrl('/api/webhooks/external-ari'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hotelId: params.hotelId,
      cellKey: buildCellKey(params.hotelId, params.roomTypeCode, params.ratePlanCode, params.stayDate),
      stayDate: params.stayDate,
      roomTypeCode: params.roomTypeCode,
      ratePlanCode: params.ratePlanCode,
      newRateEur: params.newRateEur,
      source: params.source,
      actor:
        params.actor ||
        (params.source === 'pms' ? 'Réception / Opérateur Opera PMS' : 'Extranet D-EDGE CRS'),
    }),
  });
  return resp.json();
}

/**
 * SYNCHRONISATION AUTOMATIQUE LORSQU'UNE DÉCISION EST PRISE DEPUIS LE MOTEUR RM
 */
export async function syncEngineDecisionToPlanning(
  hotel: Hotel,
  stayDate: string,
  appliedBarEur: number,
  action: 'accepted' | 'modified' | 'rejected',
  minStay: number = 1,
  actor: string = 'Wali Larabi (Head of RM)'
): Promise<void> {
  const cfg = getHotelTariffConfig(hotel);
  const firstCatCode = cfg.roomCategories.find((rc) => rc.isActive && !rc.isArchived)?.code || 'classique';
  const activeRefPlanCode = resolveReferencePlanCode(cfg, firstCatCode, stayDate);
  const cells = getRatePlanningCells(hotel);
  const targetKey = buildCellKey(hotel.id, firstCatCode, activeRefPlanCode, stayDate);
  const targetCell = cells.find((c) => c.cellKey === targetKey);
  if (!targetCell) return;

  if (action === 'rejected') {
    rejectRecommendationInPlanning(hotel, targetKey, 'Refusé depuis le Moteur de Recommandations RM', actor);
    return;
  }

  if (action === 'accepted' && targetCell.recommendation?.status === 'pending') {
    await acceptRecommendationInPlanning(hotel, targetKey, {
      actor,
      cascadeDerivedPlans: true,
    });
    return;
  }

  await updateCellManuallyInPlanning(
    hotel,
    targetKey,
    {
      newRateEur: appliedBarEur,
      minStay,
      reason: 'Décision validée depuis le Moteur de Recommandations RM',
      cascadeDerivedPlans: true,
    },
    actor
  );
}
