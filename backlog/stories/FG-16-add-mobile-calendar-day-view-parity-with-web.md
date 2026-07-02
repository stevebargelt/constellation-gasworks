---
id: FG-16
type: story
status: active
title: Add mobile calendar day view (parity with web)
created: 2026-06-30
---

**Epic:** FG-2 (calendar) / FG-3 (parity)

Mobile has month/week (app/calendar/views.tsx) but no day view; web has one. PRD §4 requires month/week/day on both.

**Acceptance criteria:**
- [ ] Mobile day view renders the day's events with overlay color-coding
- [ ] Navigation between month/week/day consistent with web
- [ ] Free/Busy + private-event masking honored