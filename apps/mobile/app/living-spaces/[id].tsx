import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth, useRelationships } from "@constellation/hooks";
import {
  getLivingSpaces,
  getLivingSpaceMembers,
  getUsersByIds,
  getUserColors,
  joinLivingSpace,
  addLivingSpaceMember,
  removeLivingSpaceMember,
} from "@constellation/api";
import type { LivingSpace, LivingSpaceMember, User, UserColor } from "@constellation/types";

import { theme } from "../../src/theme";

const FALLBACK_COLOR = "#6366f1";

function partnerIdOf(rel: { user_a_id: string; user_b_id: string }, myId: string): string {
  return rel.user_a_id === myId ? rel.user_b_id : rel.user_a_id;
}

// ---------- MemberRow ----------

interface MemberRowProps {
  member: LivingSpaceMember;
  user: User | undefined;
  color: string;
  isSelf: boolean;
  canRemove: boolean;
  onRemove: () => void;
}

function MemberRow({ user, color, isSelf, canRemove, onRemove }: MemberRowProps) {
  const initials = user?.display_name?.slice(0, 2).toUpperCase() ?? "??";
  const label = isSelf
    ? `${user?.display_name ?? "You"} (you)`
    : (user?.display_name ?? "Unknown");

  return (
    <View style={styles.memberRow}>
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <Text style={styles.memberName}>{label}</Text>
      {canRemove && (
        <TouchableOpacity onPress={onRemove} hitSlop={8} style={styles.removeBtn}>
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------- LivingSpaceDetailScreen ----------

export default function LivingSpaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { relationships } = useRelationships();

  const [space, setSpace] = useState<LivingSpace | null>(null);
  const [members, setMembers] = useState<LivingSpaceMember[]>([]);
  const [userMap, setUserMap] = useState<Map<string, User>>(new Map());
  const [colorMap, setColorMap] = useState<Map<string, string>>(new Map());
  const [partners, setPartners] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const currentUserId = user?.id ?? "";

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [spaces, memberRows, colorRows] = await Promise.all([
        getLivingSpaces(),
        getLivingSpaceMembers(id),
        getUserColors(),
      ]);
      const found = spaces.find((s) => s.id === id) ?? null;
      setSpace(found);
      setMembers(memberRows);

      const colors = new Map<string, string>(
        colorRows.map((c: UserColor) => [c.target_user_id, c.color])
      );
      setColorMap(colors);

      const memberIds = memberRows.map((m) => m.user_id);
      if (memberIds.length) {
        const users = await getUsersByIds(memberIds);
        setUserMap(new Map(users.map((u) => [u.id, u])));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, currentUserId]);

  useEffect(() => {
    if (!user || !relationships.length) return;
    const activeIds = relationships
      .filter((r) => r.status === "active")
      .map((r) => partnerIdOf(r, user.id));
    if (!activeIds.length) { setPartners([]); return; }
    getUsersByIds(activeIds).then(setPartners);
  }, [relationships, user]);

  const memberUserIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const isMember = memberUserIds.has(currentUserId);
  const isCreator = space?.creator_id === currentUserId;

  const addablePartners = useMemo(
    () => partners.filter((p) => !memberUserIds.has(p.id)),
    [partners, memberUserIds]
  );

  async function handleJoin() {
    if (!id) return;
    setBusy(true);
    await joinLivingSpace(id);
    await loadData();
    setBusy(false);
  }

  async function handleLeave() {
    if (!id) return;
    Alert.alert("Leave space", "Are you sure you want to leave this living space?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          await removeLivingSpaceMember(id, currentUserId);
          await loadData();
          setBusy(false);
        },
      },
    ]);
  }

  function promptAddPartner() {
    if (!id || addablePartners.length === 0) {
      Alert.alert("No partners available", "All your active partners are already members.");
      return;
    }
    const options = addablePartners.map((p) => ({
      text: p.display_name,
      onPress: async () => {
        setBusy(true);
        await addLivingSpaceMember(id, p.id);
        await loadData();
        setBusy(false);
      },
    }));
    Alert.alert("Add partner", "Choose a partner to add:", [
      ...options,
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function confirmRemoveMember(userId: string, name: string) {
    if (!id) return;
    Alert.alert("Remove member", `Remove ${name} from this space?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          await removeLivingSpaceMember(id, userId);
          await loadData();
          setBusy(false);
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary[400]} />
      </View>
    );
  }

  if (!space) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Space not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading} numberOfLines={1}>{space.name}</Text>
      </View>

      {space.address ? (
        <Text style={styles.address}>{space.address}</Text>
      ) : null}

      {/* join / leave */}
      <View style={styles.actionRow}>
        {!isMember && (
          <TouchableOpacity
            onPress={handleJoin}
            disabled={busy}
            style={[styles.joinBtn, busy && styles.disabled]}
          >
            <Text style={styles.joinBtnText}>Join space</Text>
          </TouchableOpacity>
        )}
        {isMember && !isCreator && (
          <TouchableOpacity
            onPress={handleLeave}
            disabled={busy}
            style={[styles.leaveBtn, busy && styles.disabled]}
          >
            <Text style={styles.leaveBtnText}>Leave space</Text>
          </TouchableOpacity>
        )}
        {(isMember || isCreator) && (
          <TouchableOpacity
            onPress={promptAddPartner}
            disabled={busy || addablePartners.length === 0}
            style={busy || addablePartners.length === 0 ? styles.disabled : undefined}
          >
            <Text style={styles.addPartnerText}>+ Add partner</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* members */}
      <Text style={styles.sectionTitle}>Members</Text>
      {members.length === 0 ? (
        <Text style={styles.emptyText}>No members yet.</Text>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.user_id}
          contentContainerStyle={styles.memberList}
          renderItem={({ item }) => {
            const isSelf = item.user_id === currentUserId;
            const u = userMap.get(item.user_id);
            const color = colorMap.get(item.user_id) ?? FALLBACK_COLOR;
            const canRemove = isCreator && !isSelf;
            const name = u?.display_name ?? "Unknown";
            return (
              <MemberRow
                member={item}
                user={u}
                color={color}
                isSelf={isSelf}
                canRemove={canRemove}
                onRemove={() => confirmRemoveMember(item.user_id, name)}
              />
            );
          }}
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.neutral[950],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[2],
  },
  backBtn: {
    color: theme.colors.neutral[400],
    fontSize: theme.fontSize.sm,
  },
  heading: {
    flex: 1,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.neutral[50],
  },
  address: {
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[2],
    fontSize: theme.fontSize.sm,
    color: theme.colors.neutral[400],
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
  joinBtn: {
    backgroundColor: theme.colors.primary[600],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
  },
  joinBtnText: {
    color: "#fff",
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  leaveBtn: {
    backgroundColor: theme.colors.neutral[700],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
  },
  leaveBtnText: {
    color: theme.colors.neutral[50],
    fontSize: theme.fontSize.sm,
  },
  addPartnerText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary[400],
  },
  disabled: {
    opacity: 0.4,
  },
  sectionTitle: {
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[2],
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.neutral[300],
  },
  memberList: {
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[8],
    gap: theme.spacing[3],
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[3],
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  memberName: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.neutral[50],
  },
  removeBtn: {
    paddingHorizontal: theme.spacing[1],
  },
  removeText: {
    fontSize: theme.fontSize.xs,
    color: "#f87171",
  },
  emptyText: {
    paddingHorizontal: theme.spacing[4],
    fontSize: theme.fontSize.sm,
    color: theme.colors.neutral[500],
  },
  errorText: {
    fontSize: theme.fontSize.sm,
    color: "#f87171",
  },
});
