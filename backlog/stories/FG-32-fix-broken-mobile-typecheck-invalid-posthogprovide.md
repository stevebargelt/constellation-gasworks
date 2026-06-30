---
id: FG-32
type: story
status: active
title: Fix broken mobile typecheck — invalid PostHogProvider onReady prop
created: 2026-06-30
---

**HIGH** · **FIXED — PR #3, safe to merge** (greens main; no infra apply)

Mobile typecheck broke main CI: <PostHogProvider> got an invalid onReady prop (not in posthog-react-native@4.41.1).

- [x] Removed onReady; register 'environment' via usePostHog().register in a useEffect inside AuthGuard (child of provider) — mirrors web.
- [x] pnpm turbo typecheck → 12/12 pass.
- [x] PR #3 CI 'Typecheck, Build & RLS Scan' → PASS (the target check is green).

Note: PR #3 also shows 'EAS Build (mobile preview)' FAILING — that is UNRELATED to this fix (Expo billing quota + iOS CI credentials, pre-existing). Tracked separately as FG-33. The code compiles/uploads fine. Branch fix/fg-32-mobile-posthog; apps/mobile only (no tofu apply).