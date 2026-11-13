-- Cover every newly introduced FK with a leading-column index.
begin;
create index if not exists idx_event_impact_audit_org_fk on public.event_impact_decision_audit_logs(organization_id);
create index if not exists idx_event_impact_audit_impact_fk on public.event_impact_decision_audit_logs(impact_id);
create index if not exists idx_event_impact_audit_actor_fk on public.event_impact_decision_audit_logs(actor_user_id);
create index if not exists idx_event_impacts_reviewed_by_fk on public.event_hotel_impacts(reviewed_by);

create index if not exists idx_price_experiments_tenant_fk on public.hotel_price_experiments(hotel_id,organization_id);
create index if not exists idx_price_experiments_created_by_fk on public.hotel_price_experiments(created_by);
create index if not exists idx_price_experiment_observations_experiment_fk on public.hotel_price_experiment_observations(experiment_id,hotel_id,organization_id);
create index if not exists idx_price_experiment_observations_tenant_fk on public.hotel_price_experiment_observations(hotel_id,organization_id);
create index if not exists idx_price_experiment_observations_room_fk on public.hotel_price_experiment_observations(room_type_id,hotel_id,organization_id);
create index if not exists idx_price_experiment_observations_rate_fk on public.hotel_price_experiment_observations(rate_plan_id,hotel_id,organization_id);
create index if not exists idx_censoring_observations_tenant_fk on public.hotel_demand_censoring_observations(hotel_id,organization_id);
create index if not exists idx_censoring_observations_room_fk on public.hotel_demand_censoring_observations(room_type_id,hotel_id,organization_id);
create index if not exists idx_censoring_observations_rate_fk on public.hotel_demand_censoring_observations(rate_plan_id,hotel_id,organization_id);
create index if not exists idx_calibration_rules_tenant_fk on public.hotel_calibration_rules(hotel_id,organization_id);
create index if not exists idx_calibration_rules_created_by_fk on public.hotel_calibration_rules(created_by);
commit;
