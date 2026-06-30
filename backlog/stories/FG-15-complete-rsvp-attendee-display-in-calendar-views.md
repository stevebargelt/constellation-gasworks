---
id: FG-15
type: story
status: active
title: Complete RSVP + attendee display in calendar views
created: 2026-06-30
---

**Epic:** FG-2 (calendar)

API has inviteToEvent/rsvpToEvent/getEventAttendees but the views don't surface invites/RSVP. First confirm current state, then complete.

**Acceptance criteria:**
- [ ] Invited partners see the invite and can RSVP accept/decline/tentative (web + mobile)
- [ ] Attendee list + RSVP status visible on the event (web + mobile)
- [ ] RSVP changes sync in realtime to the organizer
- [ ] Covered by a hook/integration test