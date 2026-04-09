import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, useMealPlans } from "@constellation/hooks";

function formatWeekStart(dateStr: string): string {
  // dateStr is YYYY-MM-DD
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function MealPlansPage() {
  const { user } = useAuth();
  const { mealPlans, loading, error, create, remove } = useMealPlans();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [weekStart, setWeekStart] = useState(() => {
    // Default to the Monday of the current week
    const today = new Date();
    const day = today.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    return monday.toISOString().slice(0, 10);
  });
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    const result = await create({ title: title.trim(), week_start_date: weekStart, living_space_id: null });
    setTitle("");
    setCreating(false);
    if (result) navigate(`/meal-plans/${result.id}`);
  }

  if (loading) return <div className="p-8 text-gray-400">Loading meal plans…</div>;
  if (error) return <div className="p-8 text-red-400">{error.message}</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/" className="text-sm text-gray-400 hover:text-white">← Home</Link>
        <h1 className="text-xl font-bold">Meal Plans</h1>
      </div>

      {/* create form */}
      <form onSubmit={handleCreate} className="bg-gray-800 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-medium text-gray-300">New Meal Plan</h2>
        <input
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm placeholder-gray-500"
          placeholder="Plan title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-400">Week starting:</label>
          <input
            type="date"
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={creating || !title.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded text-sm font-medium"
        >
          {creating ? "Creating…" : "Create Plan"}
        </button>
      </form>

      {/* plan list */}
      {mealPlans.length === 0 ? (
        <p className="text-gray-500 text-sm">No meal plans yet. Create one above.</p>
      ) : (
        <div className="space-y-3">
          {mealPlans.map((plan) => (
            <div key={plan.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between gap-4">
              <div>
                <Link
                  to={`/meal-plans/${plan.id}`}
                  className="font-medium hover:text-indigo-300"
                >
                  {plan.title}
                </Link>
                <p className="text-xs text-gray-400 mt-0.5">
                  Week of {formatWeekStart(plan.week_start_date)}
                </p>
              </div>
              {plan.creator_id === user?.id && (
                <button
                  onClick={() => {
                    if (confirm(`Delete "${plan.title}"? This cannot be undone.`)) remove(plan.id);
                  }}
                  className="text-xs text-red-400 hover:text-red-300 shrink-0"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
