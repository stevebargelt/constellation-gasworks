import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMealPlan, useShoppingList } from "@constellation/hooks";
import { getUsersByIds } from "@constellation/api";
import type { User } from "@constellation/types";

export default function ShoppingListPage() {
  const { id } = useParams<{ id: string }>();
  const mealPlanId = id!;

  const { plan, days, loading: planLoading } = useMealPlan(mealPlanId);
  const { items, loading, generating, toggleChecked, generateList } =
    useShoppingList(mealPlanId);

  const [userMap, setUserMap] = useState<Map<string, User>>(new Map());

  useEffect(() => {
    const checkerIds = [
      ...new Set(items.map((i) => i.checked_by_id).filter(Boolean) as string[]),
    ];
    if (!checkerIds.length) return;
    getUsersByIds(checkerIds).then((users) =>
      setUserMap(new Map(users.map((u) => [u.id, u])))
    );
  }, [items]);

  const unchecked = items.filter((i) => !i.is_checked);
  const checked = items.filter((i) => i.is_checked);

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* header */}
      <div className="flex items-center gap-3">
        <Link
          to={`/meal-plans/${mealPlanId}`}
          className="text-sm text-gray-400 hover:text-white"
        >
          ← {planLoading ? "Plan" : plan?.title ?? "Plan"}
        </Link>
        <h1 className="text-xl font-semibold text-white flex-1">
          Shopping List
        </h1>
        <button
          onClick={() => generateList(days)}
          disabled={generating || planLoading}
          className="text-sm px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md"
        >
          {generating ? "Generating…" : items.length ? "Regenerate" : "Generate"}
        </button>
      </div>

      {loading && (
        <p className="text-gray-400 text-sm">Loading…</p>
      )}

      {!loading && items.length === 0 && (
        <p className="text-gray-500 text-sm">
          No items yet. Click Generate to build the list from your meal plan recipes.
        </p>
      )}

      {/* unchecked items */}
      {unchecked.length > 0 && (
        <ul className="space-y-1">
          {unchecked.map((item) => (
            <li key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800">
              <input
                type="checkbox"
                checked={false}
                onChange={() => toggleChecked(item.id, true)}
                className="w-4 h-4 accent-indigo-500 cursor-pointer"
              />
              <span className="flex-1 text-sm text-gray-100">
                {item.ingredient_name}
              </span>
              {(item.quantity || item.unit) && (
                <span className="text-xs text-gray-400">
                  {[item.quantity, item.unit].filter(Boolean).join(" ")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* checked items */}
      {checked.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Checked ({checked.length})
          </p>
          <ul className="space-y-1">
            {checked.map((item) => {
              const checker = item.checked_by_id
                ? userMap.get(item.checked_by_id)
                : null;
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 opacity-60"
                >
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={() => toggleChecked(item.id, false)}
                    className="w-4 h-4 accent-indigo-500 cursor-pointer"
                  />
                  <span className="flex-1 text-sm text-gray-400 line-through">
                    {item.ingredient_name}
                  </span>
                  {(item.quantity || item.unit) && (
                    <span className="text-xs text-gray-500">
                      {[item.quantity, item.unit].filter(Boolean).join(" ")}
                    </span>
                  )}
                  {checker && (
                    <span className="text-xs text-gray-500">
                      {checker.display_name}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
