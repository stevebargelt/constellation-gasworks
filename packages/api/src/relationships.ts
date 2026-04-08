import type { Relationship, RelationshipPermission } from "@constellation/types";
import { supabase } from "./client";

export async function getRelationships(): Promise<Relationship[]> {
  const { data } = await supabase.from("relationships").select("*");
  return data ?? [];
}

export async function sendRelationshipInvite(params: {
  to: string;
  rel_type: string;
  custom_label?: string;
}): Promise<Relationship | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("relationships")
    .insert({
      user_a_id: user.id,
      user_b_id: params.to,
      rel_type: params.rel_type,
      custom_label: params.custom_label ?? null,
      status: "pending",
    })
    .select()
    .single();
  return data;
}

export async function acceptRelationshipInvite(
  relationshipId: string
): Promise<Relationship | null> {
  const { data } = await supabase
    .from("relationships")
    .update({ status: "active" })
    .eq("id", relationshipId)
    .select()
    .single();
  return data;
}

export async function declineRelationshipInvite(
  relationshipId: string
): Promise<void> {
  await supabase
    .from("relationships")
    .update({ status: "declined" })
    .eq("id", relationshipId);
}

export async function removeRelationship(
  relationshipId: string
): Promise<void> {
  await supabase
    .from("relationships")
    .update({ status: "removed" })
    .eq("id", relationshipId);
}

export async function getRelationshipPermissions(
  relationshipId: string
): Promise<RelationshipPermission[]> {
  const { data } = await supabase
    .from("relationship_permissions")
    .select("*")
    .eq("relationship_id", relationshipId);
  return data ?? [];
}

export async function upsertRelationshipPermission(
  permission: Omit<RelationshipPermission, "id" | "updated_at">
): Promise<RelationshipPermission | null> {
  const { data } = await supabase
    .from("relationship_permissions")
    .upsert(permission, { onConflict: "relationship_id,grantor_id,resource_type" })
    .select()
    .single();
  return data;
}
