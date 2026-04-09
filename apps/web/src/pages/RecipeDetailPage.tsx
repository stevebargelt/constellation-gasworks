import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth, useRecipes, useRelationships } from "@constellation/hooks";
import {
  createRecipe,
  updateRecipe,
  getRecipeIngredients,
  getRecipeShares,
  replaceRecipeIngredients,
  getUsersByIds,
} from "@constellation/api";
import type { Recipe, RecipeIngredient, RecipeShare, User } from "@constellation/types";

// ---------- tag input ----------

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

function TagInput({ tags, onChange }: TagInputProps) {
  const [input, setInput] = useState("");

  function addTag() {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 rounded-full text-xs">
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="text-gray-400 hover:text-red-400"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs placeholder-gray-500"
          placeholder="Add tag…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag();
            }
          }}
        />
        <button
          type="button"
          onClick={addTag}
          className="text-xs text-indigo-400 hover:text-indigo-300"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ---------- ingredient editor ----------

type DraftIngredient = Omit<RecipeIngredient, "id" | "recipe_id">;

interface IngredientEditorProps {
  ingredients: DraftIngredient[];
  onChange: (ingredients: DraftIngredient[]) => void;
}

function IngredientEditor({ ingredients, onChange }: IngredientEditorProps) {
  function update(idx: number, field: keyof DraftIngredient, value: string | number | null) {
    const next = [...ingredients];
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  }

  function add() {
    onChange([...ingredients, { name: "", quantity: null, unit: null, sort_order: ingredients.length }]);
  }

  function remove(idx: number) {
    onChange(ingredients.filter((_, i) => i !== idx));
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...ingredients];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  }

  function moveDown(idx: number) {
    if (idx === ingredients.length - 1) return;
    const next = [...ingredients];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {ingredients.map((ing, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => moveUp(idx)}
              disabled={idx === 0}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30 leading-none"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => moveDown(idx)}
              disabled={idx === ingredients.length - 1}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30 leading-none"
            >
              ▼
            </button>
          </div>
          <input
            className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs placeholder-gray-500"
            placeholder="Qty"
            value={ing.quantity ?? ""}
            onChange={(e) => update(idx, "quantity", e.target.value || null)}
          />
          <input
            className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs placeholder-gray-500"
            placeholder="Unit"
            value={ing.unit ?? ""}
            onChange={(e) => update(idx, "unit", e.target.value || null)}
          />
          <input
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs placeholder-gray-500"
            placeholder="Ingredient name *"
            value={ing.name}
            onChange={(e) => update(idx, "name", e.target.value)}
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="text-gray-400 hover:text-red-400 text-sm"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-xs text-indigo-400 hover:text-indigo-300"
      >
        + Add ingredient
      </button>
    </div>
  );
}

// ---------- share panel (owner only) ----------

interface SharePanelProps {
  recipeId: string;
  partners: User[];
  onShare: (userId: string) => Promise<void>;
  onRevoke: (userId: string) => Promise<void>;
}

function SharePanel({ recipeId, partners, onShare, onRevoke }: SharePanelProps) {
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<RecipeShare[]>([]);
  const [sharedUserMap, setSharedUserMap] = useState<Map<string, User>>(new Map());

  useEffect(() => {
    getRecipeShares(recipeId).then((rows) => {
      setShares(rows);
      if (rows.length) {
        getUsersByIds(rows.map((r) => r.shared_with_id)).then((users) =>
          setSharedUserMap(new Map(users.map((u) => [u.id, u])))
        );
      }
    });
  }, [recipeId]);

  const sharedWithIds = useMemo(() => new Set(shares.map((s) => s.shared_with_id)), [shares]);
  const availablePartners = partners.filter((p) => !sharedWithIds.has(p.id));

  async function handleShare(userId: string) {
    await onShare(userId);
    const rows = await getRecipeShares(recipeId);
    setShares(rows);
    if (rows.length) {
      getUsersByIds(rows.map((r) => r.shared_with_id)).then((users) =>
        setSharedUserMap(new Map(users.map((u) => [u.id, u])))
      );
    }
  }

  async function handleRevoke(userId: string) {
    await onRevoke(userId);
    setShares((prev) => prev.filter((s) => s.shared_with_id !== userId));
  }

  if (!partners.length && !shares.length) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
      >
        Share{shares.length > 0 ? ` (${shares.length})` : ""}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 bg-gray-800 border border-gray-700 rounded shadow-lg min-w-52 p-2 space-y-2">
          {shares.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 px-1 mb-1">Shared with</p>
              {shares.map((s) => {
                const u = sharedUserMap.get(s.shared_with_id);
                return (
                  <div key={s.shared_with_id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-700">
                    <span className="text-sm">{u?.display_name ?? s.shared_with_id.slice(0, 8)}</span>
                    <button
                      onClick={() => handleRevoke(s.shared_with_id)}
                      className="text-xs text-red-400 hover:text-red-300 ml-3"
                    >
                      Revoke
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {availablePartners.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 px-1 mb-1">Share with</p>
              {availablePartners.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleShare(p.id)}
                  className="flex w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-700"
                >
                  {p.display_name}
                </button>
              ))}
            </div>
          )}
          {!availablePartners.length && !shares.length && (
            <p className="text-xs text-gray-500 px-1">No partners to share with.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- recipe form ----------

interface RecipeFormValues {
  title: string;
  instructions: string;
  servings: string;
  notes: string;
  tags: string[];
  ingredients: DraftIngredient[];
}

function defaultForm(recipe?: Recipe, ingredients?: DraftIngredient[]): RecipeFormValues {
  return {
    title: recipe?.title ?? "",
    instructions: recipe?.instructions ?? "",
    servings: recipe?.servings?.toString() ?? "",
    notes: recipe?.notes ?? "",
    tags: recipe?.tags ?? [],
    ingredients: ingredients ?? [],
  };
}

// ---------- RecipeDetailPage ----------

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { relationships } = useRelationships();
  const { recipes, sharedRecipes, updateRecipe: updateRecipeHook, deleteRecipe: remove, shareRecipe, revokeShare, copyRecipe } = useRecipes();

  const recipe = useMemo(
    () => recipes.find((r) => r.id === id) ?? sharedRecipes.find((r) => r.id === id),
    [recipes, sharedRecipes, id]
  );

  const [editing, setEditing] = useState(isNew);
  const [form, setForm] = useState<RecipeFormValues>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [partners, setPartners] = useState<User[]>([]);

  // Load ingredients when viewing an existing recipe
  useEffect(() => {
    if (!id || isNew) return;
    getRecipeIngredients(id).then((ings) => {
      setForm(defaultForm(recipe, ings.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        sort_order: i.sort_order,
      }))));
    });
  }, [id, recipe, isNew]);

  // Sync form from recipe list changes
  useEffect(() => {
    if (!recipe || editing) return;
    getRecipeIngredients(recipe.id).then((ings) => {
      setForm(defaultForm(recipe, ings.map((i) => ({
        name: i.name, quantity: i.quantity, unit: i.unit, sort_order: i.sort_order,
      }))));
    });
  }, [recipe, editing]);

  // Load partners for share panel
  useEffect(() => {
    if (!user) return;
    const ids = relationships
      .filter((r) => r.status === "active")
      .map((r) => (r.user_a_id === user.id ? r.user_b_id : r.user_a_id));
    if (!ids.length) { setPartners([]); return; }
    getUsersByIds(ids).then(setPartners);
  }, [relationships, user]);

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      instructions: form.instructions.trim() || null,
      servings: form.servings ? Number(form.servings) : null,
      notes: form.notes.trim() || null,
      tags: form.tags,
    };
    const ingPayload = form.ingredients
      .filter((i) => i.name.trim())
      .map((i, idx) => ({ ...i, name: i.name.trim(), sort_order: idx }));

    if (isNew) {
      const created = await createRecipe(payload);
      if (created) {
        await replaceRecipeIngredients(created.id, ingPayload);
        navigate(`/recipes/${created.id}`, { replace: true });
      }
    } else if (recipe) {
      await updateRecipeHook(recipe.id, payload);
      await replaceRecipeIngredients(recipe.id, ingPayload);
      setEditing(false);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!recipe) return;
    if (!confirm(`Delete "${recipe.title}"?`)) return;
    await remove(recipe.id);
    navigate("/recipes");
  }

  async function handleCopy() {
    if (!recipe) return;
    setCopying(true);
    const copy = await copyRecipe(recipe.id);
    setCopying(false);
    if (copy) navigate(`/recipes/${copy.id}`);
  }

  const isOwner = !recipe || recipe.owner_id === user?.id;
  const isShared = !isOwner && !!recipe;

  if (!isNew && !recipe && recipes.length > 0 && sharedRecipes.length > 0) {
    return <div className="p-8 text-gray-400">Recipe not found.</div>;
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      {/* header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/recipes" className="text-sm text-gray-400 hover:text-white">← Recipes</Link>
          {!editing && recipe && (
            <h1 className="text-xl font-bold">{recipe.title}</h1>
          )}
          {editing && (
            <h1 className="text-xl font-bold">{isNew ? "New Recipe" : "Edit Recipe"}</h1>
          )}
        </div>
        {!editing && recipe && (
          <div className="flex items-center gap-2">
            {isShared && (
              <>
                <span className="text-xs text-indigo-400 bg-indigo-900/40 px-2 py-1 rounded-full">shared with you</span>
                <button
                  onClick={handleCopy}
                  disabled={copying}
                  className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 rounded text-sm"
                >
                  {copying ? "Saving…" : "Save a copy"}
                </button>
              </>
            )}
            {isOwner && (
              <SharePanel
                recipeId={recipe.id}
                partners={partners}
                onShare={(uid) => shareRecipe(recipe.id, uid)}
                onRevoke={(uid) => revokeShare(recipe.id, uid)}
              />
            )}
            {isOwner && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 bg-red-800 hover:bg-red-700 rounded text-sm"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* view mode */}
      {!editing && recipe && (
        <div className="space-y-6">
          {/* meta */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            {recipe.servings && <span>Serves {recipe.servings}</span>}
            {recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {recipe.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-gray-700 rounded-full text-xs">{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* ingredients */}
          {form.ingredients.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-300 mb-2">Ingredients</h2>
              <ul className="space-y-1">
                {form.ingredients.map((ing, i) => (
                  <li key={i} className="text-sm">
                    {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(" ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* instructions */}
          {recipe.instructions && (
            <div>
              <h2 className="text-sm font-medium text-gray-300 mb-2">Instructions</h2>
              <p className="text-sm whitespace-pre-wrap">{recipe.instructions}</p>
            </div>
          )}

          {/* notes */}
          {recipe.notes && (
            <div>
              <h2 className="text-sm font-medium text-gray-300 mb-2">Notes</h2>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{recipe.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* edit / create mode */}
      {editing && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Title *</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm placeholder-gray-500"
              placeholder="Recipe title…"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Servings</label>
            <input
              type="number"
              min="1"
              className="w-24 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              value={form.servings}
              onChange={(e) => setForm((f) => ({ ...f, servings: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Tags</label>
            <TagInput
              tags={form.tags}
              onChange={(tags) => setForm((f) => ({ ...f, tags }))}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Ingredients</label>
            <IngredientEditor
              ingredients={form.ingredients}
              onChange={(ingredients) => setForm((f) => ({ ...f, ingredients }))}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Instructions</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm placeholder-gray-500 resize-y min-h-[120px]"
              placeholder="Step-by-step instructions…"
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm placeholder-gray-500 resize-y min-h-[60px]"
              placeholder="Optional notes…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded text-sm font-medium"
            >
              {saving ? "Saving…" : "Save Recipe"}
            </button>
            {!isNew && (
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Cancel
              </button>
            )}
            <Link to="/recipes" className="px-4 py-2 text-gray-400 hover:text-white text-sm self-center">
              {isNew ? "Cancel" : ""}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
