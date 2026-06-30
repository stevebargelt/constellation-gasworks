---
id: FG-11
type: story
status: active
title: "[HUMAN] Gate 1 — bootstrap tfstate + secrets, provision infra"
created: 2026-06-30
---

**Epic:** FG-1 (cutover) · **Manual / needs-human**

Ref: docs/plans/co-kkd.md Gate 1.

**Acceptance criteria:**
- [ ] Resend API key obtained; constellation secrets generated (JWT_SECRET, POSTGRES_PASSWORD, ANON_KEY, SERVICE_ROLE_KEY) and stored securely
- [ ] tfstate storage account + container bootstrapped; GitHub Actions OIDC + TF_VAR_* secrets configured
- [ ] IaC PR reviewed and merged → `tofu apply` provisions VM, disk, IP, DNS, Blob, Key Vault (with secrets), managed identity
- [ ] GHA apply log clean; Azure portal shows VM running and Key Vault populated

Depends on: FG-6..FG-9 merged (IaC PR should include those fixes).