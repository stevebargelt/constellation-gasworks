import type { LivingSpace, LivingSpaceMember, MealPlan, User } from "@constellation/types";
import { supabase } from "./client";

export interface LivingSpaceMemberWithProfile extends LivingSpaceMember {
  user: User;
}

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

export async function getLivingSpaceMembersWithProfiles(
  livingSpaceId: string
): Promise<LivingSpaceMemberWithProfile[]> {
  const { data } = await supabase
    .from("living_space_members")
    .select("*, user:users(*)")
    .eq("living_space_id", livingSpaceId)
    .returns<LivingSpaceMemberWithProfile[]>();
  return data ?? [];
}

/**
 * Add a member to a living space.
 * Enforces in the API layer: the target user must be an active direct relationship
 * of the current user (or the current user is adding themselves).
 */
export async function addLivingSpaceMember(
  livingSpaceId: string,
  userId: string
): Promise<LivingSpaceMember | null> {
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) throw new Error("Not authenticated");

  if (userId !== currentUser.id) {
    // Verify active direct relationship
    const { data: rels } = await supabase
      .from("relationships")
      .select("id")
      .eq("status", "active")
      .or(
        `and(user_a_id.eq.${currentUser.id},user_b_id.eq.${userId}),and(user_a_id.eq.${userId},user_b_id.eq.${currentUser.id})`
      )
      .limit(1);

    if (!rels || rels.length === 0) {
      throw new Error("User must be an active direct relationship to add as member");
    }
  }

  const { data } = await supabase
    .from("living_space_members")
    .insert({ living_space_id: livingSpaceId, user_id: userId })
    .select()
    .single();
  return data;
}

export async function removeLivingSpaceMember(
  livingSpaceId: string,
  userId: string
): Promise<void> {
  await supabase
    .from("living_space_members")
    .delete()
    .eq("living_space_id", livingSpaceId)
    .eq("user_id", userId);
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
