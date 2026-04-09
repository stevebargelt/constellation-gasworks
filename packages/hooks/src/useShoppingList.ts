import { useCallback, useEffect, useRef, useState } from "react";
import type { MealPlanDay, ShoppingListItem } from "@constellation/types";
import {
  getShoppingListItems,
  getRecipeIngredientsForRecipes,
  toggleShoppingListItem,
  upsertShoppingListItems,
  supabase,
} from "@constellation/api";
import { aggregateIngredients } from "@constellation/utils";

interface ShoppingListState {
  items: ShoppingListItem[];
  loading: boolean;
  error: Error | null;
  generating: boolean;
  toggleChecked: (id: string, isChecked: boolean) => Promise<void>;
  generateList: (mealPlanDays: MealPlanDay[]) => Promise<void>;
}

export function useShoppingList(mealPlanId: string): ShoppingListState {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [generating, setGenerating] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getShoppingListItems(mealPlanId)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [mealPlanId]);

  useEffect(() => {
    load();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      const channel = supabase
        .channel(`shared:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "shopping_list_items",
            filter: `meal_plan_id=eq.${mealPlanId}`,
          },
          (payload) => {
            if (payload.eventType === "UPDATE") {
              const updated = payload.new as ShoppingListItem;
              setItems((prev) =>
                prev.map((item) => (item.id === updated.id ? updated : item))
              );
            } else if (payload.eventType === "INSERT") {
              setItems((prev) => {
                if (prev.some((i) => i.id === (payload.new as ShoppingListItem).id)) return prev;
                return [...prev, payload.new as ShoppingListItem];
              });
            } else if (payload.eventType === "DELETE") {
              const deleted = payload.old as { id: string };
              setItems((prev) => prev.filter((item) => item.id !== deleted.id));
            }
          }
        )
        .subscribe();

      channelRef.current = channel;
    });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [mealPlanId, load]);

  const toggleChecked = async (id: string, isChecked: boolean) => {
    const updated = await toggleShoppingListItem(id, isChecked);
    if (updated) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? updated : item))
      );
    }
  };

  const generateList = useCallback(async (mealPlanDays: MealPlanDay[]) => {
    setGenerating(true);
    try {
      const recipeIds = [
        ...new Set(
          mealPlanDays.map((d) => d.recipe_id).filter((id): id is string => id !== null)
        ),
      ];
      const ingredients = await getRecipeIngredientsForRecipes(recipeIds);
      const aggregated = aggregateIngredients(ingredients);
      await upsertShoppingListItems(
        aggregated.map((agg) => ({
          meal_plan_id: mealPlanId,
          ingredient_name: agg.name,
          quantity: agg.quantity || null,
          unit: agg.unit,
        }))
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setGenerating(false);
    }
  }, [mealPlanId, load]);

  return { items, loading, error, generating, toggleChecked, generateList };
}
