import { useEffect, useState } from "react";
import type { MealPlan, MealPlanDay } from "@constellation/types";
import { getMealPlan, getMealPlanDays, upsertMealPlanDay } from "@constellation/api";

interface MealPlanState {
  plan: MealPlan | null;
  days: MealPlanDay[];
  loading: boolean;
  error: Error | null;
  upsertDay: (day: Omit<MealPlanDay, "id">) => Promise<void>;
}

export function useMealPlan(mealPlanId: string): MealPlanState {
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [days, setDays] = useState<MealPlanDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getMealPlan(mealPlanId), getMealPlanDays(mealPlanId)])
      .then(([planData, daysData]) => {
        setPlan(planData);
        setDays(daysData);
      })
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [mealPlanId]);

  const upsertDay = async (day: Omit<MealPlanDay, "id">) => {
    const updated = await upsertMealPlanDay(day);
    if (updated) {
      setDays((prev) => {
        const idx = prev.findIndex(
          (d) => d.meal_plan_id === day.meal_plan_id &&
            d.day_of_week === day.day_of_week &&
            d.meal_type === day.meal_type
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [...prev, updated];
      });
    }
  };

  return { plan, days, loading, error, upsertDay };
}
