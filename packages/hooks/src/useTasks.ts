import { useCallback, useEffect, useRef, useState } from "react";
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
  const uidRef = useRef<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getTasks(taskListId)
      .then(setTasks)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [taskListId]);

  useEffect(() => {
    load();

    let sharedChannel: ReturnType<typeof supabase.channel> | null = null;
    let userChannel: ReturnType<typeof supabase.channel> | null = null;

    // Resolve the current user's uid to build user-specific channel names
    // per the architecture channel convention (user:{uid} / shared:{uid}).
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      uidRef.current = user.id;
      const uid = user.id;

      // shared:{uid} — tasks in this specific task list.
      // Filter to task_list_id so only relevant changes trigger reconcile.
      // Optimistic update applied from payload; load() reconciles server state.
      sharedChannel = supabase
        .channel(`shared:${uid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "tasks",
            filter: `task_list_id=eq.${taskListId}`,
          },
          (payload) => {
            const newTask = payload.new as Task;
            setTasks((prev) => {
              if (prev.some((t) => t.id === newTask.id)) return prev;
              return [...prev, newTask];
            });
            load();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "tasks",
            filter: `task_list_id=eq.${taskListId}`,
          },
          (payload) => {
            const updated = payload.new as Task;
            setTasks((prev) =>
              prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
            );
            load();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "tasks",
            filter: `task_list_id=eq.${taskListId}`,
          },
          (payload) => {
            const deleted = payload.old as { id: string };
            setTasks((prev) => prev.filter((t) => t.id !== deleted.id));
            load();
          }
        )
        .subscribe();

      // user:{uid} — tasks assigned to the current user across all lists.
      // Catches assignee changes (task assigned to / unassigned from me)
      // that may affect visibility in this list view; triggers reconcile.
      userChannel = supabase
        .channel(`user:${uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tasks",
            filter: `assignee_id=eq.${uid}`,
          },
          () => {
            load();
          }
        )
        .subscribe();
    });

    return () => {
      if (sharedChannel) supabase.removeChannel(sharedChannel);
      if (userChannel) supabase.removeChannel(userChannel);
    };
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
    // Persist to server; Realtime shared:{uid} channel will reconcile any drift
    await updateTask(id, {
      status,
      completed_at: status === "complete" ? now : null,
    });
  };

  return { tasks, loading, error, create, update, remove, setStatus };
}
