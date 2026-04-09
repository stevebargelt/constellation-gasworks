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

export async function updateMealPlan(
  id: string,
  updates: Partial<Omit<MealPlan, "id" | "creator_id" | "updated_at">>
): Promise<MealPlan | null> {
  const { data } = await supabase
    .from("meal_plans")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  return data;
}

export async function deleteMealPlan(id: string): Promise<void> {
  await supabase.from("meal_plans").delete().eq("id", id);
}

export async function deleteMealPlanDay(
  mealPlanId: string,
  dayOfWeek: number,
  mealType: string
): Promise<void> {
  await supabase
    .from("meal_plan_days")
    .delete()
    .eq("meal_plan_id", mealPlanId)
    .eq("day_of_week", dayOfWeek)
    .eq("meal_type", mealType);
}

export async function upsertShoppingListItems(
  mealPlanId: string,
  items: Array<{ ingredient_name: string; quantity: string | null; unit: string | null }>
): Promise<ShoppingListItem[]> {
  const rows = items.map((item) => ({
    meal_plan_id: mealPlanId,
    ingredient_name: item.ingredient_name,
    quantity: item.quantity,
    unit: item.unit,
    is_checked: false,
    checked_by_id: null,
  }));
  const { data } = await supabase
    .from("shopping_list_items")
    .upsert(rows, { onConflict: "meal_plan_id,ingredient_name,unit" })
    .select();
  return data ?? [];
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

export async function addMealPlanMember(
  mealPlanId: string,
  userId: string
): Promise<MealPlanMember | null> {
  const { data } = await supabase
    .from("meal_plan_members")
    .insert({ meal_plan_id: mealPlanId, user_id: userId })
    .select()
    .single();
  return data;
}
