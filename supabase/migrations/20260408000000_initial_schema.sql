-- Migration: initial_schema
-- Creates all core tables for the Constellation app.
-- RLS policies and get_permission() are applied in a subsequent migration (co-2lo).

-- ---------------------------------------------------------------------------
-- users
-- Public profile table. id mirrors auth.users(id).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name    text NOT NULL,
    preferred_name  text,
    pronouns        text,
    avatar_url      text,
    username        text NOT NULL UNIQUE,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Trigger: auto-insert a row in public.users when a new auth.users row appears
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.users (id, display_name, username)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'username',     NEW.id::text)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- relationships
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.relationships (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_b_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rel_type     text NOT NULL,
    custom_label text,
    status       text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'declined', 'removed')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT relationships_no_self_loop   CHECK (user_a_id <> user_b_id),
    CONSTRAINT relationships_ordered_ids    CHECK (user_a_id < user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_relationships_user_a ON public.relationships(user_a_id);
CREATE INDEX IF NOT EXISTS idx_relationships_user_b ON public.relationships(user_b_id);
CREATE INDEX IF NOT EXISTS idx_relationships_status  ON public.relationships(status);

-- ---------------------------------------------------------------------------
-- relationship_permissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.relationship_permissions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id uuid NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
    grantor_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    resource_type   text NOT NULL CHECK (resource_type IN ('calendar', 'tasks', 'meals')),
    level           text NOT NULL CHECK (level IN ('full', 'free_busy', 'none')),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT relationship_permissions_unique
        UNIQUE (relationship_id, grantor_id, resource_type)
);

CREATE INDEX IF NOT EXISTS idx_rel_permissions_relationship ON public.relationship_permissions(relationship_id);
CREATE INDEX IF NOT EXISTS idx_rel_permissions_grantor      ON public.relationship_permissions(grantor_id);

-- ---------------------------------------------------------------------------
-- living_spaces
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.living_spaces (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    address    text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- living_space_members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.living_space_members (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    living_space_id uuid NOT NULL REFERENCES public.living_spaces(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (living_space_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_living_space_members_space ON public.living_space_members(living_space_id);
CREATE INDEX IF NOT EXISTS idx_living_space_members_user  ON public.living_space_members(user_id);

-- ---------------------------------------------------------------------------
-- calendar_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title                text NOT NULL,
    description          text,
    location             text,
    start_time           timestamptz NOT NULL,
    end_time             timestamptz NOT NULL,
    is_private           boolean NOT NULL DEFAULT false,
    is_all_day           boolean NOT NULL DEFAULT false,
    recurrence_rule      text,
    recurrence_parent_id uuid REFERENCES public.calendar_events(id) ON DELETE CASCADE,
    created_at           timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT calendar_events_end_after_start CHECK (end_time >= start_time)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_creator    ON public.calendar_events(creator_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_time_range ON public.calendar_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_parent     ON public.calendar_events(recurrence_parent_id);

-- ---------------------------------------------------------------------------
-- event_attendees
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_attendees (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id   uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status     text NOT NULL DEFAULT 'invited'
                    CHECK (status IN ('invited', 'accepted', 'declined')),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON public.event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user  ON public.event_attendees(user_id);

-- ---------------------------------------------------------------------------
-- task_lists
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_lists (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title      text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_lists_creator ON public.task_lists(creator_id);

-- ---------------------------------------------------------------------------
-- task_list_members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_list_members (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_list_id uuid NOT NULL REFERENCES public.task_lists(id) ON DELETE CASCADE,
    user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (task_list_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_list_members_list ON public.task_list_members(task_list_id);
CREATE INDEX IF NOT EXISTS idx_task_list_members_user ON public.task_list_members(user_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_list_id uuid NOT NULL REFERENCES public.task_lists(id) ON DELETE CASCADE,
    creator_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    assignee_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,
    title        text NOT NULL,
    description  text,
    due_date     date,
    status       text NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'in_progress', 'complete')),
    is_private   boolean NOT NULL DEFAULT false,
    completed_at timestamptz,
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_task_list   ON public.tasks(task_list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_creator     ON public.tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee    ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON public.tasks(status);

-- ---------------------------------------------------------------------------
-- recipes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipes (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title        text NOT NULL,
    instructions text,
    servings     integer,
    notes        text,
    tags         text[] NOT NULL DEFAULT '{}',
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipes_owner ON public.recipes(owner_id);

-- ---------------------------------------------------------------------------
-- recipe_ingredients
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id  uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    name       text NOT NULL,
    quantity   text,
    unit       text,
    sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON public.recipe_ingredients(recipe_id);

-- ---------------------------------------------------------------------------
-- recipe_shares
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipe_shares (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id      uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    shared_with_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (recipe_id, shared_with_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_shares_recipe      ON public.recipe_shares(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_shares_shared_with ON public.recipe_shares(shared_with_id);

-- ---------------------------------------------------------------------------
-- meal_plans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meal_plans (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title           text NOT NULL,
    week_start_date date NOT NULL,
    living_space_id uuid REFERENCES public.living_spaces(id) ON DELETE SET NULL,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_plans_creator      ON public.meal_plans(creator_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_living_space ON public.meal_plans(living_space_id);

-- ---------------------------------------------------------------------------
-- meal_plan_members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meal_plan_members (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_id uuid NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
    user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (meal_plan_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_meal_plan_members_plan ON public.meal_plan_members(meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_members_user ON public.meal_plan_members(user_id);

-- ---------------------------------------------------------------------------
-- meal_plan_days
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meal_plan_days (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_id uuid NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
    day_of_week  integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    meal_type    text NOT NULL,
    recipe_id    uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
    free_text    text,
    UNIQUE (meal_plan_id, day_of_week, meal_type)
);

CREATE INDEX IF NOT EXISTS idx_meal_plan_days_plan ON public.meal_plan_days(meal_plan_id);

-- ---------------------------------------------------------------------------
-- shopping_list_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopping_list_items (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_id    uuid NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
    ingredient_name text NOT NULL,
    quantity        text,
    unit            text,
    is_checked      boolean NOT NULL DEFAULT false,
    checked_by_id   uuid REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_plan ON public.shopping_list_items(meal_plan_id);
