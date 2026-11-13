import type { SupabaseClient } from "@supabase/supabase-js";

export type RevenueApiOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

export async function revenueApiRequest<T>(
  supabase: SupabaseClient,
  path: string,
  options: RevenueApiOptions = {},
): Promise<T> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("Session Flowtym absente ou expirée.");

  const baseUrl = (supabase as any).supabaseUrl as string;
  const apiKey = (supabase as any).supabaseKey as string;
  const response = await fetch(`${baseUrl}/functions/v1/revenue-api${path.startsWith("/") ? path : `/${path}`}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: apiKey,
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const message = payload?.error || `Revenue API HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export const listRevenueHotels = (supabase: SupabaseClient) =>
  revenueApiRequest<{ ok: true; data: unknown[] }>(supabase, "/hotels");

export const getHotelRates = (supabase: SupabaseClient, hotelId: string, from: string, to: string) =>
  revenueApiRequest<{ ok: true; data: unknown[] }>(
    supabase, `/hotels/${encodeURIComponent(hotelId)}/rates?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );

export const getHotelEvents = (supabase: SupabaseClient, hotelId: string, from: string, to: string) =>
  revenueApiRequest<{ ok: true; data: unknown[] }>(
    supabase, `/hotels/${encodeURIComponent(hotelId)}/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );

export const submitRevenueDecision = (
  supabase: SupabaseClient,
  hotelId: string,
  decision: { rateIntelligenceId: string; action: "accept" | "modify" | "reject"; appliedRate?: number; appliedMinStay?: number; reasonCode?: string; reasonText?: string },
) => revenueApiRequest<{ ok: true; data: unknown }>(
  supabase, `/hotels/${encodeURIComponent(hotelId)}/decisions`, { method: "POST", body: decision },
);

export const generateBaselineForecast = (supabase: SupabaseClient, hotelId: string, startDate: string, endDate: string) =>
  revenueApiRequest<{ ok: true; forecastRunId: string; datesForecast: number; skippedForInsufficientHistory: number }>(
    supabase, `/hotels/${encodeURIComponent(hotelId)}/forecasts/baseline`,
    { method: "POST", body: { startDate, endDate } },
  );

export const generatePricingRecommendations = (supabase: SupabaseClient, hotelId: string, startDate: string, endDate: string) =>
  revenueApiRequest<{ ok: true; generated: number; requiresHumanApproval: true; automaticPublication: false; data: unknown[] }>(
    supabase, `/hotels/${encodeURIComponent(hotelId)}/recommendations/generate`,
    { method: "POST", body: { startDate, endDate } },
  );

export const saveHotelRevenueParameters = (supabase: SupabaseClient, hotelId: string, parameters: Record<string, unknown>) =>
  revenueApiRequest<{ ok: true; data: unknown }>(
    supabase, `/hotels/${encodeURIComponent(hotelId)}/parameters`, { method: "POST", body: parameters },
  );

export const importHotelHistoricalRows = (
  supabase: SupabaseClient,
  hotelId: string,
  payload: { fileName?: string; sourceName: string; detectedColumns?: string[]; rows: Record<string, unknown>[] },
) => revenueApiRequest<{ ok: true; importId: string; imported: number }>(
  supabase, `/hotels/${encodeURIComponent(hotelId)}/historical-import`, { method: "POST", body: payload },
);

export const getHotelBacktests = (supabase: SupabaseClient, hotelId: string) =>
  revenueApiRequest<{ ok: true; data: unknown[] }>(
    supabase, `/hotels/${encodeURIComponent(hotelId)}/backtests`,
  );

export const evaluateForecastBacktest = (supabase: SupabaseClient, hotelId: string, forecastRunId: string) =>
  revenueApiRequest<{ ok: true; data: unknown }>(
    supabase, `/hotels/${encodeURIComponent(hotelId)}/backtests/evaluate`,
    { method: "POST", body: { forecastRunId } },
  );

export const scoreHotelEventImpact = (supabase: SupabaseClient, hotelId: string, occurrenceId: string) =>
  revenueApiRequest<{ ok: true; data: unknown; requiresHumanValidation: true; driveTimeCalculated: false; extraNightsCalculated: false }>(
    supabase, `/hotels/${encodeURIComponent(hotelId)}/events/score`,
    { method: "POST", body: { occurrenceId } },
  );

export const ingestReservationSnapshots = (
  supabase: SupabaseClient,
  hotelId: string,
  snapshots: Record<string, unknown>[],
) => revenueApiRequest<{ ok: true; inserted: number; data: unknown[] }>(
  supabase, `/hotels/${encodeURIComponent(hotelId)}/reservation-snapshots`,
  { method: "POST", body: { snapshots } },
);

export const runWalkForwardBacktest = (
  supabase: SupabaseClient,
  hotelId: string,
  startDate: string,
  endDate: string,
  horizonDays: number,
  minimumSamples = 3,
) => revenueApiRequest<{ ok: true; horizonDays: number; rollingOrigin: true; models: unknown[]; comparison: Record<string, unknown> }>(
  supabase, `/hotels/${encodeURIComponent(hotelId)}/backtests/walk-forward`,
  { method: "POST", body: { startDate, endDate, horizonDays, minimumSamples } },
);

export const decideHotelEventImpact = (
  supabase: SupabaseClient,
  hotelId: string,
  occurrenceId: string,
  action: "validate" | "dismiss",
  reasonCode: string,
  reasonText?: string,
) => revenueApiRequest<{ ok: true; data: unknown; auditAppended: true }>(
  supabase, `/hotels/${encodeURIComponent(hotelId)}/events/decisions`,
  { method: "POST", body: { occurrenceId, action, reasonCode, reasonText } },
);

export const createPriceExperiment = (supabase: SupabaseClient, hotelId: string, experiment: Record<string, unknown>) =>
  revenueApiRequest<{ ok: true; data: unknown; randomizationVerified: false }>(
    supabase, `/hotels/${encodeURIComponent(hotelId)}/price-experiments`,
    { method: "POST", body: experiment },
  );

export const ingestPriceExperimentObservations = (
  supabase: SupabaseClient,
  hotelId: string,
  observations: Record<string, unknown>[],
) => revenueApiRequest<{ ok: true; inserted: number; data: unknown[] }>(
  supabase, `/hotels/${encodeURIComponent(hotelId)}/price-experiment-observations`,
  { method: "POST", body: { observations } },
);

export const ingestDemandCensoringObservations = (
  supabase: SupabaseClient,
  hotelId: string,
  observations: Record<string, unknown>[],
) => revenueApiRequest<{ ok: true; inserted: number; data: unknown[] }>(
  supabase, `/hotels/${encodeURIComponent(hotelId)}/demand-censoring-observations`,
  { method: "POST", body: { observations } },
);

export const estimateHotelPriceElasticity = (supabase: SupabaseClient, hotelId: string, experimentId: string) =>
  revenueApiRequest<{ ok: true; status: string; estimate: unknown; persisted: boolean }>(
    supabase, `/hotels/${encodeURIComponent(hotelId)}/elasticity/estimate`,
    { method: "POST", body: { experimentId } },
  );

export const getHotelCalibrationRules = (supabase: SupabaseClient, hotelId: string) =>
  revenueApiRequest<{ ok: true; data: unknown[] }>(
    supabase, `/hotels/${encodeURIComponent(hotelId)}/calibration-rules`,
  );

export const reviewPriceExperiment = (
  supabase: SupabaseClient,
  hotelId: string,
  experimentId: string,
  action: "verify_randomization" | "complete",
  reasonCode: string,
  evidence?: Record<string, unknown>,
  reasonText?: string,
) => revenueApiRequest<{ ok: true; data: unknown; auditAppended: true }>(
  supabase, `/hotels/${encodeURIComponent(hotelId)}/price-experiments/review`,
  { method: "POST", body: { experimentId, action, reasonCode, evidence, reasonText } },
);

export const getHotelForecasts = (supabase: SupabaseClient, hotelId: string, from: string, to: string) =>
  revenueApiRequest<{ ok: true; data: unknown[] }>(
    supabase, `/hotels/${encodeURIComponent(hotelId)}/forecasts?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );

export const getHotelInventorySnapshots = (supabase: SupabaseClient, hotelId: string, from: string, to: string) =>
  revenueApiRequest<{ ok: true; data: unknown[] }>(
    supabase, `/hotels/${encodeURIComponent(hotelId)}/inventory-snapshots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
