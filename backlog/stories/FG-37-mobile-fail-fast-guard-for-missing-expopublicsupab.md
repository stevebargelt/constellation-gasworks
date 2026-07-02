---
id: FG-37
type: story
status: active
title: "Mobile: fail-fast guard for missing EXPO_PUBLIC_SUPABASE_* at startup"
created: 2026-06-30
---

**Epic:** FG-1 (cutover) · discovered during FG-13 Gate 3

\`apps/mobile/app/_layout.tsx\` calls \`initSupabase(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, …)\`. The \`!\` non-null assertion only silences TypeScript — at runtime a missing env var yields \`undefined\`, so the app initializes a Supabase client with no backend URL and fails opaquely. This is how the EAS distributed builds shipped backend-less (EAS-hosted env was empty) while still compiling green.

**Acceptance criteria:**
- [ ] Validate URL + key are present and non-empty at startup (or in @constellation/api initSupabase); throw a clear error naming the missing var(s)
- [ ] A build with missing EXPO_PUBLIC_SUPABASE_* fails fast (visible error / hard throw), not a silent no-backend app
- [ ] Unit test covering the missing-env path
- [ ] Consider the same guard for web (apps/web/src/main.tsx)