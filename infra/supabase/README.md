# Supabase Self-Hosting Template

`docker-compose.template.yml` is the per-project Docker Compose template for
running a self-hosted Supabase stack on the Azure VM.

## Port Allocation

Each project occupies a fixed port range based on a 0-based index `N`:

| Service | Port formula | N=0 (constellation) | N=1 | N=2 |
|---------|-------------|---------------------|-----|-----|
| Kong (API gateway) | `8N00` | `8000` | `8100` | `8200` |
| Studio (dashboard) | `3N00` | `3000` | `3100` | `3200` |

`N=0` is reserved for `constellation`. New projects start at `N=1`.

## Instantiating a New Project

1. **Pick an index** — next available `N` (check `infra/vm/Caddyfile` for
   existing assignments).

2. **Generate and store secrets** in Azure Key Vault (see
   `docs/runbooks/add-project.md` for the exact `az keyvault` commands).

3. **Deploy the template** to the VM:
   ```bash
   PROJECT=<name>
   N=<index>
   ssh azureuser@<vm-ip>
   sudo mkdir -p /opt/supabase-${PROJECT}
   # Copy docker-compose.template.yml → /opt/supabase-${PROJECT}/docker-compose.yml
   ```

4. **Set env vars** in `/opt/supabase-${PROJECT}/.env`:
   ```
   PROJECT_NAME=<name>
   KONG_PORT=8${N}00
   STUDIO_PORT=3${N}00
   # Secrets are written automatically by secret-loader.service on boot
   ```

5. **Update Caddy** — add two reverse-proxy blocks in `infra/vm/Caddyfile`
   and reload: `systemctl reload caddy`.

6. **Start the stack**:
   ```bash
   docker compose -f /opt/supabase-${PROJECT}/docker-compose.yml up -d
   ```

## Secret Loading

The `supabase-secret-loader` systemd service writes
`/opt/supabase-<project>/.env` from Azure Key Vault **before** Docker starts
on every boot. Secrets are never stored on disk in plaintext between reboots.

## Services Included

| Service | Image | Purpose |
|---------|-------|---------|
| `db` | `supabase/postgres:15.8.1.060` | PostgreSQL with Supabase extensions |
| `kong` | `kong:2.8.1` | API gateway — routes `/rest/`, `/auth/`, `/storage/` |
| `auth` | `supabase/gotrue:v2.170.0` | Authentication (email/password, OAuth, magic link) |
| `rest` | `postgrest/postgrest:v12.2.3` | Auto-generated REST API from schema |
| `realtime` | `supabase/realtime:v2.34.47` | WebSocket subscriptions |
| `storage` | `supabase/storage-api:v1.22.5` | File storage API |
| `imgproxy` | `darthsim/imgproxy:v3.8.0` | On-the-fly image transformation |
| `meta` | `supabase/postgres-meta:v0.84.2` | Postgres metadata API (used by Studio) |
| `studio` | `supabase/studio:20250317-6955350` | Dashboard UI |

## SMTP (Email Delivery)

GoTrue (auth service) uses Resend as the SMTP provider. Set these in `.env`:

```
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=<resend-api-key>
SMTP_SENDER_NAME=<your-app-name>
```

Leave blank to disable transactional email (magic links, confirmations).
