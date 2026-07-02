---
id: FG-1
type: epic
status: active
title: Finish self-hosted Supabase cutover (co-kkd)
created: 2026-06-30
---

Live backend direction: self-hosted Supabase on an Azure B2ms VM (OpenTofu + Caddy + daily pg_dump→Blob backups). IaC, cloud-init, and runbooks are written and merged; the last several commits are cutover debugging. Remaining work is a few code/config fixes plus the three human gates (provision → VM verify → cutover/smoke test). Source of truth: docs/plans/co-kkd.md.

**Goal:** Constellation runs entirely on self-hosted Supabase at constellation.db.harebrained-apps.com; Supabase Cloud decommissioned; Azure spend ≤ $80/mo; all 9 realtime hooks live.

**This is the top-priority epic — finish the cutover before app polish.**

The competing Azure-native PRD (ec-m9r0wf) is SUPERSEDED — see hygiene epic to archive it.