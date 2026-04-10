# Feature Brief: Self-Hosted Supabase on Azure

**Date**: 2026-04-10
**Author**: maggie (crew)
**Priority**: High
**Rig**: constellation

---

## Problem

Supabase Cloud's free tier is a liability for active projects — 7-day inactivity pause, 500 MB limit, no backups. Upgrading to Pro solves those problems but costs $25/month per organization plus ~$10/month per project in compute. Prototyping 5–10 ideas simultaneously on Supabase Cloud quickly approaches $100+/month.

---

## Proposed Solution

Run **self-hosted Supabase on a single Azure VM**, funded by the existing $150/month Azure credit budget. This gives unlimited projects at a fixed infrastructure cost, while keeping the exact same Supabase APIs, SDK, RLS patterns, and realtime that Constellation already uses. No code changes. No new vendors. No new mental model.

Constellation production moves to the self-hosted instance alongside all future prototypes.

---

## Why This Works

Supabase is fully open source. The same stack that runs at supabase.com — PostgreSQL, GoTrue (auth), PostgREST, Realtime, Storage, Studio — runs on any Linux VM via Docker Compose. The `@supabase/supabase-js` SDK is endpoint-agnostic: point it at your VM's URL instead of `*.supabase.co` and everything works identically.

**What stays exactly the same:**
- `@supabase/supabase-js` SDK (web + mobile)
- RLS policies and `get_permission()` function
- Supabase Realtime subscriptions
- Supabase Auth (email/password, Google OAuth, Apple OAuth)
- Supabase Storage
- `supabase/migrations/` workflow
- Supabase Studio dashboard (self-hosted)

**What changes:**
- You own the ops: backups, upgrades, uptime
- Secrets managed via Azure Key Vault instead of Supabase dashboard

---

## Architecture

One Azure VM running the full Supabase Docker Compose stack. Multiple projects run as separate Supabase deployments on the same host, each on its own port, fronted by a reverse proxy (Caddy or nginx) that routes by subdomain.

```
Azure VM (B2ms or B4ms)
├── caddy (reverse proxy + automatic HTTPS)
├── supabase-constellation/   ← production project
│   ├── postgres
│   ├── gotrue (auth)
│   ├── postgrest
│   ├── realtime
│   └── storage
├── supabase-project-b/       ← prototype
├── supabase-project-c/       ← prototype
└── ...
```

Each project gets its own subdomain (e.g., `constellation.db.yourdomain.com`) and isolated Postgres database. Projects are independent — one prototype crashing doesn't affect others.

---

## Cost

All costs drawn from the existing $150/month Azure credit budget.

| Resource | Size | Est. Monthly Cost |
|---|---|---|
| Azure VM (B2ms: 2 vCPU, 8 GB RAM) | Suitable for 3–5 active projects | ~$35 |
| Azure VM (B4ms: 4 vCPU, 16 GB RAM) | Suitable for 7–10 active projects | ~$70 |
| Azure Blob Storage (Supabase Storage backend) | 50 GB | ~$1–2 |
| Azure Managed Disk (OS + data) | 64 GB P10 SSD | ~$5 |
| Static IP | 1 | ~$3 |
| **Total (B2ms)** | | **~$44/month** |
| **Total (B4ms)** | | **~$80/month** |

**Out-of-pocket cost: $0.** Both options are within the $150/month credit budget, with meaningful headroom.

Supabase Cloud Pro subscription: cancelled. Zero ongoing SaaS cost for Supabase.

---

## Tradeoffs

### Gains
- **Unlimited projects** at fixed infrastructure cost — 5, 10, 20 prototypes, same price
- **No project pausing** — VM runs continuously
- **Same SDK and patterns** — zero code changes to Constellation or future projects
- **Full Postgres** — all extensions, no limitations
- **Real backups** — pg_dump cron + Azure Blob Storage; retain as long as needed
- **Studio dashboard** — self-hosted Supabase Studio available for all projects
- **No per-project billing** — spin up and tear down prototypes freely

### Costs
- **Ops ownership** — you manage upgrades, backups, and uptime; no Supabase support SLA
- **Supabase upgrade management** — new Supabase releases require manual `docker compose pull && up`
- **SSL/DNS setup** — one-time: domain, Caddy config, wildcard or per-project subdomains
- **Single point of failure** — one VM means one failure domain (mitigated by Azure VM SLA ~99.9%)

---

## Key Setup Areas

1. **OpenTofu infrastructure** — Azure VM, Managed Disk, Blob Storage account (for Supabase Storage backend and backups), Static IP, Key Vault, DNS zone — all as OpenTofu modules. `tofu apply` provisions everything from scratch.

2. **Supabase Docker Compose** — Official Supabase self-hosting Docker Compose config, parameterized per project. New project = copy config, set new port range and database name, `docker compose up`.

3. **Reverse proxy (Caddy)** — Caddy handles automatic HTTPS (Let's Encrypt) and subdomain routing to each project's PostgREST/Auth/Studio ports. Minimal config.

4. **Backup strategy** — Daily `pg_dump` cron per project, compressed and uploaded to Azure Blob Storage. Retention policy set in Blob Storage lifecycle rules.

5. **Secrets management** — Azure Key Vault stores Supabase JWT secrets, DB passwords, OAuth credentials. OpenTofu provisions Key Vault and injects secrets at VM boot via cloud-init or Key Vault references.

6. **Constellation migration** — Update `.env.local` (local dev) and Vercel environment variables to point at the self-hosted URL. Run `supabase db push` against the new instance. No code changes.

7. **Monitoring** — Azure Monitor + VM metrics for CPU/disk/memory. Optional: Uptime Robot (free) for endpoint health checks.

---

## Constraints

- **All infrastructure via OpenTofu** — no manual Azure portal provisioning
- **Supabase self-hosted** — same open-source stack as Supabase Cloud; no forks or replacements
- **Backups required** — automated daily pg_dump to Blob Storage before Constellation migrates
- **HTTPS required** — Caddy handles this automatically via Let's Encrypt
- **All secrets via Azure Key Vault** — no hardcoded credentials

---

## Open Questions for PM/Architect

1. **VM size**: B2ms (~$35/month, 3–5 projects) or B4ms (~$70/month, 7–10 projects)? Depends on how aggressively prototyping ramps up. Can resize with downtime.
2. **Domain strategy**: One domain with subdomains per project (e.g., `*.db.yourdomain.com`) or per-project domains? Subdomains on one domain is simpler.
3. **Constellation cutover**: Migrate Constellation to self-hosted before or after the infrastructure is validated with a throwaway prototype? Recommended: validate with a prototype first, then migrate Constellation.
4. **Supabase upgrade policy**: How often to pull Supabase updates? Recommended: monthly maintenance window.

---

## Recommendation

Approve. This is the lowest-risk path to unlimited prototyping at fixed cost. No new vendors, no new SDKs, no code changes to Constellation or future projects. The only new responsibility is server maintenance — manageable with a monthly upgrade cadence and automated backups.

Route to:
1. **PM** → PRD covering migration plan (Constellation cutover), backup policy, environment strategy (does "staging" live on this server too?)
2. **Architect** → Architecture doc covering Docker Compose layout, Caddy config, OpenTofu module structure, backup automation, Constellation cutover sequence
3. **Orchestrator** → Break into beads: IaC, Supabase deploy, reverse proxy, backup automation, Constellation migration
4. **Polecats** → Execute
