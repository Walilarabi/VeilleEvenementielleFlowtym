import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRoomTypeRecommendation, type RoomTypeRecommendationConfig } from "../../supabase/functions/revenue-api/_shared/roomTypeRecommendationEngine";

const config: RoomTypeRecommendationConfig = {
  weights: { occupancy: 40, pickup: 30, event: 10, compset: 10, market_demand: 10 },
  thresholds: { normal: 40, high: 65, exceptional: 85 },
  rateAdjustmentsPct: { low: -5, normal: 0, high: 5, exceptional: 10 },
  floor: 80,
  ceiling: 400,
  maxChangePct: 10,
  minimumSources: 2,
  minimumWeightCoveragePct: 50,
};

test("missing signals are not treated as zero and source coverage is explicit", () => {
  const result = buildRoomTypeRecommendation({
    currentBar: 100,
    signals: { occupancy: 80, pickup: null, event: null, compset: null, market_demand: 70 },
  }, config);
  assert.equal(result.availableSignals.length, 2);
  assert.equal(result.confidenceScore, 50);
  assert.equal(result.score, 78);
  assert.equal(result.sufficient, true);
  assert.equal(result.suggestedBar, 105);
  assert.equal(result.dataQualityStatus, "valid");
});

test("one available source cannot trigger a price change when two are required", () => {
  const result = buildRoomTypeRecommendation({
    currentBar: 100,
    signals: { occupancy: 95, pickup: null, event: null, compset: null, market_demand: null },
  }, config);
  assert.equal(result.availableSignals.length, 1);
  assert.equal(result.sufficient, false);
  assert.equal(result.suggestedBar, 100);
  assert.equal(result.deltaPct, 0);
  assert.equal(result.dataQualityStatus, "degraded");
});

test("inventory and reservation conflicts force a hold even when every signal is strong", () => {
  const result = buildRoomTypeRecommendation({
    currentBar: 100,
    signals: { occupancy: 95, pickup: 90, event: 90, compset: 90, market_demand: 95 },
    inventoryReservationConflict: true,
  }, config);
  assert.equal(result.sufficient, false);
  assert.equal(result.suggestedBar, 100);
  assert.equal(result.dataQualityStatus, "conflicted");
  assert.equal(result.strategyCode, "HOLD_DATA_CONFLICT");
});

test("floor, ceiling and maximum daily movement all cap the proposed rate", () => {
  const upward = buildRoomTypeRecommendation({
    currentBar: 100,
    signals: { occupancy: 95, pickup: 90, event: 90, compset: 90, market_demand: 95 },
  }, { ...config, ceiling: 105, rateAdjustmentsPct: { ...config.rateAdjustmentsPct, exceptional: 30 } });
  assert.equal(upward.suggestedBar, 105);

  const downward = buildRoomTypeRecommendation({
    currentBar: 100,
    signals: { occupancy: 0, pickup: 0, event: 0, compset: 0, market_demand: 0 },
  }, { ...config, floor: 95, rateAdjustmentsPct: { ...config.rateAdjustmentsPct, low: -30 } });
  assert.equal(downward.suggestedBar, 95);
});

test("out-of-range signals are excluded rather than clamped into evidence", () => {
  const result = buildRoomTypeRecommendation({
    currentBar: 100,
    signals: { occupancy: 140, pickup: -5, event: null, compset: null, market_demand: null },
  }, config);
  assert.equal(result.availableSignals.length, 0);
  assert.equal(result.score, null);
  assert.equal(result.dataQualityStatus, "insufficient");
  assert.equal(result.suggestedBar, 100);
});

test("invalid current BAR and thresholds are rejected", () => {
  assert.throws(() => buildRoomTypeRecommendation({
    currentBar: 0,
    signals: { occupancy: null, pickup: null, event: null, compset: null, market_demand: null },
  }, config), /currentBar/);
  assert.throws(() => buildRoomTypeRecommendation({
    currentBar: 100,
    signals: { occupancy: 50, pickup: null, event: null, compset: null, market_demand: null },
  }, { ...config, thresholds: { normal: 80, high: 70, exceptional: 90 } }), /thresholds/);
});
