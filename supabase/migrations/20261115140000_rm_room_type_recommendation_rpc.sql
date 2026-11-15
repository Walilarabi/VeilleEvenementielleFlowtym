create or replace function public.persist_rm_recommendation_v2(
  p_organization_id uuid,
  p_hotel_id uuid,
  p_room_type_id uuid,
  p_rate_plan_id uuid,
  p_stay_date date,
  p_currency text,
  p_current_bar numeric,
  p_suggested_bar numeric,
  p_delta_amount numeric,
  p_delta_pct numeric,
  p_demand_index integer,
  p_demand_level text,
  p_occupancy_pct numeric,
  p_rooms_remaining integer,
  p_pickup_24h integer,
  p_pickup_3d integer,
  p_pickup_7d integer,
  p_lighthouse_median numeric,
  p_flowtym_compset_median numeric,
  p_strategy_code text,
  p_explanation text,
  p_evidence jsonb,
  p_confidence_score integer,
  p_data_quality_status text,
  p_input_snapshot jsonb,
  p_engine_version text
)
returns table(id uuid, recommendation_status text)
language plpgsql
set search_path = 'pg_catalog', 'public', 'flowtym_private'
as $function$
begin
  if not flowtym_private.can_manage_hotel(p_hotel_id, p_organization_id) then
    raise exception 'Hotel access denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.hotel_room_types rt
    where rt.id = p_room_type_id
      and rt.hotel_id = p_hotel_id
      and rt.organization_id = p_organization_id
      and rt.is_active = true
  ) then
    raise exception 'Room type is not active for this hotel' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.hotel_rate_plans rp
    where rp.id = p_rate_plan_id
      and rp.hotel_id = p_hotel_id
      and rp.organization_id = p_organization_id
      and rp.is_active = true
      and rp.is_public = true
  ) then
    raise exception 'Rate plan is not active and public for this hotel' using errcode = '22023';
  end if;

  if p_current_bar is null or p_current_bar <= 0 or p_suggested_bar is null or p_suggested_bar <= 0 then
    raise exception 'Current and suggested BAR must be positive' using errcode = '22023';
  end if;
  if p_data_quality_status not in ('valid','degraded','insufficient','stale','conflicted') then
    raise exception 'Invalid data quality status' using errcode = '22023';
  end if;
  if p_demand_level is not null and p_demand_level not in ('faible','normal','modere','eleve','tres_fort','exceptionnel') then
    raise exception 'Invalid demand level' using errcode = '22023';
  end if;

  return query
  insert into public.daily_rate_intelligence (
    organization_id, hotel_id, room_type_id, rate_plan_id, stay_date, currency,
    current_bar, suggested_bar, delta_amount, delta_pct, demand_index, demand_level,
    occupancy_pct, rooms_remaining, pickup_24h, pickup_3d, pickup_7d,
    lighthouse_median, flowtym_compset_median, strategy_code, explanation,
    evidence, confidence_score, data_quality_status, input_snapshot,
    engine_version, recommendation_status
  ) values (
    p_organization_id, p_hotel_id, p_room_type_id, p_rate_plan_id, p_stay_date, p_currency,
    p_current_bar, p_suggested_bar, p_delta_amount, p_delta_pct, p_demand_index, p_demand_level,
    p_occupancy_pct, p_rooms_remaining, p_pickup_24h, p_pickup_3d, p_pickup_7d,
    p_lighthouse_median, p_flowtym_compset_median, p_strategy_code, p_explanation,
    coalesce(p_evidence, '{}'::jsonb), p_confidence_score, p_data_quality_status,
    coalesce(p_input_snapshot, '{}'::jsonb), p_engine_version, 'pending'
  )
  on conflict (hotel_id, room_type_id, rate_plan_id, stay_date, engine_version)
  do update set
    currency = excluded.currency,
    current_bar = excluded.current_bar,
    suggested_bar = excluded.suggested_bar,
    delta_amount = excluded.delta_amount,
    delta_pct = excluded.delta_pct,
    demand_index = excluded.demand_index,
    demand_level = excluded.demand_level,
    occupancy_pct = excluded.occupancy_pct,
    rooms_remaining = excluded.rooms_remaining,
    pickup_24h = excluded.pickup_24h,
    pickup_3d = excluded.pickup_3d,
    pickup_7d = excluded.pickup_7d,
    lighthouse_median = excluded.lighthouse_median,
    flowtym_compset_median = excluded.flowtym_compset_median,
    strategy_code = excluded.strategy_code,
    explanation = excluded.explanation,
    evidence = excluded.evidence,
    confidence_score = excluded.confidence_score,
    data_quality_status = excluded.data_quality_status,
    input_snapshot = excluded.input_snapshot,
    updated_at = now()
  where public.daily_rate_intelligence.recommendation_status = 'pending'
  returning public.daily_rate_intelligence.id, public.daily_rate_intelligence.recommendation_status;

  if not found then
    raise exception 'A recommendation for this room type, rate plan and date has already been decided; use a new engine version to create a new proposal'
      using errcode = '55000';
  end if;
end;
$function$;

revoke all on function public.persist_rm_recommendation_v2(
  uuid,uuid,uuid,uuid,date,text,numeric,numeric,numeric,numeric,integer,text,numeric,integer,integer,integer,integer,numeric,numeric,text,text,jsonb,integer,text,jsonb,text
) from public;
grant execute on function public.persist_rm_recommendation_v2(
  uuid,uuid,uuid,uuid,date,text,numeric,numeric,numeric,numeric,integer,text,numeric,integer,integer,integer,integer,numeric,numeric,text,text,jsonb,integer,text,jsonb,text
) to authenticated;
