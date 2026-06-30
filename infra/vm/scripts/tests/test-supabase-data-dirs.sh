#!/usr/bin/env bash
# Tests for check-supabase-data-dirs.sh.
#
# Testable here (no root required): syntax check, exit-1 when mount is absent,
# recovery hint in output, dir-creation when mount is valid and dirs are missing.
# NOT testable without root: chown operations, systemctl recovery.
# Real proof (data survives VM recreation) is DEPLOY-GATED at Gate 2/3.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CHECK_SCRIPT="$SCRIPT_DIR/check-supabase-data-dirs.sh"

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

TMPDIR=$(mktemp -d)
SUPABASE_TEST_BASE=/dev/shm/supabase-constellation
trap 'rm -rf "$TMPDIR" "$SUPABASE_TEST_BASE"' EXIT

# Test 1: syntax check
if bash -n "$CHECK_SCRIPT" 2>/dev/null; then
  pass "check-supabase-data-dirs.sh passes bash -n syntax check"
else
  fail "check-supabase-data-dirs.sh has syntax errors"
fi

# Test 2: exits 1 when MOUNT is not a mountpoint (simulates detached disk).
# $TMPDIR is a real directory but not a mountpoint — mountpoint -q returns 1.
exit_code=0
SUPABASE_CHECK_MOUNT="$TMPDIR" bash "$CHECK_SCRIPT" >/dev/null 2>&1 || exit_code=$?
if [ "$exit_code" -eq 1 ]; then
  pass "exits 1 when MOUNT is not a mountpoint (detached-disk scenario)"
else
  fail "expected exit 1 for non-mountpoint MOUNT, got $exit_code"
fi

# Test 3: exit-1 output includes the recovery command so operators know what to do.
output=$(SUPABASE_CHECK_MOUNT="$TMPDIR" bash "$CHECK_SCRIPT" 2>&1 || true)
if echo "$output" | grep -q "systemctl start supabase-stack"; then
  pass "exit-1 output includes recovery command hint"
else
  fail "exit-1 output missing recovery hint; got: $output"
fi

# Test 4: creates db, storage, db-config dirs when mount is valid and dirs are missing.
# /dev/shm is a real tmpfs mountpoint writable without root.
rm -rf "$SUPABASE_TEST_BASE"
output=$(SUPABASE_CHECK_MOUNT=/dev/shm bash "$CHECK_SCRIPT" 2>&1 || true)
created_ok=0
for dir in db storage db-config; do
  [ -d "${SUPABASE_TEST_BASE}/${dir}" ] && created_ok=$((created_ok + 1))
done
if [ "$created_ok" -eq 3 ]; then
  pass "creates db, storage, db-config dirs when mount is valid and dirs are missing"
else
  fail "expected 3 dirs created under $SUPABASE_TEST_BASE, got $created_ok; output: $output"
fi

# Test 5: exits 0 when mount is valid and dirs already exist.
exit_code=0
SUPABASE_CHECK_MOUNT=/dev/shm bash "$CHECK_SCRIPT" >/dev/null 2>&1 || exit_code=$?
if [ "$exit_code" -eq 0 ]; then
  pass "exits 0 when mount is valid and data dirs already exist"
else
  fail "expected exit 0 for valid mount + existing dirs, got $exit_code"
fi

# Test 6: partial-dir state — only db exists; storage and db-config are missing.
# Real-world recovery scenario: partial cleanup or interrupted first start.
# Reuses /dev/shm (a real mountpoint) so SUPABASE_CHECK_MOUNT override still works.
rm -rf "$SUPABASE_TEST_BASE"
mkdir -p "${SUPABASE_TEST_BASE}/db"  # db pre-exists; storage and db-config are absent
output=$(SUPABASE_CHECK_MOUNT=/dev/shm bash "$CHECK_SCRIPT" 2>&1 || true)
created_ok=0
for dir in db storage db-config; do
  [ -d "${SUPABASE_TEST_BASE}/${dir}" ] && created_ok=$((created_ok + 1))
done
if [ "$created_ok" -eq 3 ]; then
  pass "partial-dir state: missing dirs (storage, db-config) created; pre-existing db dir preserved"
else
  fail "partial-dir state: expected 3 dirs under $SUPABASE_TEST_BASE, found $created_ok; output: $output"
fi

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ]
