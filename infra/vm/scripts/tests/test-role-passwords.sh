#!/usr/bin/env bash
# Unit tests for the internal role password logic in cloud-init.yaml post-start block.
#
# Tests password extraction from .env, SQL-safe single-quote escaping, and the
# set of roles covered. No Docker, no live DB — deploy-gated paths are excluded.
set -euo pipefail

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Mirrors the extraction logic in cloud-init.yaml post-start block.
extract_pg_password() {
  local env_file="$1"
  grep '^POSTGRES_PASSWORD=' "$env_file" | cut -d= -f2- || true
}

# Mirrors the SQL-safe quoting: escape single quotes by doubling them.
sql_quote() {
  printf '%s' "$1" | sed "s/'/''/g"
}

# Generates the role-password SQL block (same logic as cloud-init.yaml).
generate_role_sql() {
  local pw_sql="$1"
  printf '%s\n' \
    "ALTER USER supabase_auth_admin WITH PASSWORD '${pw_sql}';" \
    "ALTER USER supabase_storage_admin WITH PASSWORD '${pw_sql}';" \
    "ALTER USER authenticator WITH PASSWORD '${pw_sql}';" \
    "ALTER USER supabase WITH PASSWORD '${pw_sql}';"
}

# Test 1: standard alphanumeric password is extracted correctly
f="$TMPDIR/env1"
printf 'POSTGRES_PASSWORD=ABCDEFGHabcdefgh1234\nJWT_SECRET=other\n' > "$f"
result=$(extract_pg_password "$f")
if [ "$result" = "ABCDEFGHabcdefgh1234" ]; then
  pass "standard password extracted correctly"
else
  fail "standard password: expected 'ABCDEFGHabcdefgh1234', got '$result'"
fi

# Test 2: password with = signs (base64 padding) is fully extracted via cut -d= -f2-
f="$TMPDIR/env2"
printf 'POSTGRES_PASSWORD=abc=def==\n' > "$f"
result=$(extract_pg_password "$f")
if [ "$result" = "abc=def==" ]; then
  pass "password with = signs fully extracted (cut -d= -f2- preserves them)"
else
  fail "password with =: expected 'abc=def==', got '$result'"
fi

# Test 3: anchored grep prevents matching SOME_POSTGRES_PASSWORD
f="$TMPDIR/env3"
printf 'SOME_POSTGRES_PASSWORD=wrong\nPOSTGRES_PASSWORD=correct\n' > "$f"
result=$(extract_pg_password "$f")
if [ "$result" = "correct" ]; then
  pass "anchored grep (^POSTGRES_PASSWORD=) extracts the right variable"
else
  fail "anchored grep: expected 'correct', got '$result'"
fi

# Test 4: POSTGRES_PASSWORD not in file → extraction returns empty
f="$TMPDIR/env4"
printf 'JWT_SECRET=other\nANON_KEY=abc\n' > "$f"
result=$(extract_pg_password "$f")
if [ -z "$result" ]; then
  pass "missing POSTGRES_PASSWORD → extraction returns empty (triggers error guard)"
else
  fail "missing POSTGRES_PASSWORD: expected empty, got '$result'"
fi

# Test 5: single quote in password is SQL-escaped by doubling
escaped=$(sql_quote "it's")
if [ "$escaped" = "it''s" ]; then
  pass "single quote in password is doubled for SQL safety"
else
  fail "single-quote escaping: expected \"it''s\", got '$escaped'"
fi

# Test 6: password without quotes is unchanged by sql_quote
escaped=$(sql_quote "NoQuotesHere123")
if [ "$escaped" = "NoQuotesHere123" ]; then
  pass "password without quotes is unchanged by sql_quote"
else
  fail "sql_quote without quotes: expected 'NoQuotesHere123', got '$escaped'"
fi

# Test 7: multiple single quotes are each doubled
escaped=$(sql_quote "a'b'c")
if [ "$escaped" = "a''b''c" ]; then
  pass "multiple single quotes each doubled"
else
  fail "multiple single quotes: expected \"a''b''c\", got '$escaped'"
fi

# Test 8–11: all four roles that connect via TCP appear in the generated SQL
sql=$(generate_role_sql "testpass")
for role in supabase_auth_admin supabase_storage_admin authenticator supabase; do
  if printf '%s' "$sql" | grep -qF "ALTER USER ${role} WITH PASSWORD"; then
    pass "role ${role} covered in generated SQL"
  else
    fail "role ${role} MISSING from generated SQL"
  fi
done

# Test 12: the password value appears in the generated SQL (round-trip check)
sql=$(generate_role_sql "mypassword123")
if printf '%s' "$sql" | grep -qF "WITH PASSWORD 'mypassword123'"; then
  pass "password value appears correctly in generated SQL"
else
  fail "password value not found in generated SQL"
fi

# Test 13: sql_quote output integrates correctly with generate_role_sql
escaped=$(sql_quote "pass'word")
sql=$(generate_role_sql "$escaped")
if printf '%s' "$sql" | grep -qF "WITH PASSWORD 'pass''word'"; then
  pass "sql_quote + generate_role_sql produce valid SQL for password with quote"
else
  fail "sql_quote + generate_role_sql: expected WITH PASSWORD 'pass''word' in SQL"
fi

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ]
