-- Correct outer-row scoping in experiment observation insert policy and cover lifecycle FKs.
begin;
drop policy if exists price_experiment_observations_insert on public.hotel_price_experiment_observations;
create policy price_experiment_observations_insert on public.hotel_price_experiment_observations for insert to authenticated
with check (
  flowtym_private.can_manage_hotel(hotel_price_experiment_observations.hotel_id,hotel_price_experiment_observations.organization_id) and
  exists(
    select 1 from public.hotel_price_experiments e
    where e.id=hotel_price_experiment_observations.experiment_id
      and e.hotel_id=hotel_price_experiment_observations.hotel_id
      and e.organization_id=hotel_price_experiment_observations.organization_id
      and e.experiment_status in ('draft','running')
  )
);
do $$
begin
  if not exists(select 1 from pg_constraint where conname='price_experiment_randomization_method_nonempty') then
    alter table public.hotel_price_experiments add constraint price_experiment_randomization_method_nonempty
      check(randomization_method is null or length(trim(randomization_method))>0);
  end if;
end $$;
create index if not exists idx_price_experiments_randomization_verified_by_fk on public.hotel_price_experiments(randomization_verified_by);
create index if not exists idx_price_experiments_completed_by_fk on public.hotel_price_experiments(completed_by);
commit;
