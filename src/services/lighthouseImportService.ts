import type { SupabaseClient } from "@supabase/supabase-js";
import type { LighthouseExtractionDataset } from "./lighthouseAnalysisEngine";

type AccessibleHotel = {
  id: string;
  name: string;
  city: string;
  country: string;
  organization_id: string;
  currency: string;
  timezone: string;
};

function normalizeHotelName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(grand|hotel|hotels|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Resolve the mock/UI hotel label to exactly one hotel visible through RLS.
 * Never guesses when there is no unique name + city match.
 */
export async function resolveAccessibleRmsHotel(
  supabase: SupabaseClient,
  candidate: { name: string; city: string; country?: string },
): Promise<AccessibleHotel> {
  const { data, error } = await supabase
    .from("hotels")
    .select("id,name,city,country,organization_id,currency,timezone")
    .eq("is_active", true);

  if (error) throw new Error(`Lecture des hôtels accessibles impossible : ${error.message}`);

  const candidateName = normalizeHotelName(candidate.name);
  const candidateCity = normalizeHotelName(candidate.city);
  const candidateCountry = candidate.country ? normalizeHotelName(candidate.country) : "";

  const matches = (data ?? []).filter((row: AccessibleHotel) => {
    if (normalizeHotelName(row.city) !== candidateCity) return false;
    if (candidateCountry && normalizeHotelName(row.country) !== candidateCountry) return false;
    const dbName = normalizeHotelName(row.name);
    return dbName === candidateName || candidateName.includes(dbName) || dbName.includes(candidateName);
  });

  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? `Aucun hôtel Supabase accessible ne correspond à « ${candidate.name} », ${candidate.city}. L'import est bloqué pour éviter d'écrire sur le mauvais établissement.`
        : `Plusieurs hôtels Supabase correspondent à « ${candidate.name} », ${candidate.city}. Sélection explicite requise avant import.`,
    );
  }

  return matches[0];
}

async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("SHA-256 indisponible dans ce navigateur sécurisé.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function positiveIntegerFromLabel(value: string): number | null {
  const match = value.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function availabilityStatus(status: string): "available" | "sold_out" | "unknown" | "not_comparable" | "error" {
  switch (status) {
    case "disponible": return "available";
    case "epuise": return "sold_out";
    case "los2":
    case "1pax": return "not_comparable";
    default: return "unknown";
  }
}

/**
 * Persists a manually uploaded Lighthouse export under the authenticated user's RLS scope.
 * The parsed source dataset is retained in extraction metadata so the complete report can
 * be restored without fabricating values that are not represented in normalized columns.
 */
export async function persistLighthouseExtraction(
  supabase: SupabaseClient,
  hotel: AccessibleHotel,
  dataset: LighthouseExtractionDataset,
  importedBy: string,
): Promise<{ extractionId: string; observationsInserted: number; observedAt: string; unmatchedCompetitors: string[] }> {
  if (dataset.metadata.sourceStatus !== "imported" || dataset.records.length === 0) {
    throw new Error("Seule une extraction Lighthouse réelle et non vide peut être enregistrée.");
  }

  const normalizedDataset: LighthouseExtractionDataset = {
    ...dataset,
    metadata: {
      ...dataset.metadata,
      currency: hotel.currency,
      sourceChannel: dataset.metadata.sourceChannel || "Canal non renseigné",
    },
  };
  const { data: configuredCompetitors, error: competitorsError } = await supabase
    .from("competitor_hotels")
    .select("id,competitor_name")
    .eq("hotel_id", hotel.id)
    .eq("is_active", true);

  if (competitorsError) throw new Error(`Lecture du compset actif impossible : ${competitorsError.message}`);

  const competitorByName = new Map<string, { id: string; competitor_name: string }>();
  for (const competitor of configuredCompetitors ?? []) {
    const key = normalizeHotelName(competitor.competitor_name);
    if (competitorByName.has(key)) {
      throw new Error(`Le compset contient plusieurs entrées ambiguës pour « ${competitor.competitor_name} ».`);
    }
    competitorByName.set(key, competitor);
  }

  const importedCompetitorNames = [...new Set(normalizedDataset.records.flatMap((record) => record.competitors.map((item) => item.name.trim())))];
  const unmatchedCompetitors = importedCompetitorNames.filter((name) => !competitorByName.has(normalizeHotelName(name)));
  // Les noms non rapprochés sont conservés comme observations brutes avec competitor_id NULL.
  // Ils ne seront pas utilisés dans le calcul du CompSet tant qu'un mapping explicite n'existe pas.

  const stayDates = normalizedDataset.records.map((record) => record.dateStr)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  if (stayDates.length === 0) throw new Error("Aucune date de séjour valide dans l'export Lighthouse.");

  const importTime = new Date().toISOString();
  const observedAt = normalizedDataset.metadata.sourceUpdatedAt ?? importTime;

  const observationRows = normalizedDataset.records.flatMap((record) =>
    record.competitors.map((competitor) => ({
      organization_id: hotel.organization_id,
      hotel_id: hotel.id,
      stay_date: record.dateStr,
      competitor_id: competitorByName.get(normalizeHotelName(competitor.name))?.id ?? null,
      competitor_name: competitor.name.trim(),
      room_type: null,
      rate_plan: null,
      channel: normalizedDataset.metadata.sourceChannel === "Canal non renseigné" ? null : normalizedDataset.metadata.sourceChannel,
      currency: hotel.currency.slice(0, 3),
      rate_amount: competitor.rate,
      availability_status: availabilityStatus(competitor.status),
      observed_at: observedAt,
      source_status: "imported",
      comparability: {
        original_status: competitor.status,
        status_label: competitor.statusLabel,
        evolution_1d: competitor.evolution1d,
        evolution_3d: competitor.evolution3d,
        evolution_7d: competitor.evolution7d,
        source_file: normalizedDataset.metadata.fileName,
        source_channel: normalizedDataset.metadata.sourceChannel,
        dimensions_confirmed: false,
        requires_channel_los_pos_confirmation: true,
        mapping_status: competitorByName.has(normalizeHotelName(competitor.name)) ? "matched_exact_name" : "unmatched",
      },
      los: positiveIntegerFromLabel(normalizedDataset.metadata.los),
      pos: positiveIntegerFromLabel(normalizedDataset.metadata.occupancy),
    })),
  );

  if (observationRows.length === 0 || observationRows.length > 5000) {
    throw new Error("L'export doit contenir entre 1 et 5000 observations concurrentielles.");
  }

  const sourceHash = await sha256Hex(JSON.stringify({
    hotelId: hotel.id,
    sourceChannel: normalizedDataset.metadata.sourceChannel,
    los: normalizedDataset.metadata.los,
    occupancy: normalizedDataset.metadata.occupancy,
    sourceUpdatedAt: normalizedDataset.metadata.sourceUpdatedAt ?? null,
    records: normalizedDataset.records,
  }));
  const idempotencyKey = "lighthouse:" + hotel.id + ":" + sourceHash;
  normalizedDataset.metadata.sourceHash = sourceHash;
  normalizedDataset.metadata.observedAtSource = normalizedDataset.metadata.sourceUpdatedAt
    ? "source_updated_at"
    : "import_time_fallback";

  const jobMetadata = {
    fileName: normalizedDataset.metadata.fileName,
    sourceHash,
    sourceChannel: normalizedDataset.metadata.sourceChannel,
    stayStart: stayDates[0],
    stayEnd: stayDates[stayDates.length - 1],
    sourceUpdatedAt: normalizedDataset.metadata.sourceUpdatedAt ?? null,
    observedAtSource: normalizedDataset.metadata.sourceUpdatedAt ? "source_updated_at" : "import_time_fallback",
    observationsExpected: observationRows.length,
    unmatchedCompetitors,
  };

  const { data: existingJob, error: existingJobError } = await supabase
    .from("data_ingestion_jobs")
    .select("id,status,metadata,records_written,started_at")
    .eq("organization_id", hotel.organization_id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingJobError) throw new Error("Vérification d'idempotence impossible : " + existingJobError.message);

  if (existingJob && (existingJob.status === "completed" || existingJob.status === "partial")) {
    const previousMetadata = (existingJob.metadata ?? {}) as Record<string, unknown>;
    const previousExtractionId = typeof previousMetadata.extractionId === "string" ? previousMetadata.extractionId : null;
    if (previousExtractionId) {
      const { data: previousExtraction, error: previousExtractionError } = await supabase
        .from("lighthouse_extractions").select("id").eq("id", previousExtractionId).eq("hotel_id", hotel.id).maybeSingle();
      if (previousExtractionError) throw new Error("Vérification de l'extraction existante impossible : " + previousExtractionError.message);
      if (previousExtraction) {
        normalizedDataset.metadata.id = previousExtraction.id;
        normalizedDataset.metadata.ingestionJobId = existingJob.id;
        dataset.metadata.id = previousExtraction.id;
        dataset.metadata.sourceHash = sourceHash;
        dataset.metadata.ingestionJobId = existingJob.id;
        dataset.metadata.observedAtSource = normalizedDataset.metadata.observedAtSource;
        return {
          extractionId: previousExtraction.id,
          observationsInserted: Number(existingJob.records_written ?? previousMetadata.observationsInserted ?? 0),
          observedAt,
          unmatchedCompetitors: Array.isArray(previousMetadata.unmatchedCompetitors) ? previousMetadata.unmatchedCompetitors as string[] : unmatchedCompetitors,
        };
      }
    }
  }

  if (existingJob?.status === "running" || existingJob?.status === "queued") {
    const startedAt = existingJob.started_at ? new Date(existingJob.started_at).getTime() : 0;
    if (startedAt && Date.now() - startedAt < 30 * 60 * 1000) {
      throw new Error("Un import identique est déjà en cours. Attendez sa fin avant de relancer le fichier.");
    }
  }

  let jobId: string;
  if (existingJob) {
    const { data: updatedJob, error: updateJobError } = await supabase
      .from("data_ingestion_jobs")
      .update({
        status: "running",
        started_at: importTime,
        finished_at: null,
        records_read: observationRows.length,
        records_written: 0,
        records_rejected: 0,
        error_summary: null,
        metadata: jobMetadata,
      })
      .eq("id", existingJob.id)
      .select("id")
      .single();
    if (updateJobError || !updatedJob) throw new Error("Relance du job d'import impossible : " + (updateJobError?.message ?? "réponse vide"));
    jobId = updatedJob.id;
  } else {
    const { data: createdJob, error: createJobError } = await supabase
      .from("data_ingestion_jobs")
      .insert({
        organization_id: hotel.organization_id,
        hotel_id: hotel.id,
        source_system: "lighthouse",
        job_type: "rate_shop_import",
        status: "running",
        idempotency_key: idempotencyKey,
        started_at: importTime,
        records_read: observationRows.length,
        records_written: 0,
        records_rejected: 0,
        created_by: importedBy,
        metadata: jobMetadata,
      })
      .select("id")
      .single();
    if (createJobError || !createdJob) {
      throw new Error("Création du job d'import impossible : " + (createJobError?.message ?? "réponse vide"));
    }
    jobId = createdJob.id;
  }

  normalizedDataset.metadata.ingestionJobId = jobId;
  let extractionId: string | null = null;
  let inserted = 0;
  try {
    const { data: extraction, error: extractionError } = await supabase
      .from("lighthouse_extractions")
      .insert({
        organization_id: hotel.organization_id,
        hotel_id: hotel.id,
        file_name: normalizedDataset.metadata.fileName,
        provider: "lighthouse",
        extraction_type: "manual_import",
        observed_at: observedAt,
        stay_start: stayDates[0],
        stay_end: stayDates[stayDates.length - 1],
        currency: hotel.currency.slice(0, 3),
        occupancy_context: normalizedDataset.metadata.occupancy,
        los_nights: positiveIntegerFromLabel(normalizedDataset.metadata.los),
        guests_count: positiveIntegerFromLabel(normalizedDataset.metadata.occupancy),
        source_status: "imported",
        records_count: observationRows.length,
        imported_by: importedBy,
        metadata: {
          ...jobMetadata,
          ingestionJobId: jobId,
          observedAt,
          observedAtSource: normalizedDataset.metadata.observedAtSource,
          dimensionsConfirmed: false,
          matchedCompetitors: importedCompetitorNames.length - unmatchedCompetitors.length,
          parsedDataset: normalizedDataset,
        },
      })
      .select("id")
      .single();
    if (extractionError || !extraction) throw new Error("Création de l'extraction Lighthouse impossible : " + (extractionError?.message ?? "réponse vide"));
    extractionId = extraction.id;
    normalizedDataset.metadata.id = extraction.id;
    dataset.metadata.id = extraction.id;

    const rowsWithExtraction = observationRows.map((row) => ({ ...row, extraction_id: extraction.id }));
    const batchSize = 500;
    for (let offset = 0; offset < rowsWithExtraction.length; offset += batchSize) {
      const batch = rowsWithExtraction.slice(offset, offset + batchSize);
      const { data, error } = await supabase.from("lighthouse_rate_observations").insert(batch).select("id");
      if (error) throw new Error(error.message);
      inserted += data?.length ?? 0;
    }

    const completedAt = new Date().toISOString();
    const completedMetadata = { ...jobMetadata, extractionId: extraction.id, observationsInserted: inserted, unmatchedCompetitors };
    const { error: completeJobError } = await supabase
      .from("data_ingestion_jobs")
      .update({ status: "completed", finished_at: completedAt, records_written: inserted, records_rejected: 0, error_summary: null, metadata: completedMetadata })
      .eq("id", jobId);
    if (completeJobError) throw new Error("Mise à jour du journal d'import impossible : " + completeJobError.message);

    return { extractionId: extraction.id, observationsInserted: inserted, observedAt, unmatchedCompetitors };
  } catch (error) {
    let cleanupError: string | null = null;
    if (extractionId) {
      const { error: observationCleanupError } = await supabase.from("lighthouse_rate_observations").delete().eq("extraction_id", extractionId);
      const { error: extractionCleanupError } = await supabase.from("lighthouse_extractions").delete().eq("id", extractionId);
      cleanupError = observationCleanupError?.message ?? extractionCleanupError?.message ?? null;
    }
    const errorMessage = error instanceof Error ? error.message : "erreur inconnue";
    await supabase.from("data_ingestion_jobs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      records_written: 0,
      records_rejected: observationRows.length,
      error_summary: cleanupError ? errorMessage + " ; nettoyage : " + cleanupError : errorMessage,
      metadata: { ...jobMetadata, failedAt: new Date().toISOString(), cleanupError },
    }).eq("id", jobId);
    throw new Error("Import Lighthouse échoué : " + errorMessage + (cleanupError ? " ; nettoyage incomplet : " + cleanupError : ""));
  }
}

export async function loadRecentLighthouseExtractions(
  supabase: SupabaseClient,
  hotelId: string,
  limit = 10,
): Promise<Array<{ id: string; fileName: string; observedAt: string; dataset: LighthouseExtractionDataset | null }>> {
  const { data, error } = await supabase
    .from("lighthouse_extractions")
    .select("id,file_name,observed_at,metadata")
    .eq("hotel_id", hotelId)
    .order("observed_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Lecture de l'historique Lighthouse impossible : ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    fileName: row.file_name || "Extraction Lighthouse",
    observedAt: row.observed_at,
    dataset: row.metadata?.parsedDataset?.records
      ? {
          ...(row.metadata.parsedDataset as LighthouseExtractionDataset),
          metadata: {
            ...(row.metadata.parsedDataset as LighthouseExtractionDataset).metadata,
            id: row.id,
            fileName: row.file_name || (row.metadata.parsedDataset as LighthouseExtractionDataset).metadata.fileName,
          },
        }
      : null,
  }));
}
