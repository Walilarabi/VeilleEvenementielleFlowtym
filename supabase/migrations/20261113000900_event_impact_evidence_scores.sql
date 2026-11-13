-- Event impact scoring evidence fields; scores remain NULL until inputs are verified.
begin;
alter table public.event_hotel_impacts add column if not exists notoriety_score numeric(5,2);
alter table public.event_hotel_impacts add column if not exists extra_nights_score numeric(5,2);
alter table public.event_hotel_impacts add column if not exists segment_fit_score numeric(5,2);
alter table public.event_hotel_impacts add column if not exists source_confidence_score integer;
alter table public.event_hotel_impacts add column if not exists score_components jsonb not null default '{}'::jsonb;
alter table public.event_hotel_impacts add column if not exists source_evidence jsonb not null default '[]'::jsonb;
alter table public.event_hotel_impacts add constraint event_hotel_impact_notoriety_range check (notoriety_score is null or notoriety_score between 0 and 100);
alter table public.event_hotel_impacts add constraint event_hotel_impact_extra_nights_range check (extra_nights_score is null or extra_nights_score between 0 and 100);
alter table public.event_hotel_impacts add constraint event_hotel_impact_segment_fit_range check (segment_fit_score is null or segment_fit_score between 0 and 100);
alter table public.event_hotel_impacts add constraint event_hotel_impact_source_confidence_range check (source_confidence_score is null or source_confidence_score between 0 and 100);
commit;
