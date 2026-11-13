/**
 * @deprecated Legacy schema bootstrap removed.
 * Use the versioned SQL migrations under /supabase/migrations.
 * This read-only query is retained for compatibility with older imports.
 */
export const FULL_SUPABASE_SQL = `-- READ-ONLY SCHEMA AUDIT. This script does not create or alter tables.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;`;
