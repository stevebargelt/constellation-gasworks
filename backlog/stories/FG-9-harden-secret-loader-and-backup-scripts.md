---
id: FG-9
type: story
status: active
title: Harden secret-loader and backup scripts
created: 2026-06-30
---

**Epic:** FG-1 (cutover) · **CODE-COMPLETE — committed; AC3 live-run verification deploy-gated (FG-10/Gate 3)**

load-secrets.sh and backup.sh had brittle spots (silent DB_PORT default, narrow critical-secret set). Hardened both; embedded cloud-init copies kept in sync.

**Implemented (run-fg-9-harden-secret-loader-backup-scripts-6bf167):**
- [x] AC1: per-project DB_PORT written to .env (5432+index); backup.sh FAILS HARD if DB_PORT missing — covered by test-backup-db-port.sh (6 tests)
- [x] AC2: CRITICAL_SECRETS expanded with SMTP_HOST/SMTP_PASS/DASHBOARD_PASSWORD (boot fails loudly if missing) — covered by test-critical-secrets.sh (7 tests)
- [x] AC3 (static): backup.sh logic reviewed correct — gzip pipe, backups/constellation/<date>.sql.gz path, managed identity (--auth-mode login). LIVE run (pg_dump + blob upload) is deploy-gated → verified by FG-10 + Gate 3.
- 17/17 shell tests pass in Linux/CI (ubuntu-latest). Tests are GNU-bash/sed targeted (VM-only; don't run on macOS — expected).

Follow-up filed: bootstrap-secrets runbook completeness (new scope from review).