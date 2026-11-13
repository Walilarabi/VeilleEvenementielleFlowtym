-- Calibration rules are persisted only from reviewed, evidence-backed models.
begin;
alter table public.hotel_price_experiments add column if not exists randomization_method text;
alter table public.hotel_price_experiments add column if not exists randomization_verified boolean not null default false;

create table if not exists public.hotel_calibration_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hotel_id uuid not null,
  rule_type text not null check (rule_type in ('price_elasticity','forecast_bias','event_lift')),
  rule_key text not null,
  rule_version integer not null default 1 check (rule_version>0),
  rule_value jsonb not null,
  source_method text not null check (source_method in ('controlled_experiment','walk_forward_backtest','manual_review')),
  sample_count integer not null check (sample_count>=0),
  r_squared numeric(7,5),
  confidence_level numeric(5,2),
  rule_status text not null default 'pending_review' check (rule_status in ('pending_review','active','rejected','retired')),
  valid_from date,
  valid_to date,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(hotel_id,organization_id) references public.hotels(id,organization_id) on delete restrict,
  unique(hotel_id,rule_type,rule_key,rule_version),
  check (valid_to is null or valid_from is null or valid_to>=valid_from),
  check (r_squared is null or r_squared between 0 and 1),
  check (confidence_level is null or confidence_level between 0 and 100)
);
create index if not exists idx_hotel_calibration_rules_lookup
  on public.hotel_calibration_rules(hotel_id,rule_type,rule_status,created_at desc);

alter table public.hotel_calibration_rules enable row level security;
create policy calibration_rules_select on public.hotel_calibration_rules for select to authenticated
using (flowtym_private.can_access_hotel(hotel_id,organization_id));
create policy calibration_rules_insert on public.hotel_calibration_rules for insert to authenticated
with check (flowtym_private.can_manage_hotel(hotel_id,organization_id) and created_by=(select auth.uid()));
create policy calibration_rules_update on public.hotel_calibration_rules for update to authenticated
using (flowtym_private.can_manage_hotel(hotel_id,organization_id))
with check (flowtym_private.can_manage_hotel(hotel_id,organization_id));
grant select,insert,update on public.hotel_calibration_rules to authenticated;
commit;
