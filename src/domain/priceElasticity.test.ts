import { test } from "node:test";
import assert from "node:assert/strict";
import { estimatePairedPriceElasticity, type PriceExperimentObservation } from "../../supabase/functions/revenue-api/_shared/priceElasticity";

const rows: PriceExperimentObservation[] = [
  {experiment_id:"e1",stay_date:"2026-01-01",room_type_id:"r",rate_plan_id:"p",channel:"direct",currency:"EUR",group_type:"control",assigned_price:100,exposure_count:100,rooms_sold:20,source_status:"live"},
  {experiment_id:"e1",stay_date:"2026-01-01",room_type_id:"r",rate_plan_id:"p",channel:"direct",currency:"EUR",group_type:"treatment",assigned_price:110,exposure_count:100,rooms_sold:18,source_status:"live"},
  {experiment_id:"e2",stay_date:"2026-01-02",room_type_id:"r",rate_plan_id:"p",channel:"direct",currency:"EUR",group_type:"control",assigned_price:100,exposure_count:100,rooms_sold:20,source_status:"imported"},
  {experiment_id:"e2",stay_date:"2026-01-02",room_type_id:"r",rate_plan_id:"p",channel:"direct",currency:"EUR",group_type:"treatment",assigned_price:120,exposure_count:100,rooms_sold:16,source_status:"imported"},
  {experiment_id:"e3",stay_date:"2026-01-03",room_type_id:"r",rate_plan_id:"p",channel:"direct",currency:"EUR",group_type:"control",assigned_price:100,exposure_count:100,rooms_sold:20,source_status:"live"},
  {experiment_id:"e3",stay_date:"2026-01-03",room_type_id:"r",rate_plan_id:"p",channel:"direct",currency:"EUR",group_type:"treatment",assigned_price:130,exposure_count:100,rooms_sold:14,source_status:"live"},
];
test("elasticity estimator requires a minimum number of matched randomized pairs",()=>{
 const r=estimatePairedPriceElasticity(rows.slice(0,2),{minPairs:3,minRSquared:0.5,maxAbsElasticity:5});
 assert.equal(r.status,"insufficient_data");assert.equal(r.samplePairs,1);
});
test("elasticity estimator returns negative response from valid pairs",()=>{
 const r=estimatePairedPriceElasticity(rows,{minPairs:3,minRSquared:0,maxAbsElasticity:5});
 assert.ok(r.elasticity!==null&&r.elasticity<0);assert.equal(r.samplePairs,3);
});
test("simulation observations are excluded",()=>{
 const r=estimatePairedPriceElasticity([...rows,{...rows[0],experiment_id:"e4",source_status:"simulation"}],{minPairs:3,minRSquared:0,maxAbsElasticity:5});
 assert.equal(r.samplePairs,3);
});
test("positive response is flagged non-monotonic",()=>{
 const r=estimatePairedPriceElasticity(rows.map(x=>x.group_type==="treatment"?{...x,rooms_sold:30}:x),{minPairs:3,minRSquared:0,maxAbsElasticity:5});
 assert.equal(r.status,"non_monotonic");
});
