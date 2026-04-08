import { useEffect, useState } from "react";
import type { ShoppingListItem } from "@constellation/types";
import { getShoppingListItems, toggleShoppingListItem } from "@constellation/api";

interface ShoppingListState {
  items: ShoppingListItem[];
  loading: boolean;
  error: Error | null;
  toggle: (id: string, isChecked: boolean) => Promise<void>;
}

export function useShoppingList(mealPlanId: string): ShoppingListState {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    getShoppingListItems(mealPlanId)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [mealPlanId]);

  const toggle = async (id: string, isChecked: boolean) => {
    const updated = await toggleShoppingListItem(id, isChecked);
    if (updated) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? updated : item))
      );
    }
  };

  return { items, loading, error, toggle };
}
