-- Experimental price-response and censored-demand evidence tables.
begin;

create table if not exists public.hotel_price_experiments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hotel_id uuid not null,
  experiment_code text not null,
  experiment_name text not null,
  assignment_unit text not null check (assignment_unit in ('stay_date','room_type','rate_plan','channel','stay_date_room_type_rate_plan_channel')),
  experiment_status text not null default 'draft' check (experiment_status in ('draft','running','completed','aborted')),
  start_date date not null,
  end_date date not null,
  hypothesis text,
  design jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(hotel_id,experiment_code),
  unique(id,hotel_id,organization_id),
  foreign key(hotel_id,organization_id) references public.hotels(id,organization_id) on delete restrict,
  check(end_date>=start_date)
);

create table if not exists public.hotel_price_experiment_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hotel_id uuid not null,
  experiment_id uuid not null,
  group_type text not null check (group_type in ('control','treatment')),
  stay_date date not null,
  room_type_id uuid,
  rate_plan_id uuid,
  channel text not null,
  currency char(3) not null,
  assigned_price numeric(12,2) not null check (assigned_price>0),
  exposure_count integer not null check (exposure_count>0),
  rooms_sold integer not null check (rooms_sold>=0),
  cancelled_rooms integer not null default 0 check (cancelled_rooms>=0),
  revenue_net numeric(14,2),
  source_status text not null check (source_status in ('live','imported','fixture','simulation')),
  source_name text not null,
  observed_at timestamptz not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key(experiment_id,hotel_id,organization_id) references public.hotel_price_experiments(id,hotel_id,organization_id) on delete restrict,
  foreign key(hotel_id,organization_id) references public.hotels(id,organization_id) on delete restrict,
  foreign key(room_type_id,hotel_id,organization_id) references public.hotel_room_types(id,hotel_id,organization_id) on delete restrict,
  foreign key(rate_plan_id,hotel_id,organization_id) references public.hotel_rate_plans(id,hotel_id,organization_id) on delete restrict
);

create table if not exists public.hotel_demand_censoring_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hotel_id uuid not null,
  stay_date date not null,
  room_type_id uuid,
  rate_plan_id uuid,
  channel text,
  currency char(3),
  censoring_status text not null check (censoring_status in ('sold_out','capacity_constrained','unknown')),
  observed_at timestamptz not null,
  last_available_at timestamptz,
  sold_out_at timestamptz,
  search_demand_count integer check (search_demand_count is null or search_demand_count>=0),
  booking_attempt_count integer check (booking_attempt_count is null or booking_attempt_count>=0),
  rejected_attempt_count integer check (rejected_attempt_count is null or rejected_attempt_count>=0),
  estimated_lost_rooms numeric(10,2) check (estimated_lost_rooms is null or estimated_lost_rooms>=0),
  source_status text not null check (source_status in ('live','imported','fixture','simulation')),
  source_name text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key(hotel_id,organization_id) references public.hotels(id,organization_id) on delete restrict,
  foreign key(room_type_id,hotel_id,organization_id) references public.hotel_room_types(id,hotel_id,organization_id) on delete restrict,
  foreign key(rate_plan_id,hotel_id,organization_id) references public.hotel_rate_plans(id,hotel_id,organization_id) on delete restrict
);

create index if not exists idx_price_experiments_hotel_dates on public.hotel_price_experiments(hotel_id,start_date,end_date);
create index if not exists idx_price_experiment_observations_experiment on public.hotel_price_experiment_observations(experiment_id,stay_date,group_type);
create index if not exists idx_price_experiment_observations_hotel on public.hotel_price_experiment_observations(hotel_id,stay_date);
create index if not exists idx_censoring_observations_hotel_date on public.hotel_demand_censoring_observations(hotel_id,stay_date,observed_at desc);

alter table public.hotel_price_experiments enable row level security;
alter table public.hotel_price_experiment_observations enable row level security;
alter table public.hotel_demand_censoring_observations enable row level security;

create policy price_experiments_select on public.hotel_price_experiments for select to authenticated
using (flowtym_private.can_access_hotel(hotel_id,organization_id));
create policy price_experiments_insert on public.hotel_price_experiments for insert to authenticated
with check (flowtym_private.can_manage_hotel(hotel_id,organization_id) and created_by=(select auth.uid()));
create policy price_experiments_update on public.hotel_price_experiments for update to authenticated
using (flowtym_private.can_manage_hotel(hotel_id,organization_id))
with check (flowtym_private.can_manage_hotel(hotel_id,organization_id));

create policy price_experiment_observations_select on public.hotel_price_experiment_observations for select to authenticated
using (flowtym_private.can_access_hotel(hotel_id,organization_id));
create policy price_experiment_observations_insert on public.hotel_price_experiment_observations for insert to authenticated
with check (flowtym_private.can_manage_hotel(hotel_id,organization_id));
create policy price_experiment_observations_update on public.hotel_price_experiment_observations for update to authenticated
using (flowtym_private.can_manage_hotel(hotel_id,organization_id))
with check (flowtym_private.can_manage_hotel(hotel_id,organization_id));

create policy demand_censoring_select on public.hotel_demand_censoring_observations for select to authenticated
using (flowtym_private.can_access_hotel(hotel_id,organization_id));
create policy demand_censoring_insert on public.hotel_demand_censoring_observations for insert to authenticated
with check (flowtym_private.can_manage_hotel(hotel_id,organization_id));
create policy demand_censoring_update on public.hotel_demand_censoring_observations for update to authenticated
using (flowtym_private.can_manage_hotel(hotel_id,organization_id))
with check (flowtym_private.can_manage_hotel(hotel_id,organization_id));

grant select,insert,update on public.hotel_price_experiments to authenticated;
grant select,insert,update on public.hotel_price_experiment_observations to authenticated;
grant select,insert,update on public.hotel_demand_censoring_observations to authenticated;

commit;
