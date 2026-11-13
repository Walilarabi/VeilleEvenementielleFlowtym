begin;
do $$
declare
  v_org uuid; v_hotel uuid; v_user uuid; v_experiment uuid;
  v_status text; v_verified boolean; v_audit_count integer;
begin
  select id,organization_id into v_hotel,v_org from public.hotels where name='Folkestone Opéra' order by created_at limit 1;
  select id into v_user from public.users where email='direction.commerciale.bh@gmail.com';
  if v_hotel is null or v_user is null then raise exception 'Required HOPTYM test hotel/user missing'; end if;

  insert into public.hotel_price_experiments(
    organization_id,hotel_id,experiment_code,experiment_name,assignment_unit,experiment_status,
    start_date,end_date,randomization_method,randomization_verified,created_by
  ) values (
    v_org,v_hotel,'rls-experiment-test','RLS experiment test','stay_date_room_type_rate_plan_channel','draft',
    current_date-10,current_date-1,'randomized_control_treatment',false,v_user
  ) returning id into v_experiment;

  insert into public.hotel_price_experiment_observations(
    organization_id,hotel_id,experiment_id,group_type,stay_date,channel,currency,assigned_price,
    exposure_count,rooms_sold,cancelled_rooms,source_status,source_name,observed_at
  ) values
    (v_org,v_hotel,v_experiment,'control',current_date-2,'direct','EUR',100,100,20,0,'imported','test-source',now()),
    (v_org,v_hotel,v_experiment,'treatment',current_date-2,'direct','EUR',110,100,18,0,'imported','test-source',now());

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  execute 'set local role authenticated';

  select experiment_status,randomization_verified into v_status,v_verified
  from public.review_price_experiment(v_hotel,v_experiment,'verify_randomization','test_verify','test', '{"randomization":"documented"}'::jsonb);
  if v_verified is not true then raise exception 'FAIL: randomization verification did not persist'; end if;

  select experiment_status,randomization_verified into v_status,v_verified
  from public.review_price_experiment(v_hotel,v_experiment,'complete','test_complete','test completion',null);
  if v_status<>'completed' then raise exception 'FAIL: experiment was not completed'; end if;

  select count(*) into v_audit_count from public.hotel_price_experiment_audit_logs where experiment_id=v_experiment;
  if v_audit_count<>2 then raise exception 'FAIL: expected two experiment audit rows'; end if;

  begin
    update public.hotel_price_experiments set experiment_status='aborted' where id=v_experiment;
    raise exception 'FAIL: direct experiment update was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.hotel_price_experiment_observations set rooms_sold=999 where experiment_id=v_experiment;
    raise exception 'FAIL: experiment observation UPDATE was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.hotel_price_experiment_observations(
      organization_id,hotel_id,experiment_id,group_type,stay_date,channel,currency,assigned_price,
      exposure_count,rooms_sold,source_status,source_name,observed_at
    ) values(v_org,v_hotel,v_experiment,'control',current_date-1,'direct','EUR',100,100,20,'imported','test-source',now());
    raise exception 'FAIL: observation insert after completion was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;