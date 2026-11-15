import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseLighthouseExcelFile } from "../services/lighthouseAnalysisEngine";

function makeLighthouseWorkbook(demandValues: Array<number | string> = [0.28, ""]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const dates = [new Date(2026, 10, 14, 12), new Date(2026, 10, 15, 12)];

  const overview = [
    ["Lighthouse export"],
    ["Folkestone Opéra — Booking.com"],
    ["2 voyageurs · 1 nuit"],
    [],
    ["Jour", "Date", "Tarif le plus bas", "Médiane Lighthouse", "Classement", "Demande du marché"],
    ["samedi", dates[0], 199, 210, "5 sur 11", demandValues[0]],
    ["dimanche", dates[1], 205, 220, "4 sur 11", demandValues[1]],
  ];
  const rates = [
    ["Lighthouse export"],
    ["Canal : Booking.com"],
    ["LOS : 1 nuit"],
    [],
    ["Jour", "Date", "Demande du marché", "Folkestone Opéra", "Hôtel de l’Arcade", "Hôtel Chavanel"],
    ["samedi", dates[0], demandValues[0], 199, 180, "Épuisé"],
    ["dimanche", dates[1], demandValues[1], 205, 190, 210],
  ];
  const evolution = [
    ["Lighthouse export"],
    ["Comparaison"],
    [],
    [],
    ["Date", "Demande vs. hier", "Folkestone Opéra", "Hôtel de l’Arcade", "Hôtel Chavanel"],
    [dates[0], 0.02, 5, 3, -4],
    [dates[1], "", 0, 0, 0],
  ];

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(overview), "Aperçu");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rates), "Tarifs");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(evolution), "vs. Hier");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(evolution), "vs. 3 jours");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(evolution), "vs. 7 jours");

  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  if (output instanceof ArrayBuffer) return output;
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}

test("Lighthouse parser detects headers after export preamble rows", () => {
  const dataset = parseLighthouseExcelFile(makeLighthouseWorkbook(), "fixture-booking.xlsx");

  assert.equal(dataset.records.length, 2);
  assert.deepEqual(dataset.records[0].competitors.map((item) => item.name), ["Hôtel de l’Arcade", "Hôtel Chavanel"]);
  assert.equal(dataset.records[0].competitors[0].rate, 180);
  assert.equal(dataset.records[0].competitors[1].status, "epuise");
  assert.equal(dataset.records[0].competitors[0].stars, null);
});

test("Lighthouse demand ratio is normalized, raw value retained, and missing dates stay null", () => {
  const dataset = parseLighthouseExcelFile(makeLighthouseWorkbook(), "fixture-booking.xlsx");

  assert.equal(dataset.records[0].demandIndexRaw, 0.28);
  assert.equal(dataset.records[0].demandIndexScale, "0_1");
  assert.equal(dataset.records[0].demandIndex, 28);
  assert.equal(dataset.records[1].demandIndexRaw, null);
  assert.equal(dataset.records[1].demandIndexScale, "missing");
  assert.equal(dataset.records[1].demandIndex, null);
  assert.equal(dataset.records[1].demandLevel, "non_renseigne");
});

test("Lighthouse parser keeps an explicit 0-100 demand score unchanged", () => {
  const dataset = parseLighthouseExcelFile(makeLighthouseWorkbook([72, 65]), "fixture-booking.xlsx");

  assert.equal(dataset.records[0].demandIndexRaw, 72);
  assert.equal(dataset.records[0].demandIndexScale, "0_100");
  assert.equal(dataset.records[0].demandIndex, 72);
});
