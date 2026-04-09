import { useEffect, useState } from "react";
import type { Recipe } from "@constellation/types";
import {
  getRecipes,
  getSharedRecipes,
  createRecipe as apiCreateRecipe,
  updateRecipe as apiUpdateRecipe,
  deleteRecipe as apiDeleteRecipe,
  shareRecipe as apiShareRecipe,
  revokeShare as apiRevokeShare,
} from "@constellation/api";

interface RecipesState {
  recipes: Recipe[];
  sharedRecipes: Recipe[];
  loading: boolean;
  error: Error | null;
  createRecipe: (recipe: Omit<Recipe, "id" | "owner_id" | "updated_at">) => Promise<void>;
  updateRecipe: (id: string, updates: Partial<Omit<Recipe, "id" | "owner_id" | "updated_at">>) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  shareRecipe: (recipeId: string, userId: string) => Promise<void>;
  revokeShare: (recipeId: string, userId: string) => Promise<void>;
}

export function useRecipes(): RecipesState {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [sharedRecipes, setSharedRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([getRecipes(), getSharedRecipes()])
      .then(([own, shared]) => {
        setRecipes(own);
        setSharedRecipes(shared);
      })
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const createRecipe = async (recipe: Omit<Recipe, "id" | "owner_id" | "updated_at">) => {
    await apiCreateRecipe(recipe);
    load();
  };

  const updateRecipe = async (id: string, updates: Partial<Omit<Recipe, "id" | "owner_id" | "updated_at">>) => {
    await apiUpdateRecipe(id, updates);
    load();
  };

  const deleteRecipe = async (id: string) => {
    await apiDeleteRecipe(id);
    load();
  };

  const shareRecipe = async (recipeId: string, userId: string) => {
    await apiShareRecipe(recipeId, userId);
    load();
  };

  const revokeShare = async (recipeId: string, userId: string) => {
    await apiRevokeShare(recipeId, userId);
    load();
  };

  return { recipes, sharedRecipes, loading, error, createRecipe, updateRecipe, deleteRecipe, shareRecipe, revokeShare };
}
