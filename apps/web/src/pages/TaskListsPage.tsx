import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, useRelationships, useTaskLists } from "@constellation/hooks";
import { getTaskListMembers, getUsersByIds } from "@constellation/api";
import type { TaskList, TaskListMember, User } from "@constellation/types";

// ---------- helpers ----------

function partnerIdOf(rel: { user_a_id: string; user_b_id: string }, myId: string): string {
  return rel.user_a_id === myId ? rel.user_b_id : rel.user_a_id;
}

// ---------- MemberList ----------

interface MemberListProps {
  members: TaskListMember[];
  userMap: Map<string, User>;
  creatorId: string;
  currentUserId: string;
  onRemove: (userId: string) => void;
}

function MemberList({ members, userMap, creatorId, currentUserId, onRemove }: MemberListProps) {
  if (members.length === 0) return <p className="text-xs text-gray-500">No members yet.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {members.map((m) => {
        const u = userMap.get(m.user_id);
        const name = u?.display_name ?? m.user_id.slice(0, 8);
        const canRemove = currentUserId === creatorId && m.user_id !== creatorId;
        return (
          <li key={m.user_id} className="flex items-center gap-1 bg-gray-700 rounded-full px-3 py-1 text-xs">
            <span>{name}</span>
            {canRemove && (
              <button
                onClick={() => onRemove(m.user_id)}
                className="ml-1 text-gray-400 hover:text-red-400"
                title="Remove member"
              >
                ×
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------- AddMemberDropdown ----------

interface AddMemberDropdownProps {
  partners: User[];
  existingMemberIds: Set<string>;
  onAdd: (userId: string) => void;
}

function AddMemberDropdown({ partners, existingMemberIds, onAdd }: AddMemberDropdownProps) {
  const [open, setOpen] = useState(false);
  const available = partners.filter((p) => !existingMemberIds.has(p.id));
  if (available.length === 0) return null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-indigo-400 hover:text-indigo-300"
      >
        + Add member
      </button>
      {open && (
        <div className="absolute top-5 left-0 z-20 bg-gray-800 border border-gray-700 rounded shadow-lg min-w-40">
          {available.map((p) => (
            <button
              key={p.id}
              onClick={() => { onAdd(p.id); setOpen(false); }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
            >
              {p.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- TaskListCard ----------

interface TaskListCardProps {
  list: TaskList;
  currentUserId: string;
  partners: User[];
  onUpdate: (id: string, title: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onAddMember: (listId: string, userId: string) => Promise<void>;
  onRemoveMember: (listId: string, userId: string) => Promise<void>;
}

function TaskListCard({
  list,
  currentUserId,
  partners,
  onUpdate,
  onRemove,
  onAddMember,
  onRemoveMember,
}: TaskListCardProps) {
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

  async function handleSave() {
    if (title.trim() && title.trim() !== list.title) {
      await onUpdate(list.id, title.trim());
    }
    setEditing(false);
  }

  async function handleAddMember(userId: string) {
    await onAddMember(list.id, userId);
    const ms = await getTaskListMembers(list.id);
    setMembers(ms);
    const ids = ms.map((m) => m.user_id).filter((id) => id !== currentUserId);
    if (ids.length) {
      const users = await getUsersByIds(ids);
      setUserMap(new Map(users.map((u) => [u.id, u])));
    }
  }

  async function handleRemoveMember(userId: string) {
    await onRemoveMember(list.id, userId);
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
  }

  const existingMemberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      {/* header */}
      <div className="flex items-start justify-between gap-2">
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
              autoFocus
            />
            <button onClick={handleSave} className="text-xs text-indigo-400 hover:text-indigo-300">Save</button>
            <button onClick={() => { setTitle(list.title); setEditing(false); }} className="text-xs text-gray-400 hover:text-gray-300">Cancel</button>
          </div>
        ) : (
          <Link
            to={`/tasks/${list.id}`}
            className="font-medium hover:text-indigo-300 flex-1"
          >
            {list.title}
          </Link>
        )}
        <div className="flex items-center gap-2 shrink-0">
          {isCreator && !editing && (
            <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-200">
              Edit
            </button>
          )}
          {isCreator && (
            <button
              onClick={() => {
                if (confirm(`Delete "${list.title}"? This cannot be undone.`)) onRemove(list.id);
              }}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* members */}
      <div className="space-y-2">
        <MemberList
          members={members}
          userMap={userMap}
          creatorId={list.creator_id}
          currentUserId={currentUserId}
          onRemove={handleRemoveMember}
        />
        {isCreator && (
          <AddMemberDropdown
            partners={partners}
            existingMemberIds={existingMemberIds}
            onAdd={handleAddMember}
          />
        )}
      </div>
    </div>
  );
}

// ---------- TaskListsPage ----------

export default function TaskListsPage() {
  const { user } = useAuth();
  const { taskLists, loading, error, create, update, remove, addMember, removeMember } = useTaskLists();
  const { relationships } = useRelationships();

  const [partners, setPartners] = useState<User[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // Load partner profiles for the member-sharing dropdown
  useEffect(() => {
    if (!user) return;
    const activeIds = relationships
      .filter((r) => r.status === "active")
      .map((r) => partnerIdOf(r, user.id));
    if (!activeIds.length) { setPartners([]); return; }
    getUsersByIds(activeIds).then(setPartners);
  }, [relationships, user]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    await create(newTitle.trim());
    setNewTitle("");
    setCreating(false);
  }

  if (loading) return <div className="p-8 text-gray-400">Loading task lists…</div>;
  if (error) return <div className="p-8 text-red-400">{error.message}</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      {/* nav */}
      <div className="flex items-center gap-4">
        <Link to="/" className="text-sm text-gray-400 hover:text-white">← Home</Link>
        <h1 className="text-xl font-bold">Task Lists</h1>
      </div>

      {/* create form */}
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm placeholder-gray-500"
          placeholder="New list title…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button
          type="submit"
          disabled={creating || !newTitle.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded text-sm font-medium"
        >
          Create
        </button>
      </form>

      {/* list */}
      {taskLists.length === 0 ? (
        <p className="text-gray-500 text-sm">No task lists yet. Create one above.</p>
      ) : (
        <div className="space-y-4">
          {taskLists.map((list) => (
            <TaskListCard
              key={list.id}
              list={list}
              currentUserId={user?.id ?? ""}
              partners={partners}
              onUpdate={(id, title) => update(id, { title })}
              onRemove={remove}
              onAddMember={addMember}
              onRemoveMember={removeMember}
            />
          ))}
        </div>
      )}
    </div>
  );
}
