import * as XLSX from "xlsx";

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
      ratePlans: roomTypes.reduce((sum, room) => sum + room.ratePlans.length, 0),
      inventoryCells,
      inventoryUnknown,
      rateCells,
      rateUnknown,
      rateMissing,
      rateInvalid,
    },
  };
}
