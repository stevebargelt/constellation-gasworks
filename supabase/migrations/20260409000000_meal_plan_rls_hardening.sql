-- Migration: meal_plan_rls_hardening
-- Corrects RLS policies for meal plan tables to match co-d99 specification:
--   meal_plans       — UPDATE/DELETE: creator only (drops member UPDATE access)
--   meal_plan_members — INSERT: creator only (drops self-add and member-add paths)
--   meal_plan_days   — INSERT/UPDATE/DELETE: creator only (drops member mutate access)
--   shopping_list_items — INSERT/DELETE: creator only; UPDATE: creator or member
-- Also adds CHECK constraint on meal_plan_days.meal_type.
-- Depends on: 20260408000001_rls_policies.sql

-- ---------------------------------------------------------------------------
-- meal_plans
-- UPDATE/DELETE restricted to creator only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "meal_plans_update" ON public.meal_plans;
DROP POLICY IF EXISTS "meal_plans_delete" ON public.meal_plans;

CREATE POLICY "meal_plans_update" ON public.meal_plans
    FOR UPDATE USING (creator_id = auth.uid())
    WITH CHECK (creator_id = auth.uid());

CREATE POLICY "meal_plans_delete" ON public.meal_plans
    FOR DELETE USING (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- meal_plan_members
-- INSERT restricted to creator of the meal plan only.
-- DELETE: creator removes anyone; member removes themselves (unchanged).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "meal_plan_members_insert" ON public.meal_plan_members;

CREATE POLICY "meal_plan_members_insert" ON public.meal_plan_members
    FOR INSERT WITH CHECK (
        meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- meal_plan_days
-- INSERT/UPDATE/DELETE restricted to creator of the meal plan only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "meal_plan_days_insert" ON public.meal_plan_days;
DROP POLICY IF EXISTS "meal_plan_days_update" ON public.meal_plan_days;
DROP POLICY IF EXISTS "meal_plan_days_delete" ON public.meal_plan_days;

CREATE POLICY "meal_plan_days_insert" ON public.meal_plan_days
    FOR INSERT WITH CHECK (
        meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
    );

CREATE POLICY "meal_plan_days_update" ON public.meal_plan_days
    FOR UPDATE USING (
        meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
    )
    WITH CHECK (
        meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
    );

CREATE POLICY "meal_plan_days_delete" ON public.meal_plan_days
    FOR DELETE USING (
        meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- shopping_list_items
-- SELECT: creator or any member (unchanged).
-- UPDATE: creator or any member (for collaborative check-off).
-- INSERT/DELETE: creator only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "shopping_list_items_insert" ON public.shopping_list_items;
DROP POLICY IF EXISTS "shopping_list_items_update" ON public.shopping_list_items;
DROP POLICY IF EXISTS "shopping_list_items_delete" ON public.shopping_list_items;

CREATE POLICY "shopping_list_items_insert" ON public.shopping_list_items
    FOR INSERT WITH CHECK (
        meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
    );

-- Members can update (primarily to toggle is_checked); creator can update any field.
CREATE POLICY "shopping_list_items_update" ON public.shopping_list_items
    FOR UPDATE USING (
        meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
        OR meal_plan_id IN (
            SELECT meal_plan_id FROM public.meal_plan_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "shopping_list_items_delete" ON public.shopping_list_items
    FOR DELETE USING (
        meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- meal_plan_days.meal_type CHECK constraint
-- Enforces [breakfast|lunch|dinner|snack] at the database level.
-- ---------------------------------------------------------------------------
ALTER TABLE public.meal_plan_days
    ADD CONSTRAINT meal_plan_days_meal_type_check
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack'));
