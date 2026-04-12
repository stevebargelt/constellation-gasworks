# Initial Setup: Self-Hosted Supabase on Azure

This runbook walks through bringing the Azure infrastructure live for the first time. All code is already written — this is the human-gated portion that requires your Azure account, DNS access, and credentials.

**Estimated time**: ~2 hours (mostly waiting on `tofu apply` and DNS propagation)

---

## Accounts to create before you start

| Service | Purpose | URL |
|---|---|---|
| Azure | VM, DNS, Key Vault, Blob Storage | portal.azure.com |
| Resend | SMTP for Supabase auth emails | resend.com |
| New Relic | Observability (infra + web + mobile) | newrelic.com |
| PostHog | Product analytics + session replay + feature flags | posthog.com |

All are free tier for our usage level.

---

## Step 1 — Generate secrets (~10 min)

Run these locally. Save all outputs — you'll need them in Step 4.

```bash
# JWT secret (signing key for all Supabase tokens)
openssl rand -hex 32

# Postgres password
openssl rand -base64 32
```

For the **anon key** and **service role key** (JWTs signed with your JWT secret), follow the key generation guide at:
https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys

Use the JWT secret generated above as the signing key. You'll produce two JWTs: one with role `anon`, one with role `service_role`.

---

## Step 2 — Bootstrap Azure tfstate storage account (~15 min)

This must happen before `tofu apply` — OpenTofu stores its state in Blob Storage.

```bash
az login

az group create --name constellation --location westus3

az storage account create \
  --name hbconstellationtfstate \
  --resource-group constellation \
  --sku Standard_LRS \
  --allow-blob-public-access false

az storage container create \
  --name tfstate \
  --account-name hbconstellationtfstate
```

> **Note:** The `constellation` resource group created here is imported into OpenTofu state automatically on first `tofu apply` via an `import` block in `main.tf`. You do not need to delete and recreate it.

---

## Step 3 — Configure GitHub Actions for Azure OIDC (~15 min)

The workflow authenticates to Azure via OIDC — no stored credentials in GitHub.

**In the Azure portal:**

1. Microsoft Entra ID → App registrations → New registration. 
  1. Name: `constellation-github-actions`. 
  2. Supported account types: **Accounts in this organizational directory only (Single tenant)**. 
  3. Redirect URI: leave blank.
2. Under Manage → Certificates & secrets → Federated credentials, add **two** credentials:

   **Credential 1 — for merges to main (tofu apply):**
   - Scenario: GitHub Actions
   - Organization: your GitHub username or org
   - Repository: `constellation-gasworks`
   - Entity: Branch → `main`
   - Name: `constellation-github-actions-main`

   **Credential 2 — for pull requests (tofu plan):**
   - Scenario: GitHub Actions
   - Organization: your GitHub username or org
   - Repository: `constellation-gasworks`
   - Entity: **Pull request**
   - Name: `constellation-github-actions-pr`

   **Credential 3 — for tofu apply (runs in the `production` environment):**
   - Scenario: GitHub Actions
   - Organization: your GitHub username or org
   - Repository: `constellation-gasworks`
   - Entity: **Environment** → `production`
   - Name: `constellation-github-actions-production`
3. Note the **Client ID** and **Tenant ID** — both are on the app registration's **Overview** page (navigate back to it after adding the credential). Find your **Subscription ID** separately by searching "Subscriptions" in the Azure portal top search bar.
4. In the Azure portal, search "Subscriptions" → click your subscription → left sidebar: **Access control (IAM)** → Add → Add role assignment → Privileged Administrator Roles. Assign **two** roles to `constellation-github-actions`:

   **Role assignment 1 — Contributor** (provision/modify resources):
   - Role: **Contributor**
   - Members: member type **User, group, or service principal** → search for and select `constellation-github-actions`
   - Review and Assign

   **Role assignment 2 — User Access Administrator** (required for OpenTofu to create role assignments):
   - Role: **User Access Administrator**
   - Members: member type **User, group, or service principal** → search for and select `constellation-github-actions`
   - Review and Assign

   > **Why both?** Contributor alone cannot call `Microsoft.Authorization/roleAssignments/write`. OpenTofu creates role assignments to grant the VM's managed identity access to Key Vault and Blob Storage — so the service principal needs User Access Administrator as well.
   >
   > **Constrained delegation prompt**: When assigning User Access Administrator, Azure asks how to constrain delegation. Select **"Allow user to assign all roles except privileged administrator roles Owner, UAA, RBAC (Recommended)"** — OpenTofu only assigns standard data-plane roles (`Key Vault Secrets User`, `Storage Blob Data Contributor`), so the recommended option is sufficient.
   >
   > **Key Vault secrets**: OpenTofu also writes secrets directly to Key Vault during `tofu apply`. This requires the CI service principal to have `Key Vault Secrets Officer` on the vault itself — handled automatically by a role assignment in `keyvault.tf` using `data.azurerm_client_config.current.object_id`.

**In GitHub (repo → Settings → Secrets and variables → Actions):**

Variables (visible in logs):

| Name | Value |
|---|---|
| `AZURE_CLIENT_ID` | App registration Client ID |
| `AZURE_TENANT_ID` | Your Azure Tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Your Azure Subscription ID |
| `TF_VAR_BACKUPS_STORAGE_ACCOUNT_NAME` | Globally unique name for backup storage (e.g. `hbconstellationbackups`) |

Secrets (masked in logs):

| Name | Value |
|---|---|
| `TF_VAR_VM_SSH_PUBLIC_KEY` | RSA public key — Azure VMs do not support ed25519. Generate: `ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa_azure -N ""` then `cat ~/.ssh/id_rsa_azure.pub` |
| `TF_VAR_CONSTELLATION_JWT_SECRET` | JWT secret from Step 1 |
| `TF_VAR_CONSTELLATION_POSTGRES_PASSWORD` | Postgres password from Step 1 |
| `TF_VAR_CONSTELLATION_ANON_KEY` | Anon JWT from Step 1 |
| `TF_VAR_CONSTELLATION_SERVICE_ROLE_KEY` | Service role JWT from Step 1 |
| `TF_VAR_RESEND_API_KEY` | From resend.com Settings → API Keys |

Required for deploy workflow (Vercel + EAS):

| Name | Value |
|---|---|
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens → Create token: name `constellation-github-actions`, scope `Steve's Projects`, no expiration |
| `VERCEL_ORG_ID` | Your Team ID — vercel.com → Settings → General → Team ID |
| `VERCEL_PROJECT_ID` | vercel.com/dashboard → your project → Settings → General → scroll to bottom → Project ID |
| `EXPO_TOKEN` | expo.dev → Robot Users → Create robot user named `constellation-mobile-app`, role `Developer` → create token named `constellation-mobile-app` → copy token value |

> **Why these names?** The CI workflow passes these directly as `TF_VAR_*` environment variables to OpenTofu. `terraform.tfvars` and `secrets.tfvars` are gitignored and never present in CI — all variable values must come from this table or be hardcoded non-sensitive defaults in the workflow itself.

Also create a GitHub Actions **environment** named `production` (Settings → Environments) — the apply job requires it.

---

## Step 4 — Configure OpenTofu variables (~10 min)

```bash
cd infra/tofu
cp terraform.tfvars.example terraform.tfvars
cp secrets.tfvars.example secrets.tfvars
```

Fill in `terraform.tfvars`:
```hcl
project_name                 = "constellation"
resource_group_name          = "constellation"
location                     = "westus3"
dns_zone_name                = "db.harebrained-apps.com"
tfstate_storage_account      = "hbconstellationtfstate"
vm_admin_username            = "azureuser"
# backups_storage_account_name is set via GitHub Actions variable TF_VAR_BACKUPS_STORAGE_ACCOUNT_NAME — not needed here
```

Fill in `secrets.tfvars` with values from Step 1 + your Resend API key:
```hcl
constellation_jwt_secret        = "<openssl rand -hex 32 output>"
constellation_postgres_password = "<openssl rand -base64 32 output>"
constellation_anon_key          = "<anon JWT from Step 1>"
constellation_service_role_key  = "<service_role JWT from Step 1>"
resend_api_key                  = "<from resend.com Settings → API Keys>"
vm_ssh_public_key               = "<your SSH public key string>"
tfstate_storage_account         = "hbconstellationtfstate"
```

Neither file is committed to git (both are gitignored). In CI, secrets are passed as `TF_VAR_*` environment variables.

---

## Step 5 — Merge IaC PR to provision infrastructure (~20 min)

```bash
git checkout -b infra/self-hosted-supabase
git add infra/ .github/workflows/infra.yml
git commit -m "infra: self-hosted Supabase on Azure VM"
git push origin infra/self-hosted-supabase
```

Open a PR. GitHub Actions will run `tofu plan` and post the plan as a PR comment. Review it, then merge.

On merge, `tofu apply` runs automatically and provisions: VM, managed disk, static IP, DNS zone, Blob Storage (tfstate + backups), Key Vault, and writes all secrets to Key Vault via managed identity.

After apply completes, capture the VM IP:
```bash
cd infra/tofu
tofu init   # initializes the azurerm backend against the remote state
tofu output vm_public_ip
```

---

## Step 6 — Point DNS at the VM (~5 min + propagation)

In your DNS registrar for `harebrained-apps.com`, add:

```
Type: A
Name: *.db
Value: <vm_public_ip from Step 5>
TTL: 300
```

Verify propagation (may take 5–30 minutes):
```bash
dig constellation.db.harebrained-apps.com
```

---

## Step 7 — Verify VM is fully operational (~10 min)

Cloud-init runs automatically on first boot and handles **everything** — no SSH required to configure the VM. It:

- Installs Docker CE + Compose plugin, Azure CLI, Caddy, New Relic Infrastructure Agent
- Deploys `load-secrets.sh`, `backup.sh`, `docker-compose.yml`, and the Caddyfile
- Authenticates with the VM's managed identity and pulls all secrets from Key Vault
- Generates the Kong declarative config (`kong.yml`) with the actual API keys
- Writes URL config (`API_EXTERNAL_URL`, `SITE_URL`, `SUPABASE_PUBLIC_URL`) to `.env`
- Starts the full Supabase stack via `docker compose up -d`
- Enables the daily backup timer (02:00 UTC)

SSH in to verify:

```bash
ssh -i ~/.ssh/id_rsa_azure azureuser@<vm_public_ip>

# Verify cloud-init completed (may take 5–10 min on first boot)
sudo cloud-init status
# Expected: status: done

# Verify all services are running
sudo systemctl status caddy
sudo systemctl status supabase-secret-loader
sudo systemctl status supabase-stack
# Expected: caddy active (running), secret-loader active (exited),
#           supabase-stack active (exited)

# Verify secrets were loaded and URLs are set
cat /opt/supabase-constellation/.env
# Should contain: JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, POSTGRES_PASSWORD,
#                 SMTP_HOST, SMTP_PASS, DASHBOARD_PASSWORD,
#                 API_EXTERNAL_URL, SITE_URL, SUPABASE_PUBLIC_URL

# Verify Kong config was generated
cat /opt/supabase-constellation/volumes/api/kong.yml
# Should contain actual API keys (not placeholders)

# Verify all containers are healthy
sudo docker compose -f /opt/supabase-constellation/docker-compose.yml ps
```

All containers should show `healthy` or `running`. Caddy will automatically obtain a TLS certificate for `constellation.db.harebrained-apps.com` on first request — this requires DNS propagation from Step 6 to be complete.

> **Troubleshooting**: If `cloud-init status` shows `error`, check `sudo cloud-init status --long` and `sudo journalctl -u cloud-init -n 50` for details. If `supabase-secret-loader` failed, check `sudo journalctl -u supabase-secret-loader -n 50` — common causes: Key Vault access denied (verify VM managed identity has Key Vault Secrets User role), missing critical secrets in Key Vault.

---

## Step 7a — Link the mobile app to your Expo account (~2 min)

Run once locally to link the project and get the EAS project ID:

```bash
cd apps/mobile
eas init
```

EAS will print a `projectId` and warn that it can't auto-write to `app.config.js` (dynamic config). Manually add it to `app.config.js` under `expo.extra.eas.projectId`, then commit.

---

## Step 7b — Set EAS secrets for mobile builds

Once Supabase is running on the VM, set the mobile app env vars as EAS secrets so builds pick them up:

```bash
cd apps/mobile
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://constellation.db.harebrained-apps.com"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "<anon key from Step 1>"
```

These replace the empty values that were previously (incorrectly) hardcoded in `eas.json`.

---

## Step 8 — Apply database migrations (~5 min)

From your local machine:

```bash
supabase db push \
  --db-url "postgresql://postgres:<POSTGRES_PASSWORD>@constellation.db.harebrained-apps.com:5432/postgres"
```

Should report 11 migrations applied successfully.

---

## Step 9 — Wire up observability services and update env vars (~15 min)

### New Relic

1. Create a free account at newrelic.com
2. Add a **Browser** app → note **Account ID**, **App ID**, and **License Key**
3. Add a **Mobile** app → note the **App Token**

### PostHog

1. Create a free account at posthog.com
2. Create a project → note the **Project API Key**

### Google OAuth

In Google Cloud Console → your OAuth 2.0 client → Authorized redirect URIs, add:
```
https://constellation.db.harebrained-apps.com/auth/v1/callback
```

### Vercel

Update environment variables for the **Production** environment:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://constellation.db.harebrained-apps.com` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key from Step 1 |
| `VITE_NEW_RELIC_ACCOUNT_ID` | from New Relic |
| `VITE_NEW_RELIC_APP_ID` | from New Relic |
| `VITE_NEW_RELIC_LICENSE_KEY` | from New Relic |
| `VITE_POSTHOG_KEY` | from PostHog |

Trigger a manual redeploy after saving.

### `.env.local` (local dev)

Uncomment the self-hosted block and fill in:
```bash
VITE_SUPABASE_URL=https://constellation.db.harebrained-apps.com
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
EXPO_PUBLIC_SUPABASE_URL=https://constellation.db.harebrained-apps.com
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key>

VITE_NEW_RELIC_ACCOUNT_ID=
VITE_NEW_RELIC_APP_ID=
VITE_NEW_RELIC_LICENSE_KEY=
VITE_POSTHOG_KEY=
EXPO_PUBLIC_NEW_RELIC_APP_TOKEN=
EXPO_PUBLIC_POSTHOG_KEY=
```

---

## Step 10 — Smoke test (~15 min)

**Test the backup script manually** before relying on it:

```bash
ssh -i ~/.ssh/id_rsa_azure azureuser@<vm_public_ip>
sudo /opt/scripts/backup.sh
```

Verify the dump appeared in Blob Storage:
```bash
az storage blob list \
  --account-name <backups_storage_account_name from terraform.tfvars> \
  --container-name backups \
  --output table
```

**App smoke test checklist** (browser + phone):

- [ ] Sign up — email confirmation arrives via Resend
- [ ] Sign in — email/password
- [ ] Sign in — Google OAuth
- [ ] Calendar realtime updates (open two tabs, create an event — second tab updates live)
- [ ] Constellation graph renders
- [ ] New Relic dashboard shows browser data within 5 minutes
- [ ] PostHog shows a session recording within a few minutes

---

## Step 11 — Close out (~5 min)

1. Check Azure Cost Management — projected spend should be ≤ $80/month
2. Cancel Supabase Cloud subscription: supabase.com/dashboard/account/billing

---

## Ongoing operations

| Task | Runbook |
|---|---|
| Add a new prototype project to the VM | `docs/runbooks/add-project.md` |
| Upgrade Supabase to a new version | `docs/runbooks/upgrade-supabase.md` |
| Restore from a backup | `docs/runbooks/restore-backup.md` |
