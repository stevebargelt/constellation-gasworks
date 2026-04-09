import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth, useRecipes, useRelationships } from "@constellation/hooks";
import {
  createRecipe,
  getRecipeIngredients,
  replaceRecipeIngredients,
  shareRecipe,
  getUsersByIds,
} from "@constellation/api";
import type { RecipeIngredient, User } from "@constellation/types";
import { theme } from "../../src/theme";

type DraftIngredient = Omit<RecipeIngredient, "id" | "recipe_id">;

// ---------- IngredientRow ----------

interface IngredientRowProps {
  ing: DraftIngredient;
  idx: number;
  total: number;
  onChange: (idx: number, field: keyof DraftIngredient, value: string | null) => void;
  onRemove: (idx: number) => void;
  onMoveUp: (idx: number) => void;
  onMoveDown: (idx: number) => void;
}

function IngredientRow({ ing, idx, total, onChange, onRemove, onMoveUp, onMoveDown }: IngredientRowProps) {
  return (
    <View style={styles.ingRow}>
      <View style={styles.ingMoveCol}>
        <TouchableOpacity onPress={() => onMoveUp(idx)} disabled={idx === 0} hitSlop={4}>
          <Text style={[styles.moveArrow, idx === 0 && styles.moveArrowDisabled]}>▲</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onMoveDown(idx)} disabled={idx === total - 1} hitSlop={4}>
          <Text style={[styles.moveArrow, idx === total - 1 && styles.moveArrowDisabled]}>▼</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={[styles.ingInput, { width: 60 }]}
        placeholder="Qty"
        placeholderTextColor={theme.colors.neutral[500]}
        value={ing.quantity ?? ""}
        onChangeText={(v) => onChange(idx, "quantity", v || null)}
      />
      <TextInput
        style={[styles.ingInput, { width: 50 }]}
        placeholder="Unit"
        placeholderTextColor={theme.colors.neutral[500]}
        value={ing.unit ?? ""}
        onChangeText={(v) => onChange(idx, "unit", v || null)}
      />
      <TextInput
        style={[styles.ingInput, { flex: 1 }]}
        placeholder="Name *"
        placeholderTextColor={theme.colors.neutral[500]}
        value={ing.name}
        onChangeText={(v) => onChange(idx, "name", v)}
      />
      <TouchableOpacity onPress={() => onRemove(idx)} hitSlop={8}>
        <Text style={styles.ingRemove}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------- RecipeDetailScreen ----------

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const { user } = useAuth();
  const { relationships } = useRelationships();
  const { recipes, updateRecipe: updateRecipeHook, deleteRecipe: remove } = useRecipes();

  const recipe = recipes.find((r) => r.id === id);

  const [editing, setEditing] = useState(isNew);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [servings, setServings] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([]);
  const [saving, setSaving] = useState(false);
  const [partners, setPartners] = useState<User[]>([]);

  // Load recipe data into form
  useEffect(() => {
    if (recipe) {
      setTitle(recipe.title);
      setInstructions(recipe.instructions ?? "");
      setServings(recipe.servings?.toString() ?? "");
      setNotes(recipe.notes ?? "");
      setTags(recipe.tags);
    }
  }, [recipe?.id]);

  // Load ingredients
  useEffect(() => {
    if (!id || isNew) return;
    getRecipeIngredients(id).then((ings) =>
      setIngredients(ings.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, sort_order: i.sort_order })))
    );
  }, [id, isNew]);

  // Load partners for share
  useEffect(() => {
    if (!user) return;
    const ids = relationships
      .filter((r) => r.status === "active")
      .map((r) => (r.user_a_id === user.id ? r.user_b_id : r.user_a_id));
    if (!ids.length) { setPartners([]); return; }
    getUsersByIds(ids).then(setPartners);
  }, [relationships, user]);

  function addTag() {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) setTags((prev) => [...prev, trimmed]);
    setTagInput("");
  }

  function updateIngredient(idx: number, field: keyof DraftIngredient, value: string | null) {
    setIngredients((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function removeIngredient(idx: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    setIngredients((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveDown(idx: number) {
    setIngredients((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert("Title required", "Please enter a recipe title.");
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      instructions: instructions.trim() || null,
      servings: servings ? Number(servings) : null,
      notes: notes.trim() || null,
      tags,
    };
    const ingPayload = ingredients
      .filter((i) => i.name.trim())
      .map((i, idx) => ({ ...i, name: i.name.trim(), sort_order: idx }));

    if (isNew) {
      const created = await createRecipe(payload);
      if (created) {
        await replaceRecipeIngredients(created.id, ingPayload);
        router.replace(`/recipes/${created.id}`);
      }
    } else if (recipe) {
      await updateRecipeHook(recipe.id, payload);
      await replaceRecipeIngredients(recipe.id, ingPayload);
      setEditing(false);
    }
    setSaving(false);
  }

  function handleDelete() {
    if (!recipe) return;
    Alert.alert(
      "Delete recipe",
      `Delete "${recipe.title}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await remove(recipe.id);
            router.replace("/recipes");
          },
        },
      ]
    );
  }

  function handleShare() {
    if (!recipe || !partners.length) return;
    Alert.alert(
      "Share recipe",
      "Share with:",
      [
        ...partners.map((p) => ({
          text: p.display_name,
          onPress: () => shareRecipe(recipe.id, p.id).then(() =>
            Alert.alert("Shared", `Recipe shared with ${p.display_name}.`)
          ),
        })),
        { text: "Cancel", style: "cancel" as const },
      ]
    );
  }

  if (!isNew && !recipe && recipes.length > 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Recipe not found.</Text>
      </View>
    );
  }

  if (!isNew && !recipe) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary[400]} />
      </View>
    );
  }

  const isOwner = !recipe || recipe.owner_id === user?.id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Recipes</Text>
        </TouchableOpacity>
        <Text style={styles.heading} numberOfLines={1}>
          {isNew ? "New Recipe" : editing ? "Edit Recipe" : (recipe?.title ?? "")}
        </Text>
        {!editing && recipe && (
          <View style={styles.headerActions}>
            {partners.length > 0 && (
              <TouchableOpacity onPress={handleShare} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Share</Text>
              </TouchableOpacity>
            )}
            {isOwner && (
              <TouchableOpacity onPress={() => setEditing(true)} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
            {isOwner && (
              <TouchableOpacity onPress={handleDelete} style={styles.deleteActionBtn}>
                <Text style={styles.deleteActionBtnText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* view mode */}
      {!editing && recipe && (
        <View style={styles.viewBody}>
          {/* meta */}
          <View style={styles.metaRow}>
            {recipe.servings != null && (
              <Text style={styles.metaText}>Serves {recipe.servings}</Text>
            )}
            {recipe.tags.map((tag) => (
              <View key={tag} style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>{tag}</Text>
              </View>
            ))}
          </View>

          {ingredients.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>INGREDIENTS</Text>
              {ingredients.map((ing, i) => (
                <Text key={i} style={styles.ingViewText}>
                  {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(" ")}
                </Text>
              ))}
            </View>
          )}

          {recipe.instructions ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>INSTRUCTIONS</Text>
              <Text style={styles.bodyText}>{recipe.instructions}</Text>
            </View>
          ) : null}

          {recipe.notes ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>NOTES</Text>
              <Text style={[styles.bodyText, { color: theme.colors.neutral[400] }]}>{recipe.notes}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* edit / create mode */}
      {editing && (
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="Recipe title…"
              placeholderTextColor={theme.colors.neutral[500]}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Servings</Text>
            <TextInput
              style={[styles.input, { width: 80 }]}
              placeholder="0"
              placeholderTextColor={theme.colors.neutral[500]}
              value={servings}
              onChangeText={setServings}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Tags</Text>
            <View style={styles.tagsRow}>
              {tags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  style={styles.tagChip}
                >
                  <Text style={styles.tagChipText}>{tag} ×</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.tagInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Add tag…"
                placeholderTextColor={theme.colors.neutral[500]}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={addTag} style={styles.addTagBtn}>
                <Text style={styles.addTagBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Ingredients</Text>
            {ingredients.map((ing, idx) => (
              <IngredientRow
                key={idx}
                ing={ing}
                idx={idx}
                total={ingredients.length}
                onChange={updateIngredient}
                onRemove={removeIngredient}
                onMoveUp={moveUp}
                onMoveDown={moveDown}
              />
            ))}
            <TouchableOpacity
              onPress={() => setIngredients((prev) => [...prev, { name: "", quantity: null, unit: null, sort_order: prev.length }])}
              style={styles.addIngBtn}
            >
              <Text style={styles.addIngBtnText}>+ Add ingredient</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Instructions</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Step-by-step instructions…"
              placeholderTextColor={theme.colors.neutral[500]}
              value={instructions}
              onChangeText={setInstructions}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textarea, { minHeight: 60 }]}
              placeholder="Optional notes…"
              placeholderTextColor={theme.colors.neutral[500]}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !title.trim()}
              style={[styles.saveBtn, (saving || !title.trim()) && styles.saveBtnDisabled]}
            >
              <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save Recipe"}</Text>
            </TouchableOpacity>
            {!isNew && (
              <TouchableOpacity onPress={() => setEditing(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.neutral[950] },
  content: { paddingBottom: theme.spacing[8] },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.neutral[950] },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    padding: theme.spacing[4],
    flexWrap: "wrap",
  },
  backBtn: { color: theme.colors.neutral[400], fontSize: theme.fontSize.sm },
  heading: {
    flex: 1,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.neutral[50],
  },
  headerActions: { flexDirection: "row", gap: theme.spacing[2] },
  actionBtn: {
    backgroundColor: theme.colors.neutral[700],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.md,
  },
  actionBtnText: { fontSize: theme.fontSize.sm, color: theme.colors.neutral[200] },
  deleteActionBtn: {
    backgroundColor: "#7f1d1d",
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.md,
  },
  deleteActionBtnText: { fontSize: theme.fontSize.sm, color: "#fca5a5" },
  viewBody: { paddingHorizontal: theme.spacing[4], gap: theme.spacing[4] },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing[2], alignItems: "center" },
  metaText: { fontSize: theme.fontSize.sm, color: theme.colors.neutral[400] },
  tagBadge: {
    backgroundColor: theme.colors.neutral[700],
    borderRadius: 999,
    paddingHorizontal: theme.spacing[2],
    paddingVertical: 2,
  },
  tagBadgeText: { fontSize: theme.fontSize.xs, color: theme.colors.neutral[300] },
  section: { gap: theme.spacing[1] },
  sectionLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
    fontWeight: theme.fontWeight.medium,
    letterSpacing: 0.8,
    marginBottom: theme.spacing[1],
  },
  ingViewText: { fontSize: theme.fontSize.sm, color: theme.colors.neutral[200] },
  bodyText: { fontSize: theme.fontSize.sm, color: theme.colors.neutral[200], lineHeight: 20 },
  form: { paddingHorizontal: theme.spacing[4], gap: theme.spacing[4] },
  field: { gap: theme.spacing[1] },
  label: { fontSize: theme.fontSize.xs, color: theme.colors.neutral[400] },
  input: {
    backgroundColor: theme.colors.neutral[800],
    borderWidth: 1,
    borderColor: theme.colors.neutral[700],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    color: theme.colors.neutral[50],
    fontSize: theme.fontSize.sm,
  },
  textarea: { minHeight: 100 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing[1], marginBottom: theme.spacing[1] },
  tagChip: {
    backgroundColor: theme.colors.neutral[700],
    borderRadius: 999,
    paddingHorizontal: theme.spacing[2],
    paddingVertical: 2,
  },
  tagChipText: { fontSize: theme.fontSize.xs, color: theme.colors.neutral[300] },
  tagInputRow: { flexDirection: "row", gap: theme.spacing[2] },
  addTagBtn: {
    backgroundColor: theme.colors.neutral[700],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing[3],
    justifyContent: "center",
  },
  addTagBtnText: { fontSize: theme.fontSize.sm, color: theme.colors.primary[400] },
  ingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[1],
    marginBottom: theme.spacing[1],
  },
  ingMoveCol: { gap: 2 },
  moveArrow: { fontSize: 10, color: theme.colors.neutral[400] },
  moveArrowDisabled: { color: theme.colors.neutral[700] },
  ingInput: {
    backgroundColor: theme.colors.neutral[800],
    borderWidth: 1,
    borderColor: theme.colors.neutral[700],
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
    color: theme.colors.neutral[50],
    fontSize: theme.fontSize.xs,
  },
  ingRemove: { fontSize: 18, color: theme.colors.neutral[400] },
  addIngBtn: { alignSelf: "flex-start", marginTop: theme.spacing[1] },
  addIngBtnText: { fontSize: theme.fontSize.xs, color: theme.colors.primary[400] },
  formActions: { flexDirection: "row", gap: theme.spacing[3], paddingTop: theme.spacing[2] },
  saveBtn: {
    backgroundColor: theme.colors.primary[600],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: "#fff", fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium },
  cancelBtn: {
    backgroundColor: theme.colors.neutral[700],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
  },
  cancelBtnText: { color: theme.colors.neutral[200], fontSize: theme.fontSize.sm },
  errorText: { color: "#f87171", fontSize: theme.fontSize.sm },
});
