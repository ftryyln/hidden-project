# Guild Manager Backend & Client Starter

This repository ships a Supabase-first backend for managing multi-guild operations (members, transactions, loot) plus a minimal Next.js client to exercise the main flows.

## Prerequisites
- [Supabase CLI](https://supabase.com/docs/guides/cli) `npm i -g supabase`
- Node.js 18+ for the Next.js example
- Deno (bundled with Supabase Edge functions tooling)

## Local Supabase Stack
```bash
# 1. Initialise (once)
supabase init

# 2. Start local services
supabase start

# 3. Apply schema, RLS policies, and seed data
supabase db reset

# 4. Serve Edge Functions locally (hot reload)
supabase functions serve distribute_loot
supabase functions serve confirm_transaction --env-file supabase/.env
supabase functions serve export_csv
```

The migration `supabase/migrations/000_init.sql` creates:
- All enums, tables, triggers, materialised helpers, RLS policies, and seed content (including bucket seed).
- Tight RLS that scopes access to guild membership via `guild_user_roles`.
- Three Edge Functions backed by service-role auth and explicit role checks.

## Deploying to Supabase
```bash
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
supabase functions deploy distribute_loot
supabase functions deploy confirm_transaction
supabase functions deploy export_csv
```

## Storage
- Private bucket `evidence` declared in `supabase/storage-buckets.json`
- SQL helper `get_evidence_url(path, expires)` returns a presigned URL

## Environment Variables
Create `web/.env.local` (see `web/.env.example`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
```

If you expose additional environment variables (e.g. Supabase service keys) place them in `supabase/.env` for Edge functions and load via `--env-file`.

## Node.js REST API (`api/`)
An Express + TypeScript REST layer now mirrors the Supabase flows consumed by the dashboard. It authenticates requests with Supabase access tokens and proxies all data operations through the service-role client.

### Configure
Create `api/.env` with your Supabase credentials:
```bash
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
PORT=8080 # optional
API_PREFIX=/api/v1 # optional
```

### Run locally
```bash
cd api
npm install
npm run dev
```

### Available endpoints
- `GET  /api/v1/health`
- `GET  /api/v1/auth/me`
- `GET  /api/v1/guilds`
- `GET  /api/v1/dashboard?guildId=<uuid>`
- `GET  /api/v1/guilds/:guildId/members`
- `POST /api/v1/guilds/:guildId/members`
- `PUT  /api/v1/guilds/:guildId/members/:memberId`
- `PATCH /api/v1/guilds/:guildId/members/:memberId/status`
- `GET  /api/v1/guilds/:guildId/transactions`
- `POST /api/v1/guilds/:guildId/transactions`
- `POST /api/v1/guilds/:guildId/transactions/:transactionId/confirm`
- `GET  /api/v1/guilds/:guildId/loot`
- `POST /api/v1/guilds/:guildId/loot`
- `POST /api/v1/guilds/:guildId/loot/:lootId/distribute`
- `GET  /api/v1/guilds/:guildId/reports`
- `POST /api/v1/guilds/:guildId/reports/export`

All routes require a Supabase access token via `Authorization: Bearer <token>`. Role checks are enforced to match the original Edge Functions.

## Next.js Dashboard (`web/`)
```bash
cd web
npm install
npm run dev
```

Key tech: Next.js 15 App Router, Tailwind + shadcn/ui, TanStack Query, axios, react-hook-form, zod, recharts.

Routes:
- `/login` – email/password auth (token stored via axios interceptor)
- `/dashboard` – KPI cards, latest activity, monthly revenue chart
- `/guilds/[gid]/members` – roster table with create/edit modal & active filters
- `/guilds/[gid]/transactions` – transaction drafting, filters, confirm flow, evidence links
- `/guilds/[gid]/loot` – loot ledger + distribute drawer with share validation
- `/guilds/[gid]/reports` – period filters, totals, chart, CSV export

Providers live in `web/lib` (`api.ts`, `query.ts`, `format.ts`), UI primitives under `web/components/ui`, forms under `web/components/forms`, and charts within `web/components/charts`.

## Recommended Workflow
- Start local stack (`supabase start`)
- Reset DB when schema changes (`supabase db reset`)
- Run Edge functions in watch mode (`supabase functions serve <function>`)
- Develop the Next.js dashboard alongside (`npm run dev` in `web`)

## Testing Access Controls
- Use the seeded admin: `admin@valhalla.gg` / `Valhalla!23`
- Create additional users via Supabase Auth UI or CLI for role permutations

## Project Layout
- `supabase/migrations/000_init.sql`: schema + RLS + seed
- `supabase/functions/*`: Edge functions (TypeScript/Deno)
- `supabase/storage-buckets.json`: storage configuration
- `web/`: Guild Manager dashboard (Next.js App Router)
