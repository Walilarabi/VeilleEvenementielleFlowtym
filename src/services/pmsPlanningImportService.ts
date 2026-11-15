import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessibleHotel } from "./lighthouseImportService";

export type PlanningCellStatus = "available" | "zero" | "unknown_marker" | "missing" | "invalid";

export interface PmsInventoryObservation {
  stayDate: string;
  remainingSellableRooms: number | null;
  rawValue: string | number | null;
  status: PlanningCellStatus;
}

export interface PmsRateObservation {
  stayDate: string;
  rateAmount: number | null;
  rawValue: string | number | null;
  status: PlanningCellStatus;
}

export interface PmsRatePlan {
  code: string;
  name: string;
  observations: PmsRateObservation[];
}

export interface PmsRoomType {
  code: string;
  name: string;
  inventory: PmsInventoryObservation[];
  ratePlans: PmsRatePlan[];
}

export interface PmsPlanningImport {
  sourceSystem: "topsys";
  fileName: string;
  snapshotAt: string;
  timezone: string;
  currency: "EUR";
  dateRange: { start: string; end: string };
  roomTypes: PmsRoomType[];
  summary: {
    dates: number;
    roomTypes: number;
    ratePlans: number;
    roomTypeRatePlanMappings: number;
    inventoryCells: number;
    inventoryUnknown: number;
    rateCells: number;
    rateUnknown: number;
    rateMissing: number;
    rateInvalid: number;
  };
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseStayDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const raw = String(value ?? "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const french = raw.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);
  if (french) return `${french[3]}-${String(french[2]).padStart(2, "0")}-${String(french[1]).padStart(2, "0")}`;
  return null;
}

function parseSnapshotTimestamp(title: unknown, timezone: string): string | null {
  const raw = normalizeText(title);
  const match = raw.match(/(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const monthIndex: Record<string, number> = {
    janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
    juillet: 6, aout: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11,
  };
  const [, dayText, monthText, yearText, hourText, minuteText, secondText] = match;
  const year = Number(yearText), month = monthIndex[monthText], day = Number(dayText);
  const hour = Number(hourText), minute = Number(minuteText), second = Number(secondText);
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) return null;

  // Détermine le décalage IANA du fuseau à midi le jour concerné (évite les bascules DST à minuit).
  const noon = new Date(Date.UTC(year, month, day, 12));
  const zoneName = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "shortOffset" })
    .formatToParts(noon).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const offset = zoneName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const offsetMinutes = offset
    ? (offset[1] === "-" ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3] ?? 0))
    : 0;
  return new Date(Date.UTC(year, month, day, hour, minute, second) - offsetMinutes * 60_000).toISOString();
}

function parseNumericCell(value: unknown): { amount: number | null; status: PlanningCellStatus } {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { amount: null, status: "missing" };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 0) return { amount: value, status: "available" };
    if (value === 0) return { amount: 0, status: "zero" };
    return { amount: null, status: "invalid" };
  }
  const raw = normalizeText(value);
  if (raw === "x" || raw === "n/a" || raw === "nd" || raw.includes("indisponible")) {
    return { amount: null, status: "unknown_marker" };
  }
  const cleaned = String(value).trim().replace(/[€\s]/g, "").replace(",", ".");
  const numeric = Number(cleaned);
  if (Number.isFinite(numeric) && numeric > 0) return { amount: numeric, status: "available" };
  if (numeric === 0) return { amount: 0, status: "zero" };
  return { amount: null, status: "invalid" };
}

function makeStableCode(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function parsePmsPlanningWorkbook(
  input: ArrayBuffer | Uint8Array,
  fileName: string,
  timezone = "Europe/Paris",
): PmsPlanningImport {
  const workbook = XLSX.read(input, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames.find((name) => normalizeText(name) === "planning");
  if (!sheetName) throw new Error("Onglet Planning introuvable dans le classeur PMS.");
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "" }) as unknown[][];
  if (rows.length < 3) throw new Error("Le planning PMS ne contient pas assez de lignes.");

  const header = rows[0] ?? [];
  const dateColumns = header.map((value, index) => ({ index, date: parseStayDate(value) }))
    .filter((item): item is { index: number; date: string } => item.index >= 3 && item.date !== null);
  if (dateColumns.length === 0) throw new Error("Aucune colonne de date reconnue à partir de la quatrième colonne.");
  for (let index = 1; index < dateColumns.length; index++) {
    if (dateColumns[index].date <= dateColumns[index - 1].date) {
      throw new Error("Les dates du planning doivent être uniques et strictement croissantes.");
    }
  }

  const snapshotAt = parseSnapshotTimestamp(header[0], timezone);
  if (!snapshotAt) throw new Error("Horodatage d'extraction introuvable dans le titre du planning.");

  const roomTypeMap = new Map<string, PmsRoomType>();
  let inventoryCells = 0, inventoryUnknown = 0, rateCells = 0, rateUnknown = 0, rateMissing = 0, rateInvalid = 0;

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] ?? [];
    const roomName = String(row[0] ?? "").trim();
    const descriptor = normalizeText(row[2]);
    if (!roomName) continue;

    const roomCode = makeStableCode(roomName);
    if (descriptor === "left for sale") {
      const room = roomTypeMap.get(roomCode) ?? { code: roomCode, name: roomName, inventory: [], ratePlans: [] };
      room.inventory = dateColumns.map(({ index, date }) => {
        const parsed = parseNumericCell(row[index]);
        inventoryCells++;
        if (parsed.status === "unknown_marker" || parsed.status === "missing" || parsed.status === "invalid") inventoryUnknown++;
        return { stayDate: date, remainingSellableRooms: parsed.amount, rawValue: typeof row[index] === "number" ? row[index] as number : String(row[index] ?? ""), status: parsed.status };
      });
      roomTypeMap.set(roomCode, room);
      continue;
    }

    if (descriptor !== "price (eur)" && !descriptor.startsWith("price")) continue;
    const rawPlan = String(row[1] ?? "").trim();
    if (!rawPlan) continue;
    const split = rawPlan.match(/^\s*(.*?)\s+-\s+(.*?)\s*$/);
    const code = (split?.[1] ?? rawPlan).trim();
    const name = (split?.[2] ?? code).trim();
    const room = roomTypeMap.get(roomCode) ?? { code: roomCode, name: roomName, inventory: [], ratePlans: [] };
    const observations = dateColumns.map(({ index, date }) => {
      const parsed = parseNumericCell(row[index]);
      rateCells++;
      if (parsed.status === "unknown_marker") rateUnknown++;
      if (parsed.status === "missing") rateMissing++;
      if (parsed.status === "invalid") rateInvalid++;
      return { stayDate: date, rateAmount: parsed.amount, rawValue: typeof row[index] === "number" ? row[index] as number : String(row[index] ?? ""), status: parsed.status };
    });
    const existing = room.ratePlans.find((plan) => plan.code === code);
    if (existing) existing.observations = observations;
    else room.ratePlans.push({ code, name, observations });
    roomTypeMap.set(roomCode, room);
  }

  const roomTypes = [...roomTypeMap.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  if (roomTypes.length === 0) throw new Error("Aucune typologie de chambre reconnue dans le planning.");
  if (roomTypes.some((room) => room.inventory.length !== dateColumns.length)) {
    throw new Error("Une ou plusieurs typologies ne disposent pas de ligne Left for sale complète.");
  }

  return {
    sourceSystem: "topsys",
    fileName,
    snapshotAt,
    timezone,
    currency: "EUR",
    dateRange: { start: dateColumns[0].date, end: dateColumns[dateColumns.length - 1].date },
    roomTypes,
    summary: {
      dates: dateColumns.length,
      roomTypes: roomTypes.length,
      ratePlans: new Set(roomTypes.flatMap((room) => room.ratePlans.map((plan) => plan.code))).size,
      roomTypeRatePlanMappings: roomTypes.reduce((sum, room) => sum + room.ratePlans.length, 0),
      inventoryCells,
      inventoryUnknown,
      rateCells,
      rateUnknown,
      rateMissing,
      rateInvalid,
    },
  };
}


export interface PmsPlanningPersistenceResult {
  ingestionJobId: string;
  inventoryRowsWritten: number;
  rateObservationsWritten: number;
  idempotent: boolean;
}

async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("SHA-256 indisponible dans ce navigateur sécurisé.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function persistPmsPlanningImport(
  supabase: SupabaseClient,
  hotel: AccessibleHotel,
  dataset: PmsPlanningImport,
  importedBy: string,
  onProgress?: (progress: { phase: "catalog" | "inventory" | "rates" | "complete"; completed: number; total: number }) => void,
): Promise<PmsPlanningPersistenceResult> {
  if (dataset.sourceSystem !== "topsys" || dataset.roomTypes.length === 0) {
    throw new Error("Le fichier n'est pas un planning Topsys valide.");
  }

  const uniquePlans = new Map<string, string>();
  for (const room of dataset.roomTypes) {
    for (const plan of room.ratePlans) {
      const previousName = uniquePlans.get(plan.code);
      if (previousName && previousName !== plan.name) {
        throw new Error("Le code de plan tarifaire " + plan.code + " porte plusieurs libellés. Corrigez le mapping avant import.");
      }
      uniquePlans.set(plan.code, plan.name);
    }
  }

  const sourceHash = await sha256Hex(JSON.stringify({
    hotelId: hotel.id,
    snapshotAt: dataset.snapshotAt,
    dateRange: dataset.dateRange,
    roomTypes: dataset.roomTypes,
  }));
  const idempotencyKey = "topsys:" + hotel.id + ":" + sourceHash;
  const importTime = new Date().toISOString();
  const recordsRead = dataset.summary.inventoryCells + dataset.summary.rateCells;
  const jobMetadata = {
    fileName: dataset.fileName,
    sourceHash,
    snapshotAt: dataset.snapshotAt,
    timezone: dataset.timezone,
    stayStart: dataset.dateRange.start,
    stayEnd: dataset.dateRange.end,
    roomTypeCount: dataset.summary.roomTypes,
    ratePlanCount: dataset.summary.ratePlans,
    roomTypeRatePlanMappings: dataset.summary.roomTypeRatePlanMappings,
    inventoryCells: dataset.summary.inventoryCells,
    rateCells: dataset.summary.rateCells,
    inventoryUnknown: dataset.summary.inventoryUnknown,
    rateUnknown: dataset.summary.rateUnknown,
    rateMissing: dataset.summary.rateMissing,
    rateInvalid: dataset.summary.rateInvalid,
  };

  const { data: existingJob, error: lookupError } = await supabase
    .from("data_ingestion_jobs")
    .select("id,status,metadata,records_written,started_at")
    .eq("organization_id", hotel.organization_id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (lookupError) throw new Error("Vérification d'idempotence Topsys impossible : " + lookupError.message);

  if (existingJob && existingJob.status === "completed") {
    const meta = (existingJob.metadata ?? {}) as Record<string, unknown>;
    return {
      ingestionJobId: existingJob.id,
      inventoryRowsWritten: Number(meta.inventoryRowsWritten ?? 0),
      rateObservationsWritten: Number(meta.rateObservationsWritten ?? 0),
      idempotent: true,
    };
  }
  if (existingJob && (existingJob.status === "running" || existingJob.status === "queued")) {
    const startedAt = existingJob.started_at ? new Date(existingJob.started_at).getTime() : 0;
    if (startedAt && Date.now() - startedAt < 30 * 60 * 1000) {
      throw new Error("Un import Topsys identique est déjà en cours. Attendez sa fin avant de relancer le fichier.");
    }
  }

  let ingestionJobId: string;
  if (existingJob) {
    const { data: resumed, error: resumeError } = await supabase
      .from("data_ingestion_jobs")
      .update({
        status: "running",
        started_at: importTime,
        finished_at: null,
        records_read: recordsRead,
        records_written: 0,
        records_rejected: 0,
        error_summary: null,
        metadata: jobMetadata,
      })
      .eq("id", existingJob.id)
      .select("id")
      .single();
    if (resumeError || !resumed) throw new Error("Relance du job Topsys impossible : " + (resumeError?.message ?? "réponse vide"));
    ingestionJobId = resumed.id;
  } else {
    const { data: created, error: createError } = await supabase
      .from("data_ingestion_jobs")
      .insert({
        organization_id: hotel.organization_id,
        hotel_id: hotel.id,
        source_system: "topsys",
        job_type: "pms_planning_import",
        status: "running",
        idempotency_key: idempotencyKey,
        started_at: importTime,
        records_read: recordsRead,
        records_written: 0,
        records_rejected: 0,
        created_by: importedBy,
        metadata: jobMetadata,
      })
      .select("id")
      .single();
    if (createError || !created) throw new Error("Création du job Topsys impossible : " + (createError?.message ?? "réponse vide"));
    ingestionJobId = created.id;
  }

  let inventoryRowsWritten = 0;
  let rateObservationsWritten = 0;
  try {
    onProgress?.({ phase: "catalog", completed: 0, total: dataset.roomTypes.length + uniquePlans.size });
    const roomTypeRows = dataset.roomTypes.map((room) => ({
      organization_id: hotel.organization_id,
      hotel_id: hotel.id,
      code: room.code,
      name: room.name,
    }));
    const { data: roomTypeData, error: roomTypeError } = await supabase
      .from("hotel_room_types")
      .upsert(roomTypeRows, { onConflict: "hotel_id,code" })
      .select("id,code");
    if (roomTypeError) throw new Error("Création des typologies Topsys impossible : " + roomTypeError.message);
    const roomTypeIds = new Map((roomTypeData ?? []).map((row) => [row.code, row.id]));
    if (roomTypeIds.size !== dataset.roomTypes.length) throw new Error("Certaines typologies n'ont pas pu être rapprochées après upsert.");

    const { data: existingRatePlanData, error: existingRatePlanError } = await supabase
      .from("hotel_rate_plans")
      .select("id,code,room_type_id,is_active,is_public,refundable,meal_plan")
      .eq("hotel_id", hotel.id);
    if (existingRatePlanError) throw new Error("Lecture des plans tarifaires existants impossible : " + existingRatePlanError.message);
    const existingRatePlans = new Map((existingRatePlanData ?? []).map((plan) => [plan.code, plan]));
    const ratePlanRows = [...uniquePlans.entries()].map(([code, name]) => {
      const existing = existingRatePlans.get(code);
      return {
        organization_id: hotel.organization_id,
        hotel_id: hotel.id,
        room_type_id: existing?.room_type_id ?? null,
        code,
        name,
        currency: dataset.currency,
        // Un code importé n'est pas automatiquement déclaré vendable/public.
        // Les statuts existants sont préservés ; les nouveaux plans restent inactifs jusqu'à validation.
        is_active: existing?.is_active ?? false,
        is_public: existing?.is_public ?? false,
        refundable: existing?.refundable ?? null,
        meal_plan: existing?.meal_plan ?? null,
      };
    });
    const { data: ratePlanData, error: ratePlanError } = await supabase
      .from("hotel_rate_plans")
      .upsert(ratePlanRows, { onConflict: "hotel_id,code" })
      .select("id,code");
    if (ratePlanError) throw new Error("Création des plans tarifaires Topsys impossible : " + ratePlanError.message);
    const ratePlanIds = new Map((ratePlanData ?? []).map((row) => [row.code, row.id]));
    if (ratePlanIds.size !== uniquePlans.size) throw new Error("Certains plans tarifaires n'ont pas pu être rapprochés après upsert.");
    onProgress?.({ phase: "catalog", completed: roomTypeIds.size + ratePlanIds.size, total: dataset.roomTypes.length + uniquePlans.size });

    const inventoryRows = dataset.roomTypes.flatMap((room) => {
      const roomTypeId = roomTypeIds.get(room.code);
      if (!roomTypeId) throw new Error("Typologie sans identifiant Supabase : " + room.code);
      return room.inventory.map((observation) => ({
        organization_id: hotel.organization_id,
        hotel_id: hotel.id,
        room_type_id: roomTypeId,
        stay_date: observation.stayDate,
        snapshot_at: dataset.snapshotAt,
        source_system: "topsys",
        source_status: "imported",
        total_rooms: null,
        sellable_rooms: null,
        rooms_sold: null,
        rooms_available: observation.remainingSellableRooms,
        out_of_order_rooms: null,
        complimentary_rooms: null,
        occupancy_pct: null,
        current_bar: null,
        currency: dataset.currency,
        raw_payload: {
          fileName: dataset.fileName,
          sourceLabel: "Left for sale",
          rawValue: observation.rawValue,
          cellStatus: observation.status,
          ingestionJobId,
        },
        ingestion_job_id: ingestionJobId,
      }));
    });

    const inventoryBatchSize = 1000;
    for (let offset = 0; offset < inventoryRows.length; offset += inventoryBatchSize) {
      const batch = inventoryRows.slice(offset, offset + inventoryBatchSize);
      const { error } = await supabase
        .from("hotel_inventory_snapshots")
        .upsert(batch, { onConflict: "hotel_id,room_type_id,stay_date,snapshot_at,source_system" });
      if (error) throw new Error("Écriture des snapshots d'inventaire impossible : " + error.message);
      inventoryRowsWritten += batch.length;
      onProgress?.({ phase: "inventory", completed: inventoryRowsWritten, total: inventoryRows.length });
    }

    const rateRows = dataset.roomTypes.flatMap((room) => {
      const roomTypeId = roomTypeIds.get(room.code);
      if (!roomTypeId) throw new Error("Typologie sans identifiant Supabase : " + room.code);
      return room.ratePlans.flatMap((plan) => {
        const ratePlanId = ratePlanIds.get(plan.code);
        if (!ratePlanId) throw new Error("Plan tarifaire sans identifiant Supabase : " + plan.code);
        return plan.observations.map((observation) => ({
          organization_id: hotel.organization_id,
          hotel_id: hotel.id,
          room_type_id: roomTypeId,
          rate_plan_id: ratePlanId,
          ingestion_job_id: ingestionJobId,
          stay_date: observation.stayDate,
          snapshot_at: dataset.snapshotAt,
          source_system: "topsys",
          source_status: "imported",
          rate_amount: observation.rateAmount,
          currency: dataset.currency,
          availability_status: observation.status,
          raw_payload: {
            fileName: dataset.fileName,
            ratePlanCode: plan.code,
            ratePlanName: plan.name,
            rawValue: observation.rawValue,
            cellStatus: observation.status,
          },
        }));
      });
    });

    const rateBatchSize = 2000;
    for (let offset = 0; offset < rateRows.length; offset += rateBatchSize) {
      const batch = rateRows.slice(offset, offset + rateBatchSize);
      const { error } = await supabase
        .from("hotel_rate_plan_observations")
        .upsert(batch, { onConflict: "hotel_id,room_type_id,rate_plan_id,stay_date,snapshot_at,source_system" });
      if (error) throw new Error("Écriture des observations tarifaires impossible : " + error.message);
      rateObservationsWritten += batch.length;
      onProgress?.({ phase: "rates", completed: rateObservationsWritten, total: rateRows.length });
    }

    const finishedAt = new Date().toISOString();
    const completedMetadata = {
      ...jobMetadata,
      inventoryRowsWritten,
      rateObservationsWritten,
      totalRowsWritten: inventoryRowsWritten + rateObservationsWritten,
    };
    const { error: finishError } = await supabase
      .from("data_ingestion_jobs")
      .update({
        status: "completed",
        finished_at: finishedAt,
        records_written: inventoryRowsWritten + rateObservationsWritten,
        records_rejected: 0,
        error_summary: null,
        metadata: completedMetadata,
      })
      .eq("id", ingestionJobId);
    if (finishError) throw new Error("Clôture du job Topsys impossible : " + finishError.message);

    onProgress?.({ phase: "complete", completed: 1, total: 1 });
    return { ingestionJobId, inventoryRowsWritten, rateObservationsWritten, idempotent: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "erreur inconnue";
    const written = inventoryRowsWritten + rateObservationsWritten;
    await supabase.from("data_ingestion_jobs").update({
      status: written > 0 ? "partial" : "failed",
      finished_at: new Date().toISOString(),
      records_written: written,
      records_rejected: 0,
      error_summary: errorMessage,
      metadata: {
        ...jobMetadata,
        inventoryRowsWritten,
        rateObservationsWritten,
        partialWrite: written > 0,
      },
    }).eq("id", ingestionJobId);
    throw new Error("Import Topsys interrompu : " + errorMessage + (written > 0 ? " ; relancez le même fichier pour reprendre sans doublons." : ""));
  }
}
