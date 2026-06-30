#!/usr/bin/env bash
# Unit tests for the critical-secret validation logic in load-secrets.sh.
#
# Tests the missing-secret detection in isolation — no az keyvault calls needed.
# Runtime paths (az keyvault, systemctl) are deploy-gated (Gate 2/3).
set -euo pipefail

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

CRITICAL_SECRETS=(JWT_SECRET ANON_KEY SERVICE_ROLE_KEY POSTGRES_PASSWORD SMTP_HOST SMTP_PASS DASHBOARD_PASSWORD)

# Mirrors the validation loop in load-secrets.sh.
# Args: KEY=value pairs representing fetched_values.
# Returns 0 if all CRITICAL_SECRETS are present and non-empty, 1 if any are missing.
check_critical() {
  declare -A vals=()
  for kv in "$@"; do
    vals["${kv%%=*}"]="${kv#*=}"
  done
  local missing=()
  for cs in "${CRITICAL_SECRETS[@]}"; do
    if [[ -z "${vals[$cs]:-}" ]]; then
      missing+=("$cs")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "FATAL: missing critical secrets: ${missing[*]}" >&2
    return 1
  fi
  return 0
}

# Test 1: all required secrets present → validation passes
if check_critical \
  JWT_SECRET=jwt ANON_KEY=anon SERVICE_ROLE_KEY=svc POSTGRES_PASSWORD=pg \
  SMTP_HOST=smtp.resend.com SMTP_PASS=re_key DASHBOARD_PASSWORD=dashpass \
  2>/dev/null; then
  pass "all required secrets present → validation passes"
else
  fail "all required secrets present but validation failed"
fi

# Test 2: SMTP_HOST missing → validation fails
if ! check_critical \
  JWT_SECRET=jwt ANON_KEY=anon SERVICE_ROLE_KEY=svc POSTGRES_PASSWORD=pg \
  SMTP_PASS=re_key DASHBOARD_PASSWORD=dashpass \
  2>/dev/null; then
  pass "SMTP_HOST missing → validation fails"
else
  fail "SMTP_HOST missing but validation passed"
fi

# Test 3: SMTP_PASS missing → validation fails
if ! check_critical \
  JWT_SECRET=jwt ANON_KEY=anon SERVICE_ROLE_KEY=svc POSTGRES_PASSWORD=pg \
  SMTP_HOST=smtp.resend.com DASHBOARD_PASSWORD=dashpass \
  2>/dev/null; then
  pass "SMTP_PASS missing → validation fails"
else
  fail "SMTP_PASS missing but validation passed"
fi

# Test 4: DASHBOARD_PASSWORD missing → validation fails
if ! check_critical \
  JWT_SECRET=jwt ANON_KEY=anon SERVICE_ROLE_KEY=svc POSTGRES_PASSWORD=pg \
  SMTP_HOST=smtp.resend.com SMTP_PASS=re_key \
  2>/dev/null; then
  pass "DASHBOARD_PASSWORD missing → validation fails"
else
  fail "DASHBOARD_PASSWORD missing but validation passed"
fi

# Test 5: JWT_SECRET missing → validation fails (original required secrets enforced)
if ! check_critical \
  ANON_KEY=anon SERVICE_ROLE_KEY=svc POSTGRES_PASSWORD=pg \
  SMTP_HOST=smtp.resend.com SMTP_PASS=re_key DASHBOARD_PASSWORD=dashpass \
  2>/dev/null; then
  pass "JWT_SECRET missing → validation fails (original required secrets still enforced)"
else
  fail "JWT_SECRET missing but validation passed"
fi

# Test 6: POSTGRES_PASSWORD missing → validation fails
if ! check_critical \
  JWT_SECRET=jwt ANON_KEY=anon SERVICE_ROLE_KEY=svc \
  SMTP_HOST=smtp.resend.com SMTP_PASS=re_key DASHBOARD_PASSWORD=dashpass \
  2>/dev/null; then
  pass "POSTGRES_PASSWORD missing → validation fails"
else
  fail "POSTGRES_PASSWORD missing but validation passed"
fi

# Test 7: multiple secrets missing → error message names all of them
output=$(check_critical JWT_SECRET=jwt 2>&1 || true)
missing_count=$(echo "$output" | grep -oE 'ANON_KEY|SERVICE_ROLE_KEY|POSTGRES_PASSWORD|SMTP_HOST|SMTP_PASS|DASHBOARD_PASSWORD' | wc -l)
if [[ "$missing_count" -eq 6 ]]; then
  pass "multiple missing secrets → all six named in FATAL message"
else
  fail "expected 6 missing secrets in output, got $missing_count; output: $output"
fi

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ]
