---
id: FG-14
type: story
status: active
title: Wire conflict-detection warnings into event create/edit
created: 2026-06-30
---

**Epic:** FG-2 (calendar)

`detectConflicts` + test already exist in packages/utils — this is wiring, not building. Surface a warning when a new/edited event overlaps an invited partner's existing commitment (per their permission level), before save.

**Acceptance criteria:**
- [ ] Creating an event overlapping an invited partner's commitment shows a warning before save (web + mobile)
- [ ] Respects permissions (Free/Busy partners produce a busy-block conflict; None partners never leak)
- [ ] Warning is non-blocking (user may proceed) per PRD
- [ ] Hook/integration test covers the conflict path