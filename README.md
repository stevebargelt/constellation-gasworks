# Constellation

A unified coordination platform for polyamorous and ethically non-monogamous relationships — calendar, tasks, recipes, and meal planning in one place, built from the ground up for complex relationship structures.

## What it does

Constellation replaces the 3–5 apps people in polyamorous relationships use to coordinate their lives. The core problem it solves: **calendar-blind coordination** — scheduling a date night without knowing your partner already has plans, or planning a group dinner without realizing half the polycule is traveling.

Key concepts:
- **Constellation** — your personal view of your full relationship network, derived from the relationship graph
- **Polycule** — a tightly-knit cluster within your constellation, auto-detected from graph topology
- **Relationships** — explicit, mutual connections (partner, nesting partner, metamour, roommate, family, custom)
- **Permissions** — Full / Free-Busy / None, set per-person per-resource, unilaterally controlled

## Stack

| Layer | Technology |
|---|---|
| Web | React + Vite + Tailwind CSS |
| Mobile | Expo (managed) + React Native + Expo Router |
| Backend | Supabase (PostgreSQL + Realtime + Auth) |
| Monorepo | Turborepo + pnpm workspaces |
| CI/CD | GitHub Actions → Vercel (web) + EAS Build (mobile) |

## Monorepo structure

```
constellation/
├── apps/
│   ├── web/          # React + Vite SPA
│   └── mobile/       # Expo React Native app
├── packages/
│   ├── types/        # Supabase-generated TypeScript types
│   ├── api/          # Typed Supabase query functions
│   ├── hooks/        # Shared React/RN business logic hooks
│   ├── utils/        # Pure utilities (conflict detection, graph clustering, etc.)
│   └── theme/        # Shared design tokens (colors, typography, spacing)
└── supabase/
    ├── migrations/   # SQL migration files
    └── seed.sql
```

## Local development

### Prerequisites

- Node.js 20+
- pnpm
- Docker (for local Supabase)
- Supabase CLI (`npm install -g supabase`)

### Setup

```bash
# Install dependencies
pnpm install

# Start local Supabase stack (Postgres + Auth + Realtime)
supabase start

# Copy local env (values from `supabase status`)
cp .env.local.example .env.local

# Apply migrations to local database
supabase db reset

# Run all apps and packages in dev mode (recommended)
pnpm dev

# Or run web only (from repo root)
pnpm --filter web dev

# Run mobile app
pnpm --filter mobile start
```

### Environment variables

`.env.local` — local Supabase CLI (never committed). Copy from `.env.local.example` and fill in the values from `supabase status`:
```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<from supabase status>
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<from supabase status>
```

`.env.production` — production Supabase project (never committed):
```
VITE_SUPABASE_URL=<your project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_xxx>
EXPO_PUBLIC_SUPABASE_URL=<your project URL>
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_xxx>
```

## Deploying

### Database migrations

```bash
# Apply migrations to local instance
supabase db reset

# Apply migrations to production
supabase db push
```

### Web — Vercel

The web app (`apps/web`) deploys automatically to Vercel on every push to `main`.

**Initial Vercel setup:**

1. Import the repo in Vercel. Set the **Root Directory** to `apps/web` and the **Framework Preset** to `Vite`.
2. Under **Settings → Environment Variables**, add the following for the `Production` environment:

   | Variable | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Your publishable key (`sb_publishable_xxx` from the Supabase dashboard) |

3. Trigger a redeploy after setting the variables.

**Build settings** (Vercel auto-detects these from `apps/web`, but verify):
- Build command: `vite build`
- Output directory: `dist`
- Install command: `pnpm install`

> The web app reads `VITE_*` vars at build time via Vite's env injection. Variables added after the initial deploy require a manual redeploy to take effect.

### Mobile — EAS Build

Mobile builds are handled by Expo Application Services (EAS). See `apps/mobile/eas.json` for build profile configuration.

## Architecture

See [`docs/architecture/co-wisp-jk2.md`](docs/architecture/co-wisp-jk2.md) for the full architecture document including:
- Data model (ER diagram)
- RLS policy design and `get_permission()` function
- Real-time sync architecture
- Graph rendering approach (web + mobile)
- Auth flow design

## Product

See [`docs/prds/constellation-app.md`](docs/prds/constellation-app.md) for the full PRD including permission model spec, user scenarios, and feature specifications.

## Security

All data access is gated by Row-Level Security policies enforced at the Supabase/PostgREST layer. The `get_permission()` SQL function is the security boundary for all privacy guarantees — it resolves Full / Free-Busy / None between any two users for any resource type. Privacy bugs here are P0.

CI includes a scanner that fails the build if any code in `packages/api/` or `apps/` queries sensitive tables (e.g. `calendar_events`) directly, bypassing the RLS views.
