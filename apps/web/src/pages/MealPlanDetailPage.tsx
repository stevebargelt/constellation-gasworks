import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth, useMealPlan, useRelationships } from "@constellation/hooks";
import { getRecipes, getUsersByIds } from "@constellation/api";
import type { MealPlanDay, Recipe, User } from "@constellation/types";

// ---------- constants ----------

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = typeof MEAL_TYPES[number];

const DAYS: { label: string; value: number }[] = [
  { label: "Mon", value: 0 },
  { label: "Tue", value: 1 },
  { label: "Wed", value: 2 },
  { label: "Thu", value: 3 },
  { label: "Fri", value: 4 },
  { label: "Sat", value: 5 },
  { label: "Sun", value: 6 },
];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- SlotCell ----------

interface SlotCellProps {
  slot: MealPlanDay | undefined;
  recipes: Recipe[];
  mealPlanId: string;
  dayOfWeek: number;
  mealType: MealType;
  onUpsert: (day: Omit<MealPlanDay, "id">) => Promise<void>;
  onClear: (dayOfWeek: number, mealType: string) => Promise<void>;
}

function SlotCell({ slot, recipes, mealPlanId, dayOfWeek, mealType, onUpsert, onClear }: SlotCellProps) {
  const [editing, setEditing] = useState(false);
  const [freeText, setFreeText] = useState(slot?.free_text ?? "");
  const [selectedRecipeId, setSelectedRecipeId] = useState(slot?.recipe_id ?? "");
  const [saving, setSaving] = useState(false);

  // sync state when slot changes (Realtime reconcile)
  useEffect(() => {
    setFreeText(slot?.free_text ?? "");
    setSelectedRecipeId(slot?.recipe_id ?? "");
  }, [slot?.free_text, slot?.recipe_id]);

  const displayName = slot?.recipe_id
    ? (recipes.find((r) => r.id === slot.recipe_id)?.title ?? "Recipe")
    : slot?.free_text
    ? slot.free_text
    : null;

  async function handleSave() {
    setSaving(true);
    if (selectedRecipeId) {
      await onUpsert({
        meal_plan_id: mealPlanId,
        day_of_week: dayOfWeek,
        meal_type: mealType,
        recipe_id: selectedRecipeId,
        free_text: null,
      });
    } else if (freeText.trim()) {
      await onUpsert({
        meal_plan_id: mealPlanId,
        day_of_week: dayOfWeek,
        meal_type: mealType,
        recipe_id: null,
        free_text: freeText.trim(),
      });
    }
    setSaving(false);
    setEditing(false);
  }

  async function handleClear() {
    setSaving(true);
    await onClear(dayOfWeek, mealType);
    setSelectedRecipeId("");
    setFreeText("");
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="p-1 space-y-1 min-h-[60px]">
        <select
          className="w-full bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs"
          value={selectedRecipeId}
          onChange={(e) => { setSelectedRecipeId(e.target.value); if (e.target.value) setFreeText(""); }}
        >
          <option value="">— recipe —</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>{r.title}</option>
          ))}
        </select>
        <input
          className="w-full bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs placeholder-gray-500"
          placeholder="or free text…"
          value={freeText}
          onChange={(e) => { setFreeText(e.target.value); if (e.target.value) setSelectedRecipeId(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
        />
        <div className="flex gap-1">
          <button
            onClick={handleSave}
            disabled={saving || (!selectedRecipeId && !freeText.trim())}
            className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
          >
            Save
          </button>
          {slot && (
            <button onClick={handleClear} disabled={saving} className="text-xs text-red-400 hover:text-red-300">
              Clear
            </button>
          )}
          <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-300">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="w-full h-full min-h-[60px] p-1 text-left text-xs hover:bg-gray-700 rounded transition-colors"
    >
      {displayName ? (
        <span className="text-gray-200 line-clamp-2">{displayName}</span>
      ) : (
        <span className="text-gray-600">+</span>
      )}
    </button>
  );
}

// ---------- MembersPanel ----------

interface MembersPanelProps {
  members: { user_id: string }[];
  currentUserId: string;
  creatorId: string;
  partners: User[];
  onAdd: (userId: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
}

function MembersPanel({ members, currentUserId, creatorId, partners, onAdd, onRemove }: MembersPanelProps) {
  const [userMap, setUserMap] = useState<Map<string, User>>(new Map());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ids = members.map((m) => m.user_id);
    if (!ids.length) return;
    getUsersByIds(ids).then((users) =>
      setUserMap(new Map(users.map((u) => [u.id, u])))
    );
  }, [members]);

  const existingIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const available = partners.filter((p) => !existingIds.has(p.id));
  const isCreator = currentUserId === creatorId;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {members.map((m) => {
          const u = userMap.get(m.user_id);
          const name = u?.display_name ?? m.user_id.slice(0, 8);
          return (
            <span key={m.user_id} className="flex items-center gap-1 bg-gray-700 rounded-full px-3 py-1 text-xs">
              {name}
              {isCreator && m.user_id !== creatorId && (
                <button
                  onClick={() => onRemove(m.user_id)}
                  className="text-gray-400 hover:text-red-400 ml-1"
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
        {isCreator && available.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              + Invite partner
            </button>
            {open && (
              <div className="absolute top-5 left-0 z-20 bg-gray-800 border border-gray-700 rounded shadow-lg min-w-40">
                {available.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onAdd(p.id); setOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                  >
                    {p.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- MealPlanDetailPage ----------

export default function MealPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { relationships } = useRelationships();
  const navigate = useNavigate();

  const { plan, days, members, loading, error, upsertDay, clearDay, deletePlan, addMember, removeMember } =
    useMealPlan(id!);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [partners, setPartners] = useState<User[]>([]);

  useEffect(() => {
    getRecipes().then(setRecipes);
  }, []);

  useEffect(() => {
    if (!user) return;
    const activeIds = relationships
      .filter((r) => r.status === "active")
      .map((r) => (r.user_a_id === user.id ? r.user_b_id : r.user_a_id));
    if (!activeIds.length) { setPartners([]); return; }
    getUsersByIds(activeIds).then(setPartners);
  }, [relationships, user]);

  function getSlot(dayOfWeek: number, mealType: string): MealPlanDay | undefined {
    return days.find((d) => d.day_of_week === dayOfWeek && d.meal_type === mealType);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${plan?.title}"? This cannot be undone.`)) return;
    await deletePlan();
    navigate("/meal-plans");
  }

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (error) return <div className="p-8 text-red-400">{error.message}</div>;
  if (!plan) return <div className="p-8 text-gray-400">Plan not found.</div>;

  const isCreator = plan.creator_id === user?.id;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/meal-plans" className="text-sm text-gray-400 hover:text-white">← Plans</Link>
          <div>
            <h1 className="text-xl font-bold">{plan.title}</h1>
            <p className="text-xs text-gray-400 mt-0.5">Week of {plan.week_start_date}</p>
          </div>
        </div>
        {isCreator && (
          <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-300 shrink-0">
            Delete plan
          </button>
        )}
      </div>

      {/* members */}
      <div className="bg-gray-800 rounded-lg p-3 space-y-1">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Members</p>
        <MembersPanel
          members={members}
          currentUserId={user?.id ?? ""}
          creatorId={plan.creator_id}
          partners={partners}
          onAdd={addMember}
          onRemove={removeMember}
        />
      </div>

      {/* weekly grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-24 p-2 text-left text-xs text-gray-400 font-medium"></th>
              {DAYS.map((d) => (
                <th key={d.value} className="p-2 text-xs text-gray-400 font-medium text-center min-w-[100px]">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEAL_TYPES.map((mealType) => (
              <tr key={mealType} className="border-t border-gray-800">
                <td className="p-2 text-xs text-gray-400 font-medium align-top pt-3">
                  {capitalize(mealType)}
                </td>
                {DAYS.map((d) => (
                  <td key={d.value} className="border border-gray-800 align-top">
                    <SlotCell
                      slot={getSlot(d.value, mealType)}
                      recipes={recipes}
                      mealPlanId={plan.id}
                      dayOfWeek={d.value}
                      mealType={mealType}
                      onUpsert={upsertDay}
                      onClear={clearDay}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
