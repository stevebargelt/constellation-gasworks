# VM Infrastructure — Supabase Self-Hosting

This directory contains the runtime configuration for running one or more
Supabase projects on the Azure VM.

## Directory Layout

```
infra/vm/
├── supabase-template/        ← Per-project Docker Compose template
│   └── docker-compose.yml
├── systemd/                  ← Systemd units deployed by cloud-init
│   ├── supabase-secret-loader.service
│   ├── supabase-backup.service
│   └── supabase-backup.timer
├── scripts/                  ← Scripts invoked by systemd units
│   ├── load-secrets.sh
│   └── backup.sh
├── Caddyfile                 ← Reverse proxy config (TLS + subdomain routing)
└── cloud-init.yaml           ← VM bootstrap (passed as user-data at provision time)
```

## Port Allocation Scheme

Each Supabase project on the VM occupies a fixed port range. The index `N`
starts at **0** for the first project and increments by 1 for each additional
project.

| Service | Port formula | Index 0 (constellation) |
|---------|-------------|------------------------|
| Kong (API gateway) | `8N00` | `8000` |
| Studio (dashboard) | `3N00` | `3000` |

Caddy reverse-proxies the public subdomains to these ports:

| Subdomain | → | Port |
|-----------|---|------|
| `constellation.db.harebrained-apps.com` | → | `8000` (Kong) |
| `studio.constellation.db.harebrained-apps.com` | → | `3000` (Studio) |

### Adding a new project

1. Pick the next index `N` (e.g. `1` for the second project).
2. Copy `supabase-template/` to `/opt/supabase-<project>/`.
3. Set `KONG_PORT=8100`, `STUDIO_PORT=3100`, `PROJECT_NAME=<project>` in the
   project's `.env` (the secret loader writes this automatically if the project
   is added to `PROJECTS` in `load-secrets.sh`).
4. Add two blocks to `/etc/caddy/Caddyfile` (copy the constellation blocks,
   change subdomain and port).
5. Reload Caddy: `systemctl reload caddy`.
6. Start the project: `docker compose -f /opt/supabase-<project>/docker-compose.yml up -d`.

## Secret Loading

The `supabase-secret-loader` systemd service runs **before** Docker on every
boot. It reads secrets from Azure Key Vault (using the VM's managed identity —
no credentials required) and writes `/opt/supabase-<project>/.env`.

Docker Compose reads `.env` via `env_file: .env`, so secrets never need to be
stored in the Compose file or on disk in plaintext between reboots.

## Backups

The `supabase-backup.timer` fires daily at 02:00 UTC. It runs `backup.sh`,
which `pg_dump`s each project's Postgres database, gzips the output, and
uploads it to Azure Blob Storage (`backups/<project>/YYYY-MM-DD.sql.gz`).

Lifecycle policy (configured in OpenTofu):
- `backups/constellation/`: retained 30 days
- `backups/proto-*/`: retained 7 days
