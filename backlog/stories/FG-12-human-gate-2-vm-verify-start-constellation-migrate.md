---
id: FG-12
type: story
status: active
title: "[HUMAN] Gate 2 — VM verify + start constellation + migrate"
created: 2026-06-30
---

**Epic:** FG-1 (cutover) · **Manual / needs-human**

Ref: docs/plans/co-kkd.md Gate 2. Depends on Gate 1.

**Acceptance criteria:**
- [ ] SSH in; cloud-init log clean (Docker, Caddy, Azure CLI, NR infra installed); Caddy running
- [ ] secret-loader wrote /opt/supabase-constellation/.env correctly; `docker compose up -d` → all containers healthy
- [ ] `curl -I https://constellation.db.harebrained-apps.com/rest/v1/` returns 200; Studio reachable
- [ ] All 11 migrations applied via FG-8 tunnel path