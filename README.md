# RE Market Sense

Next.js 15 App Router app for real estate teams — auth, orgs, lists, check-in templates, scored leads, exports, and campaign status stubs.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase Auth + Database via `@supabase/ssr`
- `papaparse` (CSV) + `docx` (branded reports)

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Copy env vars and fill in your Supabase project values:

```bash
cp .env.local.example .env.local
```

3. Run SQL migrations in the Supabase SQL editor (in order):

- `supabase/migrations/001_phase1_foundation.sql`
- `supabase/migrations/002_phase2_lists_templates.sql`
- `supabase/migrations/003_phase3_responses_scoring.sql`

4. Optional: drop your official logo at `public/logo.png`, then set the Logo `src` prop (or change the default in `src/components/brand/logo.tsx`). Until then the app uses `public/logo.svg`.

5. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Phase 3 flow

1. **Lists** — Upload a CSV, validate, preview, save contacts
2. **Research** — Pair a list with a Realtor-friendly template and preview questions
3. **Deploy** — Campaign controls (stubs): Mark Ready → Launch → Pause / Resume → Complete / Stop  
   Status flow: `Draft → Ready → Sending → Paused → Completed / Stopped`  
   No real SMS/email sending yet
4. **Leads** — Hot / Warm / Future counts, scored contacts, recommended next steps  
   Export Follow Up Boss–friendly CSV or a branded DOCX report

### Seeded templates

- Buyer / Seller / Move Readiness
- Seller Intent (intent, timing, readiness, value estimate, contact preference)
- Buyer Interest Check-In (search stage, timeline, financing, next step, contact preference)

## Auth & routing

| State | Destination |
| --- | --- |
| Signed out → `/app` or `/onboarding` | `/login` |
| Signed in, no org | `/onboarding` |
| Signed in, has org → `/login` or `/signup` | `/app` |
| Successful signup (with session) | creates org + founder membership → `/onboarding` |

## Project structure

```
src/
  app/                 # Routes: /, /login, /signup, /onboarding, /app/*
  components/          # UI, lists, research, deploy, leads, app shell, brand
  lib/
    supabase/          # Browser, server, and middleware clients
    actions/           # Server actions (auth, lists, deployments, exports)
    lists/             # CSV parse / validate / dedupe
    scoring.ts         # Template answer scoring + bands
    exports/           # CSV + DOCX builders
  types/               # Database types
public/logo.svg        # Placeholder mark (swap for logo.png)
supabase/migrations/   # SQL schema + RLS + template seeds
```
