#!/usr/bin/env bash
# Unit tests for the DB_PORT extraction and fail-hard logic in backup.sh.
#
# Tests the grep-based extraction in isolation — no pg_dump, no az, no live VM.
# Runtime paths (az login, pg_dump, blob upload) are deploy-gated (Gate 2/3).
set -euo pipefail

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Mirrors the extraction logic in backup.sh
extract_db_port() {
  local env_file="$1"
  grep -E '^DB_PORT=' "$env_file" | cut -d= -f2- | tr -d '"' | tr -d "'" || true
}

# Test 1: DB_PORT absent → extraction returns empty (fail-hard condition triggered)
f="$TMPDIR/env-no-port"
printf 'POSTGRES_PASSWORD=secret\nANON_KEY=abc\n' > "$f"
result=$(extract_db_port "$f")
if [[ -z "$result" ]]; then
  pass "DB_PORT absent → extraction returns empty (backup would fail hard)"
else
  fail "DB_PORT absent but extraction returned: '$result'"
fi

# Test 2: DB_PORT present → extraction returns correct value
f="$TMPDIR/env-with-port"
printf 'POSTGRES_PASSWORD=secret\nDB_PORT=5432\n' > "$f"
result=$(extract_db_port "$f")
if [[ "$result" == "5432" ]]; then
  pass "DB_PORT=5432 → extraction returns 5432"
else
  fail "DB_PORT=5432 but extraction returned: '$result'"
fi

# Test 3: second project port → extraction returns 5433
f="$TMPDIR/env-port-5433"
printf 'POSTGRES_PASSWORD=secret\nDB_PORT=5433\n' > "$f"
result=$(extract_db_port "$f")
if [[ "$result" == "5433" ]]; then
  pass "DB_PORT=5433 (second project) → extraction returns 5433"
else
  fail "DB_PORT=5433 but extraction returned: '$result'"
fi

# Test 4: DB_PORT with double quotes → stripped correctly
f="$TMPDIR/env-quoted-port"
printf 'DB_PORT="5432"\n' > "$f"
result=$(extract_db_port "$f")
if [[ "$result" == "5432" ]]; then
  pass "DB_PORT with double quotes → stripped to 5432"
else
  fail "DB_PORT with double quotes returned: '$result'"
fi

# Test 5: DB_PORT with single quotes → stripped correctly
f="$TMPDIR/env-singlequoted-port"
printf "DB_PORT='5432'\n" > "$f"
result=$(extract_db_port "$f")
if [[ "$result" == "5432" ]]; then
  pass "DB_PORT with single quotes → stripped to 5432"
else
  fail "DB_PORT with single quotes returned: '$result'"
fi

# Test 6: env file with DB_PORT not first → still extracted
f="$TMPDIR/env-port-not-first"
printf 'POSTGRES_PASSWORD=secret\nSMTP_HOST=smtp.resend.com\nDB_PORT=5432\nANON_KEY=abc\n' > "$f"
result=$(extract_db_port "$f")
if [[ "$result" == "5432" ]]; then
  pass "DB_PORT not first in file → correctly extracted"
else
  fail "DB_PORT not first in file, extraction returned: '$result'"
fi

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ]
