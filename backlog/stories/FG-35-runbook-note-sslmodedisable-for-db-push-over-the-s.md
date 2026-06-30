---
id: FG-35
type: story
status: active
title: "Runbook: note sslmode=disable for db push over the SSH tunnel"
created: 2026-06-30
---

**Epic:** FG-1 (cutover) · small doc fix

When running 'supabase db push' to the self-hosted instance over the SSH tunnel, the CLI defaults to TLS and the direct Postgres connection refuses it → 'tls error (server refused TLS connection)'. The fix is to append '?sslmode=disable' to the --db-url (the SSH tunnel already encrypts the traffic). Also: tunnel on local port 5432 (not 6543 — the CLI treats 6543 as the Supavisor pooler and applies pooler TLS logic).

**Acceptance criteria:**
- [ ] docs/runbooks/initial-setup.md Gate 2 db-push command uses local port 5432 and '?sslmode=disable'.
- [ ] Note the symptom (TLS refused) + fix so the next operator/disaster-recovery doesn't get stuck.

Found while applying the 11 migrations to the live VM on 2026-06-30 (succeeded; schema fully applied: 18 tables, get_permission + 66 RLS policies).