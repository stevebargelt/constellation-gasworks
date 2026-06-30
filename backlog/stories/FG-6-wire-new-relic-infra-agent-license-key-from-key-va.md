---
id: FG-6
type: story
status: active
title: Wire New Relic Infra agent license key from Key Vault
created: 2026-06-30
---

**Epic:** FG-1 (cutover) · **CODE-COMPLETE — awaiting deploy verification (blocked on Gate 2/3, FG-12/13)**

The NR Infrastructure agent is installed on the VM by cloud-init but its license key was never populated, so the VM reported no host metrics. Wired the account ingest license key (same value as `VITE_NEW_RELIC_LICENSE_KEY`) onto the VM via Key Vault.

**Implemented (run-fg-6-wire-nr-infra-license-key-8d2fe0):**
- [x] `NR-LICENSE-KEY` Key Vault secret in keyvault.tf (mirrors resend_api_key pattern) + sensitive var + secrets.tfvars.example — `tofu validate` PASSES
- [x] load-secrets.sh fetches it (host-level, outside per-project loop) and seds it into /etc/newrelic-infra.yml; embedded copy in cloud-init.yaml updated too
- [x] `systemctl enable + restart newrelic-infra` after key write (idempotent)
- [x] initial-setup.md Step 3 documents `TF_VAR_NR_LICENSE_KEY` (= browser license key)
- [x] 4 shell tests for the sed patch + CI workflow (.github/workflows/vm-scripts.yml), 4/4 pass
- [ ] **Deploy verification: VM appears in NR Infrastructure dashboard** — verified at Gate 2/3, NOT locally testable. This AC keeps the ticket open.

Known note: sed uses `/` delimiter; safe for alphanumeric NR keys (test 2 asserts the no-slash assumption).