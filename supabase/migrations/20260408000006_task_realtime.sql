-- Migration: task_realtime (co-4ie)
-- Task lists, task list members, and tasks schema and RLS are fully defined in
-- 20260408000000_initial_schema.sql and 20260408000001_rls_policies.sql.
--
-- This migration enables Supabase Realtime postgres_changes for task tables
-- so that useTasks/useTaskLists hooks can subscribe to live updates (co-dlk).
-- The supabase_realtime publication must include these tables for
-- .on("postgres_changes", ...) subscriptions to fire.
--
-- Depends on: 20260408000000_initial_schema.sql, 20260408000001_rls_policies.sql

-- ---------------------------------------------------------------------------
-- Enable Realtime for task tables.
-- ALTER PUBLICATION is idempotent-safe: adding an already-added table is a no-op
-- in PostgreSQL 15+. Using DO block to guard against the publication not existing
-- in environments where supabase_realtime is created post-migration.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_lists;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_list_members;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    END IF;
END;
$$;
