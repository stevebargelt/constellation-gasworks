---
id: FG-36
type: idea
status: active
title: Enable Google OAuth provider on self-hosted Supabase backend
created: 2026-06-30
---

**Epic:** FG-1 (cutover) · discovered during FG-13 Gate 3

> ⏸️ **PAUSED 2026-07-02** by product-owner decision. Google OAuth work is deferred — do not surface as a live cutover step. Parked as an idea (out of the committed-story flow). **Consequence:** FG-13 Gate 3's "Google auth on web + mobile" AC remains open; Gate 3 cannot fully close until OAuth is either resumed or that AC is explicitly descoped to an email/password-only cutover. Resume by moving back to `story`.

The self-hosted Supabase auth (GoTrue) has NO Google provider configured — `auth/v1/settings` reports `"google": false` and the VM `/opt/supabase-constellation/.env` has zero `GOTRUE_EXTERNAL_GOOGLE_*` keys. The cutover plan assumed Google was only a Google-Cloud-Console redirect-URI dashboard step, but the provider was never enabled server-side.

**Acceptance criteria (on resume):**
- [ ] Obtain Google OAuth client ID + secret (new, or reuse old Supabase Cloud project's credentials / Key Vault)
- [ ] Add to VM `/opt/supabase-constellation/.env`: `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true`, `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID`, `GOTRUE_EXTERNAL_GOOGLE_SECRET`, `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://constellation.db.harebrained-apps.com/auth/v1/callback`
- [ ] Restart the auth container; confirm `auth/v1/settings` now reports `"google": true`
- [ ] Add the redirect URI in Google Cloud Console (FG-13 AC1)
- [ ] Google sign-in works end-to-end on web + mobile (FG-13 AC2)
- [ ] Make the config durable across VM recreation (cloud-init / secret-loader), not just a live-file edit
