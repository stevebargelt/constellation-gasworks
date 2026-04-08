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

export async function getTaskListMembers(
  taskListId: string
): Promise<TaskListMember[]> {
  const { data } = await supabase
    .from("task_list_members")
    .select("*")
    .eq("task_list_id", taskListId);
  return data ?? [];
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
