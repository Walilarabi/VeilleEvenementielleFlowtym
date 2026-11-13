import type { SupabaseClient } from "@supabase/supabase-js";
import type { LighthouseExtractionDataset } from "./lighthouseAnalysisEngine";

type AccessibleHotel = {
  id: string;
  name: string;
  city: string;
  country: string;
  organization_id: string;
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
    .select("id,name,city,country,organization_id")
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
): Promise<{ extractionId: string; observationsInserted: number; observedAt: string }> {
  if (dataset.metadata.sourceStatus !== "imported" || dataset.records.length === 0) {
    throw new Error("Seule une extraction Lighthouse réelle et non vide peut être enregistrée.");
  }

  const observedAt = new Date().toISOString();
  const stayDates = dataset.records.map((record) => record.dateStr).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  if (stayDates.length === 0) throw new Error("Aucune date de séjour valide dans l'export Lighthouse.");

  const observationRows = dataset.records.flatMap((record) =>
    record.competitors.map((competitor) => ({
      organization_id: hotel.organization_id,
      hotel_id: hotel.id,
      stay_date: record.dateStr,
      competitor_name: competitor.name.trim(),
      room_type: null,
      rate_plan: null,
      channel: dataset.metadata.sourceChannel || null,
      currency: (dataset.metadata.currency || "EUR").slice(0, 3),
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
        source_file: dataset.metadata.fileName,
        source_channel: dataset.metadata.sourceChannel,
      },
      los: positiveIntegerFromLabel(dataset.metadata.los),
      pos: positiveIntegerFromLabel(dataset.metadata.occupancy),
    })),
  );

  if (observationRows.length === 0 || observationRows.length > 5000) {
    throw new Error("L'export doit contenir entre 1 et 5000 observations concurrentielles.");
  }

  const { data: extraction, error: extractionError } = await supabase
    .from("lighthouse_extractions")
    .insert({
      organization_id: hotel.organization_id,
      hotel_id: hotel.id,
      file_name: dataset.metadata.fileName,
      provider: "lighthouse",
      extraction_type: "manual_import",
      observed_at: observedAt,
      stay_start: stayDates[0],
      stay_end: stayDates[stayDates.length - 1],
      currency: (dataset.metadata.currency || "EUR").slice(0, 3),
      occupancy_context: dataset.metadata.occupancy,
      los_nights: positiveIntegerFromLabel(dataset.metadata.los),
      guests_count: positiveIntegerFromLabel(dataset.metadata.occupancy),
      source_status: "imported",
      records_count: observationRows.length,
      imported_by: importedBy,
      metadata: {
        sourceChannel: dataset.metadata.sourceChannel,
        compsetName: dataset.metadata.compsetName,
        referenceHotel: dataset.metadata.referenceHotel,
        dateRange: dataset.metadata.dateRange,
        totalDatesCount: dataset.metadata.totalDatesCount,
        parsedDataset: dataset,
      },
    })
    .select("id")
    .single();

  if (extractionError || !extraction) {
    throw new Error(`Création de l'extraction Lighthouse impossible : ${extractionError?.message ?? "réponse vide"}`);
  }

  const rowsWithExtraction = observationRows.map((row) => ({
    ...row,
    extraction_id: extraction.id,
  }));

  const batchSize = 500;
  let inserted = 0;
  try {
    for (let offset = 0; offset < rowsWithExtraction.length; offset += batchSize) {
      const batch = rowsWithExtraction.slice(offset, offset + batchSize);
      const { data, error } = await supabase
        .from("lighthouse_rate_observations")
        .insert(batch)
        .select("id");
      if (error) throw new Error(error.message);
      inserted += data?.length ?? 0;
    }
  } catch (error) {
    await supabase.from("lighthouse_rate_observations").delete().eq("extraction_id", extraction.id);
    await supabase.from("lighthouse_extractions").delete().eq("id", extraction.id);
    throw new Error(`Enregistrement des tarifs Lighthouse interrompu ; nettoyage tenté : ${error instanceof Error ? error.message : "erreur inconnue"}`);
  }

  return { extractionId: extraction.id, observationsInserted: inserted, observedAt };
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
    dataset: row.metadata?.parsedDataset?.records ? row.metadata.parsedDataset as LighthouseExtractionDataset : null,
  }));
}
