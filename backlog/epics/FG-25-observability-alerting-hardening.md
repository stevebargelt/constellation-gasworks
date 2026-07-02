---
id: FG-25
type: epic
status: active
title: Observability & alerting hardening
created: 2026-06-30
---

The user's standing preference is to maximize observability/monitoring across the stack. App-level telemetry (New Relic browser + mobile, PostHog) and VM host metrics (FG-6) cover collection; this epic adds the ALERTING and proactive-monitoring layer so problems page someone instead of sitting in a dashboard. Keep consistent with the existing New Relic + PostHog stack.