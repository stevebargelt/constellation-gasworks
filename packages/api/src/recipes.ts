import type { Recipe, RecipeIngredient, RecipeShare } from "@constellation/types";
import { supabase } from "./client";

export async function getRecipes(): Promise<Recipe[]> {
  const { data } = await supabase.from("recipes").select("*");
  return data ?? [];
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  const { data } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export async function createRecipe(
  recipe: Omit<Recipe, "id" | "owner_id" | "updated_at">
): Promise<Recipe | null> {
  const { data } = await supabase
    .from("recipes")
    .insert(recipe)
    .select()
    .single();
  return data;
}

export async function updateRecipe(
  id: string,
  updates: Partial<Omit<Recipe, "id" | "owner_id" | "updated_at">>
): Promise<Recipe | null> {
  const { data } = await supabase
    .from("recipes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  return data;
}

export async function deleteRecipe(id: string): Promise<void> {
  await supabase.from("recipes").delete().eq("id", id);
}

export async function getRecipeIngredients(
  recipeId: string
): Promise<RecipeIngredient[]> {
  const { data } = await supabase
    .from("recipe_ingredients")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("sort_order");
  return data ?? [];
}

export async function getSharedRecipes(): Promise<Recipe[]> {
  const { data } = await supabase
    .from("recipe_shares")
    .select("recipes(*)")
    .returns<{ recipes: Recipe }[]>();
  return (data ?? []).map((row) => row.recipes).filter(Boolean);
}

export async function shareRecipe(
  recipeId: string,
  sharedWithId: string
): Promise<RecipeShare | null> {
  const { data } = await supabase
    .from("recipe_shares")
    .insert({ recipe_id: recipeId, shared_with_id: sharedWithId })
    .select()
    .single();
  return data;
}

export async function revokeRecipeShare(shareId: string): Promise<void> {
  await supabase.from("recipe_shares").delete().eq("id", shareId);
}
