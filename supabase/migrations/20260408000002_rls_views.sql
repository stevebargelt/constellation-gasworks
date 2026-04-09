-- Migration: rls_views (co-wg7)
-- Creates RLS-protected views that apply field masking based on get_permission().
-- These views are the ONLY way client code should query sensitive tables.
-- Direct queries against calendar_events (and equivalent tables) are blocked by CI.

-- ---------------------------------------------------------------------------
-- visible_calendar_events
-- Field-masks title, description, location based on permission level.
-- Owner sees full data. Private events return 'Busy'/NULL to others.
-- 'full' permission returns all fields. 'free_busy' or lower masks sensitive fields.
-- viewer_permission column lets clients know how to render the data.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.visible_calendar_events AS
SELECT
    id,
    creator_id,
    start_time,
    end_time,
    is_all_day,
    recurrence_rule,
    recurrence_parent_id,
    created_at,
    -- Field masking: title
    CASE
        WHEN creator_id = auth.uid() THEN title
        WHEN is_private                THEN 'Busy'
        WHEN get_permission(auth.uid(), creator_id, 'calendar') = 'full' THEN title
        ELSE 'Busy'
    END AS title,
    -- Field masking: description
    CASE
        WHEN creator_id = auth.uid() THEN description
        WHEN is_private                THEN NULL
        WHEN get_permission(auth.uid(), creator_id, 'calendar') = 'full' THEN description
        ELSE NULL
    END AS description,
    -- Field masking: location
    CASE
        WHEN creator_id = auth.uid() THEN location
        WHEN is_private                THEN NULL
        WHEN get_permission(auth.uid(), creator_id, 'calendar') = 'full' THEN location
        ELSE NULL
    END AS location,
    -- Expose effective permission level so clients know how to render
    CASE
        WHEN creator_id = auth.uid() THEN 'full'
        WHEN is_private                THEN 'none'
        ELSE get_permission(auth.uid(), creator_id, 'calendar')
    END AS viewer_permission
FROM public.calendar_events
WHERE
    -- Own events always visible
    creator_id = auth.uid()
    -- Events where viewer is an attendee
    OR id IN (
        SELECT event_id FROM public.event_attendees WHERE user_id = auth.uid()
    )
    -- Non-private events from users who granted at least free_busy
    OR (
        NOT is_private
        AND get_permission(auth.uid(), creator_id, 'calendar') IN ('full', 'free_busy')
    );

-- ---------------------------------------------------------------------------
-- visible_tasks
-- Field-masks title and description based on permission level.
-- Own tasks, assigned tasks, and task-list-member tasks are fully visible.
-- Tasks from others with 'full' tasks permission are fully visible.
-- Tasks from others with 'free_busy' tasks permission: title='[Task]', description=NULL.
-- Private tasks are only visible to creator and assignee.
-- viewer_permission column lets clients know how to render the data.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.visible_tasks AS
SELECT
    t.id,
    t.task_list_id,
    t.creator_id,
    t.assignee_id,
    t.due_date,
    t.status,
    t.is_private,
    t.completed_at,
    t.updated_at,
    -- Field masking: title
    CASE
        WHEN t.creator_id = auth.uid()  THEN t.title
        WHEN t.assignee_id = auth.uid() THEN t.title
        WHEN t.task_list_id IN (
            SELECT task_list_id FROM public.task_list_members WHERE user_id = auth.uid()
        )                               THEN t.title
        WHEN t.is_private               THEN '[Task]'
        WHEN get_permission(auth.uid(), t.creator_id, 'tasks') = 'full' THEN t.title
        ELSE '[Task]'
    END AS title,
    -- Field masking: description
    CASE
        WHEN t.creator_id = auth.uid()  THEN t.description
        WHEN t.assignee_id = auth.uid() THEN t.description
        WHEN t.task_list_id IN (
            SELECT task_list_id FROM public.task_list_members WHERE user_id = auth.uid()
        )                               THEN t.description
        WHEN t.is_private               THEN NULL
        WHEN get_permission(auth.uid(), t.creator_id, 'tasks') = 'full' THEN t.description
        ELSE NULL
    END AS description,
    -- Expose effective permission level so clients know how to render
    CASE
        WHEN t.creator_id = auth.uid()  THEN 'full'
        WHEN t.assignee_id = auth.uid() THEN 'full'
        WHEN t.task_list_id IN (
            SELECT task_list_id FROM public.task_list_members WHERE user_id = auth.uid()
        )                               THEN 'full'
        WHEN t.is_private               THEN 'none'
        ELSE get_permission(auth.uid(), t.creator_id, 'tasks')
    END AS viewer_permission
FROM public.tasks t
WHERE
    -- Own tasks always visible
    t.creator_id = auth.uid()
    -- Tasks assigned to viewer
    OR t.assignee_id = auth.uid()
    -- Tasks in lists where viewer is a member
    OR t.task_list_id IN (
        SELECT task_list_id FROM public.task_list_members WHERE user_id = auth.uid()
    )
    -- Non-private tasks from users who granted at least free_busy on tasks
    OR (
        NOT t.is_private
        AND get_permission(auth.uid(), t.creator_id, 'tasks') IN ('full', 'free_busy')
    );

-- ---------------------------------------------------------------------------
-- visible_meal_plans
-- Meal plans have no is_private flag; masking is binary (full or none).
-- Own plans and member plans are fully visible.
-- Plans shared via 'full' meals permission are visible.
-- Plans from users with 'free_busy' meals permission: title masked.
-- viewer_permission column lets clients know how to render the data.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.visible_meal_plans AS
SELECT
    mp.id,
    mp.creator_id,
    mp.week_start_date,
    mp.living_space_id,
    mp.updated_at,
    -- Field masking: title
    CASE
        WHEN mp.creator_id = auth.uid() THEN mp.title
        WHEN mp.id IN (
            SELECT meal_plan_id FROM public.meal_plan_members WHERE user_id = auth.uid()
        )                               THEN mp.title
        WHEN get_permission(auth.uid(), mp.creator_id, 'meals') = 'full' THEN mp.title
        ELSE '[Meal Plan]'
    END AS title,
    -- Expose effective permission level so clients know how to render
    CASE
        WHEN mp.creator_id = auth.uid() THEN 'full'
        WHEN mp.id IN (
            SELECT meal_plan_id FROM public.meal_plan_members WHERE user_id = auth.uid()
        )                               THEN 'full'
        ELSE get_permission(auth.uid(), mp.creator_id, 'meals')
    END AS viewer_permission
FROM public.meal_plans mp
WHERE
    -- Own plans always visible
    mp.creator_id = auth.uid()
    -- Plans where viewer is a member
    OR mp.id IN (
        SELECT meal_plan_id FROM public.meal_plan_members WHERE user_id = auth.uid()
    )
    -- Plans from users who granted at least free_busy on meals
    OR get_permission(auth.uid(), mp.creator_id, 'meals') IN ('full', 'free_busy');
