-- Migration: user_colors (co-yo2)
-- Stores per-viewer color assignments for each person in their constellation.
-- A viewer's assignment for a target is independent of the target's assignment
-- for the viewer (each person gets to see their own consistent color map).
-- Depends on: 20260408000000_initial_schema.sql

-- ---------------------------------------------------------------------------
-- user_colors table
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
-- A viewer owns their color map: only they can read or write it.
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
