import { useEffect, useState } from "react";
import type { TaskList } from "@constellation/types";
import { createTaskList, getTaskLists } from "@constellation/api";

interface TaskListsState {
  taskLists: TaskList[];
  loading: boolean;
  error: Error | null;
  create: (title: string) => Promise<void>;
}

export function useTaskLists(): TaskListsState {
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = () => {
    setLoading(true);
    getTaskLists()
      .then(setTaskLists)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async (title: string) => {
    await createTaskList(title);
    load();
  };

  return { taskLists, loading, error, create };
}
