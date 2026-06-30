---
id: FG-20
type: story
status: active
title: Integration tests for RLS / permission boundaries
created: 2026-06-30
---

**Epic:** FG-4 (testing) · privacy is P0

The get_permission() RLS layer is the privacy security boundary. Needs automated coverage proving isolation.

**Acceptance criteria:**
- [ ] Tests prove: None partners see nothing; Free/Busy partners see busy-blocks but not details; Full partners see details
- [ ] Private events/tasks visible only to owner regardless of grants
- [ ] Removing a relationship immediately revokes coordination access
- [ ] Metamours invisible by default; visible only on explicit grant
- [ ] Runs against a local Supabase instance in CI