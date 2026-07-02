---
id: FG-33
type: story
status: done
title: CI EAS preview builds are blocked (Expo billing + iOS credentials)
created: 2026-06-30
closed: 2026-06-30
closed_commit: "7181280"
---

**Epic:** FG-1 adjacent · **DONE** (7181280)

The EAS mobile preview check is genuinely green — the build actually works for iOS + Android (real artifacts), no masking.

Resolved (PRs #6, #7, #8):
- [x] Scoped EAS to mobile-touching PRs only (apps/mobile/**, packages/**).
- [x] Removed error-swallowing — check fails honestly on real failure (NEVER mask).
- [x] iOS auth via App Store Connect API key (.p8) — fixes the hardware-security-key 2FA wall that EAS interactive login can't handle. Key in GitHub secrets, passed as EXPO_ASC_* to the build.
- [x] Unique bundle ID com.harebrainedapps.constellation (com.constellation.app was globally taken).
- [x] iOS distribution cert + ad-hoc provisioning profile (registered device) created on EAS via the ASC key.
- [x] Replaced corrupt 1x1 placeholder PNGs (bad IDAT CRC broke Expo prebuild on both platforms) with valid assets.
- [x] Verified: PR #8 EAS Build check PASS — iOS .ipa + Android both finished.

The original 'EAS quota exhausted' theory was wrong (user verified); real cause was iOS credentials + corrupt assets.