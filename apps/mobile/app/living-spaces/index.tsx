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
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useLivingSpaces, useLivingSpaceMembers } from "@constellation/hooks";
import { getMealPlansForSpace, getActivePartners, supabase } from "@constellation/api";
import type { LivingSpace, User } from "@constellation/types";
import { theme } from "../../src/theme";

const FALLBACK_COLOR = "#6366f1";

// ---------- MemberAvatar ----------

function MemberAvatar({ name, color }: { name: string; color: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <View style={[styles.avatar, { backgroundColor: color }]}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

// ---------- SpaceMembersPanel ----------

interface SpaceMembersPanelProps {
  spaceId: string;
  creatorId: string | null;
  currentUserId: string;
}

function SpaceMembersPanel({ spaceId, creatorId, currentUserId }: SpaceMembersPanelProps) {
  const { members, userColors, loading, addSelf, addPartner, removeSelf, removePartner } =
    useLivingSpaceMembers(spaceId);
  const [partners, setPartners] = useState<User[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    getActivePartners().then(setPartners);
  }, []);

  const isMember = members.some((m) => m.user_id === currentUserId);
  const isCreator = currentUserId === creatorId;
  const nonMemberPartners = partners.filter(
    (p) => !members.some((m) => m.user_id === p.id)
  );

  async function handleJoin() {
    setBusy(true);
    try { await addSelf(); } finally { setBusy(false); }
  }

  async function handleLeave() {
    Alert.alert("Leave space", "Remove yourself from this living space?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave", style: "destructive", onPress: async () => {
          setBusy(true);
          try { await removeSelf(); } finally { setBusy(false); }
        },
      },
    ]);
  }

  async function handleAddPartner(userId: string, name: string) {
    setBusy(true);
    setPickerOpen(false);
    try {
      await addPartner(userId);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to add member");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(userId: string, name: string) {
    Alert.alert("Remove member", `Remove ${name} from this space?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          setBusy(true);
          try { await removePartner(userId); } finally { setBusy(false); }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.membersSection}>
        <ActivityIndicator size="small" color={theme.colors.primary[400]} />
      </View>
    );
  }

  return (
    <View style={styles.membersSection}>
      {/* Member list */}
      {members.length === 0 ? (
        <Text style={styles.noMembersText}>No members yet.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersList}>
          {members.map((m) => (
            <View key={m.id} style={styles.memberChip}>
              <MemberAvatar
                name={m.user.display_name}
                color={userColors.get(m.user_id) ?? FALLBACK_COLOR}
              />
              <Text style={styles.memberName}>{m.user.display_name}</Text>
              {isCreator && m.user_id !== currentUserId && (
                <TouchableOpacity
                  onPress={() => handleRemoveMember(m.user_id, m.user.display_name)}
                  disabled={busy}
                  style={styles.removeChipBtn}
                >
                  <Text style={styles.removeChipText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Actions */}
      <View style={styles.memberActions}>
        {!isMember && (
          <TouchableOpacity
            onPress={handleJoin}
            disabled={busy}
            style={[styles.actionChip, styles.actionChipPrimary, busy && styles.disabled]}
          >
            <Text style={styles.actionChipTextPrimary}>Join space</Text>
          </TouchableOpacity>
        )}
        {isMember && (
          <TouchableOpacity
            onPress={handleLeave}
            disabled={busy}
            style={[styles.actionChip, busy && styles.disabled]}
          >
            <Text style={styles.actionChipText}>Leave</Text>
          </TouchableOpacity>
        )}
        {isMember && nonMemberPartners.length > 0 && (
          <TouchableOpacity
            onPress={() => setPickerOpen((o) => !o)}
            disabled={busy}
            style={[styles.actionChip, busy && styles.disabled]}
          >
            <Text style={styles.actionChipText}>Add partner…</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Partner picker */}
      {pickerOpen && nonMemberPartners.length > 0 && (
        <View style={styles.partnerPicker}>
          {nonMemberPartners.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => handleAddPartner(p.id, p.display_name)}
              style={styles.partnerPickerItem}
            >
              <Text style={styles.partnerPickerText}>{p.display_name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ---------- SpaceItem ----------

interface SpaceItemProps {
  space: LivingSpace;
  currentUserId: string;
  onUpdate: (id: string, name: string, address: string | null) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

function SpaceItem({ space, currentUserId, onUpdate, onRemove }: SpaceItemProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(space.name);
  const [address, setAddress] = useState(space.address ?? "");
  const isCreator = currentUserId === space.creator_id;

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onUpdate(space.id, trimmed, address.trim() || null);
    setEditing(false);
  }

  function handleCancel() {
    setName(space.name);
    setAddress(space.address ?? "");
    setEditing(false);
  }

  async function handleDelete() {
    const mealPlans = await getMealPlansForSpace(space.id);
    const message =
      mealPlans.length > 0
        ? `"${space.name}" has ${mealPlans.length} meal plan(s) associated. Deleting will unlink those meal plans.`
        : `Delete "${space.name}"? This cannot be undone.`;
    Alert.alert(
      "Delete space",
      message,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onRemove(space.id) },
      ]
    );
  }

  if (editing) {
    return (
      <View style={styles.card}>
        <TextInput
          style={styles.editInput}
          value={name}
          onChangeText={setName}
          placeholder="Space name"
          placeholderTextColor={theme.colors.neutral[500]}
          autoFocus
        />
        <TextInput
          style={styles.editInput}
          value={address}
          onChangeText={setAddress}
          placeholder="Address (optional)"
          placeholderTextColor={theme.colors.neutral[500]}
        />
        <View style={styles.editActions}>
          <TouchableOpacity onPress={handleSave} disabled={!name.trim()}>
            <Text style={[styles.saveBtn, !name.trim() && { opacity: 0.4 }]}>Save</Text>
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
          <Text style={styles.spaceName}>{space.name}</Text>
          {space.address ? (
            <Text style={styles.spaceAddress}>{space.address}</Text>
          ) : null}
        </View>
        {isCreator && (
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => setEditing(true)} style={styles.actionBtn}>
              <Text style={styles.editBtn}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.actionBtn}>
              <Text style={styles.deleteBtn}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <SpaceMembersPanel
        spaceId={space.id}
        creatorId={space.creator_id}
        currentUserId={currentUserId}
      />
    </View>
  );
}

// ---------- LivingSpacesScreen ----------

export default function LivingSpacesScreen() {
  const router = useRouter();
  const { livingSpaces, loading, error, create, update, remove } = useLivingSpaces();
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [creating, setCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    await create(trimmed, newAddress.trim() || null);
    setNewName("");
    setNewAddress("");
    setCreating(false);
  }

  async function handleUpdate(id: string, name: string, address: string | null) {
    await update(id, { name, address });
  }

  return (
    <View style={styles.container}>
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Living Spaces</Text>
      </View>

      {/* create form */}
      <View style={styles.createSection}>
        <TextInput
          style={styles.createInput}
          placeholder="Space name…"
          placeholderTextColor={theme.colors.neutral[500]}
          value={newName}
          onChangeText={setNewName}
          returnKeyType="next"
        />
        <TextInput
          style={styles.createInput}
          placeholder="Address (optional)"
          placeholderTextColor={theme.colors.neutral[500]}
          value={newAddress}
          onChangeText={setNewAddress}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        <TouchableOpacity
          onPress={handleCreate}
          disabled={!newName.trim() || creating}
          style={[styles.createBtn, (!newName.trim() || creating) && styles.createBtnDisabled]}
        >
          <Text style={styles.createBtnText}>{creating ? "Creating…" : "Create space"}</Text>
        </TouchableOpacity>
      </View>

      {/* list */}
      {loading ? (
        <ActivityIndicator color={theme.colors.primary[400]} style={{ marginTop: 32 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error.message}</Text>
      ) : livingSpaces.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No living spaces yet. Create one above.</Text>
        </View>
      ) : (
        <FlatList
          data={livingSpaces}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <SpaceItem
              space={item}
              currentUserId={currentUserId}
              onUpdate={handleUpdate}
              onRemove={remove}
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
  },
  createBtnDisabled: {
    opacity: 0.4,
  },
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
    gap: theme.spacing[2],
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing[2],
  },
  spaceName: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.neutral[50],
  },
  spaceAddress: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing[2],
  },
  actionBtn: {
    paddingHorizontal: theme.spacing[1],
  },
  editBtn: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
  },
  deleteBtn: {
    fontSize: theme.fontSize.xs,
    color: "#f87171",
  },
  editInput: {
    backgroundColor: theme.colors.neutral[700],
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
    color: theme.colors.neutral[50],
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing[2],
  },
  editActions: {
    flexDirection: "row",
    gap: theme.spacing[3],
  },
  saveBtn: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary[400],
  },
  cancelBtn: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
  },
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

  // Members panel
  membersSection: {
    marginTop: theme.spacing[3],
    paddingTop: theme.spacing[3],
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[700],
    gap: theme.spacing[2],
  },
  noMembersText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[500],
  },
  membersList: {
    flexDirection: "row",
  },
  memberChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[1],
    marginRight: theme.spacing[2],
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
  },
  memberName: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[300],
  },
  removeChipBtn: {
    paddingHorizontal: 2,
  },
  removeChipText: {
    fontSize: theme.fontSize.base,
    color: "#f87171",
    lineHeight: 16,
  },
  memberActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing[2],
    marginTop: theme.spacing[1],
  },
  actionChip: {
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.neutral[600],
  },
  actionChipPrimary: {
    backgroundColor: theme.colors.primary[600],
    borderColor: theme.colors.primary[600],
  },
  actionChipText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[300],
  },
  actionChipTextPrimary: {
    fontSize: theme.fontSize.xs,
    color: "#fff",
  },
  disabled: {
    opacity: 0.4,
  },
  partnerPicker: {
    backgroundColor: theme.colors.neutral[700],
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
    marginTop: theme.spacing[1],
  },
  partnerPickerItem: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[600],
  },
  partnerPickerText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.neutral[100],
  },
});
