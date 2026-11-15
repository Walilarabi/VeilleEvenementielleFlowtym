export type RoomTypeSignalKey = "occupancy" | "pickup" | "event" | "compset" | "market_demand";
export type DemandBucket = "low" | "normal" | "high" | "exceptional";
export type RecommendationQuality = "valid" | "degraded" | "insufficient" | "conflicted";

export interface RoomTypeRecommendationConfig {
  weights: Record<RoomTypeSignalKey, number>;
  thresholds: { normal: number; high: number; exceptional: number };
  rateAdjustmentsPct: Record<DemandBucket, number>;
  floor: number;
  ceiling: number;
  maxChangePct: number;
  minimumSources: number;
  minimumWeightCoveragePct: number;
}

export interface RoomTypeRecommendationInput {
  currentBar: number;
  signals: Record<RoomTypeSignalKey, number | null>;
  inventoryReservationConflict?: boolean;
}

export interface RoomTypeRecommendationResult {
  score: number | null;
  demandIndex: number | null;
  bucket: DemandBucket | null;
  demandLevel: "faible" | "normal" | "eleve" | "exceptionnel" | null;
  confidenceScore: number;
  coveredWeight: number;
  totalWeight: number;
  availableSignals: RoomTypeSignalKey[];
  sufficient: boolean;
  requestedPct: number;
  suggestedBar: number;
  deltaAmount: number;
  deltaPct: number;
  dataQualityStatus: RecommendationQuality;
  strategyCode: string;
}

const SIGNAL_KEYS: RoomTypeSignalKey[] = ["occupancy", "pickup", "event", "compset", "market_demand"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildRoomTypeRecommendation(
  input: RoomTypeRecommendationInput,
  config: RoomTypeRecommendationConfig,
): RoomTypeRecommendationResult {
  const { currentBar } = input;
  if (!Number.isFinite(currentBar) || currentBar <= 0) {
    throw new Error("currentBar must be a positive finite number");
  }
  if (!Number.isFinite(config.floor) || !Number.isFinite(config.ceiling) ||
      config.floor <= 0 || config.ceiling < config.floor ||
      currentBar < config.floor || currentBar > config.ceiling) {
    throw new Error("Current BAR and configured floor/ceiling are inconsistent");
  }
  if (!Number.isFinite(config.maxChangePct) || config.maxChangePct <= 0 ||
      !Number.isInteger(config.minimumSources) || config.minimumSources < 1 ||
      config.minimumSources > SIGNAL_KEYS.length ||
      !Number.isFinite(config.minimumWeightCoveragePct) ||
      config.minimumWeightCoveragePct < 0 || config.minimumWeightCoveragePct > 100) {
    throw new Error("Invalid recommendation guardrails");
  }
  const { normal, high, exceptional } = config.thresholds;
  if (![normal, high, exceptional].every(Number.isFinite) ||
      normal < 0 || normal >= high || high >= exceptional || exceptional > 100) {
    throw new Error("Invalid demand thresholds");
  }
  if (!SIGNAL_KEYS.every((key) => Number.isFinite(config.weights[key]) && config.weights[key] >= 0) ||
      !SIGNAL_KEYS.some((key) => config.weights[key] > 0)) {
    throw new Error("Invalid or empty signal weights");
  }
  if (!(["low", "normal", "high", "exceptional"] as DemandBucket[]).every((key) =>
    Number.isFinite(config.rateAdjustmentsPct[key]))) {
    throw new Error("Invalid rate adjustment configuration");
  }

  const totalWeight = SIGNAL_KEYS.reduce((sum, key) => sum + config.weights[key], 0);
  const availableSignals = SIGNAL_KEYS.filter((key) => {
    const value = input.signals[key];
    return config.weights[key] > 0 && value !== null && Number.isFinite(value) && value >= 0 && value <= 100;
  });
  const coveredWeight = availableSignals.reduce((sum, key) => sum + config.weights[key], 0);
  const confidenceScore = totalWeight > 0 ? Math.round(100 * coveredWeight / totalWeight) : 0;
  const score = coveredWeight > 0
    ? availableSignals.reduce((sum, key) => sum + config.weights[key] * Number(input.signals[key]), 0) / coveredWeight
    : null;

  let bucket: DemandBucket | null = null;
  if (score !== null) {
    bucket = score >= exceptional ? "exceptional" : score >= high ? "high" : score >= normal ? "normal" : "low";
  }
  const conflict = input.inventoryReservationConflict === true;
  const sufficient = !conflict && score !== null &&
    availableSignals.length >= config.minimumSources &&
    confidenceScore >= config.minimumWeightCoveragePct;
  const requestedPct = sufficient && bucket ? config.rateAdjustmentsPct[bucket] : 0;
  const maxDelta = currentBar * config.maxChangePct / 100;
  const lower = Math.max(config.floor, currentBar - maxDelta);
  const upper = Math.min(config.ceiling, currentBar + maxDelta);
  const suggestedBar = roundMoney(clamp(currentBar * (1 + requestedPct / 100), lower, upper));
  const deltaAmount = roundMoney(suggestedBar - currentBar);
  const deltaPct = roundMoney(deltaAmount / currentBar * 100);
  const demandLevel = bucket === null ? null : ({
    low: "faible",
    normal: "normal",
    high: "eleve",
    exceptional: "exceptionnel",
  } as const)[bucket];
  const dataQualityStatus: RecommendationQuality = conflict
    ? "conflicted"
    : sufficient
      ? "valid"
      : availableSignals.length > 0
        ? "degraded"
        : "insufficient";
  const strategyCode = sufficient && bucket
    ? `PRICING_V2_${bucket.toUpperCase()}`
    : conflict
      ? "HOLD_DATA_CONFLICT"
      : "HOLD_INSUFFICIENT_DATA";

  return {
    score: score === null ? null : Math.round(score * 100) / 100,
    demandIndex: score === null ? null : Math.round(score),
    bucket,
    demandLevel,
    confidenceScore,
    coveredWeight,
    totalWeight,
    availableSignals,
    sufficient,
    requestedPct,
    suggestedBar,
    deltaAmount,
    deltaPct,
    dataQualityStatus,
    strategyCode,
  };
}
