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

export async function getRecipeIngredientsForRecipes(
  recipeIds: string[]
): Promise<RecipeIngredient[]> {
  if (!recipeIds.length) return [];
  const { data } = await supabase
    .from("recipe_ingredients")
    .select("*")
    .in("recipe_id", recipeIds)
    .order("sort_order");
  return data ?? [];
}

export async function getSharedRecipes(): Promise<Recipe[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: shares } = await supabase
    .from("recipe_shares")
    .select("recipe_id")
    .eq("shared_with_id", user.id);
  if (!shares?.length) return [];
  const ids = shares.map((s: { recipe_id: string }) => s.recipe_id);
  const { data } = await supabase.from("recipes").select("*").in("id", ids);
  return data ?? [];
}

export async function getRecipeShares(recipeId: string): Promise<RecipeShare[]> {
  const { data } = await supabase
    .from("recipe_shares")
    .select("*")
    .eq("recipe_id", recipeId);
  return data ?? [];
}

export async function copyRecipe(recipeId: string): Promise<Recipe | null> {
  const [recipe, ingredients] = await Promise.all([
    getRecipe(recipeId),
    getRecipeIngredients(recipeId),
  ]);
  if (!recipe) return null;
  const copy = await createRecipe({
    title: recipe.title,
    instructions: recipe.instructions,
    servings: recipe.servings,
    notes: recipe.notes,
    tags: recipe.tags,
  });
  if (copy && ingredients.length) {
    await replaceRecipeIngredients(
      copy.id,
      ingredients.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, sort_order: i.sort_order }))
    );
  }
  return copy;
}

/** Replace all ingredients for a recipe atomically: delete existing, insert new list. */
export async function replaceRecipeIngredients(
  recipeId: string,
  ingredients: Omit<RecipeIngredient, "id" | "recipe_id">[]
): Promise<RecipeIngredient[]> {
  await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
  if (!ingredients.length) return [];
  const { data } = await supabase
    .from("recipe_ingredients")
    .insert(
      ingredients.map((ing, i) => ({
        recipe_id: recipeId,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        sort_order: i,
      }))
    )
    .select()
    .order("sort_order");
  return data ?? [];
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

export async function revokeShare(
  recipeId: string,
  sharedWithId: string
): Promise<void> {
  await supabase
    .from("recipe_shares")
    .delete()
    .eq("recipe_id", recipeId)
    .eq("shared_with_id", sharedWithId);
}
