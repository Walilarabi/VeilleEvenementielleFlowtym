-- Auditable human approval/rejection for hotel-specific event impacts.
begin;
create table if not exists public.event_impact_decision_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  impact_id uuid not null references public.event_hotel_impacts(id) on delete restrict,
  actor_user_id uuid not null references public.users(id) on delete restrict,
  action text not null check (action in ('validate','dismiss')),
  reason_code text not null,
  reason_text text,
  before_state jsonb not null,
  after_state jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_event_impact_audit_hotel_created
  on public.event_impact_decision_audit_logs(hotel_id,created_at desc);
alter table public.event_impact_decision_audit_logs enable row level security;

drop policy if exists event_impact_audit_read_org on public.event_impact_decision_audit_logs;
create policy event_impact_audit_read_org on public.event_impact_decision_audit_logs
for select to authenticated using (
  exists(select 1 from public.users u where u.id=(select auth.uid()) and
    (u.role='super_admin' or u.organization_id=event_impact_decision_audit_logs.organization_id))
);

drop policy if exists event_impact_audit_insert_manager on public.event_impact_decision_audit_logs;
create policy event_impact_audit_insert_manager on public.event_impact_decision_audit_logs
for insert to authenticated with check (
  actor_user_id=(select auth.uid()) and flowtym_private.can_manage_hotel(hotel_id,organization_id)
);

revoke update,delete on public.event_impact_decision_audit_logs from authenticated;
grant select,insert on public.event_impact_decision_audit_logs to authenticated;

create or replace function public.record_event_impact_decision(
  p_hotel_id uuid,
  p_impact_id uuid,
  p_action text,
  p_reason_code text,
  p_reason_text text default null
)
returns table(id uuid,impact_status text)
language plpgsql
security invoker
set search_path = pg_catalog, public, flowtym_private
as $$
declare
  v_impact public.event_hotel_impacts%rowtype;
  v_after jsonb;
begin
  if p_action not in ('validate','dismiss') then
    raise exception 'Action must be validate or dismiss' using errcode='22023';
  end if;
  if not flowtym_private.can_manage_hotel(p_hotel_id,null) then
    raise exception 'Hotel access denied' using errcode='42501';
  end if;
  select * into v_impact from public.event_hotel_impacts
    where id=p_impact_id and hotel_id=p_hotel_id for update;
  if not found then raise exception 'Event impact not found' using errcode='P0002'; end if;
  if v_impact.impact_status <> 'to_review' then
    raise exception 'Only impacts awaiting review can be validated or dismissed' using errcode='55000';
  end if;
  update public.event_hotel_impacts
    set impact_status=case when p_action='validate' then 'validated' else 'dismissed' end,
        reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
    where id=p_impact_id
    returning * into v_impact;
  v_after=to_jsonb(v_impact);
  insert into public.event_impact_decision_audit_logs(
    organization_id,hotel_id,impact_id,actor_user_id,action,reason_code,reason_text,before_state,after_state
  ) values (
    v_impact.organization_id,p_hotel_id,p_impact_id,auth.uid(),p_action,p_reason_code,p_reason_text,
    to_jsonb(v_impact)-'impact_status',v_after
  );
  return query select v_impact.id,v_impact.impact_status;
end;
$$;

revoke all on function public.record_event_impact_decision(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.record_event_impact_decision(uuid,uuid,text,text,text) to authenticated;
commit;
