---
id: FG-31
type: story
status: active
title: Make the infra apply pipeline safe (fail-fast + plan-gated)
created: 2026-06-30
---

**Epic:** FG-1 (cutover) · **PR OPEN (#2)**

Made the apply pipeline fail-fast. Branch infra/fg-31-pipeline-safety, PR #2.
- [x] -input=false + -lock-timeout=120s on plan & apply (verified: PR plan ran clean in seconds, no hang)
- [x] nr_license_key default = "" (optional; load-secrets guards on empty)
- [x] LIVE APPLY WARNING comment (push=live apply; cloud-init change=VM replacement)
- tofu validate PASS; PR plan = '3 add / 2 destroy'.

**Safety model (user decision 2026-06-30): NO production-environment approval gate** — too much friction. Safety instead comes from: infra changes go via PR (plan is posted + reviewed before merge), never direct-to-main. Merge = deliberate plan-reviewed apply. (Declined AC: required-reviewer rule on the production env. Optional fallback if ever wanted: switch apply to manual workflow_dispatch so merges don't auto-apply.)

docs_impact: not_needed (CI-internal; self-documented via in-workflow comment; NR-optional noted in PR). No separate test-engineer: CI-flag/var-default change, verified by host tofu validate + the PR's live plan.