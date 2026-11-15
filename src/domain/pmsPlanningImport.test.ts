import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parsePmsPlanningWorkbook } from "../services/pmsPlanningImportService";

function fixture(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const rows = [
    ["FOLKESTONE OPERA - samedi 14 novembre 2026 18:33:44", "", "", new Date(Date.UTC(2026, 10, 14)), new Date(Date.UTC(2026, 10, 15))],
    ["Double Classique", "", "Left for sale", 4, "X"],
    ["Double Classique", "RACK-RO-FLEX - RACK RO FLEX", "Price (EUR)", 167, 141],
    ["Double Classique", "OTA-RO-FLEX - OTA RO FLEX", "Price (EUR)", 150, ""],
    ["Twin Classique", "", "Left for sale", 2, 0],
    ["Twin Classique", "RACK-RO-FLEX - RACK RO FLEX", "Price (EUR)", 180, 175],
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Planning");
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  if (output instanceof ArrayBuffer) return output;
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}

test("PMS planning parser reads French snapshot timestamp and date headers", () => {
  const parsed = parsePmsPlanningWorkbook(fixture(), "planning.xlsx");
  assert.equal(parsed.snapshotAt, "2026-11-14T17:33:44.000Z");
  assert.deepEqual(parsed.dateRange, { start: "2026-11-14", end: "2026-11-15" });
  assert.equal(parsed.roomTypes.length, 2);
  assert.equal(parsed.summary.dates, 2);
  assert.equal(parsed.summary.ratePlans, 3);
});

test("PMS planning parser preserves X, blank, zero and numeric values distinctly", () => {
  const parsed = parsePmsPlanningWorkbook(fixture(), "planning.xlsx");
  const double = parsed.roomTypes.find((room) => room.name === "Double Classique")!;
  const twin = parsed.roomTypes.find((room) => room.name === "Twin Classique")!;

  assert.equal(double.inventory[0].remainingSellableRooms, 4);
  assert.equal(double.inventory[1].remainingSellableRooms, null);
  assert.equal(double.inventory[1].status, "unknown_marker");
  assert.equal(twin.inventory[1].remainingSellableRooms, 0);
  assert.equal(twin.inventory[1].status, "zero");

  const rack = double.ratePlans.find((plan) => plan.code === "RACK-RO-FLEX")!;
  const ota = double.ratePlans.find((plan) => plan.code === "OTA-RO-FLEX")!;
  assert.equal(rack.observations[0].rateAmount, 167);
  assert.equal(rack.observations[1].rateAmount, 141);
  assert.equal(ota.observations[1].rateAmount, null);
  assert.equal(ota.observations[1].status, "missing");
});
