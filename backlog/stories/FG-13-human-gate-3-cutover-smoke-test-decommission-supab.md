---
id: FG-13
type: story
status: active
title: "[HUMAN] Gate 3 — cutover, smoke test, decommission Supabase Cloud"
created: 2026-06-30
---

**Epic:** FG-1 (cutover) · **Manual / needs-human**

Ref: docs/plans/co-kkd.md Gate 3. Depends on Gate 2. This closes the epic.

**Acceptance criteria:**
- [ ] Google OAuth redirect URI added; Vercel env (URL + anon key) updated + redeployed; local/mobile .env updated
- [ ] Full smoke test passes: email/password + Google auth (web + mobile); all 9 realtime hooks deliver <2s; storage upload/download; RLS isolation between two users
- [ ] NR (browser + mobile + infra) and PostHog show data
- [ ] Backup verified in Blob; restore tested (ties to FG-10); Azure spend ≤ $80/mo confirmed
- [ ] Supabase Cloud project cancelled (paused 30 days before deletion)