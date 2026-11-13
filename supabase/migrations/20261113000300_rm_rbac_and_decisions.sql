-- RBAC hardening and atomic human RM decision workflow.
begin;

create or replace function flowtym_private.can_manage_hotel(p_hotel_id uuid, p_organization_id uuid)
returns boolean
language sql stable security invoker
set search_path = pg_catalog, public, flowtym_private
as $$
  select exists (
    select 1 from public.users u
    where u.id=(select auth.uid())
      and (
        u.role='super_admin'
        or (u.organization_id=p_organization_id and u.role in ('admin','revenue_manager'))
      )
  );
$$;
grant execute on function flowtym_private.can_manage_hotel(uuid,uuid) to authenticated;

-- Keep read access for assigned users, but restrict mutations to admin/revenue manager.
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
    execute format('drop policy if exists flowtym_tenant_insert on public.%I',t);
    execute format('drop policy if exists flowtym_tenant_update on public.%I',t);
    execute format('drop policy if exists flowtym_tenant_delete on public.%I',t);
    execute format('create policy flowtym_tenant_insert on public.%I for insert to authenticated with check (flowtym_private.can_manage_hotel(hotel_id,organization_id))',t);
    execute format('create policy flowtym_tenant_update on public.%I for update to authenticated using (flowtym_private.can_manage_hotel(hotel_id,organization_id)) with check (flowtym_private.can_manage_hotel(hotel_id,organization_id))',t);
    execute format('create policy flowtym_tenant_delete on public.%I for delete to authenticated using (flowtym_private.can_manage_hotel(hotel_id,organization_id))',t);
  end loop;
end $$;

drop policy if exists flowtym_tenant_insert on public.rm_decision_audit_logs;
create policy flowtym_tenant_insert on public.rm_decision_audit_logs for insert to authenticated
with check (flowtym_private.can_manage_hotel(hotel_id,organization_id));

create or replace function public.record_rm_decision(
  p_hotel_id uuid,
  p_rate_intelligence_id uuid,
  p_action text,
  p_applied_rate numeric default null,
  p_applied_min_stay integer default null,
  p_reason_code text default null,
  p_reason_text text default null
)
returns public.daily_rate_intelligence
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_rate public.daily_rate_intelligence;
  v_final_rate numeric(12,2);
  v_final_min_stay integer;
  v_status text;
begin
  if p_action not in ('accept','modify','reject') then
    raise exception 'Unsupported decision action' using errcode='22023';
  end if;

  select * into v_rate
  from public.daily_rate_intelligence
  where id=p_rate_intelligence_id and hotel_id=p_hotel_id
  for update;

  if not found then
    raise exception 'Recommendation not found for this hotel' using errcode='P0002';
  end if;

  if v_rate.recommendation_status <> 'pending' then
    raise exception 'Recommendation is no longer pending' using errcode='55000';
  end if;

  if p_action='accept' then
    v_final_rate := v_rate.suggested_bar;
    v_final_min_stay := coalesce(p_applied_min_stay, v_rate.approved_min_stay);
    v_status := 'accepted';
  elsif p_action='modify' then
    if p_applied_rate is null or p_applied_rate <= 0 then
      raise exception 'A positive applied rate is required for a modified decision' using errcode='22023';
    end if;
    v_final_rate := p_applied_rate;
    v_final_min_stay := p_applied_min_stay;
    v_status := 'modified';
  else
    v_final_rate := null;
    v_final_min_stay := null;
    v_status := 'rejected';
  end if;

  if v_final_min_stay is not null and v_final_min_stay < 1 then
    raise exception 'Minimum stay must be at least one night' using errcode='22023';
  end if;

  update public.daily_rate_intelligence
  set recommendation_status=v_status,
      approved_rate=v_final_rate,
      approved_min_stay=v_final_min_stay,
      decision_by=(select auth.uid()),
      decision_at=now(),
      updated_at=now()
  where id=v_rate.id
  returning * into v_rate;

  insert into public.rm_decision_audit_logs(
    organization_id,hotel_id,rate_intelligence_id,stay_date,action_type,
    previous_rate,suggested_rate,final_rate,reason_code,reason_text,
    actor_user_id,source_snapshot
  ) values (
    v_rate.organization_id,v_rate.hotel_id,v_rate.id,v_rate.stay_date,p_action,
    v_rate.current_bar,v_rate.suggested_bar,v_final_rate,p_reason_code,p_reason_text,
    (select auth.uid()),v_rate.input_snapshot
  );

  return v_rate;
end;
$$;

revoke all on function public.record_rm_decision(uuid,uuid,text,numeric,integer,text,text) from public, anon;
grant execute on function public.record_rm_decision(uuid,uuid,text,numeric,integer,text,text) to authenticated;

commit;
