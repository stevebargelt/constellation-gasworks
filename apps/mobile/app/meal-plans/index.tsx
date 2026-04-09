import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth, useMealPlans } from "@constellation/hooks";
import type { MealPlan } from "@constellation/types";
import { theme } from "../../src/theme";

function formatWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getMondayISODate(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

// ---------- CreatePlanForm ----------

interface CreatePlanFormProps {
  onSubmit: (plan: Omit<MealPlan, "id" | "creator_id" | "updated_at">) => Promise<void>;
  onCancel: () => void;
}

function CreatePlanForm({ onSubmit, onCancel }: CreatePlanFormProps) {
  const [title, setTitle] = useState("");
  const [weekStart, setWeekStart] = useState(getMondayISODate());
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Title required");
      return;
    }
    setSaving(true);
    await onSubmit({ title: title.trim(), week_start_date: weekStart, living_space_id: null });
    setSaving(false);
  };

  return (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>New Meal Plan</Text>
      <TextInput
        style={styles.input}
        placeholder="Title (e.g. This Week's Meals)"
        placeholderTextColor={theme.colors.neutral[500]}
        value={title}
        onChangeText={setTitle}
        autoFocus
      />
      <TextInput
        style={styles.input}
        placeholder="Week start (YYYY-MM-DD)"
        placeholderTextColor={theme.colors.neutral[500]}
        value={weekStart}
        onChangeText={setWeekStart}
      />
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.btnText}>{saving ? "Creating…" : "Create"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={onCancel}>
          <Text style={styles.btnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------- MealPlans index ----------

export default function MealPlansScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { mealPlans, loading, create, remove } = useMealPlans();
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = async (plan: Omit<MealPlan, "id" | "creator_id" | "updated_at">) => {
    const created = await create(plan);
    setShowCreate(false);
    if (created) router.push(`/meal-plans/${created.id}` as never);
  };

  const handleDelete = (plan: MealPlan) => {
    Alert.alert("Delete plan", `Delete "${plan.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove(plan.id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Meal Plans</Text>
        {!showCreate && (
          <TouchableOpacity onPress={() => setShowCreate(true)}>
            <Text style={styles.addBtn}>+ New</Text>
          </TouchableOpacity>
        )}
      </View>

      {showCreate && (
        <CreatePlanForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
      )}

      {loading ? (
        <ActivityIndicator color={theme.colors.primary[400]} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={mealPlans}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            !showCreate ? (
              <Text style={styles.emptyText}>No meal plans yet. Create one!</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/meal-plans/${item.id}` as never)}
              activeOpacity={0.8}
            >
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSub}>Week of {formatWeekStart(item.week_start_date)}</Text>
              </View>
              {item.creator_id === user?.id && (
                <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={8}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[800],
  },
  back: { color: theme.colors.neutral[400], fontSize: 14 },
  title: { color: theme.colors.neutral[50], fontSize: 18, fontWeight: "700" },
  addBtn: { color: theme.colors.primary[400], fontSize: 14 },
  emptyText: {
    color: theme.colors.neutral[500],
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.borderRadius.lg,
    padding: 14,
  },
  cardInfo: { flex: 1 },
  cardTitle: { color: theme.colors.neutral[50], fontSize: 15, fontWeight: "600" },
  cardSub: { color: theme.colors.neutral[400], fontSize: 12, marginTop: 2 },
  deleteText: { color: theme.colors.error[400], fontSize: 12 },
  formCard: {
    margin: 16,
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    gap: 10,
  },
  formTitle: { color: theme.colors.neutral[50], fontSize: 15, fontWeight: "700" },
  input: {
    backgroundColor: theme.colors.neutral[700],
    color: theme.colors.neutral[50],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  row: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: theme.borderRadius.md, alignItems: "center" },
  btnPrimary: { backgroundColor: theme.colors.primary[600] },
  btnSecondary: { backgroundColor: theme.colors.neutral[700] },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
