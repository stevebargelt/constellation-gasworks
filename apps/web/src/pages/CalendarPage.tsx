import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useCalendar, useConstellationGraph, useAuth } from "@constellation/hooks";
import { getRelationships, getUsersByIds } from "@constellation/api";
import type { CalendarEvent, VisibleCalendarEvent } from "@constellation/types";
import { useEffect } from "react";
import type { User } from "@constellation/types";

// ---------- helpers ----------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function toLocalInputValue(iso: string): string {
  // Returns "YYYY-MM-DDTHH:mm" suitable for datetime-local input
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// ---------- types ----------

type EventFormData = {
  title: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  location: string;
  description: string;
  is_private: boolean;
};

const emptyForm = (): EventFormData => {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  return {
    title: "",
    start_time: toLocalInputValue(now.toISOString()),
    end_time: toLocalInputValue(later.toISOString()),
    is_all_day: false,
    location: "",
    description: "",
    is_private: false,
  };
};

// ---------- EventModal ----------

interface EventModalProps {
  initialData?: VisibleCalendarEvent;
  isCreatorOwn: boolean;
  onSave: (data: Omit<CalendarEvent, "id" | "creator_id" | "created_at">) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

function EventModal({ initialData, isCreatorOwn, onSave, onDelete, onClose }: EventModalProps) {
  const [form, setForm] = useState<EventFormData>(
    initialData
      ? {
          title: initialData.title,
          start_time: toLocalInputValue(initialData.start_time),
          end_time: toLocalInputValue(initialData.end_time),
          is_all_day: initialData.is_all_day,
          location: initialData.location ?? "",
          description: initialData.description ?? "",
          is_private: initialData.is_private,
        }
      : emptyForm()
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [recurringChoice, setRecurringChoice] = useState<"this" | "all" | null>(null);
  const isRecurring = !!initialData?.recurrence_rule || !!initialData?.recurrence_parent_id;
  const isEdit = !!initialData;

  function set<K extends keyof EventFormData>(key: K, value: EventFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: form.title.trim(),
        start_time: new Date(form.start_time).toISOString(),
        end_time: form.is_all_day
          ? new Date(form.start_time).toISOString()
          : new Date(form.end_time).toISOString(),
        is_all_day: form.is_all_day,
        location: form.location.trim() || null,
        description: form.description.trim() || null,
        is_private: form.is_private,
        recurrence_rule: null,
        recurrence_parent_id: null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteClick() {
    if (isRecurring) {
      setRecurringChoice(null);
      setConfirmDelete(true);
    } else {
      setConfirmDelete(true);
    }
  }

  async function handleConfirmDelete() {
    if (onDelete) {
      // For recurring events, the API currently hard-deletes; choice is UI-only hint
      onDelete();
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? "Edit Event" : "New Event"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Event title"
            disabled={!isCreatorOwn && isEdit}
          />
        </div>

        {/* All-day toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_all_day}
            onChange={(e) => set("is_all_day", e.target.checked)}
            className="rounded"
            disabled={!isCreatorOwn && isEdit}
          />
          <span className="text-sm text-gray-300">All-day</span>
        </label>

        {/* Start */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Start *</label>
          <input
            type={form.is_all_day ? "date" : "datetime-local"}
            value={form.is_all_day ? form.start_time.slice(0, 10) : form.start_time}
            onChange={(e) => set("start_time", form.is_all_day ? e.target.value + "T00:00" : e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            disabled={!isCreatorOwn && isEdit}
          />
        </div>

        {/* End */}
        {!form.is_all_day && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">End *</label>
            <input
              type="datetime-local"
              value={form.end_time}
              onChange={(e) => set("end_time", e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              disabled={!isCreatorOwn && isEdit}
            />
          </div>
        )}

        {/* Location */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Location</label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Optional"
            disabled={!isCreatorOwn && isEdit}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Notes</label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
            placeholder="Optional"
            disabled={!isCreatorOwn && isEdit}
          />
        </div>

        {/* Private */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_private}
            onChange={(e) => set("is_private", e.target.checked)}
            className="rounded"
            disabled={!isCreatorOwn && isEdit}
          />
          <span className="text-sm text-gray-300">Private</span>
        </label>

        {/* Delete confirm */}
        {confirmDelete && (
          <div className="bg-red-900/30 border border-red-700 rounded p-3 space-y-2">
            {isRecurring && (
              <div className="space-y-1">
                <p className="text-sm text-red-300">This is a recurring event. Delete:</p>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="recChoice"
                    checked={recurringChoice === "this"}
                    onChange={() => setRecurringChoice("this")}
                  />
                  <span className="text-sm text-gray-300">This instance only</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="recChoice"
                    checked={recurringChoice === "all"}
                    onChange={() => setRecurringChoice("all")}
                  />
                  <span className="text-sm text-gray-300">All instances</span>
                </label>
              </div>
            )}
            {!isRecurring && (
              <p className="text-sm text-red-300">Delete this event? This cannot be undone.</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleConfirmDelete}
                disabled={isRecurring && !recurringChoice}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-sm text-white"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <div>
            {isEdit && isCreatorOwn && !confirmDelete && (
              <button
                onClick={handleDeleteClick}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
            >
              Cancel
            </button>
            {(isCreatorOwn || !isEdit) && (
              <button
                onClick={handleSave}
                disabled={!form.title.trim() || saving}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded text-sm text-white"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- EventCard ----------

const FALLBACK_COLOR = "#6366f1";

interface EventCardProps {
  event: VisibleCalendarEvent;
  personColor: string;
  isOwn: boolean;
  onEdit: () => void;
}

function EventCard({ event, personColor, isOwn, onEdit }: EventCardProps) {
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-750 cursor-pointer border border-gray-700 hover:border-gray-500 transition-colors"
      onClick={onEdit}
    >
      <div
        className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
        style={{ backgroundColor: personColor }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white truncate">{event.title}</p>
          {event.is_private && (
            <span className="text-xs text-gray-500">(private)</span>
          )}
          {isOwn && (
            <span className="text-xs text-gray-500 ml-auto">you</span>
          )}
        </div>
        {event.is_all_day ? (
          <p className="text-xs text-gray-400">{formatDate(event.start_time)} · All day</p>
        ) : (
          <p className="text-xs text-gray-400">
            {formatDate(event.start_time)} · {formatTime(event.start_time)} – {formatTime(event.end_time)}
          </p>
        )}
        {event.location && (
          <p className="text-xs text-gray-500 truncate">{event.location}</p>
        )}
      </div>
    </div>
  );
}

// ---------- CalendarPage ----------

export default function CalendarPage() {
  const { user: authUser } = useAuth();
  const { events, loading, create, update, remove } = useCalendar();
  const [connectionUsers, setConnectionUsers] = useState<User[]>([]);
  const { userColors } = useConstellationGraph(connectionUsers);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VisibleCalendarEvent | null>(null);

  useEffect(() => {
    if (!authUser) return;
    getRelationships().then((rels) => {
      const active = rels.filter((r) => r.status === "active");
      const ids = active.flatMap((r) =>
        r.user_a_id === authUser.id ? [r.user_b_id] : [r.user_a_id]
      );
      getUsersByIds([...new Set(ids)]).then(setConnectionUsers);
    });
  }, [authUser]);

  function getColor(creatorId: string): string {
    if (creatorId === authUser?.id) return FALLBACK_COLOR;
    return userColors.get(creatorId) ?? FALLBACK_COLOR;
  }

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(event: VisibleCalendarEvent) {
    setEditing(event);
    setModalOpen(true);
  }

  const handleSave = useCallback(
    async (data: Omit<CalendarEvent, "id" | "creator_id" | "created_at">) => {
      if (editing) {
        await update(editing.id, data);
      } else {
        await create(data);
      }
    },
    [editing, create, update]
  );

  const handleDelete = useCallback(() => {
    if (editing) {
      remove(editing.id);
    }
  }, [editing, remove]);

  // Sort events by start_time
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white text-sm">← Home</Link>
          <h1 className="text-xl font-semibold text-white">Calendar</h1>
          <Link to="/calendar/overlay" className="text-sm text-gray-400 hover:text-white">
            Overlay
          </Link>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded text-sm text-white"
        >
          + New Event
        </button>
      </div>

      {/* Event list */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">No events yet.</p>
          <button
            onClick={openNew}
            className="mt-3 text-primary-400 hover:text-primary-300 text-sm underline"
          >
            Create your first event
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              personColor={getColor(event.creator_id)}
              isOwn={event.creator_id === authUser?.id}
              onEdit={() => openEdit(event)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <EventModal
          initialData={editing ?? undefined}
          isCreatorOwn={!editing || editing.creator_id === authUser?.id}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
