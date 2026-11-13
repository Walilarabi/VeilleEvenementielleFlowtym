# HOPTYM / Flowtym Revenue Backend

## Architecture

- PostgreSQL/Supabase is the system of record.
- Every user-facing database request uses the caller JWT and PostgreSQL RLS. The Edge Function does not use a service-role key.
- `revenue-api` is deployed with JWT verification enabled.
- `flowtym_private.can_access_hotel` controls tenant/hotel reads; `can_manage_hotel` restricts mutations to `super_admin`, `admin` and `revenue_manager`.
- `record_rm_decision` is an invoker-rights transactional RPC. It updates a pending recommendation and appends the audit row atomically.
- Price publication to D-EDGE/CRS is deliberately not implemented. Approval is recorded, but no external tariff is changed.

## API

Base URL: `https://aliploqizujgovnlgjvg.supabase.co/functions/v1/revenue-api`

All routes require a valid Supabase user access token.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Authenticated API health |
| GET | `/hotels` | Hotels visible to the caller |
| GET | `/hotels/:hotelId/rates?from=YYYY-MM-DD&to=YYYY-MM-DD` | Daily rate recommendations |
| GET | `/hotels/:hotelId/events?from=...&to=...` | Hotel-specific event impacts |
| GET | `/hotels/:hotelId/inventory-snapshots?from=...&to=...` | Inventory snapshot history |
| GET | `/hotels/:hotelId/forecasts?from=...&to=...` | Persisted daily forecasts |
| POST | `/hotels/:hotelId/decisions` | Accept, modify or reject a recommendation |
| POST | `/hotels/:hotelId/parameters` | Save hotel pricing parameters |
| POST | `/hotels/:hotelId/inventory-snapshots` | Ingest up to 500 snapshots |
| POST | `/hotels/:hotelId/historical-import` | Import up to 5,000 daily historical rows |
| POST | `/hotels/:hotelId/forecasts/baseline` | Generate seasonal-naive forecast |
| POST | `/hotels/:hotelId/recommendations/generate` | Generate deterministic, human-reviewed recommendations |

## Pricing engine v1 configuration

No pricing thresholds are silently assumed. The hotel's `hotel_parameters_profiles.demand_thresholds` must contain a `pricing_v1` object:

```json
{
  "pricing_v1": {
    "weights": {
      "occupancy": 0.4,
      "pickup": 0.25,
      "event": 0.2,
      "compset": 0.15
    },
    "thresholds": {
      "normal": 40,
      "high": 65,
      "exceptional": 85
    },
    "rate_adjustments_pct": {
      "low": -3,
      "normal": 0,
      "high": 5,
      "exceptional": 10
    },
    "pickup_scale_rooms": 5,
    "max_observation_age_hours": 48
  }
}
```

These values are an example configuration, not pre-approved defaults. Configure and validate weights/thresholds per hotel before using the engine.

### v1 deterministic signal definitions

- Occupancy signal: latest non-simulated inventory snapshot occupancy (0–100).
- Pickup signal: `clamp(50 + 50 × net OTB pickup / pickup_scale_rooms, 0, 100)`, using two snapshots at least 20 hours apart.
- Event signal: highest validated/available hotel impact score for the stay date.
- Compset signal: `clamp(50 + 100 × (compset median - current BAR) / current BAR, 0, 100)`, using recent available comparable Lighthouse observations.
- Demand index: weighted mean of the available signals, re-normalized over available weights.
- Rate action: configured percentage adjustment for the demand band, then clamped by the hotel's floor, ceiling and maximum daily rate movement.
- Coverage score: percentage of configured signal weight actually observed. This is a source-coverage indicator, not a statistically calibrated confidence interval.
- If fewer than two signals are available or coverage is below 60%, the engine emits a HOLD / MAINTAIN recommendation and does not justify a price change.

The engine version is persisted as `pricing_v1`; all inputs and configuration are stored in `input_snapshot` / `evidence`. Every recommendation remains `pending` until a human decision.

## Forecast baseline

`seasonal_naive_same_month_weekday@1.0.0` uses only historical rows strictly earlier than the forecast run date, grouped by month and weekday. It requires at least three observations per target date and returns empirical p10/p50/p90 occupancy quantiles. It is a baseline, not a production-grade demand model; backtesting against alternatives is required before promotion.

## Source status and data truth

Allowed provenance statuses are persisted separately from values:
- `live`: confirmed live provider feed.
- `real` / `imported`: verified historical/imported observations.
- `fixture` / `simulation`: tests and simulations; never treated as live market data.

Zero, NULL, sold-out, unavailable, stale and not-comparable are distinct states. Lighthouse sold-out observations are excluded from rate medians, not converted to zero.

## Security / operational constraints

- No service-role key is sent to the browser or used by this function.
- Global event reference tables are shared read-only for authenticated users; canonical curation is super-admin-only.
- Tenant tables have RLS enabled. Same-hotel composite foreign keys prevent cross-hotel references.
- Decision audit rows are append-only for authenticated clients.
- No automatic tariff publishing, no credentials in database plaintext, and no mock/fixture data promoted to live.
