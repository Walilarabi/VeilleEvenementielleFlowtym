alter table public.lighthouse_market_observations
  add column if not exists demand_evolution_1d numeric(12,4),
  add column if not exists demand_evolution_3d numeric(12,4),
  add column if not exists demand_evolution_7d numeric(12,4);

comment on column public.lighthouse_market_observations.demand_evolution_1d is
  'Raw Lighthouse market-demand evolution versus previous day; unit retained as supplied by parser.';
comment on column public.lighthouse_market_observations.demand_evolution_3d is
  'Raw Lighthouse market-demand evolution versus 3 days earlier; unit retained as supplied by parser.';
comment on column public.lighthouse_market_observations.demand_evolution_7d is
  'Raw Lighthouse market-demand evolution versus 7 days earlier; unit retained as supplied by parser.';
