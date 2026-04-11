# Project Plan: Self-Hosted Supabase on Azure

**Bead**: co-kkd
**Status**: Approved
**Created**: 2026-04-10
**Orchestrator**: constellation/orchestrator

---

## Overview

Migrate Constellation from Supabase Cloud free tier to a self-hosted Supabase stack running on an Azure B2ms VM provisioned via OpenTofu. Multiple independent Supabase projects share the VM at fixed cost (~$44/month from credits); Caddy handles HTTPS/subdomain routing; daily `pg_dump` backups go to Azure Blob Storage. Application code requires zero changes — only `.env` URLs and keys change. New Relic and PostHog observability SDKs are added to `apps/web` and `apps/mobile` as part of this work.

Plan is structured in 5 phases: code writing (all polecat, fully parallel), then three sequential human gates (bootstrap → VM setup → cutover/smoke test), then runbook documentation.

---

## Manual Steps Summary

| # | Phase | Step | Why human required |
|---|-------|------|--------------------|
| 1 | Gate 1 | Obtain Resend API key + generate constellation Supabase secrets | External account creation; secret generation cannot be automated without a secrets oracle |
| 2 | Gate 1 | Bootstrap Azure tfstate storage account + configure GitHub Actions secrets | Chicken-and-egg: tofu state backend must exist before first `tofu apply`; GH secrets require portal/CLI access |
| 3 | Gate 1 | Merge IaC PR → trigger `tofu apply` → provision all Azure resources | Infra provisioning gate; human reviews IaC before resources are created |
| 4 | Gate 2 | SSH into VM: verify cloud-init, start constellation Supabase instance | Requires SSH access and VM-level verification |
| 5 | Gate 2 | Run `supabase db push` to apply all 11 migrations to self-hosted instance | Requires credentials and access to both local CLI and new Supabase endpoint |
| 6 | Gate 3 | Add constellation.db.harebrained-apps.com to Google OAuth redirect URIs + update Vercel env vars | Requires Google Cloud Console + Vercel dashboard access |
| 7 | Gate 3 | Full smoke test: auth, realtime, storage, RLS, all 9 realtime hook subscriptions | Cannot be automated; requires human judgment on correctness |
| 8 | Gate 3 | Verify backup uploaded, test restore, check Azure spend ≤ $80/month, cancel Supabase Cloud | Billing actions require human authorization |

---

## Phases

### Phase 1: Code (Infrastructure, VM Runtime, Backup, Observability)
**Status**: Ready to start (no prerequisites)
**Parallel tasks**: All tasks in this phase run concurrently — they are independent files in separate directories

#### Tasks

- [ ] **Write OpenTofu: core Azure resources**
  - *Depends on*: none
  - *Can run in parallel with*: all Phase 1 tasks
  - *Polecat scope*: Create `infra/tofu/` in the rig root. Write modules for: Azure VM (B2ms, 2 vCPU/8 GB), 64 GB managed SSD data disk, static public IP, Azure DNS zone (`db.harebrained-apps.com`) with wildcard A record (`*.db.harebrained-apps.com`), user-assigned managed identity attached to the VM. All in a single root module with variables for resource group, location, and project name. Remote backend configured to use the pre-bootstrapped `tfstate` container in Azure Blob Storage.

- [ ] **Write OpenTofu: Blob Storage module**
  - *Depends on*: none
  - *Can run in parallel with*: all Phase 1 tasks
  - *Polecat scope*: Add to `infra/tofu/` a module (or resource blocks) for: one Azure storage account, `tfstate` container (used for OpenTofu state backend — referenced but not created here since it's bootstrapped manually), `backups` container, Azure Blob lifecycle management policy (delete blobs under `backups/proto-*/` after 7 days, delete blobs under `backups/constellation/` after 30 days).

- [ ] **Write OpenTofu: Key Vault + secrets**
  - *Depends on*: none
  - *Can run in parallel with*: all Phase 1 tasks
  - *Polecat scope*: Add to `infra/tofu/` resources for: Azure Key Vault (soft-delete enabled, purge-protection enabled), Key Vault Secrets User role assignment to the VM's managed identity, Key Vault secrets for constellation project (`CONSTELLATION_JWT_SECRET`, `CONSTELLATION_POSTGRES_PASSWORD`, `CONSTELLATION_ANON_KEY`, `CONSTELLATION_SERVICE_ROLE_KEY`) and shared `RESEND_API_KEY`. Secret values taken as sensitive Terraform variables — never hardcoded. Write `infra/tofu/secrets.tfvars.example` showing required variable names.

- [ ] **Write GitHub Actions: IaC CI/CD workflow**
  - *Depends on*: none
  - *Can run in parallel with*: all Phase 1 tasks
  - *Polecat scope*: Create `.github/workflows/infra.yml`. On PR: run `tofu init` + `tofu plan`, post plan output as a PR comment. On merge to main: run `tofu init` + `tofu apply -auto-approve`. Use OIDC auth (Azure Federated Credentials / `azure/login` action with `client-id`, `tenant-id`, `subscription-id` as GitHub Actions variables — no long-lived client secrets). Pass sensitive tofu vars (`TF_VAR_*`) from GitHub Actions secrets.

- [ ] **Write cloud-init user-data script**
  - *Depends on*: none
  - *Can run in parallel with*: all Phase 1 tasks
  - *Polecat scope*: Create `infra/vm/cloud-init.yaml`. Must: install Docker CE + Compose plugin, Azure CLI, Caddy; create `/opt/supabase-constellation/` directory structure; install the New Relic Infrastructure Agent (from NR Linux install script, license key pulled from Key Vault secret `NR_LICENSE_KEY`); deploy secret-loader systemd service unit and backup systemd timer + service units; enable and start Caddy. Cloud-init must be idempotent (re-running on restart is safe).

- [ ] **Write secret loader systemd service**
  - *Depends on*: none
  - *Can run in parallel with*: all Phase 1 tasks
  - *Polecat scope*: Create `infra/vm/systemd/supabase-secret-loader.service`. This service runs `Before=docker.service` on every boot. The associated script (`infra/vm/scripts/load-secrets.sh`) uses `az keyvault secret show` (no credentials needed — managed identity) to pull Key Vault secrets for each registered project and write a `/opt/supabase-{project}/.env` file that Docker Compose reads via `env_file`. Script must iterate over a `PROJECTS` config list (default: `constellation`) and map Key Vault secret names to Docker Compose env var names (e.g., `CONSTELLATION_JWT_SECRET` → `JWT_SECRET`).

- [ ] **Write per-project Supabase Docker Compose template**
  - *Depends on*: none
  - *Can run in parallel with*: all Phase 1 tasks
  - *Polecat scope*: Create `infra/vm/supabase-template/docker-compose.yml` as the official Supabase self-hosting Docker Compose config, parameterized with environment variables for: `KONG_PORT` (e.g., 8000 for constellation), `STUDIO_PORT` (e.g., 3000), `PROJECT_NAME`. Include all standard Supabase services: kong, db (Postgres 15), gotrue, rest (PostgREST), realtime, storage, meta, studio. Use `env_file: .env` so the secret loader's output is consumed. Named Docker volumes for data persistence. Also create `infra/vm/README.md` explaining the port allocation scheme (each project gets a unique port range: Kong 8N00, Studio 3N00 where N is project index).

- [ ] **Write Caddyfile configuration**
  - *Depends on*: none
  - *Can run in parallel with*: all Phase 1 tasks
  - *Polecat scope*: Create `infra/vm/Caddyfile`. Configure: `constellation.db.harebrained-apps.com` reverse-proxies to `localhost:8000` (Kong), `studio.constellation.db.harebrained-apps.com` reverse-proxies to `localhost:3000` (Studio). TLS via `tls { ... }` with ACME auto. Add a clearly marked section comment showing how to add a new project (copy two blocks, change subdomain and port). Caddy binary is installed from cloud-init; the Caddyfile is written to `/etc/caddy/Caddyfile` by cloud-init.

- [ ] **Write backup.sh + systemd units**
  - *Depends on*: none
  - *Can run in parallel with*: all Phase 1 tasks
  - *Polecat scope*: Create `infra/vm/scripts/backup.sh`. Script must: read a configurable `PROJECTS` list, for each project run `pg_dump` (using `POSTGRES_PASSWORD` from `.env` or env), gzip the output, and upload to `backups/{project}/$(date +%Y-%m-%d).sql.gz` in the `backups` blob container using `az storage blob upload` (managed identity — no storage key needed). Create `infra/vm/systemd/supabase-backup.timer` (fires daily at 02:00 UTC, `OnCalendar=*-*-* 02:00:00 UTC`) and `infra/vm/systemd/supabase-backup.service` (runs backup.sh, `Type=oneshot`).

- [ ] **Add New Relic Browser Agent + PostHog JS to apps/web**
  - *Depends on*: none
  - *Can run in parallel with*: all Phase 1 tasks
  - *Polecat scope*: In `apps/web`: install `@newrelic/browser-agent` and `posthog-js`. In `apps/web/src/main.tsx`, initialize New Relic Browser Agent (application ID + license key from `VITE_NEW_RELIC_APP_ID` / `VITE_NEW_RELIC_LICENSE_KEY` env vars) before `ReactDOM.createRoot`. Initialize PostHog (`posthog.init(VITE_POSTHOG_KEY, { api_host: 'https://app.posthog.com', autocapture: true })`). Add `posthog.identify(user.id, { email: user.email })` wherever `useAuth()` returns a signed-in user (check existing `useAuth` hook usage in `apps/web/src/App.tsx` or auth pages). Guard both initializations with env var presence checks so local dev without keys doesn't break.

- [ ] **Add New Relic React Native Agent + PostHog RN to apps/mobile**
  - *Depends on*: none
  - *Can run in parallel with*: all Phase 1 tasks
  - *Polecat scope*: In `apps/mobile`: install `@newrelic/newrelic-react-native-agent` and `posthog-react-native`. Initialize New Relic in `apps/mobile/app/_layout.tsx` at the top level (before hooks) using `NewRelic.startAgent(process.env.EXPO_PUBLIC_NEW_RELIC_APP_TOKEN)`. Initialize PostHog client and add to app context. Add `posthog.identify(user.id, { email: user.email })` after the `useAuth()` hook returns a signed-in user (already consumed in `_layout.tsx` via `AuthGuard`). Both SDKs are compatible with Expo managed workflow — no native ejection required.

- [ ] **Update .env.local.example**
  - *Depends on*: none
  - *Can run in parallel with*: all Phase 1 tasks
  - *Polecat scope*: Update `/rigs/constellation/.env.local.example`. Change the self-hosted section to reference the new VM URL (`https://constellation.db.harebrained-apps.com`). Add placeholder entries for: `VITE_NEW_RELIC_APP_ID`, `VITE_NEW_RELIC_LICENSE_KEY`, `VITE_POSTHOG_KEY`, `EXPO_PUBLIC_NEW_RELIC_APP_TOKEN`, `EXPO_PUBLIC_POSTHOG_KEY`. Keep the existing local-dev section (pointing at `http://127.0.0.1:54321`) but separate it clearly with a comment block so developers can switch between local and self-hosted.

---

### Gate 1: Bootstrap + Provision Infrastructure
**Status**: Blocked until all Phase 1 code tasks are merged (IaC PR ready to apply)
**Parallel tasks**: Step 1 and Step 2 can run concurrently with Phase 1 code writing; Step 3 must come after Step 2 and after Phase 1 PR is merged

#### Tasks

- [ ] **[HUMAN]** Obtain external credentials and generate project secrets
  - *Why manual*: Resend account creation requires human interaction; secret generation must happen outside of source control
  - *Blocks*: Bootstrap step (secrets needed before tofu can write them to Key Vault)
  - *What to do*: (1) Create Resend account at resend.com, get SMTP API key. (2) Generate constellation secrets: `JWT_SECRET` = `openssl rand -hex 32`, `POSTGRES_PASSWORD` = `openssl rand -base64 32`, `ANON_KEY` and `SERVICE_ROLE_KEY` = generate via Supabase JWT generation docs (using `JWT_SECRET`). Store all values securely (1Password or equivalent).

- [ ] **[HUMAN]** Bootstrap tfstate storage + configure GitHub Actions secrets
  - *Why manual*: OpenTofu state backend must exist before first `tofu apply` (can't use tofu to provision its own state backend); GitHub Actions secrets require portal access
  - *Blocks*: IaC PR merge (tofu init will fail without backend)
  - *What to do*: (1) Run `az storage account create --name constellationtfstate --resource-group ... --sku Standard_LRS && az storage container create --name tfstate --account-name constellationtfstate`. (2) In GitHub repo settings → Actions secrets, add: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (OIDC), plus `TF_VAR_constellation_jwt_secret`, `TF_VAR_constellation_postgres_password`, `TF_VAR_constellation_anon_key`, `TF_VAR_constellation_service_role_key`, `TF_VAR_resend_api_key` with the values from Step 1.

- [ ] **[HUMAN]** Merge IaC PR → provision all Azure infrastructure
  - *Why manual*: Human review of IaC before $44+/month resources are provisioned
  - *Blocks*: All VM setup steps
  - *What to do*: Review the `infra/` PR (all polecat output from Phase 1). Merge to main. GitHub Actions will run `tofu apply` which provisions: VM, disk, IP, DNS zone, Blob Storage (backups container), Key Vault with all secrets, managed identity with Key Vault access. Verify in GHA logs that apply succeeded with no errors. Check Azure portal that VM is running and Key Vault has the expected secrets.

---

### Gate 2: VM Verification + Constellation Deploy
**Status**: Blocked until Gate 1 Step 3 (tofu apply) succeeds

#### Tasks

- [ ] **[HUMAN]** SSH into VM: verify cloud-init + start constellation Supabase instance
  - *Why manual*: Requires SSH access and VM-level inspection
  - *Blocks*: Schema migration
  - *What to do*: (1) SSH into VM using the static IP provisioned by tofu. (2) Check `/var/log/cloud-init-output.log` — verify Docker, Caddy, Azure CLI installed cleanly; no errors. (3) Verify Caddy is running: `systemctl status caddy`. (4) Reload secret loader: `systemctl restart supabase-secret-loader` and verify `/opt/supabase-constellation/.env` was written with correct values. (5) Start constellation: `cd /opt/supabase-constellation && docker compose up -d`. (6) Wait 30–60s, verify all containers are healthy: `docker compose ps`. (7) Test HTTPS: `curl -I https://constellation.db.harebrained-apps.com/rest/v1/` should return 200 from PostgREST. Verify Studio at `https://studio.constellation.db.harebrained-apps.com`.

- [ ] **[HUMAN]** Apply schema migrations to self-hosted Constellation instance
  - *Why manual*: Requires Supabase CLI access to the new endpoint with service role credentials; must verify migrations apply cleanly before cutover
  - *Blocks*: Cutover steps
  - *What to do*: From local dev environment with Supabase CLI installed: `supabase db push --db-url postgresql://postgres:{POSTGRES_PASSWORD}@constellation.db.harebrained-apps.com:5432/postgres`. Confirm all 11 migrations in `supabase/migrations/` apply cleanly. Run a quick sanity query in Supabase Studio to verify schema (check `relationships`, `calendar_events`, `tasks`, `recipes` tables exist with RLS enabled).

---

### Gate 3: Cutover + Smoke Test + Sign-off
**Status**: Blocked until Gate 2 Step 2 (migrations applied) completes

#### Tasks

- [ ] **[HUMAN]** Update Google OAuth redirect URIs + Vercel environment variables
  - *Why manual*: Requires Google Cloud Console + Vercel dashboard access
  - *Blocks*: Smoke test (OAuth won't work until redirect URIs are updated)
  - *What to do*: (1) Google Cloud Console → APIs & Services → OAuth credentials → add `https://constellation.db.harebrained-apps.com/auth/v1/callback` to Authorized Redirect URIs. (2) Vercel → constellation project → Settings → Environment Variables: update `VITE_SUPABASE_URL` to `https://constellation.db.harebrained-apps.com` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the new anon key. Trigger a Vercel redeploy. (3) Update `.env.local` locally with new URL and keys (and `EXPO_PUBLIC_*` equivalents). Mobile env vars are picked up from `.env.local` via `app.config.js` — rebuild EAS or OTA update if needed.

- [ ] **[HUMAN]** Full smoke test: auth, realtime, storage, RLS, all realtime hook subscriptions
  - *Why manual*: Requires human judgment; must verify functionality end-to-end across web and mobile
  - *Blocks*: Sign-off steps
  - *What to do*: (1) Email/password sign up + sign in on web. (2) Google OAuth on web. (3) All 9 realtime hooks deliver updates within 2s: `useCalendar`, `useCalendarOverlay`, `useRelationships`, `useLivingSpaces`, `useTaskLists`, `useTasks`, `useShoppingList`, `useRecipes`, `useMealPlans`. (4) Storage: upload and retrieve a file. (5) Verify RLS: sign in as User A and User B — User A should not see User B's private data. (6) Run same auth tests on mobile (Expo Go or EAS build). (7) Check New Relic dashboard for browser + mobile metrics. (8) Check PostHog for captured events + session replay.

- [ ] **[HUMAN]** Verify backup, check Azure spend, cancel Supabase Cloud
  - *Why manual*: Billing actions and backup verification require human authorization
  - *Blocks*: Bead closure
  - *What to do*: (1) Verify backup ran: check Azure Blob Storage `backups/constellation/` container for today's `.sql.gz`. (2) Test restore: download backup, run `gunzip backup.sql.gz && docker run --rm -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:15 -d && psql -h localhost -p 5433 -U postgres -f backup.sql` — verify tables present. (3) Azure Cost Management: check projected monthly spend is ≤ $80. (4) Cancel Supabase Cloud subscription (retain Cloud project in paused state for 30 days before data deletion).

---

### Phase 2: Documentation
**Status**: Can start after Phase 1 code is merged; does not block cutover

#### Tasks

- [ ] **Write add-project runbook**
  - *Depends on*: Phase 1 complete (so doc references final file paths)
  - *Can run in parallel with*: other Phase 2 docs
  - *Polecat scope*: Create `docs/runbooks/add-project.md`. Document step-by-step: (1) Generate secrets for new project, push to Key Vault (`az keyvault secret set`). (2) Copy Docker Compose template to `/opt/supabase-{project}/`, assign unique port range (Kong 8N00, Studio 3N00). (3) Reload secret loader (`systemctl restart supabase-secret-loader`). (4) `docker compose up -d`. (5) Add two `reverse_proxy` blocks to `/etc/caddy/Caddyfile` and `caddy reload`. (6) Add project to backup target list in backup.sh. Estimated time: ~5 minutes per new project.

- [ ] **Write Supabase upgrade runbook**
  - *Depends on*: Phase 1 complete
  - *Can run in parallel with*: other Phase 2 docs
  - *Polecat scope*: Create `docs/runbooks/upgrade-supabase.md`. Document: (1) Check Supabase self-hosting releases for breaking changes. (2) Per project: `cd /opt/supabase-{project} && docker compose pull && docker compose up -d`. (3) Verify all containers healthy post-upgrade. (4) Run a smoke test query. Include a note about Supabase release cadence (check ~monthly) and where to find the official changelog.

- [ ] **Write backup restore runbook**
  - *Depends on*: Phase 1 complete
  - *Can run in parallel with*: other Phase 2 docs
  - *Polecat scope*: Create `docs/runbooks/restore-backup.md`. Document: (1) Find backup: `az storage blob list --container-name backups --prefix {project}/` (managed identity auth). (2) Download: `az storage blob download --container-name backups --name {project}/{date}.sql.gz --file ./backup.sql.gz`. (3) Decompress: `gunzip backup.sql.gz`. (4) Restore: `psql postgresql://postgres:{password}@{host}:5432/postgres -f backup.sql`. (5) Verify: check row counts in key tables. Include a warning about the `--clean` flag (restore drops and recreates all tables — do not run against live production without stopping the app first).

---

## Dependency Map

```mermaid
flowchart TD
    subgraph P1["Phase 1: Code (all parallel)"]
        P1A["Write OpenTofu:\nCore Azure resources"]
        P1B["Write OpenTofu:\nBlob Storage"]
        P1C["Write OpenTofu:\nKey Vault + secrets"]
        P1D["Write GitHub Actions:\nIaC CI/CD workflow"]
        P1E["Write cloud-init\nuser-data script"]
        P1F["Write secret loader\nsystemd service"]
        P1G["Write Docker Compose\ntemplate"]
        P1H["Write Caddyfile"]
        P1I["Write backup.sh\n+ systemd units"]
        P1J["Add NR Browser +\nPostHog JS — apps/web"]
        P1K["Add NR RN +\nPostHog RN — apps/mobile"]
        P1L["Update\n.env.local.example"]
    end

    subgraph G1["Gate 1: Bootstrap + Provision"]
        H1{{"[HUMAN]\nObtain credentials\n+ generate secrets"}}
        H2{{"[HUMAN]\nBootstrap tfstate\n+ GH Actions secrets"}}
        H3{{"[HUMAN]\nMerge IaC PR →\ntofu apply"}}
    end

    subgraph G2["Gate 2: VM Setup + Constellation Deploy"]
        H4{{"[HUMAN]\nSSH: verify cloud-init\n+ start constellation"}}
        H5{{"[HUMAN]\nsupabase db push\n(11 migrations)"}}
    end

    subgraph G3["Gate 3: Cutover + Smoke Test"]
        H6{{"[HUMAN]\nGoogle OAuth +\nVercel env vars"}}
        H7{{"[HUMAN]\nFull smoke test"}}
        H8{{"[HUMAN]\nVerify backup +\ncheck spend +\ncancel Supabase Cloud"}}
    end

    subgraph P2["Phase 2: Documentation"]
        P2A["Write add-project\nrunbook"]
        P2B["Write upgrade\nrunbook"]
        P2C["Write restore\nrunbook"]
    end

    P1A & P1B & P1C & P1D & P1E & P1F & P1G & P1H & P1I & P1J & P1K & P1L --> H1
    P1A & P1B & P1C & P1D & P1E & P1F & P1G & P1H & P1I & P1J & P1K & P1L --> H2
    H1 --> H2
    H2 --> H3
    H3 --> H4
    H4 --> H5
    H5 --> H6
    H6 --> H7
    H7 --> H8

    P1A --> P2A
    P1A --> P2B
    P1A --> P2C
```

---

## Bead Creation Plan

| Phase | Task | Type | Label | Depends on |
|-------|------|------|-------|------------|
| 1 | Write OpenTofu: core Azure resources | Automated | `pool:constellation/polecat` | — |
| 1 | Write OpenTofu: Blob Storage | Automated | `pool:constellation/polecat` | — |
| 1 | Write OpenTofu: Key Vault + secrets | Automated | `pool:constellation/polecat` | — |
| 1 | Write GitHub Actions: IaC CI/CD | Automated | `pool:constellation/polecat` | — |
| 1 | Write cloud-init user-data script | Automated | `pool:constellation/polecat` | — |
| 1 | Write secret loader systemd service | Automated | `pool:constellation/polecat` | — |
| 1 | Write Docker Compose template | Automated | `pool:constellation/polecat` | — |
| 1 | Write Caddyfile | Automated | `pool:constellation/polecat` | — |
| 1 | Write backup.sh + systemd units | Automated | `pool:constellation/polecat` | — |
| 1 | Add NR Browser Agent + PostHog JS — apps/web | Automated | `pool:constellation/polecat` | — |
| 1 | Add NR RN Agent + PostHog RN — apps/mobile | Automated | `pool:constellation/polecat` | — |
| 1 | Update .env.local.example | Automated | `pool:constellation/polecat` | — |
| Gate 1 | Obtain credentials + generate secrets | Manual | `needs-human` | — |
| Gate 1 | Bootstrap tfstate + configure GH secrets | Manual | `needs-human` | Obtain credentials |
| Gate 1 | Merge IaC PR → tofu apply | Manual | `needs-human` | Bootstrap + all Phase 1 code |
| Gate 2 | SSH: verify cloud-init + start constellation | Manual | `needs-human` | Merge IaC PR |
| Gate 2 | Run supabase db push (11 migrations) | Manual | `needs-human` | Start constellation |
| Gate 3 | Update Google OAuth + Vercel env vars | Manual | `needs-human` | supabase db push |
| Gate 3 | Full smoke test | Manual | `needs-human` | Update OAuth + Vercel |
| Gate 3 | Verify backup + check spend + cancel Supabase Cloud | Manual | `needs-human` | Smoke test |
| 2 | Write add-project runbook | Automated | `pool:constellation/polecat` | Phase 1 complete |
| 2 | Write Supabase upgrade runbook | Automated | `pool:constellation/polecat` | Phase 1 complete |
| 2 | Write backup restore runbook | Automated | `pool:constellation/polecat` | Phase 1 complete |
