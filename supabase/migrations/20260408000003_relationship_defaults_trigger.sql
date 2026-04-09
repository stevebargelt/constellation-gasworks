-- Migration: relationship_defaults_trigger (co-1qr)
-- 1. Adds CHECK constraint for rel_type allowed values on relationships.
-- 2. Trigger: when a relationship is accepted (status → 'active'), auto-inserts
--    default relationship_permissions rows (free_busy) for both parties.
-- Depends on: 20260408000000_initial_schema.sql, 20260408000001_rls_policies.sql

-- ---------------------------------------------------------------------------
-- rel_type constraint
-- The initial schema left rel_type unconstrained to allow migration ordering
-- flexibility. Now that the enum is stable, lock it down.
-- ---------------------------------------------------------------------------
ALTER TABLE public.relationships
    ADD CONSTRAINT relationships_rel_type_check
    CHECK (rel_type IN (
        'partner',
        'nesting_partner',
        'metamour',
        'coparent',
        'roommate',
        'family',
        'custom'
    ));

-- ---------------------------------------------------------------------------
-- handle_relationship_accepted()
-- Fires AFTER UPDATE on relationships when status transitions to 'active'.
-- Inserts three default relationship_permissions rows per party (free_busy for
-- calendar, tasks, and meals) so the get_permission() function returns
-- 'free_busy' immediately for both users without any explicit grant.
-- ON CONFLICT DO NOTHING makes this idempotent — safe if the trigger fires
-- more than once or if a user already set explicit permissions.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_relationship_accepted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Only act when transitioning INTO 'active'
    IF OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active' THEN
        INSERT INTO public.relationship_permissions
            (relationship_id, grantor_id, resource_type, level)
        VALUES
            -- user_a grants free_busy on all three resources
            (NEW.id, NEW.user_a_id, 'calendar', 'free_busy'),
            (NEW.id, NEW.user_a_id, 'tasks',    'free_busy'),
            (NEW.id, NEW.user_a_id, 'meals',    'free_busy'),
            -- user_b grants free_busy on all three resources
            (NEW.id, NEW.user_b_id, 'calendar', 'free_busy'),
            (NEW.id, NEW.user_b_id, 'tasks',    'free_busy'),
            (NEW.id, NEW.user_b_id, 'meals',    'free_busy')
        ON CONFLICT ON CONSTRAINT relationship_permissions_unique DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_relationship_accepted ON public.relationships;
CREATE TRIGGER on_relationship_accepted
    AFTER UPDATE ON public.relationships
    FOR EACH ROW EXECUTE FUNCTION public.handle_relationship_accepted();
