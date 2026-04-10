-- Migration: fire color assignment on INSERT as well as UPDATE
-- The original trigger (migration 04) only fires on UPDATE, so relationships
-- inserted directly with status='active' (e.g. seed scripts, admin tools) never
-- get colors assigned. This migration updates the trigger function to handle both
-- INSERT and UPDATE, and re-creates the trigger to include INSERT.

CREATE OR REPLACE FUNCTION public.handle_relationship_color_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'active')
    OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active')
    THEN
        PERFORM public.assign_person_color(NEW.user_a_id, NEW.user_b_id);
        PERFORM public.assign_person_color(NEW.user_b_id, NEW.user_a_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_relationship_color_assignment ON public.relationships;
CREATE TRIGGER on_relationship_color_assignment
    AFTER INSERT OR UPDATE ON public.relationships
    FOR EACH ROW EXECUTE FUNCTION public.handle_relationship_color_assignment();

-- Backfill: assign colors for any already-active relationships that have none.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT user_a_id, user_b_id
        FROM public.relationships
        WHERE status = 'active'
    LOOP
        PERFORM public.assign_person_color(r.user_a_id, r.user_b_id);
        PERFORM public.assign_person_color(r.user_b_id, r.user_a_id);
    END LOOP;
END;
$$;
