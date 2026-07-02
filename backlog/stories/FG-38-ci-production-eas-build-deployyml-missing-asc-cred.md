---
id: FG-38
type: story
status: active
title: "CI: production EAS build (deploy.yml) missing ASC creds + masks failure"
created: 2026-06-30
---

**Epic:** FG-1 (cutover) · discovered during FG-13 Gate 3

\`.github/workflows/deploy.yml\` (production EAS build on push to main) is stale relative to \`eas-preview.yml\`:

1. The "EAS Build (production)" step runs \`eas build --platform all --profile production --non-interactive\` with **no ASC API key** — no "Write ASC API key" step and no \`EXPO_ASC_API_KEY_PATH/KEY_ID/ISSUER_ID\` env block. So the iOS production build cannot authenticate non-interactively (hits the account's hardware-key 2FA) and fails. (eas-preview.yml has the correct ASC setup from FG-33.)
2. The job has \`continue-on-error: true\` (line 16) with a stale comment about "interactive setup" — this MASKS the failure, so the production deploy stays green while iOS never builds. Violates the never-mask-CI principle and contradicts FG-33 (#7 "remove EAS build error-swallowing").

**Acceptance criteria:**
- [ ] Add the "Write ASC API key" step + \`EXPO_ASC_*\` env block to deploy.yml's production build (mirror eas-preview.yml)
- [ ] Remove \`continue-on-error: true\` and the stale comment — the production build must fail honestly if it fails
- [ ] Confirm a merge-to-main production build authenticates iOS via the ASC key and produces both platform artifacts (or fails visibly)
- [ ] Production build bakes in the EAS-hosted EXPO_PUBLIC_* (self-hosted backend) set during FG-13