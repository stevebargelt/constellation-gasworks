# Runbook: Restore Supabase Database from Backup

**Estimated time:** ~15 minutes (plus restore time, which scales with DB size)  
**Prerequisites:** SSH access to the VM, Azure CLI (`az`) authenticated with managed identity

> ⚠️ **WARNING: Restore is destructive.**  
> The `pg_restore` / `psql` restore process **drops and recreates all tables** in the
> target database. Do NOT run this against a live production database without first
> stopping the application. Always restore to a test database first and verify before
> touching production.

---

## When to Use This Runbook

- Accidental data deletion (rows, tables)
- Database corruption
- Testing backup integrity (monthly recommended)
- Migrating to a new Postgres instance

---

## Step 1 — Identify the Backup to Restore

List available backups for a project in Azure Blob Storage. The VM's managed
identity handles authentication automatically — no storage key needed.

```bash
ssh azureuser@<vm-public-ip>

PROJECT=<project-name>          # e.g. "constellation"
STORAGE_ACCOUNT=<storage-acct>  # e.g. "stconstellationtfstate" — from tofu outputs

# List all backups for the project, most recent first
az storage blob list \
  --auth-mode login \
  --account-name $STORAGE_ACCOUNT \
  --container-name backups \
  --prefix "${PROJECT}/" \
  --query "[].{name:name, modified:properties.lastModified}" \
  --output table | sort -k2 -r
```

Identify the backup date you want to restore (format: `YYYY-MM-DD`).

---

## Step 2 — Download the Backup

```bash
DATE=2026-04-10   # Replace with the backup date you want to restore
BACKUP_FILE="./backup-${PROJECT}-${DATE}.sql.gz"

az storage blob download \
  --auth-mode login \
  --account-name $STORAGE_ACCOUNT \
  --container-name backups \
  --name "${PROJECT}/${DATE}.sql.gz" \
  --file "$BACKUP_FILE"

ls -lh "$BACKUP_FILE"
```

---

## Step 3 — Decompress the Backup

```bash
gunzip "$BACKUP_FILE"
# Result: backup-{project}-{date}.sql (plain SQL dump)
SQL_FILE="./backup-${PROJECT}-${DATE}.sql"
ls -lh "$SQL_FILE"
```

---

## Step 4 — Prepare for Restore

**Stop the application** (Vercel/frontend) before restoring production to prevent
writes during the restore window. For a test restore, skip this.

Get the Postgres password from the project's `.env` file:

```bash
PG_PASSWORD=$(grep POSTGRES_PASSWORD /opt/supabase-${PROJECT}/.env | cut -d= -f2)
```

---

## Step 5 — Restore the Database

> ⚠️ **This will overwrite all data in the target database.**

**Option A: Restore to the same project (production restore):**

```bash
# Stop the project's containers first to prevent concurrent writes
cd /opt/supabase-${PROJECT}
sudo docker compose stop

# Restore (Postgres container keeps running for the restore)
sudo docker compose start db
sleep 10  # Let Postgres finish starting

sudo docker exec -i supabase-${PROJECT}-db-1 \
  psql -U postgres -d postgres \
  < "$SQL_FILE"

# Restart all services
sudo docker compose start
```

**Option B: Restore to a new / test database (safe verification):**

```bash
# Create a test database inside the existing Postgres container
sudo docker exec supabase-${PROJECT}-db-1 \
  psql -U postgres -c "CREATE DATABASE restore_test;"

# Restore into test database
sudo docker exec -i supabase-${PROJECT}-db-1 \
  psql -U postgres -d restore_test \
  < "$SQL_FILE"
```

---

## Step 6 — Verify the Restore

Check row counts in key tables to confirm data integrity:

```bash
sudo docker exec supabase-${PROJECT}-db-1 \
  psql -U postgres -d postgres -c "
    SELECT
      schemaname,
      tablename,
      n_live_tup AS row_count
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY n_live_tup DESC
    LIMIT 20;
  "
```

Compare these counts against expected values (from your last known-good state
or from the source database before the incident).

Also verify the Supabase API responds after restart:

```bash
curl -s https://${PROJECT}.db.harebrained-apps.com/health | jq .
```

---

## Step 7 — Clean Up

Remove the local backup files once the restore is verified:

```bash
rm -f "$SQL_FILE" "${SQL_FILE}.gz"
```

If you created a test database, drop it:

```bash
sudo docker exec supabase-${PROJECT}-db-1 \
  psql -U postgres -c "DROP DATABASE restore_test;"
```

---

## Backup Retention Reference

Lifecycle policy (configured in OpenTofu):

| Path pattern | Retention |
|---|---|
| `backups/constellation/` | 30 days |
| `backups/proto-*/` | 7 days |

Backups older than the retention window are automatically deleted by Azure Blob
Storage lifecycle policy.

---

## Checklist

- [ ] Identified correct backup date and downloaded `.sql.gz`
- [ ] Application stopped (if restoring production)
- [ ] Restore completed without psql errors
- [ ] Row counts in key tables match expectations
- [ ] API health endpoint responds after restart
- [ ] Test database dropped (if Option B used)
- [ ] Local backup file deleted

---

## Troubleshooting

**`psql: error: connection refused`** — Postgres container is not running.
Start it: `sudo docker compose start db && sleep 10`

**`ERROR: role "supabase_admin" does not exist`** — The dump references roles
that don't exist. Run the restore with `--no-owner` flag or restore GoTrue
schema first. Contact witness for escalation.

**Restore takes too long** — Normal for large databases. A 1 GB dump may take
5–15 minutes. Do not interrupt.
