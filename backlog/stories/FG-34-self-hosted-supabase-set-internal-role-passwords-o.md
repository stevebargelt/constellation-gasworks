---
id: FG-34
type: story
status: active
title: "Self-hosted Supabase: set internal role passwords on fresh DB init"
created: 2026-06-30
---

**Epic:** FG-1 (cutover) · **HIGH** · **PR OPEN (#5) — code-complete; fresh-init proof deploy-gated**

Internal Supabase roles (supabase_auth_admin/storage_admin/authenticator/supabase) created without passwords on fresh init → auth/storage/rest crash-loop (scram). 

- [x] cloud-init post-start block now ALTERs those roles to POSTGRES_PASSWORD as supabase_admin superuser, via 'docker exec -i ... psql' stdin (password not in args/logs), SQL-escaped, idempotent.
- [x] 40/40 vm-scripts tests pass (13 new). Exact SQL already verified LIVE on the VM today (stack recovered, 200s).
- [ ] Fresh-init verification (empty /mnt/data → stack healthy, no manual step) — deploy-gated.

Branch infra/fg-34-role-passwords. infra/vm only → no apply trigger; merge is safe. docs_impact: not needed (no runbook documents a manual step; fix makes the documented flow work).