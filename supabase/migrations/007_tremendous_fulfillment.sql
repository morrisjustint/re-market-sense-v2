-- RE Market Sense – Tremendous Sandbox fulfillment helpers
-- Extends queue_incentive_for_token to return contact details for fulfillment,
-- and adds a secure updater so the public check-in flow can mark sent/failed.

create or replace function public.queue_incentive_for_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.response_invites%rowtype;
  dep public.deployments%rowtype;
  contact_row public.contacts%rowtype;
  reward_id uuid;
  reward_status text;
  reward_external text;
  note text;
  recipient_name text;
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

  select * into contact_row
  from public.contacts
  where id = invite.contact_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  -- Already fulfilled — return existing record, do not re-send.
  select id, status, external_id
    into reward_id, reward_status, reward_external
  from public.incentive_rewards
  where deployment_id = invite.deployment_id
    and contact_id = invite.contact_id;

  if found and reward_status = 'sent' then
    return jsonb_build_object(
      'ok', true,
      'queued', true,
      'already_sent', true,
      'reward_id', reward_id,
      'amount', coalesce(dep.incentive_amount, 5),
      'status', reward_status,
      'external_id', reward_external,
      'contact_email', contact_row.email,
      'contact_first_name', contact_row.first_name,
      'contact_last_name', contact_row.last_name
    );
  end if;

  reward_status := 'pending';
  note := 'Queued for thank-you gift fulfillment.';

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
      status = case
        when public.incentive_rewards.status = 'sent' then public.incentive_rewards.status
        else 'pending'
      end,
      error = case
        when public.incentive_rewards.status = 'sent' then public.incentive_rewards.error
        else excluded.error
      end,
      updated_at = now()
  returning id, status, external_id into reward_id, reward_status, reward_external;

  recipient_name := trim(both from concat_ws(
    ' ',
    nullif(contact_row.first_name, ''),
    nullif(contact_row.last_name, '')
  ));

  return jsonb_build_object(
    'ok', true,
    'queued', true,
    'already_sent', reward_status = 'sent',
    'reward_id', reward_id,
    'amount', coalesce(dep.incentive_amount, 5),
    'currency', 'USD',
    'status', reward_status,
    'external_id', reward_external,
    'contact_email', contact_row.email,
    'contact_first_name', contact_row.first_name,
    'contact_last_name', contact_row.last_name,
    'contact_name', nullif(recipient_name, '')
  );
end;
$$;

create or replace function public.update_incentive_reward_status(
  p_reward_id uuid,
  p_status text,
  p_external_id text default null,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_reward_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if p_status is null or p_status not in ('pending', 'sent', 'failed', 'skipped') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;

  update public.incentive_rewards
  set
    status = p_status,
    external_id = coalesce(p_external_id, external_id),
    error = p_error,
    updated_at = now()
  where id = p_reward_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'reward_id', p_reward_id,
    'status', p_status,
    'external_id', p_external_id
  );
end;
$$;

revoke all on function public.queue_incentive_for_token(text) from public;
revoke all on function public.update_incentive_reward_status(uuid, text, text, text) from public;

grant execute on function public.queue_incentive_for_token(text) to anon, authenticated;
grant execute on function public.update_incentive_reward_status(uuid, text, text, text) to anon, authenticated;
