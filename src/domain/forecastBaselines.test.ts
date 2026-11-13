import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateForecastMetrics,
  calculateHaversineKm,
  calculateNetPickup,
  selectForecastTrainingRows,
  summarizeForecastSamples,
  type HistoricalDemandSnapshot,
  type HistoricalRevenueRow,
} from "../../supabase/functions/revenue-api/_shared/forecast";

const history: HistoricalRevenueRow[] = [
  {stay_date:"2024-11-08",day_of_week:5,occupancy_pct:70,adr_net:200,revpar:140,source_status:"real"},
  {stay_date:"2025-11-07",day_of_week:5,occupancy_pct:80,adr_net:210,revpar:168,source_status:"imported"},
  {stay_date:"2026-11-06",day_of_week:5,occupancy_pct:90,adr_net:220,revpar:198,source_status:"real"},
  {stay_date:"2026-11-13",day_of_week:5,occupancy_pct:99,adr_net:999,revpar:999,source_status:"real"},
  {stay_date:"2025-11-14",day_of_week:5,occupancy_pct:10,adr_net:100,revpar:10,source_status:"simulation"},
];

test("seasonal baseline excludes future, same-day and simulation rows",()=>{
  const rows=selectForecastTrainingRows("seasonal_naive_same_month_weekday","2027-11-12","2026-11-13",364,history,[],new Map());
  assert.deepEqual(rows.map(r=>r.stay_date),["2024-11-08","2025-11-07","2026-11-06"]);
});

test("same weekday last year uses only comparable dates before origin",()=>{
  const rows=selectForecastTrainingRows("same_weekday_last_year","2027-11-12","2027-10-13",30,history,[],new Map());
  assert.equal(rows.length,2);
});

test("seasonal average includes same-month real/imported observations only",()=>{
  const rows=selectForecastTrainingRows("seasonal_average_same_month","2027-11-12","2026-11-13",364,history,[],new Map());
  assert.equal(rows.length,3);
});

test("pickup comparable requires historical snapshots observed before origin and matching lead time",()=>{
  const actuals=new Map(history.map(r=>[r.stay_date,r]));
  const snapshots:HistoricalDemandSnapshot[]=[
    {arrival_date:"2024-11-08",observation_date:"2024-10-15",days_before_arrival:24,source_status:"real"},
    {arrival_date:"2025-11-07",observation_date:"2025-10-14",days_before_arrival:24,source_status:"imported"},
    {arrival_date:"2026-11-06",observation_date:"2026-10-13",days_before_arrival:24,source_status:"real"},
    {arrival_date:"2026-11-06",observation_date:"2026-11-01",days_before_arrival:5,source_status:"real"},
    {arrival_date:"2025-11-14",observation_date:"2025-10-21",days_before_arrival:24,source_status:"simulation"},
  ];
  const rows=selectForecastTrainingRows("pickup_historical_comparable","2027-11-12","2026-11-13",24,history,snapshots,actuals);
  assert.deepEqual(rows.map(r=>r.stay_date),["2024-11-08","2025-11-07","2026-11-06"]);
});

test("forecast interval is not fabricated from fewer than three observations",()=>{
  const summary=summarizeForecastSamples(history.slice(0,1),1);
  assert.equal(summary?.occupancyP50,70);
  assert.equal(summary?.occupancyP10,null);
  assert.equal(summary?.occupancyP90,null);
});

test("forecast error metrics define WAPE and bias conventions",()=>{
  const metrics=calculateForecastMetrics([100,100],[90,110]);
  assert.equal(metrics?.wape,0.1);
  assert.equal(metrics?.biasPct,0);
  assert.equal(metrics?.mae,10);
  assert.equal(metrics?.rmse,10);
  assert.equal(calculateForecastMetrics([0],[1])?.wape,null);
});

test("net pickup accounts for cancellations and date moves",()=>{
  assert.equal(calculateNetPickup(10,3,2,1),8);
  assert.equal(calculateNetPickup(3,8),-5);
  assert.equal(calculateNetPickup(-1,0),null);
});

test("haversine returns plausible Paris-area straight-line distance",()=>{
  const distance=calculateHaversineKm(48.8566,2.3522,48.8606,2.3376);
  assert.ok(distance>1 && distance<1.5);
});
