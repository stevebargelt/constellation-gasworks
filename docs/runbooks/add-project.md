# Runbook: Add a New Supabase Project to the VM

**Estimated time:** ~5 minutes  
**Prerequisites:** SSH access to the VM, `az` CLI authenticated, project name chosen

---

## Port Allocation

Each project occupies a fixed port range based on its index `N` (0-based):

| Service | Port | Index 0 (constellation) | Index 1 | Index 2 |
|---------|------|------------------------|---------|---------|
| Kong (API) | `8N00` | `8000` | `8100` | `8200` |
| Studio | `3N00` | `3000` | `3100` | `3200` |

Pick the next available index. Index 0 is reserved for `constellation`.

---

## Step 1 — Generate and Store Secrets in Key Vault

On your local machine (requires `az` CLI + Key Vault access):

```bash
PROJECT=<new-project-name>
VAULT=kv-constellation-prod   # Key Vault name from tofu outputs

# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
# Generate ANON_KEY and SERVICE_ROLE_KEY using the Supabase JWT tool:
# https://supabase.com/docs/guides/self-hosting#api-keys
# Or use the supabase CLI: supabase gen keys --project-ref local
ANON_KEY=<generated-anon-key>
SERVICE_ROLE_KEY=<generated-service-role-key>

# Push to Key Vault (VM's managed identity will read these)
az keyvault secret set --vault-name $VAULT \
  --name "${PROJECT^^}_JWT_SECRET" --value "$JWT_SECRET"
az keyvault secret set --vault-name $VAULT \
  --name "${PROJECT^^}_POSTGRES_PASSWORD" --value "$POSTGRES_PASSWORD"
az keyvault secret set --vault-name $VAULT \
  --name "${PROJECT^^}_ANON_KEY" --value "$ANON_KEY"
az keyvault secret set --vault-name $VAULT \
  --name "${PROJECT^^}_SERVICE_ROLE_KEY" --value "$SERVICE_ROLE_KEY"
```

> **Note:** Secret names follow the pattern `{PROJECT_UPPER}_{KEY}`. The
> secret loader maps these to Docker Compose env var names automatically.

---

## Step 2 — Add Project to Secret Loader Config

SSH into the VM and add the project to the `PROJECTS` list:

```bash
sudo nano /opt/scripts/load-secrets.sh
```

Find the `PROJECTS` line and add the new project:

```bash
PROJECTS="constellation <new-project-name>"
```

---

## Step 3 — Create Persistent Data Directories on the Data Disk

The managed data disk at `/mnt/data` is the persistence layer for all Supabase data. Before starting any new project, create its directory tree on the data disk:

```bash
PROJECT=<new-project-name>

sudo mkdir -p /mnt/data/supabase-${PROJECT}/db
sudo mkdir -p /mnt/data/supabase-${PROJECT}/db-config
sudo mkdir -p /mnt/data/supabase-${PROJECT}/storage
sudo chmod 755 /mnt/data/supabase-${PROJECT}/{db,db-config,storage}
```

If `/mnt/data` is not mounted, attach the managed disk first (VM → Disks in the Azure portal, LUN 10) and run `sudo mount -a`.

---

## Step 4 — Copy Docker Compose Template

Still on the VM:

```bash
N=<project-index>          # e.g. 1 for second project
KONG_PORT="8${N}00"        # e.g. 8100
STUDIO_PORT="3${N}00"      # e.g. 3100

sudo mkdir -p /opt/supabase-${PROJECT}
sudo cp -r /opt/supabase-template/* /opt/supabase-${PROJECT}/
```

After copying, update the `volumes:` section at the bottom of `/opt/supabase-${PROJECT}/docker-compose.yml` to bind-mount the directories created in Step 3:

```yaml
volumes:
  db-data:
    name: ${PROJECT}-db-data
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/data/supabase-${PROJECT}/db
  db-config:
    name: ${PROJECT}-db-config
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/data/supabase-${PROJECT}/db-config
  storage-data:
    name: ${PROJECT}-storage-data
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/data/supabase-${PROJECT}/storage
```

This ensures Postgres data, custom config, and uploaded files survive VM recreation — the same pattern used by the `constellation` project.

Create the `.env` stub (will be overwritten by secret loader, but needs to exist):

```bash
sudo tee /opt/supabase-${PROJECT}/.env > /dev/null <<EOF
PROJECT_NAME=${PROJECT}
KONG_PORT=${KONG_PORT}
STUDIO_PORT=${STUDIO_PORT}
API_EXTERNAL_URL=https://${PROJECT}.db.harebrained-apps.com
SUPABASE_PUBLIC_URL=https://${PROJECT}.db.harebrained-apps.com
SITE_URL=https://<your-app-domain>
EOF
```

---

## Step 5 — Run the Secret Loader

Restart the secret loader to pull the new project's secrets from Key Vault:

```bash
sudo systemctl restart supabase-secret-loader
# Verify the .env was written
sudo cat /opt/supabase-${PROJECT}/.env | grep -v PASSWORD | grep -v SECRET | grep -v KEY
```

---

## Step 6 — Start the Project

```bash
cd /opt/supabase-${PROJECT}
sudo docker compose up -d

# Verify all services are healthy
sudo docker compose ps
```

Wait ~30 seconds for Postgres to initialize, then check all services show `Up`.

---

## Step 7 — Add Caddy Reverse Proxy Blocks

```bash
sudo nano /etc/caddy/Caddyfile
```

Add two blocks at the end (copy the pattern from the constellation blocks):

```caddyfile
# ── <new-project-name> ───────────────────────────────────────────────────────
<new-project-name>.db.harebrained-apps.com {
    reverse_proxy localhost:<KONG_PORT>
}

studio.<new-project-name>.db.harebrained-apps.com {
    reverse_proxy localhost:<STUDIO_PORT>
}
```

Reload Caddy:

```bash
sudo caddy reload --config /etc/caddy/Caddyfile
```

Verify TLS is provisioning (may take up to 60 seconds for Let's Encrypt):

```bash
curl -I https://<new-project-name>.db.harebrained-apps.com/health
```

---

## Step 8 — Add to Backup Rotation

```bash
sudo nano /opt/scripts/backup.sh
```

Find the `PROJECTS` line and add the new project (same as Step 2):

```bash
PROJECTS="constellation <new-project-name>"
```

Test a manual backup run:

```bash
sudo systemctl start supabase-backup.service
sudo journalctl -u supabase-backup.service --no-pager | tail -20
```

---

## Step 9 — Apply Supabase Migrations

From your local machine with the Supabase CLI:

```bash
supabase db push \
  --db-url "postgresql://postgres:<POSTGRES_PASSWORD>@<new-project-name>.db.harebrained-apps.com:5432/postgres"
```

---

## Verification Checklist

- [ ] `https://<project>.db.harebrained-apps.com/health` returns `{"status":"ok"}`
- [ ] Studio accessible at `https://studio.<project>.db.harebrained-apps.com`
- [ ] Auth endpoint responds: `curl https://<project>.db.harebrained-apps.com/auth/v1/health`
- [ ] Backup service ran without errors
- [ ] DNS A record resolves to VM IP (propagation may take a few minutes)

---

## DNS Notes

The wildcard A record `*.db.harebrained-apps.com` is managed by OpenTofu and
points to the VM's static IP. New project subdomains work automatically — no
DNS changes needed.
