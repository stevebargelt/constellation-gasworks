---
id: FG-27
type: story
status: active
title: Uptime / synthetic check on constellation endpoint
created: 2026-06-30
---

**Epic:** FG-25

Add an external uptime check so an outage is detected even if the host agent is down.

**Acceptance criteria:**
- [ ] NR Synthetics (or equivalent) monitor hits https://constellation.db.harebrained-apps.com/rest/v1/ on an interval and asserts 200 + TLS validity
- [ ] Studio subdomain optionally checked
- [ ] Alerts on failure + cert-expiry warning
- [ ] Defined as code or documented