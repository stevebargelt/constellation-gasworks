---
id: FG-29
type: story
status: done
title: Complete bootstrap-secrets list in setup runbook
created: 2026-06-30
closed: 2026-06-30
closed_commit: 2867dea
---

**Epic:** FG-1 (cutover) · **DONE** (2867dea)

Premise correction (verified against keyvault.tf): SMTP_* and DASHBOARD_* are NOT operator-supplied TF_VARs — they're auto-provisioned (SMTP host/port/user/sender hardcoded; SMTP_PASS = var.resend_api_key; dashboard username = 'supabase'; dashboard password = random_password.dashboard, OpenTofu-generated). So no new TF_VAR rows were warranted; adding them would have been false.

**Resolution:** initial-setup.md now explains how every CRITICAL_SECRET is sourced (documented TF_VAR or auto-provisioned), so a net-new operator provisions cleanly with no undocumented required secret — and can retrieve the generated dashboard password via 'az keyvault secret show'. Fixed a stale Step 4 example (missing nr_license_key). secrets.tfvars.example confirmed already complete for the 6 operator-supplied vars.

Cross-check: all CRITICAL_SECRETS covered. No boot-failure risk for a fresh provision.