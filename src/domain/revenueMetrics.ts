/**
 * FLOWTYM Revenue — deterministic, unit-safe hotel metrics.
 * Null means "not computable"; zero remains a valid observed value.
 */

export type NullableMetric = number | null;

function validNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function safeDivide(numerator: number, denominator: number): NullableMetric {
  if (!validNonNegative(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

export function calculateOccupancyPct(roomsSold: number, sellableRoomNights: number): NullableMetric {
  const ratio = safeDivide(roomsSold, sellableRoomNights);
  if (ratio === null || roomsSold > sellableRoomNights) return null;
  return ratio * 100;
}

export function calculateAdr(accommodationRevenue: number, roomNightsSold: number): NullableMetric {
  return safeDivide(accommodationRevenue, roomNightsSold);
}

export function calculateRevpar(accommodationRevenue: number, availableRoomNights: number): NullableMetric {
  return safeDivide(accommodationRevenue, availableRoomNights);
}

/**
 * Difference between two OTB snapshots. This is net pickup, not gross bookings:
 * cancellations and modifications are already reflected in the OTB delta.
 */
export function calculateNetPickup(currentOtb: number, previousOtb: number): NullableMetric {
  if (!Number.isInteger(currentOtb) || !Number.isInteger(previousOtb) || currentOtb < 0 || previousOtb < 0) return null;
  return currentOtb - previousOtb;
}

function paired(actual: number[], forecast: number[]): Array<[number, number]> | null {
  if (actual.length === 0 || actual.length !== forecast.length) return null;
  if (![...actual, ...forecast].every(Number.isFinite)) return null;
  return actual.map((a, i) => [a, forecast[i]]);
}

/** WAPE = sum(abs(actual - forecast)) / sum(abs(actual)); undefined for a zero denominator. */
export function calculateWape(actual: number[], forecast: number[]): NullableMetric {
  const pairs = paired(actual, forecast);
  if (!pairs) return null;
  const denominator = pairs.reduce((s, [a]) => s + Math.abs(a), 0);
  if (denominator === 0) return null;
  return pairs.reduce((s, [a, f]) => s + Math.abs(a - f), 0) / denominator;
}

/** Bias = sum(forecast - actual) / sum(actual); positive means over-forecasting. */
export function calculateBiasPct(actual: number[], forecast: number[]): NullableMetric {
  const pairs = paired(actual, forecast);
  if (!pairs) return null;
  const denominator = pairs.reduce((s, [a]) => s + a, 0);
  if (denominator === 0) return null;
  return pairs.reduce((s, [a, f]) => s + f - a, 0) / denominator * 100;
}

export function calculateMae(actual: number[], forecast: number[]): NullableMetric {
  const pairs = paired(actual, forecast);
  if (!pairs) return null;
  return pairs.reduce((s, [a, f]) => s + Math.abs(a - f), 0) / pairs.length;
}

export function calculateRmse(actual: number[], forecast: number[]): NullableMetric {
  const pairs = paired(actual, forecast);
  if (!pairs) return null;
  return Math.sqrt(pairs.reduce((s, [a, f]) => s + (a - f) ** 2, 0) / pairs.length);
}

export function calculateMedian(values: number[]): NullableMetric {
  if (values.length === 0 || !values.every(Number.isFinite)) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function calculateQuantile(values: number[], q: number): NullableMetric {
  if (values.length === 0 || !values.every(Number.isFinite) || q < 0 || q > 1) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export interface ComparableRateObservation {
  rate: number | null;
  availability: "available" | "sold_out" | "unknown" | "not_comparable" | "error";
  observedAt: string;
  currency: string;
  roomType?: string | null;
  ratePlan?: string | null;
  losNights?: number | null;
  guests?: number | null;
  isTargetHotel?: boolean;
}

export interface CompsetCriteria {
  asOf: string;
  maxAgeHours: number;
  currency: string;
  roomType?: string;
  ratePlan?: string;
  losNights?: number;
  guests?: number;
}

export interface CompsetSummary {
  median: number | null;
  average: number | null;
  minimum: number | null;
  maximum: number | null;
  availableCount: number;
  soldOutCount: number;
  excludedCount: number;
}

export function calculateCompsetSummary(
  observations: ComparableRateObservation[],
  criteria: CompsetCriteria,
): CompsetSummary {
  const now = Date.parse(criteria.asOf);
  const rates: number[] = [];
  let soldOutCount = 0;
  let excludedCount = 0;

  for (const item of observations) {
    const ageHours = (now - Date.parse(item.observedAt)) / 3_600_000;
    const comparable =
      !item.isTargetHotel &&
      item.currency === criteria.currency &&
      (criteria.roomType === undefined || item.roomType === criteria.roomType) &&
      (criteria.ratePlan === undefined || item.ratePlan === criteria.ratePlan) &&
      (criteria.losNights === undefined || item.losNights === criteria.losNights) &&
      (criteria.guests === undefined || item.guests === criteria.guests) &&
      Number.isFinite(ageHours) && ageHours >= 0 && ageHours <= criteria.maxAgeHours;

    if (!comparable) {
      excludedCount++;
      continue;
    }
    if (item.availability === "sold_out") {
      soldOutCount++;
      continue;
    }
    if (item.availability !== "available" || item.rate === null || !validNonNegative(item.rate) || item.rate === 0) {
      excludedCount++;
      continue;
    }
    rates.push(item.rate);
  }

  return {
    median: calculateMedian(rates),
    average: rates.length ? rates.reduce((s, n) => s + n, 0) / rates.length : null,
    minimum: rates.length ? Math.min(...rates) : null,
    maximum: rates.length ? Math.max(...rates) : null,
    availableCount: rates.length,
    soldOutCount,
    excludedCount,
  };
}
