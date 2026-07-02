---
id: FG-22
type: story
status: active
title: Web E2E smoke tests (auth, calendar, tasks, realtime)
created: 2026-06-30
---

**Epic:** FG-4 (testing)

No E2E coverage. Add Playwright smoke tests for the critical paths so regressions are caught pre-deploy.

**Acceptance criteria:**
- [ ] E2E: sign up / sign in (email+password)
- [ ] E2E: create event, invite partner, RSVP, see realtime update
- [ ] E2E: create task list, assign task, complete it
- [ ] Wired into CI (.spec.ts), green