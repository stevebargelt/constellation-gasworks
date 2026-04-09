import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth, useMealPlan, useRecipes, useRelationships } from "@constellation/hooks";
import { getUsersByIds } from "@constellation/api";
import type { MealPlanDay, Recipe, User } from "@constellation/types";
import { theme } from "../../src/theme";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = typeof MEAL_TYPES[number];

function partnerIdOf(rel: { user_a_id: string; user_b_id: string }, myId: string): string {
  return rel.user_a_id === myId ? rel.user_b_id : rel.user_a_id;
}

// ---------- SlotPickerModal ----------

interface SlotPickerModalProps {
  visible: boolean;
  slot: MealPlanDay | undefined;
  dayLabel: string;
  mealType: MealType;
  mealPlanId: string;
  dayOfWeek: number;
  recipes: Recipe[];
  onSave: (day: Omit<MealPlanDay, "id">) => Promise<void>;
  onRemove: (dayOfWeek: number, mealType: string) => Promise<void>;
  onClose: () => void;
}

function SlotPickerModal({
  visible,
  slot,
  dayLabel,
  mealType,
  mealPlanId,
  dayOfWeek,
  recipes,
  onSave,
  onRemove,
  onClose,
}: SlotPickerModalProps) {
  const [mode, setMode] = useState<"recipe" | "text">(slot?.recipe_id ? "recipe" : "text");
  const [freeText, setFreeText] = useState(slot?.free_text ?? "");
  const [selectedRecipeId, setSelectedRecipeId] = useState(slot?.recipe_id ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setMode(slot?.recipe_id ? "recipe" : "text");
      setFreeText(slot?.free_text ?? "");
      setSelectedRecipeId(slot?.recipe_id ?? "");
    }
  }, [visible, slot]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      meal_plan_id: mealPlanId,
      day_of_week: dayOfWeek,
      meal_type: mealType,
      recipe_id: mode === "recipe" && selectedRecipeId ? selectedRecipeId : null,
      free_text: mode === "text" && freeText.trim() ? freeText.trim() : null,
    });
    setSaving(false);
    onClose();
  };

  const handleRemove = async () => {
    if (!slot) return;
    setSaving(true);
    await onRemove(dayOfWeek, mealType);
    setSaving(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <Text style={modalStyles.heading}>
            {dayLabel} — {mealType}
          </Text>

          <View style={modalStyles.modeRow}>
            <TouchableOpacity
              style={[modalStyles.modeBtn, mode === "recipe" && modalStyles.modeBtnActive]}
              onPress={() => setMode("recipe")}
            >
              <Text style={modalStyles.modeBtnText}>Recipe</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.modeBtn, mode === "text" && modalStyles.modeBtnActive]}
              onPress={() => setMode("text")}
            >
              <Text style={modalStyles.modeBtnText}>Free text</Text>
            </TouchableOpacity>
          </View>

          {mode === "recipe" ? (
            <ScrollView style={modalStyles.recipeList} nestedScrollEnabled>
              {recipes.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    modalStyles.recipeRow,
                    selectedRecipeId === r.id && modalStyles.recipeRowSelected,
                  ]}
                  onPress={() => setSelectedRecipeId(r.id)}
                >
                  <Text style={modalStyles.recipeLabel}>{r.title}</Text>
                </TouchableOpacity>
              ))}
              {recipes.length === 0 && (
                <Text style={modalStyles.emptyRecipes}>No recipes yet. Add some first.</Text>
              )}
            </ScrollView>
          ) : (
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. Leftovers, takeout…"
              placeholderTextColor={theme.colors.neutral[500]}
              value={freeText}
              onChangeText={setFreeText}
              autoFocus={mode === "text"}
            />
          )}

          <View style={modalStyles.actions}>
            <TouchableOpacity
              style={[modalStyles.actionBtn, modalStyles.actionBtnPrimary, saving && modalStyles.disabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={modalStyles.actionBtnText}>{saving ? "Saving…" : "Save"}</Text>
            </TouchableOpacity>
            {slot && (
              <TouchableOpacity
                style={[modalStyles.actionBtn, modalStyles.actionBtnDanger, saving && modalStyles.disabled]}
                onPress={handleRemove}
                disabled={saving}
              >
                <Text style={modalStyles.actionBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[modalStyles.actionBtn, modalStyles.actionBtnSecondary]} onPress={onClose}>
              <Text style={modalStyles.actionBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------- MealPlanDetail ----------

export default function MealPlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { relationships } = useRelationships();
  const { plan, days, members, loading, upsertDay, removeDay, removePlan, addMember, removeMember } =
    useMealPlan(id!);
  const { recipes } = useRecipes();

  const [partnerMap, setPartnerMap] = useState<Map<string, User>>(new Map());
  const [pickerTarget, setPickerTarget] = useState<{ dayOfWeek: number; mealType: MealType } | null>(null);

  const partners = useMemo(() => {
    if (!user || !relationships) return [];
    return relationships
      .filter((r) => r.status === "active")
      .map((r) => ({ id: partnerIdOf(r, user.id) }));
  }, [user, relationships]);

  useEffect(() => {
    const allIds = [...partners.map((p) => p.id), ...members.map((m) => m.user_id)];
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

  const existingMemberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const addablePartners = useMemo(
    () => partners.filter((p) => !existingMemberIds.has(p.id)),
    [partners, existingMemberIds]
  );

  const pickerSlot = pickerTarget
    ? slotMap.get(`${pickerTarget.dayOfWeek}:${pickerTarget.mealType}`)
    : undefined;

  const handleDeletePlan = () => {
    Alert.alert("Delete plan", "Delete this meal plan?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await removePlan();
          router.push("/meal-plans" as never);
        },
      },
    ]);
  };

  if (loading) return <ActivityIndicator color={theme.colors.primary[400]} style={{ marginTop: 80 }} />;
  if (!plan) return <View style={styles.container}><Text style={styles.muted}>Plan not found.</Text></View>;

  const isCreator = plan.creator_id === user?.id;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/meal-plans" as never)}>
          <Text style={styles.back}>← Plans</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{plan.title}</Text>
        {isCreator && (
          <TouchableOpacity onPress={handleDeletePlan}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
        {/* Week subtitle */}
        <Text style={styles.subtitle}>
          Week of{" "}
          {new Date(plan.week_start_date + "T00:00:00").toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </Text>

        {/* Grid: one section per meal type */}
        {MEAL_TYPES.map((mealType) => (
          <View key={mealType} style={styles.mealSection}>
            <Text style={styles.mealTypeLabel}>{mealType.charAt(0).toUpperCase() + mealType.slice(1)}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.dayRow}>
                {DAYS.map((dayLabel, idx) => {
                  const dayOfWeek = idx + 1;
                  const slot = slotMap.get(`${dayOfWeek}:${mealType}`);
                  const recipeTitle = slot?.recipe_id
                    ? recipes.find((r) => r.id === slot.recipe_id)?.title
                    : null;
                  const label = recipeTitle ?? slot?.free_text ?? null;
                  return (
                    <TouchableOpacity
                      key={dayOfWeek}
                      style={[styles.dayCell, slot && styles.dayCellFilled]}
                      onPress={() => setPickerTarget({ dayOfWeek, mealType })}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dayCellDay}>{dayLabel}</Text>
                      {label ? (
                        <Text style={styles.dayCellContent} numberOfLines={2}>{label}</Text>
                      ) : (
                        <Text style={styles.dayCellPlus}>+</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        ))}

        {/* Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          <View style={styles.chipsWrap}>
            {members.map((m) => {
              const u = partnerMap.get(m.user_id);
              const name = u?.display_name ?? m.user_id.slice(0, 8);
              const canRemove = isCreator && m.user_id !== user?.id;
              return (
                <View key={m.user_id} style={styles.chip}>
                  <Text style={styles.chipText}>{name}</Text>
                  {canRemove && (
                    <TouchableOpacity onPress={() => removeMember(m.user_id)} hitSlop={8}>
                      <Text style={styles.chipRemove}> ×</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            {isCreator &&
              addablePartners.map((p) => {
                const u = partnerMap.get(p.id);
                const name = u?.display_name ?? p.id.slice(0, 8);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.chipAdd}
                    onPress={() => addMember(p.id)}
                  >
                    <Text style={styles.chipAddText}>+ {name}</Text>
                  </TouchableOpacity>
                );
              })}
          </View>
        </View>
      </ScrollView>

      {/* Slot picker modal */}
      {pickerTarget && (
        <SlotPickerModal
          visible
          slot={pickerSlot}
          dayLabel={DAYS[pickerTarget.dayOfWeek - 1]}
          mealType={pickerTarget.mealType}
          mealPlanId={plan.id}
          dayOfWeek={pickerTarget.dayOfWeek}
          recipes={recipes}
          onSave={upsertDay}
          onRemove={removeDay}
          onClose={() => setPickerTarget(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.neutral[950] },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[800],
  },
  back: { color: theme.colors.neutral[400], fontSize: 14 },
  title: { color: theme.colors.neutral[50], fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center" },
  deleteText: { color: theme.colors.error[400], fontSize: 13 },
  subtitle: { color: theme.colors.neutral[400], fontSize: 12, marginBottom: 16 },
  muted: { color: theme.colors.neutral[500], textAlign: "center", marginTop: 40, fontSize: 14 },
  mealSection: { marginBottom: 16 },
  mealTypeLabel: {
    color: theme.colors.neutral[400],
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  dayRow: { flexDirection: "row", gap: 8 },
  dayCell: {
    width: 80,
    minHeight: 64,
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.borderRadius.md,
    padding: 8,
    alignItems: "center",
  },
  dayCellFilled: { backgroundColor: theme.colors.neutral[700] },
  dayCellDay: { color: theme.colors.neutral[400], fontSize: 10, fontWeight: "600", marginBottom: 4 },
  dayCellContent: { color: theme.colors.neutral[100], fontSize: 11, textAlign: "center" },
  dayCellPlus: { color: theme.colors.neutral[600], fontSize: 18 },
  section: { marginTop: 24 },
  sectionTitle: { color: theme.colors.neutral[300], fontSize: 14, fontWeight: "600", marginBottom: 10 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.neutral[700],
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { color: theme.colors.neutral[100], fontSize: 13 },
  chipRemove: { color: theme.colors.neutral[400], fontSize: 14 },
  chipAdd: {
    backgroundColor: theme.colors.neutral[800],
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary[700],
  },
  chipAddText: { color: theme.colors.primary[400], fontSize: 13 },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.colors.neutral[900],
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  heading: { color: theme.colors.neutral[100], fontSize: 16, fontWeight: "700" },
  modeRow: { flexDirection: "row", gap: 8 },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.neutral[700],
    alignItems: "center",
  },
  modeBtnActive: { backgroundColor: theme.colors.primary[600] },
  modeBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  recipeList: { maxHeight: 200 },
  recipeRow: {
    padding: 12,
    borderRadius: theme.borderRadius.md,
    marginBottom: 4,
    backgroundColor: theme.colors.neutral[800],
  },
  recipeRowSelected: { backgroundColor: theme.colors.primary[800] },
  recipeLabel: { color: theme.colors.neutral[100], fontSize: 14 },
  emptyRecipes: { color: theme.colors.neutral[500], fontSize: 13, textAlign: "center", padding: 12 },
  input: {
    backgroundColor: theme.colors.neutral[700],
    color: theme.colors.neutral[50],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: theme.borderRadius.md, alignItems: "center" },
  actionBtnPrimary: { backgroundColor: theme.colors.primary[600] },
  actionBtnDanger: { backgroundColor: theme.colors.error[700] },
  actionBtnSecondary: { backgroundColor: theme.colors.neutral[700] },
  disabled: { opacity: 0.5 },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
