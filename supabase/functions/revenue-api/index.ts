import { withSupabase } from "npm:@supabase/server@1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

type Profile = { id: string; organization_id: string | null; role: string; email: string | null };
type Hotel = { id: string; organization_id: string; name: string; room_count: number | null; timezone: string; currency: string; rate_floor: number | null; rate_ceiling: number | null; max_rate_change_pct: number | null; lat: number | null; lng: number | null; segment: string | null };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

const fail = (message: string, status = 400, details?: unknown) =>
  json({ ok: false, error: message, ...(details === undefined ? {} : { details }) }, status);

const numberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const isDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z"));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const quantile = (values: number[], q: number): number | null => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
};
const addDays = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const eachDate = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to && out.length <= 366; d = addDays(d, 1)) out.push(d);
  return out;
};
const dateRange = (url: URL) => {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to || !isDate(from) || !isDate(to) || from > to) return null;
  const days = (Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000;
  return days <= 365 ? { from, to } : null;
};

async function getProfile(supabase: any, userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("users").select("id,organization_id,role,email").eq("id", userId).maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}

async function getHotel(supabase: any, hotelId: string): Promise<Hotel | null> {
  const { data, error } = await supabase
    .from("hotels")
    .select("id,organization_id,name,room_count,timezone,currency,rate_floor,rate_ceiling,max_rate_change_pct,lat,lng,segment")
    .eq("id", hotelId).maybeSingle();
  if (error || !data) return null;
  return data as Hotel;
}

function requireManager(profile: Profile) {
  return ["super_admin", "admin", "revenue_manager"].includes(profile.role);
}

function haversineKm(lat1:number,lon1:number,lat2:number,lon2:number):number {
  const rad=(v:number)=>v*Math.PI/180;
  const dLat=rad(lat2-lat1),dLon=rad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function calculateForecastMetrics(actual: number[], forecast: number[]) {
  if (!actual.length || actual.length !== forecast.length) return null;
  const errors = actual.map((a,i)=>forecast[i]-a);
  const absoluteError = errors.reduce((s,e)=>s+Math.abs(e),0);
  const actualTotal = actual.reduce((s,a)=>s+Math.abs(a),0);
  const mae = absoluteError/actual.length;
  const rmse = Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/actual.length);
  const biasPct = actual.reduce((s,a,i)=>s+forecast[i]-a,0);
  const actualSum = actual.reduce((s,a)=>s+a,0);
  return {
    sampleCount: actual.length,
    wape: actualTotal>0 ? absoluteError/actualTotal : null,
    mae,
    rmse,
    biasPct: actualSum!==0 ? biasPct/actualSum*100 : null,
  };
}

async function handle(req: Request, supabase: any, userId: string): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!["GET", "POST"].includes(req.method)) return fail("Method not allowed", 405);

  const profile = await getProfile(supabase, userId);
  if (!profile) return fail("Profil Flowtym introuvable ou inaccessible", 403);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/functions\/v1\/revenue-api/, "").replace(/\/$/, "") || "/";
  if (req.method === "GET" && path === "/health") {
    return json({ ok: true, service: "flowtym-revenue-api", userRole: profile.role, timestamp: new Date().toISOString() });
  }
  if (req.method === "GET" && path === "/hotels") {
    const { data, error } = await supabase.from("hotels")
      .select("id,name,group_name,city,country,stars,room_count,timezone,currency,is_active")
      .order("name");
    if (error) return fail("Impossible de charger les hôtels", 400, error.message);
    return json({ ok: true, data });
  }

  const match = path.match(/^\/hotels\/([0-9a-f-]{36})(?:\/(.*))?$/i);
  if (!match) return fail("Route inconnue", 404);
  const hotelId = match[1];
  const actionPath = match[2] ?? "";
  const hotel = await getHotel(supabase, hotelId);
  if (!hotel) return fail("Hôtel introuvable ou accès refusé", 404);

  if (req.method === "GET" && actionPath === "rates") {
    const range = dateRange(url);
    if (!range) return fail("Les paramètres from et to sont obligatoires (maximum 365 jours)");
    const { data, error } = await supabase.from("daily_rate_intelligence")
      .select("*").eq("hotel_id", hotelId).gte("stay_date", range.from).lte("stay_date", range.to)
      .order("stay_date");
    if (error) return fail("Lecture des recommandations impossible", 400, error.message);
    return json({ ok: true, hotelId, ...range, data });
  }

  if (req.method === "GET" && actionPath === "events") {
    const range = dateRange(url);
    if (!range) return fail("Les paramètres from et to sont obligatoires (maximum 365 jours)");
    const { data, error } = await supabase.from("event_hotel_impacts")
      .select("*,events(id,title,category,status,official_url),event_occurrences(id,start_date,end_date,date_status)")
      .eq("hotel_id", hotelId).gte("event_occurrences.start_date", range.from)
      .lte("event_occurrences.end_date", range.to).order("final_rm_score", { ascending: false });
    if (error) return fail("Lecture des impacts événementiels impossible", 400, error.message);
    return json({ ok: true, hotelId, ...range, data });
  }

  if (req.method === "GET" && actionPath === "inventory-snapshots") {
    const range = dateRange(url);
    if (!range) return fail("Les paramètres from et to sont obligatoires (maximum 365 jours)");
    const { data, error } = await supabase.from("hotel_inventory_snapshots")
      .select("*").eq("hotel_id", hotelId).gte("stay_date", range.from).lte("stay_date", range.to)
      .order("snapshot_at", { ascending: false }).limit(2000);
    if (error) return fail("Lecture des snapshots impossible", 400, error.message);
    return json({ ok: true, hotelId, ...range, data });
  }

  if (req.method === "GET" && actionPath === "backtests") {
    const { data, error } = await supabase.from("hotel_backtest_evaluations")
      .select("*").eq("hotel_id",hotelId).order("evaluated_at",{ascending:false}).limit(100);
    if (error) return fail("Lecture des évaluations de backtest impossible",400,error.message);
    return json({ok:true,hotelId,data});
  }

  if (req.method === "GET" && actionPath === "forecasts") {
    const range = dateRange(url);
    if (!range) return fail("Les paramètres from et to sont obligatoires (maximum 365 jours)");
    const { data, error } = await supabase.from("daily_demand_forecasts")
      .select("*,revenue_forecast_runs!inner(model_name,model_version,as_of,run_status)")
      .eq("hotel_id", hotelId).gte("stay_date", range.from).lte("stay_date", range.to)
      .order("stay_date");
    if (error) return fail("Lecture des prévisions impossible", 400, error.message);
    return json({ ok: true, hotelId, ...range, data });
  }

  if (req.method !== "POST") return fail("Route inconnue", 404);
  if (!requireManager(profile)) return fail("Droits Revenue Manager ou administrateur requis", 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("Corps JSON invalide"); }

  if (actionPath === "decisions") {
    const { rateIntelligenceId, action, appliedRate, appliedMinStay, reasonCode, reasonText } = body;
    if (typeof rateIntelligenceId !== "string" || !["accept", "modify", "reject"].includes(String(action))) {
      return fail("rateIntelligenceId ou action invalide");
    }
    const { data, error } = await supabase.rpc("record_rm_decision", {
      p_hotel_id: hotelId,
      p_rate_intelligence_id: rateIntelligenceId,
      p_action: action,
      p_applied_rate: numberOrNull(appliedRate),
      p_applied_min_stay: typeof appliedMinStay === "number" && Number.isInteger(appliedMinStay) ? appliedMinStay : null,
      p_reason_code: typeof reasonCode === "string" ? reasonCode.slice(0, 80) : null,
      p_reason_text: typeof reasonText === "string" ? reasonText.slice(0, 2000) : null,
    });
    if (error) return fail("La décision n'a pas été enregistrée", 409, error.message);
    return json({ ok: true, data });
  }

  if (actionPath === "parameters") {
    const floor = numberOrNull(body.floorRate);
    const ceiling = numberOrNull(body.ceilingRate);
    const maxChange = numberOrNull(body.maxDailyRateChangePct);
    if (floor === null || ceiling === null || maxChange === null || floor <= 0 || ceiling < floor || maxChange <= 0 || maxChange > 100) {
      return fail("Plancher, plafond et variation quotidienne maximale doivent être renseignés et cohérents");
    }
    const profileRow = {
      organization_id: hotel.organization_id,
      hotel_id: hotelId,
      currency: typeof body.currency === "string" ? body.currency : hotel.currency,
      timezone: typeof body.timezone === "string" ? body.timezone : hotel.timezone,
      target_adr: numberOrNull(body.targetAdr),
      target_occupancy_pct: numberOrNull(body.targetOccupancyPct),
      target_revpar: numberOrNull(body.targetRevpar),
      floor_rate: floor,
      ceiling_rate: ceiling,
      max_daily_rate_change_pct: maxChange,
      distribution_cost_pct: numberOrNull(body.distributionCostPct),
      compset_config: Array.isArray(body.compsetConfig) ? body.compsetConfig : [],
      room_type_config: Array.isArray(body.roomTypeConfig) ? body.roomTypeConfig : [],
      demand_thresholds: typeof body.demandThresholds === "object" && body.demandThresholds !== null ? body.demandThresholds : {},
      updated_by: profile.id,
    };
    const { data, error } = await supabase.from("hotel_parameters_profiles")
      .upsert(profileRow, { onConflict: "hotel_id" }).select("*").single();
    if (error) return fail("Enregistrement des paramètres impossible", 400, error.message);
    return json({ ok: true, data });
  }

  if (actionPath === "inventory-snapshots") {
    if (!Array.isArray(body.snapshots) || body.snapshots.length < 1 || body.snapshots.length > 500) {
      return fail("Fournir entre 1 et 500 snapshots");
    }
    const rows = body.snapshots.map((s: any) => ({
      organization_id: hotel.organization_id, hotel_id: hotelId,
      room_type_id: typeof s.room_type_id === "string" ? s.room_type_id : null,
      stay_date: s.stay_date, snapshot_at: s.snapshot_at, source_system: String(s.source_system ?? "manual").slice(0,80),
      source_status: ["live","imported","fixture","simulation"].includes(s.source_status) ? s.source_status : "imported",
      total_rooms: numberOrNull(s.total_rooms), sellable_rooms: numberOrNull(s.sellable_rooms),
      rooms_sold: numberOrNull(s.rooms_sold), rooms_available: numberOrNull(s.rooms_available),
      out_of_order_rooms: numberOrNull(s.out_of_order_rooms), complimentary_rooms: numberOrNull(s.complimentary_rooms),
      occupancy_pct: numberOrNull(s.occupancy_pct), current_bar: numberOrNull(s.current_bar),
      currency: typeof s.currency === "string" ? s.currency : hotel.currency,
      min_stay: numberOrNull(s.min_stay), closed_to_arrival: typeof s.closed_to_arrival === "boolean" ? s.closed_to_arrival : null,
      closed_to_departure: typeof s.closed_to_departure === "boolean" ? s.closed_to_departure : null,
      raw_payload: s.raw_payload && typeof s.raw_payload === "object" ? s.raw_payload : {},
    }));
    if (rows.some((r: any) => !isDate(r.stay_date) || !r.snapshot_at || Number.isNaN(Date.parse(r.snapshot_at)))) {
      return fail("Chaque snapshot doit contenir stay_date et snapshot_at valides");
    }
    const { data, error } = await supabase.from("hotel_inventory_snapshots").insert(rows).select("id,stay_date,snapshot_at");
    if (error) return fail("Import des snapshots impossible", 400, error.message);
    return json({ ok: true, inserted: data?.length ?? 0, data }, 201);
  }

  if (actionPath === "reservation-snapshots") {
    if (!Array.isArray(body.snapshots) || body.snapshots.length < 1 || body.snapshots.length > 500) {
      return fail("Fournir entre 1 et 500 snapshots de réservations");
    }
    const rows=body.snapshots.map((s:any)=>({
      organization_id:hotel.organization_id,hotel_id:hotelId,
      stay_date:s.stay_date,snapshot_at:s.snapshot_at,source_system:String(s.source_system??"manual").slice(0,80),
      source_status:["live","imported","fixture","simulation"].includes(s.source_status)?s.source_status:"imported",
      segment:typeof s.segment==="string"?s.segment:null,channel:typeof s.channel==="string"?s.channel:null,
      room_type_id:typeof s.room_type_id==="string"?s.room_type_id:null,
      rooms_otb:numberOrNull(s.rooms_otb),room_nights_otb:numberOrNull(s.room_nights_otb),
      booked_revenue:numberOrNull(s.booked_revenue),booked_adr:numberOrNull(s.booked_adr),
      cancellation_count:numberOrNull(s.cancellation_count),lead_time_days:numberOrNull(s.lead_time_days),
      currency:typeof s.currency==="string"?s.currency:hotel.currency,
      pickup_window_hours:numberOrNull(s.pickup_window_hours),period_start:s.period_start??null,
      new_rooms_booked:numberOrNull(s.new_rooms_booked),cancelled_rooms:numberOrNull(s.cancelled_rooms),
      moved_in_rooms:numberOrNull(s.moved_in_rooms)??0,moved_out_rooms:numberOrNull(s.moved_out_rooms)??0,
    }));
    for (let i=0;i<rows.length;i++) {
      const r:any=rows[i], source:any=body.snapshots[i];
      if (!isDate(r.stay_date) || !r.snapshot_at || Number.isNaN(Date.parse(r.snapshot_at))) return fail("stay_date/snapshot_at invalide");
      if (r.pickup_window_hours!==null) {
        if (![24,72,168].includes(r.pickup_window_hours) || !r.period_start ||
            !Number.isInteger(source.new_rooms_booked) || source.new_rooms_booked<0 ||
            !Number.isInteger(source.cancelled_rooms) || source.cancelled_rooms<0 ||
            (source.moved_in_rooms!==undefined && (!Number.isInteger(source.moved_in_rooms) || source.moved_in_rooms<0)) ||
            (source.moved_out_rooms!==undefined && (!Number.isInteger(source.moved_out_rooms) || source.moved_out_rooms<0))) {
          return fail("Un pickup exact exige une fenêtre 24/72/168h, period_start et des volumes entiers non négatifs de réservations, annulations et déplacements");
        }
        const hours=(Date.parse(r.snapshot_at)-Date.parse(r.period_start))/3600000;
        if (!Number.isFinite(hours) || Math.abs(hours-r.pickup_window_hours)>1) return fail("La période de pickup ne correspond pas à la fenêtre déclarée (tolérance ±1h)");
      }
    }
    const {data,error}=await supabase.from("hotel_reservation_snapshots").insert(rows).select("id,stay_date,snapshot_at,pickup_window_hours,net_pickup_rooms");
    if (error) return fail("Import des snapshots de réservations impossible",400,error.message);
    return json({ok:true,inserted:data?.length??0,data},201);
  }

  if (actionPath === "historical-import") {
    if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 5000) {
      return fail("Fournir entre 1 et 5000 lignes historiques");
    }
    const sourceName = typeof body.sourceName === "string" && body.sourceName.trim() ? body.sourceName.trim().slice(0,120) : null;
    if (!sourceName) return fail("sourceName est obligatoire pour garantir la déduplication");
    const invalid = body.rows.filter((r: any) => !isDate(r.stay_date));
    if (invalid.length) return fail("Une ou plusieurs lignes ont une stay_date invalide", 422, { invalidRows: invalid.length });
    const dates = body.rows.map((r: any) => r.stay_date).sort();
    const { data: log, error: logError } = await supabase.from("hotel_historical_import_logs").insert({
      organization_id: hotel.organization_id, hotel_id: hotelId,
      file_name: typeof body.fileName === "string" ? body.fileName.slice(0,255) : "historical-import",
      records_count: body.rows.length, rejected_count: 0, date_start: dates[0], date_end: dates[dates.length-1],
      import_status: "pending", warnings: [], errors: [], detected_columns: Array.isArray(body.detectedColumns) ? body.detectedColumns : [],
      imported_by: profile.id,
    }).select("id").single();
    if (logError || !log) return fail("Création du journal d'import impossible", 400, logError?.message);
    const rows = body.rows.map((r: any) => ({
      ...r, id: undefined, organization_id: hotel.organization_id, hotel_id: hotelId,
      source_name: sourceName, source_status: "imported", import_batch_id: log.id,
      raw_record: r.raw_record && typeof r.raw_record === "object" ? r.raw_record : r,
      currency: typeof r.currency === "string" ? r.currency : hotel.currency,
    }));
    const { data, error } = await supabase.from("hotel_historical_daily")
      .upsert(rows, { onConflict: "hotel_id,stay_date,source_name" }).select("id");
    if (error) {
      await supabase.from("hotel_historical_import_logs").update({
        import_status: "failed", rejected_count: body.rows.length, errors: [{ message: error.message }],
      }).eq("id", log.id);
      return fail("Import historique échoué", 400, error.message);
    }
    await supabase.from("hotel_historical_import_logs").update({
      import_status: "completed", records_count: data?.length ?? 0,
    }).eq("id", log.id);
    return json({ ok: true, importId: log.id, imported: data?.length ?? 0 }, 201);
  }

  if (actionPath === "forecasts/baseline") {
    const start = body.startDate, end = body.endDate;
    if (!isDate(start) || !isDate(end) || start > end || eachDate(start, end).length > 180) {
      return fail("startDate/endDate invalides (maximum 180 jours)");
    }
    const today = new Date().toISOString().slice(0,10);
    const cutoff = addDays(today, -1095);
    const { data: history, error: historyError } = await supabase.from("hotel_historical_daily")
      .select("stay_date,day_of_week,occupancy_pct,adr_net,revpar,source_status")
      .eq("hotel_id", hotelId).gte("stay_date", cutoff).lt("stay_date", today)
      .in("source_status", ["real","imported"]).order("stay_date", { ascending: false }).limit(5000);
    if (historyError) return fail("Lecture de l'historique impossible", 400, historyError.message);

    const { data: run, error: runError } = await supabase.from("revenue_forecast_runs").insert({
      organization_id: hotel.organization_id, hotel_id: hotelId,
      model_name: "seasonal_naive_same_month_weekday", model_version: "1.0.0",
      as_of: new Date().toISOString(), horizon_start: start, horizon_end: end,
      input_freshness: { historicalRows: history?.length ?? 0, cutoff }, parameters: { minSamples: 3 },
      run_status: "running", created_by: profile.id,
    }).select("id").single();
    if (runError || !run) return fail("Création du run de prévision impossible", 400, runError?.message);

    const forecasts: any[] = [];
    for (const stayDate of eachDate(start, end)) {
      const d = new Date(stayDate + "T00:00:00Z");
      const month = d.getUTCMonth() + 1, dow = d.getUTCDay();
      const sample = (history ?? []).filter((r: any) =>
        r.stay_date < today && new Date(r.stay_date + "T00:00:00Z").getUTCMonth()+1 === month &&
        ((r.day_of_week ?? new Date(r.stay_date + "T00:00:00Z").getUTCDay()) === dow) && numberOrNull(r.occupancy_pct) !== null
      );
      if (sample.length < 3) continue;
      const occ = sample.map((r: any) => Number(r.occupancy_pct)).filter((n: number) => n >= 0 && n <= 100);
      const adr = sample.map((r: any) => Number(r.adr_net)).filter((n: number) => Number.isFinite(n) && n >= 0);
      const revpar = sample.map((r: any) => Number(r.revpar)).filter((n: number) => Number.isFinite(n) && n >= 0);
      forecasts.push({
        organization_id: hotel.organization_id, hotel_id: hotelId, forecast_run_id: run.id, stay_date: stayDate,
        occupancy_p10: quantile(occ,0.1), occupancy_p50: median(occ), occupancy_p90: quantile(occ,0.9),
        adr_p50: median(adr), revpar_p50: median(revpar), confidence_score: null,
        drivers: [{ type: "seasonal_naive", sampleCount: sample.length, sameMonthWeekday: true }],
        source_status: "derived",
      });
    }
    let insertError: any = null;
    if (forecasts.length) {
      const inserted = await supabase.from("daily_demand_forecasts").insert(forecasts);
      insertError = inserted.error;
    }
    await supabase.from("revenue_forecast_runs").update({
      run_status: insertError ? "failed" : "completed",
      error_message: insertError?.message ?? null,
    }).eq("id", run.id);
    if (insertError) return fail("Persistance des prévisions impossible", 400, insertError.message);
    return json({ ok: true, forecastRunId: run.id, datesRequested: eachDate(start,end).length, datesForecast: forecasts.length, skippedForInsufficientHistory: eachDate(start,end).length-forecasts.length }, 201);
  }

  if (actionPath === "events/score") {
    const occurrenceId = body.occurrenceId;
    if (typeof occurrenceId !== "string") return fail("occurrenceId obligatoire");
    if (hotel.lat === null || hotel.lng === null) return fail("Latitude/longitude de l'hôtel manquante : aucun score de proximité ne sera inventé",422);
    const [{data:params,error:paramsError},{data:occurrence,error:occurrenceError}] = await Promise.all([
      supabase.from("hotel_parameters_profiles").select("demand_thresholds").eq("hotel_id",hotelId).maybeSingle(),
      supabase.from("event_occurrences").select("id,event_id,start_date,end_date,date_status,attendance_estimate,events(id,title,category,status,expected_attendance,international_ratio_pct,recurrence_frequency,official_url,venues(id,name,latitude,longitude,capacity,verification_status),event_evidence(source_name,source_url,trust_score,verified_at))").eq("id",occurrenceId).maybeSingle(),
    ]);
    if (paramsError || occurrenceError) return fail("Lecture des paramètres ou de l'événement impossible",400,paramsError?.message ?? occurrenceError?.message);
    if (!occurrence) return fail("Occurrence événementielle introuvable",404);
    const event:any = occurrence.events;
    const venue:any = event?.venues;
    if (!event || !["confirmed","probable","estimated_recurrent"].includes(event.status) || occurrence.date_status !== "confirmed") return fail("Seuls les événements confirmés ou probables avec dates confirmées sont scorables",422);
    if (venue?.verification_status !== "verified" || numberOrNull(venue?.latitude)===null || numberOrNull(venue?.longitude)===null) {
      return fail("Lieu non vérifié ou coordonnées manquantes : score de proximité indisponible",422);
    }
    const cfg:any = params?.demand_thresholds?.event_impact_v1;
    if (!cfg?.weights || !cfg?.scales || !cfg?.recurrence_scores) {
      return fail("Le modèle event_impact_v1 doit être configuré par hôtel avant le calcul",422);
    }
    const weights=cfg.weights as Record<string,number>;
    const keys=["attendance","international","duration","proximity","capacity","notoriety","recurrence","extra_nights","segment_fit"];
    const totalWeight=keys.reduce((sum,k)=>sum+(Number(weights[k])||0),0);
    const scales=cfg.scales as Record<string,number>;
    if (totalWeight<=0 || keys.some(k=>!Number.isFinite(Number(weights[k])) || Number(weights[k])<0) ||
        !Number.isFinite(Number(scales.attendance)) || Number(scales.attendance)<=0 ||
        !Number.isFinite(Number(scales.duration_days)) || Number(scales.duration_days)<=0 ||
        !Number.isFinite(Number(scales.max_distance_km)) || Number(scales.max_distance_km)<=0 ||
        !Number.isFinite(Number(scales.venue_capacity)) || Number(scales.venue_capacity)<=0 ||
        !Number.isFinite(Number(cfg.minimum_weight_coverage_pct)) || Number(cfg.minimum_weight_coverage_pct)<=0 ||
        !Number.isInteger(Number(cfg.minimum_components)) || Number(cfg.minimum_components)<1) {
      return fail("Configuration event_impact_v1 invalide : weights, scales et seuils obligatoires",422);
    }
    const distance=haversineKm(Number(hotel.lat),Number(hotel.lng),Number(venue.latitude),Number(venue.longitude));
    const durationDays=Math.max(1,Math.round((Date.parse(occurrence.end_date+"T00:00:00Z")-Date.parse(occurrence.start_date+"T00:00:00Z"))/86400000)+1);
    const attendance=numberOrNull(occurrence.attendance_estimate) ?? numberOrNull(event.expected_attendance);
    const evidence=(event.event_evidence??[]).filter((e:any)=>e.verified_at && numberOrNull(e.trust_score)!==null);
    const notoriety=evidence.length ? evidence.reduce((sum:number,e:any)=>sum+Number(e.trust_score),0)/evidence.length : null;
    const recurrence=event.recurrence_frequency ? numberOrNull(cfg.recurrence_scores[event.recurrence_frequency]) : null;
    const segmentFit=hotel.segment && cfg.segment_fit_by_category
      ? numberOrNull(cfg.segment_fit_by_category[hotel.segment]?.[event.category]) : null;
    const components:Record<string,number|null>={
      attendance:attendance===null?null:clamp(attendance/Number(scales.attendance)*100,0,100),
      international:numberOrNull(event.international_ratio_pct),
      duration:clamp(durationDays/Number(scales.duration_days)*100,0,100),
      proximity:clamp(100*(1-distance/Number(scales.max_distance_km)),0,100),
      capacity:numberOrNull(venue.capacity)===null?null:clamp(Number(venue.capacity)/Number(scales.venue_capacity)*100,0,100),
      notoriety:notoriety,
      recurrence:recurrence,
      extra_nights:null,
      segment_fit:segmentFit,
    };
    const available=keys.filter(k=>components[k]!==null && Number(weights[k])>0);
    const coveredWeight=available.reduce((sum,k)=>sum+Number(weights[k]),0);
    const coverage=Math.round(100*coveredWeight/totalWeight);
    const componentCount=available.length;
    const score=componentCount>=Number(cfg.minimum_components) && coverage>=Number(cfg.minimum_weight_coverage_pct)
      ? Math.round(available.reduce((sum,k)=>sum+Number(weights[k])*Number(components[k]),0)/coveredWeight)
      : null;
    const scoreComponents={...components,weights,coveredWeight,totalWeight,componentCount,coverageScore:coverage,extraNightsStatus:"not_computed_no_verified_historical_lift_model"};
    const sourceEvidence=evidence.map((e:any)=>({sourceName:e.source_name,sourceUrl:e.source_url,trustScore:e.trust_score,verifiedAt:e.verified_at}));
    const {data:existing,error:existingError}=await supabase.from("event_hotel_impacts")
      .select("id,impact_status").eq("hotel_id",hotelId).eq("occurrence_id",occurrenceId).maybeSingle();
    if (existingError) return fail("Vérification de l'impact existant impossible",400,existingError.message);
    if (existing && existing.impact_status!=="to_review") return fail("Impact déjà validé ou écarté : révision explicite requise avant recalcul",409);
    const impactRow={
      organization_id:hotel.organization_id,hotel_id:hotelId,event_id:occurrence.event_id,occurrence_id:occurrenceId,
      distance_km:Math.round(distance*100)/100,drive_time_minutes:null,transit_time_minutes:null,
      attendance_score:components.attendance,international_score:components.international,
      duration_score:components.duration,proximity_score:components.proximity,
      recurrence_score:components.recurrence,capacity_score:components.capacity,
      notoriety_score:components.notoriety,extra_nights_score:null,segment_fit_score:components.segment_fit,
      source_confidence_score:coverage,score_components:scoreComponents,source_evidence:sourceEvidence,
      final_rm_score:score,confidence_score:coverage,estimated_demand_lift_pct:null,estimated_adr_lift_pct:null,
      recommended_action:score===null?"À compléter — preuves ou composants insuffisants":"À valider par le Revenue Manager",
      impact_status:"to_review",calculated_at:new Date().toISOString(),
    };
    const result=existing
      ? await supabase.from("event_hotel_impacts").update(impactRow).eq("id",existing.id).select("*").single()
      : await supabase.from("event_hotel_impacts").insert(impactRow).select("*").single();
    if (result.error) return fail("Enregistrement de l'impact hôtel impossible",400,result.error.message);
    return json({ok:true,data:result.data,requiresHumanValidation:true,driveTimeCalculated:false,extraNightsCalculated:false},201);
  }

  if (actionPath === "backtests/evaluate") {
    const forecastRunId = body.forecastRunId;
    if (typeof forecastRunId !== "string") return fail("forecastRunId obligatoire");
    const { data: run, error: runError } = await supabase.from("revenue_forecast_runs")
      .select("id,model_name,model_version,as_of,horizon_start,horizon_end,run_status")
      .eq("id",forecastRunId).eq("hotel_id",hotelId).maybeSingle();
    if (runError || !run) return fail("Run de prévision introuvable pour cet hôtel",404,runError?.message);
    if (run.run_status !== "completed") return fail("Seuls les runs terminés peuvent être évalués",409);
    const [{data:forecastRows,error:forecastError},{data:actualRows,error:actualError}] = await Promise.all([
      supabase.from("daily_demand_forecasts").select("stay_date,occupancy_p10,occupancy_p50,occupancy_p90")
        .eq("forecast_run_id",forecastRunId).eq("hotel_id",hotelId).is("room_type_id",null).order("stay_date"),
      supabase.from("hotel_historical_daily").select("stay_date,occupancy_pct,source_status,updated_at")
        .eq("hotel_id",hotelId).in("source_status",["real","imported"])
        .gte("stay_date",run.horizon_start).lte("stay_date",run.horizon_end).order("updated_at",{ascending:false}),
    ]);
    if (forecastError || actualError) return fail("Lecture des données de backtest impossible",400,forecastError?.message ?? actualError?.message);
    const actualByDate = new Map<string,number>();
    for (const row of actualRows ?? []) {
      if (!actualByDate.has(row.stay_date) && numberOrNull(row.occupancy_pct)!==null) actualByDate.set(row.stay_date,Number(row.occupancy_pct));
    }
    const pairedRows = (forecastRows ?? []).filter((row:any) =>
      Date.parse(run.as_of) < Date.parse(row.stay_date+"T00:00:00Z") && actualByDate.has(row.stay_date) && numberOrNull(row.occupancy_p50)!==null
    );
    if (!pairedRows.length) return fail("Aucune paire prévision/réel éligible. Les dates doivent être postérieures au as_of du run et disposer d'un réel historique.",422);
    const actual = pairedRows.map((row:any)=>actualByDate.get(row.stay_date)!);
    const forecast = pairedRows.map((row:any)=>Number(row.occupancy_p50));
    const metrics = calculateForecastMetrics(actual,forecast)!;
    const intervalRows = pairedRows.filter((row:any)=>numberOrNull(row.occupancy_p10)!==null && numberOrNull(row.occupancy_p90)!==null);
    const intervalCoverage = intervalRows.length
      ? intervalRows.filter((row:any)=>actualByDate.get(row.stay_date)!>=Number(row.occupancy_p10) && actualByDate.get(row.stay_date)!<=Number(row.occupancy_p90)).length/intervalRows.length
      : null;
    const firstDate = pairedRows[0].stay_date;
    const lastDate = pairedRows[pairedRows.length-1].stay_date;
    const horizonDays = Math.round((Date.parse(lastDate+"T00:00:00Z")-Date.parse(run.as_of))/86400000);
    const {data:evaluation,error:evaluationError}=await supabase.from("hotel_backtest_evaluations").insert({
      organization_id:hotel.organization_id,hotel_id:hotelId,model_name:run.model_name,model_version:run.model_version,
      evaluated_from:firstDate,evaluated_to:lastDate,horizon_days:horizonDays,sample_count:metrics.sampleCount,
      wape:metrics.wape,mae:metrics.mae,rmse:metrics.rmse,bias_pct:metrics.biasPct,
      baseline_metrics:{model:run.model_name,modelVersion:run.model_version},
      metrics_by_horizon:{overall:metrics},
      calibration:{occupancyP10P90Coverage:intervalCoverage,intervalSampleCount:intervalRows.length},
      leakage_checks:{runAsOfBeforeStayDate:true,onlyRealOrImportedActuals:true,excludedForecastDates:(forecastRows??[]).length-pairedRows.length},
      created_by:profile.id,
    }).select("*").single();
    if (evaluationError) return fail("Enregistrement du backtest impossible",400,evaluationError.message);
    return json({ok:true,data:evaluation},201);
  }

  if (actionPath === "recommendations/generate") {
    const start = body.startDate, end = body.endDate;
    if (!isDate(start) || !isDate(end) || start > end || eachDate(start,end).length > 90) {
      return fail("startDate/endDate invalides (maximum 90 jours)");
    }
    const [{ data: params }, { data: hotelSettings }] = await Promise.all([
      supabase.from("hotel_parameters_profiles").select("*").eq("hotel_id",hotelId).maybeSingle(),
      supabase.from("hotels").select("rate_floor,rate_ceiling,max_rate_change_pct").eq("id",hotelId).single(),
    ]);
    const cfg: any = params?.demand_thresholds?.pricing_v1;
    if (!params || !cfg || !cfg.weights || !cfg.thresholds || !cfg.rate_adjustments_pct) {
      return fail("Le modèle pricing_v1 doit être configuré dans les paramètres de l'hôtel avant de générer des recommandations", 422);
    }
    const floor = numberOrNull(params.floor_rate) ?? numberOrNull(hotelSettings?.rate_floor);
    const ceiling = numberOrNull(params.ceiling_rate) ?? numberOrNull(hotelSettings?.rate_ceiling);
    const maxChange = numberOrNull(params.max_daily_rate_change_pct) ?? numberOrNull(hotelSettings?.max_rate_change_pct);
    if (floor === null || ceiling === null || maxChange === null || floor <= 0 || ceiling < floor || maxChange <= 0) {
      return fail("Plancher, plafond et variation maximale doivent être configurés", 422);
    }
    const weights = cfg.weights as Record<string,number>;
    const keys = ["occupancy","pickup","event","compset"];
    const totalWeight = keys.reduce((s,k)=>s+(Number(weights[k])||0),0);
    const thresholds = cfg.thresholds as Record<string,number>;
    const adjustments = cfg.rate_adjustments_pct as Record<string,number>;
    const normalThreshold = Number(thresholds.normal);
    const highThreshold = Number(thresholds.high);
    const exceptionalThreshold = Number(thresholds.exceptional);
    const maxObservationAge = Number(cfg.max_observation_age_hours);
    const maxInventoryAge = Number(cfg.max_inventory_age_hours);
    const maxPickupSnapshotAge = Number(cfg.max_pickup_snapshot_age_hours);
    const pickupWindowWeights = cfg.pickup_window_weights as Record<string,number> | undefined;
    const pickupWindowScales = cfg.pickup_scale_rooms as Record<string,number> | undefined;
    const pickupWindows = ["24h","3d","7d"];
    const pickupConfigValid = Number(weights.pickup) === 0 || (
      !!pickupWindowWeights && !!pickupWindowScales &&
      pickupWindows.every(w => Number.isFinite(Number(pickupWindowWeights[w])) && Number(pickupWindowWeights[w]) >= 0 &&
        Number.isFinite(Number(pickupWindowScales[w])) && Number(pickupWindowScales[w]) > 0) &&
      pickupWindows.reduce((s,w)=>s+Number(pickupWindowWeights[w]),0) > 0
    );
    if (totalWeight <= 0 || keys.some(k => !Number.isFinite(Number(weights[k])) || Number(weights[k]) < 0) ||
        !Number.isFinite(normalThreshold) || !Number.isFinite(highThreshold) || !Number.isFinite(exceptionalThreshold) ||
        normalThreshold < 0 || normalThreshold >= highThreshold || highThreshold >= exceptionalThreshold || exceptionalThreshold > 100 ||
        !["low","normal","high","exceptional"].every(k => Number.isFinite(Number(adjustments[k]))) ||
        !Number.isFinite(maxObservationAge) || maxObservationAge <= 0 ||
        !Number.isFinite(maxInventoryAge) || maxInventoryAge <= 0 || !Number.isFinite(maxPickupSnapshotAge) || maxPickupSnapshotAge <= 0 || !pickupConfigValid) {
      return fail("Configuration pricing_v1 invalide : weights, thresholds et rate_adjustments_pct requis", 422);
    }

    const [inventoryResult,reservationResult,compRateResult,impactResult] = await Promise.all([
      supabase.from("hotel_inventory_snapshots").select("*").eq("hotel_id",hotelId).in("source_status",["live","imported"]).gte("stay_date",start).lte("stay_date",end).order("snapshot_at",{ascending:false}).limit(5000),
      supabase.from("hotel_reservation_snapshots").select("*").eq("hotel_id",hotelId).in("source_status",["live","imported"]).in("pickup_window_hours",[24,72,168]).not("net_pickup_rooms","is",null).gte("stay_date",start).lte("stay_date",end).order("snapshot_at",{ascending:false}).limit(5000),
      supabase.from("lighthouse_rate_observations").select("stay_date,rate_amount,availability_status,observed_at,source_status").eq("hotel_id",hotelId).eq("availability_status","available").in("source_status",["live","imported"]).gte("stay_date",start).lte("stay_date",end).not("rate_amount","is",null).order("observed_at",{ascending:false}).limit(5000),
      supabase.from("event_hotel_impacts").select("final_rm_score,occurrence_id,event_occurrences(start_date,end_date)").eq("hotel_id",hotelId).eq("impact_status","validated").gte("event_occurrences.start_date",start).lte("event_occurrences.end_date",end).not("final_rm_score","is",null),
    ]);
    const queryError = inventoryResult.error ?? reservationResult.error ?? compRateResult.error ?? impactResult.error;
    if (queryError) return fail("Lecture des données sources Revenue impossible", 400, queryError.message);
    const inventory = inventoryResult.data ?? [];
    const reservations = reservationResult.data ?? [];
    const compRates = compRateResult.data ?? [];
    const impacts = impactResult.data ?? [];
    const latestInventory = new Map<string,any>();
    for (const r of inventory ?? []) if (!latestInventory.has(r.stay_date)) latestInventory.set(r.stay_date,r);
    const reservationByDate = new Map<string,any[]>();
    for (const r of reservations ?? []) reservationByDate.set(r.stay_date,[...(reservationByDate.get(r.stay_date)??[]),r]);
    const compByDate = new Map<string,number[]>();
    const maxAgeHours = maxObservationAge;
    for (const r of compRates ?? []) {
      const age=(Date.now()-Date.parse(r.observed_at))/3600000;
      if (age >= 0 && age <= maxAgeHours && Number(r.rate_amount)>0) compByDate.set(r.stay_date,[...(compByDate.get(r.stay_date)??[]),Number(r.rate_amount)]);
    }
    const eventByDate = new Map<string,number>();
    for (const r of impacts ?? []) {
      const occ=(r as any).event_occurrences;
      if (!occ?.start_date || !occ?.end_date) continue;
      for (const day of eachDate(occ.start_date,occ.end_date)) {
        if (day>=start && day<=end) eventByDate.set(day,Math.max(eventByDate.get(day)??0,Number(r.final_rm_score)));
      }
    }
    const output:any[]=[];
    for (const stayDate of eachDate(start,end)) {
      const inv=latestInventory.get(stayDate);
      const current=numberOrNull(inv?.current_bar);
      if (current===null || current<=0) continue;
      const inventoryAgeHours=(Date.now()-Date.parse(inv.snapshot_at))/3600000;
      if (!Number.isFinite(inventoryAgeHours) || inventoryAgeHours < 0 || inventoryAgeHours > maxInventoryAge) {
        output.push({stayDate,status:"skipped",reason:"stale_inventory_snapshot"});
        continue;
      }
      const signals:Record<string,number|null>={occupancy:null,pickup:null,event:eventByDate.get(stayDate)??null,compset:null};
      if (numberOrNull(inv?.occupancy_pct)!==null) signals.occupancy=clamp(Number(inv.occupancy_pct),0,100);
      const snaps=(reservationByDate.get(stayDate)??[]).sort((a,b)=>Date.parse(b.snapshot_at)-Date.parse(a.snapshot_at));
      const pickups:Record<string,number|null>={"24h":null,"3d":null,"7d":null};
      const pickupScores:Record<string,number|null>={"24h":null,"3d":null,"7d":null};
      const pickupWindowHours:Record<string,number>={"24h":24,"3d":72,"7d":168};
      for (const window of pickupWindows) {
        const snapshot=snaps.find((s:any)=>Number(s.pickup_window_hours)===pickupWindowHours[window]);
        if (!snapshot) continue;
        const ageHours=(Date.now()-Date.parse(snapshot.snapshot_at))/3600000;
        const netPickup=numberOrNull(snapshot.net_pickup_rooms);
        if (ageHours<0 || ageHours>maxPickupSnapshotAge || netPickup===null) continue;
        pickups[window]=netPickup;
        if (pickupWindowScales && Number(pickupWindowScales[window])>0) {
          pickupScores[window]=clamp(50+50*netPickup/Number(pickupWindowScales[window]),0,100);
        }
      }
      if (pickupWindowWeights) {
        const availableWindows=pickupWindows.filter(w=>pickupScores[w]!==null && Number(pickupWindowWeights[w])>0);
        const windowWeight=availableWindows.reduce((s,w)=>s+Number(pickupWindowWeights[w]),0);
        if (windowWeight>0) signals.pickup=availableWindows.reduce((s,w)=>s+Number(pickupWindowWeights[w])*Number(pickupScores[w]),0)/windowWeight;
      }
      const med=median(compByDate.get(stayDate)??[]);
      if (med!==null) signals.compset=clamp(50+100*(med-current)/current,0,100);
      const available=keys.filter(k=>signals[k]!==null && Number(weights[k])>0);
      const coveredWeight=available.reduce((s,k)=>s+Number(weights[k]),0);
      const confidence=Math.round(100*coveredWeight/totalWeight);
      const score=coveredWeight>0 ? available.reduce((s,k)=>s+Number(weights[k])*Number(signals[k]),0)/coveredWeight : null;
      let bucket="low";
      if (score!==null && score>=Number(thresholds.exceptional)) bucket="exceptional";
      else if (score!==null && score>=Number(thresholds.high)) bucket="high";
      else if (score!==null && score>=Number(thresholds.normal)) bucket="normal";
      const sufficient=available.length>=2 && confidence>=60 && score!==null;
      const requestedPct=sufficient ? Number(adjustments[bucket]) : 0;
      const maxDelta=current*maxChange/100;
      const bounded=clamp(current*(1+requestedPct/100),Math.max(floor,current-maxDelta),Math.min(ceiling,current+maxDelta));
      const suggested=Math.round(bounded*100)/100;
      const evidence={signals,weights,coveredWeight,totalWeight,confidenceIsSourceCoverage:true,pickupWindows:pickups,pickupWindowScores:pickupScores,pickupWindowWeights:pickupWindowWeights??null,compsetMedian:med,eventScore:eventByDate.get(stayDate)??null,inventorySnapshotAt:inv?.snapshot_at??null,pricingConfig:cfg};
      const explanation=sufficient
        ? `Score demande ${score!.toFixed(1)}/100 (${bucket}); variation paramétrée ${requestedPct}% bornée par plancher/plafond et variation maximale. Couverture des sources: ${confidence}%.`
        : "MAINTENIR : données indépendantes insuffisantes pour justifier une variation tarifaire.";
      const row={
        organization_id:hotel.organization_id,hotel_id:hotelId,stay_date:stayDate,currency:hotel.currency,
        current_bar:current,suggested_bar:suggested,delta_amount:Math.round((suggested-current)*100)/100,
        delta_pct:Math.round(((suggested-current)/current)*10000)/100,
        demand_index:score===null?null:Math.round(score),demand_level:sufficient?({low:"faible",normal:"normal",high:"eleve",exceptional:"exceptionnel"} as Record<string,string>)[bucket]:"normal",
        occupancy_pct:signals.occupancy,rooms_remaining:numberOrNull(inv?.rooms_available),pickup_24h:pickups["24h"],pickup_3d:pickups["3d"],pickup_7d:pickups["7d"],
        lighthouse_median:null,flowtym_compset_median:med,strategy_code:sufficient?`PRICING_V1_${bucket.toUpperCase()}`:"HOLD_INSUFFICIENT_DATA",
        explanation, evidence, confidence_score:confidence,
        data_quality_status:sufficient?"valid":"insufficient",input_snapshot:evidence,
        engine_version:"pricing_v1",recommendation_status:"pending",
      };
      const {data:persisted,error:persistError}=await supabase.rpc("persist_rm_recommendation",{
        p_organization_id:hotel.organization_id,
        p_hotel_id:hotelId,
        p_stay_date:stayDate,
        p_currency:hotel.currency,
        p_current_bar:row.current_bar,
        p_suggested_bar:row.suggested_bar,
        p_delta_amount:row.delta_amount,
        p_delta_pct:row.delta_pct,
        p_demand_index:row.demand_index,
        p_demand_level:row.demand_level,
        p_occupancy_pct:row.occupancy_pct,
        p_rooms_remaining:row.rooms_remaining,
        p_pickup_24h:row.pickup_24h,
        p_pickup_3d:row.pickup_3d,
        p_pickup_7d:row.pickup_7d,
        p_lighthouse_median:row.lighthouse_median,
        p_flowtym_compset_median:row.flowtym_compset_median,
        p_strategy_code:row.strategy_code,
        p_explanation:row.explanation,
        p_evidence:row.evidence,
        p_confidence_score:row.confidence_score,
        p_data_quality_status:row.data_quality_status,
        p_input_snapshot:row.input_snapshot,
        p_engine_version:row.engine_version,
      });
      if (persistError) return fail("Persistance idempotente de la recommandation impossible",409,persistError.message);
      const saved=Array.isArray(persisted)?persisted[0]:persisted;
      output.push({recommendationId:saved?.id,stayDate,currentBar:current,suggestedBar:suggested,demandIndex:row.demand_index,bucket:row.demand_level,pickup24h:pickups["24h"],pickup3d:pickups["3d"],pickup7d:pickups["7d"],coverageScore:confidence,status:row.data_quality_status});
    }
    return json({ok:true,hotelId,engineVersion:"pricing_v1",generated:output.length,requiresHumanApproval:true,automaticPublication:false,data:output},201);
  }

  return fail("Route inconnue", 404);
}

Deno.serve(withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const userId = ctx.userClaims?.id;
    if (!userId) return fail("Authentification requise", 401);
    return await handle(req, ctx.supabase, userId);
  } catch (error) {
    console.error("[revenue-api]", error);
    return fail("Erreur interne du service Revenue Management", 500);
  }
}));
