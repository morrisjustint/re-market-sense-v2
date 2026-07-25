-- RE Market Sense – Phase 4.1: consent attestation + email send logging

-- ---------------------------------------------------------------------------
-- Consent attestations (one required record per deployment before sending)
-- ---------------------------------------------------------------------------
create table if not exists public.deployment_consents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  deployment_id uuid not null references public.deployments (id) on delete cascade,
  attested_by_user_id uuid references auth.users (id) on delete set null,
  attested_by_email text,
  attestation_text text not null,
  attested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (deployment_id)
);

create index if not exists deployment_consents_org_id_idx
  on public.deployment_consents (org_id);
create index if not exists deployment_consents_deployment_id_idx
  on public.deployment_consents (deployment_id);

alter table public.deployment_consents enable row level security;

drop policy if exists "Members can view org consents" on public.deployment_consents;
create policy "Members can view org consents"
  on public.deployment_consents for select to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Members can insert org consents" on public.deployment_consents;
create policy "Members can insert org consents"
  on public.deployment_consents for insert to authenticated
  with check (public.is_org_member(org_id));

drop policy if exists "Members can update org consents" on public.deployment_consents;
create policy "Members can update org consents"
  on public.deployment_consents for update to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Members can delete org consents" on public.deployment_consents;
create policy "Members can delete org consents"
  on public.deployment_consents for delete to authenticated
  using (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Email / message send log (one row per send attempt per contact)
-- channel keeps SMS structurally ready; only 'email' is used in the pilot.
-- ---------------------------------------------------------------------------
create table if not exists public.message_sends (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  deployment_id uuid not null references public.deployments (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  channel text not null default 'email' check (channel in ('email', 'sms')),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_message_id text,
  to_address text,
  error text,
  created_at timestamptz not null default now(),
  unique (deployment_id, contact_id, channel)
);

create index if not exists message_sends_org_id_idx
  on public.message_sends (org_id);
create index if not exists message_sends_deployment_id_idx
  on public.message_sends (deployment_id);
create index if not exists message_sends_contact_id_idx
  on public.message_sends (contact_id);
create index if not exists message_sends_status_idx
  on public.message_sends (status);

alter table public.message_sends enable row level security;

drop policy if exists "Members can view org message sends" on public.message_sends;
create policy "Members can view org message sends"
  on public.message_sends for select to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Members can insert org message sends" on public.message_sends;
create policy "Members can insert org message sends"
  on public.message_sends for insert to authenticated
  with check (public.is_org_member(org_id));

drop policy if exists "Members can update org message sends" on public.message_sends;
create policy "Members can update org message sends"
  on public.message_sends for update to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Members can delete org message sends" on public.message_sends;
create policy "Members can delete org message sends"
  on public.message_sends for delete to authenticated
  using (public.is_org_member(org_id));
