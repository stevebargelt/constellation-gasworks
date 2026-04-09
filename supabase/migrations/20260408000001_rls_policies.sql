-- Migration: rls_policies
-- Implements get_permission() SECURITY DEFINER function and all RLS policies.
-- This is the security boundary for all privacy guarantees in the Constellation app.
-- Depends on: 20260408000000_initial_schema.sql

-- ---------------------------------------------------------------------------
-- get_permission()
-- Returns the effective permission level for viewer_id accessing owner_id's
-- data of resource type ('calendar', 'tasks', 'meals').
-- Priority: explicit grant > active relationship default ('free_busy') > 'none'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_permission(
    viewer_id uuid,
    owner_id  uuid,
    resource  text
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COALESCE(
        -- Explicit permission grant (most specific wins)
        (
            SELECT rp.level
            FROM public.relationship_permissions rp
            JOIN public.relationships r ON rp.relationship_id = r.id
            WHERE rp.grantor_id = owner_id
              AND rp.resource_type = resource
              AND r.status = 'active'
              AND (
                (r.user_a_id = owner_id AND r.user_b_id = viewer_id) OR
                (r.user_b_id = owner_id AND r.user_a_id = viewer_id)
              )
            LIMIT 1
        ),
        -- Default: active relationship → 'free_busy', no relationship → 'none'
        CASE WHEN EXISTS (
            SELECT 1 FROM public.relationships r
            WHERE r.status = 'active'
              AND (
                (r.user_a_id = owner_id AND r.user_b_id = viewer_id) OR
                (r.user_b_id = owner_id AND r.user_a_id = viewer_id)
              )
        ) THEN 'free_busy' ELSE 'none' END
    );
$$;

-- ---------------------------------------------------------------------------
-- users
-- Public profiles — any authenticated user can read all profiles (needed for
-- username search and invite flows). Users can only write their own record.
-- The handle_new_user trigger is SECURITY DEFINER and bypasses RLS on INSERT.
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select" ON public.users
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "users_insert" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update" ON public.users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- No DELETE policy: users are deleted via CASCADE from auth.users.

-- ---------------------------------------------------------------------------
-- relationships
-- Visible only to the two parties involved.
-- ---------------------------------------------------------------------------
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "relationships_select" ON public.relationships
    FOR SELECT USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- Either party can initiate. The CHECK constraint enforces user_a_id < user_b_id
-- so the application layer must order the IDs before inserting.
CREATE POLICY "relationships_insert" ON public.relationships
    FOR INSERT WITH CHECK (user_a_id = auth.uid() OR user_b_id = auth.uid());

CREATE POLICY "relationships_update" ON public.relationships
    FOR UPDATE USING (user_a_id = auth.uid() OR user_b_id = auth.uid())
    WITH CHECK (user_a_id = auth.uid() OR user_b_id = auth.uid());

CREATE POLICY "relationships_delete" ON public.relationships
    FOR DELETE USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- ---------------------------------------------------------------------------
-- relationship_permissions
-- Only the grantor controls their own permission grants.
-- Both parties of a relationship can read the permissions on that relationship.
-- ---------------------------------------------------------------------------
ALTER TABLE public.relationship_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "relationship_permissions_select" ON public.relationship_permissions
    FOR SELECT USING (
        grantor_id = auth.uid()
        OR relationship_id IN (
            SELECT id FROM public.relationships
            WHERE user_a_id = auth.uid() OR user_b_id = auth.uid()
        )
    );

CREATE POLICY "relationship_permissions_insert" ON public.relationship_permissions
    FOR INSERT WITH CHECK (grantor_id = auth.uid());

CREATE POLICY "relationship_permissions_update" ON public.relationship_permissions
    FOR UPDATE USING (grantor_id = auth.uid())
    WITH CHECK (grantor_id = auth.uid());

CREATE POLICY "relationship_permissions_delete" ON public.relationship_permissions
    FOR DELETE USING (grantor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- living_spaces
-- Visible and mutable only to members. Any authenticated user can create a
-- new space (they add themselves as a member in the same transaction).
-- ---------------------------------------------------------------------------
ALTER TABLE public.living_spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "living_spaces_select" ON public.living_spaces
    FOR SELECT USING (
        id IN (
            SELECT living_space_id FROM public.living_space_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "living_spaces_insert" ON public.living_spaces
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "living_spaces_update" ON public.living_spaces
    FOR UPDATE USING (
        id IN (
            SELECT living_space_id FROM public.living_space_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "living_spaces_delete" ON public.living_spaces
    FOR DELETE USING (
        id IN (
            SELECT living_space_id FROM public.living_space_members
            WHERE user_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- living_space_members
-- Visible to all members of the same space. Any member can add others.
-- A user can always remove themselves; a member can remove others.
-- ---------------------------------------------------------------------------
ALTER TABLE public.living_space_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "living_space_members_select" ON public.living_space_members
    FOR SELECT USING (
        living_space_id IN (
            SELECT living_space_id FROM public.living_space_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "living_space_members_insert" ON public.living_space_members
    FOR INSERT WITH CHECK (
        -- Any member of the space can add a new member, or a user can add themselves
        user_id = auth.uid()
        OR living_space_id IN (
            SELECT living_space_id FROM public.living_space_members
            WHERE user_id = auth.uid()
        )
    );

-- No UPDATE: membership rows have no mutable fields beyond created_at.

CREATE POLICY "living_space_members_delete" ON public.living_space_members
    FOR DELETE USING (
        user_id = auth.uid()
        OR living_space_id IN (
            SELECT living_space_id FROM public.living_space_members
            WHERE user_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- calendar_events
-- SELECT: own events OR attendee OR (not private AND permission in full/free_busy)
-- INSERT/UPDATE/DELETE: own events only.
-- ---------------------------------------------------------------------------
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_events_select" ON public.calendar_events
    FOR SELECT USING (
        creator_id = auth.uid()
        OR id IN (
            SELECT event_id FROM public.event_attendees WHERE user_id = auth.uid()
        )
        OR (
            NOT is_private
            AND public.get_permission(auth.uid(), creator_id, 'calendar') IN ('full', 'free_busy')
        )
    );

CREATE POLICY "calendar_events_insert" ON public.calendar_events
    FOR INSERT WITH CHECK (creator_id = auth.uid());

CREATE POLICY "calendar_events_update" ON public.calendar_events
    FOR UPDATE USING (creator_id = auth.uid())
    WITH CHECK (creator_id = auth.uid());

CREATE POLICY "calendar_events_delete" ON public.calendar_events
    FOR DELETE USING (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- event_attendees
-- SELECT: visible to the event creator and the attendee.
-- INSERT: event creator can invite; any user can add themselves.
-- UPDATE: only the attendee can update their own RSVP status.
-- DELETE: event creator can remove attendees; attendee can remove themselves.
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_attendees_select" ON public.event_attendees
    FOR SELECT USING (
        user_id = auth.uid()
        OR event_id IN (
            SELECT id FROM public.calendar_events WHERE creator_id = auth.uid()
        )
    );

CREATE POLICY "event_attendees_insert" ON public.event_attendees
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        OR event_id IN (
            SELECT id FROM public.calendar_events WHERE creator_id = auth.uid()
        )
    );

CREATE POLICY "event_attendees_update" ON public.event_attendees
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "event_attendees_delete" ON public.event_attendees
    FOR DELETE USING (
        user_id = auth.uid()
        OR event_id IN (
            SELECT id FROM public.calendar_events WHERE creator_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- task_lists
-- SELECT: visible to creator or any member.
-- INSERT: any authenticated user can create a task list.
-- UPDATE: creator or any member can update.
-- DELETE: creator only.
-- ---------------------------------------------------------------------------
ALTER TABLE public.task_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_lists_select" ON public.task_lists
    FOR SELECT USING (
        creator_id = auth.uid()
        OR id IN (
            SELECT task_list_id FROM public.task_list_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "task_lists_insert" ON public.task_lists
    FOR INSERT WITH CHECK (creator_id = auth.uid());

CREATE POLICY "task_lists_update" ON public.task_lists
    FOR UPDATE USING (
        creator_id = auth.uid()
        OR id IN (
            SELECT task_list_id FROM public.task_list_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "task_lists_delete" ON public.task_lists
    FOR DELETE USING (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- task_list_members
-- SELECT: visible to all members of the same task list.
-- INSERT: task list creator or existing member can add; user can add themselves.
-- DELETE: creator can remove anyone; member can remove themselves.
-- ---------------------------------------------------------------------------
ALTER TABLE public.task_list_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_list_members_select" ON public.task_list_members
    FOR SELECT USING (
        task_list_id IN (
            SELECT task_list_id FROM public.task_list_members WHERE user_id = auth.uid()
        )
        OR task_list_id IN (
            SELECT id FROM public.task_lists WHERE creator_id = auth.uid()
        )
    );

CREATE POLICY "task_list_members_insert" ON public.task_list_members
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        OR task_list_id IN (
            SELECT id FROM public.task_lists WHERE creator_id = auth.uid()
        )
        OR task_list_id IN (
            SELECT task_list_id FROM public.task_list_members WHERE user_id = auth.uid()
        )
    );

-- No UPDATE: membership rows have no meaningful mutable fields.

CREATE POLICY "task_list_members_delete" ON public.task_list_members
    FOR DELETE USING (
        user_id = auth.uid()
        OR task_list_id IN (
            SELECT id FROM public.task_lists WHERE creator_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- tasks
-- SELECT: creator, assignee, task list member, OR (not private AND
--         get_permission on task list creator = 'full'/'free_busy')
-- INSERT: task list creator or member can create tasks.
-- UPDATE: creator, assignee, or task list member can update.
-- DELETE: creator only.
-- ---------------------------------------------------------------------------
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON public.tasks
    FOR SELECT USING (
        creator_id = auth.uid()
        OR assignee_id = auth.uid()
        OR task_list_id IN (
            SELECT task_list_id FROM public.task_list_members WHERE user_id = auth.uid()
        )
        OR (
            NOT is_private
            AND task_list_id IN (
                SELECT tl.id FROM public.task_lists tl
                WHERE public.get_permission(auth.uid(), tl.creator_id, 'tasks') IN ('full', 'free_busy')
            )
        )
    );

CREATE POLICY "tasks_insert" ON public.tasks
    FOR INSERT WITH CHECK (
        creator_id = auth.uid()
        AND (
            task_list_id IN (
                SELECT id FROM public.task_lists WHERE creator_id = auth.uid()
            )
            OR task_list_id IN (
                SELECT task_list_id FROM public.task_list_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "tasks_update" ON public.tasks
    FOR UPDATE USING (
        creator_id = auth.uid()
        OR assignee_id = auth.uid()
        OR task_list_id IN (
            SELECT task_list_id FROM public.task_list_members WHERE user_id = auth.uid()
        )
        OR task_list_id IN (
            SELECT id FROM public.task_lists WHERE creator_id = auth.uid()
        )
    );

CREATE POLICY "tasks_delete" ON public.tasks
    FOR DELETE USING (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- recipes
-- SELECT: owner sees all; shared_with users see shared recipes.
-- INSERT/UPDATE/DELETE: owner only.
-- ---------------------------------------------------------------------------
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
-- Access mirrors recipe visibility. Only the recipe owner can mutate.
-- ---------------------------------------------------------------------------
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
-- INSERT/DELETE: recipe owner only.
-- ---------------------------------------------------------------------------
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

-- No UPDATE: share rows are insert/delete only.

CREATE POLICY "recipe_shares_delete" ON public.recipe_shares
    FOR DELETE USING (
        recipe_id IN (
            SELECT id FROM public.recipes WHERE owner_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- meal_plans
-- SELECT: creator or any member.
-- INSERT: authenticated users can create meal plans.
-- UPDATE: creator or any member.
-- DELETE: creator only.
-- ---------------------------------------------------------------------------
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_plans_select" ON public.meal_plans
    FOR SELECT USING (
        creator_id = auth.uid()
        OR id IN (
            SELECT meal_plan_id FROM public.meal_plan_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "meal_plans_insert" ON public.meal_plans
    FOR INSERT WITH CHECK (creator_id = auth.uid());

CREATE POLICY "meal_plans_update" ON public.meal_plans
    FOR UPDATE USING (
        creator_id = auth.uid()
        OR id IN (
            SELECT meal_plan_id FROM public.meal_plan_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "meal_plans_delete" ON public.meal_plans
    FOR DELETE USING (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- meal_plan_members
-- SELECT: visible to all members of the same meal plan.
-- INSERT: creator or existing member can add; user can add themselves.
-- DELETE: creator can remove anyone; member can remove themselves.
-- ---------------------------------------------------------------------------
ALTER TABLE public.meal_plan_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_plan_members_select" ON public.meal_plan_members
    FOR SELECT USING (
        meal_plan_id IN (
            SELECT meal_plan_id FROM public.meal_plan_members WHERE user_id = auth.uid()
        )
        OR meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
    );

CREATE POLICY "meal_plan_members_insert" ON public.meal_plan_members
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        OR meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
        OR meal_plan_id IN (
            SELECT meal_plan_id FROM public.meal_plan_members WHERE user_id = auth.uid()
        )
    );

-- No UPDATE: membership rows have no meaningful mutable fields.

CREATE POLICY "meal_plan_members_delete" ON public.meal_plan_members
    FOR DELETE USING (
        user_id = auth.uid()
        OR meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- meal_plan_days
-- Access mirrors meal plan membership. Any member can mutate.
-- ---------------------------------------------------------------------------
ALTER TABLE public.meal_plan_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_plan_days_select" ON public.meal_plan_days
    FOR SELECT USING (
        meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
        OR meal_plan_id IN (
            SELECT meal_plan_id FROM public.meal_plan_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "meal_plan_days_insert" ON public.meal_plan_days
    FOR INSERT WITH CHECK (
        meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
        OR meal_plan_id IN (
            SELECT meal_plan_id FROM public.meal_plan_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "meal_plan_days_update" ON public.meal_plan_days
    FOR UPDATE USING (
        meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
        OR meal_plan_id IN (
            SELECT meal_plan_id FROM public.meal_plan_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "meal_plan_days_delete" ON public.meal_plan_days
    FOR DELETE USING (
        meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
        OR meal_plan_id IN (
            SELECT meal_plan_id FROM public.meal_plan_members WHERE user_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- shopping_list_items
-- Access mirrors meal plan membership. Any member can check off items.
-- ---------------------------------------------------------------------------
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopping_list_items_select" ON public.shopping_list_items
    FOR SELECT USING (
        meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
        OR meal_plan_id IN (
            SELECT meal_plan_id FROM public.meal_plan_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "shopping_list_items_insert" ON public.shopping_list_items
    FOR INSERT WITH CHECK (
        meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE creator_id = auth.uid()
        )
        OR meal_plan_id IN (
            SELECT meal_plan_id FROM public.meal_plan_members WHERE user_id = auth.uid()
        )
    );

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
        OR meal_plan_id IN (
            SELECT meal_plan_id FROM public.meal_plan_members WHERE user_id = auth.uid()
        )
    );
