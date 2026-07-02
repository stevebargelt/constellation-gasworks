---
id: FG-21
type: story
status: active
title: Hook tests for the realtime data hooks
created: 2026-06-30
---

**Epic:** FG-4 (testing)

The 9 data hooks (useCalendar, useCalendarOverlay, useRelationships, useLivingSpaces, useTaskLists, useTasks, useShoppingList, useRecipes, useMealPlan) carry the app's business logic and have no tests.

**Acceptance criteria:**
- [ ] Each hook has tests for load, mutate (optimistic + reconcile), and realtime-event handling
- [ ] Error/permission-denied paths covered
- [ ] Runs in CI