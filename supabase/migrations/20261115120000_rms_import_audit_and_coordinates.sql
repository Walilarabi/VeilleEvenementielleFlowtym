-- Flowtym RMS: normalized PMS rate observations, import traceability,
-- settings audit log, inventory idempotency and restricted hotel coordinate RPC.

create unique index if not exists data_ingestion_jobs_id_hotel_org_unique
  on public.data_ingestion_jobs (id, hotel_id, organization_id);

alter table public.hotel_inventory_snapshots
  add column if not exists ingestion_job_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hotel_inventory_snapshots_ingestion_job_same_hotel_fk'
      and conrelid = 'public.hotel_inventory_snapshots'::regclass
  ) then
    alter table public.hotel_inventory_snapshots
      add constraint hotel_inventory_snapshots_ingestion_job_same_hotel_fk
      foreign key (ingestion_job_id, hotel_id, organization_id)
      references public.data_ingestion_jobs(id, hotel_id, organization_id)
      on delete set null (ingestion_job_id);
  end if;
end $$;

create unique index if not exists hotel_inventory_snapshot_idempotency_uidx
  on public.hotel_inventory_snapshots
    (hotel_id, room_type_id, stay_date, snapshot_at, source_system);

create table if not exists public.hotel_rate_plan_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  hotel_id uuid not null,
  room_type_id uuid not null,
  rate_plan_id uuid not null,
  ingestion_job_id uuid,
  stay_date date not null,
  snapshot_at timestamptz not null,
  source_system text not null,
  source_status text not null default 'imported',
  rate_amount numeric(12,2),
  currency char(3) not null default 'EUR',
  availability_status text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint hotel_rate_plan_observations_amount_nonnegative
    check (rate_amount is null or rate_amount >= 0),
  constraint hotel_rate_plan_observations_availability_status_check
    check (availability_status in ('available','zero','sold_out','closed','unknown_marker','missing','invalid')),
  constraint hotel_rate_plan_observations_source_status_check
    check (source_status in ('imported','live','stale','rejected')),
  constraint hotel_rate_plan_observations_hotel_org_fk
    foreign key (hotel_id, organization_id)
    references public.hotels(id, organization_id) on delete cascade,
  constraint hotel_rate_plan_observations_organization_fk
    foreign key (organization_id)
    references public.organizations(id) on delete cascade,
  constraint hotel_rate_plan_observations_room_type_fk
    foreign key (room_type_id, hotel_id, organization_id)
    references public.hotel_room_types(id, hotel_id, organization_id) on delete cascade,
  constraint hotel_rate_plan_observations_rate_plan_fk
    foreign key (rate_plan_id, hotel_id, organization_id)
    references public.hotel_rate_plans(id, hotel_id, organization_id) on delete cascade,
  constraint hotel_rate_plan_observations_ingestion_job_same_hotel_fk
    foreign key (ingestion_job_id, hotel_id, organization_id)
    references public.data_ingestion_jobs(id, hotel_id, organization_id)
    on delete set null (ingestion_job_id)
);

create unique index if not exists hotel_rate_plan_observation_idempotency_uidx
  on public.hotel_rate_plan_observations
    (hotel_id, room_type_id, rate_plan_id, stay_date, snapshot_at, source_system);

create index if not exists hotel_rate_plan_observations_latest_by_stay_idx
  on public.hotel_rate_plan_observations
    (hotel_id, stay_date, room_type_id, rate_plan_id, snapshot_at desc);

create index if not exists hotel_rate_plan_observations_ingestion_job_idx
  on public.hotel_rate_plan_observations (ingestion_job_id)
  where ingestion_job_id is not null;

alter table public.hotel_rate_plan_observations enable row level security;

drop policy if exists hotel_rate_plan_observations_select on public.hotel_rate_plan_observations;
create policy hotel_rate_plan_observations_select
  on public.hotel_rate_plan_observations for select to authenticated
  using (flowtym_private.can_access_hotel(hotel_id, organization_id));

drop policy if exists hotel_rate_plan_observations_insert on public.hotel_rate_plan_observations;
create policy hotel_rate_plan_observations_insert
  on public.hotel_rate_plan_observations for insert to authenticated
  with check (flowtym_private.can_manage_hotel(hotel_id, organization_id));

drop policy if exists hotel_rate_plan_observations_update on public.hotel_rate_plan_observations;
create policy hotel_rate_plan_observations_update
  on public.hotel_rate_plan_observations for update to authenticated
  using (flowtym_private.can_manage_hotel(hotel_id, organization_id))
  with check (flowtym_private.can_manage_hotel(hotel_id, organization_id));

drop policy if exists hotel_rate_plan_observations_delete on public.hotel_rate_plan_observations;
create policy hotel_rate_plan_observations_delete
  on public.hotel_rate_plan_observations for delete to authenticated
  using (flowtym_private.can_manage_hotel(hotel_id, organization_id));

grant select, insert, update, delete on public.hotel_rate_plan_observations to authenticated, service_role;

create table if not exists public.hotel_settings_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  hotel_id uuid not null,
  actor_user_id uuid not null,
  action_type text not null,
  entity_type text not null,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  reason_text text,
  created_at timestamptz not null default now(),
  constraint hotel_settings_audit_logs_hotel_org_fk
    foreign key (hotel_id, organization_id)
    references public.hotels(id, organization_id) on delete cascade,
  constraint hotel_settings_audit_logs_organization_fk
    foreign key (organization_id)
    references public.organizations(id) on delete cascade,
  constraint hotel_settings_audit_logs_actor_fk
    foreign key (actor_user_id)
    references public.users(id) on delete restrict
);

create index if not exists hotel_settings_audit_logs_recent_idx
  on public.hotel_settings_audit_logs (hotel_id, created_at desc);

alter table public.hotel_settings_audit_logs enable row level security;

drop policy if exists hotel_settings_audit_logs_select on public.hotel_settings_audit_logs;
create policy hotel_settings_audit_logs_select
  on public.hotel_settings_audit_logs for select to authenticated
  using (flowtym_private.can_access_hotel(hotel_id, organization_id));

drop policy if exists hotel_settings_audit_logs_insert on public.hotel_settings_audit_logs;
create policy hotel_settings_audit_logs_insert
  on public.hotel_settings_audit_logs for insert to authenticated
  with check (
    actor_user_id = (select auth.uid())
    and flowtym_private.can_manage_hotel(hotel_id, organization_id)
  );

grant select, insert on public.hotel_settings_audit_logs to authenticated, service_role;

create or replace function public.update_hotel_coordinates(
  p_hotel_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_hotel_org uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if (p_lat is null) <> (p_lng is null) then
    raise exception 'LAT_LNG_MUST_BE_SET_TOGETHER';
  end if;
  if p_lat is not null and (p_lat < -90 or p_lat > 90) then
    raise exception 'LATITUDE_OUT_OF_RANGE';
  end if;
  if p_lng is not null and (p_lng < -180 or p_lng > 180) then
    raise exception 'LONGITUDE_OUT_OF_RANGE';
  end if;

  select h.organization_id, jsonb_build_object('lat', h.lat, 'lng', h.lng)
    into v_hotel_org, v_before
    from public.hotels h
   where h.id = p_hotel_id;

  if v_hotel_org is null then
    raise exception 'HOTEL_NOT_FOUND';
  end if;
  if not flowtym_private.can_manage_hotel(p_hotel_id, v_hotel_org) then
    raise exception 'HOTEL_SCOPE_FORBIDDEN';
  end if;

  update public.hotels
     set lat = p_lat,
         lng = p_lng,
         updated_at = now()
   where id = p_hotel_id;

  v_after := jsonb_build_object('lat', p_lat, 'lng', p_lng);

  insert into public.hotel_settings_audit_logs (
    organization_id, hotel_id, actor_user_id, action_type, entity_type,
    before_state, after_state, reason_text
  ) values (
    v_hotel_org, p_hotel_id, v_user_id, 'hotel_coordinates_updated', 'hotel',
    v_before, v_after, 'Coordonnées GPS modifiées depuis les paramètres RMS.'
  );

  return jsonb_build_object('hotel_id', p_hotel_id, 'lat', p_lat, 'lng', p_lng);
end;
$$;

revoke all on function public.update_hotel_coordinates(uuid, double precision, double precision) from public;
grant execute on function public.update_hotel_coordinates(uuid, double precision, double precision) to authenticated;
