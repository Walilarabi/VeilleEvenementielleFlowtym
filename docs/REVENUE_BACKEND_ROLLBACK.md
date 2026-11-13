# Revenue Backend — rollback and recovery

## Safety rule

The deployed migrations are additive and the live HOPTYM organization/hotel/auth records must be preserved. Do not drop tables, truncate data, disable RLS, or restore the obsolete monolithic schema.

For production incidents, prefer a forward-fix migration. The current schema contains user-entered/imported operational data; deleting newly introduced tables is not an acceptable routine rollback.

## Edge Function

- Current deployed function: `revenue-api`, version 8, JWT verification enabled.
- The function uses the authenticated caller context and RLS; it does not use a service-role key.
- If a code regression occurs, redeploy the last known-good `index.ts` and `deno.json` from the corresponding Git commit, then verify the function is ACTIVE and JWT verification remains enabled.
- If access must be stopped immediately, disable the function in the Supabase Dashboard. Do not expose a bypass endpoint.

## Database migrations

1. `20261113000100_hoptym_revenue_backend.sql`: additive RM/event tables, RLS, tenant helper functions.
2. `20261113000200_index_foreign_keys.sql`: covering FK indexes.
3. `20261113000300_rm_rbac_and_decisions.sql`: write RBAC and atomic human-decision RPC.
4. `20261113000400_same_hotel_foreign_keys.sql`: same-hotel composite foreign keys.
5. `20261113000500_index_composite_foreign_keys.sql`: indexes for composite FKs.
6. `20261113000600_hotel_directory_membership_rls.sql`: hotel-level read membership policy.
7. `20261113000700_idempotent_recommendation_persistence.sql`: idempotent pending-recommendation upsert.
8. `20261113000800_persist_pickup_windows.sql`: persist validated 24h/3d/7d pickup windows.
9. `20261113000900_event_impact_evidence_scores.sql`: store event-impact scoring components and evidence.
10. `20261113001000_exact_net_pickup_inputs.sql`: persist reservation-level exact net pickup windows.
11. `20261113001100_event_historical_demand_score.sql`: persist comparable historical hotel occupancy for event scoring.

### Recovery notes

- Migrations 001–008 are additive. Retain their tables, indexes, constraints and data.
- If the recommendation persistence RPC is defective, redeploy a compatible Edge Function version first, then apply a reviewed forward-fix to the RPC. Do not remove the partial unique index while the API is active.
- If the hotel directory policy blocks a legitimate user, repair that user's `hotel_memberships` assignment or correct the policy. Do not revert to organization-wide visibility for every role.
- If a backfill/import is wrong, use a reviewed correction keyed by source/batch and retain the import log; do not truncate the historical tables.

## Verification after recovery

- Confirm `revenue-api` is ACTIVE and `verify_jwt=true`.
- Confirm 30/30 public tables have RLS enabled.
- Run `supabase/tests/revenue_backend_rls.sql` from a database-owner connection; it runs in a transaction and rolls back its test tenant and test rows.
- Confirm the FK index audit returns zero missing covering indexes.
- Confirm the two existing HOPTYM users and hotel records are still present.
