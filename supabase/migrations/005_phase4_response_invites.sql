-- RE Market Sense – Phase 4.2: unique response invites for email check-ins

create table if not exists public.response_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  deployment_id uuid not null references public.deployments (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  token text not null,
  agent_name text not null,
  org_name text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  response_id uuid references public.responses (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (token),
  unique (deployment_id, contact_id)
);

create index if not exists response_invites_org_id_idx
  on public.response_invites (org_id);
create index if not exists response_invites_deployment_id_idx
  on public.response_invites (deployment_id);
create index if not exists response_invites_token_idx
  on public.response_invites (token);
create index if not exists response_invites_expires_at_idx
  on public.response_invites (expires_at);

alter table public.response_invites enable row level security;

-- Org members manage invites for their campaigns.
drop policy if exists "Members can view org response invites" on public.response_invites;
create policy "Members can view org response invites"
  on public.response_invites for select to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Members can insert org response invites" on public.response_invites;
create policy "Members can insert org response invites"
  on public.response_invites for insert to authenticated
  with check (public.is_org_member(org_id));

drop policy if exists "Members can update org response invites" on public.response_invites;
create policy "Members can update org response invites"
  on public.response_invites for update to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Members can delete org response invites" on public.response_invites;
create policy "Members can delete org response invites"
  on public.response_invites for delete to authenticated
  using (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Public check-in RPCs (SECURITY DEFINER) — no login, no service role required.
-- Only the exact token is accepted; never returns other contacts' data.
-- ---------------------------------------------------------------------------

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

  select * into tmpl
  from public.templates
  where id = (
    select template_id from public.deployments where id = invite.deployment_id
  )
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
    'expires_at', invite.expires_at
  );

  return result;
end;
$$;

create or replace function public.submit_checkin_by_token(
  p_token text,
  p_answers jsonb,
  p_score integer,
  p_band_id text,
  p_band_label text,
  p_recommended_next_step text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.response_invites%rowtype;
  new_response_id uuid;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_answers');
  end if;

  select * into invite
  from public.response_invites
  where token = trim(p_token)
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if invite.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if invite.used_at is not null then
    return jsonb_build_object('ok', false, 'error', 'already_submitted');
  end if;

  insert into public.responses (
    org_id,
    deployment_id,
    contact_id,
    answers,
    score,
    band_id,
    band_label,
    recommended_next_step
  )
  values (
    invite.org_id,
    invite.deployment_id,
    invite.contact_id,
    coalesce(p_answers, '{}'::jsonb),
    coalesce(p_score, 0),
    p_band_id,
    p_band_label,
    p_recommended_next_step
  )
  on conflict (deployment_id, contact_id) do update
    set
      answers = excluded.answers,
      score = excluded.score,
      band_id = excluded.band_id,
      band_label = excluded.band_label,
      recommended_next_step = excluded.recommended_next_step
  returning id into new_response_id;

  update public.response_invites
  set
    used_at = now(),
    response_id = new_response_id
  where id = invite.id;

  return jsonb_build_object(
    'ok', true,
    'response_id', new_response_id,
    'score', coalesce(p_score, 0),
    'band_id', p_band_id,
    'band_label', p_band_label
  );
end;
$$;

revoke all on function public.get_checkin_by_token(text) from public;
revoke all on function public.submit_checkin_by_token(text, jsonb, integer, text, text, text) from public;

grant execute on function public.get_checkin_by_token(text) to anon, authenticated;
grant execute on function public.submit_checkin_by_token(text, jsonb, integer, text, text, text) to anon, authenticated;
