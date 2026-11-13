# Supabase foundation bootstrap

For a brand-new Supabase project only, run `foundation.sql` before the Revenue migrations. It creates the baseline `organizations`, `users`, and `hotels` tables with RLS and no public signup trigger.

The current HOPTYM project already has these tables and live records; do not recreate or reseed them. Existing Auth users must be provisioned into `public.users` by an authorized admin workflow. Public sign-ups remain disabled.

After the foundation is present, apply the ordered migrations in `/supabase/migrations`. The deployed project's current migration sequence and table model are documented in `/docs/REVENUE_BACKEND_API.md`.
