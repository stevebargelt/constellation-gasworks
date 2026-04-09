import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useMealPlan, useLivingSpaces } from "@constellation/hooks";
import { getLivingSpaceMembersWithProfiles, addMealPlanMember, supabase } from "@constellation/api";
import type { MealPlan, LivingSpace } from "@constellation/types";
import type { LivingSpaceMemberWithProfile } from "@constellation/api";
import { theme } from "../../src/theme";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatWeekStart(date: string): string {
  try {
    return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return date;
  }
}

// ---------- SpaceMemberSuggestions ----------

interface SpaceMemberSuggestionsProps {
  spaceId: string;
  mealPlanId: string;
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
    await addMealPlanMember(mealPlanId, userId);
    setAdded((prev) => new Set([...prev, userId]));
  }

  return (
    <View style={suggestionStyles.container}>
      <Text style={suggestionStyles.label}>Space members — add as invitees:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {others.map((m) => (
          <View key={m.user_id} style={suggestionStyles.chip}>
            <Text style={suggestionStyles.chipText}>{m.user.display_name}</Text>
            {!added.has(m.user_id) ? (
              <TouchableOpacity onPress={() => handleAdd(m.user_id)} style={suggestionStyles.addBtn}>
                <Text style={suggestionStyles.addBtnText}>+</Text>
              </TouchableOpacity>
            ) : (
              <Text style={suggestionStyles.checkmark}>✓</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const suggestionStyles = StyleSheet.create({
  container: { marginTop: theme.spacing[2] },
  label: { fontSize: theme.fontSize.xs, color: theme.colors.neutral[400], marginBottom: theme.spacing[1] },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.neutral[700],
    borderRadius: 999,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    marginRight: theme.spacing[2],
  },
  chipText: { fontSize: theme.fontSize.xs, color: theme.colors.neutral[200] },
  addBtn: { marginLeft: 4 },
  addBtnText: { fontSize: theme.fontSize.sm, color: theme.colors.primary[400] },
  checkmark: { fontSize: theme.fontSize.xs, color: "#4ade80", marginLeft: 4 },
});

// ---------- SpacePicker ----------

interface SpacePickerProps {
  spaces: LivingSpace[];
  value: string;
  onChange: (id: string) => void;
}

function SpacePicker({ spaces, value, onChange }: SpacePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = spaces.find((s) => s.id === value);

  return (
    <View>
      <TouchableOpacity
        style={styles.pickerBtn}
        onPress={() => setOpen((o) => !o)}
      >
        <Text style={styles.pickerBtnText}>
          {selected ? selected.name : "No living space (optional)"}
        </Text>
        <Text style={styles.pickerArrow}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.pickerList}>
          <TouchableOpacity
            style={styles.pickerItem}
            onPress={() => { onChange(""); setOpen(false); }}
          >
            <Text style={styles.pickerItemText}>No living space</Text>
          </TouchableOpacity>
          {spaces.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.pickerItem}
              onPress={() => { onChange(s.id); setOpen(false); }}
            >
              <Text style={[styles.pickerItemText, s.id === value && { color: theme.colors.primary[400] }]}>
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ---------- MealPlanItem ----------

interface MealPlanItemProps {
  plan: MealPlan;
  currentUserId: string;
  spaceMap: Map<string, LivingSpace>;
  allSpaces: LivingSpace[];
  onUpdate: (id: string, updates: Partial<Omit<MealPlan, "id" | "creator_id" | "updated_at">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function MealPlanItem({ plan, currentUserId, spaceMap, allSpaces, onUpdate, onDelete }: MealPlanItemProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const [weekStart, setWeekStart] = useState(plan.week_start_date);
  const [spaceId, setSpaceId] = useState(plan.living_space_id ?? "");
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

  function handleDeletePress() {
    Alert.alert("Delete plan", `Delete "${plan.title}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(plan.id) },
    ]);
  }

  if (editing) {
    return (
      <View style={styles.card}>
        <TextInput
          style={styles.editInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Plan title"
          placeholderTextColor={theme.colors.neutral[500]}
          autoFocus
        />
        <TextInput
          style={styles.editInput}
          value={weekStart}
          onChangeText={setWeekStart}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.colors.neutral[500]}
        />
        <SpacePicker spaces={allSpaces} value={spaceId} onChange={setSpaceId} />
        {spaceId && (
          <SpaceMemberSuggestions
            spaceId={spaceId}
            mealPlanId={plan.id}
            currentUserId={currentUserId}
          />
        )}
        <View style={styles.editActions}>
          <TouchableOpacity onPress={handleSave} disabled={!title.trim()}>
            <Text style={[styles.saveBtn, !title.trim() && { opacity: 0.4 }]}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={styles.cancelBtn}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.planTitle}>{plan.title}</Text>
          <Text style={styles.weekStart}>Week of {formatWeekStart(weekStart)}</Text>
          {spaceName && (
            <Text style={styles.spaceBadge}>📍 {spaceName}</Text>
          )}
        </View>
        {isCreator && (
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={() => setEditing(true)} style={styles.actionBtn}>
              <Text style={styles.editBtn}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeletePress} style={styles.actionBtn}>
              <Text style={styles.deleteBtn}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ---------- MealPlansScreen ----------

export default function MealPlansScreen() {
  const router = useRouter();
  const { mealPlans, loading, error, createMealPlan, updateMealPlan, deleteMealPlan } = useMealPlan();
  const { livingSpaces } = useLivingSpaces();

  const [newTitle, setNewTitle] = useState("");
  const [newWeekStart, setNewWeekStart] = useState(todayIso);
  const [newSpaceId, setNewSpaceId] = useState("");
  const [creating, setCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const spaceMap = new Map(livingSpaces.map((s) => [s.id, s]));

  async function handleCreate() {
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Meal Plans</Text>
      </View>

      {/* Create form */}
      <View style={styles.createSection}>
        <TextInput
          style={styles.createInput}
          placeholder="Plan title…"
          placeholderTextColor={theme.colors.neutral[500]}
          value={newTitle}
          onChangeText={setNewTitle}
          returnKeyType="next"
        />
        <TextInput
          style={styles.createInput}
          placeholder="Week start (YYYY-MM-DD)"
          placeholderTextColor={theme.colors.neutral[500]}
          value={newWeekStart}
          onChangeText={setNewWeekStart}
          returnKeyType="next"
        />
        <SpacePicker spaces={livingSpaces} value={newSpaceId} onChange={setNewSpaceId} />
        <TouchableOpacity
          onPress={handleCreate}
          disabled={!newTitle.trim() || creating}
          style={[styles.createBtn, (!newTitle.trim() || creating) && styles.createBtnDisabled]}
        >
          <Text style={styles.createBtnText}>{creating ? "Creating…" : "Create plan"}</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={theme.colors.primary[400]} style={{ marginTop: 32 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error.message}</Text>
      ) : mealPlans.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No meal plans yet. Create one above.</Text>
        </View>
      ) : (
        <FlatList
          data={mealPlans}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <MealPlanItem
              plan={item}
              currentUserId={currentUserId}
              spaceMap={spaceMap}
              allSpaces={livingSpaces}
              onUpdate={handleUpdate}
              onDelete={deleteMealPlan}
            />
          )}
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
    gap: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[3],
  },
  backBtn: { color: theme.colors.neutral[400], fontSize: theme.fontSize.sm },
  heading: { fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, color: theme.colors.neutral[50] },
  createSection: {
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[4],
    gap: theme.spacing[2],
  },
  createInput: {
    backgroundColor: theme.colors.neutral[800],
    borderWidth: 1,
    borderColor: theme.colors.neutral[700],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    color: theme.colors.neutral[50],
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing[2],
  },
  createBtn: {
    backgroundColor: theme.colors.primary[600],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    marginTop: theme.spacing[1],
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { color: "#fff", fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium },
  list: { paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[8], gap: theme.spacing[3] },
  card: {
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[4],
    gap: theme.spacing[2],
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing[2] },
  planTitle: { fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.medium, color: theme.colors.neutral[50] },
  weekStart: { fontSize: theme.fontSize.xs, color: theme.colors.neutral[400], marginTop: 2 },
  spaceBadge: { fontSize: theme.fontSize.xs, color: theme.colors.primary[300], marginTop: 2 },
  cardActions: { flexDirection: "row", gap: theme.spacing[2] },
  actionBtn: { paddingHorizontal: theme.spacing[1] },
  editBtn: { fontSize: theme.fontSize.xs, color: theme.colors.neutral[400] },
  deleteBtn: { fontSize: theme.fontSize.xs, color: "#f87171" },
  editInput: {
    backgroundColor: theme.colors.neutral[700],
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
    color: theme.colors.neutral[50],
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing[2],
  },
  editActions: { flexDirection: "row", gap: theme.spacing[3] },
  saveBtn: { fontSize: theme.fontSize.xs, color: theme.colors.primary[400] },
  cancelBtn: { fontSize: theme.fontSize.xs, color: theme.colors.neutral[400] },
  pickerBtn: {
    backgroundColor: theme.colors.neutral[800],
    borderWidth: 1,
    borderColor: theme.colors.neutral[700],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing[2],
  },
  pickerBtnText: { color: theme.colors.neutral[200], fontSize: theme.fontSize.sm },
  pickerArrow: { color: theme.colors.neutral[400], fontSize: theme.fontSize.xs },
  pickerList: {
    backgroundColor: theme.colors.neutral[700],
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
    marginBottom: theme.spacing[2],
  },
  pickerItem: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[600],
  },
  pickerItemText: { fontSize: theme.fontSize.sm, color: theme.colors.neutral[100] },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing[8] },
  emptyText: { color: theme.colors.neutral[500], fontSize: theme.fontSize.sm, textAlign: "center" },
  errorText: { color: "#f87171", fontSize: theme.fontSize.sm, padding: theme.spacing[4] },
});
