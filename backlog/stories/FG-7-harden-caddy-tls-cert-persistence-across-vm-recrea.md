---
id: FG-7
type: story
status: active
title: Harden Caddy TLS cert persistence across VM recreation
created: 2026-06-30
---

**Epic:** FG-1 (cutover) · **CODE-COMPLETE — committed; live VM-recreate verification deploy-gated (Gate 2/3)**

Hardened the Caddy-cert-on-data-disk mechanism (started by 1ed938a) so a mount failure can't silently fall back to ephemeral storage and burn the Let's Encrypt rate limit.

**Implemented (run-fg-7-*):**
- [x] AC1: fail-closed pre-start guard — caddy.service.d/data-disk.conf runs check-caddy-cert-dir.sh via ExecStartPre=+; Caddy refuses to start (loud FATAL log) if /mnt/data isn't mounted; creates cert dir (caddy:caddy, 750) if missing; daemon-reload before enable. cloud-init else-branch warns loudly if disk absent.
- [x] AC2: idempotent across reboots + VM recreation (blkid||mkfs, fstab grep-guard, mkdir -p, ln -sfn; existing certs never touched). Robust LUN path (/dev/disk/azure/scsi1/lun10), not /dev/sdc.
- [x] AC3: recovery behavior documented — initial-setup.md 'TLS certificate persistence and the Caddy cert guard' section (reconciled by documentation-maintainer against code).
- [ ] AC4: VM-recreate verification (no new ACME issuance) — DEPLOY-GATED at Gate 2/3.
- 21/21 shell tests pass in CI; guard unit-tested via CADDY_CHECK_MOUNT override.

Docs impact: updated (operator_behavior_changed — Caddy now fails closed; reconciled in initial-setup.md).