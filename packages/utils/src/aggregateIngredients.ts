import type { RecipeIngredient } from "@constellation/types";

export interface AggregatedIngredient {
  name: string;
  quantity: string;
  unit: string | null;
}

/**
 * Aggregates recipe ingredients for a shopping list.
 * Combines duplicate ingredient names with the same unit by summing numeric quantities.
 * Non-numeric quantities are concatenated with " + ".
 */
export function aggregateIngredients(
  ingredients: RecipeIngredient[]
): AggregatedIngredient[] {
  const byKey = new Map<string, AggregatedIngredient>();

  for (const ing of ingredients) {
    const key = `${ing.name.toLowerCase().trim()}|${ing.unit?.toLowerCase().trim() ?? ""}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        name: ing.name,
        quantity: ing.quantity ?? "",
        unit: ing.unit ?? null,
      });
      continue;
    }

    const numA = parseFloat(existing.quantity);
    const numB = parseFloat(ing.quantity ?? "0");
    if (!isNaN(numA) && !isNaN(numB)) {
      existing.quantity = String(numA + numB);
    } else {
      existing.quantity = [existing.quantity, ing.quantity ?? ""].filter(Boolean).join(" + ");
    }
  }

  return [...byKey.values()];
}
