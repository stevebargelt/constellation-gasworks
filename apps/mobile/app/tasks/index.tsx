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
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth, useRelationships, useTaskLists } from "@constellation/hooks";
import { getTaskListMembers, getUsersByIds } from "@constellation/api";
import type { TaskList, TaskListMember, User } from "@constellation/types";
import { theme } from "../../src/theme";

// ---------- helpers ----------

function partnerIdOf(rel: { user_a_id: string; user_b_id: string }, myId: string): string {
  return rel.user_a_id === myId ? rel.user_b_id : rel.user_a_id;
}

// ---------- MemberChips ----------

interface MemberChipsProps {
  members: TaskListMember[];
  userMap: Map<string, User>;
  creatorId: string;
  currentUserId: string;
  onRemove: (userId: string) => void;
}

function MemberChips({ members, userMap, creatorId, currentUserId, onRemove }: MemberChipsProps) {
  if (!members.length) return null;
  return (
    <View style={styles.chipsRow}>
      {members.map((m) => {
        const u = userMap.get(m.user_id);
        const name = u?.display_name ?? m.user_id.slice(0, 8);
        const canRemove = currentUserId === creatorId && m.user_id !== creatorId;
        return (
          <View key={m.user_id} style={styles.chip}>
            <Text style={styles.chipText}>{name}</Text>
            {canRemove && (
              <TouchableOpacity onPress={() => onRemove(m.user_id)} hitSlop={8}>
                <Text style={styles.chipRemove}> ×</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ---------- TaskListItem ----------

interface TaskListItemProps {
  list: TaskList;
  currentUserId: string;
  partners: User[];
  onUpdate: (id: string, title: string) => Promise<void>;
  onRemove: (id: string) => void;
  onAddMember: (listId: string, userId: string) => Promise<void>;
  onRemoveMember: (listId: string, userId: string) => Promise<void>;
  onOpenList: (id: string) => void;
}

function TaskListItem({
  list,
  currentUserId,
  partners,
  onUpdate,
  onRemove,
  onAddMember,
  onRemoveMember,
  onOpenList,
}: TaskListItemProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [members, setMembers] = useState<TaskListMember[]>([]);
  const [userMap, setUserMap] = useState<Map<string, User>>(new Map());
  const isCreator = currentUserId === list.creator_id;

  useEffect(() => {
    getTaskListMembers(list.id).then(async (ms) => {
      setMembers(ms);
      const ids = ms.map((m) => m.user_id).filter((id) => id !== currentUserId);
      if (ids.length) {
        const users = await getUsersByIds(ids);
        setUserMap(new Map(users.map((u) => [u.id, u])));
      }
    });
  }, [list.id, currentUserId]);

  async function saveTitle() {
    const trimmed = title.trim();
    if (trimmed && trimmed !== list.title) await onUpdate(list.id, trimmed);
    setEditing(false);
  }

  function confirmDelete() {
    Alert.alert(
      "Delete list",
      `Delete "${list.title}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onRemove(list.id) },
      ]
    );
  }

  function promptAddMember() {
    const existingIds = new Set(members.map((m) => m.user_id));
    const available = partners.filter((p) => !existingIds.has(p.id));
    if (!available.length) {
      Alert.alert("No partners available", "All your active partners are already members.");
      return;
    }
    const options = available.map((p) => ({
      text: p.display_name,
      onPress: async () => {
        await onAddMember(list.id, p.id);
        const ms = await getTaskListMembers(list.id);
        setMembers(ms);
        const ids = ms.map((m) => m.user_id).filter((id) => id !== currentUserId);
        if (ids.length) {
          const users = await getUsersByIds(ids);
          setUserMap(new Map(users.map((u) => [u.id, u])));
        }
      },
    }));
    Alert.alert("Add member", "Choose a partner to add:", [
      ...options,
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function handleRemoveMember(userId: string) {
    await onRemoveMember(list.id, userId);
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
  }

  return (
    <View style={styles.card}>
      {/* title row */}
      {editing ? (
        <View style={styles.editRow}>
          <TextInput
            style={styles.editInput}
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={saveTitle}
            autoFocus
            returnKeyType="done"
          />
          <TouchableOpacity onPress={saveTitle}>
            <Text style={styles.saveBtn}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setTitle(list.title); setEditing(false); }}>
            <Text style={styles.cancelBtn}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.titleRow}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => onOpenList(list.id)}>
            <Text style={styles.listTitle}>{list.title}</Text>
          </TouchableOpacity>
          {isCreator && (
            <TouchableOpacity onPress={() => setEditing(true)} style={styles.actionBtn}>
              <Text style={styles.editBtn}>Edit</Text>
            </TouchableOpacity>
          )}
          {isCreator && (
            <TouchableOpacity onPress={confirmDelete} style={styles.actionBtn}>
              <Text style={styles.deleteBtn}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* members */}
      <MemberChips
        members={members}
        userMap={userMap}
        creatorId={list.creator_id}
        currentUserId={currentUserId}
        onRemove={handleRemoveMember}
      />
      {isCreator && (
        <TouchableOpacity onPress={promptAddMember} style={styles.addMemberBtn}>
          <Text style={styles.addMemberText}>+ Add member</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------- TaskListsScreen ----------

export default function TaskListsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { taskLists, loading, error, create, update, remove, addMember, removeMember } = useTaskLists();
  const { relationships } = useRelationships();
  const [partners, setPartners] = useState<User[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const activeIds = relationships
      .filter((r) => r.status === "active")
      .map((r) => partnerIdOf(r, user.id));
    if (!activeIds.length) { setPartners([]); return; }
    getUsersByIds(activeIds).then(setPartners);
  }, [relationships, user]);

  async function handleCreate() {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    await create(newTitle.trim());
    setNewTitle("");
    setCreating(false);
  }

  return (
    <View style={styles.container}>
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Task Lists</Text>
      </View>

      {/* create row */}
      <View style={styles.createRow}>
        <TextInput
          style={styles.createInput}
          placeholder="New list title…"
          placeholderTextColor={theme.colors.neutral[500]}
          value={newTitle}
          onChangeText={setNewTitle}
          onSubmitEditing={handleCreate}
          returnKeyType="done"
        />
        <TouchableOpacity
          onPress={handleCreate}
          disabled={creating || !newTitle.trim()}
          style={[styles.createBtn, (!newTitle.trim() || creating) && styles.createBtnDisabled]}
        >
          <Text style={styles.createBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      {/* list */}
      {loading ? (
        <ActivityIndicator color={theme.colors.primary[400]} style={{ marginTop: 32 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error.message}</Text>
      ) : taskLists.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No task lists yet. Create one above.</Text>
        </View>
      ) : (
        <FlatList
          data={taskLists}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TaskListItem
              list={item}
              currentUserId={user?.id ?? ""}
              partners={partners}
              onUpdate={(id, title) => update(id, { title })}
              onRemove={remove}
              onAddMember={addMember}
              onRemoveMember={removeMember}
              onOpenList={(id) => router.push(`/tasks/${id}`)}
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
  createRow: {
    flexDirection: "row",
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[3],
  },
  createInput: {
    flex: 1,
    backgroundColor: theme.colors.neutral[800],
    borderWidth: 1,
    borderColor: theme.colors.neutral[700],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    color: theme.colors.neutral[50],
    fontSize: theme.fontSize.sm,
  },
  createBtn: {
    backgroundColor: theme.colors.primary[600],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
    justifyContent: "center",
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  listTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.neutral[50],
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
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  editInput: {
    flex: 1,
    backgroundColor: theme.colors.neutral[700],
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
    color: theme.colors.neutral[50],
    fontSize: theme.fontSize.sm,
  },
  saveBtn: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary[400],
  },
  cancelBtn: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing[2],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.neutral[700],
    borderRadius: 999,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
  },
  chipText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[200],
  },
  chipRemove: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
  },
  addMemberBtn: {
    alignSelf: "flex-start",
  },
  addMemberText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary[400],
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
});
