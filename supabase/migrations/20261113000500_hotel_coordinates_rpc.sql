-- Restricted, audited-by-RLS entry point for hotel GPS updates.
-- The application role cannot UPDATE hotels directly; this SECURITY DEFINER RPC
-- changes only lat/lng and re-checks the authenticated manager's hotel scope.
create or replace function public.update_hotel_coordinates(
  p_hotel_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_user_org uuid;
  v_hotel_org uuid;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if (p_lat is null) <> (p_lng is null) then
    raise exception 'LAT_LNG_MUST_BE_SET_TOGETHER';
  end if;
  if p_lat is not null and (p_lat < -90 or p_lat > 90) then
    raise exception 'LATITUDE_OUT_OF_RANGE';
  end if;
  if p_lng is not null and (p_lng < -180 or p_lng > 180) then
    raise exception 'LONGITUDE_OUT_OF_RANGE';
  end if;

  select u.role, u.organization_id
    into v_role, v_user_org
    from public.users u
   where u.id = v_user_id;

  if v_role is null then
    raise exception 'FLOWTYM_PROFILE_NOT_FOUND';
  end if;
  if v_role not in ('super_admin', 'admin', 'revenue_manager') then
    raise exception 'MANAGER_ROLE_REQUIRED';
  end if;

  select h.organization_id
    into v_hotel_org
    from public.hotels h
   where h.id = p_hotel_id;

  if v_hotel_org is null then
    raise exception 'HOTEL_NOT_FOUND';
  end if;

  if v_role <> 'super_admin'
     and v_user_org is distinct from v_hotel_org
     and not exists (
       select 1
         from public.hotel_memberships hm
        where hm.hotel_id = p_hotel_id
          and hm.user_id = v_user_id
     ) then
    raise exception 'HOTEL_SCOPE_FORBIDDEN';
  end if;

  update public.hotels
     set lat = p_lat,
         lng = p_lng,
         updated_at = now()
   where id = p_hotel_id
   returning jsonb_build_object('hotel_id', id, 'lat', lat, 'lng', lng)
        into v_result;

  return v_result;
end;
$$;

revoke all on function public.update_hotel_coordinates(uuid, double precision, double precision) from public;
grant execute on function public.update_hotel_coordinates(uuid, double precision, double precision) to authenticated;
