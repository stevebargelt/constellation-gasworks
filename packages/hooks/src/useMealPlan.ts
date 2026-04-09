import { useCallback, useEffect, useState } from "react";
import type { MealPlan } from "@constellation/types";
import {
  addMealPlanMember,
  createMealPlan as apiCreateMealPlan,
  deleteMealPlan as apiDeleteMealPlan,
  deleteMealPlanDay,
  getMealPlanDays,
  getMealPlans,
  getRecipeIngredients,
  updateMealPlan as apiUpdateMealPlan,
  upsertMealPlanDay,
  upsertShoppingListItems,
} from "@constellation/api";
import { aggregateIngredients } from "@constellation/utils";

interface MealPlanState {
  mealPlans: MealPlan[];
  loading: boolean;
  error: Error | null;
  createMealPlan: (plan: Omit<MealPlan, "id" | "creator_id" | "updated_at">) => Promise<MealPlan | null>;
  updateMealPlan: (id: string, updates: Partial<Omit<MealPlan, "id" | "creator_id" | "updated_at">>) => Promise<void>;
  deleteMealPlan: (id: string) => Promise<void>;
  setDaySlot: (mealPlanId: string, dayOfWeek: number, mealType: string, recipeId: string | null, freeText?: string | null) => Promise<void>;
  clearDaySlot: (mealPlanId: string, dayOfWeek: number, mealType: string) => Promise<void>;
  addMember: (mealPlanId: string, userId: string) => Promise<void>;
  generateShoppingList: (mealPlanId: string) => Promise<void>;
}

export function useMealPlan(): MealPlanState {
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getMealPlans()
      .then(setMealPlans)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const createMealPlan = async (plan: Omit<MealPlan, "id" | "creator_id" | "updated_at">) => {
    const created = await apiCreateMealPlan(plan);
    load();
    return created;
  };

  const updateMealPlan = async (id: string, updates: Partial<Omit<MealPlan, "id" | "creator_id" | "updated_at">>) => {
    await apiUpdateMealPlan(id, updates);
    load();
  };

  const deleteMealPlan = async (id: string) => {
    await apiDeleteMealPlan(id);
    load();
  };

  const setDaySlot = async (
    mealPlanId: string,
    dayOfWeek: number,
    mealType: string,
    recipeId: string | null,
    freeText: string | null = null
  ) => {
    await upsertMealPlanDay({ meal_plan_id: mealPlanId, day_of_week: dayOfWeek, meal_type: mealType, recipe_id: recipeId, free_text: freeText });
  };

  const clearDaySlot = async (mealPlanId: string, dayOfWeek: number, mealType: string) => {
    await deleteMealPlanDay(mealPlanId, dayOfWeek, mealType);
  };

  const addMember = async (mealPlanId: string, userId: string) => {
    await addMealPlanMember(mealPlanId, userId);
  };

  const generateShoppingList = async (mealPlanId: string) => {
    const days = await getMealPlanDays(mealPlanId);
    const recipeIds = [...new Set(days.map((d) => d.recipe_id).filter((id): id is string => id !== null))];
    const ingredientArrays = await Promise.all(recipeIds.map((id) => getRecipeIngredients(id)));
    const allIngredients = ingredientArrays.flat();
    const aggregated = aggregateIngredients(allIngredients);
    await upsertShoppingListItems(
      mealPlanId,
      aggregated.map((a) => ({ ingredient_name: a.name, quantity: a.quantity || null, unit: a.unit }))
    );
  };

  return { mealPlans, loading, error, createMealPlan, updateMealPlan, deleteMealPlan, setDaySlot, clearDaySlot, addMember, generateShoppingList };
}
