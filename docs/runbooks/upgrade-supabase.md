# Runbook: Upgrade Supabase Version

**Estimated time:** ~10 minutes per project  
**Cadence:** Check for new releases monthly (first Monday of each month)  
**Prerequisites:** SSH access to the VM

---

## Upgrade Cadence

Supabase publishes self-hosting releases at:  
**https://github.com/supabase/supabase/releases**

Check this page monthly. Patch releases (e.g. `1.x.y` → `1.x.z`) are generally
safe to apply immediately. Minor releases with breaking changes are noted in the
release notes — read them before upgrading.

Subscribe to release notifications on GitHub (Watch → Custom → Releases) to get
notified automatically.

---

## Step 1 — Review Release Notes

Before any upgrade:

1. Go to https://github.com/supabase/supabase/releases
2. Identify the latest release and any releases since your current version
3. Look for **breaking changes** in the release notes, especially for:
   - `supabase/postgres` image updates (may require migration steps)
   - `supabase/gotrue` auth schema changes
   - `supabase/realtime` config format changes
4. If breaking changes apply, follow their specific migration guide first

To check your current image versions:

```bash
ssh azureuser@<vm-public-ip>
docker images | grep supabase
```

---

## Step 2 — Upgrade Each Project

Upgrade projects one at a time. Start with a low-traffic project first.

```bash
ssh azureuser@<vm-public-ip>

# For each project (repeat for every project on the VM):
cd /opt/supabase-<project-name>

# Pull latest images
sudo docker compose pull

# Restart with new images (zero-downtime rolling restart)
sudo docker compose up -d
```

Docker Compose will restart only the containers whose images changed.
Postgres restarts briefly (~5 seconds downtime).

---

## Step 3 — Verify All Containers Healthy

After upgrading each project:

```bash
cd /opt/supabase-<project-name>
sudo docker compose ps
```

All containers should show `Up` or `Up (healthy)`. If any show `Restarting`
or `Exit`, check logs:

```bash
sudo docker compose logs <service-name> --tail=50
```

Wait up to 60 seconds for Postgres to fully initialize before checking other
services.

---

## Step 4 — Run Smoke Test

Verify the API responds after upgrade:

```bash
# API health check
curl -s https://<project>.db.harebrained-apps.com/health | jq .

# Auth endpoint
curl -s https://<project>.db.harebrained-apps.com/auth/v1/health | jq .

# Quick query (requires anon key from .env)
ANON_KEY=$(grep ANON_KEY /opt/supabase-<project>/.env | cut -d= -f2)
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "https://<project>.db.harebrained-apps.com/rest/v1/" | jq .
```

Expected: `{"status":"ok"}` from health endpoints, 200 from REST.

---

## Rollback Procedure

If the upgrade causes problems, roll back to the previous image tags:

```bash
cd /opt/supabase-<project-name>

# Edit docker-compose.yml to pin the previous version tag
sudo nano docker-compose.yml
# Change e.g. supabase/postgres:15.8.1.060 back to the previous tag

# Redeploy with pinned versions
sudo docker compose up -d

# Verify recovery
sudo docker compose ps
```

Previous image layers are cached locally, so rollback is fast (no re-download).

---

## Upgrade All Projects: Quick Script

For upgrading all projects in sequence:

```bash
ssh azureuser@<vm-public-ip>

for dir in /opt/supabase-*/; do
  project=$(basename "$dir" | sed 's/supabase-//')
  echo "=== Upgrading $project ==="
  cd "$dir"
  sudo docker compose pull
  sudo docker compose up -d
  sleep 30  # Let containers stabilize before moving to next project
  sudo docker compose ps
  echo ""
done
```

---

## Checklist

- [ ] Reviewed release notes for breaking changes
- [ ] Pulled latest images for all projects
- [ ] All containers show `Up` after restart
- [ ] Health endpoints return `{"status":"ok"}`
- [ ] Studio accessible at `studio.<project>.db.harebrained-apps.com`
- [ ] Auth flow works (test sign-in if possible)

---

## References

- Supabase self-hosting changelog: https://github.com/supabase/supabase/releases
- Supabase self-hosting docs: https://supabase.com/docs/guides/self-hosting/docker
- Docker Compose image update guide: https://docs.docker.com/compose/how-tos/start-containers-automatically/
