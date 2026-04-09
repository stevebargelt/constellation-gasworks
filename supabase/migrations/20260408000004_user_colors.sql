-- Migration: user_colors (co-yo2)
-- 1. Creates user_colors table: persists per-viewer color assignments for each
--    connection, drawn from the person-color palette defined in design tokens.
-- 2. Trigger: when a relationship transitions to 'active', auto-assigns a color
--    from the 12-color palette (first unused slot) for both parties.
-- Depends on: 20260408000003_relationship_defaults_trigger.sql

-- ---------------------------------------------------------------------------
-- user_colors
-- viewer_id: the user who sees the color
-- target_user_id: the connection being colored
-- color: hex string from the person palette
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_colors (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    color          text NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_colors_unique UNIQUE (viewer_id, target_user_id),
    CONSTRAINT user_colors_no_self CHECK (viewer_id <> target_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_colors_viewer ON public.user_colors(viewer_id);

-- ---------------------------------------------------------------------------
-- RLS
-- Users can only read and write their own color assignments.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_colors_select" ON public.user_colors
    FOR SELECT USING (viewer_id = auth.uid());

CREATE POLICY "user_colors_insert" ON public.user_colors
    FOR INSERT WITH CHECK (viewer_id = auth.uid());

CREATE POLICY "user_colors_update" ON public.user_colors
    FOR UPDATE USING (viewer_id = auth.uid())
    WITH CHECK (viewer_id = auth.uid());

CREATE POLICY "user_colors_delete" ON public.user_colors
    FOR DELETE USING (viewer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- assign_person_color(viewer uuid, target uuid)
-- Picks the first color from the 12-color palette not already assigned by
-- viewer_id. Falls back to the first palette color if all 12 are in use.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_person_color(
    p_viewer uuid,
    p_target uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    palette      text[] := ARRAY[
        '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
        '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
        '#f43f5e', '#84cc16', '#14b8a6', '#a855f7'
    ];
    used_colors  text[];
    chosen_color text;
    c            text;
BEGIN
    -- Collect colors already assigned by this viewer
    SELECT ARRAY(
        SELECT color FROM public.user_colors WHERE viewer_id = p_viewer
    ) INTO used_colors;

    -- Find the first palette entry not in use
    chosen_color := palette[1]; -- fallback
    FOREACH c IN ARRAY palette LOOP
        IF NOT (c = ANY(used_colors)) THEN
            chosen_color := c;
            EXIT;
        END IF;
    END LOOP;

    INSERT INTO public.user_colors (viewer_id, target_user_id, color)
    VALUES (p_viewer, p_target, chosen_color)
    ON CONFLICT ON CONSTRAINT user_colors_unique DO NOTHING;
END;
$$;

-- ---------------------------------------------------------------------------
-- handle_relationship_color_assignment()
-- Fires AFTER UPDATE on relationships when status transitions to 'active'.
-- Assigns a color for each party to identify the other in the app.
-- Extends handle_relationship_accepted from migration 03.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_relationship_color_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active' THEN
        PERFORM public.assign_person_color(NEW.user_a_id, NEW.user_b_id);
        PERFORM public.assign_person_color(NEW.user_b_id, NEW.user_a_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_relationship_color_assignment ON public.relationships;
CREATE TRIGGER on_relationship_color_assignment
    AFTER UPDATE ON public.relationships
    FOR EACH ROW EXECUTE FUNCTION public.handle_relationship_color_assignment();
