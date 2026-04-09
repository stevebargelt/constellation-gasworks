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
  const sharedChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getTasks(taskListId)
      .then(setTasks)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [taskListId]);

  useEffect(() => {
    load();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const uid = user.id;

      // shared:{uid} — task changes within this list (inserts, updates, deletes by any member).
      // Optimistic local state update on each event; reconcile with server load() after.
      sharedChannelRef.current = supabase
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
      // Fires when someone assigns or unassigns this user; reload to reflect changes
      // in the current list if the assignment affects a task here.
      userChannelRef.current = supabase
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
      if (sharedChannelRef.current) supabase.removeChannel(sharedChannelRef.current);
      if (userChannelRef.current) supabase.removeChannel(userChannelRef.current);
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
    // Persist to server; Realtime will reconcile any drift
    await updateTask(id, {
      status,
      completed_at: status === "complete" ? now : null,
    });
  };

  return { tasks, loading, error, create, update, remove, setStatus };
}
