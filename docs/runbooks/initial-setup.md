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

az group create --name rg-constellation --location eastus

az storage account create \
  --name stconstellationtfstate \
  --resource-group rg-constellation \
  --sku Standard_LRS \
  --allow-blob-public-access false

az storage container create \
  --name tfstate \
  --account-name stconstellationtfstate
```

---

## Step 3 — Configure GitHub Actions for Azure OIDC (~15 min)

The workflow authenticates to Azure via OIDC — no stored credentials in GitHub.

**In the Azure portal:**

1. Microsoft Entra ID → App registrations → New registration. 
  1. Name: `constellation-github-actions`. 
  2. Supported account types: **Accounts in this organizational directory only (Single tenant)**. 
  3. Redirect URI: leave blank.
2. Under Manage → Certificates & secrets → Federated credentials → Add credential:
   - Scenario: GitHub Actions
   - Organization: your GitHub username or org
   - Repository: `constellation-gasworks`
   - Entity: Branch → `main`
   - Name: `constellation-github-actions`.
   - Description: `Credentials for github actions from constellation-gasworks repo`.
3. Note the **Client ID** and **Tenant ID** — both are on the app registration's **Overview** page (navigate back to it after adding the credential). Find your **Subscription ID** separately by searching "Subscriptions" in the Azure portal top search bar.
4. In the Azure portal, search "Subscriptions" → click your subscription → left sidebar: **Access control (IAM)** → Add → Add role assignment → Privileged Administrator Roles
  2. Role: **Contributor** (the built-in role: "Grants full access to manage all resources, but does not allow you to assign roles in Azure RBAC"
  3. Members: member type **User, group, or service principal** → search for and select `constellation-github-actions`
  4. Review and Assign

**In GitHub (repo → Settings → Secrets and variables → Actions):**

| Type | Name | Value |
|---|---|---|
| Variable | `AZURE_CLIENT_ID` | App registration Client ID |
| Variable | `AZURE_TENANT_ID` | Your Azure Tenant ID |
| Variable | `AZURE_SUBSCRIPTION_ID` | Your Azure Subscription ID |
| Secret | `TF_VAR_VM_SSH_PUBLIC_KEY` | `cat ~/.ssh/id_ed25519.pub` |

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
resource_group_name          = "rconstellation"
location                     = "westus3"
dns_zone_name                = "db.harebrained-apps.com"
tfstate_storage_account      = "stconstellationtfstate"
vm_admin_username            = "azureuser"
backups_storage_account_name = "stconstellationbackups"
```

Fill in `secrets.tfvars` with values from Step 1 + your Resend API key:
```hcl
constellation_jwt_secret        = "<openssl rand -hex 32 output>"
constellation_postgres_password = "<openssl rand -base64 32 output>"
constellation_anon_key          = "<anon JWT from Step 1>"
constellation_service_role_key  = "<service_role JWT from Step 1>"
resend_api_key                  = "<from resend.com Settings → API Keys>"
vm_ssh_public_key               = "<your SSH public key string>"
tfstate_storage_account         = "stconstellationtfstate"
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

## Step 7 — Verify VM and start Constellation Supabase (~10 min)

```bash
ssh azureuser@<vm_public_ip>

# Verify cloud-init completed
sudo cloud-init status
# Expected: status: done

# Check Caddy is running
sudo systemctl status caddy

# Check secret loader ran and wrote the .env file
sudo systemctl status supabase-secret-loader
ls /opt/supabase/constellation/.env

# Start Constellation's Supabase stack
cd /opt/supabase/constellation
sudo docker compose up -d

# Wait ~30 seconds, then verify all containers are healthy
sudo docker compose ps
```

All containers should show `healthy` or `running`. Caddy will automatically obtain a TLS certificate for `constellation.db.harebrained-apps.com` on first request — this requires DNS propagation from Step 6 to be complete.

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
ssh azureuser@<vm_public_ip>
sudo /opt/supabase/scripts/backup.sh
```

Verify the dump appeared in Blob Storage:
```bash
az storage blob list \
  --account-name stconstellationbackups \
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
