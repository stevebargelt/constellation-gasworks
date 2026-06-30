---
id: FG-8
type: story
status: done
title: Validate Postgres SSH tunnel + supabase db push end-to-end
created: 2026-06-30
closed: 2026-06-30
closed_commit: "7181280"
---

**Epic:** FG-1 (cutover) · **DONE** — migrations applied + verified on the live VM 2026-06-30

- [x] AC1: Gate 2 SSH-tunnel runbook written.
- [x] AC2: all 11 migrations applied to the self-hosted instance (schema_migrations records all 11: 20260408000000..20260409000002).
- [x] AC3: post-migration sanity verified — 18 public tables (relationships, calendar_events, tasks, recipes, ...), get_permission() present, 66 RLS policies, RLS enabled on all 18 tables, 3 field-masking views.
- [x] AC4: Postgres localhost-only (127.0.0.1 bind + no NSG rule).

Gotcha found: db push needs '?sslmode=disable' + local tunnel port 5432 (not 6543). Tracked as a runbook fix (see new ticket).