---
id: FG-30
type: story
status: active
title: Move Postgres (and other stateful) data onto the persistent disk
created: 2026-06-30
---

**Epic:** FG-1 (cutover) · **HIGH** · **PR-ready (code-complete) — deploy-verification at Gate 2**

Postgres/storage/db-config data moved off the ephemeral OS disk onto the persistent /mnt/data disk so it survives VM recreation.

**Implemented (run-fg-30-*):**
- [x] Audited stateful volumes: db-data, db-config, storage-data (Kong vol is ro/regenerated — left alone).
- [x] All three now Docker local-driver bind volumes → /mnt/data/supabase-constellation/{db,db-config,storage} (keeps Docker volume semantics; avoids raw-bind Postgres perm trap).
- [x] cloud-init creates the dirs; check-supabase-data-dirs.sh + ExecStartPre on supabase-stack.service FAIL CLOSED if /mnt/data isn't mounted (mirrors FG-7).
- [x] 27 shell tests pass in CI; runbook (initial-setup.md) + add-project.md updated.
- [ ] **Gate 2 verification (deploy-gated):** start stack on provisioned VM — confirm Postgres + storage init successfully on the bind-mounted dirs (KEY RISK: dirs created root-owned 0755; relies on supabase/postgres entrypoint to chown — if Postgres errors on data-dir perms/ownership, adjust). Confirm data lands under /mnt/data.
- [ ] **Gate 3 verification:** recreate VM, reattach disk, confirm DB + uploads persist.

Docs impact: updated (operator_behavior_changed — data location + fail-closed stack start). Branch infra/fg-30-data-persistence.