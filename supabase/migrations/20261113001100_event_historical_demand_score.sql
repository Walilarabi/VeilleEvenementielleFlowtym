-- Add an explicitly sourced historical occupancy feature to hotel/event impact.
begin;
alter table public.event_hotel_impacts add column if not exists historical_demand_score numeric(5,2);
alter table public.event_hotel_impacts add column if not exists historical_demand_sample_count integer;
do $$
begin
  if not exists(select 1 from pg_constraint where conname='event_hotel_impact_historical_demand_range') then
    alter table public.event_hotel_impacts add constraint event_hotel_impact_historical_demand_range
      check (historical_demand_score is null or historical_demand_score between 0 and 100);
  end if;
  if not exists(select 1 from pg_constraint where conname='event_hotel_impact_historical_demand_count') then
    alter table public.event_hotel_impacts add constraint event_hotel_impact_historical_demand_count
      check (historical_demand_sample_count is null or historical_demand_sample_count >= 0);
  end if;
end $$;
commit;
