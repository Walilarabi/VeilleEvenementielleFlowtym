-- Restrict event-impact lifecycle changes to a hardened audit RPC.
begin;
alter table public.event_hotel_impacts add column if not exists reviewed_by uuid references public.users(id) on delete set null;
alter table public.event_hotel_impacts add column if not exists reviewed_at timestamptz;

drop policy if exists flowtym_tenant_insert on public.event_hotel_impacts;
create policy flowtym_tenant_insert on public.event_hotel_impacts
for insert to authenticated with check (
  flowtym_private.can_manage_hotel(hotel_id,organization_id) and impact_status='to_review'
);

drop policy if exists flowtym_tenant_update on public.event_hotel_impacts;
create policy flowtym_tenant_update on public.event_hotel_impacts
for update to authenticated
using (flowtym_private.can_manage_hotel(hotel_id,organization_id) and impact_status='to_review')
with check (flowtym_private.can_manage_hotel(hotel_id,organization_id) and impact_status='to_review');

drop policy if exists flowtym_tenant_delete on public.event_hotel_impacts;
revoke delete on public.event_hotel_impacts from authenticated;

drop policy if exists event_impact_audit_insert_manager on public.event_impact_decision_audit_logs;
revoke insert,update,delete on public.event_impact_decision_audit_logs from authenticated;
grant select on public.event_impact_decision_audit_logs to authenticated;

create or replace function public.record_event_impact_decision(
  p_hotel_id uuid,
  p_impact_id uuid,
  p_action text,
  p_reason_code text,
  p_reason_text text default null
)
returns table(id uuid,impact_status text)
language plpgsql
security definer
set search_path = pg_catalog, public, flowtym_private
as $$
declare
  v_impact public.event_hotel_impacts%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if p_action not in ('validate','dismiss') then
    raise exception 'Action must be validate or dismiss' using errcode='22023';
  end if;
  if p_reason_code is null or length(trim(p_reason_code))=0 or length(p_reason_code)>64 then
    raise exception 'A reason code of 1–64 characters is required' using errcode='22023';
  end if;
  select * into v_impact from public.event_hotel_impacts
    where id=p_impact_id and hotel_id=p_hotel_id for update;
  if not found then raise exception 'Event impact not found' using errcode='P0002'; end if;
  if not flowtym_private.can_manage_hotel(p_hotel_id,v_impact.organization_id) then
    raise exception 'Hotel access denied' using errcode='42501';
  end if;
  if v_impact.impact_status <> 'to_review' then
    raise exception 'Only impacts awaiting review can be validated or dismissed' using errcode='55000';
  end if;
  v_before=to_jsonb(v_impact);
  update public.event_hotel_impacts
    set impact_status=case when p_action='validate' then 'validated' else 'dismissed' end,
        reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
    where id=p_impact_id
    returning * into v_impact;
  v_after=to_jsonb(v_impact);
  insert into public.event_impact_decision_audit_logs(
    organization_id,hotel_id,impact_id,actor_user_id,action,reason_code,reason_text,before_state,after_state
  ) values (
    v_impact.organization_id,p_hotel_id,p_impact_id,auth.uid(),p_action,p_reason_code,p_reason_text,v_before,v_after
  );
  return query select v_impact.id,v_impact.impact_status;
end;
$$;

revoke all on function public.record_event_impact_decision(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.record_event_impact_decision(uuid,uuid,text,text,text) to authenticated;
commit;
