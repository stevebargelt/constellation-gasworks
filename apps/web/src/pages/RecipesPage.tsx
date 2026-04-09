import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useRecipes } from "@constellation/hooks";

export default function RecipesPage() {
  const { recipes, sharedRecipes, loading, error } = useRecipes();
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Collect all unique tags across own recipes
  const allTags = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => r.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [recipes]);

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      const matchesSearch =
        !search.trim() ||
        r.title.toLowerCase().includes(search.toLowerCase());
      const matchesTag =
        !tagFilter || r.tags.includes(tagFilter);
      return matchesSearch && matchesTag;
    });
  }, [recipes, search, tagFilter]);

  const filteredShared = useMemo(() => {
    return sharedRecipes.filter((r) =>
      !search.trim() || r.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [sharedRecipes, search]);

  if (loading) return <div className="p-8 text-gray-400">Loading recipes…</div>;
  if (error) return <div className="p-8 text-red-400">{error.message}</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-sm text-gray-400 hover:text-white">← Home</Link>
          <h1 className="text-xl font-bold">Recipes</h1>
        </div>
        <Link
          to="/recipes/new"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium"
        >
          + New Recipe
        </Link>
      </div>

      {/* search + tag filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          className="flex-1 min-w-48 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm placeholder-gray-500"
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTagFilter(null)}
            className={`px-3 py-1 rounded-full text-xs ${
              !tagFilter ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              className={`px-3 py-1 rounded-full text-xs ${
                tagFilter === tag
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* my recipes */}
      <div className="space-y-3">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide">My Recipes</h2>
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-sm">
            {recipes.length === 0 ? "No recipes yet. Create your first one!" : "No recipes match your filters."}
          </p>
        ) : (
          filtered.map((recipe) => (
            <Link
              key={recipe.id}
              to={`/recipes/${recipe.id}`}
              className="block bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-medium">{recipe.title}</h2>
                  {recipe.servings && (
                    <p className="text-xs text-gray-400 mt-0.5">Serves {recipe.servings}</p>
                  )}
                </div>
                {recipe.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-end shrink-0">
                    {recipe.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-700 rounded-full text-xs text-gray-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {recipe.notes && (
                <p className="text-xs text-gray-400 mt-2 line-clamp-1">{recipe.notes}</p>
              )}
            </Link>
          ))
        )}
      </div>

      {/* shared with me */}
      {(filteredShared.length > 0 || sharedRecipes.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Shared with Me</h2>
          {filteredShared.length === 0 ? (
            <p className="text-gray-500 text-sm">No shared recipes match your search.</p>
          ) : (
            filteredShared.map((recipe) => (
              <Link
                key={recipe.id}
                to={`/recipes/${recipe.id}`}
                className="block bg-gray-800 border border-gray-700 rounded-lg p-4 hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium">{recipe.title}</h2>
                      <span className="text-xs text-indigo-400 bg-indigo-900/40 px-2 py-0.5 rounded-full">shared</span>
                    </div>
                    {recipe.servings && (
                      <p className="text-xs text-gray-400 mt-0.5">Serves {recipe.servings}</p>
                    )}
                  </div>
                  {recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 justify-end shrink-0">
                      {recipe.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-700 rounded-full text-xs text-gray-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
