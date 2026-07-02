---
id: FG-2
type: epic
status: active
title: Calendar feature completion
created: 2026-06-30
---

The calendar is the least-complete MVP feature and is core to the product's whole value prop (avoiding calendar-blind conflicts). Conflict-detection logic exists in packages/utils (detectConflicts + test) but is not wired into the event-create UX; RSVP/attendee display is incomplete; mobile lacks a day view. Bring calendar to full PRD spec (docs/prds/constellation-app.md §4) on web + mobile.