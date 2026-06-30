---
id: FG-17
type: story
status: active
title: Mobile relationship detail screen
created: 2026-06-30
---

**Epic:** FG-3 (parity)

TODO in app/constellation.tsx references a missing app/relationships/[id].tsx detail screen. Web edits permissions on a detail surface; mobile only has inline list editing.

**Acceptance criteria:**
- [ ] app/relationships/[id].tsx exists: shows the person, relationship type, per-resource permission editor, remove-with-confirm
- [ ] Reachable from the constellation graph + relationships list
- [ ] Permission changes take effect in realtime