import type { UserColor } from "@constellation/types";
import { supabase } from "./client";

export async function getUserColors(): Promise<UserColor[]> {
  const { data } = await supabase.from("user_colors").select("*");
  return data ?? [];
}
