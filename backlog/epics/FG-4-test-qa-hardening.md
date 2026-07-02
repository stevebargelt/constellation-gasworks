---
id: FG-4
type: epic
status: active
title: Test & QA hardening
created: 2026-06-30
---

Pre-launch test coverage is thin: 4 unit-test files, all in packages/utils. Zero integration, component, hook, or E2E tests. The RLS/permission model is the security boundary and README explicitly calls privacy bugs P0 — those paths need automated coverage before launch. Build out integration tests (RLS/permission boundaries), hook tests (the 9 realtime data hooks), and E2E smoke tests (auth, calendar, tasks, realtime) on web.