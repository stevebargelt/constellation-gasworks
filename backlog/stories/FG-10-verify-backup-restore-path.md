---
id: FG-10
type: story
status: active
title: Verify backup restore path
created: 2026-06-30
---

**Epic:** FG-1 (cutover)

restore-backup.md exists but the restore path has never been exercised; an unrestorable backup is data-loss waiting to happen.

**Acceptance criteria:**
- [ ] A real backup is downloaded, decompressed, and restored to a throwaway Postgres; row counts in key tables verified
- [ ] Any gaps in restore-backup.md corrected against the actual run
- [ ] (Stretch) a scheduled CI job that restores the latest backup to a shadow DB and asserts row counts