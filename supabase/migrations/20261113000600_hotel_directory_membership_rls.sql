-- Apply the same hotel-level membership boundary to the hotels directory itself.
begin;
drop policy if exists hotels_read_by_organization_or_super_admin on public.hotels;
create policy hotels_read_by_organization_or_super_admin on public.hotels
for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id=(select auth.uid())
      and (
        u.role='super_admin'
        or (
          u.organization_id=hotels.organization_id
          and (
            u.role in ('admin','revenue_manager')
            or exists (
              select 1 from public.hotel_memberships hm
              where hm.hotel_id=hotels.id and hm.user_id=u.id
            )
          )
        )
      )
  )
);
commit;
