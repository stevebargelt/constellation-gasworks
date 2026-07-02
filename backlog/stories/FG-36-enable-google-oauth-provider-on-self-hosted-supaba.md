---
id: FG-36
type: story
status: active
title: Enable Google OAuth provider on self-hosted Supabase backend
created: 2026-06-30
---

**Epic:** FG-1 (cutover) · discovered during FG-13 Gate 3

The self-hosted Supabase auth (GoTrue) has NO Google provider configured — `auth/v1/settings` reports `"google": false` and the VM `/opt/supabase-constellation/.env` has zero `GOTRUE_EXTERNAL_GOOGLE_*` keys. The cutover plan assumed Google was only a Google-Cloud-Console redirect-URI dashboard step, but the provider was never enabled server-side. FG-13 AC2 (Google auth on web + mobile) cannot pass until this is done.

**Acceptance criteria:**
- [ ] Obtain Google OAuth client ID + secret (new, or reuse old Supabase Cloud project's credentials / Key Vault)
- [ ] Add to VM `/opt/supabase-constellation/.env`: `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true`, `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID`, `GOTRUE_EXTERNAL_GOOGLE_SECRET`, `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://constellation.db.harebrained-apps.com/auth/v1/callback`
- [ ] Restart the auth container; confirm `auth/v1/settings` now reports `"google": true`
- [ ] Add the redirect URI in Google Cloud Console (FG-13 AC1)
- [ ] Google sign-in works end-to-end on web + mobile (FG-13 AC2)
- [ ] Make the config durable across VM recreation (cloud-init / secret-loader), not just a live-file edit