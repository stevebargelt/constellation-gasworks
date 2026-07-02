---
id: FG-26
type: story
status: active
title: New Relic alert policies — VM + Supabase containers
created: 2026-06-30
---

**Epic:** FG-25

Define NR alert conditions so degradation pages someone. Targets: VM host (high CPU/mem, low disk, host not reporting), Supabase container health (any of kong/db/auth/rest/realtime/storage down or unhealthy), and the daily backup (alert if no successful backup in 26h).

**Acceptance criteria:**
- [ ] Alert policy + conditions defined as code where possible (NR Terraform provider) or documented in a runbook if click-ops
- [ ] Notification channel configured (email/Slack/etc. — confirm with user)
- [ ] Conditions: host down, disk >85%, mem >90%, any Supabase container unhealthy, backup-missing >26h
- [ ] Verified by triggering at least one condition in a test