-- Run with a database owner connection in a disposable transaction.
-- Creates a temporary second tenant and rolls everything back at the end.
begin;

do $$
declare
  v_user uuid;
  v_org_a uuid;
  v_hotel_a uuid;
  v_org_b uuid;
  v_hotel_b uuid;
begin
  select id,organization_id into v_user,v_org_a
  from public.users
  where lower(email)='direction.commerciale.bh@gmail.com' and role='revenue_manager';
  if v_user is null then raise exception 'Revenue Manager test profile missing'; end if;
  select id into v_hotel_a from public.hotels where organization_id=v_org_a order by created_at limit 1;
  if v_hotel_a is null then raise exception 'Revenue Manager test hotel missing'; end if;

  insert into public.organizations(name,slug)
  values ('RLS isolation fixture','rls-fixture-'||replace(gen_random_uuid()::text,'-',''))
  returning id into v_org_b;
  insert into public.hotels(organization_id,name,city,country)
  values (v_org_b,'RLS isolated hotel','Test City','FR')
  returning id into v_hotel_b;

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('flowtym_test.own_org_id',v_org_a::text,true);
  perform set_config('flowtym_test.own_hotel_id',v_hotel_a::text,true);
  perform set_config('flowtym_test.other_org_id',v_org_b::text,true);
  perform set_config('flowtym_test.other_hotel_id',v_hotel_b::text,true);
end $$;

set local role authenticated;

do $$
declare
  own_org uuid := current_setting('flowtym_test.own_org_id')::uuid;
  own_hotel uuid := current_setting('flowtym_test.own_hotel_id')::uuid;
  v_rate_id uuid;
  v_rate_id_again uuid;
  v_status text;
begin
  select id into v_rate_id
  from public.persist_rm_recommendation(
    own_org,own_hotel,current_date+29,'EUR',220,245,25,11.36,72,'eleve',78,10,null,230,
    'PRICING_V1_HIGH','Test recommendation','{"test":true}'::jsonb,80,'valid','{"test":true}'::jsonb,'rls-idempotency-test'
  );

  select id into v_rate_id_again
  from public.persist_rm_recommendation(
    own_org,own_hotel,current_date+29,'EUR',220,250,30,13.64,76,'eleve',80,9,null,235,
    'PRICING_V1_HIGH','Updated pending recommendation','{"test":true}'::jsonb,85,'valid','{"test":true}'::jsonb,'rls-idempotency-test'
  );

  if v_rate_id <> v_rate_id_again then
    raise exception 'FAIL: repeated generation created duplicate pending recommendations';
  end if;

  select recommendation_status into v_status
  from public.record_rm_decision(own_hotel,v_rate_id,'modify',240,null,'rls_test','Transactional RLS test');

  if v_status <> 'modified' then
    raise exception 'FAIL: decision RPC did not persist modified status';
  end if;
  if not exists(select 1 from public.rm_decision_audit_logs where rate_intelligence_id=v_rate_id and reason_code='rls_test') then
    raise exception 'FAIL: decision audit row missing';
  end if;

  begin
    perform * from public.persist_rm_recommendation(
      own_org,own_hotel,current_date+29,'EUR',220,255,35,15.91,80,'eleve',85,7,null,240,
      'PRICING_V1_HIGH','Should not overwrite a decided recommendation','{"test":true}'::jsonb,90,'valid','{"test":true}'::jsonb,'rls-idempotency-test'
    );
    raise exception 'FAIL: recommendation generation overwrote a decided recommendation';
  exception when sqlstate '55000' then
    null;
  end;

  begin
    update public.rm_decision_audit_logs set reason_text='tampered' where rate_intelligence_id=v_rate_id;
    raise exception 'FAIL: audit log UPDATE was allowed';
  exception when insufficient_privilege then
    null;
  end;
end $$;

rollback;
