import { useCallback, useEffect, useRef, useState } from "react";
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
  const uidRef = useRef<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getTaskLists()
      .then(setTaskLists)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();

    let sharedChannel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const id = Math.random().toString(36).slice(2);

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      uidRef.current = user.id;
      const uid = user.id;

      sharedChannel = supabase
        .channel(`tasklists:${uid}:${id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "task_lists" },
          (payload) => {
            const newList = payload.new as TaskList;
            setTaskLists((prev) => {
              if (prev.some((l) => l.id === newList.id)) return prev;
              return [...prev, newList];
            });
            load();
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "task_lists" },
          (payload) => {
            const updated = payload.new as TaskList;
            setTaskLists((prev) =>
              prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l))
            );
            load();
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "task_lists" },
          (payload) => {
            const deleted = payload.old as { id: string };
            setTaskLists((prev) => prev.filter((l) => l.id !== deleted.id));
            load();
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "task_list_members" },
          () => {
            // Membership changes (added to / removed from a list) require
            // a full reload so the list of visible task lists stays accurate.
            load();
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (sharedChannel) supabase.removeChannel(sharedChannel);
    };
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
