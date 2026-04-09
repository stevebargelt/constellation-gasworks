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

export async function createUser(
  id: string,
  displayName: string,
  username: string
): Promise<User | null> {
  const { data } = await supabase
    .from("users")
    .insert({ id, display_name: displayName, username })
    .select()
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

/**
 * Upload an avatar file to Supabase Storage under avatars/{userId}/avatar.{ext}
 * and return the public URL. Works in both web (File/Blob) and React Native (Blob).
 */
export async function uploadAvatar(userId: string, file: Blob, ext: string): Promise<string> {
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type || `image/${ext}` });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
