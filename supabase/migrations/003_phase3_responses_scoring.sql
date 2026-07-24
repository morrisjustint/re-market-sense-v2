-- RE Market Sense – Phase 3: responses, campaign statuses, richer templates

-- ---------------------------------------------------------------------------
-- Deployment status: Draft → Ready → Sending → Paused → Completed / Stopped
-- Migrate legacy "launched" → "sending", then recreate the enum.
-- ---------------------------------------------------------------------------
alter table public.deployments
  alter column status drop default;

alter table public.deployments
  alter column status type text using status::text;

drop type if exists public.deployment_status;

create type public.deployment_status as enum (
  'draft',
  'ready',
  'sending',
  'paused',
  'completed',
  'stopped'
);

update public.deployments
set status = case status
  when 'launched' then 'sending'
  when 'draft' then 'draft'
  when 'ready' then 'ready'
  when 'sending' then 'sending'
  when 'paused' then 'paused'
  when 'completed' then 'completed'
  when 'stopped' then 'stopped'
  else 'draft'
end;

alter table public.deployments
  alter column status type public.deployment_status
  using status::public.deployment_status;

alter table public.deployments
  alter column status set default 'draft'::public.deployment_status;

-- ---------------------------------------------------------------------------
-- Responses (scored replies linked to deployment + contact)
-- ---------------------------------------------------------------------------
create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  deployment_id uuid not null references public.deployments (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  score integer not null default 0,
  band_id text,
  band_label text,
  recommended_next_step text,
  created_at timestamptz not null default now(),
  unique (deployment_id, contact_id)
);

create index if not exists responses_org_id_idx on public.responses (org_id);
create index if not exists responses_deployment_id_idx on public.responses (deployment_id);
create index if not exists responses_contact_id_idx on public.responses (contact_id);
create index if not exists responses_band_id_idx on public.responses (band_id);
create index if not exists responses_score_idx on public.responses (score desc);

alter table public.responses enable row level security;

drop policy if exists "Members can view org responses" on public.responses;
create policy "Members can view org responses"
  on public.responses for select to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Members can insert org responses" on public.responses;
create policy "Members can insert org responses"
  on public.responses for insert to authenticated
  with check (public.is_org_member(org_id));

drop policy if exists "Members can update org responses" on public.responses;
create policy "Members can update org responses"
  on public.responses for update to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Members can delete org responses" on public.responses;
create policy "Members can delete org responses"
  on public.responses for delete to authenticated
  using (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Refresh Seller Intent + Buyer Interest Check-In (5–7 agent-friendly Qs)
-- ---------------------------------------------------------------------------
update public.templates
set
  description = 'For homeowners who may be considering a sale — intent, timing, and who wants a value check-in.',
  intro_text = 'Hi! Quick check-in for homeowners. A few short questions help us know who may be thinking about selling and how we can help — no pressure.',
  questions = '[
    {
      "id": "own_home",
      "prompt": "Do you currently own your home?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "yes", "label": "Yes", "points": 2 },
        { "id": "no", "label": "No", "points": 0 }
      ]
    },
    {
      "id": "considering_sell",
      "prompt": "Have you thought about selling in the next year or so?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "actively", "label": "Yes — actively looking into it", "points": 4 },
        { "id": "maybe", "label": "Maybe — open to the idea", "points": 3 },
        { "id": "curious", "label": "Curious what my home is worth", "points": 2 },
        { "id": "no", "label": "Not considering it", "points": 0 }
      ]
    },
    {
      "id": "timeline",
      "prompt": "If you did sell, when would you hope to list?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "asap", "label": "As soon as possible", "points": 4 },
        { "id": "3_6", "label": "In the next 3–6 months", "points": 3 },
        { "id": "6_12", "label": "6–12 months", "points": 2 },
        { "id": "unsure", "label": "Not sure yet", "points": 1 }
      ]
    },
    {
      "id": "readiness",
      "prompt": "How ready do you feel to take the next step?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "ready", "label": "Ready to talk with an agent", "points": 3 },
        { "id": "researching", "label": "Still gathering information", "points": 2 },
        { "id": "early", "label": "Just starting to think about it", "points": 1 },
        { "id": "not_ready", "label": "Not ready", "points": 0 }
      ]
    },
    {
      "id": "value_estimate",
      "prompt": "Would a no-pressure home value estimate be helpful?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "yes", "label": "Yes, please", "points": 2 },
        { "id": "later", "label": "Maybe later", "points": 1 },
        { "id": "no", "label": "No thanks", "points": 0 }
      ]
    },
    {
      "id": "reason",
      "prompt": "What would be the main reason for a move?",
      "type": "single",
      "required": false,
      "options": [
        { "id": "upsizing", "label": "Need more space", "points": 1 },
        { "id": "downsizing", "label": "Looking to downsize", "points": 1 },
        { "id": "relocate", "label": "Relocating", "points": 1 },
        { "id": "life_change", "label": "Life change / other", "points": 1 }
      ]
    },
    {
      "id": "contact_preference",
      "prompt": "How would you prefer we follow up?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "text", "label": "Text", "points": 0 },
        { "id": "call", "label": "Phone call", "points": 0 },
        { "id": "email", "label": "Email", "points": 0 },
        { "id": "none", "label": "No follow-up needed", "points": 0 }
      ]
    }
  ]'::jsonb,
  scoring_rules = '{
    "label": "Seller intent",
    "method": "sum",
    "bands": [
      { "id": "hot", "label": "Hot", "min": 12, "max": 99, "description": "Strong seller intent — reach out soon." },
      { "id": "warm", "label": "Warm", "min": 6, "max": 11, "description": "Open to learning more — good follow-up." },
      { "id": "future", "label": "Future", "min": 0, "max": 5, "description": "Not ready yet — keep on your nurture list." }
    ]
  }'::jsonb
where name = 'Seller Intent';

update public.templates
set
  description = 'A friendly check-in for people looking to buy — search stage, timeline, financing, and preferred next step.',
  intro_text = 'Hi! Just checking in — a few quick questions so we can help if you are looking for a home.',
  questions = '[
    {
      "id": "looking_to_buy",
      "prompt": "Are you currently looking to buy a home?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "actively", "label": "Yes — actively looking", "points": 4 },
        { "id": "soon", "label": "Starting to look soon", "points": 3 },
        { "id": "exploring", "label": "Just exploring options", "points": 2 },
        { "id": "no", "label": "Not right now", "points": 0 }
      ]
    },
    {
      "id": "search_stage",
      "prompt": "Where are you in your home search?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "touring", "label": "Touring homes / making offers", "points": 4 },
        { "id": "shortlist", "label": "Narrowing a shortlist", "points": 3 },
        { "id": "browsing", "label": "Browsing online", "points": 2 },
        { "id": "not_started", "label": "Have not started yet", "points": 1 }
      ]
    },
    {
      "id": "timeline",
      "prompt": "When would you like to be in a new home?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "0_3", "label": "Within 3 months", "points": 4 },
        { "id": "3_6", "label": "3–6 months", "points": 3 },
        { "id": "6_12", "label": "6–12 months", "points": 2 },
        { "id": "flexible", "label": "Flexible / no rush", "points": 1 }
      ]
    },
    {
      "id": "financing",
      "prompt": "Where are you with financing?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "preapproved", "label": "Pre-approved", "points": 3 },
        { "id": "in_progress", "label": "Working with a lender", "points": 2 },
        { "id": "cash", "label": "Planning a cash offer", "points": 3 },
        { "id": "not_yet", "label": "Not started yet", "points": 1 }
      ]
    },
    {
      "id": "next_step",
      "prompt": "What would be most helpful as a next step?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "listings", "label": "See homes that match", "points": 2 },
        { "id": "tour", "label": "Schedule a quick call", "points": 2 },
        { "id": "buyer_guide", "label": "Buyer tips / checklist", "points": 1 },
        { "id": "none", "label": "Nothing right now", "points": 0 }
      ]
    },
    {
      "id": "contact_preference",
      "prompt": "How would you prefer we follow up?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "text", "label": "Text", "points": 0 },
        { "id": "call", "label": "Phone call", "points": 0 },
        { "id": "email", "label": "Email", "points": 0 },
        { "id": "none", "label": "No follow-up needed", "points": 0 }
      ]
    }
  ]'::jsonb,
  scoring_rules = '{
    "label": "Buyer interest",
    "method": "sum",
    "bands": [
      { "id": "hot", "label": "Hot", "min": 14, "max": 99, "description": "Ready to buy — prioritize next steps." },
      { "id": "warm", "label": "Warm", "min": 7, "max": 13, "description": "Interested — stay close with helpful follow-up." },
      { "id": "future", "label": "Future", "min": 0, "max": 6, "description": "Early stage — keep on your longer-term list." }
    ]
  }'::jsonb
where name = 'Buyer Interest Check-In';
