import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, useMealPlans } from "@constellation/hooks";
import type { MealPlan } from "@constellation/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ---------- CreatePlanForm ----------

interface CreatePlanFormProps {
  onSubmit: (plan: Omit<MealPlan, "id" | "creator_id" | "updated_at">) => Promise<void>;
  onCancel: () => void;
}

function CreatePlanForm({ onSubmit, onCancel }: CreatePlanFormProps) {
  const [title, setTitle] = useState("");
  const [weekStart, setWeekStart] = useState(() => {
    // Default to this Monday
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return monday.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onSubmit({ title: title.trim(), week_start_date: weekStart, living_space_id: null });
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-200">New Meal Plan</h3>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. This Week's Meals"
          className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Week starting (Monday)</label>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded text-white"
        >
          {saving ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------- MealPlanCard ----------

interface MealPlanCardProps {
  plan: MealPlan;
  currentUserId: string;
  onDelete: (id: string) => void;
}

function MealPlanCard({ plan, currentUserId, onDelete }: MealPlanCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
      <div>
        <Link
          to={`/meal-plans/${plan.id}`}
          className="text-white font-medium hover:text-indigo-300"
        >
          {plan.title}
        </Link>
        <p className="text-xs text-gray-400 mt-0.5">
          Week of {formatWeekStart(plan.week_start_date)} &nbsp;·&nbsp; {DAY_LABELS.length} days
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to={`/meal-plans/${plan.id}`}
          className="text-xs text-indigo-400 hover:text-indigo-300"
        >
          Open →
        </Link>
        {plan.creator_id === currentUserId && (
          <button
            onClick={() => onDelete(plan.id)}
            className="text-xs text-red-500 hover:text-red-400"
            title="Delete plan"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- MealPlansPage ----------

export default function MealPlansPage() {
  const { user } = useAuth();
  const { mealPlans, loading, create, remove } = useMealPlans();
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async (plan: Omit<MealPlan, "id" | "creator_id" | "updated_at">) => {
    const created = await create(plan);
    setShowCreate(false);
    if (created) navigate(`/meal-plans/${created.id}`);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this meal plan?")) return;
    remove(id);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-xs text-gray-500 hover:text-gray-300">← Home</Link>
          <h1 className="text-xl font-bold text-white mt-1">Meal Plans</h1>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 rounded text-white"
          >
            + New Plan
          </button>
        )}
      </div>

      {showCreate && (
        <CreatePlanForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : mealPlans.length === 0 && !showCreate ? (
        <p className="text-gray-500 text-sm">No meal plans yet. Create one to get started.</p>
      ) : (
        <div className="space-y-3">
          {mealPlans.map((plan) => (
            <MealPlanCard
              key={plan.id}
              plan={plan}
              currentUserId={user?.id ?? ""}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
