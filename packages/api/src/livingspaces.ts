import type { LivingSpace, LivingSpaceMember, MealPlan } from "@constellation/types";
import { supabase } from "./client";

export async function getLivingSpaces(): Promise<LivingSpace[]> {
  const { data } = await supabase.from("living_spaces").select("*");
  return data ?? [];
}

export async function createLivingSpace(
  name: string,
  address?: string | null
): Promise<LivingSpace | null> {
  const { data } = await supabase
    .from("living_spaces")
    .insert({ name, address: address ?? null })
    .select()
    .single();
  return data;
}

export async function updateLivingSpace(
  id: string,
  updates: { name?: string; address?: string | null }
): Promise<LivingSpace | null> {
  const { data } = await supabase
    .from("living_spaces")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  return data;
}

export async function deleteLivingSpace(id: string): Promise<void> {
  await supabase.from("living_spaces").delete().eq("id", id);
}

export async function getLivingSpaceMembers(
  livingSpaceId: string
): Promise<LivingSpaceMember[]> {
  const { data } = await supabase
    .from("living_space_members")
    .select("*")
    .eq("living_space_id", livingSpaceId);
  return data ?? [];
}

export async function getMealPlansForSpace(
  livingSpaceId: string
): Promise<MealPlan[]> {
  const { data } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("living_space_id", livingSpaceId);
  return data ?? [];
}
