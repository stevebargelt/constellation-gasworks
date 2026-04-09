import type { Task, TaskList, TaskListMember } from "@constellation/types";
import { supabase } from "./client";

export async function getTaskLists(): Promise<TaskList[]> {
  const { data } = await supabase.from("task_lists").select("*");
  return data ?? [];
}

export async function createTaskList(
  title: string
): Promise<TaskList | null> {
  const { data } = await supabase
    .from("task_lists")
    .insert({ title })
    .select()
    .single();
  return data;
}

export async function updateTaskList(
  id: string,
  updates: { title: string }
): Promise<TaskList | null> {
  const { data } = await supabase
    .from("task_lists")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  return data;
}

export async function deleteTaskList(id: string): Promise<void> {
  await supabase.from("task_lists").delete().eq("id", id);
}

export async function getTaskListMembers(
  taskListId: string
): Promise<TaskListMember[]> {
  const { data } = await supabase
    .from("task_list_members")
    .select("*")
    .eq("task_list_id", taskListId);
  return data ?? [];
}

export async function addTaskListMember(
  taskListId: string,
  userId: string
): Promise<TaskListMember | null> {
  const { data } = await supabase
    .from("task_list_members")
    .insert({ task_list_id: taskListId, user_id: userId })
    .select()
    .single();
  return data;
}

export async function removeTaskListMember(
  taskListId: string,
  userId: string
): Promise<void> {
  await supabase
    .from("task_list_members")
    .delete()
    .eq("task_list_id", taskListId)
    .eq("user_id", userId);
}

export async function getTasks(taskListId: string): Promise<Task[]> {
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("task_list_id", taskListId);
  return data ?? [];
}

export async function createTask(
  task: Omit<Task, "id" | "creator_id" | "completed_at" | "updated_at">
): Promise<Task | null> {
  const { data } = await supabase
    .from("tasks")
    .insert(task)
    .select()
    .single();
  return data;
}

export async function updateTask(
  id: string,
  updates: Partial<Omit<Task, "id" | "creator_id" | "updated_at">>
): Promise<Task | null> {
  const { data } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  await supabase.from("tasks").delete().eq("id", id);
}
