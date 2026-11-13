-- Enforce same-hotel / same-tenant relationships for all optional cross-table references.
begin;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='hotel_room_types_id_hotel_org_unique') then
    alter table public.hotel_room_types add constraint hotel_room_types_id_hotel_org_unique unique(id,hotel_id,organization_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='hotel_rate_plans_id_hotel_org_unique') then
    alter table public.hotel_rate_plans add constraint hotel_rate_plans_id_hotel_org_unique unique(id,hotel_id,organization_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='competitor_hotels_id_hotel_org_unique') then
    alter table public.competitor_hotels add constraint competitor_hotels_id_hotel_org_unique unique(id,hotel_id,organization_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='lighthouse_extractions_id_hotel_org_unique') then
    alter table public.lighthouse_extractions add constraint lighthouse_extractions_id_hotel_org_unique unique(id,hotel_id,organization_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='event_occurrences_id_event_unique') then
    alter table public.event_occurrences add constraint event_occurrences_id_event_unique unique(id,event_id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='rate_plans_room_type_same_hotel_fk') then
    alter table public.hotel_rate_plans add constraint rate_plans_room_type_same_hotel_fk
      foreign key(room_type_id,hotel_id,organization_id)
      references public.hotel_room_types(id,hotel_id,organization_id) on delete set null (room_type_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='inventory_room_type_same_hotel_fk') then
    alter table public.hotel_inventory_snapshots add constraint inventory_room_type_same_hotel_fk
      foreign key(room_type_id,hotel_id,organization_id)
      references public.hotel_room_types(id,hotel_id,organization_id) on delete set null (room_type_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='reservation_room_type_same_hotel_fk') then
    alter table public.hotel_reservation_snapshots add constraint reservation_room_type_same_hotel_fk
      foreign key(room_type_id,hotel_id,organization_id)
      references public.hotel_room_types(id,hotel_id,organization_id) on delete set null (room_type_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='forecast_room_type_same_hotel_fk') then
    alter table public.daily_demand_forecasts add constraint forecast_room_type_same_hotel_fk
      foreign key(room_type_id,hotel_id,organization_id)
      references public.hotel_room_types(id,hotel_id,organization_id) on delete set null (room_type_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='daily_rate_room_type_same_hotel_fk') then
    alter table public.daily_rate_intelligence add constraint daily_rate_room_type_same_hotel_fk
      foreign key(room_type_id,hotel_id,organization_id)
      references public.hotel_room_types(id,hotel_id,organization_id) on delete set null (room_type_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='daily_rate_plan_same_hotel_fk') then
    alter table public.daily_rate_intelligence add constraint daily_rate_plan_same_hotel_fk
      foreign key(rate_plan_id,hotel_id,organization_id)
      references public.hotel_rate_plans(id,hotel_id,organization_id) on delete set null (rate_plan_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='lighthouse_competitor_same_hotel_fk') then
    alter table public.lighthouse_rate_observations add constraint lighthouse_competitor_same_hotel_fk
      foreign key(competitor_id,hotel_id,organization_id)
      references public.competitor_hotels(id,hotel_id,organization_id) on delete set null (competitor_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='lighthouse_extraction_same_hotel_fk') then
    alter table public.lighthouse_rate_observations add constraint lighthouse_extraction_same_hotel_fk
      foreign key(extraction_id,hotel_id,organization_id)
      references public.lighthouse_extractions(id,hotel_id,organization_id) on delete set null (extraction_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='ingestion_integration_same_hotel_fk') then
    alter table public.data_ingestion_jobs add constraint ingestion_integration_same_hotel_fk
      foreign key(integration_id,hotel_id,organization_id)
      references public.integration_connections(id,hotel_id,organization_id) on delete set null (integration_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='event_impact_occurrence_matches_event_fk') then
    alter table public.event_hotel_impacts add constraint event_impact_occurrence_matches_event_fk
      foreign key(occurrence_id,event_id)
      references public.event_occurrences(id,event_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='event_evidence_occurrence_matches_event_fk') then
    alter table public.event_evidence add constraint event_evidence_occurrence_matches_event_fk
      foreign key(occurrence_id,event_id)
      references public.event_occurrences(id,event_id) on delete set null (occurrence_id);
  end if;
end $$;

commit;
