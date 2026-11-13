-- HOPTYM — Auth profiles and tenant membership
create table if not exists public.organizations (id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, created_at timestamptz not null default now());
create table if not exists public.users (id uuid primary key references auth.users(id) on delete cascade, organization_id uuid references public.organizations(id) on delete set null, email text not null, full_name text, role text not null default 'revenue_manager' check (role in ('super_admin','admin','revenue_manager','gm','analyst')), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists users_organization_id_idx on public.users (organization_id);
alter table public.organizations enable row level security;
alter table public.users enable row level security;
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.users from anon, authenticated;
grant select on table public.users to authenticated;
drop policy if exists "users_read_own_profile" on public.users;
create policy "users_read_own_profile" on public.users for select to authenticated using ((select auth.uid()) = id);
create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.users (id,email,full_name,role) values (new.id,coalesce(new.email,''),nullif(new.raw_user_meta_data ->> 'full_name',''),'revenue_manager')
 on conflict (id) do update set email=excluded.email, full_name=coalesce(public.users.full_name,excluded.full_name), updated_at=now();
 return new;
end; $$;
revoke all on function public.handle_new_auth_user() from public,anon,authenticated;
drop trigger if exists on_auth_user_created_flowtym on auth.users;
create trigger on_auth_user_created_flowtym after insert on auth.users for each row execute function public.handle_new_auth_user();
do $$ begin if to_regprocedure('public.rls_auto_enable()') is not null then execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated'; end if; end; $$;

grant select on table public.organizations to authenticated;
drop policy if exists "organization_members_read_own_organization" on public.organizations;
create policy "organization_members_read_own_organization" on public.organizations
for select to authenticated
using (exists (
 select 1 from public.users u
 where u.id = (select auth.uid()) and u.organization_id = organizations.id
));
