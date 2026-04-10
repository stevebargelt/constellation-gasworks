import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, useCalendar, useCalendarOverlay, useConstellationGraph } from "@constellation/hooks";
import { getRelationships, getUsersByIds, getRelationshipPermissions } from "@constellation/api";
import type { RelationshipPermission, User, VisibleCalendarEvent } from "@constellation/types";

// ---------- types ----------

type ViewMode = "month" | "week" | "day";

// ---------- date helpers ----------

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day;
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  return (
    start.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " – " +
    end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  );
}

function formatDayFull(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function eventFallsOnDay(event: VisibleCalendarEvent, day: Date): boolean {
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  // For all-day events end equals start; include multi-day
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86400000 - 1);
  return start <= dayEnd && end >= dayStart;
}

const SELF_COLOR = "#94a3b8";   // slate-400 — reserved for the current user
const FALLBACK_COLOR = "#6366f1"; // used when a partner has no assigned color yet
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------- EventPill ----------

interface EventPillProps {
  event: VisibleCalendarEvent;
  color: string;
  onClick: () => void;
  compact?: boolean;
  ownerName?: string;
}

function EventPill({ event, color, onClick, compact, ownerName }: EventPillProps) {
  const isBusy = event.viewer_permission === "free_busy";
  const label = isBusy && ownerName ? `${ownerName}: Busy` : event.title;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-full text-left rounded px-1 py-0.5 text-xs truncate hover:opacity-80 transition-opacity"
      style={{ backgroundColor: color + "33", borderLeft: `2px solid ${color}`, color }}
      title={label}
    >
      {!compact && !event.is_all_day && (
        <span className="opacity-75 mr-1">{formatTime(event.start_time)}</span>
      )}
      <span className={isBusy ? "italic" : ""}>{label}</span>
    </button>
  );
}

// ---------- MonthView ----------

interface MonthViewProps {
  anchor: Date;
  events: VisibleCalendarEvent[];
  getColor: (creatorId: string) => string;
  getOwnerName: (creatorId: string) => string | undefined;
  onDayClick: (d: Date) => void;
  onEventClick: (e: VisibleCalendarEvent) => void;
  today: Date;
}

function MonthView({ anchor, events, getColor, getOwnerName, onDayClick, onEventClick, today }: MonthViewProps) {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);

  // Build 6 weeks grid
  const weeks: Date[][] = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  // Group events by date key
  const eventsByDay = useMemo(() => {
    const map: Record<string, VisibleCalendarEvent[]> = {};
    for (const ev of events) {
      const start = new Date(ev.start_time);
      const end = new Date(ev.end_time);
      // For each day the event spans
      let d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const limit = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      while (d <= limit) {
        const k = dateKey(d);
        if (!map[k]) map[k] = [];
        map[k].push(ev);
        d = addDays(d, 1);
      }
    }
    return map;
  }, [events]);

  return (
    <div className="flex flex-col flex-1">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-800">
        {DAY_NAMES.map((n) => (
          <div key={n} className="py-2 text-center text-xs text-gray-500 font-medium">{n}</div>
        ))}
      </div>
      {/* Grid */}
      <div className="flex-1 grid grid-rows-6">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-gray-800">
            {week.map((day, di) => {
              const inMonth = day.getMonth() === anchor.getMonth();
              const isToday = sameDay(day, today);
              const key = dateKey(day);
              const dayEvents = (eventsByDay[key] ?? []).slice(0, 3);
              const overflow = (eventsByDay[key]?.length ?? 0) - 3;
              return (
                <div
                  key={di}
                  className={`border-r border-gray-800 p-1 cursor-pointer hover:bg-gray-800/50 min-h-[80px] ${
                    !inMonth ? "opacity-40" : ""
                  }`}
                  onClick={() => onDayClick(day)}
                >
                  <div className="flex items-center justify-center mb-1">
                    <span
                      className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? "bg-primary-600 text-white font-semibold"
                          : "text-gray-300"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.map((ev) => (
                      <EventPill
                        key={ev.id}
                        event={ev}
                        color={getColor(ev.creator_id)}
                        onClick={() => onEventClick(ev)}
                        compact
                        ownerName={getOwnerName(ev.creator_id)}
                      />
                    ))}
                    {overflow > 0 && (
                      <p className="text-xs text-gray-500 px-1">+{overflow} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- WeekView ----------

interface WeekViewProps {
  anchor: Date;
  events: VisibleCalendarEvent[];
  getColor: (creatorId: string) => string;
  getOwnerName: (creatorId: string) => string | undefined;
  onEventClick: (e: VisibleCalendarEvent) => void;
  onDayClick: (d: Date) => void;
  today: Date;
}

function WeekView({ anchor, events, getColor, getOwnerName, onEventClick, onDayClick, today }: WeekViewProps) {
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-800 flex-shrink-0">
        {days.map((day, i) => {
          const isToday = sameDay(day, today);
          return (
            <div
              key={i}
              className="py-2 text-center cursor-pointer hover:bg-gray-800/50"
              onClick={() => onDayClick(day)}
            >
              <div className="text-xs text-gray-500">{DAY_NAMES[day.getDay()]}</div>
              <div
                className={`text-sm font-medium mx-auto w-7 h-7 flex items-center justify-center rounded-full ${
                  isToday ? "bg-primary-600 text-white" : "text-gray-200"
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Events per day */}
      <div className="grid grid-cols-7 flex-1 border-b border-gray-800">
        {days.map((day, di) => {
          const dayEvents = events.filter((ev) => eventFallsOnDay(ev, day));
          return (
            <div key={di} className="border-r border-gray-800 p-1 space-y-1 min-h-[200px]">
              {dayEvents.map((ev) => (
                <EventPill
                  key={ev.id}
                  event={ev}
                  color={getColor(ev.creator_id)}
                  onClick={() => onEventClick(ev)}
                  ownerName={getOwnerName(ev.creator_id)}
                />
              ))}
              {dayEvents.length === 0 && (
                <div className="h-full" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- DayView ----------

const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface DayViewProps {
  anchor: Date;
  events: VisibleCalendarEvent[];
  getColor: (creatorId: string) => string;
  getOwnerName: (creatorId: string) => string | undefined;
  onEventClick: (e: VisibleCalendarEvent) => void;
}

function DayView({ anchor, events, getColor, getOwnerName, onEventClick }: DayViewProps) {
  const dayEvents = events.filter((ev) => eventFallsOnDay(ev, anchor));
  const allDay = dayEvents.filter((ev) => ev.is_all_day);
  const timed = dayEvents.filter((ev) => !ev.is_all_day);

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* All-day events */}
      {allDay.length > 0 && (
        <div className="border-b border-gray-800 p-2 space-y-1">
          <span className="text-xs text-gray-500">All day</span>
          {allDay.map((ev) => (
            <EventPill key={ev.id} event={ev} color={getColor(ev.creator_id)} onClick={() => onEventClick(ev)} compact ownerName={getOwnerName(ev.creator_id)} />
          ))}
        </div>
      )}

      {/* Time slots */}
      <div className="flex-1">
        {HOURS.map((hour) => {
          const hourEvents = timed.filter((ev) => {
            const h = new Date(ev.start_time).getHours();
            return h === hour;
          });
          return (
            <div key={hour} className="flex border-b border-gray-800/50 min-h-[48px]">
              <div className="w-14 flex-shrink-0 text-right pr-2 pt-1">
                <span className="text-xs text-gray-500">
                  {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                </span>
              </div>
              <div className="flex-1 p-1 space-y-1">
                {hourEvents.map((ev) => (
                  <EventPill key={ev.id} event={ev} color={getColor(ev.creator_id)} onClick={() => onEventClick(ev)} ownerName={getOwnerName(ev.creator_id)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- CalendarViewPage ----------

export default function CalendarViewPage() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const today = useMemo(() => new Date(), []);

  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  // Own events
  const { events: ownEvents, loading: ownLoading } = useCalendar();

  // Partners for overlay
  const [overlayIds, setOverlayIds] = useState<string[]>([]);
  const [connectionUsers, setConnectionUsers] = useState<User[]>([]);
  const { userColors } = useConstellationGraph(connectionUsers);
  const [overlayEnabled, setOverlayEnabled] = useState(true);

  useEffect(() => {
    if (!authUser) return;
    getRelationships().then(async (rels) => {
      const active = rels.filter((r) => r.status === "active");
      const ids = active.flatMap((r) =>
        r.user_a_id === authUser.id ? [r.user_b_id] : [r.user_a_id]
      );
      const unique = [...new Set(ids)];
      if (!unique.length) return;

      const [users, ...permArrays] = await Promise.all([
        getUsersByIds(unique),
        ...active.map((r) => getRelationshipPermissions(r.id)),
      ]);
      const allPerms = permArrays.flat() as RelationshipPermission[];

      setConnectionUsers(users);
      const visibleIds = users
        .filter((u) => {
          const p = allPerms.find((p) => p.grantor_id === u.id && p.resource_type === "calendar");
          return p && p.level !== "none";
        })
        .map((u) => u.id);
      setOverlayIds(visibleIds);
    });
  }, [authUser]);

  const { eventsByOwner, loading: overlayLoading } = useCalendarOverlay(
    overlayEnabled ? overlayIds : []
  );

  const allEvents: VisibleCalendarEvent[] = useMemo(() => {
    const overlay = overlayIds.flatMap((id) => eventsByOwner[id] ?? []);
    return [...ownEvents, ...(overlayEnabled ? overlay : [])];
  }, [ownEvents, eventsByOwner, overlayIds, overlayEnabled]);

  function getColor(creatorId: string): string {
    if (creatorId === authUser?.id) return SELF_COLOR;
    return userColors.get(creatorId) ?? FALLBACK_COLOR;
  }

  function getOwnerName(creatorId: string): string | undefined {
    if (creatorId === authUser?.id) return undefined;
    return connectionUsers.find((u) => u.id === creatorId)?.display_name;
  }

  // Navigation
  function goToday() {
    setAnchor(new Date());
  }

  function goPrev() {
    setAnchor((a) => {
      if (view === "month") return new Date(a.getFullYear(), a.getMonth() - 1, 1);
      if (view === "week") return addDays(a, -7);
      return addDays(a, -1);
    });
  }

  function goNext() {
    setAnchor((a) => {
      if (view === "month") return new Date(a.getFullYear(), a.getMonth() + 1, 1);
      if (view === "week") return addDays(a, 7);
      return addDays(a, 1);
    });
  }

  function handleDayClick(d: Date) {
    setAnchor(d);
    setView("day");
  }

  function handleEventClick(ev: VisibleCalendarEvent) {
    navigate(`/calendar?edit=${ev.id}`);
  }

  // Title
  const title = useMemo(() => {
    if (view === "month") return formatMonthYear(anchor);
    if (view === "week") return formatWeekRange(startOfWeek(anchor));
    return formatDayFull(anchor);
  }, [view, anchor]);

  const loading = ownLoading || overlayLoading;

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/calendar/list" className="text-gray-400 hover:text-white text-sm">← List</Link>
          <button
            onClick={goToday}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Today
          </button>
          <div className="flex items-center gap-1">
            <button onClick={goPrev} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white">‹</button>
            <button onClick={goNext} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white">›</button>
          </div>
          <span className="text-sm font-medium text-gray-200">{title}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Overlay toggle */}
          {overlayIds.length > 0 && (
            <button
              onClick={() => setOverlayEnabled((v) => !v)}
              className={`text-sm px-3 py-1.5 rounded border transition-colors ${
                overlayEnabled
                  ? "border-primary-500 text-primary-400 bg-primary-500/10"
                  : "border-gray-600 text-gray-500 hover:border-gray-400"
              }`}
            >
              Overlay
            </button>
          )}

          {/* View switcher */}
          <div className="flex rounded overflow-hidden border border-gray-700">
            {(["month", "week", "day"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm capitalize transition-colors ${
                  view === v
                    ? "bg-primary-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* People legend */}
      {(authUser || connectionUsers.length > 0) && (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-800 flex-shrink-0 flex-wrap">
          {authUser && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: SELF_COLOR }} />
              <span className="text-xs text-gray-300">You</span>
            </div>
          )}
          {connectionUsers.map((u) => (
            <div key={u.id} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: userColors.get(u.id) ?? FALLBACK_COLOR }} />
              <span className="text-xs text-gray-300">{u.display_name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Calendar body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      ) : (
        <>
          {view === "month" && (
            <MonthView
              anchor={anchor}
              events={allEvents}
              getColor={getColor}
              getOwnerName={getOwnerName}
              onDayClick={handleDayClick}
              onEventClick={handleEventClick}
              today={today}
            />
          )}
          {view === "week" && (
            <WeekView
              anchor={anchor}
              events={allEvents}
              getColor={getColor}
              getOwnerName={getOwnerName}
              onEventClick={handleEventClick}
              onDayClick={handleDayClick}
              today={today}
            />
          )}
          {view === "day" && (
            <DayView
              anchor={anchor}
              events={allEvents}
              getColor={getColor}
              getOwnerName={getOwnerName}
              onEventClick={handleEventClick}
            />
          )}
        </>
      )}
    </div>
  );
}
