import type { Relationship, UserColor } from "@constellation/types";
import { colors as designTokens } from "@constellation/theme";
import { supabase } from "./client";

const PERSON_PALETTE: readonly string[] = designTokens.person;

export async function getUserColors(viewerId: string): Promise<UserColor[]> {
  const { data } = await supabase
    .from("user_colors")
    .select("*")
    .eq("viewer_id", viewerId);
  return data ?? [];
}

export async function upsertUserColor(
  entry: Omit<UserColor, "id" | "created_at">
): Promise<UserColor | null> {
  const { data } = await supabase
    .from("user_colors")
    .upsert(entry, { onConflict: "viewer_id,target_user_id" })
    .select()
    .single();
  return data;
}

/**
 * Assigns a palette color to each party for the other, skipping colors already
 * in use by that viewer. Called after a relationship is accepted.
 * Idempotent: upsert silently overwrites if an assignment already exists.
 */
export async function assignPersonColors(
  relationship: Pick<Relationship, "user_a_id" | "user_b_id">
): Promise<void> {
  const { user_a_id, user_b_id } = relationship;

  const [aColors, bColors] = await Promise.all([
    getUserColors(user_a_id),
    getUserColors(user_b_id),
  ]);

  const usedByA = new Set(aColors.map((c) => c.color));
  const usedByB = new Set(bColors.map((c) => c.color));

  const colorForB =
    PERSON_PALETTE.find((c) => !usedByA.has(c)) ?? PERSON_PALETTE[0];
  const colorForA =
    PERSON_PALETTE.find((c) => !usedByB.has(c)) ?? PERSON_PALETTE[0];

  await Promise.all([
    upsertUserColor({ viewer_id: user_a_id, target_user_id: user_b_id, color: colorForB }),
    upsertUserColor({ viewer_id: user_b_id, target_user_id: user_a_id, color: colorForA }),
  ]);
}
