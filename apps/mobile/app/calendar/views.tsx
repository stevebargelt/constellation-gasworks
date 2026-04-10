import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import {
  useAuth,
  useCalendar,
  useCalendarOverlay,
  useConstellationGraph,
} from "@constellation/hooks";
import { getRelationships, getUsersByIds, getRelationshipPermissions } from "@constellation/api";
import type { RelationshipPermission, User, VisibleCalendarEvent } from "@constellation/types";
import { theme } from "../../src/theme";

const FALLBACK_COLOR = theme.colors.primary[500];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const SCREEN_WIDTH = Dimensions.get("window").width;
const CELL_WIDTH = Math.floor((SCREEN_WIDTH - 16) / 7);

// ---------- helpers ----------

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfWeek(d: Date): Date {
  const diff = d.getDate() - d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function eventFallsOnDay(ev: VisibleCalendarEvent, day: Date): boolean {
  const start = new Date(ev.start_time);
  const end = new Date(ev.end_time);
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86400000 - 1);
  return start <= dayEnd && end >= dayStart;
}

type ViewMode = "month" | "day";

// ---------- MonthGrid ----------

interface MonthGridProps {
  anchor: Date;
  events: VisibleCalendarEvent[];
  getColor: (id: string) => string;
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  today: Date;
}

function MonthGrid({ anchor, events, getColor, selectedDay, onSelectDay, today }: MonthGridProps) {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);

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

  const eventsByDay = useMemo(() => {
    const map: Record<string, VisibleCalendarEvent[]> = {};
    for (const ev of events) {
      const start = new Date(ev.start_time);
      const end = new Date(ev.end_time);
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
    <View>
      {/* Day names */}
      <View style={gridStyles.headerRow}>
        {DAY_NAMES.map((n) => (
          <View key={n} style={[gridStyles.cell, { width: CELL_WIDTH }]}>
            <Text style={gridStyles.dayName}>{n}</Text>
          </View>
        ))}
      </View>
      {/* Weeks */}
      {weeks.map((week, wi) => (
        <View key={wi} style={gridStyles.weekRow}>
          {week.map((day, di) => {
            const inMonth = day.getMonth() === anchor.getMonth();
            const isToday = sameDay(day, today);
            const isSelected = sameDay(day, selectedDay);
            const k = dateKey(day);
            const dayEvents = eventsByDay[k] ?? [];
            return (
              <TouchableOpacity
                key={di}
                style={[gridStyles.cell, { width: CELL_WIDTH }]}
                onPress={() => onSelectDay(day)}
              >
                <View style={[
                  gridStyles.dayNum,
                  isToday && gridStyles.dayNumToday,
                  isSelected && !isToday && gridStyles.dayNumSelected,
                ]}>
                  <Text style={[
                    gridStyles.dayText,
                    !inMonth && gridStyles.dayTextFaded,
                    (isToday || isSelected) && gridStyles.dayTextActive,
                  ]}>
                    {day.getDate()}
                  </Text>
                </View>
                {/* Event dots */}
                <View style={gridStyles.dots}>
                  {dayEvents.slice(0, 3).map((ev, i) => (
                    <View
                      key={i}
                      style={[gridStyles.dot, { backgroundColor: getColor(ev.creator_id) }]}
                    />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const gridStyles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
  },
  weekRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.neutral[800],
  },
  cell: {
    alignItems: "center",
    paddingVertical: 4,
    minHeight: 48,
  },
  dayName: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[500],
    fontWeight: theme.fontWeight.medium,
  },
  dayNum: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  dayNumToday: {
    backgroundColor: theme.colors.primary[600],
  },
  dayNumSelected: {
    backgroundColor: theme.colors.neutral[700],
  },
  dayText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.neutral[300],
  },
  dayTextFaded: {
    opacity: 0.4,
  },
  dayTextActive: {
    color: "#fff",
    fontWeight: theme.fontWeight.semibold,
  },
  dots: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

// ---------- DayEventList ----------

interface DayEventListProps {
  day: Date;
  events: VisibleCalendarEvent[];
  getColor: (id: string) => string;
  onEventPress: (ev: VisibleCalendarEvent) => void;
}

function DayEventList({ day, events, getColor, onEventPress }: DayEventListProps) {
  const dayEvents = events
    .filter((ev) => eventFallsOnDay(ev, day))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  if (dayEvents.length === 0) {
    return (
      <View style={dayStyles.empty}>
        <Text style={dayStyles.emptyText}>No events</Text>
      </View>
    );
  }

  return (
    <View style={dayStyles.list}>
      {dayEvents.map((ev) => {
        const color = getColor(ev.creator_id);
        const isBusy = ev.viewer_permission === "free_busy";
        return (
          <TouchableOpacity
            key={ev.id}
            style={dayStyles.card}
            onPress={() => onEventPress(ev)}
            activeOpacity={0.7}
          >
            <View style={[dayStyles.colorBar, { backgroundColor: color }]} />
            <View style={dayStyles.cardBody}>
              <Text
                style={[dayStyles.cardTitle, isBusy && dayStyles.cardTitleBusy]}
                numberOfLines={1}
              >
                {ev.title}
              </Text>
              {ev.is_all_day ? (
                <Text style={dayStyles.cardTime}>All day</Text>
              ) : (
                <Text style={dayStyles.cardTime}>
                  {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
                </Text>
              )}
              {!isBusy && ev.location ? (
                <Text style={dayStyles.cardLocation} numberOfLines={1}>{ev.location}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const dayStyles = StyleSheet.create({
  list: {
    padding: theme.spacing[4],
    gap: theme.spacing[2],
    paddingBottom: theme.spacing[8],
  },
  card: {
    flexDirection: "row",
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
  },
  colorBar: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: theme.spacing[3],
  },
  cardTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.neutral[50],
  },
  cardTitleBusy: {
    color: theme.colors.neutral[400],
    fontStyle: "italic",
  },
  cardTime: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
    marginTop: 2,
  },
  cardLocation: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[500],
    marginTop: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    paddingTop: theme.spacing[8],
  },
  emptyText: {
    color: theme.colors.neutral[500],
    fontSize: theme.fontSize.sm,
  },
});

// ---------- CalendarViewsScreen ----------

export default function CalendarViewsScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const today = useMemo(() => new Date(), []);

  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  const { events: ownEvents, loading: ownLoading } = useCalendar();

  const [overlayIds, setOverlayIds] = useState<string[]>([]);
  const [connectionUsers, setConnectionUsers] = useState<User[]>([]);
  const { userColors } = useConstellationGraph(connectionUsers);

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
      setOverlayIds(
        users
          .filter((u) => {
            const p = allPerms.find((p) => p.grantor_id === u.id && p.resource_type === "calendar");
            return p && p.level !== "none";
          })
          .map((u) => u.id)
      );
    });
  }, [authUser]);

  const { eventsByOwner } = useCalendarOverlay(overlayIds);

  const allEvents: VisibleCalendarEvent[] = useMemo(() => {
    const overlay = overlayIds.flatMap((id) => eventsByOwner[id] ?? []);
    return [...ownEvents, ...overlay];
  }, [ownEvents, eventsByOwner, overlayIds]);

  function getColor(creatorId: string): string {
    if (creatorId === authUser?.id) return FALLBACK_COLOR;
    return userColors.get(creatorId) ?? FALLBACK_COLOR;
  }

  function handleSelectDay(d: Date) {
    setSelectedDay(d);
    setView("day");
  }

  function handleEventPress(ev: VisibleCalendarEvent) {
    router.push(`/calendar/${ev.id}`);
  }

  function goToday() {
    setAnchor(new Date());
    setSelectedDay(new Date());
  }

  function goPrev() {
    if (view === "month") {
      setAnchor((a) => new Date(a.getFullYear(), a.getMonth() - 1, 1));
    } else {
      setSelectedDay((d) => addDays(d, -1));
      setAnchor((a) => addDays(a, -1));
    }
  }

  function goNext() {
    if (view === "month") {
      setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + 1, 1));
    } else {
      setSelectedDay((d) => addDays(d, 1));
      setAnchor((a) => addDays(a, 1));
    }
  }

  const title = useMemo(() => {
    if (view === "month") {
      return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
    return selectedDay.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }, [view, anchor, selectedDay]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToday}>
          <Text style={styles.todayBtn}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goPrev}>
          <Text style={styles.navBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <TouchableOpacity onPress={goNext}>
          <Text style={styles.navBtn}>›</Text>
        </TouchableOpacity>
      </View>

      {/* View switcher */}
      <View style={styles.viewSwitcher}>
        {(["month", "day"] as ViewMode[]).map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.viewBtn, view === v && styles.viewBtnActive]}
            onPress={() => setView(v)}
          >
            <Text style={[styles.viewBtnText, view === v && styles.viewBtnTextActive]}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {ownLoading ? (
        <ActivityIndicator color={theme.colors.primary[400]} style={{ marginTop: 32 }} />
      ) : (
        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          {view === "month" && (
            <>
              <MonthGrid
                anchor={anchor}
                events={allEvents}
                getColor={getColor}
                selectedDay={selectedDay}
                onSelectDay={handleSelectDay}
                today={today}
              />
              {/* Show selected day events below month grid */}
              <View style={styles.daySection}>
                <Text style={styles.daySectionTitle}>
                  {selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </Text>
              </View>
              <DayEventList
                day={selectedDay}
                events={allEvents}
                getColor={getColor}
                onEventPress={handleEventPress}
              />
            </>
          )}
          {view === "day" && (
            <DayEventList
              day={selectedDay}
              events={allEvents}
              getColor={getColor}
              onEventPress={handleEventPress}
            />
          )}
        </ScrollView>
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
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[3],
    paddingBottom: theme.spacing[2],
    gap: theme.spacing[2],
  },
  backText: {
    color: theme.colors.neutral[400],
    fontSize: theme.fontSize.sm,
    marginRight: theme.spacing[1],
  },
  todayBtn: {
    color: theme.colors.neutral[300],
    fontSize: theme.fontSize.sm,
    backgroundColor: theme.colors.neutral[800],
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.sm,
  },
  navBtn: {
    color: theme.colors.neutral[400],
    fontSize: 22,
    lineHeight: 28,
    paddingHorizontal: theme.spacing[1],
  },
  title: {
    flex: 1,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.neutral[100],
    textAlign: "center",
  },
  viewSwitcher: {
    flexDirection: "row",
    marginHorizontal: theme.spacing[4],
    marginBottom: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.neutral[700],
    alignSelf: "flex-start",
  },
  viewBtn: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
  },
  viewBtnActive: {
    backgroundColor: theme.colors.primary[600],
  },
  viewBtnText: {
    color: theme.colors.neutral[400],
    fontSize: theme.fontSize.sm,
  },
  viewBtnTextActive: {
    color: "#fff",
    fontWeight: theme.fontWeight.medium,
  },
  body: {
    flex: 1,
  },
  daySection: {
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[1],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.neutral[800],
  },
  daySectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.neutral[300],
  },
});
