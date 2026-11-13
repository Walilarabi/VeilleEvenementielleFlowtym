begin;
do $$
declare
  v_org uuid;
  v_hotel uuid;
  v_user uuid;
  v_venue uuid;
  v_event uuid;
  v_occurrence uuid;
  v_impact uuid;
  v_status text;
  v_before text;
  v_after text;
begin
  select id,organization_id into v_hotel,v_org from public.hotels where name='Folkestone Opéra' order by created_at limit 1;
  select id into v_user from public.users where email='direction.commerciale.bh@gmail.com';
  if v_hotel is null or v_user is null then raise exception 'Required HOPTYM test hotel/user missing'; end if;
  insert into public.venues(name,venue_type,city,country_code,capacity,verification_status)
  values ('RLS test venue','arena','Paris','FR',10000,'verified') returning id into v_venue;
  insert into public.events(title,normalized_title,category,venue_id,city,country_code,status,expected_attendance,international_ratio_pct,recurrence_frequency)
  values ('RLS test event','rls test event','concerts_spectacles',v_venue,'Paris','FR','confirmed',1000,15,'one_time')
  returning id into v_event;
  insert into public.event_occurrences(event_id,start_date,end_date,date_status)
  values (v_event,current_date+30,current_date+30,'confirmed') returning id into v_occurrence;
  insert into public.event_hotel_impacts(organization_id,hotel_id,event_id,occurrence_id,final_rm_score,confidence_score,impact_status)
  values (v_org,v_hotel,v_event,v_occurrence,80,90,'to_review') returning id into v_impact;

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  execute 'set local role authenticated';
  select impact_status into v_status
  from public.record_event_impact_decision(v_hotel,v_impact,'validate','rls_test','test event approval');
  if v_status<>'validated' then raise exception 'FAIL: event impact decision did not validate'; end if;

  select before_state->>'impact_status',after_state->>'impact_status'
  into v_before,v_after from public.event_impact_decision_audit_logs where impact_id=v_impact;
  if v_before<>'to_review' or v_after<>'validated' then raise exception 'FAIL: event decision audit before/after states incorrect'; end if;

  update public.event_hotel_impacts set impact_status='dismissed' where id=v_impact;
  select impact_status into v_status from public.event_hotel_impacts where id=v_impact;
  if v_status<>'validated' then raise exception 'FAIL: direct event impact status edit was allowed'; end if;

  begin
    update public.event_impact_decision_audit_logs set reason_text='tampered' where impact_id=v_impact;
    raise exception 'FAIL: event audit UPDATE was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;