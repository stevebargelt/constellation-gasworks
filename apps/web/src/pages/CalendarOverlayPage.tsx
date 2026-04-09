import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useAuth,
  useCalendar,
  useCalendarOverlay,
  useConstellationGraph,
} from "@constellation/hooks";
import { getRelationships, getUsersByIds, getRelationshipPermissions } from "@constellation/api";
import type { RelationshipPermission, User, VisibleCalendarEvent } from "@constellation/types";

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

const FALLBACK_COLOR = "#6366f1";

// ---------- types ----------

interface Partner {
  user: User;
  calendarPermission: "full" | "free_busy" | "none";
}

// ---------- PartnerLegend ----------

interface PartnerLegendProps {
  partners: Partner[];
  selectedIds: Set<string>;
  userColors: Map<string, string>;
  onToggle: (id: string) => void;
}

function PartnerLegend({ partners, selectedIds, userColors, onToggle }: PartnerLegendProps) {
  const visible = partners.filter((p) => p.calendarPermission !== "none");
  if (visible.length === 0) {
    return (
      <p className="text-xs text-gray-500">No partners with calendar access.</p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((p) => {
        const color = userColors.get(p.user.id) ?? FALLBACK_COLOR;
        const active = selectedIds.has(p.user.id);
        return (
          <button
            key={p.user.id}
            onClick={() => onToggle(p.user.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${
              active
                ? "border-transparent text-white"
                : "border-gray-600 text-gray-400 hover:text-white hover:border-gray-400"
            }`}
            style={active ? { backgroundColor: color, borderColor: color } : {}}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            {p.user.preferred_name ?? p.user.display_name}
            {p.calendarPermission === "free_busy" && (
              <span className="text-xs opacity-70">(free/busy)</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------- EventRow ----------

interface EventRowProps {
  event: VisibleCalendarEvent;
  color: string;
  ownerName: string;
  isOwn: boolean;
}

function EventRow({ event, color, ownerName, isOwn }: EventRowProps) {
  const isBusy = event.viewer_permission === "free_busy";
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800 border border-gray-700">
      <div
        className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium truncate ${isBusy ? "text-gray-400 italic" : "text-white"}`}>
            {event.title}
          </p>
          <span className="text-xs text-gray-500 ml-auto flex-shrink-0">{ownerName}</span>
        </div>
        {event.is_all_day ? (
          <p className="text-xs text-gray-400">{formatDate(event.start_time)} · All day</p>
        ) : (
          <p className="text-xs text-gray-400">
            {formatDate(event.start_time)} · {formatTime(event.start_time)} – {formatTime(event.end_time)}
          </p>
        )}
        {!isBusy && event.location && (
          <p className="text-xs text-gray-500 truncate">{event.location}</p>
        )}
      </div>
    </div>
  );
}

// ---------- CalendarOverlayPage ----------

export default function CalendarOverlayPage() {
  const { user: authUser } = useAuth();
  const { events: ownEvents, loading: ownLoading } = useCalendar();

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [connectionUsers, setConnectionUsers] = useState<User[]>([]);
  const { userColors } = useConstellationGraph(connectionUsers);

  // Load active partners and their calendar permissions
  useEffect(() => {
    if (!authUser) return;
    getRelationships().then(async (rels) => {
      const active = rels.filter((r) => r.status === "active");
      const partnerIds = active.flatMap((r) =>
        r.user_a_id === authUser.id ? [r.user_b_id] : [r.user_a_id]
      );
      const unique = [...new Set(partnerIds)];
      if (!unique.length) {
        setLoadingPartners(false);
        return;
      }

      const [users, ...permArrays] = await Promise.all([
        getUsersByIds(unique),
        ...active.map((r) => getRelationshipPermissions(r.id)),
      ]);

      const allPerms = permArrays.flat() as RelationshipPermission[];

      const partnerList: Partner[] = users.map((u) => {
        // Find the permission granted TO the current viewer by this partner
        const perm = allPerms.find(
          (p) =>
            p.grantor_id === u.id &&
            p.resource_type === "calendar"
        );
        return {
          user: u,
          calendarPermission: (perm?.level ?? "none") as "full" | "free_busy" | "none",
        };
      });

      setPartners(partnerList);
      setConnectionUsers(users);

      // Auto-select partners with at least free_busy permission
      const autoSelect = new Set(
        partnerList
          .filter((p) => p.calendarPermission !== "none")
          .map((p) => p.user.id)
      );
      setSelectedIds(autoSelect);
      setLoadingPartners(false);
    });
  }, [authUser]);

  // Only fetch overlay for selected IDs with non-none permission
  const overlayOwnerIds = useMemo(
    () =>
      partners
        .filter((p) => selectedIds.has(p.user.id) && p.calendarPermission !== "none")
        .map((p) => p.user.id),
    [partners, selectedIds]
  );

  const { eventsByOwner, loading: overlayLoading } = useCalendarOverlay(overlayOwnerIds);

  function togglePartner(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getColor(userId: string): string {
    if (userId === authUser?.id) return FALLBACK_COLOR;
    return userColors.get(userId) ?? FALLBACK_COLOR;
  }

  function getUserName(userId: string): string {
    if (userId === authUser?.id) return "you";
    const p = partners.find((p) => p.user.id === userId);
    return p?.user.preferred_name ?? p?.user.display_name ?? "?";
  }

  // Merge own events + overlay events, sort by start_time
  const allEvents: VisibleCalendarEvent[] = useMemo(() => {
    const overlay = overlayOwnerIds.flatMap((id) => eventsByOwner[id] ?? []);
    return [...ownEvents, ...overlay].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [ownEvents, eventsByOwner, overlayOwnerIds]);

  const loading = ownLoading || loadingPartners || overlayLoading;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/calendar" className="text-gray-400 hover:text-white text-sm">← Calendar</Link>
        <h1 className="text-xl font-semibold text-white">Overlay</h1>
      </div>

      {/* Partner selector */}
      <div className="mb-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Showing</p>
        <div className="flex flex-wrap gap-2">
          {/* Own toggle */}
          <button
            onClick={() => {/* own events always shown */}}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-transparent text-sm text-white cursor-default"
            style={{ backgroundColor: FALLBACK_COLOR }}
          >
            <span className="w-2 h-2 rounded-full bg-white flex-shrink-0" />
            You
          </button>
          {loadingPartners ? (
            <span className="text-xs text-gray-500">Loading partners…</span>
          ) : (
            <PartnerLegend
              partners={partners}
              selectedIds={selectedIds}
              userColors={userColors}
              onToggle={togglePartner}
            />
          )}
        </div>
      </div>

      {/* Event list */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : allEvents.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-12">No events to display.</p>
      ) : (
        <div className="space-y-2">
          {allEvents.map((event) => (
            <EventRow
              key={`${event.creator_id}-${event.id}`}
              event={event}
              color={getColor(event.creator_id)}
              ownerName={getUserName(event.creator_id)}
              isOwn={event.creator_id === authUser?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
