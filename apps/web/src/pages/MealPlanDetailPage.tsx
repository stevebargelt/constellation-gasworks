import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth, useMealPlan, useRecipes, useRelationships } from "@constellation/hooks";
import { getUsersByIds } from "@constellation/api";
import type { MealPlanDay, Recipe, User } from "@constellation/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = typeof MEAL_TYPES[number];

function partnerIdOf(rel: { user_a_id: string; user_b_id: string }, myId: string): string {
  return rel.user_a_id === myId ? rel.user_b_id : rel.user_a_id;
}

// ---------- SlotCell ----------

interface SlotCellProps {
  slot: MealPlanDay | undefined;
  mealPlanId: string;
  dayOfWeek: number;
  mealType: MealType;
  recipes: Recipe[];
  onUpsert: (day: Omit<MealPlanDay, "id">) => Promise<void>;
  onRemove: (dayOfWeek: number, mealType: string) => Promise<void>;
}

function SlotCell({ slot, mealPlanId, dayOfWeek, mealType, recipes, onUpsert, onRemove }: SlotCellProps) {
  const [editing, setEditing] = useState(false);
  const [freeText, setFreeText] = useState(slot?.free_text ?? "");
  const [selectedRecipeId, setSelectedRecipeId] = useState(slot?.recipe_id ?? "");
  const [mode, setMode] = useState<"recipe" | "text">(slot?.recipe_id ? "recipe" : "text");
  const [saving, setSaving] = useState(false);

  const recipeLabel = useMemo(() => {
    if (!slot?.recipe_id) return null;
    return recipes.find((r) => r.id === slot.recipe_id)?.title ?? "Recipe";
  }, [slot?.recipe_id, recipes]);

  const handleSave = async () => {
    setSaving(true);
    await onUpsert({
      meal_plan_id: mealPlanId,
      day_of_week: dayOfWeek,
      meal_type: mealType,
      recipe_id: mode === "recipe" && selectedRecipeId ? selectedRecipeId : null,
      free_text: mode === "text" && freeText.trim() ? freeText.trim() : null,
    });
    setSaving(false);
    setEditing(false);
  };

  const handleRemove = async () => {
    if (!slot) return;
    await onRemove(dayOfWeek, mealType);
    setEditing(false);
    setFreeText("");
    setSelectedRecipeId("");
  };

  if (!editing) {
    return (
      <div
        className="min-h-[3rem] p-1.5 rounded cursor-pointer hover:bg-gray-700 transition-colors group"
        onClick={() => {
          setFreeText(slot?.free_text ?? "");
          setSelectedRecipeId(slot?.recipe_id ?? "");
          setMode(slot?.recipe_id ? "recipe" : "text");
          setEditing(true);
        }}
      >
        {slot ? (
          <span className="text-xs text-gray-200 leading-snug">
            {recipeLabel ?? slot.free_text}
          </span>
        ) : (
          <span className="text-xs text-gray-600 group-hover:text-gray-500">+</span>
        )}
      </div>
    );
  }

  return (
    <div className="p-1.5 bg-gray-700 rounded space-y-1.5">
      <div className="flex gap-1 text-xs">
        <button
          onClick={() => setMode("recipe")}
          className={`px-2 py-0.5 rounded ${mode === "recipe" ? "bg-indigo-600 text-white" : "bg-gray-600 text-gray-300"}`}
        >
          Recipe
        </button>
        <button
          onClick={() => setMode("text")}
          className={`px-2 py-0.5 rounded ${mode === "text" ? "bg-indigo-600 text-white" : "bg-gray-600 text-gray-300"}`}
        >
          Free text
        </button>
      </div>

      {mode === "recipe" ? (
        <select
          value={selectedRecipeId}
          onChange={(e) => setSelectedRecipeId(e.target.value)}
          className="w-full bg-gray-600 text-white text-xs rounded px-2 py-1 focus:outline-none"
        >
          <option value="">— select recipe —</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>{r.title}</option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="e.g. Leftovers, takeout…"
          className="w-full bg-gray-600 text-white text-xs rounded px-2 py-1 focus:outline-none"
          autoFocus
        />
      )}

      <div className="flex gap-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-2 py-0.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded text-white"
        >
          {saving ? "…" : "Save"}
        </button>
        {slot && (
          <button
            onClick={handleRemove}
            className="px-2 py-0.5 text-xs bg-red-800 hover:bg-red-700 rounded text-white"
          >
            Clear
          </button>
        )}
        <button
          onClick={() => setEditing(false)}
          className="px-2 py-0.5 text-xs bg-gray-600 hover:bg-gray-500 rounded text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------- MealPlanDetailPage ----------

export default function MealPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { relationships } = useRelationships();
  const { plan, days, members, loading, upsertDay, removeDay, removePlan, addMember, removeMember } =
    useMealPlan(id!);
  const { recipes } = useRecipes();

  const [partnerMap, setPartnerMap] = useState<Map<string, User>>(new Map());

  const partners = useMemo(() => {
    if (!user || !relationships) return [];
    return relationships
      .filter((r) => r.status === "active")
      .map((r) => ({ id: partnerIdOf(r, user.id) }));
  }, [user, relationships]);

  useEffect(() => {
    const allIds = [
      ...partners.map((p) => p.id),
      ...members.map((m) => m.user_id),
    ];
    const unique = [...new Set(allIds)];
    if (unique.length === 0) return;
    getUsersByIds(unique).then((users) => {
      const m = new Map<string, User>();
      users.forEach((u) => m.set(u.id, u));
      setPartnerMap(m);
    });
  }, [partners, members]);

  const slotMap = useMemo(() => {
    const m = new Map<string, MealPlanDay>();
    days.forEach((d) => m.set(`${d.day_of_week}:${d.meal_type}`, d));
    return m;
  }, [days]);

  const existingMemberIds = useMemo(
    () => new Set(members.map((m) => m.user_id)),
    [members]
  );

  const addablePartners = useMemo(
    () => partners.filter((p) => !existingMemberIds.has(p.id)),
    [partners, existingMemberIds]
  );

  const handleDelete = async () => {
    if (!confirm("Delete this meal plan?")) return;
    await removePlan();
    navigate("/meal-plans");
  };

  if (loading) return <div className="p-6 text-gray-400">Loading…</div>;
  if (!plan) return <div className="p-6 text-gray-400">Plan not found.</div>;

  const isCreator = plan.creator_id === user?.id;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/meal-plans" className="text-xs text-gray-500 hover:text-gray-300">
            ← Meal Plans
          </Link>
          <h1 className="text-xl font-bold text-white mt-1">{plan.title}</h1>
          <p className="text-xs text-gray-400">
            Week of{" "}
            {new Date(plan.week_start_date + "T00:00:00").toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        {isCreator && (
          <button
            onClick={handleDelete}
            className="text-xs text-red-500 hover:text-red-400"
          >
            Delete plan
          </button>
        )}
      </div>

      {/* Weekly grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="w-20 text-left text-gray-500 font-normal pb-2 pr-2">Meal</th>
              {DAYS.map((day) => (
                <th key={day} className="text-center text-gray-400 font-medium pb-2 px-1 min-w-[100px]">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEAL_TYPES.map((mealType) => (
              <tr key={mealType} className="border-t border-gray-800">
                <td className="py-1 pr-2 text-gray-500 align-top capitalize">{mealType}</td>
                {DAYS.map((_, idx) => {
                  const dayOfWeek = idx + 1; // 1=Mon … 7=Sun
                  const slot = slotMap.get(`${dayOfWeek}:${mealType}`);
                  return (
                    <td key={dayOfWeek} className="py-1 px-1 align-top">
                      <SlotCell
                        slot={slot}
                        mealPlanId={plan.id}
                        dayOfWeek={dayOfWeek}
                        mealType={mealType}
                        recipes={recipes}
                        onUpsert={upsertDay}
                        onRemove={removeDay}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Members */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-300">Members</h2>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const u = partnerMap.get(m.user_id);
            const name = u?.display_name ?? m.user_id.slice(0, 8);
            const canRemove = isCreator && m.user_id !== user?.id;
            return (
              <span
                key={m.user_id}
                className="flex items-center gap-1 bg-gray-700 rounded-full px-3 py-1 text-xs text-gray-200"
              >
                {name}
                {canRemove && (
                  <button
                    onClick={() => removeMember(m.user_id)}
                    className="text-gray-400 hover:text-red-400 ml-1"
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>

        {isCreator && addablePartners.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {addablePartners.map((p) => {
              const u = partnerMap.get(p.id);
              const name = u?.display_name ?? p.id.slice(0, 8);
              return (
                <button
                  key={p.id}
                  onClick={() => addMember(p.id)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 bg-gray-800 hover:bg-gray-700 rounded-full px-3 py-1"
                >
                  + {name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
