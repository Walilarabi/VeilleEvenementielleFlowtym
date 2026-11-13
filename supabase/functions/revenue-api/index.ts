import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

type Profile = { id: string; organization_id: string | null; role: string; email: string | null };
type Hotel = { id: string; organization_id: string; name: string; room_count: number | null; timezone: string; currency: string; rate_floor: number | null; rate_ceiling: number | null; max_rate_change_pct: number | null };

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

async function getProfile(supabase: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("users").select("id,organization_id,role,email").eq("id", userId).maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}

async function getHotel(supabase: SupabaseClient, hotelId: string): Promise<Hotel | null> {
  const { data, error } = await supabase
    .from("hotels")
    .select("id,organization_id,name,room_count,timezone,currency,rate_floor,rate_ceiling,max_rate_change_pct")
    .eq("id", hotelId).maybeSingle();
  if (error || !data) return null;
  return data as Hotel;
}

function requireManager(profile: Profile) {
  return ["super_admin", "admin", "revenue_manager"].includes(profile.role);
}

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!["GET", "POST"].includes(req.method)) return fail("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return fail("Authentification requise", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const apiKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !apiKey) return fail("Configuration serveur Supabase incomplète", 500);

  // The caller's JWT is forwarded to PostgREST. No service-role key is used:
  // every database operation remains subject to the caller's RLS policies.
  const supabase = createClient(supabaseUrl, apiKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return fail("Session invalide ou expirée", 401);
  const profile = await getProfile(supabase, authData.user.id);
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
    if (totalWeight <= 0 || keys.some(k => !Number.isFinite(Number(weights[k])) || Number(weights[k]) < 0) ||
        !Number.isFinite(Number(thresholds.normal)) || !Number.isFinite(Number(thresholds.high)) ||
        !Number.isFinite(Number(thresholds.exceptional)) ||
        !["low","normal","high","exceptional"].every(k => Number.isFinite(Number(adjustments[k])))) {
      return fail("Configuration pricing_v1 invalide : weights, thresholds et rate_adjustments_pct requis", 422);
    }

    const [inventoryResult,reservationResult,compRateResult,impactResult] = await Promise.all([
      supabase.from("hotel_inventory_snapshots").select("*").eq("hotel_id",hotelId).in("source_status",["live","imported"]).gte("stay_date",start).lte("stay_date",end).order("snapshot_at",{ascending:false}).limit(5000),
      supabase.from("hotel_reservation_snapshots").select("*").eq("hotel_id",hotelId).in("source_status",["live","imported"]).gte("stay_date",start).lte("stay_date",end).order("snapshot_at",{ascending:false}).limit(5000),
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
    const maxAgeHours = Number(cfg.max_observation_age_hours ?? 48);
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
      const signals:Record<string,number|null>={occupancy:null,pickup:null,event:eventByDate.get(stayDate)??null,compset:null};
      if (numberOrNull(inv?.occupancy_pct)!==null) signals.occupancy=clamp(Number(inv.occupancy_pct),0,100);
      const snaps=(reservationByDate.get(stayDate)??[]).sort((a,b)=>Date.parse(b.snapshot_at)-Date.parse(a.snapshot_at));
      if (snaps.length>=2 && numberOrNull(snaps[0].rooms_otb)!==null) {
        const prior=snaps.slice(1).find((s:any)=>Date.parse(snaps[0].snapshot_at)-Date.parse(s.snapshot_at)>=20*3600000);
        if (prior && numberOrNull(prior.rooms_otb)!==null) {
          const roomsScale=Number(cfg.pickup_scale_rooms);
          if (Number.isFinite(roomsScale) && roomsScale>0) signals.pickup=clamp(50+50*(Number(snaps[0].rooms_otb)-Number(prior.rooms_otb))/roomsScale,0,100);
        }
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
      const evidence={signals,weights,coveredWeight,totalWeight,confidenceIsSourceCoverage:true,compsetMedian:med,eventScore:eventByDate.get(stayDate)??null,inventorySnapshotAt:inv?.snapshot_at??null,pricingConfig:cfg};
      const explanation=sufficient
        ? `Score demande ${score!.toFixed(1)}/100 (${bucket}); variation paramétrée ${requestedPct}% bornée par plancher/plafond et variation maximale. Couverture des sources: ${confidence}%.`
        : "MAINTENIR : données indépendantes insuffisantes pour justifier une variation tarifaire.";
      const row={
        organization_id:hotel.organization_id,hotel_id:hotelId,stay_date:stayDate,currency:hotel.currency,
        current_bar:current,suggested_bar:suggested,delta_amount:Math.round((suggested-current)*100)/100,
        delta_pct:Math.round(((suggested-current)/current)*10000)/100,
        demand_index:score===null?null:Math.round(score),demand_level:sufficient?({low:"faible",normal:"normal",high:"eleve",exceptional:"exceptionnel"} as Record<string,string>)[bucket]:"normal",
        occupancy_pct:signals.occupancy,rooms_remaining:numberOrNull(inv?.rooms_available),
        lighthouse_median:null,flowtym_compset_median:med,strategy_code:sufficient?`PRICING_V1_${bucket.toUpperCase()}`:"HOLD_INSUFFICIENT_DATA",
        explanation, evidence, confidence_score:confidence,
        data_quality_status:sufficient?"valid":"insufficient",input_snapshot:evidence,
        engine_version:"pricing_v1",recommendation_status:"pending",
      };
      const {data:existing}=await supabase.from("daily_rate_intelligence").select("id,recommendation_status")
        .eq("hotel_id",hotelId).eq("stay_date",stayDate).eq("engine_version","pricing_v1")
        .is("room_type_id",null).is("rate_plan_id",null).maybeSingle();
      if (existing?.recommendation_status==="pending") {
        const {error}=await supabase.from("daily_rate_intelligence").update(row).eq("id",existing.id);
        if (error) return fail("Mise à jour d'une recommandation impossible",400,error.message);
      } else {
        const {error}=await supabase.from("daily_rate_intelligence").insert(row);
        if (error) return fail("Enregistrement d'une recommandation impossible",400,error.message);
      }
      output.push({stayDate,currentBar:current,suggestedBar:suggested,demandIndex:row.demand_index,bucket:row.demand_level,confidenceScore:confidence,status:row.data_quality_status});
    }
    return json({ok:true,hotelId,engineVersion:"pricing_v1",generated:output.length,requiresHumanApproval:true,automaticPublication:false,data:output},201);
  }

  return fail("Route inconnue", 404);
}

Deno.serve(async (req: Request) => {
  try {
    return await handle(req);
  } catch (error) {
    console.error("[revenue-api]", error);
    return fail("Erreur interne du service Revenue Management", 500);
  }
});
