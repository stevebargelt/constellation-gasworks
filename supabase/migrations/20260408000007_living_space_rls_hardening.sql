-- Migration: living_space_rls_hardening (co-ec4)
-- Adds creator_id to living_spaces and hardens RLS policies to enforce
-- owner-based access control for living spaces and their membership.
-- Depends on: 20260408000000_initial_schema.sql, 20260408000001_rls_policies.sql

-- ---------------------------------------------------------------------------
-- Add creator_id to living_spaces.
-- The initial schema omitted this column; UPDATE and DELETE must be
-- restricted to the space creator, not any member.
-- ---------------------------------------------------------------------------
ALTER TABLE public.living_spaces
    ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Backfill: for spaces that existed before this migration, infer the creator
-- from the earliest member record. In practice the tables start empty at
-- schema creation so this UPDATE is a no-op, but it keeps the migration
-- safe against any test data.
UPDATE public.living_spaces ls
SET creator_id = (
    SELECT user_id
    FROM public.living_space_members lsm
    WHERE lsm.living_space_id = ls.id
    ORDER BY lsm.created_at ASC
    LIMIT 1
)
WHERE ls.creator_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_living_spaces_creator ON public.living_spaces(creator_id);

-- ---------------------------------------------------------------------------
-- Harden RLS for living_spaces.
--
-- SELECT: member visibility (via living_space_members) OR space creator.
--   The creator needs read access immediately after space creation and before
--   their self-enrollment member row is inserted.
--
-- INSERT: creator_id must equal auth.uid(). Tightens the prior
--   "any authenticated user" check to prevent inserting spaces on behalf
--   of other users.
--
-- UPDATE/DELETE: creator only. Previously allowed any member to mutate/delete
--   the space, which is too permissive.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "living_spaces_select" ON public.living_spaces;
DROP POLICY IF EXISTS "living_spaces_insert" ON public.living_spaces;
DROP POLICY IF EXISTS "living_spaces_update" ON public.living_spaces;
DROP POLICY IF EXISTS "living_spaces_delete" ON public.living_spaces;

CREATE POLICY "living_spaces_select" ON public.living_spaces
    FOR SELECT USING (
        creator_id = auth.uid()
        OR id IN (
            SELECT living_space_id FROM public.living_space_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "living_spaces_insert" ON public.living_spaces
    FOR INSERT WITH CHECK (creator_id = auth.uid());

CREATE POLICY "living_spaces_update" ON public.living_spaces
    FOR UPDATE USING (creator_id = auth.uid())
    WITH CHECK (creator_id = auth.uid());

CREATE POLICY "living_spaces_delete" ON public.living_spaces
    FOR DELETE USING (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Harden RLS for living_space_members.
--
-- INSERT: only the space creator can add members. The API layer enforces the
--   direct-partner constraint (users must be direct partners of the creator
--   before being added). Self-enrollment by the creator is included here
--   because creator_id = auth.uid() covers adding user_id = auth.uid() too.
--
-- DELETE: a user can leave a space themselves, or the space creator can
--   remove any member. Previously allowed any member to remove others.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "living_space_members_insert" ON public.living_space_members;
DROP POLICY IF EXISTS "living_space_members_delete" ON public.living_space_members;

CREATE POLICY "living_space_members_insert" ON public.living_space_members
    FOR INSERT WITH CHECK (
        living_space_id IN (
            SELECT id FROM public.living_spaces WHERE creator_id = auth.uid()
        )
    );

CREATE POLICY "living_space_members_delete" ON public.living_space_members
    FOR DELETE USING (
        -- User leaving the space voluntarily
        user_id = auth.uid()
        -- Or space creator removing a member
        OR living_space_id IN (
            SELECT id FROM public.living_spaces WHERE creator_id = auth.uid()
        )
    );

-- SELECT remains as defined in 20260408000001 (visible to all members of the
-- same space). No change needed.
