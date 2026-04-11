# PRD: Self-Hosted Supabase on Azure

**Bead**: co-kkd
**Status**: Draft
**Created**: 2026-04-10
**PM**: constellation/pm

## Problem Statement

Supabase Cloud's free tier pauses projects after 7 days of inactivity, caps storage at 500 MB, and provides no backups. This makes it unsuitable for production use without upgrading to Pro — which costs $25/month (org) plus ~$10/month per compute instance. Running even a modest dev/staging/prod separation for Constellation alone approaches $55–80/month, before accounting for any prototype projects.

We have $150/month in Azure credits we're not fully using. The same open-source Supabase stack that runs at supabase.com can run on a single Azure VM at ~$44–80/month from credits, with **zero out-of-pocket cost** and **zero code changes** to any application.

## Background & Context

- **Why now**: Constellation is pre-launch but the free tier is already a risk (pausing, no backups). Infrastructure should be solid before real users arrive.
- **Driver**: maggie identified and analyzed this; full brief at `docs/briefs/azure-backend-stack.md`
- **Current state**: Constellation points at Supabase Cloud free tier. One environment, no backups, subject to 7-day pause.
- **Desired state**: Supabase running on a VM we control. No pausing. Backups. Multiple independent project instances. Same SDK, same auth, same realtime, same RLS — application code untouched.
- **What is explicitly NOT changing**: `@supabase/supabase-js` SDK, Supabase Auth, Realtime, Storage, RLS policies, migration workflow. The only change Constellation sees is a new URL and new keys in `.env.local` and Vercel.

## Goals & Success Metrics

**Goals**:
- Eliminate Supabase Cloud free tier constraints (pausing, storage limits, no backups) at zero additional cost
- Enable unlimited prototype projects at fixed monthly cost
- Establish automated daily backups for Constellation with configurable retention
- Complete Constellation migration with no code changes and no user-facing disruption

**Success Metrics**:
- Total Azure spend ≤ $80/month (within credits)
- Zero database pauses after migration (VM runs continuously)
- Daily backup job runs successfully for all active projects
- Constellation migration completed: URL/keys updated, `supabase db push` applied, app functional

## Solution Overview

Run self-hosted Supabase on a single Azure VM (B2ms, 2 vCPU / 8 GB RAM) provisioned via OpenTofu. Multiple independent Supabase deployments run as Docker Compose projects on the same VM, each with its own subdomain routed through Caddy. Automated daily `pg_dump` backups upload to Azure Blob Storage.

Constellation migration is a one-day task: update URL + keys, push schema, verify. No application code changes.

## User Stories / Use Cases

- As a **developer**, I want **Supabase to never pause** so that **users don't hit cold starts on a live app**
- As a **developer**, I want **daily automated backups of Constellation's database** so that **user data is recoverable after any incident**
- As a **developer**, I want **to spin up a new prototype project in minutes** so that **I can experiment freely without worrying about per-project SaaS costs**
- As a **developer**, I want **Constellation staging to be available** so that **I can verify changes before they reach production users**

## Decisions

The brief surfaced four open questions. Recommendations and rationale:

### 1. VM Size: B2ms (~$44/month) or B4ms (~$80/month)?

**Decision: B2ms to start.**

B2ms (2 vCPU, 8 GB RAM) comfortably handles 3–5 Supabase projects. Constellation + 2–3 prototypes fits well within this. Azure B-series VMs support online resize — if the VM approaches capacity, resizing to B4ms takes minutes with no data loss. Starting at B2ms leaves ~$100/month in credits for Azure OpenAI and other services. Revisit when running 4+ active projects simultaneously.

### 2. Cutover Sequence: Prototype-first or direct Constellation migration?

**Decision: Migrate Constellation directly as the first project on the VM.**

Constellation is pre-launch with no real users and no real user data. Downtime during cutover is acceptable. Migrate Constellation directly — it validates the full stack (VM, Caddy, DNS, Docker Compose, backups) and gets the platform live immediately. Subsequent prototype projects slot in using the same pattern.

### 3. Staging environment: VM instance or local Supabase CLI?

**Decision: Local Supabase CLI for now; add VM staging instance when Constellation has real users.**

Adding a Constellation staging instance to the VM costs ~$0 (another Docker Compose project) but adds management overhead before it's needed. Local Supabase CLI (`supabase start`) is sufficient for pre-production testing today. Add a proper staging instance on the VM when Constellation has real users and schema migrations need to be validated against production-scale data.

### 4. Backup retention: how many days?

**Decision: 7 days for prototypes, 30 days for Constellation production.**

- **Prototype projects**: 7-day rolling retention. Prototypes have no real user data; 7 days is enough to recover from an accidental drop.
- **Constellation production**: 30-day rolling retention. Covers billing cycles, user disputes, and most incident recovery scenarios. At ~1 GB/day, 30 days ≈ 30 GB = ~$0.60/month in Blob Storage. Negligible cost.
- **Implementation**: Azure Blob Storage lifecycle rules auto-expire backups after the retention period. No manual cleanup needed.

## Work Breakdown

### Phase 1: Infrastructure (OpenTofu)

- [ ] Write OpenTofu modules: Azure VM (B2ms), managed disk (64 GB SSD), static IP, DNS zone
- [ ] Write OpenTofu module: Azure Blob Storage account for backup archives
- [ ] Provision VM + supporting resources via `tofu apply`
- [ ] Configure DNS A records pointing `*.db.harebrained-apps.com` to the VM's static IP

### Phase 2: VM Setup

- [ ] Install Docker and Docker Compose on VM
- [ ] Deploy Caddy reverse proxy with wildcard subdomain routing config
- [ ] Verify Caddy automatic HTTPS via Let's Encrypt for `*.db.harebrained-apps.com`
- [ ] Document the per-project Docker Compose template (ports, env vars, volume layout)

### Phase 3: Backup Automation

- [ ] Write backup script: `pg_dump` per project → gzip → upload to Blob Storage
- [ ] Configure as a daily cron job on the VM (systemd timer or crontab)
- [ ] Configure Blob Storage lifecycle rules: 7-day retention for prototypes, 30-day for Constellation
- [ ] Test restore procedure from a backup dump

### Phase 4: Constellation Migration

- [ ] Stand up `supabase-constellation` instance on the VM (`constellation.db.harebrained-apps.com`)
- [ ] Apply all migrations from `supabase/migrations/` via `supabase db push`
- [ ] Add `constellation.db.harebrained-apps.com` to Google Cloud Console OAuth redirect URIs
- [ ] Update Vercel environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] Update mobile env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- [ ] Update `.env.local` and `.env.local.example` in repo
- [ ] Smoke test: auth (email/password + Google OAuth), realtime, storage, all RLS-protected queries
- [ ] Verify all realtime hooks deliver live updates (`useCalendar`, `useCalendarOverlay`, `useRelationships`, `useLivingSpaces`, `useTaskLists`, `useTasks`, `useShoppingList`)
- [ ] Confirm backup job is running for the Constellation instance
- [ ] Cancel Supabase Cloud subscription

### Phase 5: Documentation

- [ ] Document: how to add a new project to the VM (copy template, pick port range, `docker compose up`)
- [ ] Document: Supabase version upgrade procedure (`docker compose pull && up -d`)
- [ ] Document: backup restore procedure

## Acceptance Criteria

- [ ] VM provisioned via OpenTofu; `tofu apply` from scratch produces a working environment
- [ ] Caddy routes `constellation.db.harebrained-apps.com` → Constellation's Supabase instance with valid HTTPS
- [ ] Supabase Studio accessible and functional on self-hosted instance
- [ ] All 9 Constellation migrations apply cleanly via `supabase db push`
- [ ] Email/password and Google OAuth authentication work on web and mobile
- [ ] All realtime channel subscriptions deliver updates within 2 seconds of a DB change
- [ ] Daily backup cron job runs and uploads to Blob Storage
- [ ] Restore test: a backup dump can be restored to a clean Postgres instance
- [ ] Vercel deployment uses new URL/keys; no Supabase Cloud dependency remains
- [ ] Azure spend ≤ $80/month (verified via Azure Cost Management)

## Out of Scope

- Any changes to `@supabase/supabase-js` usage in the app
- Any changes to auth flows, RLS policies, or migration files
- Azure AD B2C, Azure SignalR, Azure Functions — not part of this approach
- Supabase High Availability / read replicas (single VM is acceptable for this stage)
- Monitoring / alerting beyond basic Azure VM CPU/disk alerts

## Risks & Considerations

- **Single VM failure domain**: Azure B-series VM SLA is ~99.9% (~8.7 hours downtime/year). Acceptable for prototypes and pre-scale production. Add a backup/replica strategy when Constellation has paying users.
- **Supabase self-hosting complexity**: Official Docker Compose config is well-maintained but requires periodic upgrades. Upgrade procedure must be documented and tested (Phase 6).
- **DNS propagation during cutover**: Update Vercel env vars first, then switch DNS last to minimize downtime window.
- **Google OAuth redirect URIs**: Adding the new self-hosted domain to Google Cloud Console OAuth credentials required before Constellation cutover.
- **VM disk growth**: Postgres data + Docker images + backup staging. Monitor disk usage; 64 GB SSD should last well through early stage. Alert at 80% capacity.
