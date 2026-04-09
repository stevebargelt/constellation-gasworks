import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useRecipes } from "@constellation/hooks";
import { theme } from "../../src/theme";

export default function RecipesScreen() {
  const router = useRouter();
  const { recipes, sharedRecipes, loading, error } = useRecipes();
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => r.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [recipes]);

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      const matchesSearch = !search.trim() || r.title.toLowerCase().includes(search.toLowerCase());
      const matchesTag = !tagFilter || r.tags.includes(tagFilter);
      return matchesSearch && matchesTag;
    });
  }, [recipes, search, tagFilter]);

  const filteredShared = useMemo(() => {
    return sharedRecipes.filter((r) =>
      !search.trim() || r.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [sharedRecipes, search]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Recipes</Text>
        <TouchableOpacity onPress={() => router.push("/recipes/new")} style={styles.newBtn}>
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* search */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search recipes…"
        placeholderTextColor={theme.colors.neutral[500]}
        value={search}
        onChangeText={setSearch}
      />

      {/* tag filter */}
      {allTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll} contentContainerStyle={styles.tagRow}>
          <TouchableOpacity
            onPress={() => setTagFilter(null)}
            style={[styles.tagChip, !tagFilter && styles.tagChipActive]}
          >
            <Text style={[styles.tagChipText, !tagFilter && styles.tagChipTextActive]}>All</Text>
          </TouchableOpacity>
          {allTags.map((tag) => (
            <TouchableOpacity
              key={tag}
              onPress={() => setTagFilter(tagFilter === tag ? null : tag)}
              style={[styles.tagChip, tagFilter === tag && styles.tagChipActive]}
            >
              <Text style={[styles.tagChipText, tagFilter === tag && styles.tagChipTextActive]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <ActivityIndicator color={theme.colors.primary[400]} style={{ marginTop: 32 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error.message}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {/* my recipes section */}
          <Text style={styles.sectionHeader}>MY RECIPES</Text>
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>
              {recipes.length === 0
                ? "No recipes yet. Tap + New to create one!"
                : "No recipes match your filters."}
            </Text>
          ) : (
            filtered.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() => router.push(`/recipes/${item.id}`)}
              >
                <View style={styles.cardMain}>
                  <Text style={styles.recipeTitle}>{item.title}</Text>
                  {item.servings != null && (
                    <Text style={styles.recipeSub}>Serves {item.servings}</Text>
                  )}
                </View>
                {item.tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    {item.tags.map((tag) => (
                      <View key={tag} style={styles.tagBadge}>
                        <Text style={styles.tagBadgeText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}

          {/* shared with me section */}
          {(filteredShared.length > 0 || sharedRecipes.length > 0) && (
            <>
              <Text style={[styles.sectionHeader, { marginTop: theme.spacing[6] }]}>SHARED WITH ME</Text>
              {filteredShared.length === 0 ? (
                <Text style={styles.emptyText}>No shared recipes match your search.</Text>
              ) : (
                filteredShared.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.card, styles.sharedCard]}
                    onPress={() => router.push(`/recipes/${item.id}`)}
                  >
                    <View style={styles.cardMain}>
                      <Text style={styles.recipeTitle}>{item.title}</Text>
                      <View style={styles.sharedBadge}>
                        <Text style={styles.sharedBadgeText}>shared</Text>
                      </View>
                    </View>
                    {item.servings != null && (
                      <Text style={styles.recipeSub}>Serves {item.servings}</Text>
                    )}
                    {item.tags.length > 0 && (
                      <View style={styles.tagsRow}>
                        {item.tags.map((tag) => (
                          <View key={tag} style={styles.tagBadge}>
                            <Text style={styles.tagBadgeText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </>
          )}
        </ScrollView>
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
  backBtn: { color: theme.colors.neutral[400], fontSize: theme.fontSize.sm },
  heading: {
    flex: 1,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.neutral[50],
  },
  newBtn: {
    backgroundColor: theme.colors.primary[600],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.md,
  },
  newBtnText: { color: "#fff", fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium },
  searchInput: {
    backgroundColor: theme.colors.neutral[800],
    borderWidth: 1,
    borderColor: theme.colors.neutral[700],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    color: theme.colors.neutral[50],
    fontSize: theme.fontSize.sm,
    marginHorizontal: theme.spacing[4],
    marginBottom: theme.spacing[2],
  },
  tagScroll: { maxHeight: 44 },
  tagRow: {
    paddingHorizontal: theme.spacing[4],
    gap: theme.spacing[2],
    alignItems: "center",
    paddingBottom: theme.spacing[2],
  },
  tagChip: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    backgroundColor: theme.colors.neutral[700],
    borderRadius: 999,
  },
  tagChipActive: { backgroundColor: theme.colors.primary[600] },
  tagChipText: { fontSize: theme.fontSize.xs, color: theme.colors.neutral[300] },
  tagChipTextActive: { color: "#fff" },
  list: {
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[2],
    paddingBottom: theme.spacing[8],
    gap: theme.spacing[3],
  },
  sectionHeader: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
    fontWeight: theme.fontWeight.medium,
    letterSpacing: 0.8,
    marginBottom: theme.spacing[1],
  },
  card: {
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[4],
    gap: theme.spacing[1],
  },
  sharedCard: {
    borderWidth: 1,
    borderColor: theme.colors.neutral[700],
  },
  cardMain: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing[2] },
  recipeTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.neutral[50],
    flex: 1,
  },
  recipeSub: { fontSize: theme.fontSize.xs, color: theme.colors.neutral[400] },
  sharedBadge: {
    backgroundColor: "#1e1b4b",
    borderRadius: 999,
    paddingHorizontal: theme.spacing[2],
    paddingVertical: 2,
  },
  sharedBadgeText: { fontSize: theme.fontSize.xs, color: "#a5b4fc" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing[1], marginTop: theme.spacing[1] },
  tagBadge: {
    backgroundColor: theme.colors.neutral[700],
    borderRadius: 999,
    paddingHorizontal: theme.spacing[2],
    paddingVertical: 2,
  },
  tagBadgeText: { fontSize: theme.fontSize.xs, color: theme.colors.neutral[300] },
  emptyText: { color: theme.colors.neutral[500], fontSize: theme.fontSize.sm },
  errorText: { color: "#f87171", fontSize: theme.fontSize.sm, padding: theme.spacing[4] },
});
