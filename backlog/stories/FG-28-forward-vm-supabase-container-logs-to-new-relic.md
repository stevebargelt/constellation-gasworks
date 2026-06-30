---
id: FG-28
type: story
status: active
title: Forward VM + Supabase container logs to New Relic
created: 2026-06-30
---

**Epic:** FG-25

Host metrics (FG-6) cover resource usage but not logs. Forward systemd journal + Supabase container logs to NR Logs so failures are searchable centrally.

**Acceptance criteria:**
- [ ] NR Infra agent log forwarding (or fluent-bit) ships journald + docker container logs to New Relic
- [ ] Backup script + secret-loader logs included
- [ ] Logs queryable in NR; linked to the host entity
- [ ] Configured in cloud-init / load-secrets, idempotent