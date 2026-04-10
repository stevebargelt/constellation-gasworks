import { useCallback, useEffect, useState } from "react";
import type { MealPlan, MealPlanDay, MealPlanMember } from "@constellation/types";
import {
  getMealPlan,
  getMealPlanDays,
  getMealPlanMembers,
  upsertMealPlanDay,
  deleteMealPlanDay,
  deleteMealPlan,
  addMealPlanMember,
  removeMealPlanMember,
} from "@constellation/api";

interface MealPlanState {
  plan: MealPlan | null;
  days: MealPlanDay[];
  members: MealPlanMember[];
  loading: boolean;
  error: Error | null;
  upsertDay: (day: Omit<MealPlanDay, "id">) => Promise<void>;
  clearDay: (dayOfWeek: number, mealType: string) => Promise<void>;
  deletePlan: () => Promise<void>;
  addMember: (userId: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
}

export function useMealPlan(mealPlanId: string): MealPlanState {
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [days, setDays] = useState<MealPlanDay[]>([]);
  const [members, setMembers] = useState<MealPlanMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getMealPlan(mealPlanId), getMealPlanDays(mealPlanId), getMealPlanMembers(mealPlanId)])
      .then(([planData, daysData, membersData]) => {
        setPlan(planData);
        setDays(daysData);
        setMembers(membersData);
      })
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [mealPlanId]);

  useEffect(() => { load(); }, [load]);

  const upsertDay = async (day: Omit<MealPlanDay, "id">) => {
    const updated = await upsertMealPlanDay(day);
    if (updated) {
      setDays((prev) => {
        const idx = prev.findIndex(
          (d) =>
            d.meal_plan_id === day.meal_plan_id &&
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

  const clearDay = async (dayOfWeek: number, mealType: string) => {
    await deleteMealPlanDay(mealPlanId, dayOfWeek, mealType);
    setDays((prev) =>
      prev.filter(
        (d) => !(d.day_of_week === dayOfWeek && d.meal_type === mealType)
      )
    );
  };

  const deletePlan = async () => {
    await deleteMealPlan(mealPlanId);
  };

  const addMember = async (userId: string) => {
    await addMealPlanMember(mealPlanId, userId);
    setMembers((prev) => {
      if (prev.some((m) => m.user_id === userId)) return prev;
      // Optimistic add — reload will fill in server-assigned id
      return [...prev, { id: "", meal_plan_id: mealPlanId, user_id: userId, created_at: "" }];
    });
    load();
  };

  const removeMember = async (userId: string) => {
    await removeMealPlanMember(mealPlanId, userId);
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
  };

  return { plan, days, members, loading, error, upsertDay, clearDay, deletePlan, addMember, removeMember };
}
