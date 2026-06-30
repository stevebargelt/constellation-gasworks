#!/usr/bin/env bash
# Pre-start guard for supabase-stack.service: verifies the data disk is mounted
# and Supabase data directories exist under /mnt/data. Called via ExecStartPre=+
# in supabase-stack.service, so it runs as root.
#
# Exits non-zero to block the stack if /mnt/data is not mounted, preventing
# Postgres from initializing against ephemeral storage and silently losing data
# on VM recreation.
#
# SUPABASE_CHECK_MOUNT env var overrides the mount path (used in tests).
set -euo pipefail

MOUNT="${SUPABASE_CHECK_MOUNT:-/mnt/data}"
BASE_DIR="${MOUNT}/supabase-constellation"

if ! mountpoint -q "$MOUNT"; then
  echo "FATAL [check-supabase-data-dirs]: $MOUNT is not a mountpoint." >&2
  echo "FATAL [check-supabase-data-dirs]: Data disk may be detached or failed to mount." >&2
  echo "FATAL [check-supabase-data-dirs]: Supabase stack will NOT start — attach the disk, then: mount -a && systemctl start supabase-stack" >&2
  exit 1
fi

for dir in db storage db-config; do
  target="${BASE_DIR}/${dir}"
  if [ ! -d "$target" ]; then
    echo "[check-supabase-data-dirs] $target missing — creating." >&2
    mkdir -p "$target"
    chmod 755 "$target"
  fi
done

echo "[check-supabase-data-dirs] OK: $BASE_DIR on mounted $MOUNT."
