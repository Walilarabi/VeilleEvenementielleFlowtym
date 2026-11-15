create unique index if not exists lighthouse_extractions_id_hotel_org_unique
  on public.lighthouse_extractions (id, hotel_id, organization_id);

create table if not exists public.lighthouse_market_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  hotel_id uuid not null,
  extraction_id uuid not null,
  ingestion_job_id uuid,
  stay_date date not null,
  observed_at timestamptz not null,
  source_system text not null default 'lighthouse',
  source_channel text not null,
  los_nights smallint,
  guests_count smallint,
  currency char(3) not null default 'EUR',
  hotel_lowest_rate numeric(12,2),
  hotel_availability_status text,
  market_median_rate numeric(12,2),
  demand_index numeric(6,2),
  demand_index_raw numeric(12,6),
  demand_index_scale text not null default 'missing',
  market_rank smallint,
  market_rank_total smallint,
  compset_average numeric(12,2),
  compset_min numeric(12,2),
  compset_max numeric(12,2),
  total_available_hotels integer,
  total_sold_out_hotels integer,
  source_hash text,
  file_name text,
  source_status text not null default 'imported',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lighthouse_market_observations_rates_nonnegative
    check (
      (hotel_lowest_rate is null or hotel_lowest_rate >= 0)
      and (market_median_rate is null or market_median_rate >= 0)
      and (compset_average is null or compset_average >= 0)
      and (compset_min is null or compset_min >= 0)
      and (compset_max is null or compset_max >= 0)
    ),
  constraint lighthouse_market_observations_demand_range
    check (demand_index is null or (demand_index >= 0 and demand_index <= 100)),
  constraint lighthouse_market_observations_demand_scale_check
    check (demand_index_scale in ('0_1','0_100','missing')),
  constraint lighthouse_market_observations_hotel_status_check
    check (hotel_availability_status is null or hotel_availability_status in ('disponible','epuise','los2','1pax','non_disponible')),
  constraint lighthouse_market_observations_source_status_check
    check (source_status in ('imported','live','stale','rejected')),
  constraint lighthouse_market_observations_hotel_org_fk
    foreign key (hotel_id, organization_id)
    references public.hotels(id, organization_id) on delete cascade,
  constraint lighthouse_market_observations_organization_fk
    foreign key (organization_id)
    references public.organizations(id) on delete cascade,
  constraint lighthouse_market_observations_extraction_fk
    foreign key (extraction_id, hotel_id, organization_id)
    references public.lighthouse_extractions(id, hotel_id, organization_id) on delete cascade,
  constraint lighthouse_market_observations_ingestion_job_fk
    foreign key (ingestion_job_id, hotel_id, organization_id)
    references public.data_ingestion_jobs(id, hotel_id, organization_id)
    on delete set null (ingestion_job_id)
);

create unique index if not exists lighthouse_market_observations_extraction_date_uidx
  on public.lighthouse_market_observations (extraction_id, stay_date);

create index if not exists lighthouse_market_observations_latest_by_stay_idx
  on public.lighthouse_market_observations (hotel_id, stay_date, observed_at desc, created_at desc);

create index if not exists lighthouse_market_observations_ingestion_job_idx
  on public.lighthouse_market_observations (ingestion_job_id)
  where ingestion_job_id is not null;

alter table public.lighthouse_market_observations enable row level security;

drop policy if exists lighthouse_market_observations_select on public.lighthouse_market_observations;
create policy lighthouse_market_observations_select
  on public.lighthouse_market_observations for select to authenticated
  using (flowtym_private.can_access_hotel(hotel_id, organization_id));

drop policy if exists lighthouse_market_observations_insert on public.lighthouse_market_observations;
create policy lighthouse_market_observations_insert
  on public.lighthouse_market_observations for insert to authenticated
  with check (flowtym_private.can_manage_hotel(hotel_id, organization_id));

drop policy if exists lighthouse_market_observations_update on public.lighthouse_market_observations;
create policy lighthouse_market_observations_update
  on public.lighthouse_market_observations for update to authenticated
  using (flowtym_private.can_manage_hotel(hotel_id, organization_id))
  with check (flowtym_private.can_manage_hotel(hotel_id, organization_id));

drop policy if exists lighthouse_market_observations_delete on public.lighthouse_market_observations;
create policy lighthouse_market_observations_delete
  on public.lighthouse_market_observations for delete to authenticated
  using (flowtym_private.can_manage_hotel(hotel_id, organization_id));

grant select, insert, update, delete on public.lighthouse_market_observations to authenticated, service_role;
