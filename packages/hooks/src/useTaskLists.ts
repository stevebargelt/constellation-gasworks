import { useCallback, useEffect, useState } from "react";
import type { TaskList } from "@constellation/types";
import {
  supabase,
  getTaskLists,
  createTaskList,
  updateTaskList,
  deleteTaskList,
  addTaskListMember,
  removeTaskListMember,
} from "@constellation/api";

interface TaskListsState {
  taskLists: TaskList[];
  loading: boolean;
  error: Error | null;
  create: (title: string) => Promise<TaskList | null>;
  update: (id: string, updates: { title: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addMember: (taskListId: string, userId: string) => Promise<void>;
  removeMember: (taskListId: string, userId: string) => Promise<void>;
}

export function useTaskLists(): TaskListsState {
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getTaskLists()
      .then(setTaskLists)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();

    // Subscribe to Realtime changes on task_lists and task_list_members.
    // RLS ensures only rows visible to auth.uid() are returned on refetch.
    const channel = supabase
      .channel("task-lists-own")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_lists" },
        () => { load(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_list_members" },
        () => { load(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const create = async (title: string): Promise<TaskList | null> => {
    const result = await createTaskList(title);
    load();
    return result;
  };

  const update = async (id: string, updates: { title: string }): Promise<void> => {
    await updateTaskList(id, updates);
    load();
  };

  const remove = async (id: string): Promise<void> => {
    await deleteTaskList(id);
    load();
  };

  const addMember = async (taskListId: string, userId: string): Promise<void> => {
    await addTaskListMember(taskListId, userId);
    load();
  };

  const removeMember = async (taskListId: string, userId: string): Promise<void> => {
    await removeTaskListMember(taskListId, userId);
    load();
  };

  return { taskLists, loading, error, create, update, remove, addMember, removeMember };
}
