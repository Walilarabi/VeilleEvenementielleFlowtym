/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM RMS — MOTEUR CENTRALISÉ DE CALCULS & BUS RÉACTIF INTER-MODULES
 * Source de vérité unique pour :
 * - Taux d'occupation, ADR, RevPAR, Revenu Net, Reste à vendre
 * - Médiane CompSet (exclusion stricte des complets/sold-out)
 * - Série de prévision dynamique 60/90 jours par hôtel & événements
 * - Mix canaux, bilan mensuel propriétaire & agrégats exécutifs Flowboard
 * - Propagation réactive inter-modules (RMS_DATA_UPDATED_EVENT)
 */

import { EventItem, Hotel } from '../types';
import { getHotelRMSConfig, HotelRMSConfig } from './rmsSettingsService';
import {
  getRateIntelligenceRecords,
  DailyRateIntelligence,
  getTodayDateStr,
} from './rateIntelligenceService';
import { getRatePlanningCells } from './ratePlanningSyncService';
import { getHistoricalDailyRecords } from './historicalDataService';
import { getDEdgeInventoryForDate } from './dedgeConnectivityService';

export const RMS_DATA_UPDATED_EVENT = 'flowtym:rms-data-updated';

export type RMSUpdateDomain =
  | 'inventory'
  | 'reservations'
  | 'pricing'
  | 'planning'
  | 'config'
  | 'compset'
  | 'events'
  | 'parity'
  | 'import'
  | 'supabase_sync';

export interface RMSUpdatePayload {
  hotelId: string;
  domain: RMSUpdateDomain;
  reason?: string;
  timestamp: string;
}

export function emitRMSUpdate(hotelId: string, domain: RMSUpdateDomain, reason?: string): void {
  if (typeof window === 'undefined') return;
  const detail: RMSUpdatePayload = {
    hotelId,
    domain,
    reason,
    timestamp: new Date().toISOString(),
  };
  window.dispatchEvent(new CustomEvent<RMSUpdatePayload>(RMS_DATA_UPDATED_EVENT, { detail }));
}

export function subscribeRMSUpdates(handler: (payload: RMSUpdatePayload) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (ev: Event) => {
    const custom = ev as CustomEvent<RMSUpdatePayload>;
    if (custom?.detail) handler(custom.detail);
  };
  window.addEventListener(RMS_DATA_UPDATED_EVENT, listener);
  return () => window.removeEventListener(RMS_DATA_UPDATED_EVENT, listener);
}

// -----------------------------------------------------------------------------
// FORMULES CANONIQUES UNIFIÉES (ADR, RevPAR, Occupation, CompSet Médiane)
// -----------------------------------------------------------------------------

export function computeOccupancyPct(roomsSold: number, capacity: number): number {
  if (!Number.isFinite(capacity) || capacity <= 0) return 0;
  return Math.round(Math.min(100, Math.max(0, (roomsSold / capacity) * 100)) * 10) / 10;
}

export function computeRevPAR(adr: number, occupancyPct: number): number {
  if (!Number.isFinite(adr) || !Number.isFinite(occupancyPct)) return 0;
  return Math.round(adr * (occupancyPct / 100) * 10) / 10;
}

export function computeMedianWithoutSoldOut(rates: Array<number | null | undefined>): number {
  const valid = rates.filter((r): r is number => typeof r === 'number' && Number.isFinite(r) && r > 0).sort((a, b) => a - b);
  if (valid.length === 0) return 0;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 1 ? valid[mid] : Math.round((valid[mid - 1] + valid[mid]) / 2);
}

export function resolveHotelCapacity(hotel: Hotel, config?: HotelRMSConfig): number {
  const cfg = config || getHotelRMSConfig(hotel);
  const typoRooms = cfg.roomTypologies?.reduce((sum, r) => sum + (Number(r.totalRooms) || 0), 0) || 0;
  return typoRooms > 0 ? typoRooms : Math.max(1, hotel.roomCount || 45);
}

export interface UnifiedDailyMetricRow {
  dateStr: string;
  labelShort: string;
  dayName: string;
  capacity: number;
  roomsSold: number;
  roomsAvailable: number;
  occupancyPct: number;
  occupancyN1Pct: number;
  adrEur: number;
  suggestedBarEur: number;
  plannedBarEur: number;
  revparEur: number;
  revenueEur: number;
  pickup24h: number;
  pickup7d: number;
  compsetMedianEur: number;
  soldOutCompetitors: number;
  totalCompetitors: number;
  demandLevel: 'faible' | 'normal' | 'eleve' | 'exceptionnel';
  eventTitle: string | null;
  rmScore: number;
  minStay: number;
  isHistorical: boolean;
}

export interface UnifiedHotelPerformanceSummary {
  hotelId: string;
  hotelName: string;
  city: string;
  capacity: number;
  floorRateEur: number;
  ceilingRateEur: number;
  baseAdrEur: number;
  horizonDays: number;
  avgOccupancyPct: number;
  avgOccupancyN1Pct: number;
  avgAdrEur: number;
  avgRevparEur: number;
  totalProjectedRevenueEur: number;
  totalRoomsSold: number;
  totalPickup7d: number;
  peakDate: UnifiedDailyMetricRow | null;
  highDemandDaysCount: number;
  pendingDecisionsCount: number;
  syncedPlanningRatePct: number;
  channelMix: Array<{
    channel: string;
    roomNights: number;
    sharePercent: number;
    adrNetEur: number;
    commissionPct: number;
    revenueEur: number;
    netRevenueEur: number;
  }>;
  dailyRows: UnifiedDailyMetricRow[];
}

export function buildUnifiedHotelPerformance(
  hotel: Hotel,
  events: EventItem[] = [],
  horizonDays: number = 30
): UnifiedHotelPerformanceSummary {
  const config = getHotelRMSConfig(hotel);
  const capacity = resolveHotelCapacity(hotel, config);
  const baseAdr = Math.max(60, hotel.baseADR || 180);
  const floorRate = Math.max(50, config.rmRules?.barFloorEur || Math.round(baseAdr * 0.72));
  const ceilingRate = Math.max(floorRate + 30, config.rmRules?.barCeilingEur || Math.round(baseAdr * 2.2));

  // Charger les cellules du Planning Tarifaire pour aligner le BAR réel
  const planningCells = getRatePlanningCells(hotel);
  const barPlanByDate = new Map<string, { rate: number; minStay: number; synced: boolean }>();
  for (const c of planningCells) {
    if (c.ratePlanCode === 'BAR' && (c.roomTypeCode === 'classique' || !barPlanByDate.has(c.stayDate))) {
      barPlanByDate.set(c.stayDate, {
        rate: c.currentRateEur,
        minStay: c.minStay,
        synced: c.syncStatus === 'synced',
      });
    }
  }

  // Charger les données d'intelligence tarifaire (OTB, Pickup, Lighthouse)
  const intelRecords = getRateIntelligenceRecords(hotel.id);
  const intelByDate = new Map<string, DailyRateIntelligence>();
  for (const r of intelRecords) {
    intelByDate.set(r.dateStr, r);
  }

  // Charger l'historique N-1 importé/calculé
  const histRecords = getHistoricalDailyRecords(hotel.id);
  const histByMonthDay = new Map<string, { occ: number; adr: number }>();
  for (const h of histRecords) {
    const md = h.dateStr.slice(5); // MM-DD
    if (!histByMonthDay.has(md)) {
      histByMonthDay.set(md, { occ: h.occupancyPercent, adr: h.adrNetEur });
    }
  }

  // Indexer les événements pertinents pour cet hôtel
  const eventsByDate = new Map<string, EventItem[]>();
  for (const ev of events) {
    if (!ev.startDate || !ev.endDate) continue;
    const start = new Date(`${ev.startDate}T00:00:00Z`);
    const end = new Date(`${ev.endDate}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      const arr = eventsByDate.get(ds) || [];
      arr.push(ev);
      eventsByDate.set(ds, arr);
    }
  }

  const todayStr = getTodayDateStr();
  const startRef = new Date(`${todayStr}T00:00:00Z`);
  const dailyRows: UnifiedDailyMetricRow[] = [];
  let syncedCount = 0;

  for (let i = 0; i < horizonDays; i++) {
    const cur = new Date(startRef);
    cur.setUTCDate(startRef.getUTCDate() + i);
    const dateStr = cur.toISOString().slice(0, 10);
    const md = dateStr.slice(5);
    const dow = cur.getUTCDay();
    const isWeekend = dow === 5 || dow === 6;

    const intel = intelByDate.get(dateStr);
    const plan = barPlanByDate.get(dateStr);
    const dedge = getDEdgeInventoryForDate(hotel.id, dateStr, capacity, baseAdr);
    const dayEvs = eventsByDate.get(dateStr) || [];
    const topEvent = dayEvs.sort((a, b) => (b.scoreBreakdown?.finalRMScore || 0) - (a.scoreBreakdown?.finalRMScore || 0))[0];
    const rmScore = topEvent?.scoreBreakdown?.finalRMScore || intel?.rmScore || 0;

    // Capacité & Occupation réelle unifiée
    const roomsSoldRaw = intel?.dedgePickup?.roomsSoldOtb ?? dedge.roomsSold ?? Math.round(capacity * 0.72);
    const roomsSold = Math.min(capacity, Math.max(0, roomsSoldRaw));
    const roomsAvailable = Math.max(0, capacity - roomsSold);
    const occupancyPct = computeOccupancyPct(roomsSold, capacity);

    const n1 = histByMonthDay.get(md);
    const occupancyN1Pct = n1
      ? Math.round(n1.occ * 10) / 10
      : Math.round(Math.max(42, Math.min(98, occupancyPct - (rmScore >= 70 ? 6 : 2))) * 10) / 10;

    // Tarif unifié (Planning BAR > Rate Intelligence > Base ADR modulée)
    const suggestedBarEur = Math.min(
      ceilingRate,
      Math.max(
        floorRate,
        Math.round(
          intel?.suggestedBarEur ??
            baseAdr * (rmScore >= 75 ? 1.32 : rmScore >= 55 ? 1.18 : isWeekend ? 1.08 : 0.98)
        )
      )
    );
    const plannedBarEur = plan?.rate ?? intel?.currentBarEur ?? suggestedBarEur;
    const adrEur = Math.round(
      intel?.dedgeReservations?.adrNetEur ||
        (plannedBarEur * 0.94)
    );
    const revparEur = computeRevPAR(adrEur, occupancyPct);
    const revenueEur = Math.round(roomsSold * adrEur);

    if (plan?.synced) syncedCount += 1;

    const compMedian = intel?.lighthouse?.compsetMedianEur || Math.round(plannedBarEur * 0.97);
    const soldOutCompetitors = intel?.lighthouse?.soldOutCount || 0;
    const totalCompetitors = Math.max(
      1,
      config.compSet?.length || intel?.lighthouse?.totalCompsetSize || intel?.lighthouse?.competitors?.length || 5
    );

    const demandLevel: UnifiedDailyMetricRow['demandLevel'] =
      rmScore >= 75 || occupancyPct >= 90
        ? 'exceptionnel'
        : rmScore >= 55 || occupancyPct >= 78
        ? 'eleve'
        : occupancyPct >= 55
        ? 'normal'
        : 'faible';

    dailyRows.push({
      dateStr,
      labelShort: `${cur.getUTCDate()} ${cur.toLocaleDateString('fr-FR', { month: 'short' })}`,
      dayName: cur.toLocaleDateString('fr-FR', { weekday: 'short' }),
      capacity,
      roomsSold,
      roomsAvailable,
      occupancyPct,
      occupancyN1Pct,
      adrEur,
      suggestedBarEur,
      plannedBarEur,
      revparEur,
      revenueEur,
      pickup24h: intel?.dedgePickup?.pickup1d ?? dedge.pickup24h,
      pickup7d: intel?.dedgePickup?.pickup7d ?? Math.round(dedge.pickup72h * 1.8),
      compsetMedianEur: compMedian,
      soldOutCompetitors,
      totalCompetitors,
      demandLevel,
      eventTitle: topEvent?.title || intel?.eventTitle || null,
      rmScore,
      minStay: plan?.minStay ?? (demandLevel === 'exceptionnel' ? 2 : 1),
      isHistorical: dateStr < todayStr,
    });
  }

  const count = Math.max(1, dailyRows.length);
  const totalRoomsSold = dailyRows.reduce((s, r) => s + r.roomsSold, 0);
  const totalProjectedRevenueEur = dailyRows.reduce((s, r) => s + r.revenueEur, 0);
  const avgOccupancyPct = Math.round((dailyRows.reduce((s, r) => s + r.occupancyPct, 0) / count) * 10) / 10;
  const avgOccupancyN1Pct = Math.round((dailyRows.reduce((s, r) => s + r.occupancyN1Pct, 0) / count) * 10) / 10;
  const avgAdrEur = totalRoomsSold > 0
    ? Math.round((totalProjectedRevenueEur / totalRoomsSold) * 10) / 10
    : Math.round((dailyRows.reduce((s, r) => s + r.adrEur, 0) / count) * 10) / 10;
  const avgRevparEur = Math.round((totalProjectedRevenueEur / (count * capacity)) * 10) / 10;
  const totalPickup7d = dailyRows.slice(0, 7).reduce((s, r) => s + r.pickup7d, 0);

  const peakDate = dailyRows.reduce<UnifiedDailyMetricRow | null>(
    (best, cur) => (!best || cur.revparEur > best.revparEur ? cur : best),
    null
  );

  const highDemandDaysCount = dailyRows.filter(
    (r) => r.demandLevel === 'exceptionnel' || r.demandLevel === 'eleve'
  ).length;

  const pendingDecisionsCount = intelRecords.filter(
    (r) => r.status === 'pending' && Math.abs(r.suggestedBarEur - r.currentBarEur) >= 5
  ).length;

  // Mix canaux dynamique dérivé du volume total vendu et de l'ADR réel de l'hôtel
  const channelDefs = [
    { channel: 'Booking.com', share: 0.36, adrFactor: 0.99, commissionPct: 17.5 },
    { channel: 'Direct Web & Moteur', share: 0.29, adrFactor: 1.03, commissionPct: 2.5 },
    { channel: 'Expedia Group', share: 0.14, adrFactor: 0.96, commissionPct: 18.5 },
    { channel: 'Corporate & GDS', share: 0.13, adrFactor: 1.07, commissionPct: 9.0 },
    { channel: 'Autres OTAs & Agences', share: 0.08, adrFactor: 0.91, commissionPct: 16.0 },
  ];

  const channelMix = channelDefs.map((def) => {
    const roomNights = Math.max(1, Math.round(totalRoomsSold * def.share));
    const adrNetEur = Math.round(avgAdrEur * def.adrFactor * 10) / 10;
    const revenueEur = Math.round(roomNights * adrNetEur);
    const netRevenueEur = Math.round(revenueEur * (1 - def.commissionPct / 100));
    return {
      channel: def.channel,
      roomNights,
      sharePercent: Math.round(def.share * 1000) / 10,
      adrNetEur,
      commissionPct: def.commissionPct,
      revenueEur,
      netRevenueEur,
    };
  });

  return {
    hotelId: hotel.id,
    hotelName: hotel.name,
    city: hotel.city,
    capacity,
    floorRateEur: floorRate,
    ceilingRateEur: ceilingRate,
    baseAdrEur: baseAdr,
    horizonDays,
    avgOccupancyPct,
    avgOccupancyN1Pct,
    avgAdrEur,
    avgRevparEur,
    totalProjectedRevenueEur,
    totalRoomsSold,
    totalPickup7d,
    peakDate,
    highDemandDaysCount,
    pendingDecisionsCount,
    syncedPlanningRatePct: Math.round((syncedCount / count) * 100),
    channelMix,
    dailyRows,
  };
}
