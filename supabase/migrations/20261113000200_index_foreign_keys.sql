-- Add a covering btree index for every FK that does not already have one.
-- Idempotent and additive; indexes are named from stable constraint hashes.
do $$
declare
  fk record;
  cols text;
  expected text;
  idx_name text;
begin
  for fk in
    select c.oid as constraint_oid,
           c.conname,
           c.conrelid,
           n.nspname as schema_name,
           t.relname as table_name,
           c.conkey
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where c.contype='f' and n.nspname='public'
  loop
    expected := array_to_string(fk.conkey, ' ');
    if not exists (
      select 1
      from pg_index i
      where i.indrelid=fk.conrelid
        and i.indisvalid
        and i.indpred is null
        and i.indexprs is null
        and (
          left(i.indkey::text, length(expected)) = expected
          and (
            length(i.indkey::text) = length(expected)
            or substr(i.indkey::text, length(expected)+1, 1) = ' '
          )
        )
    ) then
      select string_agg(format('%I',a.attname), ', ' order by k.ordinality)
      into cols
      from unnest(fk.conkey) with ordinality as k(attnum, ordinality)
      join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=k.attnum;
      idx_name := 'idx_fk_' || substr(md5(fk.conname),1,16);
      execute format('create index if not exists %I on %I.%I (%s)',
        idx_name, fk.schema_name, fk.table_name, cols);
    end if;
  end loop;
end $$;
