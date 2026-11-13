import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventItem, Hotel } from "../types";
import {
  listRevenueHotels,
  getHotelRates,
  getHotelEvents,
  getHotelForecasts,
  getHotelInventorySnapshots,
  getHotelBacktests,
  getHotelIntegrations,
  getHotelRevenueParameters,
  getHotelLighthouseObservations,
} from "./revenueApiClient";

export type RevenueHotel = {
  id:string; name:string; group_name:string|null; city:string|null; country:string|null; address:string|null;
  lat:number|null; lng:number|null; stars:number|null; room_count:number|null; segment:string|null;
  base_adr:number|null; timezone:string; currency:string; rate_floor:number|null; rate_ceiling:number|null;
  max_rate_change_pct:number|null; is_active:boolean;
};
export type RevenueRateRow = {
  id:string; hotel_id:string; stay_date:string; currency:string; current_bar:number|null; suggested_bar:number|null;
  delta_amount:number|null; delta_pct:number|null; demand_index:number|null; demand_level:string|null;
  occupancy_pct:number|null; rooms_remaining:number|null; pickup_24h:number|null; pickup_3d:number|null; pickup_7d:number|null;
  lighthouse_median:number|null; flowtym_compset_median:number|null; compset_min:number|null; compset_max:number|null;
  forecast_occupancy_p50:number|null; forecast_occupancy_p10:number|null; forecast_occupancy_p90:number|null;
  strategy_code:string|null; explanation:string|null; evidence:Record<string,unknown>; confidence_score:number|null;
  data_quality_status:string; recommendation_status:string; approved_rate:number|null; approved_min_stay:number|null;
  decision_at:string|null; valid_until:string|null; created_at:string; updated_at:string;
};
export type RevenueForecastRow = {
  id:string; hotel_id:string; forecast_run_id:string; stay_date:string; occupancy_p10:number|null; occupancy_p50:number|null;
  occupancy_p90:number|null; adr_p50:number|null; revpar_p50:number|null; demand_index:number|null;
  confidence_score:number|null; drivers:unknown[]; source_status:string;
  revenue_forecast_runs?:{model_name:string;model_version:string;as_of:string;run_status:string}|null;
};
export type RevenueLighthouseRow = {id:string;stay_date:string;competitor_name:string;room_type:string|null;rate_plan:string|null;channel:string|null;currency:string;rate_amount:number|null;availability_status:string;observed_at:string;source_status:string;comparability:Record<string,unknown>;lighthouse_extractions?:{file_name:string|null;observed_at:string;source_status:string;los_nights:number|null;guests_count:number|null;occupancy_context:string|null}|null};
export type RevenueIntegrationRow = {id:string;provider:string;connection_name:string;connection_status:string;last_success_at:string|null;last_error_at:string|null;last_error_code:string|null;updated_at:string};
export type RevenueInventoryRow = {
  id:string; stay_date:string; snapshot_at:string; source_system:string; source_status:string;
  total_rooms:number|null; sellable_rooms:number|null; rooms_sold:number|null; rooms_available:number|null;
  occupancy_pct:number|null; current_bar:number|null; currency:string;
};
export type RevenueEventRow = Record<string,any>;
export type RevenueWorkspace = {
  hotels:Hotel[]; rawHotels:RevenueHotel[]; rates:RevenueRateRow[]; events:EventItem[];
  rawEvents:RevenueEventRow[]; forecasts:RevenueForecastRow[]; inventory:RevenueInventoryRow[];
  backtests:unknown[]; integrations:RevenueIntegrationRow[]; lighthouse:RevenueLighthouseRow[]; parameters:Record<string,unknown>|null; loadedAt:string;
};

const num=(v:unknown):number|null=>typeof v==="number"&&Number.isFinite(v)?v:v===null||v===undefined?null:Number.isFinite(Number(v))?Number(v):null;
const relation=(v:any)=>Array.isArray(v)?v[0]??null:v??null;
const category=(v:string):EventItem["category"]=>{
 const allowed=["salons_foires","congres_medical","concerts_spectacles","sport","festivals","mode_luxe","corporate_sommet","culturel","vacances_scolaires","autre"];
 return allowed.includes(v)?v as EventItem["category"]:"culturel";
};
const status=(v:string):EventItem["status"]=>{
 const allowed=["confirmed","probable","estime","a_verifier","estimated_recurrent","announced_pending","rumored","cancelled"];
 return allowed.includes(v)?v as EventItem["status"]:"a_verifier";
};
function mapHotel(row:RevenueHotel):Hotel {
 return {
  id:row.id,name:row.name,group:row.group_name??"HOPTYM",city:row.city??"Non renseignée",
  country:row.country??"Non renseigné",address:row.address??"Adresse non renseignée",
  lat:row.lat??0,lng:row.lng??0,stars:row.stars??0,roomCount:row.room_count??0,
  segment:(row.segment??"Affaires") as Hotel["segment"],baseADR:row.base_adr??0,
 };
}
function mapEvent(row:RevenueEventRow,hotelId:string):EventItem|null {
 const event=relation(row.events),occ=relation(row.event_occurrences);
 if(!event||!occ||!occ.start_date||!occ.end_date) return null;
 const venue=relation(event.venues);
 const score=num(row.final_rm_score)??0,confidence=num(row.confidence_score)??0;
 const evidences=(event.event_evidence??[]).map((e:any)=>({
  id:String(e.id),sourceName:e.source_name??"Source non renseignée",sourceUrl:e.source_url??"",
  sourceType:(["official_organizer","venue_calendar","press","ticketing","city_agenda"].includes(e.event_sources?.source_type)?e.event_sources.source_type:"other") as EventItem["evidences"][number]["sourceType"],verifiedAt:e.verified_at??"",excerpt:e.excerpt??"",trustScore:num(e.trust_score)??0,
 }));
 const impactLevel:EventItem["impactLevel"]=score>=90?"hyper":score>=75?"critique":score>=50?"modere":"faible";
 const title=String(event.title??"Événement sans titre");
 return {
  id:String(event.id),occurrenceId:String(occ.id),impactStatus:row.impact_status??undefined,expectedAttendanceUnknown:num(occ.attendance_estimate)===null&&num(event.expected_attendance)===null,confidenceUnknown:num(row.confidence_score)===null,scoreUnknown:num(row.final_rm_score)===null,distanceUnknown:num(row.distance_km)===null,adrLiftUnknown:num(row.estimated_adr_lift_pct)===null,title,subtitle:event.subtitle??undefined,category:category(String(event.category??"culturel")),
  venueId:String(venue?.id??""),venueName:String(venue?.name??"Lieu non renseigné"),
  city:String(venue?.city??event.city??""),country:(venue?.country_code??event.country_code)==="FR"?"France":String(venue?.country_code??event.country_code??"Pays non renseigné"),
  startDate:String(occ.start_date),endDate:String(occ.end_date),
  expectedAttendance:num(occ.attendance_estimate)??num(event.expected_attendance)??0,
  internationalRatioPercent:num(event.international_ratio_pct)??0,status:status(String(event.status??"a_verifier")),
  impactLevel,scoreBreakdown:{
   attendanceScore:num(row.attendance_score)??0,internationalScore:num(row.international_score)??0,
   saturationScore:0,proximityScore:num(row.proximity_score)??0,compressionScore:num(row.duration_score)??0,
   finalRMScore:score,confidenceScore:confidence,
  },
  sources:evidences.map((e:any)=>e.sourceName),evidences,
  hotelImpacts:{[hotelId]:{
   hotelId,distanceKm:num(row.distance_km)??0,distanceMins:num(row.drive_time_minutes)??undefined,
   estimatedADRBoostPercent:num(row.estimated_adr_lift_pct)??0,
   recommendedAction:row.recommended_action??undefined,
  }},
  isRecurring:Boolean(event.recurrence_frequency),recurrenceFrequency:event.recurrence_frequency??undefined,
  officialUrl:event.official_url??undefined,createdAt:String(event.created_at??""),
  lastVerifiedAt:String(row.calculated_at??event.updated_at??""),
 };
}

export async function loadRevenueWorkspace(supabase:SupabaseClient,selectedHotelId?:string):Promise<RevenueWorkspace>{
 const hotelResult=await listRevenueHotels(supabase);
 const rawHotels=(hotelResult.data??[]) as RevenueHotel[];
 const hotels=rawHotels.map(mapHotel);
 const selected=hotels.find(h=>h.id===selectedHotelId)??hotels[0];
 if(!selected) return {hotels,rawHotels,rates:[],events:[],rawEvents:[],forecasts:[],inventory:[],backtests:[],integrations:[],lighthouse:[],parameters:null,loadedAt:new Date().toISOString()};
 const from=new Date(); const to=new Date(from); to.setUTCDate(to.getUTCDate()+180);
 const iso=(d:Date)=>d.toISOString().slice(0,10);
 const [rateResult,eventResult,forecastResult,inventoryResult,backtestResult,integrationResult,parametersResult,lighthouseResult]=await Promise.all([
  getHotelRates(supabase,selected.id,iso(from),iso(to)),
  getHotelEvents(supabase,selected.id,iso(from),iso(to)),
  getHotelForecasts(supabase,selected.id,iso(from),iso(to)),
  getHotelInventorySnapshots(supabase,selected.id,iso(from),iso(to)),
  getHotelBacktests(supabase,selected.id),
  getHotelIntegrations(supabase,selected.id),
  getHotelRevenueParameters(supabase,selected.id),
  getHotelLighthouseObservations(supabase,selected.id,iso(from),iso(to)),
 ]);
 const rawEvents=(eventResult.data??[]) as RevenueEventRow[];
 return {
  hotels,rawHotels,rates:(rateResult.data??[]) as RevenueRateRow[],
  events:rawEvents.map(r=>mapEvent(r,selected.id)).filter((e):e is EventItem=>Boolean(e)),
  rawEvents,forecasts:(forecastResult.data??[]) as RevenueForecastRow[],
  inventory:(inventoryResult.data??[]) as RevenueInventoryRow[],
  backtests:backtestResult.data??[],integrations:(integrationResult.data??[]) as RevenueIntegrationRow[],parameters:parametersResult.data??null,lighthouse:(lighthouseResult.data??[]) as RevenueLighthouseRow[],loadedAt:new Date().toISOString(),
 };
}
