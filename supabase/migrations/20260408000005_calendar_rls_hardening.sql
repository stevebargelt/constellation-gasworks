-- Migration: calendar_rls_hardening (co-hkg)
-- Hardens calendar access control per architecture decision D-A:
--   1. Drops the direct SELECT policy on calendar_events so clients can ONLY
--      read calendar data via the visible_calendar_events view.
--   2. Marks visible_calendar_events with security_invoker = false (explicit
--      default) so the view runs as its owner (bypassing RLS on the base table
--      while still filtering rows via auth.uid() from the JWT).
--   3. Adds 'tentative' to event_attendees.status allowed values.
-- Depends on: 20260408000002_rls_views.sql

-- ---------------------------------------------------------------------------
-- 1. Remove direct SELECT access on calendar_events.
--    INSERT/UPDATE/DELETE policies remain — creators still write directly.
--    All reads must go through visible_calendar_events.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "calendar_events_select" ON public.calendar_events;

-- ---------------------------------------------------------------------------
-- 2. Make visible_calendar_events explicitly security_invoker = false.
--    PostgreSQL 15+ default is already security_invoker = off (view owner's
--    privileges apply), but we set it explicitly for auditability.
--    The view owner (postgres/service_role) has BYPASSRLS and can access the
--    base table. The WHERE clause uses auth.uid() from the JWT so per-caller
--    row filtering still applies correctly.
-- ---------------------------------------------------------------------------
ALTER VIEW public.visible_calendar_events SET (security_invoker = false);

-- ---------------------------------------------------------------------------
-- 3. Add 'tentative' to event_attendees.status.
--    Drops the existing check constraint and recreates it with the full set of
--    allowed values: invited, accepted, declined, tentative.
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_attendees
    DROP CONSTRAINT IF EXISTS event_attendees_status_check;

ALTER TABLE public.event_attendees
    ADD CONSTRAINT event_attendees_status_check
    CHECK (status IN ('invited', 'accepted', 'declined', 'tentative'));
