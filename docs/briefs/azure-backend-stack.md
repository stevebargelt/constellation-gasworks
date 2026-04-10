# Feature Brief: Self-Hosted Supabase on Azure

**Date**: 2026-04-10
**Author**: maggie (crew)
**Priority**: High
**Rig**: constellation

---

## What This Is (and Is Not)

> **This is NOT a migration to Azure services.** No Azure AD, no Azure SignalR, no Azure Functions, no PostgREST replacement. The Supabase SDK, auth, realtime, RLS, and storage all stay exactly as they are today.
>
> **This IS running the open-source Supabase stack on an Azure VM** we already have credits for, instead of paying Supabase Cloud per-project fees. Azure provides the box. Supabase runs inside it.

---

## Problem

Supabase Cloud's free tier pauses projects after 7 days of inactivity, caps storage at 500 MB, and provides no backups. Upgrading to Pro costs $25/month for the organization plus ~$10/month per project in compute. Prototyping 5–10 ideas simultaneously quickly approaches $100+/month — before any of them generate revenue.

---

## Proposed Solution

Run **self-hosted Supabase on a single Azure VM**, funded entirely by the existing $150/month Azure credit budget.

Supabase is fully open source. The same stack that runs at supabase.com — PostgreSQL, GoTrue (auth), PostgREST, Realtime, Storage, Studio — runs on any Linux VM via Docker Compose. The `@supabase/supabase-js` SDK is endpoint-agnostic: change the URL from `*.supabase.co` to the VM's address and everything works identically. No code changes. No new vendors. No new SDKs.

---

## What Stays the Same

Everything application-facing is unchanged:

- `@supabase/supabase-js` SDK (web + mobile)
- Supabase Auth — email/password, Google OAuth, Apple OAuth
- Supabase Realtime — all existing channel subscriptions work as-is
- Supabase Storage
- RLS policies and `get_permission()` function
- `supabase/migrations/` workflow
- Supabase Studio dashboard (self-hosted)

**Constellation requires zero code changes to migrate.** Update the URL and keys in `.env.local` and Vercel, run `supabase db push` against the new instance, done.

---

## What Changes

- **Ops ownership** — backups, Supabase version upgrades, and uptime are self-managed
- **URL** — `*.supabase.co` → your VM's subdomain

That's it.

---

## Architecture

One Azure VM running multiple independent Supabase deployments via Docker Compose, fronted by Caddy for HTTPS and subdomain routing.

```
Azure VM (the only Azure service doing real work)
├── caddy (reverse proxy + automatic HTTPS via Let's Encrypt)
├── supabase-constellation/     ← Constellation production
│   ├── postgres
│   ├── gotrue (auth)           ← same as Supabase Cloud auth
│   ├── postgrest               ← same as Supabase Cloud API
│   ├── realtime                ← same as Supabase Cloud realtime
│   └── storage
├── supabase-idea-b/            ← prototype
├── supabase-idea-c/            ← prototype
└── ...
```

Each project gets its own subdomain and isolated Postgres database. Projects are fully independent — one crashing doesn't affect others.

---

## Cost

All costs come from the existing $150/month Azure credit budget. Out-of-pocket cost: **$0**.

| Resource | Purpose | Est. Monthly |
|---|---|---|
| Azure VM — B2ms (2 vCPU, 8 GB RAM) | Runs 3–5 Supabase projects | ~$35 |
| Azure VM — B4ms (4 vCPU, 16 GB RAM) | Runs 7–10 Supabase projects | ~$70 |
| Managed Disk (64 GB SSD) | VM OS + Postgres data | ~$5 |
| Static IP | Fixed address for DNS | ~$3 |
| Blob Storage | Backup storage only (pg_dump archives) | ~$1–2 |
| **Total (B2ms option)** | | **~$44/month** |
| **Total (B4ms option)** | | **~$80/month** |

Supabase Cloud subscription: **cancelled**. $0 ongoing SaaS fees.

---

## Tradeoffs

### Gains
- Unlimited projects at fixed cost — 5, 10, 20 prototypes, same monthly bill
- No project pausing — VM runs continuously
- Zero code changes — same SDK, same patterns everywhere
- Full Postgres with all extensions
- Automated backups with configurable retention
- Free to spin up and tear down prototypes

### Costs
- Self-managed ops — Supabase version upgrades are manual (`docker compose pull && up`)
- No Supabase support SLA
- Single VM = single failure domain (Azure VM SLA is ~99.9%; acceptable for prototypes and early-stage production)
- One-time DNS/SSL setup (Caddy handles SSL automatically; DNS is a few records)

---

## Key Setup Areas

1. **VM provisioning (OpenTofu)** — Azure VM, managed disk, static IP, DNS zone. One `tofu apply` from scratch. No manual portal steps.
2. **Supabase Docker Compose** — Official self-hosting config, one instance per project. New prototype = copy config, new port range, `docker compose up`.
3. **Reverse proxy** — Caddy routes `constellation.db.yourdomain.com` → Constellation's Supabase instance, `project-b.db.yourdomain.com` → next instance, etc. Automatic HTTPS.
4. **Backups** — Daily `pg_dump` per project, uploaded to Azure Blob Storage. Lifecycle rules control retention.
5. **Constellation cutover** — Update URL + keys in Vercel env vars and `.env.local`. No code changes.

---

## Open Questions for PM

1. **VM size**: B2ms (3–5 projects, ~$44/month) or B4ms (7–10 projects, ~$80/month)?
2. **Cutover sequence**: Validate on a throwaway prototype first, then migrate Constellation — or migrate Constellation directly? (Throwaway-first is lower risk.)
3. **Staging environment**: Should a Constellation staging instance also live on this VM, or is local Supabase CLI sufficient for pre-production testing?
4. **Backup retention**: How many days of pg_dump backups to keep per project?

---

## Recommendation

Approve. Lowest-risk path to unlimited prototyping at fixed cost within existing Azure credits. No new SDKs, no migration of application code, no new vendors. The only new work is infrastructure setup and a monthly Supabase upgrade cadence.

Route to:
1. **PM** → PRD: cutover plan, backup policy, environment strategy, VM sizing decision
2. **Architect** → Architecture doc: Docker Compose layout, Caddy config, OpenTofu modules, backup automation, Constellation cutover sequence
3. **Orchestrator** → Implementation beads: IaC, Supabase deploy, reverse proxy, backups, Constellation migration
4. **Polecats** → Execute
