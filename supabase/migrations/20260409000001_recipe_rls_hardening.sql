-- Migration: recipe_rls_hardening
-- Idempotent recipe-specific RLS policy migration per co-a1n specification.
-- Tables recipes, recipe_ingredients, recipe_shares were created in initial_schema.
-- This migration drops and recreates all recipe RLS policies explicitly,
-- adding WITH CHECK to update policies and serving as the canonical
-- recipe security reference.
-- Depends on: 20260408000001_rls_policies.sql

-- ---------------------------------------------------------------------------
-- recipes
-- SELECT: owner OR shared_with via recipe_shares.
-- INSERT: owner_id must equal auth.uid().
-- UPDATE/DELETE: owner only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "recipes_select" ON public.recipes;
DROP POLICY IF EXISTS "recipes_insert" ON public.recipes;
DROP POLICY IF EXISTS "recipes_update" ON public.recipes;
DROP POLICY IF EXISTS "recipes_delete" ON public.recipes;

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipes_select" ON public.recipes
    FOR SELECT USING (
        owner_id = auth.uid()
        OR id IN (
            SELECT recipe_id FROM public.recipe_shares WHERE shared_with_id = auth.uid()
        )
    );

CREATE POLICY "recipes_insert" ON public.recipes
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "recipes_update" ON public.recipes
    FOR UPDATE USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "recipes_delete" ON public.recipes
    FOR DELETE USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- recipe_ingredients
-- SELECT: mirrors recipe visibility (owner sees all; shared users see shared).
-- INSERT/UPDATE/DELETE: recipe owner only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "recipe_ingredients_select" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_insert" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_update" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_delete" ON public.recipe_ingredients;

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipe_ingredients_select" ON public.recipe_ingredients
    FOR SELECT USING (
        recipe_id IN (
            SELECT id FROM public.recipes WHERE owner_id = auth.uid()
        )
        OR recipe_id IN (
            SELECT recipe_id FROM public.recipe_shares WHERE shared_with_id = auth.uid()
        )
    );

CREATE POLICY "recipe_ingredients_insert" ON public.recipe_ingredients
    FOR INSERT WITH CHECK (
        recipe_id IN (
            SELECT id FROM public.recipes WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "recipe_ingredients_update" ON public.recipe_ingredients
    FOR UPDATE USING (
        recipe_id IN (
            SELECT id FROM public.recipes WHERE owner_id = auth.uid()
        )
    )
    WITH CHECK (
        recipe_id IN (
            SELECT id FROM public.recipes WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "recipe_ingredients_delete" ON public.recipe_ingredients
    FOR DELETE USING (
        recipe_id IN (
            SELECT id FROM public.recipes WHERE owner_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- recipe_shares
-- SELECT: recipe owner or the user the recipe was shared with.
-- INSERT: recipe owner only. Direct-partner enforcement is in the API layer.
-- DELETE: recipe owner only.
-- No UPDATE: share rows are insert/delete only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "recipe_shares_select" ON public.recipe_shares;
DROP POLICY IF EXISTS "recipe_shares_insert" ON public.recipe_shares;
DROP POLICY IF EXISTS "recipe_shares_delete" ON public.recipe_shares;

ALTER TABLE public.recipe_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipe_shares_select" ON public.recipe_shares
    FOR SELECT USING (
        shared_with_id = auth.uid()
        OR recipe_id IN (
            SELECT id FROM public.recipes WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "recipe_shares_insert" ON public.recipe_shares
    FOR INSERT WITH CHECK (
        recipe_id IN (
            SELECT id FROM public.recipes WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "recipe_shares_delete" ON public.recipe_shares
    FOR DELETE USING (
        recipe_id IN (
            SELECT id FROM public.recipes WHERE owner_id = auth.uid()
        )
    );
