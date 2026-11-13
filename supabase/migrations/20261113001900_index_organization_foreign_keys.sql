-- Cover simple organization_id foreign keys on the new experiment tables.
create index if not exists idx_hotel_calibration_rules_org_fk on public.hotel_calibration_rules(organization_id);
create index if not exists idx_hotel_demand_censoring_org_fk on public.hotel_demand_censoring_observations(organization_id);
create index if not exists idx_hotel_price_experiment_observations_org_fk on public.hotel_price_experiment_observations(organization_id);
create index if not exists idx_hotel_price_experiments_org_fk on public.hotel_price_experiments(organization_id);
