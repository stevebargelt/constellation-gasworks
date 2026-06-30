---
id: FG-23
type: story
status: active
title: Archive ec-m9r0wf PRD + update README to self-hosted Supabase
created: 2026-06-30
---

**Epic:** FG-5 (hygiene) · durable docs → documentation-maintainer

README still describes Supabase Cloud; ec-m9r0wf (Azure-native replace-Supabase) is superseded by the self-hosted direction but still present and contradictory.

**Acceptance criteria:**
- [ ] ec-m9r0wf PRD clearly marked SUPERSEDED (header + pointer to co-kkd) or moved to an archive location
- [ ] README backend/deploy sections describe self-hosted Supabase on Azure (VM, Caddy, backups) accurately
- [ ] No remaining doc claims that Supabase Cloud is the backend