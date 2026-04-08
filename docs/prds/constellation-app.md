# PRD: Constellation App — Polyamorous Relationship Coordination Platform

**Bead**: co-wisp-jk2
**Status**: Reviewed
**Created**: 2026-04-08
**PM**: constellation/pm

---

## Problem Statement

People in polyamorous and ethically non-monogamous (ENM) relationships manage their shared lives across 3–5 separate apps — one for calendars, another for meal planning, another for recipes, another for tasks. This fragmentation creates friction and surfaces preventable conflicts at the worst possible moments.

The core failure mode is **calendar-blind coordination**: you schedule a date night without knowing your partner already has plans with their other partner. You plan a group dinner without realizing half the polycule is traveling that weekend. Because calendars, meal plans, and logistical tasks live in separate apps, conflicts only appear when it's too late to gracefully resolve them.

Existing tools (Cozi, OurHome, FamilyWall, AnyList) fail this population because they are built around a single "household" unit — typically a two-parent nuclear family. They have no model for multiple living spaces, no concept of relationships separate from cohabitation, and no granular permission model for complex relationship structures.

**Constellation** is a unified coordination platform — calendar, meals, tasks, and recipes in one place — built from the ground up for the complexity of polyamorous relationship structures.

---

## Background & Context

The polyamorous and ENM community is a growing population of tech-savvy adults who actively seek software tools, coordinate logistics across multiple relationships, and have a strong culture of explicit communication and consent. They are underserved by every existing household coordination app.

The specific gap: no existing app models **relationship-first** coordination. Living together is one possible configuration, not the baseline assumption. A nesting partner (cohabiting) and a non-nesting partner (living separately) are both full participants in someone's constellation — they just have different roles.

Competitors treat this as an edge case. We treat it as the foundation.

**Source**: co-wisp-jk2 one-pager + discussion notes

---

## Goals

**Primary goals (MVP)**:
- Eliminate calendar-blind conflicts by surfacing all partners' availability in one view
- Reduce the coordination overhead of polyamorous life management
- Support all ENM relationship structures without requiring users to contort their lives into a "household" model

**Success metrics**:
- Users can see all direct partners' availability in a single calendar view within 30 seconds of onboarding
- Conflict detection: scheduling UI warns when a proposed event overlaps with a partner's existing commitment (per their permission settings)
- Users with 3+ direct relationships can fully onboard (invite all partners, set permissions) without contacting support
- Day 30 retention ≥ 40% for users with 2+ active partner connections

---

## Non-Goals (MVP)

- **No paid tier** — free only, no monetization features, no paywalls, no conversion flows
- **No co-parenting features** — children, custody scheduling, parent-defined child permissions are future scope
- **No external calendar sync** — Google Calendar / Apple Calendar import/export is future scope
- **No push notifications** — in-app real-time sync only; push notification infrastructure is future scope
- **No public profiles or discovery** — this is a closed coordination tool, not a dating or community app
- **No AI suggestions** — no automated scheduling, meal suggestions, or task assignment recommendations

---

## Core Concepts

### Constellation
A user's full relationship ecosystem — their personal view of everyone they are connected to through direct and indirect relationships. This is **derived from the relationship graph**, not a manually created object. You do not "create" a constellation; you build it by forming relationships. Every user has exactly one constellation (their view), but that constellation can encompass multiple polycules.

*Example*: Maggie is solo-poly with Joe and Tina. Joe has two other partners (Dana, Alex). Tina has two other partners (River, Sam). Maggie's constellation includes Joe, Tina, and — at one degree of separation — Dana, Alex, River, and Sam. Maggie's constellation encompasses two overlapping polycules, with Maggie as the hinge.

### Polycule
A tightly-knit sub-network within a broader constellation — a cluster of people connected through consensual non-monogamous relationships. The app visualizes polycules as clusters within the relationship graph. Users do not manually define polycules; they emerge from the graph structure.

### Relationships
Explicit, mutual connections between two people. Both parties must accept. Relationship types:
- `partner` — romantic/sexual partner, not cohabiting
- `nesting partner` — romantic/sexual partner, cohabiting
- `metamour` — your partner's partner (indirect relationship)
- `coparent` — shares parenting responsibilities (future scope in terms of full features, but relationship type supported in MVP for correct graph rendering)
- `roommate` — cohabiting, non-romantic
- `family` — family member
- `custom` — user-defined label

Relationships exist independently of living situations and of constellations.

### Living Spaces (Optional)
Physical locations associated with zero, one, or multiple people. Not required. When present, living spaces provide context for meal planning (who's eating where tonight?) and task assignment (whose apartment needs groceries?). A person can be associated with multiple living spaces.

### Permission Levels
Applied per-person, per-resource:
- **Full** — see all details (event titles, descriptions, task content, meal plans)
- **Free/Busy** — see that time is blocked, but not what for
- **None** — no visibility

---

## Permission Model Spec

### Default Permissions by Relationship Type

| Relationship Type | Calendar Default | Tasks Default | Meals Default |
|---|---|---|---|
| Nesting partner | Full | Full | Full |
| Partner | Full | Free/Busy | Free/Busy |
| Metamour | None | None | None |
| Roommate | Free/Busy | Free/Busy | Full |
| Family | Free/Busy | None | None |
| Custom | None | None | None |

Defaults are editable per-person by the user. Changes affect only the relationship from the user's side (permissions are unilateral — I control what I share with you; you control what you share with me).

### Two-Layer Coordination Model

**Awareness layer** (constellation-wide, permission-controlled):
- Surfaces availability and context to help avoid conflicts
- Respects each person's permission settings
- Metamours are invisible by default (None permission); they appear only if they explicitly grant access
- Critically: Maggie sees Joe is busy Friday via **Joe's own calendar** — she does not need Dana's calendar to avoid the conflict. Metamour calendar visibility is supplementary context, not load-bearing for the core use case.

**Coordination layer** (direct relationships only):
- Invite to events, assign tasks, add to meal plans — only with direct partners
- You cannot put anything on a metamour's calendar even if they have granted you visibility access
- You cannot assign tasks to people you are not directly in relationship with

*Example*: Dana (Joe's other partner) is metamour to Maggie. By default, Dana is invisible to Maggie — no node appears in the constellation graph, no calendar overlay, nothing. If Dana later explicitly grants Maggie access (e.g., Free/Busy), Dana becomes visible at that level. Even with visibility, Maggie cannot invite Dana to events or assign her tasks.

### Privacy Guarantees
- Users can mark individual events/tasks as **private** — visible only to themselves, overriding all permission grants
- Changing permission levels takes effect immediately (real-time via Supabase)
- Deleting a relationship removes all coordination access immediately; the person becomes invisible (metamour default: None) unless they had previously granted explicit visibility access, which is also revoked

---

## User Stories / Scenarios

### Scenario A: Maggie's Saturday Problem
Maggie is solo-poly with Joe and Tina. She wants to plan a date night with Joe on Saturday.

- Maggie opens the calendar and selects Saturday
- She sees Joe's calendar (Full access): Joe has an event "Dinner w/ Dana" Saturday 6–9pm
- She sees Tina's calendar (Full access): Tina is free Saturday
- Maggie creates "Date Night" at 9:30pm Saturday, invites Joe
- Joe gets a real-time notification; accepts
- Both see the event on their shared calendar

**Without Constellation**: Maggie texts Joe, Joe checks his calendar, texts back, Maggie adds it to her calendar manually. No visibility into Tina's plans. Conflict discovered when Tina mentions she was hoping to see Maggie Saturday.

---

### Scenario B: Polycule Group Dinner Planning
Maggie, Joe, and Tina want to plan a group dinner. Joe and Tina are not in a relationship with each other (metamours via Maggie).

- Maggie opens the calendar view, selects "Multi-partner view"
- She can see Joe's availability (Full) and Tina's availability (Full)
- She identifies a free Friday evening for all three
- She creates "Polycule Dinner" and invites Joe and Tina (both direct relationships)
- Tina and Joe each receive invitations; Joe accepts, Tina tentatively accepts
- Maggie sees the RSVP status in real-time

**Key constraint enforced**: Joe cannot invite Tina to this dinner — they are metamours, not direct partners. Joe would need to tell Maggie, who invites Tina.

---

### Scenario C: Metamour Visibility (Opt-In)
Dana (Joe's other partner) is metamour to Maggie. Metamour default is None.

**Default state**:
- Dana does not appear in Maggie's constellation graph at all
- Maggie has no visibility into Dana's calendar, tasks, or meals
- Maggie knows Joe has other partners (via the relationship graph structure) but sees no details about Dana

**How conflict avoidance still works without metamour visibility**:
- Joe's calendar (Full access) shows "Dinner w/ Dana" Saturday 6–9pm
- Maggie avoids Saturday evening by reading Joe's calendar — not Dana's
- She never needs Dana's calendar to coordinate around Joe's time with her

**If Dana opts in later**:
- Dana navigates to her relationship settings and grants Maggie Free/Busy access
- Dana becomes visible in Maggie's constellation graph as a read-only node
- Maggie can see Dana has something Friday evening (shown as "Busy" block)
- Maggie still cannot add Dana to any event, task, or meal plan

---

### Scenario D: Task Distribution
Maggie and Joe are nesting partners. They share a living space.

- They have a shared task list for their apartment
- Joe creates a task "Grocery run — Trader Joe's" and assigns it to Maggie
- Maggie sees it appear in real-time on her task list
- Maggie marks it complete; Joe sees it update immediately
- Both can see task history and current ownership at a glance

---

### Scenario E: Meal Planning Across Spaces
Maggie nests with Joe (one apartment) and also has a separate apartment. Tina lives separately.

- Thursday: Maggie is home alone (her apartment). She opens meal planning, sees she's cooking for one.
- Friday: Maggie is at Joe's. Joe opens meal planning — it shows 2 people eating at their place.
- Saturday: Group dinner at Tina's. Tina creates a meal plan for the evening, invites Maggie and Joe.

Living spaces provide this context without requiring users to define a single "household."

---

## Feature Specifications: MVP

### 1. User Profile & Onboarding
- Create account (email/password + OAuth options)
- Set profile name, preferred name, pronouns (optional), avatar
- No mandatory fields beyond name and email

### 2. Relationship Management
- Invite another user to a relationship by email or username
- Select relationship type from list (partner, nesting partner, metamour, roommate, family, custom)
- Recipient must accept; relationship is mutual on acceptance
- Set permissions per relationship (calendar / tasks / meals): Full / Free-Busy / None
- Defaults applied automatically based on relationship type (editable)
- Remove relationship: immediate effect on all access and coordination
- View all relationships in a list with current permission settings

### 3. Constellation View (Relationship Graph)
First-class UI feature — not buried in settings.

- Visual graph of the user's full constellation
- **Direct partners**: interactive nodes — tap/click to view profile, adjust permissions, navigate to shared calendar
- **Metamours**: read-only nodes — visible only if they have explicitly granted access; invisible by default
- Color-coded per person (same colors used across all app surfaces for that person)
- Polycule clusters emerge from graph topology (auto-detected, not manually defined)
- Accessible from primary navigation
- Pinch-to-zoom on mobile; scroll-to-zoom on web

### 4. Shared Calendar
- Personal calendar (always visible, full detail)
- Overlay view: any combination of direct partners' calendars
- Color-coded per person
- Free/Busy blocks shown for partners with Free/Busy permission, and for metamours who have explicitly granted access
- Create events: title, date/time, location (optional), notes (optional)
- Invite direct partners to events; per-event RSVP (accept / decline / tentative)
- Conflict detection: warn when creating event that overlaps with any invited person's existing commitment
- Private events: visible only to creator, shown as "Busy" to all others regardless of permission setting
- Recurring events: daily, weekly, bi-weekly, monthly
- Real-time sync: calendar updates appear immediately across all connected clients

### 5. Tasks
- Shared task lists: each user can create lists and share with direct partners
- Task fields: title, description (optional), due date (optional), assigned to
- Assign tasks only to direct partners (or self)
- Task status: open / in progress / complete
- Real-time sync: status changes propagate immediately
- Per-task privacy: mark task private (visible only to self)
- Task history: completed tasks visible in history view

### 6. Recipes
- Personal recipe library: create, edit, delete recipes
- Recipe fields: title, ingredients, instructions, servings, tags, notes
- Share recipes with direct partners (read access; they can copy to their own library)
- Recipe collections / categories (user-defined tags)
- No external recipe import (future scope)

### 7. Meal Planning
- Weekly meal plan view (Mon–Sun)
- Assign meals to days (link to recipe or free-text entry)
- Associate meal plan with a living space (optional — "who's eating where")
- Invite direct partners to see/contribute to a meal plan
- Shopping list generation from meal plan (aggregate ingredients)
- Real-time sync: meal plan changes propagate immediately to all participants

### 8. Real-Time Infrastructure
- All shared data (calendar events, tasks, meal plans) syncs in real-time via Supabase Realtime
- Presence indicators: show when a partner is currently active in the app (optional — off by default)
- No polling; event-driven updates throughout

---

## Platform Requirements

| Platform | Requirement |
|---|---|
| Web | React — required for MVP |
| iOS | React Native — required for MVP |
| Android | React Native — required for MVP |
| Backend | Supabase (PostgreSQL + Realtime + Auth) |

Web and mobile are equal-priority deliverables. Neither is "later."

---

## Work Breakdown

### Foundation
- [ ] Supabase project setup: auth, database schema, row-level security policies
- [ ] Shared component library scaffold (design tokens, base components for web + mobile)
- [ ] CI/CD pipeline: web (Vercel or similar) + mobile (EAS Build)

### Auth & User Profiles
- [ ] Auth flow: email/password signup, login, password reset (web + mobile)
- [ ] OAuth provider integration (Google at minimum)
- [ ] User profile: create/edit name, preferred name, pronouns, avatar
- [ ] Profile settings screen

### Relationship Graph
- [ ] Relationship data model: users, relationships table, relationship types, permission levels
- [ ] Invite flow: send invite by email/username, accept/decline
- [ ] Relationship list view: see all relationships, types, and permission settings
- [ ] Edit permissions per relationship
- [ ] Remove relationship with confirmation
- [ ] Constellation view: graph visualization component (web + mobile)
- [ ] Graph: direct partners as interactive nodes, metamours as read-only
- [ ] Graph: polycule cluster auto-detection from graph topology
- [ ] Graph: color assignment per person, propagated across app

### Calendar
- [ ] Calendar data model: events, attendees, RSVP status, privacy flag
- [ ] Personal calendar: create, edit, delete events
- [ ] Recurring event support
- [ ] Event invite flow: invite direct partners, RSVP
- [ ] Overlay calendar view: multi-person, color-coded
- [ ] Free/Busy rendering for permission-gated calendars
- [ ] Private event handling: shown as "Busy" to all others
- [ ] Conflict detection on event creation
- [ ] Real-time calendar sync via Supabase Realtime
- [ ] Calendar UI: month view, week view, day view (web + mobile)

### Tasks
- [ ] Task data model: tasks, lists, assignments, status, privacy flag
- [ ] Create/edit/delete task lists, share with direct partners
- [ ] Create/edit/delete tasks, assign to self or direct partner
- [ ] Task status transitions: open → in progress → complete
- [ ] Task history view
- [ ] Real-time task sync via Supabase Realtime
- [ ] Task list UI (web + mobile)

### Recipes
- [ ] Recipe data model: recipes, ingredients, instructions, tags
- [ ] Create/edit/delete recipes (personal library)
- [ ] Share recipe with direct partner (read + copy)
- [ ] Recipe list and search/filter UI (web + mobile)

### Meal Planning
- [ ] Meal plan data model: weekly plans, day slots, living space association
- [ ] Create/edit weekly meal plan, assign recipes or free-text to days
- [ ] Share meal plan with direct partners
- [ ] Shopping list generation from weekly meal plan
- [ ] Real-time meal plan sync via Supabase Realtime
- [ ] Meal plan UI: week view (web + mobile)

### Living Spaces
- [ ] Living space data model: spaces, occupants
- [ ] Create/edit/delete living spaces
- [ ] Associate self and direct partners with living spaces

---

## Acceptance Criteria

- [ ] A user with 3 direct partners can onboard, invite all three, and set permissions for each without assistance
- [ ] Calendar overlay shows all direct partners' events (per permissions) and renders Free/Busy blocks for metamours within 2 seconds of opening
- [ ] Creating an event that conflicts with an invited partner's existing commitment shows a warning before saving
- [ ] A private event created by User A appears as "Busy" to User B (direct partner with Full access) and is not visible at all to User C (metamour with None permission)
- [ ] Removing a relationship immediately revokes all coordination access (invitations, task assignments) — real-time, no page refresh required
- [ ] Task status update by one partner propagates to all participants within 1 second (Supabase Realtime)
- [ ] Constellation graph renders correctly for a hinge partner (Maggie) connected to two separate polycule clusters
- [ ] App is fully functional on iOS, Android, and web with feature parity across platforms
- [ ] No paywall, upsell, or monetization prompt appears anywhere in the app

---

## Resolved Decisions

**D1: Relationship type mutuality**
**Decision**: MUTUAL. Both parties must agree on the relationship type label when forming a relationship. Custom label is available as an escape hatch for edge cases. Permissions remain unilateral (each party controls what they share independently of type agreement).

**D2: Metamour visibility default**
**Decision**: OPT-IN. Metamours are invisible by default (None permission for all resource types). A metamour becomes visible only when they explicitly grant access.

*Rationale*: The core conflict-avoidance value prop does not depend on metamour visibility. Maggie avoids conflicts with Dana's time by reading **Joe's calendar** — not Dana's. Metamour visibility is supplementary context, not load-bearing. Opt-in aligns with the ENM community's strong consent norms and reduces the risk of unwanted exposure.

**D3: Constellation graph filtering**
**Decision**: DEFER to post-MVP. Graph filtering and focus modes are not required at launch. Known risk: large networks (20+ nodes) may render poorly. Flag in Risks section; revisit after beta with real usage data.

**D4: Shopping list model**
**Decision**: SHARED collaborative list. When a meal plan is shared, the generated shopping list is shared and collaborative — all participants can check off items in real-time via Supabase Realtime.

**D5: Push notifications**
**Decision**: DEFERRED. In-app real-time sync only for MVP. Supabase transactional emails (invite notifications, relationship requests) are the only async channel. Documented as a known limitation; push notifications are future scope.

---

## Out of Scope

- Co-parenting features (children, custody scheduling, age-appropriate access)
- External calendar sync (Google Calendar, Apple Calendar, Outlook)
- Push notifications
- Public profiles, discovery, or community features
- AI-assisted scheduling or suggestions
- Paid tiers, subscriptions, or monetization of any kind
- In-app messaging / chat (coordinate via calendar/tasks; direct messaging is out of scope)
- Group video calls or media sharing
- Import from competing apps (Cozi, OurHome, etc.)

---

## Risks & Considerations

- **Graph rendering performance**: Force-directed graph layouts can be slow on mobile for large networks. Library selection (e.g., D3, Cytoscape, React Force Graph) needs careful evaluation for React Native compatibility.
- **Supabase Realtime connection limits**: Free tier Supabase has concurrent connection limits. Need to architect for connection pooling if user base grows. Document the threshold.
- **Row-level security complexity**: The permission model (Full / Free-Busy / None per person per resource) requires careful Supabase RLS policy design. Bugs here are privacy violations. Security review of RLS policies before launch.
- **React Native parity burden**: Two codebases (React web + React Native mobile) from day one means every feature ships twice. Shared logic should be maximized (hooks, utilities, API layer) while UI components are platform-specific.
- **Cold start / empty state**: The app has no value until a user has at least one accepted relationship. Onboarding must get users to their first accepted connection quickly.
- **Terminology sensitivity**: The target community uses specific terms with established meanings (polycule, constellation, metamour). Misusing these terms will damage trust. All copy should be reviewed by a community member before launch.
