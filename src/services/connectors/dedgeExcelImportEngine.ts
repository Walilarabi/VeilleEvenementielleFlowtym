/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Moteur d'Import Excel / CSV Intelligent D-EDGE Planning & Multi-Format
 * Supporte :
 *   - Fichiers D-EDGE Planning (ex: H2258 - FOLKESTONE OPERA - Planning (4).xlsx)
 *     avec colonnes Chambre / Plan tarifaire / Type de donnée ("Price (EUR)" vs "Left for sale") / Dates en colonnes
 *   - Formats génériques (.xlsx, .xls, .csv)
 *   - Cellules fusionnées, cellules vides, valeurs incohérentes, doublons, multi-onglets
 *   - Modèles de mapping réutilisables par hôtel
 *   - Prévisualisation Diff non destructive & Rapport détaillé exportable
 */

import * as XLSX from 'xlsx';
import {
  DedgeImportAnalysis,
  DedgeImportReport,
  DedgeParsedCellRecord,
  Hotel,
  HotelTariffConfiguration,
  ImportAnomalyItem,
  ImportDataMetricType,
  ImportDiffRow,
  ImportProviderPreset,
  ImportTemplateMapping,
  RateCalendarCell,
  RatePlanConfig,
  RoomCategoryConfig,
} from '../../types';
import {
  getHotelTariffConfig,
  saveHotelTariffConfig,
} from '../tariffConfigurationService';
import {
  buildCellKey,
  getRatePlanningCells,
  saveRatePlanningCells,
} from '../ratePlanningSyncService';
import { appendLocalSyncLog } from './connectorRegistry';

const IMPORT_TEMPLATES_KEY_PREFIX = 'flowtym_import_templates_v1_';

function slugCode(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);
}

function normalizePlanCode(label: string): string {
  const trimmed = label.trim();
  // Ex: "BAR - Best Available Rate" ou "[BAR] Tarif Flexible" -> "BAR"
  const bracketMatch = trimmed.match(/^\[([A-Za-z0-9_-]+)\]/);
  if (bracketMatch) return bracketMatch[1].toUpperCase();
  const dashSplit = trimmed.split(/\s+[-–:]\s+/)[0]?.trim();
  if (dashSplit && dashSplit.length <= 16 && /^[A-Za-z0-9_-]+$/.test(dashSplit)) {
    return dashSplit.toUpperCase();
  }
  return slugCode(trimmed).toUpperCase().slice(0, 16) || 'PLAN';
}

export function classifyMetricTypeLabel(rawLabel: string): ImportDataMetricType {
  const lower = String(rawLabel || '').trim().toLowerCase();
  if (!lower) return 'unknown';
  if (
    lower.includes('price') ||
    lower.includes('tarif') ||
    lower.includes('prix') ||
    lower.includes('rate') ||
    lower.includes('adr') ||
    lower === 'eur'
  ) {
    return 'rate';
  }
  if (
    lower.includes('left for sale') ||
    lower.includes('left_for_sale') ||
    lower.includes('disponib') ||
    lower.includes('inventaire') ||
    lower.includes('inventory') ||
    lower.includes('stock') ||
    lower.includes('allot')
  ) {
    return 'inventory';
  }
  if (lower.includes('min') && (lower.includes('stay') || lower.includes('los') || lower.includes('sejour'))) {
    return 'min_stay';
  }
  if (lower.includes('max') && (lower.includes('stay') || lower.includes('los') || lower.includes('sejour'))) {
    return 'max_stay';
  }
  if (lower === 'cta' || lower.includes('closed to arrival')) return 'cta';
  if (lower === 'ctd' || lower.includes('closed to departure')) return 'ctd';
  if (lower.includes('stop sell') || lower.includes('stopsell') || lower.includes('fermeture') || lower === 'closed') {
    return 'stop_sell';
  }
  return 'unknown';
}

export function parseFlexibleDateHeader(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;

  // Numéro de série date Excel (entre 2020 et 2040 -> ~43831 à 51500)
  if (typeof raw === 'number' && raw > 40000 && raw < 60000) {
    const ssf = (XLSX as any).SSF || (XLSX as any).default?.SSF;
    if (ssf?.parse_date_code) {
      const parsed = ssf.parse_date_code(raw);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        return `${parsed.y}-${m}-${d}`;
      }
    }
    // Fallback mathématique exact (époque Excel 1899-12-30 UTC)
    const excelMs = Date.UTC(1899, 11, 30) + Math.floor(raw) * 86400000;
    return new Date(excelMs).toISOString().slice(0, 10);
  }

  const s = String(raw).trim();
  if (!s) return null;

  // ISO YYYY-MM-DD (éventuellement suivi d'heure)
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  // DD/MM/YYYY ou DD-MM-YYYY (éventuellement préfixé par "Lun 12/05/2026")
  const frMatch = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (frMatch) {
    const day = Number(frMatch[1]);
    const month = Number(frMatch[2]);
    const year = Number(frMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Format texte anglais/français court type "2026-05-12" ou Date.parse valide contenant 4 chiffres d'année
  if (/\d{4}/.test(s)) {
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toISOString().slice(0, 10);
    }
  }

  return null;
}

function parseNumericCell(raw: unknown): { value: number | null; empty: boolean; error?: string } {
  if (raw === null || raw === undefined) return { value: null, empty: true };
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { value: null, empty: false, error: 'Nombre non fini' };
    if (raw < 0) return { value: null, empty: false, error: `Valeur négative interdite (${raw})` };
    return { value: Math.round(raw * 100) / 100, empty: false };
  }
  const s = String(raw).trim();
  if (!s || s === '-' || s === '—' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'null') {
    return { value: null, empty: true };
  }
  const cleaned = s
    .replace(/[€$£\s\u00A0]/g, '')
    .replace(/,(\d{1,2})$/, '.$1')
    .replace(/,/g, '');
  const n = Number(cleaned);
  if (Number.isNaN(n) || !Number.isFinite(n)) {
    return { value: null, empty: false, error: `Valeur non numérique (« ${s} »)` };
  }
  if (n < 0) {
    return { value: null, empty: false, error: `Valeur négative interdite (« ${s} »)` };
  }
  return { value: Math.round(n * 100) / 100, empty: false };
}

function detectCsvDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const semi = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  const tab = (firstLine.match(/\t/g) || []).length;
  if (semi >= comma && semi >= tab) return ';';
  if (tab >= comma && tab >= semi) return '\t';
  return ',';
}

/**
 * ÉTAPE 1 & 2 : Lecture & Analyse structurelle automatique d'un classeur D-EDGE Planning ou générique
 */
export function analyzeSpreadsheetBuffer(
  buffer: ArrayBuffer | Uint8Array,
  fileName: string,
  hotel?: Hotel
): DedgeImportAnalysis {
  const ext = fileName.toLowerCase().endsWith('.csv')
    ? 'csv'
    : fileName.toLowerCase().endsWith('.xls')
    ? 'xls'
    : 'xlsx';

  let delimiter: string | undefined;
  let wb: XLSX.WorkBook;

  if (ext === 'csv') {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
    delimiter = detectCsvDelimiter(text);
    wb = XLSX.read(text, { type: 'string', FS: delimiter });
  } else {
    wb = XLSX.read(buffer, { type: 'array' });
  }

  const cfg = hotel ? getHotelTariffConfig(hotel) : null;
  const records: DedgeParsedCellRecord[] = [];
  const anomalies: ImportAnomalyItem[] = [];

  let detectedProvider: ImportProviderPreset = 'generic_matrix';
  let primaryRoomCol = 'Chambre';
  let primaryPlanCol = 'Code & Libellé du plan tarifaire';
  let primaryTypeCol = 'Type de donnée';
  const detectedDateColsMap = new Map<string, string>();
  const roomCounts = new Map<string, number>();
  const planCounts = new Map<string, number>();
  const typeCounts = new Map<string, { metricType: ImportDataMetricType; count: number }>();

  let totalRowsScanned = 0;
  let missingCells = 0;
  let duplicateCells = 0;
  let errorCells = 0;
  const seenKeys = new Set<string>();

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    // Propagation des cellules fusionnées (courant dans D-EDGE Planning)
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
    if (!rows.length) continue;

    if (Array.isArray(ws['!merges'])) {
      for (const merge of ws['!merges']) {
        const masterVal = rows[merge.s.r]?.[merge.s.c];
        if (masterVal !== undefined && masterVal !== '') {
          for (let r = merge.s.r; r <= merge.e.r; r++) {
            for (let c = merge.s.c; c <= merge.e.c; c++) {
              if (rows[r] && (rows[r][c] === '' || rows[r][c] === undefined)) {
                rows[r][c] = masterVal;
              }
            }
          }
        }
      }
    }

    // Détection intelligente de la ligne d'en-tête (recherche d'au moins 2 dates OU colonnes D-EDGE)
    let headerRowIdx = -1;
    let dateColIndices: { colIdx: number; header: string; isoDate: string }[] = [];

    for (let r = 0; r < Math.min(rows.length, 20); r++) {
      const row = rows[r] || [];
      const rowStrings = row.map((cell) => String(cell ?? '').trim());
      const datesInRow: { colIdx: number; header: string; isoDate: string }[] = [];
      row.forEach((cell, idx) => {
        const iso = parseFlexibleDateHeader(cell);
        if (iso) datesInRow.push({ colIdx: idx, header: rowStrings[idx] || iso, isoDate: iso });
      });

      const hasDedgeHeader = rowStrings.some((h) => {
        const l = h.toLowerCase();
        return (
          l.includes('chambre') ||
          l.includes('room') ||
          l.includes('plan tarifaire') ||
          l.includes('type de donnée') ||
          l.includes('type de donnee')
        );
      });

      if (datesInRow.length >= 2 || (hasDedgeHeader && datesInRow.length >= 1)) {
        headerRowIdx = r;
        dateColIndices = datesInRow;
        break;
      }
    }

    if (headerRowIdx < 0) continue;

    const headerRow = (rows[headerRowIdx] || []).map((c) => String(c ?? '').trim());
    const firstDateColIdx = dateColIndices[0]?.colIdx ?? headerRow.length;

    let roomColIdx = headerRow.findIndex((h) => {
      const l = h.toLowerCase();
      return l.includes('chambre') || l.includes('room') || l.includes('catégorie') || l.includes('categorie');
    });
    let planColIdx = headerRow.findIndex((h) => {
      const l = h.toLowerCase();
      return l.includes('plan') || l.includes('rate plan') || l.includes('libellé') || l.includes('tarifaire');
    });
    let typeColIdx = headerRow.findIndex((h) => {
      const l = h.toLowerCase();
      return (
        l.includes('type de donnée') ||
        l.includes('type de donnee') ||
        l.includes('data type') ||
        l.includes('donnée') ||
        l.includes('metric')
      );
    });

    if (roomColIdx < 0 && firstDateColIdx >= 1) roomColIdx = 0;
    if (planColIdx < 0 && firstDateColIdx >= 2) planColIdx = 1;
    if (typeColIdx < 0 && firstDateColIdx >= 3) typeColIdx = 2;

    if (roomColIdx >= 0 && headerRow[roomColIdx]) primaryRoomCol = headerRow[roomColIdx];
    if (planColIdx >= 0 && headerRow[planColIdx]) primaryPlanCol = headerRow[planColIdx];
    if (typeColIdx >= 0 && headerRow[typeColIdx]) {
      primaryTypeCol = headerRow[typeColIdx];
      detectedProvider = 'dedge_planning';
    }

    dateColIndices.forEach((dc) => {
      if (!detectedDateColsMap.has(dc.isoDate)) detectedDateColsMap.set(dc.isoDate, dc.header);
    });

    // Parcourir les lignes de données avec mémorisation de la dernière chambre/plan non vide (cellules implicites D-EDGE)
    let lastRoomLabel = '';
    let lastPlanLabel = '';

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const nonEmptyCount = row.filter((c) => String(c ?? '').trim() !== '').length;
      if (nonEmptyCount === 0) continue;

      totalRowsScanned++;
      const rawRoom = roomColIdx >= 0 ? String(row[roomColIdx] ?? '').trim() : '';
      const rawPlan = planColIdx >= 0 ? String(row[planColIdx] ?? '').trim() : '';
      const rawType = typeColIdx >= 0 ? String(row[typeColIdx] ?? '').trim() : 'Price (EUR)';

      // Ignorer les lignes de totaux ou sous-totaux
      const combinedCheck = `${rawRoom} ${rawPlan} ${rawType}`.toLowerCase();
      if (combinedCheck.startsWith('total') || combinedCheck.includes('exporté le')) continue;

      if (rawRoom) lastRoomLabel = rawRoom;
      if (rawPlan) lastPlanLabel = rawPlan;

      const roomLabel = rawRoom || lastRoomLabel || 'Chambre Non Spécifiée';
      const planLabel = rawPlan || (typeColIdx >= 0 ? lastPlanLabel : '') || 'BAR';
      const dataTypeLabel = rawType || 'Price (EUR)';
      const metricType = classifyMetricTypeLabel(dataTypeLabel);

      if (
        dataTypeLabel.toLowerCase().includes('price (eur)') ||
        dataTypeLabel.toLowerCase().includes('left for sale')
      ) {
        detectedProvider = 'dedge_planning';
      }

      roomCounts.set(roomLabel, (roomCounts.get(roomLabel) || 0) + 1);
      planCounts.set(planLabel, (planCounts.get(planLabel) || 0) + 1);
      const prevT = typeCounts.get(dataTypeLabel);
      typeCounts.set(dataTypeLabel, {
        metricType,
        count: (prevT?.count || 0) + 1,
      });

      for (const dc of dateColIndices) {
        const rawVal = row[dc.colIdx];
        const rawStr = String(rawVal ?? '').trim();
        const dedupKey = `${roomLabel.toLowerCase()}::${planLabel.toLowerCase()}::${metricType}::${dc.isoDate}`;

        if (seenKeys.has(dedupKey)) {
          duplicateCells++;
          anomalies.push({
            id: `anom-dup-${r}-${dc.colIdx}-${anomalies.length}`,
            rowIndex: r + 1,
            sheetName,
            stayDate: dc.isoDate,
            roomLabel,
            planLabel,
            severity: 'warning',
            code: 'duplicate_row',
            message: `Doublon détecté pour ${roomLabel} / ${planLabel} (${dataTypeLabel}) le ${dc.isoDate}.`,
          });
          continue;
        }

        if (metricType === 'cta' || metricType === 'ctd' || metricType === 'stop_sell') {
          if (!rawStr) {
            missingCells++;
            continue;
          }
          seenKeys.add(dedupKey);
          const boolVal = ['1', 'true', 'oui', 'yes', 'x', 'closed', 'stop'].includes(rawStr.toLowerCase());
          records.push({
            rowIndex: r + 1,
            sheetName,
            externalRoomLabel: roomLabel,
            externalPlanLabel: planLabel,
            dataTypeLabel,
            metricType,
            stayDate: dc.isoDate,
            numericValue: boolVal ? 1 : 0,
            booleanValue: boolVal,
            rawCellValue: rawStr,
            isValid: true,
          });
          continue;
        }

        const parsed = parseNumericCell(rawVal);
        if (parsed.empty) {
          missingCells++;
          continue;
        }
        if (parsed.error || parsed.value === null) {
          errorCells++;
          anomalies.push({
            id: `anom-err-${r}-${dc.colIdx}-${anomalies.length}`,
            rowIndex: r + 1,
            sheetName,
            stayDate: dc.isoDate,
            roomLabel,
            planLabel,
            severity: 'error',
            code: parsed.error?.includes('négative') ? 'negative_value' : 'invalid_number',
            message: `${parsed.error || 'Valeur invalide'} (${roomLabel} / ${planLabel} le ${dc.isoDate})`,
          });
          records.push({
            rowIndex: r + 1,
            sheetName,
            externalRoomLabel: roomLabel,
            externalPlanLabel: planLabel,
            dataTypeLabel,
            metricType,
            stayDate: dc.isoDate,
            numericValue: null,
            rawCellValue: rawStr,
            isValid: false,
            anomalyReason: parsed.error,
          });
          continue;
        }

        seenKeys.add(dedupKey);
        records.push({
          rowIndex: r + 1,
          sheetName,
          externalRoomLabel: roomLabel,
          externalPlanLabel: planLabel,
          dataTypeLabel,
          metricType,
          stayDate: dc.isoDate,
          numericValue: parsed.value,
          rawCellValue: rawStr,
          isValid: true,
        });
      }
    }
  }

  const matchRoomCode = (extLabel: string): string => {
    if (cfg) {
      const lower = extLabel.toLowerCase();
      const found = cfg.roomCategories.find(
        (rc) =>
          rc.name.toLowerCase() === lower ||
          rc.code.toLowerCase() === lower ||
          rc.cmRoomId.toLowerCase() === lower ||
          rc.pmsRoomId.toLowerCase() === lower ||
          lower.includes(rc.code.toLowerCase()) ||
          rc.name.toLowerCase().includes(lower)
      );
      if (found) return found.code;
    }
    return slugCode(extLabel) || 'classique';
  };

  const matchPlanCode = (extLabel: string): string => {
    const candidate = normalizePlanCode(extLabel);
    if (cfg) {
      const lower = extLabel.toLowerCase();
      const found = cfg.ratePlans.find(
        (rp) =>
          rp.code.toUpperCase() === candidate ||
          rp.name.toLowerCase() === lower ||
          rp.cmExternalId.toLowerCase() === lower ||
          rp.pmsExternalId.toLowerCase() === lower ||
          lower.includes(rp.code.toLowerCase())
      );
      if (found) return found.code;
    }
    return candidate;
  };

  const sortedDates = Array.from(detectedDateColsMap.keys()).sort();

  return {
    fileName,
    fileFormat: ext,
    detectedProvider,
    delimiter,
    sheetNames: wb.SheetNames,
    detectedColumns: {
      roomColumn: primaryRoomCol,
      planColumn: primaryPlanCol,
      dataTypeColumn: primaryTypeCol,
      dateColumns: sortedDates.map((d) => ({
        isoDate: d,
        header: detectedDateColsMap.get(d) || d,
      })),
    },
    detectedRooms: Array.from(roomCounts.entries()).map(([externalLabel, rowCount]) => ({
      externalLabel,
      suggestedInternalCode: matchRoomCode(externalLabel),
      rowCount,
    })),
    detectedPlans: Array.from(planCounts.entries()).map(([externalLabel, rowCount]) => ({
      externalLabel,
      suggestedInternalCode: matchPlanCode(externalLabel),
      rowCount,
    })),
    detectedDataTypes: Array.from(typeCounts.entries()).map(([label, v]) => ({
      label,
      metricType: v.metricType,
      count: v.count,
    })),
    dateRange: {
      start: sortedDates[0] || null,
      end: sortedDates[sortedDates.length - 1] || null,
      totalDates: sortedDates.length,
    },
    records,
    anomalies,
    stats: {
      totalRowsScanned,
      validRatePoints: records.filter((r) => r.isValid && r.metricType === 'rate').length,
      validInventoryPoints: records.filter((r) => r.isValid && r.metricType === 'inventory').length,
      validRestrictionPoints: records.filter(
        (r) =>
          r.isValid &&
          (r.metricType === 'min_stay' ||
            r.metricType === 'max_stay' ||
            r.metricType === 'cta' ||
            r.metricType === 'ctd' ||
            r.metricType === 'stop_sell')
      ).length,
      missingCells,
      duplicateCells,
      errorCells,
    },
  };
}

/**
 * ÉTAPE 3 : Modèles de Mapping réutilisables par hôtel
 */
export function getImportMappingTemplates(hotelId: string): ImportTemplateMapping[] {
  try {
    const raw = localStorage.getItem(`${IMPORT_TEMPLATES_KEY_PREFIX}${hotelId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return [];
}

export function saveImportMappingTemplate(
  hotelId: string,
  template: Omit<ImportTemplateMapping, 'id' | 'hotelId' | 'createdAt' | 'updatedAt'> & { id?: string }
): ImportTemplateMapping[] {
  const existing = getImportMappingTemplates(hotelId);
  const now = new Date().toISOString();
  const nextItem: ImportTemplateMapping = {
    id: template.id || `tpl-${hotelId}-${Date.now()}`,
    hotelId,
    name: template.name.trim() || 'Modèle D-EDGE Planning',
    providerPreset: template.providerPreset,
    roomColumnName: template.roomColumnName,
    ratePlanColumnName: template.ratePlanColumnName,
    dataTypeColumnName: template.dataTypeColumnName,
    priceTypeValue: template.priceTypeValue,
    inventoryTypeValue: template.inventoryTypeValue,
    roomCodeMappings: template.roomCodeMappings,
    planCodeMappings: template.planCodeMappings,
    defaultCurrency: template.defaultCurrency,
    createdAt: existing.find((t) => t.id === template.id)?.createdAt || now,
    updatedAt: now,
  };
  const next = [nextItem, ...existing.filter((t) => t.id !== nextItem.id)].slice(0, 30);
  try {
    localStorage.setItem(`${IMPORT_TEMPLATES_KEY_PREFIX}${hotelId}`, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

export function deleteImportMappingTemplate(hotelId: string, templateId: string): ImportTemplateMapping[] {
  const next = getImportMappingTemplates(hotelId).filter((t) => t.id !== templateId);
  try {
    localStorage.setItem(`${IMPORT_TEMPLATES_KEY_PREFIX}${hotelId}`, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

/**
 * ÉTAPE 4 : Prévisualisation Diff non destructive (existant vs nouveau vs modifié vs rejeté)
 */
export function generateDedgeImportDiff(
  hotel: Hotel,
  analysis: DedgeImportAnalysis,
  roomCodeMappings: Record<string, string>,
  planCodeMappings: Record<string, string>
): ImportDiffRow[] {
  const cells = getRatePlanningCells(hotel);
  const cfg = getHotelTariffConfig(hotel);
  const cellMap = new Map(cells.map((c) => [c.cellKey, c]));
  const roomNameMap = new Map(cfg.roomCategories.map((rc) => [rc.code, rc.name]));
  const planNameMap = new Map(cfg.ratePlans.map((rp) => [rp.code, rp.name]));

  const diffRows: ImportDiffRow[] = [];

  for (const rec of analysis.records) {
    const internalRoom = roomCodeMappings[rec.externalRoomLabel] || slugCode(rec.externalRoomLabel);
    const internalPlan = planCodeMappings[rec.externalPlanLabel] || normalizePlanCode(rec.externalPlanLabel);
    const cellKey = buildCellKey(hotel.id, internalRoom, internalPlan, rec.stayDate);
    const existing = cellMap.get(cellKey);

    if (!rec.isValid) {
      diffRows.push({
        cellKey,
        stayDate: rec.stayDate,
        roomCode: internalRoom,
        roomName: roomNameMap.get(internalRoom) || rec.externalRoomLabel,
        planCode: internalPlan,
        planName: planNameMap.get(internalPlan) || rec.externalPlanLabel,
        metricType: rec.metricType === 'inventory' ? 'inventory' : rec.metricType === 'rate' ? 'rate' : 'restriction',
        changeType: 'rejected',
        existingValue: existing?.currentRateEur ?? null,
        incomingValue: rec.rawCellValue,
        reason: rec.anomalyReason,
      });
      continue;
    }

    if (rec.metricType === 'rate' && rec.numericValue !== null) {
      const incoming = Math.round(rec.numericValue);
      const prev = existing ? existing.currentRateEur : null;
      const changeType = prev === null ? 'new' : prev === incoming ? 'unchanged' : 'modified';
      diffRows.push({
        cellKey,
        stayDate: rec.stayDate,
        roomCode: internalRoom,
        roomName: roomNameMap.get(internalRoom) || rec.externalRoomLabel,
        planCode: internalPlan,
        planName: planNameMap.get(internalPlan) || rec.externalPlanLabel,
        metricType: 'rate',
        changeType,
        existingValue: prev,
        incomingValue: incoming,
        deltaEur: prev !== null ? incoming - prev : null,
      });
    } else if (rec.metricType === 'inventory' && rec.numericValue !== null) {
      const incoming = Math.round(rec.numericValue);
      const prev = existing ? existing.inventoryAvailable : null;
      const changeType = prev === null ? 'new' : prev === incoming ? 'unchanged' : 'modified';
      diffRows.push({
        cellKey,
        stayDate: rec.stayDate,
        roomCode: internalRoom,
        roomName: roomNameMap.get(internalRoom) || rec.externalRoomLabel,
        planCode: internalPlan,
        planName: planNameMap.get(internalPlan) || rec.externalPlanLabel,
        metricType: 'inventory',
        changeType,
        existingValue: prev,
        incomingValue: incoming,
        deltaEur: prev !== null ? incoming - prev : null,
      });
    } else if (
      rec.metricType === 'min_stay' ||
      rec.metricType === 'max_stay' ||
      rec.metricType === 'cta' ||
      rec.metricType === 'ctd' ||
      rec.metricType === 'stop_sell'
    ) {
      const incoming =
        rec.metricType === 'cta' || rec.metricType === 'ctd' || rec.metricType === 'stop_sell'
          ? rec.booleanValue
            ? 'Oui'
            : 'Non'
          : Math.round(rec.numericValue || 1);
      diffRows.push({
        cellKey,
        stayDate: rec.stayDate,
        roomCode: internalRoom,
        roomName: roomNameMap.get(internalRoom) || rec.externalRoomLabel,
        planCode: internalPlan,
        planName: planNameMap.get(internalPlan) || rec.externalPlanLabel,
        metricType: 'restriction',
        changeType: existing ? 'modified' : 'new',
        existingValue: existing
          ? rec.metricType === 'min_stay'
            ? existing.minStay
            : rec.metricType === 'stop_sell'
            ? existing.isClosed
              ? 'Oui'
              : 'Non'
            : '—'
          : null,
        incomingValue: incoming,
      });
    }
  }

  return diffRows;
}

/**
 * ÉTAPE 5 & 6 : Exécution transactionnelle après confirmation explicite + Rapport détaillé
 */
export function executeDedgeImport(
  hotel: Hotel,
  params: {
    analysis: DedgeImportAnalysis;
    roomCodeMappings: Record<string, string>;
    planCodeMappings: Record<string, string>;
    autoCreateMissingRooms: boolean;
    autoCreateMissingPlans: boolean;
    overwriteExisting: boolean;
    actor?: string;
  }
): {
  config: HotelTariffConfiguration;
  cells: RateCalendarCell[];
  report: DedgeImportReport;
} {
  const actor = params.actor || 'Wali Larabi (Import D-EDGE)';
  const now = new Date().toISOString();
  const cfg = getHotelTariffConfig(hotel);

  let updatedRooms: RoomCategoryConfig[] = [...cfg.roomCategories];
  let updatedPlans: RatePlanConfig[] = [...cfg.ratePlans];
  let createdRoomsCount = 0;
  let createdPlansCount = 0;

  // 1. Création éventuelle des catégories manquantes (anti-doublon strict)
  if (params.autoCreateMissingRooms) {
    for (const detRoom of params.analysis.detectedRooms) {
      const targetCode = params.roomCodeMappings[detRoom.externalLabel] || detRoom.suggestedInternalCode;
      if (!updatedRooms.some((rc) => rc.code.toLowerCase() === targetCode.toLowerCase())) {
        createdRoomsCount++;
        updatedRooms.push({
          id: `rc-${hotel.id}-${targetCode}-${Date.now()}`,
          hotelId: hotel.id,
          code: targetCode,
          name: detRoom.externalLabel,
          description: `Catégorie créée par import ${params.analysis.fileName}`,
          physicalRooms: 10,
          sellableRooms: 10,
          maxCapacity: 2,
          maxAdults: 2,
          maxChildren: 1,
          standardOccupancy: 2,
          maxOccupancy: 2,
          isActive: true,
          pmsRoomId: '',
          cmRoomId: targetCode.toUpperCase(),
          applicableRatePlanCodes: updatedPlans.map((p) => p.code),
          extraAdultSupplementEur: 40,
          extraChildSupplementEur: 20,
          thirdAdultSupplementEur: 45,
          singleOccupancySupplementEur: -15,
          tripleOccupancySupplementEur: 45,
          baseOffsetEur: 0,
          weightPercent: 15,
          provenance: 'excel',
        });
      }
    }
  }

  // 2. Création éventuelle des plans tarifaires manquants (anti-doublon strict)
  if (params.autoCreateMissingPlans) {
    for (const detPlan of params.analysis.detectedPlans) {
      const targetCode = params.planCodeMappings[detPlan.externalLabel] || detPlan.suggestedInternalCode;
      if (!updatedPlans.some((rp) => rp.code.toUpperCase() === targetCode.toUpperCase())) {
        createdPlansCount++;
        updatedPlans.push({
          id: `rp-${hotel.id}-${targetCode}-${Date.now()}`,
          hotelId: hotel.id,
          code: targetCode.toUpperCase(),
          name: detPlan.externalLabel,
          description: `Plan importé depuis ${params.analysis.fileName}`,
          planNature: targetCode.toUpperCase() === 'BAR' ? 'reference' : 'independent',
          referencePlanCode: null,
          calculationMode: 'independent',
          variationValue: 0,
          relationActive: false,
          currency: cfg.currency,
          cancellationPolicy: detPlan.externalLabel.toLowerCase().includes('non') ? 'Non-annulable' : 'Flexible',
          cancellationDetails: 'Conditions importées via Excel D-EDGE',
          paymentPolicy: 'Paiement sur place',
          breakfastMode: detPlan.externalLabel.toLowerCase().includes('pdj') || detPlan.externalLabel.toLowerCase().includes('bb')
            ? 'included_2_guests'
            : 'none',
          includedGuests: 2,
          minStayDefault: 1,
          maxStayDefault: 30,
          advanceBookingMinDays: 0,
          advanceBookingMaxDays: 365,
          roomCategoryCodes: updatedRooms.map((r) => r.code),
          channels: ['DIRECT_WEB', 'BOOKING', 'EXPEDIA'],
          pmsExternalId: '',
          cmExternalId: targetCode.toUpperCase(),
          validFrom: null,
          validTo: null,
          status: 'active',
          provenance: 'excel',
          updatedAt: now,
        });
      }
    }
  }

  const nextConfig =
    createdRoomsCount > 0 || createdPlansCount > 0
      ? saveHotelTariffConfig(
          hotel,
          { ...cfg, roomCategories: updatedRooms, ratePlans: updatedPlans },
          actor,
          'Import Excel D-EDGE',
          `Création de ${createdRoomsCount} chambre(s) et ${createdPlansCount} plan(s) depuis ${params.analysis.fileName}`
        )
      : cfg;

  const existingCells = getRatePlanningCells(hotel);
  const cellMap = new Map(existingCells.map((c) => [c.cellKey, c]));
  const roomMap = new Map(nextConfig.roomCategories.map((r) => [r.code, r]));
  const planMap = new Map(nextConfig.ratePlans.map((p) => [p.code, p]));

  let updatedRatesCount = 0;
  let updatedInventoryCount = 0;
  let updatedRestrictionsCount = 0;
  let unchangedCount = 0;
  let rejectedCount = 0;

  // Stocker les inventaires par (roomCode, date) pour les propager sur tous les plans de cette catégorie
  const inventoryUpdatesByRoomDate = new Map<string, number>();

  for (const rec of params.analysis.records) {
    if (!rec.isValid) {
      rejectedCount++;
      continue;
    }

    const roomCode = params.roomCodeMappings[rec.externalRoomLabel] || slugCode(rec.externalRoomLabel);
    const planCode = (params.planCodeMappings[rec.externalPlanLabel] || normalizePlanCode(rec.externalPlanLabel)).toUpperCase();
    const roomCfg = roomMap.get(roomCode);
    const planCfg = planMap.get(planCode);
    const cellKey = buildCellKey(hotel.id, roomCode, planCode, rec.stayDate);

    let cell = cellMap.get(cellKey);
    if (!cell && rec.metricType === 'rate' && rec.numericValue !== null) {
      const val = Math.round(rec.numericValue);
      cell = {
        cellKey,
        hotelId: hotel.id,
        roomTypeCode: roomCode,
        roomTypeName: roomCfg?.name || rec.externalRoomLabel,
        ratePlanCode: planCode,
        ratePlanName: planCfg?.name || rec.externalPlanLabel,
        stayDate: rec.stayDate,
        currentRateEur: val,
        previousRateEur: null,
        inventoryAvailable: roomCfg?.physicalRooms || 10,
        inventoryLeftForSale: roomCfg?.physicalRooms || 10,
        totalRoomsInCategory: roomCfg?.physicalRooms || 10,
        minStay: planCfg?.minStayDefault || 1,
        maxStay: planCfg?.maxStayDefault ?? null,
        cta: false,
        ctd: false,
        isClosed: false,
        channelRates: {
          DIRECT_WEB: val,
          BOOKING: Math.round(val * 1.02),
          EXPEDIA: Math.round(val * 1.02),
          GDS: val,
        },
        recommendation: null,
        flowtymSavedRateEur: val,
        transmittedRateEur: null,
        confirmedExternalRateEur: val,
        cmReturnedRateEur: val,
        cmUpdatedAt: now,
        syncStatus: 'saved_local',
        syncErrorMessage: null,
        lastSyncAt: now,
        lastSyncAckId: null,
        modificationOrigin: 'channel_manager',
        isManualOverride: false,
        version: 1,
        externalVersion: 1,
        lastExternalRateEur: val,
        lastExternalUpdatedAt: now,
        lastExternalActor: `Import ${params.analysis.fileName}`,
        updatedBy: actor,
        updatedAt: now,
      };
      cellMap.set(cellKey, cell);
      updatedRatesCount++;
      continue;
    }

    if (rec.metricType === 'inventory' && rec.numericValue !== null) {
      inventoryUpdatesByRoomDate.set(`${roomCode}::${rec.stayDate}`, Math.max(0, Math.round(rec.numericValue)));
    }

    if (!cell) continue;

    if (rec.metricType === 'rate' && rec.numericValue !== null) {
      const nextRate = Math.round(rec.numericValue);
      if (cell.currentRateEur === nextRate) {
        unchangedCount++;
      } else if (params.overwriteExisting) {
        cellMap.set(cellKey, {
          ...cell,
          previousRateEur: cell.currentRateEur,
          currentRateEur: nextRate,
          flowtymSavedRateEur: nextRate,
          cmReturnedRateEur: nextRate,
          cmUpdatedAt: now,
          channelRates: {
            DIRECT_WEB: nextRate,
            BOOKING: Math.round(nextRate * 1.02),
            EXPEDIA: Math.round(nextRate * 1.02),
            GDS: nextRate,
          },
          syncStatus: 'saved_local',
          modificationOrigin: 'channel_manager',
          version: cell.version + 1,
          updatedBy: actor,
          updatedAt: now,
        });
        updatedRatesCount++;
      } else {
        unchangedCount++;
      }
    } else if (
      rec.metricType === 'min_stay' ||
      rec.metricType === 'max_stay' ||
      rec.metricType === 'cta' ||
      rec.metricType === 'ctd' ||
      rec.metricType === 'stop_sell'
    ) {
      updatedRestrictionsCount++;
      cellMap.set(cellKey, {
        ...cell,
        minStay: rec.metricType === 'min_stay' && rec.numericValue ? Math.round(rec.numericValue) : cell.minStay,
        maxStay: rec.metricType === 'max_stay' && rec.numericValue ? Math.round(rec.numericValue) : cell.maxStay,
        cta: rec.metricType === 'cta' ? Boolean(rec.booleanValue) : cell.cta,
        ctd: rec.metricType === 'ctd' ? Boolean(rec.booleanValue) : cell.ctd,
        isClosed: rec.metricType === 'stop_sell' ? Boolean(rec.booleanValue) : cell.isClosed,
        syncStatus: 'saved_local',
        updatedBy: actor,
        updatedAt: now,
      });
    }
  }

  // Appliquer les inventaires "Left for sale" à toutes les cellules de la catégorie et date concernées
  if (inventoryUpdatesByRoomDate.size > 0) {
    for (const [k, cell] of cellMap.entries()) {
      const invVal = inventoryUpdatesByRoomDate.get(`${cell.roomTypeCode}::${cell.stayDate}`);
      if (invVal !== undefined) {
        cellMap.set(k, {
          ...cell,
          inventoryAvailable: invVal,
          inventoryLeftForSale: invVal,
          updatedAt: now,
        });
        updatedInventoryCount++;
      }
    }
  }

  const finalCells = Array.from(cellMap.values()).sort((a, b) => a.stayDate.localeCompare(b.stayDate));
  saveRatePlanningCells(hotel.id, finalCells);

  const jobId = `IMP-DEDGE-${Date.now()}`;
  const report: DedgeImportReport = {
    jobId,
    hotelId: hotel.id,
    fileName: params.analysis.fileName,
    providerPreset: params.analysis.detectedProvider,
    executedAt: now,
    actor,
    status: params.analysis.anomalies.length > 0 ? 'completed_with_warnings' : 'completed',
    createdRoomsCount,
    createdPlansCount,
    updatedRatesCount,
    updatedInventoryCount,
    updatedRestrictionsCount,
    unchangedCount,
    rejectedCount,
    anomaliesCount: params.analysis.anomalies.length,
    anomalies: params.analysis.anomalies,
    summary: `Import ${params.analysis.fileName} : ${updatedRatesCount} tarif(s), ${updatedInventoryCount} stock(s) Left for sale, ${createdRoomsCount} chambre(s), ${createdPlansCount} plan(s), ${params.analysis.anomalies.length} anomalie(s).`,
  };

  appendLocalSyncLog(hotel.id, {
    id: `slog-imp-${Date.now()}`,
    hotelId: hotel.id,
    connectorId: 'excel_import',
    providerId: 'dedge',
    providerName: 'Import Excel D-EDGE Planning',
    family: 'channel_manager',
    operationType: 'excel_import',
    direction: 'inbound',
    status: rejectedCount > 0 ? 'conflict' : 'synced',
    executionMode: 'sandbox_simulation',
    stayDateFrom: params.analysis.dateRange.start || undefined,
    stayDateTo: params.analysis.dateRange.end || undefined,
    cellsAffected: updatedRatesCount + updatedInventoryCount,
    traceabilityId: jobId,
    durationMs: 45,
    actor,
    message: report.summary,
    createdAt: now,
  });

  return { config: nextConfig, cells: finalCells, report };
}

/**
 * Génération d'un modèle Excel D-EDGE Planning réaliste (Price (EUR) + Left for sale)
 * pour test immédiat ou téléchargement utilisateur.
 */
export function buildSampleDedgePlanningWorkbook(startDateIso: string, daysCount: number = 14): Uint8Array {
  const dates: string[] = [];
  const [y, m, d] = startDateIso.split('-').map(Number);
  const baseMs = Date.UTC(y, m - 1, d);
  for (let i = 0; i < daysCount; i++) {
    dates.push(new Date(baseMs + i * 86400000).toISOString().slice(0, 10));
  }

  const header = ['Chambre', 'Code & Libellé du plan tarifaire', 'Type de donnée', ...dates];
  const matrix: unknown[][] = [
    ['H2258 - FOLKESTONE OPERA - Planning Export D-EDGE (Modèle)'],
    header,
  ];

  const rooms = [
    { name: 'Double Classique', base: 235, stock: 12 },
    { name: 'Double Supérieure', base: 275, stock: 8 },
    { name: 'Deluxe / Famille', base: 340, stock: 5 },
  ];

  rooms.forEach((rm, rIdx) => {
    matrix.push([
      rm.name,
      'BAR - Best Available Rate',
      'Price (EUR)',
      ...dates.map((_, idx) => rm.base + ((idx + rIdx) % 4) * 15),
    ]);
    matrix.push([
      '', // Cellule Chambre implicite comme dans D-EDGE Planning réel
      'BAR - Best Available Rate',
      'Left for sale',
      ...dates.map((_, idx) => Math.max(1, rm.stock - (idx % 5))),
    ]);
    matrix.push([
      rm.name,
      'NRF - Non Remboursable (-10%)',
      'Price (EUR)',
      ...dates.map((_, idx) => Math.round((rm.base + ((idx + rIdx) % 4) * 15) * 0.9)),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(matrix);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Planning_D_EDGE');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}

export function downloadSampleDedgePlanningWorkbook(startDateIso: string): void {
  const bytes = buildSampleDedgePlanningWorkbook(startDateIso, 14);
  const copiedBuffer = bytes.slice().buffer;
  const blob = new Blob([copiedBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `modele_dedge_planning_${startDateIso}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadDedgeImportReportCsv(report: DedgeImportReport): void {
  const lines = [
    ['Job_ID', 'Hotel_ID', 'Fichier', 'Date_Execution', 'Acteur', 'Statut', 'Chambres_Creees', 'Plans_Crees', 'Tarifs_MAJ', 'Stocks_MAJ', 'Anomalies'].join(';'),
    [
      report.jobId,
      report.hotelId,
      report.fileName,
      report.executedAt,
      report.actor,
      report.status,
      report.createdRoomsCount,
      report.createdPlansCount,
      report.updatedRatesCount,
      report.updatedInventoryCount,
      report.anomaliesCount,
    ].join(';'),
    '',
    ['Ligne', 'Onglet', 'Date', 'Chambre', 'Plan', 'Severite', 'Code', 'Message'].join(';'),
    ...report.anomalies.map((a) =>
      [a.rowIndex, a.sheetName, a.stayDate || '', a.roomLabel, a.planLabel, a.severity, a.code, `"${a.message.replace(/"/g, '""')}"`].join(';')
    ),
  ];
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport-import-dedge-${report.hotelId}-${report.executedAt.slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
