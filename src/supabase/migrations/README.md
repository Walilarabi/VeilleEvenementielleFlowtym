# Legacy Supabase SQL files

This directory contains the original application-era auth and historical-engine SQL files. They are retained for historical reference and are **not** the active ordered migration chain.

Do not manually execute `02_historical_and_predictive_engine.sql` against the live HOPTYM project. Its earlier table model is superseded by the additive, RLS-reviewed migrations under `/supabase/migrations`.

- Existing Auth foundation: `03_auth_profiles.sql` (already present on the current authenticated branch).
- New-project baseline: `/supabase/bootstrap/foundation.sql`.
- Active Revenue backend migrations: `/supabase/migrations`.
- Backend contract and API: `/docs/REVENUE_BACKEND_API.md`.

The live HOPTYM database has already been initialized. Do not replay legacy scripts or create duplicate `organizations`, `users`, or `hotels` tables.
