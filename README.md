# RE Market Sense

Next.js 15 App Router app for real estate teams — auth, orgs, lists, check-in templates, scored leads, exports, and consent-gated email campaigns (SendGrid).

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
- `supabase/migrations/004_phase4_consent_email.sql`
- `supabase/migrations/005_phase4_response_invites.sql`
- `supabase/migrations/006_phase4_incentives.sql`

4. Optional: drop your official logo at `public/logo.png`, then set the Logo `src` prop (or change the default in `src/components/brand/logo.tsx`). Until then the app uses `public/logo.svg`.

5. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `NEXT_PUBLIC_APP_URL` | For email links | Public base URL for `/respond/[token]` links |
| `SENDGRID_API_KEY` | For email sending | SendGrid API key |
| `SENDGRID_FROM_EMAIL` | For email sending | Verified branded sender address |
| `SENDGRID_FROM_NAME` | Optional | Sender display name (defaults to "RE Market Sense") |
| `TREMENDOUS_API_KEY` | Optional | Tremendous API key (gift cards stay queued until live) |
| `TREMENDOUS_CAMPAIGN_ID` | Optional | Tremendous campaign / product id for later fulfillment |

Without the SendGrid variables the app still runs; launching a campaign records
status and logs each send as `skipped` until keys are added. Thank-you gift
email wording lives in `src/lib/incentives/config.ts`.

## Phase 4.2 flow

1. **Lists** — Upload a CSV, validate, preview, save contacts
2. **Research** — Pair a list with a Realtor-friendly template and preview questions
3. **Deploy** — Consent-gated email campaigns
   - Required consent attestation before launch
   - Optional **$5 thank-you gift** on completion (cost shown clearly; locked after launch)
   - **Launch** creates a unique `/respond/[token]` invite per contact and emails a branded CTA
   - Pause / Resume / Stop remain available; resume skips contacts already emailed
4. **Public check-in** — Recipient opens the link (no login), answers questions, submits
5. **Leads** — Answers are scored Hot / Warm / Future immediately and appear on the dashboard
6. **Gift queue** — When gifts are enabled, each completion creates an `incentive_rewards` row (`pending`) for Tremendous fulfillment later

Invalid, expired, or already-used tokens show a friendly public message and never expose other contacts.

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
  app/                 # Routes: /, /login, /signup, /onboarding, /respond/[token], /app/*
  components/          # UI, lists, research, deploy, leads, respond, app shell, brand
  lib/
    supabase/          # Browser, server, and middleware clients
    actions/           # Server actions (auth, lists, deployments, check-in, exports)
    email/             # SendGrid + branded check-in email content
    checkin/           # Public token load + submit helpers
    lists/             # CSV parse / validate / dedupe
    scoring.ts         # Template answer scoring + bands
    exports/           # CSV + DOCX builders
  types/               # Database types
public/logo.svg        # Placeholder mark (swap for logo.png)
supabase/migrations/   # SQL schema + RLS + template seeds
```
