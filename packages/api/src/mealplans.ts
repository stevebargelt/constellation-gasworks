import type { MealPlan, MealPlanDay, MealPlanMember, ShoppingListItem } from "@constellation/types";
import { supabase } from "./client";

export async function getMealPlans(): Promise<MealPlan[]> {
  const { data } = await supabase.from("meal_plans").select("*");
  return data ?? [];
}

export async function getMealPlan(id: string): Promise<MealPlan | null> {
  const { data } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export async function createMealPlan(
  plan: Omit<MealPlan, "id" | "creator_id" | "updated_at">
): Promise<MealPlan | null> {
  const { data } = await supabase
    .from("meal_plans")
    .insert(plan)
    .select()
    .single();
  return data;
}

export async function getMealPlanDays(
  mealPlanId: string
): Promise<MealPlanDay[]> {
  const { data } = await supabase
    .from("meal_plan_days")
    .select("*")
    .eq("meal_plan_id", mealPlanId);
  return data ?? [];
}

export async function upsertMealPlanDay(
  day: Omit<MealPlanDay, "id">
): Promise<MealPlanDay | null> {
  const { data } = await supabase
    .from("meal_plan_days")
    .upsert(day, { onConflict: "meal_plan_id,day_of_week,meal_type" })
    .select()
    .single();
  return data;
}

export async function getShoppingListItems(
  mealPlanId: string
): Promise<ShoppingListItem[]> {
  const { data } = await supabase
    .from("shopping_list_items")
    .select("*")
    .eq("meal_plan_id", mealPlanId);
  return data ?? [];
}

export async function toggleShoppingListItem(
  id: string,
  isChecked: boolean
): Promise<ShoppingListItem | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("shopping_list_items")
    .update({ is_checked: isChecked, checked_by_id: isChecked ? user.id : null })
    .eq("id", id)
    .select()
    .single();
  return data;
}

export async function getMealPlanMembers(
  mealPlanId: string
): Promise<MealPlanMember[]> {
  const { data } = await supabase
    .from("meal_plan_members")
    .select("*")
    .eq("meal_plan_id", mealPlanId);
  return data ?? [];
}
