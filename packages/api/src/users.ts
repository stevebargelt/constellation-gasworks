import type { User } from "@constellation/types";
import { supabase } from "./client";

export async function getUser(id: string): Promise<User | null> {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export async function updateUser(
  id: string,
  updates: Partial<Omit<User, "id" | "created_at">>
): Promise<User | null> {
  const { data } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  return data;
}
