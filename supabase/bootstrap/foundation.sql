-- HOPTYM foundation bootstrap for a NEW Supabase project only.
-- On the current HOPTYM project, organizations/users/hotels already exist.
-- Run this before /supabase/migrations/* only when provisioning an empty project.
-- Does not create Auth users, assign roles, or enable public sign-up.

begin;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'analyst'
    check (role in ('super_admin','admin','revenue_manager','gm','analyst')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  group_name text,
  city text not null,
  country text not null,
  address text,
  lat numeric(9,6),
  lng numeric(9,6),
  stars integer check (stars between 1 and 5),
  room_count integer check (room_count is null or room_count >= 0),
  segment text,
  base_adr numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,name)
);

alter table public.organizations add column if not exists name text;
alter table public.organizations add column if not exists slug text;
alter table public.organizations add column if not exists created_at timestamptz not null default now();

alter table public.users add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.users add column if not exists email text;
alter table public.users add column if not exists full_name text;
alter table public.users add column if not exists role text not null default 'analyst';
alter table public.users add column if not exists created_at timestamptz not null default now();
alter table public.users add column if not exists updated_at timestamptz not null default now();

alter table public.hotels add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.hotels add column if not exists name text;
alter table public.hotels add column if not exists group_name text;
alter table public.hotels add column if not exists city text;
alter table public.hotels add column if not exists country text;
alter table public.hotels add column if not exists address text;
alter table public.hotels add column if not exists lat numeric(9,6);
alter table public.hotels add column if not exists lng numeric(9,6);
alter table public.hotels add column if not exists stars integer;
alter table public.hotels add column if not exists room_count integer;
alter table public.hotels add column if not exists segment text;
alter table public.hotels add column if not exists base_adr numeric(10,2);
alter table public.hotels add column if not exists created_at timestamptz not null default now();
alter table public.hotels add column if not exists updated_at timestamptz not null default now();

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.hotels enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users_read_own_profile') then
    create policy users_read_own_profile on public.users for select to authenticated using (id=(select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='organizations' and policyname='organization_members_and_super_admin_read_organizations') then
    create policy organization_members_and_super_admin_read_organizations on public.organizations for select to authenticated
    using (exists(select 1 from public.users u where u.id=(select auth.uid()) and (u.role='super_admin' or u.organization_id=organizations.id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='hotels' and policyname='hotels_read_by_organization_or_super_admin') then
    create policy hotels_read_by_organization_or_super_admin on public.hotels for select to authenticated
    using (exists(select 1 from public.users u where u.id=(select auth.uid()) and (u.role='super_admin' or u.organization_id=hotels.organization_id)));
  end if;
end $$;

grant select on public.organizations,public.users,public.hotels to authenticated;

commit;
