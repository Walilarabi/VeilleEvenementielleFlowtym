-- DRAFT ONLY — do not execute directly in production.
-- Create a real, queryable nightly price observation model for PMS/Topsys imports.
-- The global hotel_rate_plans table remains unique by (hotel_id, code); room_type_id
-- is intentionally NULL for shared rate-plan definitions. Room type specificity lives here.

alter table public.hotel_inventory_snapshots
  add column if not exists ingestion_job_id uuid
  references public.data_ingestion_jobs(id) on delete set null;

create unique index if not exists hotel_inventory_snapshot_idempotency_uidx
  on public.hotel_inventory_snapshots
    (hotel_id, room_type_id, stay_date, snapshot_at, source_system)
  where room_type_id is not null;

create table if not exists public.hotel_rate_plan_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  hotel_id uuid not null,
  room_type_id uuid not null,
  rate_plan_id uuid not null,
  ingestion_job_id uuid references public.data_ingestion_jobs(id) on delete set null,
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
  constraint hotel_rate_plan_observations_room_type_fk
    foreign key (room_type_id, hotel_id, organization_id)
    references public.hotel_room_types(id, hotel_id, organization_id) on delete cascade,
  constraint hotel_rate_plan_observations_rate_plan_fk
    foreign key (rate_plan_id, hotel_id, organization_id)
    references public.hotel_rate_plans(id, hotel_id, organization_id) on delete cascade
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

create policy hotel_rate_plan_observations_select
  on public.hotel_rate_plan_observations for select to authenticated
  using (flowtym_private.can_access_hotel(hotel_id));

create policy hotel_rate_plan_observations_insert
  on public.hotel_rate_plan_observations for insert to authenticated
  with check (flowtym_private.can_manage_hotel(hotel_id));

create policy hotel_rate_plan_observations_update
  on public.hotel_rate_plan_observations for update to authenticated
  using (flowtym_private.can_manage_hotel(hotel_id))
  with check (flowtym_private.can_manage_hotel(hotel_id));

create policy hotel_rate_plan_observations_delete
  on public.hotel_rate_plan_observations for delete to authenticated
  using (flowtym_private.can_manage_hotel(hotel_id));
