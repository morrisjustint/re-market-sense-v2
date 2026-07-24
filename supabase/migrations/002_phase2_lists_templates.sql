-- RE Market Sense – Phase 2: Lists, Contacts, Templates, Deployments

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'list_status') then
    create type public.list_status as enum ('ready', 'processing', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'consent_status') then
    create type public.consent_status as enum ('unknown', 'opted_in', 'opted_out');
  end if;
  if not exists (select 1 from pg_type where typname = 'deployment_status') then
    create type public.deployment_status as enum ('draft', 'ready', 'launched');
  end if;
end$$;

-- Lists
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  name text not null,
  source text not null default 'csv',
  contact_count integer not null default 0,
  status public.list_status not null default 'ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lists_org_id_idx on public.lists (org_id);
create index if not exists lists_created_at_idx on public.lists (created_at desc);

-- Contacts
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  consent_status public.consent_status not null default 'unknown',
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists contacts_list_id_idx on public.contacts (list_id);
create index if not exists contacts_org_id_idx on public.contacts (org_id);
create index if not exists contacts_email_idx on public.contacts (org_id, lower(email));
create index if not exists contacts_phone_idx on public.contacts (org_id, phone);

-- Templates (global, readable by all authenticated users)
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  questions jsonb not null default '[]'::jsonb,
  intro_text text not null default '',
  scoring_rules jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Deployments
create table if not exists public.deployments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  template_id uuid not null references public.templates (id) on delete restrict,
  name text not null,
  status public.deployment_status not null default 'draft',
  cost_estimate numeric(10, 2),
  created_at timestamptz not null default now(),
  launched_at timestamptz
);

create index if not exists deployments_org_id_idx on public.deployments (org_id);
create index if not exists deployments_list_id_idx on public.deployments (list_id);
create index if not exists deployments_status_idx on public.deployments (status);

-- updated_at trigger for lists
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lists_set_updated_at on public.lists;
create trigger lists_set_updated_at
  before update on public.lists
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.lists enable row level security;
alter table public.contacts enable row level security;
alter table public.templates enable row level security;
alter table public.deployments enable row level security;

-- Lists policies
drop policy if exists "Members can view org lists" on public.lists;
create policy "Members can view org lists"
  on public.lists for select to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Members can insert org lists" on public.lists;
create policy "Members can insert org lists"
  on public.lists for insert to authenticated
  with check (public.is_org_member(org_id));

drop policy if exists "Members can update org lists" on public.lists;
create policy "Members can update org lists"
  on public.lists for update to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Members can delete org lists" on public.lists;
create policy "Members can delete org lists"
  on public.lists for delete to authenticated
  using (public.is_org_member(org_id));

-- Contacts policies
drop policy if exists "Members can view org contacts" on public.contacts;
create policy "Members can view org contacts"
  on public.contacts for select to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Members can insert org contacts" on public.contacts;
create policy "Members can insert org contacts"
  on public.contacts for insert to authenticated
  with check (public.is_org_member(org_id));

drop policy if exists "Members can update org contacts" on public.contacts;
create policy "Members can update org contacts"
  on public.contacts for update to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Members can delete org contacts" on public.contacts;
create policy "Members can delete org contacts"
  on public.contacts for delete to authenticated
  using (public.is_org_member(org_id));

-- Templates: readable by all authenticated; seed managed via service/SQL
drop policy if exists "Authenticated users can view active templates" on public.templates;
create policy "Authenticated users can view active templates"
  on public.templates for select to authenticated
  using (is_active = true);

-- Deployments policies
drop policy if exists "Members can view org deployments" on public.deployments;
create policy "Members can view org deployments"
  on public.deployments for select to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Members can insert org deployments" on public.deployments;
create policy "Members can insert org deployments"
  on public.deployments for insert to authenticated
  with check (public.is_org_member(org_id));

drop policy if exists "Members can update org deployments" on public.deployments;
create policy "Members can update org deployments"
  on public.deployments for update to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Members can delete org deployments" on public.deployments;
create policy "Members can delete org deployments"
  on public.deployments for delete to authenticated
  using (public.is_org_member(org_id));

-- Seed templates (idempotent by name)
insert into public.templates (name, description, intro_text, questions, scoring_rules, is_active)
select
  'Buyer / Seller / Move Readiness',
  'A short check-in to see who may be ready to buy, sell, or move — and when.',
  'Hi! This is a quick check-in from your local real estate agent. A few short questions help us know how we can best support you.',
  '[
    {
      "id": "housing_status",
      "prompt": "Do you currently own or rent your home?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "own", "label": "I own", "points": 2 },
        { "id": "rent", "label": "I rent", "points": 1 },
        { "id": "other", "label": "Other / prefer not to say", "points": 0 }
      ]
    },
    {
      "id": "interest",
      "prompt": "Are you thinking about buying, selling, or both in the near future?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "buy", "label": "Buying", "points": 3 },
        { "id": "sell", "label": "Selling", "points": 3 },
        { "id": "both", "label": "Both", "points": 4 },
        { "id": "not_now", "label": "Not right now", "points": 0 }
      ]
    },
    {
      "id": "timing",
      "prompt": "If a move is on your radar, when might that be?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "0_3", "label": "Within 3 months", "points": 4 },
        { "id": "3_6", "label": "3–6 months", "points": 3 },
        { "id": "6_12", "label": "6–12 months", "points": 2 },
        { "id": "12_plus", "label": "12+ months / just exploring", "points": 1 }
      ]
    },
    {
      "id": "contact_method",
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
  '{
    "label": "Move readiness",
    "method": "sum",
    "bands": [
      { "id": "hot", "label": "Hot", "min": 9, "max": 99, "description": "Likely ready to move soon — prioritize follow-up." },
      { "id": "warm", "label": "Warm", "min": 5, "max": 8, "description": "Open to a conversation — stay in touch." },
      { "id": "future", "label": "Future", "min": 0, "max": 4, "description": "Longer timeline — nurture for later." }
    ]
  }'::jsonb,
  true
where not exists (
  select 1 from public.templates where name = 'Buyer / Seller / Move Readiness'
);

insert into public.templates (name, description, intro_text, questions, scoring_rules, is_active)
select
  'Seller Intent',
  'For homeowners who may be considering a move — find out who is open to a conversation.',
  'Hi! Quick question for homeowners in the area. This helps us know who might be thinking about selling and how we can help.',
  '[
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
      "required": false,
      "options": [
        { "id": "asap", "label": "As soon as possible", "points": 4 },
        { "id": "3_6", "label": "In the next 3–6 months", "points": 3 },
        { "id": "6_12", "label": "Later this year", "points": 2 },
        { "id": "unsure", "label": "Not sure yet", "points": 1 }
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
      "id": "next_step",
      "prompt": "Would a no-pressure home value check-in be helpful?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "yes", "label": "Yes, please", "points": 2 },
        { "id": "later", "label": "Maybe later", "points": 1 },
        { "id": "no", "label": "No thanks", "points": 0 }
      ]
    }
  ]'::jsonb,
  '{
    "label": "Seller intent",
    "method": "sum",
    "bands": [
      { "id": "hot", "label": "Hot", "min": 9, "max": 99, "description": "Strong seller intent — reach out soon." },
      { "id": "warm", "label": "Warm", "min": 5, "max": 8, "description": "Open to learning more — good follow-up." },
      { "id": "future", "label": "Future", "min": 0, "max": 4, "description": "Not ready yet — keep on your nurture list." }
    ]
  }'::jsonb,
  true
where not exists (
  select 1 from public.templates where name = 'Seller Intent'
);

insert into public.templates (name, description, intro_text, questions, scoring_rules, is_active)
select
  'Buyer Interest Check-In',
  'A friendly check-in to find who is looking to buy and what they need next.',
  'Hi! Just checking in — a few quick questions so we can help if you are looking for a home.',
  '[
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
      "id": "preapproved",
      "prompt": "Have you spoken with a lender or been pre-approved?",
      "type": "single",
      "required": false,
      "options": [
        { "id": "yes", "label": "Yes, pre-approved", "points": 3 },
        { "id": "in_progress", "label": "Working on it", "points": 2 },
        { "id": "not_yet", "label": "Not yet", "points": 1 },
        { "id": "cash", "label": "Planning a cash offer", "points": 3 }
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
      "id": "help_needed",
      "prompt": "What would be most helpful as a next step?",
      "type": "single",
      "required": true,
      "options": [
        { "id": "listings", "label": "See homes that match", "points": 2 },
        { "id": "tour", "label": "Schedule a quick call", "points": 2 },
        { "id": "buyer_guide", "label": "Buyer tips / checklist", "points": 1 },
        { "id": "none", "label": "Nothing right now", "points": 0 }
      ]
    }
  ]'::jsonb,
  '{
    "label": "Buyer interest",
    "method": "sum",
    "bands": [
      { "id": "hot", "label": "Hot", "min": 10, "max": 99, "description": "Ready to buy — prioritize next steps." },
      { "id": "warm", "label": "Warm", "min": 5, "max": 9, "description": "Interested — stay close with helpful follow-up." },
      { "id": "future", "label": "Future", "min": 0, "max": 4, "description": "Early stage — keep on your longer-term list." }
    ]
  }'::jsonb,
  true
where not exists (
  select 1 from public.templates where name = 'Buyer Interest Check-In'
);
