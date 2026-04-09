import { useEffect, useRef, useState } from "react";
import type { ShoppingListItem } from "@constellation/types";
import { getShoppingListItems, toggleShoppingListItem, supabase } from "@constellation/api";

interface ShoppingListState {
  items: ShoppingListItem[];
  loading: boolean;
  error: Error | null;
  toggleChecked: (id: string, isChecked: boolean) => Promise<void>;
}

export function useShoppingList(mealPlanId: string): ShoppingListState {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = () => {
    setLoading(true);
    getShoppingListItems(mealPlanId)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  };

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
              setItems((prev) => [...prev, payload.new as ShoppingListItem]);
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
  }, [mealPlanId]);

  const toggleChecked = async (id: string, isChecked: boolean) => {
    const updated = await toggleShoppingListItem(id, isChecked);
    if (updated) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? updated : item))
      );
    }
  };

  return { items, loading, error, toggleChecked };
}
