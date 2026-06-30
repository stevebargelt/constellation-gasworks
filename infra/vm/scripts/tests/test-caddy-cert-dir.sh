#!/usr/bin/env bash
# Tests for check-caddy-cert-dir.sh.
#
# Testable here (no root required): syntax check, exit-1 when mount is absent.
# NOT testable without root: cert-dir creation (mkdir+chown), ownership fix.
# Those paths are validated at deploy time (Gate 2/3 — VM recreation test).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CHECK_SCRIPT="$SCRIPT_DIR/check-caddy-cert-dir.sh"

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR" /dev/shm/caddy' EXIT

# Test 1: syntax check
if bash -n "$CHECK_SCRIPT" 2>/dev/null; then
  pass "check-caddy-cert-dir.sh passes bash -n syntax check"
else
  fail "check-caddy-cert-dir.sh has syntax errors"
fi

# Test 2: exits 1 when MOUNT is not a mountpoint (simulates detached disk).
# $TMPDIR is a real directory but not a mountpoint — mountpoint -q returns 1.
exit_code=0
CADDY_CHECK_MOUNT="$TMPDIR" bash "$CHECK_SCRIPT" >/dev/null 2>&1 || exit_code=$?
if [ "$exit_code" -eq 1 ]; then
  pass "exits 1 when MOUNT is not a mountpoint (detached-disk scenario)"
else
  fail "expected exit 1 for non-mountpoint MOUNT, got $exit_code"
fi

# Test 3: exit-1 output includes the recovery command so operators know what to do
output=$(CADDY_CHECK_MOUNT="$TMPDIR" bash "$CHECK_SCRIPT" 2>&1 || true)
if echo "$output" | grep -q "systemctl start caddy"; then
  pass "exit-1 output includes recovery command hint"
else
  fail "exit-1 output missing recovery hint; got: $output"
fi

# Test 4: wrong-ownership cert dir → WARNING printed (ownership-correction branch).
# /dev/shm is a real tmpfs mountpoint writable without root. Pre-creating
# /dev/shm/caddy (owned by the current user, not caddy) triggers the stat check
# and WARNING message. The subsequent chown fails in this container (no caddy user,
# no root), but the WARNING emission is the testable assertion.
mkdir -p /dev/shm/caddy
output=$(CADDY_CHECK_MOUNT=/dev/shm bash "$CHECK_SCRIPT" 2>&1 || true)
if echo "$output" | grep -q "WARNING.*correcting to caddy"; then
  pass "wrong-ownership cert dir → WARNING message printed (ownership-correction branch reachable)"
else
  fail "ownership-correction branch did not emit WARNING; got: $output"
fi

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ]
