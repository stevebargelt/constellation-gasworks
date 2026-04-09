import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAuth, useRelationships } from "@constellation/hooks";
import {
  getUser,
  getRelationshipPermissions,
  upsertRelationshipPermission,
  removeRelationship,
} from "@constellation/api";
import type { PermissionLevel, RelationshipPermission, User } from "@constellation/types";

const RESOURCE_TYPES = ["calendar", "tasks", "meals"] as const;
type ResourceType = (typeof RESOURCE_TYPES)[number];

const PERMISSION_LEVELS: PermissionLevel[] = ["full", "free_busy", "none"];

const LEVEL_LABEL: Record<PermissionLevel, string> = {
  full: "Full",
  free_busy: "Free/Busy",
  none: "None",
};

function PermissionPicker({
  resource,
  value,
  onChange,
}: {
  resource: ResourceType;
  value: PermissionLevel;
  onChange: (v: PermissionLevel) => void;
}) {
  return (
    <View style={styles.permRow}>
      <Text style={styles.permLabel}>{resource.charAt(0).toUpperCase() + resource.slice(1)}</Text>
      <View style={styles.permButtons}>
        {PERMISSION_LEVELS.map((level) => (
          <TouchableOpacity
            key={level}
            style={[styles.permBtn, value === level && styles.permBtnActive]}
            onPress={() => onChange(level)}
          >
            <Text
              style={[styles.permBtnText, value === level && styles.permBtnTextActive]}
            >
              {LEVEL_LABEL[level]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

interface RelationshipCardProps {
  relationshipId: string;
  partner: User;
  relType: string;
  customLabel: string | null;
  onRemove: (id: string) => void;
}

function RelationshipCard({
  relationshipId,
  partner,
  relType,
  customLabel,
  onRemove,
}: RelationshipCardProps) {
  const [permissions, setPermissions] = useState<Record<ResourceType, PermissionLevel>>({
    calendar: "free_busy",
    tasks: "free_busy",
    meals: "free_busy",
  });
  const [loadingPerms, setLoadingPerms] = useState(true);

  useEffect(() => {
    getRelationshipPermissions(relationshipId).then((perms: RelationshipPermission[]) => {
      const map = { ...permissions };
      for (const p of perms) {
        if (RESOURCE_TYPES.includes(p.resource_type as ResourceType)) {
          map[p.resource_type as ResourceType] = p.level as PermissionLevel;
        }
      }
      setPermissions(map);
      setLoadingPerms(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationshipId]);

  async function handlePermissionChange(resource: ResourceType, level: PermissionLevel) {
    setPermissions((prev) => ({ ...prev, [resource]: level }));
    await upsertRelationshipPermission({
      relationship_id: relationshipId,
      grantor_id: "",
      resource_type: resource,
      level,
    });
  }

  function handleRemovePress() {
    Alert.alert(
      "Remove relationship",
      `Remove your relationship with ${partner.display_name}? This revokes all shared access immediately.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await removeRelationship(relationshipId);
            onRemove(relationshipId);
          },
        },
      ]
    );
  }

  const label = customLabel ?? relType.replace(/_/g, " ");

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.partnerName}>{partner.display_name}</Text>
          <Text style={styles.relType}>{label}</Text>
        </View>
        <TouchableOpacity onPress={handleRemovePress} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Text style={styles.removeBtn}>Remove</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.unilateralNote}>
        Controls what <Text style={styles.unilateralEmphasis}>you share</Text> — their settings are separate.
      </Text>

      {loadingPerms ? (
        <ActivityIndicator size="small" color="#6b7280" style={{ marginTop: 8 }} />
      ) : (
        <View style={styles.permissionsContainer}>
          {RESOURCE_TYPES.map((resource) => (
            <PermissionPicker
              key={resource}
              resource={resource}
              value={permissions[resource]}
              onChange={(v) => handlePermissionChange(resource, v)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export default function RelationshipsScreen() {
  const { user } = useAuth();
  const { relationships, loading } = useRelationships();
  const [partners, setPartners] = useState<Record<string, User>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const active = relationships.filter(
    (r) => r.status === "active" && !removed.has(r.id)
  );

  useEffect(() => {
    if (!user || !active.length) return;
    const needed = active
      .map((r) => (r.user_a_id === user.id ? r.user_b_id : r.user_a_id))
      .filter((id) => !partners[id]);
    if (!needed.length) return;
    Promise.all(needed.map((id) => getUser(id))).then((users) => {
      const map: Record<string, User> = {};
      for (const u of users) {
        if (u) map[u.id] = u;
      }
      setPartners((prev) => ({ ...prev, ...map }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.length, user?.id]);

  function handleRemoved(id: string) {
    setRemoved((prev) => new Set(prev).add(id));
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Relationships</Text>

      {loading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 32 }} />
      ) : active.length === 0 ? (
        <Text style={styles.empty}>No active relationships yet.</Text>
      ) : (
        active.map((rel) => {
          const partnerId = rel.user_a_id === user?.id ? rel.user_b_id : rel.user_a_id;
          const partner = partners[partnerId];
          if (!partner) return null;
          return (
            <RelationshipCard
              key={rel.id}
              relationshipId={rel.id}
              partner={partner}
              relType={rel.rel_type}
              customLabel={rel.custom_label}
              onRemove={handleRemoved}
            />
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  content: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "bold", color: "#f9fafb", marginBottom: 16 },
  empty: { color: "#6b7280", fontSize: 14, marginTop: 32, textAlign: "center" },

  card: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  partnerName: { fontSize: 16, fontWeight: "600", color: "#f9fafb" },
  relType: { fontSize: 12, color: "#9ca3af", textTransform: "capitalize", marginTop: 2 },
  removeBtn: { fontSize: 12, color: "#6b7280" },

  unilateralNote: { fontSize: 11, color: "#4b5563", fontStyle: "italic", marginBottom: 12 },
  unilateralEmphasis: { color: "#9ca3af", fontStyle: "normal" },

  permissionsContainer: { gap: 10 },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  permLabel: { fontSize: 13, color: "#9ca3af", width: 64 },
  permButtons: { flexDirection: "row", gap: 6 },
  permBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
  },
  permBtnActive: { backgroundColor: "#1d4ed8", borderColor: "#2563eb" },
  permBtnText: { fontSize: 12, color: "#9ca3af" },
  permBtnTextActive: { color: "#f9fafb", fontWeight: "600" },
});
