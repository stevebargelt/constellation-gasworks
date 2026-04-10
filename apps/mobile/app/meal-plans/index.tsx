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
import { theme } from "../../src/theme";
import type { MealPlan } from "@constellation/types";

function formatWeekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function mondayOfCurrentWeek(): string {
  const today = new Date();
  const day = today.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

// ---------- PlanItem ----------

interface PlanItemProps {
  plan: MealPlan;
  currentUserId: string;
  onOpen: (id: string) => void;
  onDelete: (plan: MealPlan) => void;
}

function PlanItem({ plan, currentUserId, onOpen, onDelete }: PlanItemProps) {
  return (
    <TouchableOpacity onPress={() => onOpen(plan.id)} style={styles.card}>
      <View style={styles.cardContent}>
        <Text style={styles.planTitle}>{plan.title}</Text>
        <Text style={styles.planSub}>Week of {formatWeekStart(plan.week_start_date)}</Text>
      </View>
      {plan.creator_id === currentUserId && (
        <TouchableOpacity onPress={() => onDelete(plan)} hitSlop={8} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ---------- MealPlansScreen ----------

export default function MealPlansScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { mealPlans, loading, error, create, remove } = useMealPlans();

  const [title, setTitle] = useState("");
  const [weekStart] = useState(mondayOfCurrentWeek);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!title.trim() || creating) return;
    setCreating(true);
    const result = await create({ title: title.trim(), week_start_date: weekStart, living_space_id: null });
    setTitle("");
    setCreating(false);
    if (result) router.push(`/meal-plans/${result.id}`);
  }

  function handleDelete(plan: MealPlan) {
    Alert.alert(
      "Delete plan",
      `Delete "${plan.title}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => remove(plan.id) },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Meal Plans</Text>
      </View>

      {/* create row */}
      <View style={styles.createBox}>
        <TextInput
          style={styles.createInput}
          placeholder="Plan title…"
          placeholderTextColor={theme.colors.neutral[500]}
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={handleCreate}
          returnKeyType="done"
        />
        <Text style={styles.createSub}>Week of {formatWeekStart(weekStart)}</Text>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={creating || !title.trim()}
          style={[styles.createBtn, (!title.trim() || creating) && styles.createBtnDisabled]}
        >
          <Text style={styles.createBtnText}>{creating ? "Creating…" : "Create Plan"}</Text>
        </TouchableOpacity>
      </View>

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
            <PlanItem
              plan={item}
              currentUserId={user?.id ?? ""}
              onOpen={(id) => router.push(`/meal-plans/${id}`)}
              onDelete={handleDelete}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.neutral[950],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[3],
  },
  backBtn: {
    color: theme.colors.neutral[400],
    fontSize: theme.fontSize.sm,
  },
  heading: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.neutral[50],
  },
  createBox: {
    backgroundColor: theme.colors.neutral[800],
    marginHorizontal: theme.spacing[4],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[4],
    gap: theme.spacing[2],
    marginBottom: theme.spacing[4],
  },
  createInput: {
    backgroundColor: theme.colors.neutral[700],
    borderWidth: 1,
    borderColor: theme.colors.neutral[600],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    color: theme.colors.neutral[50],
    fontSize: theme.fontSize.sm,
  },
  createSub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
  },
  createBtn: {
    backgroundColor: theme.colors.primary[600],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: {
    color: "#fff",
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  list: {
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[8],
    gap: theme.spacing[3],
  },
  card: {
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[4],
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  cardContent: { flex: 1 },
  planTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.neutral[50],
  },
  planSub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
    marginTop: 2,
  },
  deleteBtn: { paddingHorizontal: theme.spacing[1] },
  deleteBtnText: { fontSize: theme.fontSize.xs, color: "#f87171" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing[8],
  },
  emptyText: {
    color: theme.colors.neutral[500],
    fontSize: theme.fontSize.sm,
    textAlign: "center",
  },
  errorText: {
    color: "#f87171",
    fontSize: theme.fontSize.sm,
    padding: theme.spacing[4],
  },
});
