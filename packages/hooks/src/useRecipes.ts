import { useEffect, useState } from "react";
import type { Recipe } from "@constellation/types";
import { createRecipe, deleteRecipe, getRecipes, updateRecipe } from "@constellation/api";

interface RecipesState {
  recipes: Recipe[];
  loading: boolean;
  error: Error | null;
  create: (recipe: Omit<Recipe, "id" | "owner_id" | "updated_at">) => Promise<void>;
  update: (id: string, updates: Partial<Omit<Recipe, "id" | "owner_id" | "updated_at">>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useRecipes(): RecipesState {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = () => {
    setLoading(true);
    getRecipes()
      .then(setRecipes)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async (recipe: Omit<Recipe, "id" | "owner_id" | "updated_at">) => {
    await createRecipe(recipe);
    load();
  };

  const update = async (id: string, updates: Partial<Omit<Recipe, "id" | "owner_id" | "updated_at">>) => {
    await updateRecipe(id, updates);
    load();
  };

  const remove = async (id: string) => {
    await deleteRecipe(id);
    load();
  };

  return { recipes, loading, error, create, update, remove };
}
