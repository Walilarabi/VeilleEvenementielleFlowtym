-- Audited experiment lifecycle; raw observations are immutable after ingestion.
begin;
alter table public.hotel_price_experiments add column if not exists randomization_evidence jsonb;
alter table public.hotel_price_experiments add column if not exists randomization_verified_by uuid references public.users(id) on delete set null;
alter table public.hotel_price_experiments add column if not exists randomization_verified_at timestamptz;
alter table public.hotel_price_experiments add column if not exists completed_by uuid references public.users(id) on delete set null;
alter table public.hotel_price_experiments add column if not exists completed_at timestamptz;

create table if not exists public.hotel_price_experiment_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hotel_id uuid not null,
  experiment_id uuid not null,
  actor_user_id uuid not null references public.users(id) on delete restrict,
  action text not null check(action in ('verify_randomization','complete')),
  reason_code text not null,
  reason_text text,
  before_state jsonb not null,
  after_state jsonb not null,
  created_at timestamptz not null default now(),
  foreign key(experiment_id,hotel_id,organization_id) references public.hotel_price_experiments(id,hotel_id,organization_id) on delete restrict
);
create index if not exists idx_price_experiment_audit_hotel_created on public.hotel_price_experiment_audit_logs(hotel_id,created_at desc);
create index if not exists idx_price_experiment_audit_org_fk on public.hotel_price_experiment_audit_logs(organization_id);
create index if not exists idx_price_experiment_audit_experiment_fk on public.hotel_price_experiment_audit_logs(experiment_id,hotel_id,organization_id);
create index if not exists idx_price_experiment_audit_actor_fk on public.hotel_price_experiment_audit_logs(actor_user_id);
alter table public.hotel_price_experiment_audit_logs enable row level security;
create policy price_experiment_audit_select on public.hotel_price_experiment_audit_logs for select to authenticated
using(flowtym_private.can_access_hotel(hotel_id,organization_id));
grant select on public.hotel_price_experiment_audit_logs to authenticated;

drop policy if exists price_experiments_update on public.hotel_price_experiments;
revoke update,delete on public.hotel_price_experiments from authenticated;
grant select,insert on public.hotel_price_experiments to authenticated;

drop policy if exists price_experiment_observations_update on public.hotel_price_experiment_observations;
revoke update,delete on public.hotel_price_experiment_observations from authenticated;
drop policy if exists price_experiment_observations_insert on public.hotel_price_experiment_observations;
create policy price_experiment_observations_insert on public.hotel_price_experiment_observations for insert to authenticated
with check (
  flowtym_private.can_manage_hotel(hotel_id,organization_id) and
  exists(select 1 from public.hotel_price_experiments e where e.id=experiment_id and e.hotel_id=hotel_id
    and e.organization_id=organization_id and e.experiment_status in ('draft','running'))
);
grant select,insert on public.hotel_price_experiment_observations to authenticated;

drop policy if exists demand_censoring_update on public.hotel_demand_censoring_observations;
revoke update,delete on public.hotel_demand_censoring_observations from authenticated;
grant select,insert on public.hotel_demand_censoring_observations to authenticated;

create or replace function flowtym_private.review_price_experiment_internal(
  p_hotel_id uuid,p_experiment_id uuid,p_action text,p_reason_code text,p_reason_text text default null,p_evidence jsonb default null
)
returns table(id uuid,experiment_status text,randomization_verified boolean)
language plpgsql
security definer
set search_path=pg_catalog,public,flowtym_private
as $$
declare
  v public.hotel_price_experiments%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_pairs integer;
begin
  if p_action not in ('verify_randomization','complete') then raise exception 'Invalid experiment review action' using errcode='22023'; end if;
  if p_reason_code is null or length(trim(p_reason_code))=0 or length(p_reason_code)>64 then raise exception 'Reason code required' using errcode='22023'; end if;
  select e.* into v from public.hotel_price_experiments e where e.id=p_experiment_id and e.hotel_id=p_hotel_id for update;
  if not found then raise exception 'Experiment not found' using errcode='P0002'; end if;
  if not flowtym_private.can_manage_hotel(p_hotel_id,v.organization_id) then raise exception 'Hotel access denied' using errcode='42501'; end if;
  if p_action='verify_randomization' then
    if v.experiment_status not in ('draft','running') or v.randomization_method is null or p_evidence is null or p_evidence='{}'::jsonb then
      raise exception 'Randomization method and evidence are required before verification' using errcode='22023';
    end if;
    if v.randomization_verified then raise exception 'Randomization is already verified' using errcode='55000'; end if;
    v_before=to_jsonb(v);
    update public.hotel_price_experiments e set randomization_verified=true,randomization_verified_by=auth.uid(),
      randomization_verified_at=now(),randomization_evidence=p_evidence,updated_at=now()
      where e.id=p_experiment_id returning e.* into v;
  else
    if not v.randomization_verified or v.experiment_status not in ('draft','running') then
      raise exception 'Only a randomization-verified draft/running experiment can be completed' using errcode='55000';
    end if;
    select count(*) into v_pairs from (
      select o.stay_date,o.room_type_id,o.rate_plan_id,o.channel,o.currency
      from public.hotel_price_experiment_observations o
      where o.experiment_id=p_experiment_id and o.hotel_id=p_hotel_id and o.source_status in ('live','imported')
      group by o.stay_date,o.room_type_id,o.rate_plan_id,o.channel,o.currency
      having count(*) filter(where o.group_type='control')>0 and count(*) filter(where o.group_type='treatment')>0
    ) matched;
    if v_pairs<1 then raise exception 'At least one matched control/treatment observation pair is required' using errcode='22023'; end if;
    v_before=to_jsonb(v);
    update public.hotel_price_experiments e set experiment_status='completed',completed_by=auth.uid(),completed_at=now(),updated_at=now()
      where e.id=p_experiment_id returning e.* into v;
  end if;
  v_after=to_jsonb(v);
  insert into public.hotel_price_experiment_audit_logs(
    organization_id,hotel_id,experiment_id,actor_user_id,action,reason_code,reason_text,before_state,after_state
  ) values(v.organization_id,p_hotel_id,p_experiment_id,auth.uid(),p_action,p_reason_code,p_reason_text,v_before,v_after);
  return query select v.id,v.experiment_status,v.randomization_verified;
end;
$$;
revoke all on function flowtym_private.review_price_experiment_internal(uuid,uuid,text,text,text,jsonb) from public,anon;
grant usage on schema flowtym_private to authenticated;
grant execute on function flowtym_private.review_price_experiment_internal(uuid,uuid,text,text,text,jsonb) to authenticated;

create or replace function public.review_price_experiment(
  p_hotel_id uuid,p_experiment_id uuid,p_action text,p_reason_code text,p_reason_text text default null,p_evidence jsonb default null
)
returns table(id uuid,experiment_status text,randomization_verified boolean)
language sql
security invoker
set search_path=pg_catalog,public,flowtym_private
as $$
  select * from flowtym_private.review_price_experiment_internal(p_hotel_id,p_experiment_id,p_action,p_reason_code,p_reason_text,p_evidence);
$$;
revoke all on function public.review_price_experiment(uuid,uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.review_price_experiment(uuid,uuid,text,text,text,jsonb) to authenticated;
commit;
