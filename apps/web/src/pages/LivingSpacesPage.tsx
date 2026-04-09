import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useLivingSpaces } from "@constellation/hooks";
import { getMealPlansForSpace } from "@constellation/api";
import type { LivingSpace } from "@constellation/types";

// ---------- SpaceCard ----------

interface SpaceCardProps {
  space: LivingSpace;
  currentUserId: string;
  onUpdate: (id: string, name: string, address: string | null) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

function SpaceCard({ space, currentUserId, onUpdate, onRemove }: SpaceCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(space.name);
  const [address, setAddress] = useState(space.address ?? "");
  const [deleting, setDeleting] = useState(false);
  const isCreator = currentUserId === space.creator_id;

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    await onUpdate(space.id, trimmedName, address.trim() || null);
    setEditing(false);
  }

  function handleCancel() {
    setName(space.name);
    setAddress(space.address ?? "");
    setEditing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const mealPlans = await getMealPlansForSpace(space.id);
      if (mealPlans.length > 0) {
        const confirmed = window.confirm(
          `"${space.name}" has ${mealPlans.length} meal plan(s) associated with it. Deleting this space will unlink those meal plans. Continue?`
        );
        if (!confirmed) { setDeleting(false); return; }
      } else {
        const confirmed = window.confirm(`Delete "${space.name}"? This cannot be undone.`);
        if (!confirmed) { setDeleting(false); return; }
      }
      await onRemove(space.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-2">
      {editing ? (
        <div className="space-y-2">
          <input
            className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white border border-gray-600 focus:outline-none focus:border-indigo-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Space name"
            autoFocus
          />
          <input
            className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white border border-gray-600 focus:outline-none focus:border-indigo-500"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address (optional)"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="text-xs text-gray-400 hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-white">{space.name}</p>
            {space.address && (
              <p className="text-xs text-gray-400 mt-0.5">{space.address}</p>
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
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
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

// ---------- LivingSpacesPage ----------

export default function LivingSpacesPage() {
  const { livingSpaces, loading, error, create, update, remove } = useLivingSpaces();
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [creating, setCreating] = useState(false);

  // We need the current user id for creator checks
  const [currentUserId, setCurrentUserId] = React.useState<string>("");
  React.useEffect(() => {
    import("@constellation/api").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setCurrentUserId(user.id);
      });
    });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = newName.trim();
    if (!trimmedName || creating) return;
    setCreating(true);
    await create(trimmedName, newAddress.trim() || null);
    setNewName("");
    setNewAddress("");
    setCreating(false);
  }

  async function handleUpdate(id: string, name: string, address: string | null) {
    await update(id, { name, address });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-sm text-gray-400 hover:text-white">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold text-white">Living Spaces</h1>
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} className="mb-6 space-y-2">
        <input
          className="w-full bg-gray-800 rounded px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none focus:border-indigo-500 placeholder-gray-500"
          placeholder="Space name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          className="w-full bg-gray-800 rounded px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none focus:border-indigo-500 placeholder-gray-500"
          placeholder="Address (optional)"
          value={newAddress}
          onChange={(e) => setNewAddress(e.target.value)}
        />
        <button
          type="submit"
          disabled={!newName.trim() || creating}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-500 disabled:opacity-40"
        >
          {creating ? "Creating…" : "Create space"}
        </button>
      </form>

      {/* List */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error.message}</p>
      ) : livingSpaces.length === 0 ? (
        <p className="text-sm text-gray-500">No living spaces yet. Create one above.</p>
      ) : (
        <div className="space-y-3">
          {livingSpaces.map((space) => (
            <SpaceCard
              key={space.id}
              space={space}
              currentUserId={currentUserId}
              onUpdate={handleUpdate}
              onRemove={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
