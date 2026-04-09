import { useCallback, useEffect, useState } from "react";
import type { Task, TaskStatus } from "@constellation/types";
import { supabase, createTask, deleteTask, getTasks, updateTask } from "@constellation/api";

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: Error | null;
  create: (task: Omit<Task, "id" | "creator_id" | "completed_at" | "updated_at">) => Promise<void>;
  update: (id: string, updates: Partial<Omit<Task, "id" | "creator_id" | "updated_at">>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Optimistically updates task status locally, then persists to server. */
  setStatus: (id: string, status: TaskStatus) => Promise<void>;
}

export function useTasks(taskListId: string): TasksState {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getTasks(taskListId)
      .then(setTasks)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [taskListId]);

  useEffect(() => {
    load();

    // Subscribe to Realtime changes for this task list.
    // Filter by task_list_id so updates from other lists don't trigger reloads.
    const channel = supabase
      .channel(`tasks-list-${taskListId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `task_list_id=eq.${taskListId}`,
        },
        () => { load(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load, taskListId]);

  const create = async (task: Omit<Task, "id" | "creator_id" | "completed_at" | "updated_at">) => {
    await createTask(task);
    load();
  };

  const update = async (id: string, updates: Partial<Omit<Task, "id" | "creator_id" | "updated_at">>) => {
    await updateTask(id, updates);
    load();
  };

  const remove = async (id: string) => {
    await deleteTask(id);
    load();
  };

  const setStatus = async (id: string, status: TaskStatus) => {
    // Optimistic update: apply immediately to local state
    const now = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status,
              completed_at: status === "complete" ? now : null,
            }
          : t
      )
    );
    // Persist to server; Realtime will reconcile any drift
    await updateTask(id, {
      status,
      completed_at: status === "complete" ? now : null,
    });
  };

  return { tasks, loading, error, create, update, remove, setStatus };
}
