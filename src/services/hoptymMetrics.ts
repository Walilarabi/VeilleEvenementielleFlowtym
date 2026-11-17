/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM RMS — Calculs métriques métier partagés (Ingestion Hoptym & Benchmarks)
 */

export function calculateOccupancyPercent(
  roomsSold: number | null | undefined,
  sellableRooms: number | null | undefined
): number | null {
  if (
    roomsSold === null ||
    roomsSold === undefined ||
    sellableRooms === null ||
    sellableRooms === undefined ||
    !Number.isFinite(roomsSold) ||
    !Number.isFinite(sellableRooms) ||
    sellableRooms <= 0
  ) {
    return null;
  }
  const pct = (roomsSold / sellableRooms) * 100;
  return Math.round(Math.min(100, Math.max(0, pct)) * 100) / 100;
}

export function calculateMeanLeadTime(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0);
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / valid.length) * 10) / 10;
}

export function calculateNetPickup(input: {
  newRoomsBooked?: number | null;
  cancelledRooms?: number | null;
  movedInRooms?: number | null;
  movedOutRooms?: number | null;
}): number {
  const booked = Number(input.newRoomsBooked || 0);
  const cancelled = Number(input.cancelledRooms || 0);
  const movedIn = Number(input.movedInRooms || 0);
  const movedOut = Number(input.movedOutRooms || 0);
  return Math.round(booked - cancelled + movedIn - movedOut);
}

export interface CompetitorRateSummary {
  prices: number[];
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  average: number | null;
  observationCount: number;
  competitorCount: number;
  soldOutCount: number;
}

export function summarizeCompetitorRates(
  rows: Array<{
    competitor_name?: string | null;
    rate_amount?: number | null;
    availability_status?: string | null;
  }>
): CompetitorRateSummary {
  const competitors = new Set<string>();
  const validPrices: number[] = [];
  let soldOutCount = 0;

  for (const row of rows) {
    if (row.competitor_name) {
      competitors.add(String(row.competitor_name).trim().toLowerCase());
    }
    const isSoldOut = row.availability_status === 'sold_out' || row.availability_status === 'epuise';
    if (isSoldOut) {
      soldOutCount += 1;
      continue;
    }
    if (typeof row.rate_amount === 'number' && Number.isFinite(row.rate_amount) && row.rate_amount > 0) {
      validPrices.push(row.rate_amount);
    }
  }

  validPrices.sort((a, b) => a - b);

  if (validPrices.length === 0) {
    return {
      prices: [],
      median: null,
      minimum: null,
      maximum: null,
      average: null,
      observationCount: rows.length,
      competitorCount: competitors.size,
      soldOutCount,
    };
  }

  const mid = Math.floor(validPrices.length / 2);
  const median =
    validPrices.length % 2 === 1
      ? validPrices[mid]
      : Math.round(((validPrices[mid - 1] + validPrices[mid]) / 2) * 100) / 100;
  const sum = validPrices.reduce((acc, v) => acc + v, 0);

  return {
    prices: validPrices,
    median,
    minimum: validPrices[0],
    maximum: validPrices[validPrices.length - 1],
    average: Math.round((sum / validPrices.length) * 100) / 100,
    observationCount: rows.length,
    competitorCount: competitors.size,
    soldOutCount,
  };
}
