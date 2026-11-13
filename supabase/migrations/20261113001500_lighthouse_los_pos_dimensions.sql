-- Explicit LOS/POS dimensions are required to compare like-for-like rate observations.
begin;
alter table public.lighthouse_rate_observations add column if not exists los smallint;
alter table public.lighthouse_rate_observations add column if not exists pos smallint;
alter table public.lighthouse_rate_observations add constraint lighthouse_los_positive check (los is null or los>0);
alter table public.lighthouse_rate_observations add constraint lighthouse_pos_positive check (pos is null or pos>0);
create index if not exists idx_lighthouse_compset_comparable
  on public.lighthouse_rate_observations(hotel_id,stay_date,los,pos,currency,competitor_id,observed_at desc)
  where source_status in ('live','imported') and availability_status='available' and rate_amount is not null;
commit;
