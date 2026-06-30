#!/usr/bin/env bash
# Pre-start guard for caddy.service: verifies the data disk is mounted and
# Caddy's cert directory exists with correct ownership. Called via
# ExecStartPre=+ in caddy.service.d/data-disk.conf, so it runs as root.
#
# Exits non-zero to block Caddy if /mnt/data is not mounted, preventing
# spurious ACME certificate requests that would burn the 5-cert/168h rate limit.
#
# CADDY_CHECK_MOUNT env var overrides the mount path (used in tests).
set -euo pipefail

MOUNT="${CADDY_CHECK_MOUNT:-/mnt/data}"
CERT_DIR="${MOUNT}/caddy"

if ! mountpoint -q "$MOUNT"; then
  echo "FATAL [check-caddy-cert-dir]: $MOUNT is not a mountpoint." >&2
  echo "FATAL [check-caddy-cert-dir]: Data disk may be detached or failed to mount." >&2
  echo "FATAL [check-caddy-cert-dir]: Caddy will NOT start — attach the disk, then: mount -a && systemctl start caddy" >&2
  exit 1
fi

if [ ! -d "$CERT_DIR" ]; then
  echo "[check-caddy-cert-dir] $CERT_DIR missing — creating with caddy ownership." >&2
  mkdir -p "$CERT_DIR"
  chown caddy:caddy "$CERT_DIR"
  chmod 750 "$CERT_DIR"
fi

owner=$(stat -c '%U' "$CERT_DIR" 2>/dev/null) || owner="(unknown)"
if [ "$owner" != "caddy" ]; then
  echo "[check-caddy-cert-dir] WARNING: $CERT_DIR owned by '$owner', correcting to caddy." >&2
  chown caddy:caddy "$CERT_DIR"
fi

echo "[check-caddy-cert-dir] OK: $CERT_DIR on mounted $MOUNT."
