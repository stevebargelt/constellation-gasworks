#!/usr/bin/env bash
# Unit test for the sed patch in load-secrets.sh that writes the New Relic
# Infrastructure Agent license key into /etc/newrelic-infra.yml.
#
# Tests the exact substitution: sed -i "s/^license_key:.*$/license_key: <key>/"
# Does NOT test az-keyvault-fetch or systemctl paths (those require live Azure/VM).
set -euo pipefail

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# The fixture matches cloud-init.yaml's write_files entry for /etc/newrelic-infra.yml
FIXTURE='license_key: ""
display_name: constellation-vm
log_file: /var/log/newrelic-infra/newrelic-infra.log'

apply_sed() {
  local key="$1" file="$2"
  sed -i "s/^license_key:.*$/license_key: ${key}/" "$file"
}

# Test 1: alphanumeric key is written into the empty license_key field
f="$TMPDIR/nr1.yml"
printf '%s\n' "$FIXTURE" > "$f"
KEY="ABC123XYZ456"
apply_sed "$KEY" "$f"
if grep -q "^license_key: ${KEY}$" "$f"; then
  pass "alphanumeric key written to empty license_key field"
else
  fail "alphanumeric key not written; got: $(grep license_key "$f")"
fi

# Test 2: NR license key format (eu/us prefix + NRAL suffix, no slashes)
f="$TMPDIR/nr2.yml"
printf '%s\n' "$FIXTURE" > "$f"
KEY="eu01xxABCDEF1234567890abcdef1234NRAL"
apply_sed "$KEY" "$f"
if grep -q "^license_key: ${KEY}$" "$f"; then
  pass "New Relic-format key (no slashes) handled correctly"
else
  fail "New Relic-format key not written; got: $(grep license_key "$f")"
fi

# Test 3: pre-existing non-empty key is overwritten
f="$TMPDIR/nr3.yml"
printf 'license_key: OLD_KEY_123\ndisplay_name: constellation-vm\n' > "$f"
KEY="NEWKEY456ABC"
apply_sed "$KEY" "$f"
if grep -q "^license_key: ${KEY}$" "$f"; then
  pass "pre-existing key is overwritten"
else
  fail "pre-existing key not overwritten; got: $(grep license_key "$f")"
fi

# Test 4: other fields in the config file are left unchanged
f="$TMPDIR/nr4.yml"
printf '%s\n' "$FIXTURE" > "$f"
KEY="TEST123KEY"
apply_sed "$KEY" "$f"
if grep -q "^display_name: constellation-vm$" "$f" && \
   grep -q "^log_file: /var/log/newrelic-infra/newrelic-infra.log$" "$f"; then
  pass "non-license_key lines are unchanged"
else
  fail "non-license_key lines were modified; file contents: $(cat "$f")"
fi

# Summary
echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ]
