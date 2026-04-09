import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMealPlan, useShoppingList } from "@constellation/hooks";
import { getUsersByIds } from "@constellation/api";
import type { ShoppingListItem, User } from "@constellation/types";
import { theme } from "../../src/theme";

function ShoppingItem({
  item,
  userMap,
  onToggle,
}: {
  item: ShoppingListItem;
  userMap: Map<string, User>;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const checker = item.checked_by_id ? userMap.get(item.checked_by_id) : null;
  return (
    <TouchableOpacity
      onPress={() => onToggle(item.id, !item.is_checked)}
      style={[styles.item, item.is_checked && styles.itemChecked]}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, item.is_checked && styles.checkboxChecked]}>
        {item.is_checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.itemBody}>
        <Text style={[styles.itemName, item.is_checked && styles.itemNameChecked]}>
          {item.ingredient_name}
        </Text>
        <View style={styles.itemMeta}>
          {(item.quantity || item.unit) && (
            <Text style={styles.itemQty}>
              {[item.quantity, item.unit].filter(Boolean).join(" ")}
            </Text>
          )}
          {checker && (
            <Text style={styles.itemChecker}>{checker.display_name}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ShoppingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mealPlanId = id!;
  const router = useRouter();

  const { plan, days, loading: planLoading } = useMealPlan(mealPlanId);
  const { items, loading, generating, toggleChecked, generateList } =
    useShoppingList(mealPlanId);

  const [userMap, setUserMap] = useState<Map<string, User>>(new Map());

  useEffect(() => {
    const checkerIds = [
      ...new Set(items.map((i) => i.checked_by_id).filter(Boolean) as string[]),
    ];
    if (!checkerIds.length) return;
    getUsersByIds(checkerIds).then((users) =>
      setUserMap(new Map(users.map((u) => [u.id, u])))
    );
  }, [items]);

  const unchecked = items.filter((i) => !i.is_checked);
  const checked = items.filter((i) => i.is_checked);

  const sections: Array<{ type: "header"; label: string } | { type: "item"; data: ShoppingListItem }> = [
    ...unchecked.map((i) => ({ type: "item" as const, data: i })),
    ...(checked.length > 0 ? [{ type: "header" as const, label: `Checked (${checked.length})` }] : []),
    ...checked.map((i) => ({ type: "item" as const, data: i })),
  ];

  if (loading || planLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary[400]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Shopping List</Text>
          {plan && <Text style={styles.subtitle}>{plan.title}</Text>}
        </View>
        <TouchableOpacity
          onPress={() => generateList(days)}
          disabled={generating}
          style={[styles.generateBtn, generating && styles.generateBtnDisabled]}
        >
          <Text style={styles.generateBtnText}>
            {generating ? "…" : items.length ? "Regen" : "Generate"}
          </Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 && !generating && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No items yet. Tap Generate to build the list from your meal plan recipes.
          </Text>
        </View>
      )}

      <FlatList
        data={sections}
        keyExtractor={(s, i) => (s.type === "item" ? s.data.id : `header-${i}`)}
        renderItem={({ item: s }) => {
          if (s.type === "header") {
            return <Text style={styles.sectionHeader}>{s.label}</Text>;
          }
          return (
            <ShoppingItem
              item={s.data}
              userMap={userMap}
              onToggle={toggleChecked}
            />
          );
        }}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.neutral[950],
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.neutral[950],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[3],
    padding: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[800],
  },
  backBtn: {
    fontSize: theme.fontSize.xl,
    color: theme.colors.neutral[400],
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.neutral[50],
  },
  subtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
    marginTop: 2,
  },
  generateBtn: {
    backgroundColor: theme.colors.primary[600],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.md,
  },
  generateBtnDisabled: {
    opacity: 0.5,
  },
  generateBtnText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[50],
    fontWeight: theme.fontWeight.medium,
  },
  list: {
    paddingVertical: theme.spacing[2],
  },
  sectionHeader: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[500],
    fontWeight: theme.fontWeight.medium,
    letterSpacing: 0.6,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    textTransform: "uppercase",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
  itemChecked: {
    opacity: 0.5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: theme.colors.neutral[600],
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary[600],
    borderColor: theme.colors.primary[600],
  },
  checkmark: {
    fontSize: 11,
    color: theme.colors.neutral[50],
    fontWeight: theme.fontWeight.bold,
  },
  itemBody: {
    flex: 1,
  },
  itemName: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.neutral[100],
  },
  itemNameChecked: {
    textDecorationLine: "line-through",
    color: theme.colors.neutral[500],
  },
  itemMeta: {
    flexDirection: "row",
    gap: theme.spacing[2],
    marginTop: 2,
  },
  itemQty: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
  },
  itemChecker: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[500],
  },
  empty: {
    padding: theme.spacing[6],
    alignItems: "center",
  },
  emptyText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.neutral[500],
    textAlign: "center",
    lineHeight: 20,
  },
});
