import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAdr, calculateBiasPct, calculateCompsetSummary, calculateMae,
  calculateMedian, calculateNetPickup, calculateOccupancyPct, calculateQuantile,
  calculateRevpar, calculateRmse, calculateWape,
} from "./revenueMetrics";

test("hotel KPIs use consistent room-night denominators", () => {
  assert.equal(calculateOccupancyPct(40,45), 88.88888888888889);
  assert.equal(calculateAdr(12000,40), 300);
  assert.equal(calculateRevpar(12000,45), 266.6666666666667);
});

test("zero denominators are unknown, not zero", () => {
  assert.equal(calculateOccupancyPct(0,0), null);
  assert.equal(calculateAdr(100,0), null);
  assert.equal(calculateRevpar(100,0), null);
});

test("invalid occupancy and invalid metrics are rejected", () => {
  assert.equal(calculateOccupancyPct(46,45), null);
  assert.equal(calculateAdr(-10,2), null);
  assert.equal(calculateRevpar(Number.NaN,45), null);
});

test("pickup is net OTB delta and may be negative", () => {
  assert.equal(calculateNetPickup(18,14), 4);
  assert.equal(calculateNetPickup(12,14), -2);
  assert.equal(calculateNetPickup(-1,14), null);
});

test("forecast accuracy metrics use explicit conventions", () => {
  assert.equal(calculateWape([100,100],[90,110]), 0.1);
  assert.equal(calculateBiasPct([100,100],[110,90]), 0);
  assert.equal(calculateMae([100,100],[90,110]), 10);
  assert.equal(calculateRmse([100,100],[90,110]), 10);
  assert.equal(calculateWape([0,0],[1,2]), null);
  assert.equal(calculateBiasPct([0],[1]), null);
});

test("median and quantiles are deterministic", () => {
  assert.equal(calculateMedian([5,1,3,2]), 2.5);
  assert.equal(calculateQuantile([1,2,3,4,5],0.1), 1.4);
  assert.equal(calculateQuantile([],0.5), null);
});

test("compset excludes sold-out, stale, incompatible and target-hotel rates", () => {
  const summary=calculateCompsetSummary([
    {rate:200,availability:"available",observedAt:"2026-11-13T10:00:00Z",currency:"EUR",roomType:"Classic",ratePlan:"BAR",losNights:1,guests:2},
    {rate:300,availability:"available",observedAt:"2026-11-13T10:00:00Z",currency:"EUR",roomType:"Classic",ratePlan:"BAR",losNights:1,guests:2},
    {rate:null,availability:"sold_out",observedAt:"2026-11-13T10:00:00Z",currency:"EUR",roomType:"Classic",ratePlan:"BAR",losNights:1,guests:2},
    {rate:100,availability:"available",observedAt:"2026-11-10T10:00:00Z",currency:"EUR",roomType:"Classic",ratePlan:"BAR",losNights:1,guests:2},
    {rate:999,availability:"available",observedAt:"2026-11-13T10:00:00Z",currency:"EUR",roomType:"Classic",ratePlan:"BAR",losNights:1,guests:2,isTargetHotel:true},
  ],{asOf:"2026-11-13T12:00:00Z",maxAgeHours:24,currency:"EUR",roomType:"Classic",ratePlan:"BAR",losNights:1,guests:2});
  assert.equal(summary.median,250);
  assert.equal(summary.availableCount,2);
  assert.equal(summary.soldOutCount,1);
  assert.equal(summary.excludedCount,2);
});
