#!/usr/bin/env bash
# backup.sh — daily pg_dump + Azure Blob upload for all registered Supabase projects
#
# Runs as a systemd oneshot service (supabase-backup.service).
# Authenticates to Azure Blob Storage via the VM's managed identity — no storage key needed.
#
# Configuration:
#   PROJECTS        Space-separated list of project names (default: "constellation")
#   STORAGE_ACCOUNT Azure storage account name (default: read from /etc/supabase-backup.conf)
#   BLOB_CONTAINER  Container name for backups (default: "backups")
#
# Each project must have a .env file at /opt/supabase-{project}/.env containing:
#   POSTGRES_PASSWORD=...

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PROJECTS="${PROJECTS:-constellation}"
BLOB_CONTAINER="${BLOB_CONTAINER:-backups}"
BACKUP_DATE="$(date -u +%Y-%m-%d)"
LOG_PREFIX="[supabase-backup]"

# Load storage account name from config file if not set in environment
if [[ -z "${STORAGE_ACCOUNT:-}" ]]; then
  CONF_FILE="/etc/supabase-backup.conf"
  if [[ -f "$CONF_FILE" ]]; then
    # shellcheck source=/dev/null
    source "$CONF_FILE"
  fi
fi

if [[ -z "${STORAGE_ACCOUNT:-}" ]]; then
  echo "$LOG_PREFIX ERROR: STORAGE_ACCOUNT is not set and /etc/supabase-backup.conf not found" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log() {
  echo "$LOG_PREFIX $(date -u +%H:%M:%S) $*"
}

err() {
  echo "$LOG_PREFIX ERROR: $*" >&2
}

backup_project() {
  local project="$1"
  local env_file="/opt/supabase-${project}/.env"
  local blob_path="backups/${project}/${BACKUP_DATE}.sql.gz"
  local tmp_dump
  tmp_dump="$(mktemp /tmp/supabase-backup-XXXXXX.sql.gz)"

  log "Starting backup for project: $project"

  # Load project env to get POSTGRES_PASSWORD
  if [[ ! -f "$env_file" ]]; then
    err "Env file not found for project $project: $env_file"
    return 1
  fi

  local postgres_password=""
  postgres_password="$(grep -E '^POSTGRES_PASSWORD=' "$env_file" | cut -d= -f2- | tr -d '"' | tr -d "'")"

  if [[ -z "$postgres_password" ]]; then
    err "POSTGRES_PASSWORD not found in $env_file"
    return 1
  fi

  # Determine Postgres port — each project's postgres runs on a unique port.
  # Convention: constellation=5432, proto-a=5433, proto-b=5434, etc.
  # The port is written to the env file as DB_PORT by the secret loader.
  local db_port=""
  db_port="$(grep -E '^DB_PORT=' "$env_file" | cut -d= -f2- | tr -d '"' | tr -d "'" || echo "")"
  db_port="${db_port:-5432}"

  # Run pg_dump inside the project's postgres container
  log "Running pg_dump for $project on port $db_port..."
  PGPASSWORD="$postgres_password" pg_dump \
    --host=127.0.0.1 \
    --port="$db_port" \
    --username=postgres \
    --no-owner \
    --clean \
    --if-exists \
    --format=plain \
    postgres \
    | gzip \
    > "$tmp_dump"

  log "pg_dump complete for $project ($(du -sh "$tmp_dump" | cut -f1))"

  # Upload to Azure Blob Storage using managed identity (no --account-key needed)
  log "Uploading to az://${STORAGE_ACCOUNT}/${BLOB_CONTAINER}/${blob_path}..."
  az storage blob upload \
    --account-name "$STORAGE_ACCOUNT" \
    --container-name "$BLOB_CONTAINER" \
    --name "${project}/${BACKUP_DATE}.sql.gz" \
    --file "$tmp_dump" \
    --auth-mode login \
    --overwrite

  log "Upload complete for $project -> $blob_path"

  rm -f "$tmp_dump"
  log "Backup finished for project: $project"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

log "Backup run starting. Projects: $PROJECTS"

overall_exit=0
for project in $PROJECTS; do
  if ! backup_project "$project"; then
    err "Backup FAILED for project: $project"
    overall_exit=1
  fi
done

if [[ "$overall_exit" -eq 0 ]]; then
  log "All backups completed successfully."
else
  err "One or more backups failed. Check logs above."
fi

exit "$overall_exit"
