# PRD: Azure Native Backend Stack (Replace Supabase)

**Bead**: ec-m9r0wf
**Status**: Draft
**Created**: 2026-04-10
**PM**: constellation/pm

## Problem Statement

The Constellation app is built on Supabase's free tier, which imposes hard constraints that make it unsuitable for a production application:

- **500 MB database limit** — insufficient for real user data at any meaningful scale
- **7-day inactivity pause** — projects go dormant; live users hit cold starts
- **No backups on free tier** — user data at risk with no recovery path
- **2 project limit** — blocks proper dev/staging/prod environment separation

Upgrading to Supabase Pro costs $25/month per project ($75+/month for 3 environments). We already have $150/month in Azure credits. Migrating to Azure-native services eliminates the free tier risk, reduces vendor concentration, and operates within existing budget.

## Background & Context

- **Why now**: The app is pre-launch but the free tier constraints are already a blocker for proper environment setup. Better to migrate before user data accumulates.
- **Driver**: Marcus (crew) identified and analyzed this; full brief is in ec-m9r0wf
- **Current state**: All backend services run through Supabase (DB, Auth, Storage, Realtime). The app has a single environment, no staging, no backups.
- **Desired state**: Azure-native stack with dev + prod environments, automatic backups, no inactivity pausing, and realtime functionality preserved

## Goals & Success Metrics

**Goals**:
- Eliminate Supabase free tier constraints (pausing, limits, no backups)
- Operate within the $150/month Azure credit budget
- Preserve all existing functionality including realtime subscriptions
- Establish proper dev + prod environment separation

**Success Metrics**:
- Monthly Azure spend ≤ $80/month (leaves headroom for Azure OpenAI and scale)
- Zero database pauses after migration
- All 5 realtime hook subscriptions functional post-migration
- Dev and prod environments independently deployable

## Solution Overview

Replace Supabase with an Azure-native stack:

| Component | Azure Service | Replaces |
|---|---|---|
| Database | Azure Database for PostgreSQL Flexible Server (Burstable B2s) | Supabase DB |
| Authentication | Azure AD B2C | Supabase Auth |
| File storage | Azure Blob Storage | Supabase Storage |
| Realtime | Custom realtime bridge on Azure Container Apps | Supabase Realtime |
| Frontend hosting | Keep Vercel (no change) | — |
| REST/API layer | Existing Next.js/tRPC API routes | PostgREST |
| IaC | Terraform | — |
| Secrets | Azure Key Vault | Supabase env vars |

**Frontend hosting stays on Vercel.** The `vercel.json` is already configured and switching adds scope with no immediate benefit. This can be evaluated separately.

**Realtime requires a custom bridge** (see Research Findings below).

## User Stories / Use Cases

- As a **Constellation user**, I want **my task lists, calendar, and living space data to update in real time** so that **I see changes from my partners immediately without refreshing**
- As a **Constellation user**, I want **to sign in with email/password or Google** so that **I can access the app on web and mobile**
- As a **developer**, I want **separate dev and prod environments** so that **I can test changes without risking production data**
- As a **developer**, I want **automatic database backups** so that **user data is recoverable after any incident**

## Research Findings

### Realtime: Supabase Realtime is Not Replaceable with SignalR Directly

Supabase Realtime works by subscribing to PostgreSQL WAL changes (via logical replication / `pg_publication`) and streaming them to clients over WebSocket. The app uses this extensively:

- `useTaskLists` — subscribes to `tasks`, `task_lists`, `task_list_members`
- `useLivingSpaces` + `useLivingSpaceMembers` — living space and membership changes
- `useCalendarOverlay` — calendar event changes per-user
- `useShoppingList` — shopping list item changes

Azure SignalR Service is a managed WebSocket hub, but it does not natively bridge PostgreSQL changes — it only relays messages that application code sends to it. Using SignalR would still require custom server logic to subscribe to PG LISTEN/NOTIFY and forward to SignalR.

**Recommended approach**: A lightweight **Node.js realtime bridge** deployed on **Azure Container Apps** (consumption plan). This service:
1. Connects to PostgreSQL via `pg` and subscribes to `LISTEN/NOTIFY` triggers
2. Exposes WebSocket connections to clients
3. Fans out change notifications to subscribed clients with RLS-aware filtering

This approach costs ~$5–15/month on Container Apps consumption plan, requires no new vendor, and keeps us in control of the realtime logic.

**Alternative**: Azure SignalR Service (~$50/month) if the Container Apps approach proves too operationally complex. The client hooks would still need to be rewritten either way.

### Auth: B2C Covers Required Flows but Requires UI Work

Azure AD B2C supports email/password and Google OAuth (the two flows currently used). The current `useAuth` hook uses:
- `supabase.auth.signUp` / `signInWithPassword` — maps to B2C local account flows
- `supabase.auth.signInWithOAuth({ provider: "google" })` — maps to B2C social identity provider
- `supabase.auth.onAuthStateChange` — maps to MSAL token refresh events
- `supabase.auth.getUser()` called from 4+ hooks to get current user ID for RLS

B2C's hosted auth UI pages require custom branding effort to match the app's design. The MSAL SDK replaces the Supabase Auth SDK in `useAuth.ts` and anywhere `supabase.auth.getUser()` is called.

**Note**: The Supabase client currently manages both auth *and* data access (the `supabase` singleton is used for both). After migration, auth (MSAL) and data access (pg/drizzle/custom client) will be separate concerns — the `packages/api` package will need restructuring.

### IaC: Terraform Recommended

Terraform over Bicep: we may want to run dev environments in non-Azure providers or migrate cloud resources in the future. Terraform's cloud-agnostic provider ecosystem makes this feasible. Azure-specific Terraform providers are mature and well-documented.

### Environments: Dev + Prod

Start with dev and prod. Staging (~$25/month more) can be added when needed. Each environment gets its own PostgreSQL instance, B2C tenant, Blob Storage account, and Container Apps deployment.

## Work Breakdown

### Phase 1: Infrastructure

- [ ] Write Terraform modules for: PostgreSQL Flexible Server, Azure AD B2C tenant, Blob Storage account, Container Apps environment, Key Vault
- [ ] Provision dev environment via Terraform
- [ ] Configure Azure Key Vault with all secrets (DB connection strings, B2C app registrations, storage account keys)
- [ ] Set up PostgreSQL with same schema as Supabase (port all 9 migration files to run against Azure PostgreSQL)
- [ ] Configure Row-Level Security policies on Azure PostgreSQL (port `rls_policies.sql`, `rls_views.sql`, and subsequent RLS hardening migrations)
- [ ] Set up database backup policy on PostgreSQL Flexible Server

### Phase 2: Authentication Migration

- [ ] Configure Azure AD B2C tenant: local account (email/password) user flow, Google social identity provider
- [ ] Register web app and mobile app as B2C application registrations
- [ ] Replace `@supabase/supabase-js` auth calls in `packages/hooks/src/useAuth.ts` with MSAL (`@azure/msal-react` for web, `react-native-msal` for mobile)
- [ ] Replace all `supabase.auth.getUser()` calls in hooks with MSAL account lookup (affects `useLivingSpaceMembers`, `useTaskLists`, `useShoppingList`, `useTasks`)
- [ ] Update `packages/api/src/client.ts` to inject auth token into data queries (JWT claim → Postgres `app.current_user_id` setting for RLS)
- [ ] Test email/password and Google OAuth flows on web and mobile

### Phase 3: Data Access Migration

- [ ] Remove `@supabase/supabase-js` dependency from `packages/api`
- [ ] Replace Supabase query calls in `packages/api/src/*.ts` with a direct PostgreSQL client (pg + typed queries, or Drizzle ORM)
- [ ] Update all API functions: `users.ts`, `relationships.ts`, `livingspaces.ts`, `tasks.ts`, `calendar.ts`, `mealplans.ts`, `recipes.ts`, `userColors.ts`
- [ ] Verify RLS enforcement with new auth token injection mechanism

### Phase 4: Realtime Bridge

- [ ] Add PostgreSQL TRIGGER + NOTIFY functions for all tables currently using Supabase Realtime publication (`tasks`, `task_lists`, `task_list_members`, `living_spaces`, `living_space_members`, `calendar_events`, `shopping_list_items`)
- [ ] Build Node.js realtime bridge service: pg LISTEN/NOTIFY → WebSocket fan-out with JWT auth middleware
- [ ] Deploy realtime bridge to Azure Container Apps
- [ ] Replace `supabase.channel().on().subscribe()` calls in all 5 hooks with new WebSocket client
- [ ] Write integration tests for realtime event delivery

### Phase 5: Storage Migration

- [ ] Configure Azure Blob Storage container with appropriate access policies
- [ ] Replace Supabase Storage SDK calls with Azure Blob Storage SDK (`@azure/storage-blob`)
- [ ] Migrate any existing stored files from Supabase Storage to Blob Storage

### Phase 6: CI/CD and Environment Finalization

- [ ] Update GitHub Actions workflows for Vercel web deploy to inject Azure env vars (B2C authority, DB URL, etc.)
- [ ] Update Expo/EAS build config to inject Azure env vars for mobile
- [ ] Provision prod environment via Terraform
- [ ] Migrate production data from Supabase PostgreSQL to Azure PostgreSQL (pg_dump / pg_restore)
- [ ] Smoke test all features in prod
- [ ] Decommission Supabase project

## Acceptance Criteria

- [ ] Web app and mobile app authenticate via Azure AD B2C (email/password and Google OAuth both working)
- [ ] All 9 Supabase migrations equivalent schema is present in Azure PostgreSQL
- [ ] Row-level security enforced: users can only read/write their own data
- [ ] All 5 realtime hooks (`useTaskLists`, `useLivingSpaces`, `useLivingSpaceMembers`, `useCalendarOverlay`, `useShoppingList`) deliver live updates within 2 seconds of a database change
- [ ] File upload/download works via Azure Blob Storage
- [ ] Dev and prod environments are independently deployable via Terraform
- [ ] Azure spend ≤ $80/month across both environments (verified via Azure Cost Management)
- [ ] Supabase project can be safely decommissioned (no traffic, no data dependency)

## Open Questions / Decisions Needed

- **Q**: Realtime bridge: Container Apps (custom Node.js) or Azure SignalR?
  - **Option A**: Custom Node.js bridge on Azure Container Apps (~$5–15/month). More control, no new vendor, requires building and maintaining the service.
  - **Option B**: Azure SignalR Service (~$50/month). Managed infrastructure, but still requires custom server logic to bridge PG → SignalR. Higher cost.
  - **Recommendation**: Container Apps (Option A). Lower cost, fits our stack, avoids another vendor.

- **Q**: Drizzle ORM vs raw `pg` for data access layer?
  - **Option A**: Drizzle ORM — type-safe queries, schema as code, migration tooling
  - **Option B**: Raw `pg` with typed query functions — minimal dependency, full SQL control
  - **Recommendation**: Drizzle ORM. The app already has typed schema patterns from Supabase; Drizzle gives us the same ergonomics with a clean migration path.

- **Q**: Should we migrate Supabase Auth users to Azure AD B2C, or require all users to re-register?
  - Pre-launch with no production users: require re-registration (no migration needed)
  - If production users exist at migration time: B2C supports bulk user import via Graph API
  - **Recommendation**: Confirm whether any real user accounts exist before migration. If pre-launch, re-register.

- **Q**: HIPAA compliance tier needed?
  - General Purpose PostgreSQL tier (~$100/month) required for HIPAA BAA
  - Burstable B2s (~$25/month) is sufficient for standard production use without HIPAA
  - **Recommendation**: Start with Burstable B2s. Upgrade if compliance is required.

## Out of Scope

- Migrating frontend hosting from Vercel to Azure Static Web Apps (separate decision)
- Adding Apple OAuth (not currently implemented; add post-migration)
- Azure OpenAI integration (separate feature track)
- Staging environment (defer; add when dev/prod pattern is validated)
- Monitoring / Application Insights setup beyond basic alerting (can be added post-migration)

## Risks & Considerations

- **Realtime bridge complexity**: Building a custom PG LISTEN/NOTIFY → WebSocket service is non-trivial. If it blocks delivery, Azure SignalR is the fallback at higher cost.
- **Auth token injection for RLS**: Supabase automatically sets `auth.uid()` for RLS. With Azure B2C JWTs, we must explicitly set a Postgres session variable (e.g., `SET app.current_user_id = '...'`) on each connection or use a connection pool that handles this. This is the highest-risk part of the data access migration.
- **Migration data integrity**: `pg_dump` / `pg_restore` from Supabase to Azure PostgreSQL requires the Supabase extensions (e.g., `uuid-ossp`, `pgcrypto`) to be available on Azure PostgreSQL — they are, but must be enabled explicitly.
- **Expo/mobile auth**: `expo-auth-session` currently handles Supabase OAuth flows. Replacing with `react-native-msal` or `expo-auth-session` + B2C authority URLs requires testing on both iOS and Android.
- **Dependency**: All phases depend on Phase 1 (infrastructure) completing first. Phases 2–4 can be parallelized after Phase 1.
