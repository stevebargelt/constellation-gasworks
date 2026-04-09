import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMealPlan, useLivingSpaces } from "@constellation/hooks";
import { getLivingSpaceMembersWithProfiles, addMealPlanMember } from "@constellation/api";
import type { MealPlan, LivingSpace } from "@constellation/types";
import type { LivingSpaceMemberWithProfile } from "@constellation/api";

// ---------- helpers ----------

function formatWeekStart(date: string): string {
  try {
    return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return date;
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------- SpaceMemberSuggestions ----------

interface SpaceMemberSuggestionsProps {
  spaceId: string;
  mealPlanId: string | null;
  currentUserId: string;
}

function SpaceMemberSuggestions({ spaceId, mealPlanId, currentUserId }: SpaceMemberSuggestionsProps) {
  const [members, setMembers] = useState<LivingSpaceMemberWithProfile[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    getLivingSpaceMembersWithProfiles(spaceId).then(setMembers);
  }, [spaceId]);

  const others = members.filter((m) => m.user_id !== currentUserId);
  if (others.length === 0) return null;

  async function handleAdd(userId: string) {
    if (!mealPlanId) return;
    await addMealPlanMember(mealPlanId, userId);
    setAdded((prev) => new Set([...prev, userId]));
  }

  return (
    <div className="mt-2">
      <p className="text-xs text-gray-400 mb-1">Space members — add as invitees:</p>
      <div className="flex flex-wrap gap-2">
        {others.map((m) => (
          <div key={m.user_id} className="flex items-center gap-1 bg-gray-700 rounded-full px-3 py-1 text-xs">
            <span className="text-gray-200">{m.user.display_name}</span>
            {mealPlanId && !added.has(m.user_id) && (
              <button
                onClick={() => handleAdd(m.user_id)}
                className="ml-1 text-indigo-400 hover:text-indigo-300"
                title="Add as invitee"
              >
                +
              </button>
            )}
            {added.has(m.user_id) && (
              <span className="ml-1 text-green-400">✓</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- MealPlanCard ----------

interface MealPlanCardProps {
  plan: MealPlan;
  currentUserId: string;
  spaceMap: Map<string, LivingSpace>;
  allSpaces: LivingSpace[];
  onUpdate: (id: string, updates: Partial<Omit<MealPlan, "id" | "creator_id" | "updated_at">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function MealPlanCard({ plan, currentUserId, spaceMap, allSpaces, onUpdate, onDelete }: MealPlanCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const [weekStart, setWeekStart] = useState(plan.week_start_date);
  const [spaceId, setSpaceId] = useState<string>(plan.living_space_id ?? "");
  const isCreator = currentUserId === plan.creator_id;
  const spaceName = plan.living_space_id ? spaceMap.get(plan.living_space_id)?.name : null;

  async function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) return;
    await onUpdate(plan.id, {
      title: trimmed,
      week_start_date: weekStart,
      living_space_id: spaceId || null,
    });
    setEditing(false);
  }

  function handleCancel() {
    setTitle(plan.title);
    setWeekStart(plan.week_start_date);
    setSpaceId(plan.living_space_id ?? "");
    setEditing(false);
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-2">
      {editing ? (
        <div className="space-y-2">
          <input
            className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white border border-gray-600 focus:outline-none focus:border-indigo-500"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Plan title"
            autoFocus
          />
          <input
            type="date"
            className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white border border-gray-600 focus:outline-none focus:border-indigo-500"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
          />
          <select
            className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white border border-gray-600 focus:outline-none focus:border-indigo-500"
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
          >
            <option value="">No living space</option>
            {allSpaces.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {spaceId && (
            <SpaceMemberSuggestions
              spaceId={spaceId}
              mealPlanId={plan.id}
              currentUserId={currentUserId}
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
            >
              Save
            </button>
            <button onClick={handleCancel} className="text-xs text-gray-400 hover:text-gray-300">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-white">{plan.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Week of {formatWeekStart(plan.week_start_date)}
            </p>
            {spaceName && (
              <p className="text-xs text-indigo-300 mt-0.5">📍 {spaceName}</p>
            )}
          </div>
          {isCreator && (
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-gray-400 hover:text-white"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(plan.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- MealPlansPage ----------

export default function MealPlansPage() {
  const { mealPlans, loading, error, createMealPlan, updateMealPlan, deleteMealPlan } = useMealPlan();
  const { livingSpaces } = useLivingSpaces();

  const [newTitle, setNewTitle] = useState("");
  const [newWeekStart, setNewWeekStart] = useState(todayIso);
  const [newSpaceId, setNewSpaceId] = useState("");
  const [creating, setCreating] = useState(false);

  const [currentUserId, setCurrentUserId] = React.useState<string>("");
  React.useEffect(() => {
    import("@constellation/api").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setCurrentUserId(user.id);
      });
    });
  }, []);

  const spaceMap = new Map(livingSpaces.map((s) => [s.id, s]));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      await createMealPlan({
        title: trimmed,
        week_start_date: newWeekStart,
        living_space_id: newSpaceId || null,
      });
      setNewTitle("");
      setNewWeekStart(todayIso());
      setNewSpaceId("");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(id: string, updates: Partial<Omit<MealPlan, "id" | "creator_id" | "updated_at">>) {
    await updateMealPlan(id, updates);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-sm text-gray-400 hover:text-white">← Back</Link>
        <h1 className="text-xl font-semibold text-white">Meal Plans</h1>
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} className="mb-6 space-y-2">
        <input
          className="w-full bg-gray-800 rounded px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none focus:border-indigo-500 placeholder-gray-500"
          placeholder="Plan title…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <input
          type="date"
          className="w-full bg-gray-800 rounded px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
          value={newWeekStart}
          onChange={(e) => setNewWeekStart(e.target.value)}
        />
        <select
          className="w-full bg-gray-800 rounded px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
          value={newSpaceId}
          onChange={(e) => setNewSpaceId(e.target.value)}
        >
          <option value="">No living space (optional)</option>
          {livingSpaces.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <button
          type="submit"
          disabled={!newTitle.trim() || creating}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-500 disabled:opacity-40"
        >
          {creating ? "Creating…" : "Create plan"}
        </button>
      </form>

      {/* List */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error.message}</p>
      ) : mealPlans.length === 0 ? (
        <p className="text-sm text-gray-500">No meal plans yet. Create one above.</p>
      ) : (
        <div className="space-y-3">
          {mealPlans.map((plan) => (
            <MealPlanCard
              key={plan.id}
              plan={plan}
              currentUserId={currentUserId}
              spaceMap={spaceMap}
              allSpaces={livingSpaces}
              onUpdate={handleUpdate}
              onDelete={deleteMealPlan}
            />
          ))}
        </div>
      )}
    </div>
  );
}
