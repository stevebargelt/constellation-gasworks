import { useCallback, useEffect, useState } from "react";
import type { MealPlan, MealPlanDay, MealPlanMember } from "@constellation/types";
import {
  getMealPlan,
  getMealPlanDays,
  getMealPlanMembers,
  upsertMealPlanDay,
  updateMealPlan,
  deleteMealPlan,
  deleteMealPlanDay,
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
  removeDay: (dayOfWeek: number, mealType: string) => Promise<void>;
  updatePlan: (updates: Partial<Omit<MealPlan, "id" | "creator_id" | "updated_at">>) => Promise<void>;
  removePlan: () => Promise<void>;
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

  const removeDay = async (dayOfWeek: number, mealType: string) => {
    await deleteMealPlanDay(mealPlanId, dayOfWeek, mealType);
    setDays((prev) =>
      prev.filter((d) => !(d.day_of_week === dayOfWeek && d.meal_type === mealType))
    );
  };

  const updatePlanFn = async (
    updates: Partial<Omit<MealPlan, "id" | "creator_id" | "updated_at">>
  ) => {
    const updated = await updateMealPlan(mealPlanId, updates);
    if (updated) setPlan(updated);
  };

  const removePlan = async () => {
    await deleteMealPlan(mealPlanId);
  };

  const addMember = async (userId: string) => {
    const member = await addMealPlanMember(mealPlanId, userId);
    if (member) setMembers((prev) => [...prev, member]);
  };

  const removeMember = async (userId: string) => {
    await removeMealPlanMember(mealPlanId, userId);
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
  };

  return {
    plan,
    days,
    members,
    loading,
    error,
    upsertDay,
    removeDay,
    updatePlan: updatePlanFn,
    removePlan,
    addMember,
    removeMember,
  };
}
