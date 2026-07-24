-- RE Market Sense – Phase 1 schema
-- Run this in the Supabase SQL editor (or via migrations).

create extension if not exists "pgcrypto";

-- Roles
do $$
begin
  if not exists (select 1 from pg_type where typname = 'org_role') then
    create type public.org_role as enum ('founder', 'admin', 'member');
  end if;
end$$;

-- Tables
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists org_members_user_id_idx on public.org_members (user_id);
create index if not exists org_members_org_id_idx on public.org_members (org_id);

-- SECURITY DEFINER helpers (avoid RLS recursion)
create or replace function public.get_user_org_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select org_id
  from public.org_members
  where user_id = auth.uid();
$$;

create or replace function public.is_org_member(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.org_members
    where org_id = check_org_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.org_members
    where org_id = check_org_id
      and user_id = auth.uid()
      and role in ('founder', 'admin')
  );
$$;

create or replace function public.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  existing_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if org_name is null or length(trim(org_name)) = 0 then
    raise exception 'Organization name is required';
  end if;

  select org_id into existing_org_id
  from public.org_members
  where user_id = auth.uid()
  limit 1;

  if existing_org_id is not null then
    return existing_org_id;
  end if;

  insert into public.orgs (name)
  values (trim(org_name))
  returning id into new_org_id;

  insert into public.org_members (org_id, user_id, role)
  values (new_org_id, auth.uid(), 'founder');

  return new_org_id;
end;
$$;

revoke all on function public.get_user_org_ids() from public;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_admin(uuid) from public;
revoke all on function public.create_organization(text) from public;

grant execute on function public.get_user_org_ids() to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.create_organization(text) to authenticated;

-- RLS
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;

drop policy if exists "Members can view their orgs" on public.orgs;
create policy "Members can view their orgs"
  on public.orgs
  for select
  to authenticated
  using (public.is_org_member(id));

drop policy if exists "Founders can update their orgs" on public.orgs;
create policy "Founders can update their orgs"
  on public.orgs
  for update
  to authenticated
  using (public.is_org_admin(id));

drop policy if exists "Users can view memberships in their orgs" on public.org_members;
create policy "Users can view memberships in their orgs"
  on public.org_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or org_id in (select public.get_user_org_ids())
  );

drop policy if exists "Users can view their own membership" on public.org_members;
-- covered above

-- Inserts go through create_organization (SECURITY DEFINER), not direct table inserts.
