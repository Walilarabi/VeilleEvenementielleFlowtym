-- FLOWTYM / HOPTYM Revenue Management backend foundation
-- Additive, idempotent migration. Preserves existing organizations, users and hotels.
-- No external provider credentials or automatic rate publication are stored here.

begin;

create schema if not exists flowtym_private;
revoke all on schema flowtym_private from public, anon;
grant usage on schema flowtym_private to authenticated;

-- Existing hotel records remain valid: all new configuration fields are nullable/defaulted.
alter table public.hotels
  add column if not exists timezone text not null default 'Europe/Paris',
  add column if not exists currency char(3) not null default 'EUR',
  add column if not exists rate_floor numeric(10,2),
  add column if not exists rate_ceiling numeric(10,2),
  add column if not exists max_rate_change_pct numeric(5,2),
  add column if not exists main_radius_km numeric(6,2) not null default 10,
  add column if not exists extended_radius_km numeric(6,2) not null default 30,
  add column if not exists is_active boolean not null default true;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='hotels_id_organization_unique') then
    alter table public.hotels add constraint hotels_id_organization_unique unique (id, organization_id);
  end if;
end $$;

create table if not exists public.hotel_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  user_id uuid not null references public.users(id) on delete cascade,
  membership_role text not null default 'viewer' check (membership_role in ('hotel_gm','revenue_manager','analyst','viewer')),
  created_at timestamptz not null default now(),
  unique (hotel_id,user_id),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade
);

-- This invoker-rights helper only sees the caller's own profile and own membership rows under RLS.
create or replace function flowtym_private.can_access_hotel(p_hotel_id uuid, p_organization_id uuid)
returns boolean
language sql stable security invoker
set search_path = pg_catalog, public, flowtym_private
as $$
  select exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and (
        u.role = 'super_admin'
        or (
          u.organization_id = p_organization_id
          and (
            u.role in ('admin','revenue_manager')
            or exists (
              select 1 from public.hotel_memberships hm
              where hm.hotel_id = p_hotel_id and hm.user_id = u.id
            )
          )
        )
      )
  );
$$;
grant execute on function flowtym_private.can_access_hotel(uuid,uuid) to authenticated;

create or replace function flowtym_private.set_updated_at()
returns trigger language plpgsql security invoker
set search_path = pg_catalog
as $$ begin new.updated_at = now(); return new; end $$;

-- Geographic and event reference catalog (shared read, super-admin writes).
create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  region text,
  country_code char(2) not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  territory_code text,
  created_at timestamptz not null default now(),
  unique(normalized_name,country_code)
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  venue_type text not null check (venue_type in ('parc_expositions','arena','stade','centre_congres','theatre','espace_public','autre')),
  city_id uuid references public.cities(id) on delete set null,
  city text not null,
  country_code char(2) not null,
  address text,
  postal_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  capacity integer check (capacity is null or capacity >= 0),
  official_website text,
  verification_status text not null default 'unverified' check (verification_status in ('verified','unverified','disputed','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  normalized_title text not null,
  subtitle text,
  category text not null check (category in ('salons_foires','congres_medical','concerts_spectacles','sport','festivals','mode_luxe','corporate_sommet','culturel','vacances_scolaires','autre')),
  venue_id uuid references public.venues(id) on delete set null,
  city text not null,
  country_code char(2) not null,
  status text not null default 'a_verifier' check (status in ('confirmed','probable','estime','a_verifier','estimated_recurrent','announced_pending','rumored','cancelled')),
  expected_attendance integer check (expected_attendance is null or expected_attendance >= 0),
  international_ratio_pct numeric(5,2) check (international_ratio_pct is null or international_ratio_pct between 0 and 100),
  recurrence_frequency text check (recurrence_frequency is null or recurrence_frequency in ('annual','biennial','triennial','one_time')),
  official_url text,
  first_verified_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_occurrences (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  date_status text not null default 'confirmed' check (date_status in ('confirmed','estimated','tentative','cancelled')),
  attendance_estimate integer check (attendance_estimate is null or attendance_estimate >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique(event_id,start_date,end_date),
  check (end_date >= start_date)
);

create table if not exists public.event_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_url text not null,
  source_type text not null check (source_type in ('official_organizer','venue_calendar','city_agenda','institutional','press','ticketing','other')),
  city text,
  country_code char(2),
  reliability_score numeric(5,2) not null default 50 check (reliability_score between 0 and 100),
  is_official boolean not null default false,
  status text not null default 'healthy' check (status in ('healthy','warning','error','disabled')),
  last_crawled_at timestamptz,
  created_at timestamptz not null default now(),
  unique(source_url)
);

create table if not exists public.event_evidence (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  occurrence_id uuid references public.event_occurrences(id) on delete set null,
  source_id uuid references public.event_sources(id) on delete set null,
  source_name text not null,
  source_url text not null,
  excerpt text,
  evidence_type text not null default 'web',
  trust_score numeric(5,2) check (trust_score is null or trust_score between 0 and 100),
  verified_at timestamptz,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Hotel-specific event impact and curation.
create table if not exists public.event_hotel_impacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  event_id uuid not null references public.events(id) on delete cascade,
  occurrence_id uuid references public.event_occurrences(id) on delete cascade,
  distance_km numeric(8,2),
  drive_time_minutes integer,
  transit_time_minutes integer,
  attendance_score numeric(5,2),
  international_score numeric(5,2),
  duration_score numeric(5,2),
  proximity_score numeric(5,2),
  recurrence_score numeric(5,2),
  capacity_score numeric(5,2),
  final_rm_score integer check (final_rm_score is null or final_rm_score between 0 and 100),
  confidence_score integer check (confidence_score is null or confidence_score between 0 and 100),
  estimated_demand_lift_pct numeric(7,2),
  estimated_adr_lift_pct numeric(7,2),
  recommended_action text,
  impact_status text not null default 'to_review' check (impact_status in ('to_review','validated','dismissed')),
  calculated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade,
  unique(hotel_id,occurrence_id)
);

create table if not exists public.event_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  proposed_event jsonb not null,
  source_url text,
  confidence_score integer check (confidence_score is null or confidence_score between 0 and 100),
  review_status text not null default 'pending' check (review_status in ('pending','approved','dismissed')),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade
);

-- Hotel inventory, room/rate structure and market observations.
create table if not exists public.hotel_room_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  code text not null,
  name text not null,
  capacity integer check (capacity is null or capacity > 0),
  rooms_count integer check (rooms_count is null or rooms_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade,
  unique(hotel_id,code)
);

create table if not exists public.hotel_rate_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  room_type_id uuid references public.hotel_room_types(id) on delete set null,
  code text not null,
  name text not null,
  refundable boolean,
  meal_plan text,
  currency char(3) not null default 'EUR',
  is_public boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade,
  unique(hotel_id,code)
);

create table if not exists public.competitor_hotels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  competitor_name text not null,
  provider_competitor_id text,
  address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  distance_meters integer check (distance_meters is null or distance_meters >= 0),
  stars integer check (stars is null or stars between 1 and 5),
  room_count integer check (room_count is null or room_count >= 0),
  room_type_mapping jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade,
  unique(hotel_id,competitor_name)
);

create table if not exists public.lighthouse_extractions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  file_name text,
  provider text not null default 'lighthouse',
  extraction_type text not null default 'manual_import' check (extraction_type in ('api','manual_import','scheduled_import')),
  observed_at timestamptz not null,
  stay_start date,
  stay_end date,
  currency char(3) not null default 'EUR',
  occupancy_context text,
  los_nights integer check (los_nights is null or los_nights > 0),
  guests_count integer check (guests_count is null or guests_count > 0),
  source_status text not null default 'imported' check (source_status in ('live','imported','fixture','simulation')),
  records_count integer not null default 0 check (records_count >= 0),
  imported_by uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade,
  check (stay_end is null or stay_start is null or stay_end >= stay_start)
);

create table if not exists public.lighthouse_rate_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  extraction_id uuid references public.lighthouse_extractions(id) on delete set null,
  competitor_id uuid references public.competitor_hotels(id) on delete set null,
  stay_date date not null,
  competitor_name text not null,
  room_type text,
  rate_plan text,
  channel text,
  currency char(3) not null default 'EUR',
  rate_amount numeric(12,2),
  availability_status text not null check (availability_status in ('available','sold_out','unknown','not_comparable','error')),
  observed_at timestamptz not null,
  source_status text not null default 'imported' check (source_status in ('live','imported','fixture','simulation')),
  comparability jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade,
  check (rate_amount is null or rate_amount >= 0)
);

create table if not exists public.hotel_inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  room_type_id uuid references public.hotel_room_types(id) on delete set null,
  stay_date date not null,
  snapshot_at timestamptz not null,
  source_system text not null,
  source_status text not null default 'imported' check (source_status in ('live','imported','fixture','simulation')),
  total_rooms integer check (total_rooms is null or total_rooms >= 0),
  sellable_rooms integer check (sellable_rooms is null or sellable_rooms >= 0),
  rooms_sold integer check (rooms_sold is null or rooms_sold >= 0),
  rooms_available integer check (rooms_available is null or rooms_available >= 0),
  out_of_order_rooms integer check (out_of_order_rooms is null or out_of_order_rooms >= 0),
  complimentary_rooms integer check (complimentary_rooms is null or complimentary_rooms >= 0),
  occupancy_pct numeric(5,2) check (occupancy_pct is null or occupancy_pct between 0 and 100),
  current_bar numeric(12,2),
  currency char(3) not null default 'EUR',
  min_stay integer,
  closed_to_arrival boolean,
  closed_to_departure boolean,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade,
  check (rooms_available is null or sellable_rooms is null or rooms_available <= sellable_rooms)
);

create table if not exists public.hotel_reservation_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  stay_date date not null,
  snapshot_at timestamptz not null,
  source_system text not null,
  source_status text not null default 'imported' check (source_status in ('live','imported','fixture','simulation')),
  segment text,
  channel text,
  room_type_id uuid references public.hotel_room_types(id) on delete set null,
  rooms_otb integer check (rooms_otb is null or rooms_otb >= 0),
  room_nights_otb integer check (room_nights_otb is null or room_nights_otb >= 0),
  booked_revenue numeric(14,2),
  booked_adr numeric(12,2),
  cancellation_count integer,
  lead_time_days numeric(8,2),
  currency char(3) not null default 'EUR',
  created_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade
);

-- Revenue decision ledger and immutable audit.
create table if not exists public.daily_rate_intelligence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  room_type_id uuid references public.hotel_room_types(id) on delete set null,
  rate_plan_id uuid references public.hotel_rate_plans(id) on delete set null,
  stay_date date not null,
  currency char(3) not null default 'EUR',
  current_bar numeric(12,2),
  suggested_bar numeric(12,2),
  delta_amount numeric(12,2),
  delta_pct numeric(7,2),
  demand_index integer check (demand_index is null or demand_index between 0 and 100),
  demand_level text check (demand_level is null or demand_level in ('faible','normal','modere','eleve','tres_fort','exceptionnel')),
  occupancy_pct numeric(5,2),
  rooms_remaining integer,
  pickup_24h integer,
  pickup_3d integer,
  pickup_7d integer,
  lighthouse_median numeric(12,2),
  flowtym_compset_median numeric(12,2),
  compset_min numeric(12,2),
  compset_max numeric(12,2),
  forecast_occupancy_p50 numeric(5,2),
  forecast_occupancy_p10 numeric(5,2),
  forecast_occupancy_p90 numeric(5,2),
  strategy_code text,
  explanation text,
  evidence jsonb not null default '{}'::jsonb,
  confidence_score integer check (confidence_score is null or confidence_score between 0 and 100),
  data_quality_status text not null default 'insufficient' check (data_quality_status in ('valid','degraded','insufficient','stale','conflicted')),
  input_snapshot jsonb not null default '{}'::jsonb,
  engine_version text not null,
  recommendation_status text not null default 'pending' check (recommendation_status in ('pending','accepted','modified','rejected','expired','applied')),
  approved_rate numeric(12,2),
  approved_min_stay integer,
  decision_by uuid references public.users(id) on delete set null,
  decision_at timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade,
  unique(hotel_id,room_type_id,rate_plan_id,stay_date,engine_version)
);

create table if not exists public.rm_decision_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  rate_intelligence_id uuid references public.daily_rate_intelligence(id) on delete set null,
  stay_date date not null,
  action_type text not null check (action_type in ('accept','modify','reject','postpone','apply_requested','apply_confirmed','apply_failed')),
  previous_rate numeric(12,2),
  suggested_rate numeric(12,2),
  final_rate numeric(12,2),
  reason_code text,
  reason_text text,
  actor_user_id uuid references public.users(id) on delete set null,
  source_snapshot jsonb not null default '{}'::jsonb,
  provider_result jsonb,
  created_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade
);

-- Historical facts, snapshots, parameter profiles, imports and backtests.
create table if not exists public.hotel_historical_daily (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  stay_date date not null,
  day_of_week smallint check (day_of_week between 0 and 6),
  week_of_year smallint check (week_of_year between 1 and 54),
  month_of_year smallint check (month_of_year between 1 and 12),
  year_of_stay smallint check (year_of_stay between 2000 and 2100),
  is_holiday boolean,
  is_school_holiday boolean,
  school_holiday_zone text,
  season text,
  day_type text,
  event_name text,
  event_category text,
  event_start_date date,
  event_end_date date,
  event_visitors integer,
  event_distance_km numeric(8,2),
  total_marketable_rooms integer,
  available_rooms integer,
  rooms_sold integer,
  complimentary_rooms integer,
  out_of_order_rooms integer,
  occupancy_pct numeric(5,2),
  reservations_count integer,
  guests_count integer,
  adr_net numeric(12,2),
  revpar numeric(12,2),
  accommodation_revenue numeric(14,2),
  total_revenue numeric(14,2),
  distribution_cost numeric(12,2),
  commission_pct numeric(5,2),
  net_adr numeric(12,2),
  otb_j90 integer, otb_j60 integer, otb_j30 integer, otb_j14 integer, otb_j7 integer, otb_j3 integer, otb_j1 integer,
  pickup_j90_j60 integer, pickup_j60_j30 integer, pickup_j30_j14 integer, pickup_j14_j7 integer, pickup_j7_j3 integer, pickup_j3_j1 integer, pickup_j1_arrival integer,
  lead_time_days numeric(8,2),
  cancellations_count integer,
  cancellation_rate_pct numeric(5,2),
  direct_reservations integer,
  booking_reservations integer,
  expedia_reservations integer,
  gds_reservations integer,
  group_reservations integer,
  corporate_reservations integer,
  other_ota_reservations integer,
  public_bar numeric(12,2),
  compset_avg numeric(12,2),
  compset_min numeric(12,2),
  compset_max numeric(12,2),
  rate_position_index numeric(8,2),
  currency char(3) not null default 'EUR',
  source_status text not null default 'imported' check (source_status in ('real','imported','fixture','simulation')),
  source_name text,
  source_record_id text,
  import_batch_id uuid,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade,
  unique(hotel_id,stay_date,source_name)
);

create table if not exists public.hotel_historical_demand_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  observation_date date not null,
  arrival_date date not null,
  days_before_arrival integer not null,
  rooms_booked_otb integer,
  rooms_available integer,
  projected_occupancy_pct numeric(5,2),
  booked_adr numeric(12,2),
  booked_revenue numeric(14,2),
  pickup_since_previous integer,
  cancellations_since_previous integer,
  public_rate numeric(12,2),
  compset_rate numeric(12,2),
  source_status text not null default 'imported' check (source_status in ('real','imported','fixture','simulation')),
  source_name text,
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade,
  unique(hotel_id,observation_date,arrival_date,source_name)
);

create table if not exists public.hotel_parameters_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null unique,
  currency char(3) not null default 'EUR',
  timezone text not null default 'Europe/Paris',
  target_adr numeric(12,2),
  target_occupancy_pct numeric(5,2),
  target_revpar numeric(12,2),
  floor_rate numeric(12,2),
  ceiling_rate numeric(12,2),
  max_daily_rate_change_pct numeric(5,2),
  distribution_cost_pct numeric(5,2),
  compset_config jsonb not null default '[]'::jsonb,
  room_type_config jsonb not null default '[]'::jsonb,
  demand_thresholds jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade
);

create table if not exists public.hotel_historical_import_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  file_name text not null,
  file_size_bytes bigint,
  records_count integer not null default 0,
  rejected_count integer not null default 0,
  date_start date,
  date_end date,
  import_status text not null default 'pending' check (import_status in ('pending','validated','warning','failed','completed')),
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  detected_columns jsonb not null default '[]'::jsonb,
  imported_by uuid references public.users(id) on delete set null,
  imported_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade
);

create table if not exists public.hotel_backtest_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  model_name text not null,
  model_version text not null,
  evaluated_from date not null,
  evaluated_to date not null,
  horizon_days integer,
  sample_count integer not null default 0,
  wape numeric(9,4),
  mae numeric(12,4),
  rmse numeric(12,4),
  bias_pct numeric(9,4),
  baseline_metrics jsonb not null default '{}'::jsonb,
  metrics_by_horizon jsonb not null default '{}'::jsonb,
  calibration jsonb not null default '{}'::jsonb,
  leakage_checks jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade,
  check (evaluated_to >= evaluated_from)
);

-- Forecast lineage, integrations metadata and ingestion orchestration.
create table if not exists public.revenue_forecast_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  model_name text not null,
  model_version text not null,
  as_of timestamptz not null,
  horizon_start date not null,
  horizon_end date not null,
  input_freshness jsonb not null default '{}'::jsonb,
  parameters jsonb not null default '{}'::jsonb,
  run_status text not null default 'completed' check (run_status in ('queued','running','completed','failed')),
  error_message text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade,
  check (horizon_end >= horizon_start)
);

create table if not exists public.daily_demand_forecasts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  forecast_run_id uuid not null references public.revenue_forecast_runs(id) on delete cascade,
  stay_date date not null,
  room_type_id uuid references public.hotel_room_types(id) on delete set null,
  occupancy_p10 numeric(5,2),
  occupancy_p50 numeric(5,2),
  occupancy_p90 numeric(5,2),
  adr_p50 numeric(12,2),
  revpar_p50 numeric(12,2),
  demand_index integer check (demand_index is null or demand_index between 0 and 100),
  confidence_score integer check (confidence_score is null or confidence_score between 0 and 100),
  drivers jsonb not null default '[]'::jsonb,
  source_status text not null default 'derived' check (source_status in ('derived','imported','fixture','simulation')),
  created_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade,
  unique(forecast_run_id,stay_date,room_type_id),
  check (occupancy_p10 is null or occupancy_p50 is null or occupancy_p10 <= occupancy_p50),
  check (occupancy_p50 is null or occupancy_p90 is null or occupancy_p50 <= occupancy_p90)
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  provider text not null check (provider in ('d_edge','lighthouse','pms','channel_manager','other')),
  connection_name text not null,
  connection_status text not null default 'not_configured' check (connection_status in ('not_configured','configured','connected','degraded','error','disabled')),
  credential_secret_ref text,
  external_account_ref text,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade,
  unique(hotel_id,provider,connection_name)
);

create table if not exists public.data_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null,
  integration_id uuid references public.integration_connections(id) on delete set null,
  source_system text not null,
  job_type text not null,
  status text not null default 'queued' check (status in ('queued','running','completed','partial','failed','cancelled')),
  idempotency_key text,
  started_at timestamptz,
  finished_at timestamptz,
  records_read integer not null default 0,
  records_written integer not null default 0,
  records_rejected integer not null default 0,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (hotel_id,organization_id) references public.hotels(id,organization_id) on delete cascade,
  unique(organization_id,idempotency_key)
);

-- Indexes for tenant filtering, time-series access and deduplication.
create index if not exists idx_hotel_memberships_user on public.hotel_memberships(user_id,hotel_id);
create index if not exists idx_events_city on public.events(country_code,city);
create index if not exists idx_occurrences_dates on public.event_occurrences(start_date,end_date);
create index if not exists idx_evidence_event_verified on public.event_evidence(event_id,verified_at desc);
create index if not exists idx_impacts_hotel_score on public.event_hotel_impacts(hotel_id,final_rm_score desc);
create index if not exists idx_suggestions_hotel_status on public.event_suggestions(hotel_id,review_status,created_at desc);
create index if not exists idx_competitors_hotel on public.competitor_hotels(hotel_id,is_active);
create index if not exists idx_lighthouse_rates_hotel_date on public.lighthouse_rate_observations(hotel_id,stay_date,observed_at desc);
create index if not exists idx_inventory_hotel_date_snapshot on public.hotel_inventory_snapshots(hotel_id,stay_date,snapshot_at desc);
create index if not exists idx_reservation_snapshots_hotel_date on public.hotel_reservation_snapshots(hotel_id,stay_date,snapshot_at desc);
create index if not exists idx_daily_rates_hotel_date on public.daily_rate_intelligence(hotel_id,stay_date);
create index if not exists idx_audit_hotel_date on public.rm_decision_audit_logs(hotel_id,stay_date,created_at desc);
create index if not exists idx_hist_daily_hotel_date on public.hotel_historical_daily(hotel_id,stay_date);
create index if not exists idx_hist_snapshots_hotel_dates on public.hotel_historical_demand_snapshots(hotel_id,observation_date,arrival_date);
create index if not exists idx_import_logs_hotel_time on public.hotel_historical_import_logs(hotel_id,imported_at desc);
create index if not exists idx_backtest_hotel_period on public.hotel_backtest_evaluations(hotel_id,evaluated_from,evaluated_to);
create index if not exists idx_forecast_runs_hotel_asof on public.revenue_forecast_runs(hotel_id,as_of desc);
create index if not exists idx_forecasts_hotel_date on public.daily_demand_forecasts(hotel_id,stay_date);
create index if not exists idx_ingestion_hotel_created on public.data_ingestion_jobs(hotel_id,created_at desc);

-- Enable RLS on every newly exposed table.
do $$
declare t text;
begin
  foreach t in array array[
    'hotel_memberships','cities','venues','events','event_occurrences','event_sources','event_evidence',
    'event_hotel_impacts','event_suggestions','hotel_room_types','hotel_rate_plans','competitor_hotels',
    'lighthouse_extractions','lighthouse_rate_observations','hotel_inventory_snapshots','hotel_reservation_snapshots',
    'daily_rate_intelligence','hotel_historical_daily','hotel_historical_demand_snapshots',
    'hotel_parameters_profiles','hotel_historical_import_logs','hotel_backtest_evaluations','revenue_forecast_runs',
    'daily_demand_forecasts','integration_connections','data_ingestion_jobs'
  ] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

-- Replace only policies owned by this migration; do not change existing auth policies.
do $$
declare t text;
begin
  foreach t in array array[
    'hotel_memberships','cities','venues','events','event_occurrences','event_sources','event_evidence',
    'event_hotel_impacts','event_suggestions','hotel_room_types','hotel_rate_plans','competitor_hotels',
    'lighthouse_extractions','lighthouse_rate_observations','hotel_inventory_snapshots','hotel_reservation_snapshots',
    'daily_rate_intelligence','rm_decision_audit_logs','hotel_historical_daily','hotel_historical_demand_snapshots',
    'hotel_parameters_profiles','hotel_historical_import_logs','hotel_backtest_evaluations','revenue_forecast_runs',
    'daily_demand_forecasts','integration_connections','data_ingestion_jobs'
  ] loop
    execute format('drop policy if exists flowtym_tenant_select on public.%I',t);
    execute format('drop policy if exists flowtym_tenant_insert on public.%I',t);
    execute format('drop policy if exists flowtym_tenant_update on public.%I',t);
    execute format('drop policy if exists flowtym_tenant_delete on public.%I',t);
  end loop;
end $$;

-- Hotel membership rows: users can see their own assignments; org admins can administer their org.
create policy flowtym_tenant_select on public.hotel_memberships for select to authenticated
using (user_id = (select auth.uid()) or exists (
  select 1 from public.users u where u.id=(select auth.uid())
  and (u.role='super_admin' or (u.role='admin' and u.organization_id=hotel_memberships.organization_id))
));
create policy flowtym_tenant_insert on public.hotel_memberships for insert to authenticated
with check (exists (select 1 from public.users u where u.id=(select auth.uid())
  and (u.role='super_admin' or (u.role='admin' and u.organization_id=hotel_memberships.organization_id))));
create policy flowtym_tenant_update on public.hotel_memberships for update to authenticated
using (exists (select 1 from public.users u where u.id=(select auth.uid())
  and (u.role='super_admin' or (u.role='admin' and u.organization_id=hotel_memberships.organization_id))))
with check (exists (select 1 from public.users u where u.id=(select auth.uid())
  and (u.role='super_admin' or (u.role='admin' and u.organization_id=hotel_memberships.organization_id))));
create policy flowtym_tenant_delete on public.hotel_memberships for delete to authenticated
using (exists (select 1 from public.users u where u.id=(select auth.uid())
  and (u.role='super_admin' or (u.role='admin' and u.organization_id=hotel_memberships.organization_id))));

-- Shared reference catalogs are readable by signed-in users. Only super-admin can curate the canonical registry.
do $$
declare t text;
begin
  foreach t in array array['cities','venues','events','event_occurrences','event_sources','event_evidence'] loop
    execute format('create policy flowtym_tenant_select on public.%I for select to authenticated using ((select auth.uid()) is not null)',t);
    execute format('create policy flowtym_tenant_insert on public.%I for insert to authenticated with check (exists (select 1 from public.users u where u.id=(select auth.uid()) and u.role=''super_admin''))',t);
    execute format('create policy flowtym_tenant_update on public.%I for update to authenticated using (exists (select 1 from public.users u where u.id=(select auth.uid()) and u.role=''super_admin'')) with check (exists (select 1 from public.users u where u.id=(select auth.uid()) and u.role=''super_admin''))',t);
    execute format('create policy flowtym_tenant_delete on public.%I for delete to authenticated using (exists (select 1 from public.users u where u.id=(select auth.uid()) and u.role=''super_admin''))',t);
  end loop;
end $$;

-- Tenant-owned tables: admin/revenue managers have org scope; GM/analyst/viewer need hotel membership.
do $$
declare t text;
begin
  foreach t in array array[
    'event_hotel_impacts','event_suggestions','hotel_room_types','hotel_rate_plans','competitor_hotels',
    'lighthouse_extractions','lighthouse_rate_observations','hotel_inventory_snapshots','hotel_reservation_snapshots',
    'daily_rate_intelligence','hotel_historical_daily','hotel_historical_demand_snapshots','hotel_parameters_profiles',
    'hotel_historical_import_logs','hotel_backtest_evaluations','revenue_forecast_runs','daily_demand_forecasts',
    'integration_connections','data_ingestion_jobs'
  ] loop
    execute format('create policy flowtym_tenant_select on public.%I for select to authenticated using (flowtym_private.can_access_hotel(hotel_id,organization_id))',t);
    execute format('create policy flowtym_tenant_insert on public.%I for insert to authenticated with check (flowtym_private.can_access_hotel(hotel_id,organization_id))',t);
    execute format('create policy flowtym_tenant_update on public.%I for update to authenticated using (flowtym_private.can_access_hotel(hotel_id,organization_id)) with check (flowtym_private.can_access_hotel(hotel_id,organization_id))',t);
    execute format('create policy flowtym_tenant_delete on public.%I for delete to authenticated using (flowtym_private.can_access_hotel(hotel_id,organization_id))',t);
  end loop;
end $$;

-- Audit trail is append-only for clients: no UPDATE or DELETE policies.
create policy flowtym_tenant_select on public.rm_decision_audit_logs for select to authenticated
using (flowtym_private.can_access_hotel(hotel_id,organization_id));
create policy flowtym_tenant_insert on public.rm_decision_audit_logs for insert to authenticated
with check (flowtym_private.can_access_hotel(hotel_id,organization_id));

-- Updated-at triggers.
do $$
declare t text;
begin
  foreach t in array array[
    'venues','events','event_hotel_impacts','hotel_room_types','competitor_hotels','daily_rate_intelligence',
    'hotel_historical_daily','hotel_parameters_profiles','integration_connections'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I',t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function flowtym_private.set_updated_at()',t);
  end loop;
end $$;

-- Explicit Data API grants. RLS remains the authorization boundary.
grant select, insert, update, delete on
  public.hotel_memberships, public.cities, public.venues, public.events, public.event_occurrences,
  public.event_sources, public.event_evidence, public.event_hotel_impacts, public.event_suggestions,
  public.hotel_room_types, public.hotel_rate_plans, public.competitor_hotels, public.lighthouse_extractions,
  public.lighthouse_rate_observations, public.hotel_inventory_snapshots, public.hotel_reservation_snapshots,
  public.daily_rate_intelligence, public.hotel_historical_daily, public.hotel_historical_demand_snapshots,
  public.hotel_parameters_profiles, public.hotel_historical_import_logs, public.hotel_backtest_evaluations,
  public.revenue_forecast_runs, public.daily_demand_forecasts, public.integration_connections, public.data_ingestion_jobs
to authenticated;
grant select, insert on public.rm_decision_audit_logs to authenticated;
revoke update, delete on public.rm_decision_audit_logs from authenticated;

-- Attach the existing Revenue Manager test account to the existing HOPTYM hotel.
insert into public.hotel_memberships(organization_id,hotel_id,user_id,membership_role)
select h.organization_id,h.id,u.id,'revenue_manager'
from public.users u
join public.hotels h on h.organization_id=u.organization_id
where lower(u.email)='direction.commerciale.bh@gmail.com'
  and u.role='revenue_manager'
on conflict (hotel_id,user_id) do nothing;

commit;
