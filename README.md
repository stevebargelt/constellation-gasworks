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
supabase db push

# Run web app
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

```bash
# Push migrations to production
supabase db push

# Web deploys automatically via GitHub Actions on merge to main
# Mobile builds via EAS Build on merge to main
```

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
