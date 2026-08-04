-- RE Market Sense – Phase 4.4: thank-you gift card incentives (Tremendous-ready)

-- ---------------------------------------------------------------------------
-- Deployment incentive choice
-- ---------------------------------------------------------------------------
alter table public.deployments
  add column if not exists incentive_enabled boolean not null default false;

alter table public.deployments
  add column if not exists incentive_amount numeric(10, 2) not null default 5;

comment on column public.deployments.incentive_enabled is
  'When true, completed check-ins queue a thank-you gift reward. Future Basic tier may hide/disable this.';
comment on column public.deployments.incentive_amount is
  'Gift amount in USD. Pilot uses 5; field supports 5 or 10 later.';

-- ---------------------------------------------------------------------------
-- Incentive rewards queue (Tremendous fulfillment later)
-- ---------------------------------------------------------------------------
create table if not exists public.incentive_rewards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  deployment_id uuid not null references public.deployments (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  response_id uuid references public.responses (id) on delete set null,
  amount numeric(10, 2) not null default 5,
  currency text not null default 'USD',
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider text not null default 'tremendous',
  external_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deployment_id, contact_id)
);

create index if not exists incentive_rewards_org_id_idx
  on public.incentive_rewards (org_id);
create index if not exists incentive_rewards_deployment_id_idx
  on public.incentive_rewards (deployment_id);
create index if not exists incentive_rewards_status_idx
  on public.incentive_rewards (status);

alter table public.incentive_rewards enable row level security;

drop policy if exists "Members can view org incentive rewards" on public.incentive_rewards;
create policy "Members can view org incentive rewards"
  on public.incentive_rewards for select to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Members can insert org incentive rewards" on public.incentive_rewards;
create policy "Members can insert org incentive rewards"
  on public.incentive_rewards for insert to authenticated
  with check (public.is_org_member(org_id));

drop policy if exists "Members can update org incentive rewards" on public.incentive_rewards;
create policy "Members can update org incentive rewards"
  on public.incentive_rewards for update to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Members can delete org incentive rewards" on public.incentive_rewards;
create policy "Members can delete org incentive rewards"
  on public.incentive_rewards for delete to authenticated
  using (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Public RPC: after check-in submit, queue a reward when the deployment
-- has thank-you gifts enabled. No Tremendous API call here.
-- ---------------------------------------------------------------------------
create or replace function public.queue_incentive_for_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.response_invites%rowtype;
  dep public.deployments%rowtype;
  reward_id uuid;
  note text;
  reward_status text;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into invite
  from public.response_invites
  where token = trim(p_token)
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if invite.used_at is null or invite.response_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_submitted');
  end if;

  select * into dep
  from public.deployments
  where id = invite.deployment_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if not coalesce(dep.incentive_enabled, false) then
    return jsonb_build_object('ok', true, 'queued', false, 'reason', 'disabled');
  end if;

  -- Tremendous not configured yet → keep pending with a clear note.
  -- Live API key presence is checked in the app layer; here we always queue.
  reward_status := 'pending';
  note := 'Queued for thank-you gift fulfillment. Tremendous not called yet.';

  insert into public.incentive_rewards (
    org_id,
    deployment_id,
    contact_id,
    response_id,
    amount,
    currency,
    status,
    provider,
    error
  )
  values (
    invite.org_id,
    invite.deployment_id,
    invite.contact_id,
    invite.response_id,
    coalesce(dep.incentive_amount, 5),
    'USD',
    reward_status,
    'tremendous',
    note
  )
  on conflict (deployment_id, contact_id) do update
    set
      response_id = excluded.response_id,
      amount = excluded.amount,
      updated_at = now()
  returning id into reward_id;

  return jsonb_build_object(
    'ok', true,
    'queued', true,
    'reward_id', reward_id,
    'amount', coalesce(dep.incentive_amount, 5),
    'status', reward_status
  );
end;
$$;

revoke all on function public.queue_incentive_for_token(text) from public;
grant execute on function public.queue_incentive_for_token(text) to anon, authenticated;

-- Include incentive flags on public check-in load (for thank-you copy on form).
create or replace function public.get_checkin_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  invite public.response_invites%rowtype;
  tmpl public.templates%rowtype;
  dep public.deployments%rowtype;
  contact_first text;
  result jsonb;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into invite
  from public.response_invites
  where token = trim(p_token)
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if invite.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if invite.used_at is not null then
    return jsonb_build_object(
      'ok', false,
      'error', 'already_submitted',
      'agent_name', invite.agent_name,
      'org_name', invite.org_name
    );
  end if;

  select * into dep
  from public.deployments
  where id = invite.deployment_id
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into tmpl
  from public.templates
  where id = dep.template_id
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select first_name into contact_first
  from public.contacts
  where id = invite.contact_id;

  result := jsonb_build_object(
    'ok', true,
    'invite_id', invite.id,
    'token', invite.token,
    'agent_name', invite.agent_name,
    'org_name', invite.org_name,
    'contact_first_name', contact_first,
    'intro_text', tmpl.intro_text,
    'template_name', tmpl.name,
    'questions', tmpl.questions,
    'scoring_rules', tmpl.scoring_rules,
    'expires_at', invite.expires_at,
    'incentive_enabled', coalesce(dep.incentive_enabled, false),
    'incentive_amount', coalesce(dep.incentive_amount, 5)
  );

  return result;
end;
$$;
