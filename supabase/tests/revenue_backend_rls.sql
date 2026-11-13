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
  other_org uuid := current_setting('flowtym_test.other_org_id')::uuid;
  other_hotel uuid := current_setting('flowtym_test.other_hotel_id')::uuid;
begin
  if not flowtym_private.can_access_hotel(own_hotel,own_org) then
    raise exception 'FAIL: Revenue Manager cannot access assigned tenant hotel';
  end if;
  if not flowtym_private.can_manage_hotel(own_hotel,own_org) then
    raise exception 'FAIL: Revenue Manager cannot manage own tenant hotel';
  end if;
  if flowtym_private.can_access_hotel(other_hotel,other_org) then
    raise exception 'FAIL: cross-tenant hotel access was granted';
  end if;
  if exists(select 1 from public.hotels where id=other_hotel) then
    raise exception 'FAIL: RLS exposed another organization hotel';
  end if;
end $$;

do $$
declare
  own_org uuid := current_setting('flowtym_test.own_org_id')::uuid;
  own_hotel uuid := current_setting('flowtym_test.own_hotel_id')::uuid;
  v_rate_id uuid;
  v_status text;
begin
  insert into public.daily_rate_intelligence(
    organization_id,hotel_id,stay_date,current_bar,suggested_bar,engine_version
  ) values (
    own_org,own_hotel,current_date+29,220,245,'rls-atomic-test'
  ) returning id into v_rate_id;

  select recommendation_status into v_status
  from public.record_rm_decision(own_hotel,v_rate_id,'modify',240,null,'rls_test','Transactional RLS test');

  if v_status <> 'modified' then
    raise exception 'FAIL: decision RPC did not persist modified status';
  end if;
  if not exists(select 1 from public.rm_decision_audit_logs where rate_intelligence_id=v_rate_id and reason_code='rls_test') then
    raise exception 'FAIL: decision audit row missing';
  end if;

  begin
    update public.rm_decision_audit_logs set reason_text='tampered' where rate_intelligence_id=v_rate_id;
    raise exception 'FAIL: audit log UPDATE was allowed';
  exception when insufficient_privilege then
    null;
  end;
end $$;

rollback;
