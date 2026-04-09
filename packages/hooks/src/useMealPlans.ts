import { useCallback, useEffect, useState } from "react";
import type { MealPlan } from "@constellation/types";
import { getMealPlans, createMealPlan, deleteMealPlan } from "@constellation/api";

interface MealPlansState {
  mealPlans: MealPlan[];
  loading: boolean;
  error: Error | null;
  create: (plan: Omit<MealPlan, "id" | "creator_id" | "updated_at">) => Promise<MealPlan | null>;
  remove: (id: string) => Promise<void>;
}

export function useMealPlans(): MealPlansState {
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

  const create = async (
    plan: Omit<MealPlan, "id" | "creator_id" | "updated_at">
  ): Promise<MealPlan | null> => {
    const result = await createMealPlan(plan);
    load();
    return result;
  };

  const remove = async (id: string): Promise<void> => {
    await deleteMealPlan(id);
    setMealPlans((prev) => prev.filter((p) => p.id !== id));
  };

  return { mealPlans, loading, error, create, remove };
}
