import { useCallback, useEffect, useState } from "react";
import type { Task } from "@constellation/types";
import { createTask, deleteTask, getTasks, updateTask } from "@constellation/api";

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: Error | null;
  create: (task: Omit<Task, "id" | "creator_id" | "completed_at" | "updated_at">) => Promise<void>;
  update: (id: string, updates: Partial<Omit<Task, "id" | "creator_id" | "updated_at">>) => Promise<void>;
  remove: (id: string) => Promise<void>;
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

  useEffect(() => { load(); }, [load]);

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

  return { tasks, loading, error, create, update, remove };
}
