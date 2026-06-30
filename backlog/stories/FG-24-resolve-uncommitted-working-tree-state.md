---
id: FG-24
type: story
status: active
title: Resolve uncommitted working-tree state
created: 2026-06-30
---

**Epic:** FG-5 (hygiene)

Working tree has uncommitted CLAUDE.md, .forge/, backlog/, and a modified .gitignore from the gastown cleanup. Decide what's tracked vs ignored and commit, so the repo is clean.

**Acceptance criteria:**
- [ ] CLAUDE.md, .forge/, backlog/ either committed or gitignored per intent (forge orchestrator state is typically committed; runtime caches ignored)
- [ ] .gitignore change reviewed and committed
- [ ] `git status` clean afterward