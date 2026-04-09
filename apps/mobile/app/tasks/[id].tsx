import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Switch,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth, useTasks } from "@constellation/hooks";
import {
  getTaskList,
  getTaskListMembers,
  getUsersByIds,
  getUserColors,
  getRelationships,
} from "@constellation/api";
import type { Task, TaskList, TaskListMember, TaskStatus, User, UserColor } from "@constellation/types";
import { theme } from "../../src/theme";

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "complete"];
const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  complete: "Done",
};

function nextStatus(s: TaskStatus): TaskStatus {
  const idx = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

function partnerIdOf(rel: { user_a_id: string; user_b_id: string }, myId: string): string {
  return rel.user_a_id === myId ? rel.user_b_id : rel.user_a_id;
}

// ---------- TaskFormModal ----------

interface TaskFormModalProps {
  visible: boolean;
  task: Task | null; // null = create
  taskListId: string;
  currentUserId: string;
  listMembers: TaskListMember[];
  partnerIds: Set<string>;
  userMap: Map<string, User>;
  onSave: (data: Omit<Task, "id" | "creator_id" | "completed_at" | "updated_at"> | Partial<Omit<Task, "id" | "creator_id" | "updated_at">>) => Promise<void>;
  onClose: () => void;
}

function TaskFormModal({
  visible,
  task,
  taskListId,
  currentUserId,
  listMembers,
  partnerIds,
  userMap,
  onSave,
  onClose,
}: TaskFormModalProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ?? currentUserId);
  const [isPrivate, setIsPrivate] = useState(task?.is_private ?? false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setDueDate(task?.due_date ?? "");
      setAssigneeId(task?.assignee_id ?? currentUserId);
      setIsPrivate(task?.is_private ?? false);
    }
  }, [visible, task, currentUserId]);

  const assigneeOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [{ id: currentUserId, label: "Me" }];
    listMembers
      .filter((m) => m.user_id !== currentUserId && partnerIds.has(m.user_id))
      .forEach((m) => {
        const u = userMap.get(m.user_id);
        opts.push({ id: m.user_id, label: u?.display_name ?? m.user_id.slice(0, 8) });
      });
    return opts;
  }, [listMembers, partnerIds, userMap, currentUserId]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Title required");
      return;
    }
    setSaving(true);
    await onSave({
      task_list_id: taskListId,
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      assignee_id: assigneeId || null,
      status: task?.status ?? "todo",
      is_private: isPrivate,
    });
    setSaving(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <Text style={modal.heading}>{task ? "Edit Task" : "New Task"}</Text>
          <TextInput
            style={modal.input}
            placeholder="Title"
            placeholderTextColor={theme.colors.neutral[500]}
            value={title}
            onChangeText={setTitle}
            autoFocus={!task}
          />
          <TextInput
            style={[modal.input, { minHeight: 64 }]}
            placeholder="Description (optional)"
            placeholderTextColor={theme.colors.neutral[500]}
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <TextInput
            style={modal.input}
            placeholder="Due date (YYYY-MM-DD)"
            placeholderTextColor={theme.colors.neutral[500]}
            value={dueDate}
            onChangeText={setDueDate}
          />

          <Text style={modal.label}>Assign to</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {assigneeOptions.map((o) => (
                <TouchableOpacity
                  key={o.id}
                  style={[modal.chip, assigneeId === o.id && modal.chipActive]}
                  onPress={() => setAssigneeId(o.id)}
                >
                  <Text style={modal.chipText}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={modal.switchRow}>
            <Text style={modal.label}>Private</Text>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              thumbColor={isPrivate ? theme.colors.primary[400] : theme.colors.neutral[400]}
              trackColor={{ true: theme.colors.primary[700], false: theme.colors.neutral[700] }}
            />
          </View>

          <View style={modal.actions}>
            <TouchableOpacity
              style={[modal.btn, modal.btnPrimary, saving && modal.disabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={modal.btnText}>{saving ? "Saving…" : "Save"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[modal.btn, modal.btnSecondary]} onPress={onClose}>
              <Text style={modal.btnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------- TaskItem ----------

interface TaskItemProps {
  task: Task;
  currentUserId: string;
  userMap: Map<string, User>;
  colorMap: Map<string, string>;
  onSetStatus: (id: string, status: TaskStatus) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function TaskItem({ task, currentUserId, userMap, colorMap, onSetStatus, onEdit, onDelete }: TaskItemProps) {
  const assigneeName = task.assignee_id
    ? task.assignee_id === currentUserId
      ? "Me"
      : userMap.get(task.assignee_id)?.display_name ?? task.assignee_id.slice(0, 8)
    : null;
  const assigneeColor = task.assignee_id ? colorMap.get(task.assignee_id) : undefined;
  const isComplete = task.status === "complete";

  return (
    <View style={styles.taskCard}>
      <TouchableOpacity
        style={styles.statusBtn}
        onPress={() => onSetStatus(task.id, nextStatus(task.status))}
      >
        <Text style={[
          styles.statusBadge,
          task.status === "complete" && styles.statusComplete,
          task.status === "in_progress" && styles.statusInProgress,
        ]}>
          {STATUS_LABEL[task.status]}
        </Text>
      </TouchableOpacity>

      <View style={styles.taskContent}>
        <Text style={[styles.taskTitle, isComplete && styles.taskTitleDone]}>
          {task.title}
          {task.is_private && "  🔒"}
        </Text>
        {task.description ? (
          <Text style={styles.taskDesc} numberOfLines={1}>{task.description}</Text>
        ) : null}
        <View style={styles.taskMeta}>
          {task.due_date && (
            <Text style={styles.dueDateChip}>Due {task.due_date}</Text>
          )}
          {assigneeName && (
            <View style={styles.assigneeRow}>
              <View style={[styles.colorDot, { backgroundColor: assigneeColor ?? "#6b7280" }]} />
              <Text style={styles.assigneeName}>{assigneeName}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.taskActions}>
        <TouchableOpacity onPress={() => onEdit(task)} hitSlop={8}>
          <Text style={styles.actionEdit}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete(task)} hitSlop={8}>
          <Text style={styles.actionDelete}>Del</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------- Main Screen ----------

export default function TaskListDetailScreen() {
  const { id: taskListId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { tasks, loading, create, update, remove, setStatus } = useTasks(taskListId!);

  const [taskList, setTaskList] = useState<TaskList | null>(null);
  const [listMembers, setListMembers] = useState<TaskListMember[]>([]);
  const [userMap, setUserMap] = useState<Map<string, User>>(new Map());
  const [colorMap, setColorMap] = useState<Map<string, string>>(new Map());
  const [partnerIds, setPartnerIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!taskListId || !user) return;
    Promise.all([
      getTaskList(taskListId),
      getTaskListMembers(taskListId),
      getRelationships(),
      getUserColors(),
    ]).then(([list, members, rels, colors]) => {
      setTaskList(list);
      setListMembers(members);
      const active = rels.filter((r) => r.status === "active");
      const ids = active.flatMap((r) => partnerIdOf(r, user.id));
      setPartnerIds(new Set(ids));
      const cMap = new Map<string, string>();
      (colors as UserColor[]).forEach((c) => cMap.set(c.target_user_id, c.color));
      setColorMap(cMap);
      const allIds = [...new Set([...members.map((m) => m.user_id), ...ids])];
      if (allIds.length) {
        getUsersByIds(allIds).then((users) => {
          const m = new Map<string, User>();
          users.forEach((u) => m.set(u.id, u));
          setUserMap(m);
        });
      }
    });
  }, [taskListId, user]);

  const handleSave = async (data: Parameters<typeof create>[0]) => {
    if (editingTask) {
      await update(editingTask.id, data);
    } else {
      await create(data as Parameters<typeof create>[0]);
    }
    setModalOpen(false);
    setEditingTask(null);
  };

  const handleDelete = (task: Task) => {
    Alert.alert("Delete task", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove(task.id) },
    ]);
  };

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], complete: [] };
    tasks.forEach((t) => map[t.status].push(t));
    return map;
  }, [tasks]);

  const sections = STATUS_ORDER.flatMap((status) => {
    const group = grouped[status];
    if (group.length === 0) return [];
    return [{ status, items: group }];
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/tasks" as never)}>
          <Text style={styles.back}>← Lists</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{taskList?.title ?? "Tasks"}</Text>
        <TouchableOpacity onPress={() => { setEditingTask(null); setModalOpen(true); }}>
          <Text style={styles.addBtn}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary[400]} style={{ marginTop: 40 }} />
      ) : tasks.length === 0 ? (
        <Text style={styles.emptyText}>No tasks yet. Add one!</Text>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(s) => s.status}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          renderItem={({ item: section }) => (
            <View>
              <Text style={styles.sectionHeader}>
                {STATUS_LABEL[section.status]} ({section.items.length})
              </Text>
              {section.items.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  currentUserId={user?.id ?? ""}
                  userMap={userMap}
                  colorMap={colorMap}
                  onSetStatus={setStatus}
                  onEdit={(t) => { setEditingTask(t); setModalOpen(true); }}
                  onDelete={handleDelete}
                />
              ))}
            </View>
          )}
        />
      )}

      <TaskFormModal
        visible={modalOpen}
        task={editingTask}
        taskListId={taskListId!}
        currentUserId={user?.id ?? ""}
        listMembers={listMembers}
        partnerIds={partnerIds}
        userMap={userMap}
        onSave={handleSave}
        onClose={() => { setModalOpen(false); setEditingTask(null); }}
      />
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
  title: { color: theme.colors.neutral[50], fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center" },
  addBtn: { color: theme.colors.primary[400], fontSize: 14 },
  emptyText: { color: theme.colors.neutral[500], textAlign: "center", marginTop: 40 },
  sectionHeader: {
    color: theme.colors.neutral[500],
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  taskCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  statusBtn: { paddingTop: 2 },
  statusBadge: {
    color: theme.colors.neutral[300],
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: theme.colors.neutral[700],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  statusComplete: { backgroundColor: theme.colors.success?.[900] ?? "#14532d", color: theme.colors.success?.[300] ?? "#86efac" },
  statusInProgress: { backgroundColor: theme.colors.warning?.[900] ?? "#422006", color: theme.colors.warning?.[300] ?? "#fcd34d" },
  taskContent: { flex: 1 },
  taskTitle: { color: theme.colors.neutral[50], fontSize: 14, fontWeight: "600" },
  taskTitleDone: { textDecorationLine: "line-through", color: theme.colors.neutral[500] },
  taskDesc: { color: theme.colors.neutral[400], fontSize: 12, marginTop: 2 },
  taskMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  dueDateChip: {
    color: theme.colors.neutral[300],
    fontSize: 11,
    backgroundColor: theme.colors.neutral[700],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  assigneeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  assigneeName: { color: theme.colors.neutral[300], fontSize: 11 },
  taskActions: { gap: 6 },
  actionEdit: { color: theme.colors.neutral[400], fontSize: 12 },
  actionDelete: { color: theme.colors.error[400], fontSize: 12 },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: theme.colors.neutral[900],
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: 20,
    paddingBottom: 36,
    gap: 10,
  },
  heading: { color: theme.colors.neutral[50], fontSize: 16, fontWeight: "700" },
  label: { color: theme.colors.neutral[400], fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: theme.colors.neutral[700],
    color: theme.colors.neutral[50],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.neutral[700],
  },
  chipActive: { backgroundColor: theme.colors.primary[600] },
  chipText: { color: theme.colors.neutral[50], fontSize: 13 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: theme.borderRadius.md, alignItems: "center" },
  btnPrimary: { backgroundColor: theme.colors.primary[600] },
  btnSecondary: { backgroundColor: theme.colors.neutral[700] },
  disabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
