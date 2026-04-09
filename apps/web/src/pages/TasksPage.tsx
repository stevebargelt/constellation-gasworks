import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth, useTasks } from "@constellation/hooks";
import {
  getTaskList,
  getTaskListMembers,
  getUsersByIds,
  getUserColors,
  getRelationships,
} from "@constellation/api";
import type { Task, TaskList, TaskListMember, TaskStatus, User, UserColor } from "@constellation/types";

const ACTIVE_STATUSES: TaskStatus[] = ["todo", "in_progress"];
const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  complete: "Done",
};
const STATUS_STYLE: Record<TaskStatus, string> = {
  todo: "bg-gray-700 text-gray-300",
  in_progress: "bg-yellow-900 text-yellow-300",
  complete: "bg-green-900 text-green-300",
};

function nextStatus(s: TaskStatus): TaskStatus {
  const cycle: Record<TaskStatus, TaskStatus> = {
    todo: "in_progress",
    in_progress: "complete",
    complete: "todo",
  };
  return cycle[s];
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ---------- CreateTaskForm ----------

interface CreateTaskFormProps {
  taskListId: string;
  currentUserId: string;
  listMembers: TaskListMember[];
  partnerIds: Set<string>;
  userMap: Map<string, User>;
  onSave: (task: Omit<Task, "id" | "creator_id" | "completed_at" | "updated_at">) => Promise<void>;
  onCancel: () => void;
}

function CreateTaskForm({
  taskListId,
  currentUserId,
  listMembers,
  partnerIds,
  userMap,
  onSave,
  onCancel,
}: CreateTaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>(currentUserId);
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const assigneeOptions = useMemo(() => {
    const options: { id: string; label: string }[] = [
      { id: currentUserId, label: "Me" },
    ];
    listMembers
      .filter((m) => m.user_id !== currentUserId && partnerIds.has(m.user_id))
      .forEach((m) => {
        const u = userMap.get(m.user_id);
        options.push({ id: m.user_id, label: u?.display_name ?? m.user_id.slice(0, 8) });
      });
    return options;
  }, [listMembers, partnerIds, userMap, currentUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      task_list_id: taskListId,
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      assignee_id: assigneeId || null,
      status: "todo",
      is_private: isPrivate,
    });
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-200">New Task</h3>
      <div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoFocus
        />
      </div>
      <div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Assign to</label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none"
          >
            {assigneeOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="task-private"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="task-private" className="text-xs text-gray-400">Private task</label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded text-white"
        >
          {saving ? "Adding…" : "Add task"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------- TaskRow (active tasks) ----------

interface TaskRowProps {
  task: Task;
  currentUserId: string;
  listMembers: TaskListMember[];
  partnerIds: Set<string>;
  userMap: Map<string, User>;
  colorMap: Map<string, string>;
  onSetStatus: (id: string, status: TaskStatus) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Omit<Task, "id" | "creator_id" | "updated_at">>) => Promise<void>;
  onRemove: (id: string) => void;
}

function TaskRow({
  task,
  currentUserId,
  listMembers,
  partnerIds,
  userMap,
  colorMap,
  onSetStatus,
  onUpdate,
  onRemove,
}: TaskRowProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description ?? "");
  const [editDue, setEditDue] = useState(task.due_date ?? "");
  const [editAssignee, setEditAssignee] = useState(task.assignee_id ?? currentUserId);
  const [editPrivate, setEditPrivate] = useState(task.is_private);
  const [saving, setSaving] = useState(false);

  const assigneeOptions = useMemo(() => {
    const options: { id: string; label: string }[] = [
      { id: currentUserId, label: "Me" },
    ];
    listMembers
      .filter((m) => m.user_id !== currentUserId && partnerIds.has(m.user_id))
      .forEach((m) => {
        const u = userMap.get(m.user_id);
        options.push({ id: m.user_id, label: u?.display_name ?? m.user_id.slice(0, 8) });
      });
    return options;
  }, [listMembers, partnerIds, userMap, currentUserId]);

  const assigneeName = task.assignee_id
    ? task.assignee_id === currentUserId
      ? "Me"
      : userMap.get(task.assignee_id)?.display_name ?? task.assignee_id.slice(0, 8)
    : null;

  const assigneeColor = task.assignee_id ? colorMap.get(task.assignee_id) : undefined;

  const handleSave = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    await onUpdate(task.id, {
      title: editTitle.trim(),
      description: editDesc.trim() || null,
      due_date: editDue || null,
      assignee_id: editAssignee || null,
      is_private: editPrivate,
    });
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-gray-800 rounded-lg p-3 space-y-2">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none"
          autoFocus
        />
        <textarea
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          rows={2}
          className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none resize-none"
          placeholder="Description"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={editDue}
            onChange={(e) => setEditDue(e.target.value)}
            className="bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none"
          />
          <select
            value={editAssignee}
            onChange={(e) => setEditAssignee(e.target.value)}
            className="bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none"
          >
            {assigneeOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={editPrivate}
            onChange={(e) => setEditPrivate(e.target.checked)}
            id={`priv-${task.id}`}
          />
          <label htmlFor={`priv-${task.id}`} className="text-xs text-gray-400">Private</label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded text-white"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-3 flex items-start gap-3">
      {/* Status toggle */}
      <button
        onClick={() => onSetStatus(task.id, nextStatus(task.status))}
        className={`mt-0.5 shrink-0 px-2 py-0.5 text-xs rounded font-medium ${STATUS_STYLE[task.status]}`}
        title={`Status: ${STATUS_LABEL[task.status]} — click to advance`}
      >
        {STATUS_LABEL[task.status]}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">
          {task.title}
          {task.is_private && <span className="ml-1 text-xs text-gray-500">🔒</span>}
        </p>
        {task.description && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{task.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          {task.due_date && (
            <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
              Due {task.due_date}
            </span>
          )}
          {assigneeName && (
            <span className="flex items-center gap-1 text-xs text-gray-300">
              <span
                className="inline-block w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: assigneeColor ?? "#6b7280" }}
              />
              {assigneeName}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-gray-400 hover:text-white"
        >
          Edit
        </button>
        <button
          onClick={() => onRemove(task.id)}
          className="text-xs text-red-500 hover:text-red-400"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ---------- HistoryRow (completed tasks) ----------

interface HistoryRowProps {
  task: Task;
  currentUserId: string;
  userMap: Map<string, User>;
  colorMap: Map<string, string>;
  onReopen: (id: string) => Promise<void>;
}

function HistoryRow({ task, currentUserId, userMap, colorMap, onReopen }: HistoryRowProps) {
  const [reopening, setReopening] = useState(false);

  const assigneeName = task.assignee_id
    ? task.assignee_id === currentUserId
      ? "Me"
      : userMap.get(task.assignee_id)?.display_name ?? task.assignee_id.slice(0, 8)
    : null;
  const assigneeColor = task.assignee_id ? colorMap.get(task.assignee_id) : undefined;

  const handleReopen = async () => {
    setReopening(true);
    await onReopen(task.id);
    setReopening(false);
  };

  return (
    <div className="bg-gray-800/60 rounded-lg p-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-500 line-through">
          {task.title}
          {task.is_private && <span className="ml-1 text-xs">🔒</span>}
        </p>
        {task.description && (
          <p className="text-xs text-gray-600 mt-0.5 truncate">{task.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {task.completed_at && (
            <span className="text-xs text-gray-500">
              Completed {formatDate(task.completed_at)}
            </span>
          )}
          {assigneeName && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span
                className="inline-block w-3 h-3 rounded-full shrink-0 opacity-60"
                style={{ backgroundColor: assigneeColor ?? "#6b7280" }}
              />
              {assigneeName}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={handleReopen}
        disabled={reopening}
        className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
      >
        {reopening ? "…" : "Reopen"}
      </button>
    </div>
  );
}

// ---------- TasksPage ----------

type Tab = "active" | "history";

export default function TasksPage() {
  const { id: taskListId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { tasks, loading, create, update, remove, setStatus } = useTasks(taskListId!);

  const [taskList, setTaskList] = useState<TaskList | null>(null);
  const [listMembers, setListMembers] = useState<TaskListMember[]>([]);
  const [userMap, setUserMap] = useState<Map<string, User>>(new Map());
  const [colorMap, setColorMap] = useState<Map<string, string>>(new Map());
  const [partnerIds, setPartnerIds] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<Tab>("active");

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
      const ids = active.flatMap((r) =>
        r.user_a_id === user.id ? [r.user_b_id] : [r.user_a_id]
      );
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

  const handleDelete = (id: string) => {
    if (!confirm("Delete this task?")) return;
    remove(id);
  };

  const handleReopen = async (id: string) => {
    await setStatus(id, "todo");
  };

  const { activeTasks, completedTasks } = useMemo(() => {
    const activeTasks: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], complete: [] };
    const completedTasks: Task[] = [];
    tasks.forEach((t) => {
      if (t.status === "complete") {
        completedTasks.push(t);
      } else {
        activeTasks[t.status].push(t);
      }
    });
    completedTasks.sort((a, b) => {
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return bTime - aTime;
    });
    return { activeTasks, completedTasks };
  }, [tasks]);

  const completedCount = completedTasks.length;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/tasks" className="text-xs text-gray-500 hover:text-gray-300">← Task Lists</Link>
          <h1 className="text-xl font-bold text-white mt-1">
            {taskList?.title ?? "Tasks"}
          </h1>
        </div>
        {tab === "active" && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 rounded text-white"
          >
            + Add task
          </button>
        )}
      </div>

      {/* Tab toggle */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "active"
              ? "border-indigo-500 text-white"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "history"
              ? "border-indigo-500 text-white"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          History {completedCount > 0 && <span className="ml-1 text-xs text-gray-500">({completedCount})</span>}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : tab === "active" ? (
        <>
          {showCreate && (
            <CreateTaskForm
              taskListId={taskListId!}
              currentUserId={user?.id ?? ""}
              listMembers={listMembers}
              partnerIds={partnerIds}
              userMap={userMap}
              onSave={async (task) => { await create(task); setShowCreate(false); }}
              onCancel={() => setShowCreate(false)}
            />
          )}
          {ACTIVE_STATUSES.every((s) => activeTasks[s].length === 0) && !showCreate ? (
            <p className="text-gray-500 text-sm">No active tasks. Add one or check History.</p>
          ) : (
            ACTIVE_STATUSES.map((status) => {
              const group = activeTasks[status];
              if (group.length === 0) return null;
              return (
                <div key={status}>
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {STATUS_LABEL[status]} ({group.length})
                  </h2>
                  <div className="space-y-2">
                    {group.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        currentUserId={user?.id ?? ""}
                        listMembers={listMembers}
                        partnerIds={partnerIds}
                        userMap={userMap}
                        colorMap={colorMap}
                        onSetStatus={setStatus}
                        onUpdate={update}
                        onRemove={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </>
      ) : (
        /* History tab */
        completedTasks.length === 0 ? (
          <p className="text-gray-500 text-sm">No completed tasks yet.</p>
        ) : (
          <div className="space-y-2">
            {completedTasks.map((task) => (
              <HistoryRow
                key={task.id}
                task={task}
                currentUserId={user?.id ?? ""}
                userMap={userMap}
                colorMap={colorMap}
                onReopen={handleReopen}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
