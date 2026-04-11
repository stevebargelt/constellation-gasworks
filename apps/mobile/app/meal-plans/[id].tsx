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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth, useMealPlan, useRelationships, useLivingSpaces } from "@constellation/hooks";
import { getRecipes, getUsersByIds, getLivingSpaceMembersWithProfiles } from "@constellation/api";
import type { MealPlanDay, Recipe, User } from "@constellation/types";
import { theme } from "../../src/theme";

// ---------- constants ----------

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = typeof MEAL_TYPES[number];

const DAYS: { label: string; value: number }[] = [
  { label: "Mon", value: 0 },
  { label: "Tue", value: 1 },
  { label: "Wed", value: 2 },
  { label: "Thu", value: 3 },
  { label: "Fri", value: 4 },
  { label: "Sat", value: 5 },
  { label: "Sun", value: 6 },
];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- SlotButton ----------

interface SlotButtonProps {
  slot: MealPlanDay | undefined;
  recipes: Recipe[];
  mealPlanId: string;
  dayOfWeek: number;
  mealType: MealType;
  onUpsert: (day: Omit<MealPlanDay, "id">) => Promise<void>;
  onClear: (dayOfWeek: number, mealType: string) => Promise<void>;
}

function SlotButton({ slot, recipes, mealPlanId, dayOfWeek, mealType, onUpsert, onClear }: SlotButtonProps) {
  const displayName = slot?.recipe_id
    ? (recipes.find((r) => r.id === slot.recipe_id)?.title ?? "Recipe")
    : slot?.free_text ?? null;

  function handlePress() {
    const options: { text: string; onPress?: () => void; style?: "cancel" | "default" | "destructive" }[] = [
      // Recipe options
      ...recipes.map((r) => ({
        text: r.title,
        onPress: () =>
          onUpsert({
            meal_plan_id: mealPlanId,
            day_of_week: dayOfWeek,
            meal_type: mealType,
            recipe_id: r.id,
            free_text: null,
          }),
      })),
      {
        text: "Free text…",
        onPress: () => {
          Alert.prompt(
            "Enter text",
            `${capitalize(mealType)} for ${DAYS[dayOfWeek]?.label}`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Save",
                onPress: (text: string | undefined) => {
                  if (text?.trim()) {
                    onUpsert({
                      meal_plan_id: mealPlanId,
                      day_of_week: dayOfWeek,
                      meal_type: mealType,
                      recipe_id: null,
                      free_text: text.trim(),
                    });
                  }
                },
              },
            ],
            "plain-text",
            slot?.free_text ?? ""
          );
        },
      },
      ...(slot
        ? [
            {
              text: "Clear slot",
              style: "destructive" as const,
              onPress: () => onClear(dayOfWeek, mealType),
            },
          ]
        : []),
      { text: "Cancel", style: "cancel" as const },
    ];

    Alert.alert(
      `${capitalize(mealType)} — ${DAYS[dayOfWeek]?.label}`,
      displayName ? `Current: ${displayName}` : "Empty slot",
      options
    );
  }

  return (
    <TouchableOpacity onPress={handlePress} style={styles.cell}>
      {displayName ? (
        <Text style={styles.cellText} numberOfLines={2}>{displayName}</Text>
      ) : (
        <Text style={styles.cellEmpty}>+</Text>
      )}
    </TouchableOpacity>
  );
}

// ---------- MealPlanDetailScreen ----------

export default function MealPlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { relationships } = useRelationships();
  const { livingSpaces } = useLivingSpaces();

  const { plan, days, members, loading, error, upsertDay, clearDay, deletePlan, addMember, removeMember } =
    useMealPlan(id!);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [partners, setPartners] = useState<User[]>([]);
  const [spaceMembers, setSpaceMembers] = useState<User[]>([]);
  const [userMap, setUserMap] = useState<Map<string, User>>(new Map());

  useEffect(() => {
    getRecipes().then(setRecipes);
  }, []);

  useEffect(() => {
    if (!user) return;
    const activeIds = relationships
      .filter((r) => r.status === "active")
      .map((r) => (r.user_a_id === user.id ? r.user_b_id : r.user_a_id));
    if (!activeIds.length) { setPartners([]); return; }
    getUsersByIds(activeIds).then(setPartners);
  }, [relationships, user]);

  useEffect(() => {
    if (!plan?.living_space_id) { setSpaceMembers([]); return; }
    getLivingSpaceMembersWithProfiles(plan.living_space_id).then((rows) =>
      setSpaceMembers(rows.map((r) => r.user))
    );
  }, [plan?.living_space_id]);

  useEffect(() => {
    const ids = members.map((m) => m.user_id);
    if (!ids.length) return;
    getUsersByIds(ids).then((users) =>
      setUserMap(new Map(users.map((u) => [u.id, u])))
    );
  }, [members]);

  const existingMemberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);

  const allInvitablePeople = useMemo<User[]>(() => {
    const map = new Map<string, User>();
    partners.forEach((p) => map.set(p.id, p));
    spaceMembers.forEach((m) => map.set(m.id, m));
    return [...map.values()];
  }, [partners, spaceMembers]);

  const availablePartners = allInvitablePeople.filter((p) => !existingMemberIds.has(p.id));

  function getSlot(dayOfWeek: number, mealType: string): MealPlanDay | undefined {
    return days.find((d) => d.day_of_week === dayOfWeek && d.meal_type === mealType);
  }

  function handleDelete() {
    Alert.alert(
      "Delete plan",
      `Delete "${plan?.title}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deletePlan();
            router.replace("/meal-plans");
          },
        },
      ]
    );
  }

  function promptAddMember() {
    if (!availablePartners.length) {
      Alert.alert("No partners", "All active partners are already members.");
      return;
    }
    Alert.alert(
      "Invite partner",
      "Choose a partner to add to this meal plan:",
      [
        ...availablePartners.map((p) => ({
          text: p.display_name,
          onPress: () => addMember(p.id),
        })),
        { text: "Cancel", style: "cancel" as const },
      ]
    );
  }

  function handleRemoveMember(userId: string) {
    Alert.alert(
      "Remove member",
      `Remove ${userMap.get(userId)?.display_name ?? userId} from this plan?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removeMember(userId) },
      ]
    );
  }

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.colors.primary[400]} />
    </View>
  );

  if (error) return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>{error.message}</Text>
    </View>
  );

  if (!plan) return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>Plan not found.</Text>
    </View>
  );

  const isCreator = plan.creator_id === user?.id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Plans</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>{plan.title}</Text>
          <Text style={styles.headingSub}>
            Week of {plan.week_start_date}
            {plan.living_space_id && livingSpaces.find((s) => s.id === plan.living_space_id)
              ? `  ·  ${livingSpaces.find((s) => s.id === plan.living_space_id)!.name}`
              : ""}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.push(`/meal-plans/shopping?id=${plan.id}`)}
            hitSlop={8}
          >
            <Text style={styles.shoppingBtn}>List</Text>
          </TouchableOpacity>
          {isCreator && (
            <TouchableOpacity onPress={handleDelete} hitSlop={8}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* members */}
      <View style={styles.membersBox}>
        <Text style={styles.sectionLabel}>MEMBERS</Text>
        <View style={styles.chipsRow}>
          {members.map((m) => {
            const u = userMap.get(m.user_id);
            const name = u?.display_name ?? m.user_id.slice(0, 8);
            return (
              <TouchableOpacity
                key={m.user_id}
                style={styles.chip}
                onPress={() => isCreator && m.user_id !== plan.creator_id && handleRemoveMember(m.user_id)}
              >
                <Text style={styles.chipText}>{name}</Text>
              </TouchableOpacity>
            );
          })}
          {isCreator && availablePartners.length > 0 && (
            <TouchableOpacity onPress={promptAddMember} style={styles.addChip}>
              <Text style={styles.addChipText}>+ Invite</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* grid: one row per meal type, cols are days */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* day headers */}
          <View style={styles.gridRow}>
            <View style={styles.mealTypeLabel} />
            {DAYS.map((d) => (
              <View key={d.value} style={styles.dayHeader}>
                <Text style={styles.dayHeaderText}>{d.label}</Text>
              </View>
            ))}
          </View>

          {MEAL_TYPES.map((mealType) => (
            <View key={mealType} style={styles.gridRow}>
              <View style={styles.mealTypeLabel}>
                <Text style={styles.mealTypeLabelText}>{capitalize(mealType)}</Text>
              </View>
              {DAYS.map((d) => (
                <SlotButton
                  key={d.value}
                  slot={getSlot(d.value, mealType)}
                  recipes={recipes}
                  mealPlanId={plan.id}
                  dayOfWeek={d.value}
                  mealType={mealType}
                  onUpsert={upsertDay}
                  onClear={clearDay}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const CELL_W = 90;
const CELL_H = 64;
const LABEL_W = 72;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.neutral[950],
  },
  content: {
    paddingBottom: theme.spacing[8],
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.neutral[950],
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing[3],
    padding: theme.spacing[4],
  },
  backBtn: {
    color: theme.colors.neutral[400],
    fontSize: theme.fontSize.sm,
    paddingTop: 2,
  },
  heading: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.neutral[50],
  },
  headingSub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
    marginTop: 2,
  },
  shoppingBtn: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary[400],
    paddingTop: 2,
  },
  deleteText: {
    fontSize: theme.fontSize.xs,
    color: "#f87171",
    paddingTop: 2,
  },
  membersBox: {
    marginHorizontal: theme.spacing[4],
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[3],
    marginBottom: theme.spacing[4],
    gap: theme.spacing[2],
  },
  sectionLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
    fontWeight: theme.fontWeight.medium,
    letterSpacing: 0.8,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing[2],
  },
  chip: {
    backgroundColor: theme.colors.neutral[700],
    borderRadius: 999,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
  },
  chipText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[200],
  },
  addChip: {
    borderWidth: 1,
    borderColor: theme.colors.primary[500],
    borderRadius: 999,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
  },
  addChipText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary[400],
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[800],
  },
  dayHeader: {
    width: CELL_W,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.neutral[800],
  },
  dayHeaderText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
    fontWeight: theme.fontWeight.medium,
  },
  mealTypeLabel: {
    width: LABEL_W,
    height: CELL_H,
    justifyContent: "center",
    paddingLeft: theme.spacing[2],
  },
  mealTypeLabelText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
    fontWeight: theme.fontWeight.medium,
  },
  cell: {
    width: CELL_W,
    height: CELL_H,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.neutral[800],
    padding: theme.spacing[1],
    justifyContent: "center",
  },
  cellText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[200],
  },
  cellEmpty: {
    fontSize: theme.fontSize.base,
    color: theme.colors.neutral[700],
    textAlign: "center",
  },
  errorText: {
    color: "#f87171",
    fontSize: theme.fontSize.sm,
    padding: theme.spacing[4],
  },
});
