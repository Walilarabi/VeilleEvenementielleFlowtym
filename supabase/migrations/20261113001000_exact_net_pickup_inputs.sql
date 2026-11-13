-- Exact net-pickup inputs. Aggregate OTB deltas are not treated as exact pickup.
begin;
alter table public.hotel_reservation_snapshots add column if not exists pickup_window_hours smallint;
alter table public.hotel_reservation_snapshots add column if not exists period_start timestamptz;
alter table public.hotel_reservation_snapshots add column if not exists new_rooms_booked integer;
alter table public.hotel_reservation_snapshots add column if not exists cancelled_rooms integer;
alter table public.hotel_reservation_snapshots add column if not exists moved_in_rooms integer not null default 0;
alter table public.hotel_reservation_snapshots add column if not exists moved_out_rooms integer not null default 0;
alter table public.hotel_reservation_snapshots add column if not exists net_pickup_rooms integer generated always as (
  case
    when new_rooms_booked is not null and cancelled_rooms is not null
    then new_rooms_booked - cancelled_rooms + coalesce(moved_in_rooms,0) - coalesce(moved_out_rooms,0)
    else null
  end
) stored;
alter table public.hotel_reservation_snapshots add constraint reservation_pickup_window_valid
  check (pickup_window_hours is null or pickup_window_hours in (24,72,168));
alter table public.hotel_reservation_snapshots add constraint reservation_pickup_values_nonnegative
  check (
    (new_rooms_booked is null or new_rooms_booked >= 0) and
    (cancelled_rooms is null or cancelled_rooms >= 0) and
    moved_in_rooms >= 0 and moved_out_rooms >= 0
  );
alter table public.hotel_reservation_snapshots add constraint reservation_pickup_period_valid
  check (period_start is null or period_start <= snapshot_at);
create index if not exists idx_reservation_pickup_lookup
  on public.hotel_reservation_snapshots(hotel_id,stay_date,pickup_window_hours,snapshot_at desc)
  where net_pickup_rooms is not null;
commit;
