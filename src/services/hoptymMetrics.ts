export interface CompetitorRateInput {
  rate_amount: number | null;
  competitor_name: string;
  currency?: string;
}

export interface CompetitorRateSummary {
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  observationCount: number;
  competitorCount: number;
  prices: number[];
}

export function median(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarizeCompetitorRates(rows: CompetitorRateInput[]): CompetitorRateSummary {
  const prices = rows.map((row) => row.rate_amount).filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  const competitors = new Set(rows.filter((row) => row.rate_amount !== null && row.rate_amount > 0).map((row) => row.competitor_name.trim().toLowerCase()).filter(Boolean));
  return {
    median: median(prices),
    minimum: prices.length ? prices[0] : null,
    maximum: prices.length ? prices[prices.length - 1] : null,
    observationCount: prices.length,
    competitorCount: competitors.size,
    prices,
  };
}

export function calculateNetPickup(input: {
  newRoomsBooked?: number | null;
  cancelledRooms?: number | null;
  movedInRooms?: number | null;
  movedOutRooms?: number | null;
}): number {
  return (input.newRoomsBooked || 0) - (input.cancelledRooms || 0) + (input.movedInRooms || 0) - (input.movedOutRooms || 0);
}

export function calculateMeanLeadTime(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function calculateOccupancyPercent(roomsSold: number | null | undefined, sellableRooms: number | null | undefined): number | null {
  if (typeof roomsSold !== 'number' || typeof sellableRooms !== 'number' || !Number.isFinite(roomsSold) || !Number.isFinite(sellableRooms) || sellableRooms <= 0 || roomsSold < 0) return null;
  return Math.min(100, Math.max(0, (roomsSold / sellableRooms) * 100));
}
