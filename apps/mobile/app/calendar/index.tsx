import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth, useCalendar, useCalendarOverlay, useConstellationGraph } from "@constellation/hooks";
import { getRelationships, getUsersByIds } from "@constellation/api";
import type { User, VisibleCalendarEvent } from "@constellation/types";
import { theme } from "../../src/theme";

const FALLBACK_COLOR = theme.colors.primary[500];

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

// ---------- PartnerToggle ----------

interface PartnerToggleProps {
  partners: User[];
  selectedIds: Set<string>;
  getColor: (id: string) => string;
  onToggle: (id: string) => void;
}

function PartnerToggle({ partners, selectedIds, getColor, onToggle }: PartnerToggleProps) {
  if (!partners.length) return null;
  return (
    <View style={styles.legend}>
      <Text style={styles.legendLabel}>Show partners</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legendRow}>
        {partners.map((p) => {
          const selected = selectedIds.has(p.id);
          const color = getColor(p.id);
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.legendChip, selected && styles.legendChipSelected]}
              onPress={() => onToggle(p.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.chipDot, { backgroundColor: color }]} />
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {p.display_name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ---------- EventItem ----------

interface EventItemProps {
  event: VisibleCalendarEvent;
  personColor: string;
  isOwn: boolean;
  onPress: () => void;
}

function EventItem({ event, personColor, isOwn, onPress }: EventItemProps) {
  const isBusy = event.viewer_permission === "free_busy";
  return (
    <TouchableOpacity
      style={[styles.card, isBusy && styles.cardBusy]}
      onPress={onPress}
      activeOpacity={isOwn ? 0.7 : 1}
    >
      <View style={[styles.colorDot, { backgroundColor: personColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text
            style={[styles.cardTitle, isBusy && styles.cardTitleBusy]}
            numberOfLines={1}
          >
            {event.title}
          </Text>
          {event.is_private && !isBusy && (
            <Text style={styles.cardMeta}> (private)</Text>
          )}
          {isOwn && <Text style={styles.cardOwn}>you</Text>}
        </View>
        {event.is_all_day ? (
          <Text style={styles.cardTime}>{formatDate(event.start_time)} · All day</Text>
        ) : (
          <Text style={styles.cardTime}>
            {formatDate(event.start_time)} · {formatTime(event.start_time)} – {formatTime(event.end_time)}
          </Text>
        )}
        {!isBusy && event.location ? (
          <Text style={styles.cardLocation} numberOfLines={1}>{event.location}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ---------- CalendarScreen ----------

export default function CalendarScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { events, loading } = useCalendar();
  const [connectionUsers, setConnectionUsers] = useState<User[]>([]);
  const { userColors } = useConstellationGraph(connectionUsers);

  // Overlay partner selection
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<Set<string>>(new Set());
  const selectedIdsArray = useMemo(() => [...selectedPartnerIds], [selectedPartnerIds]);
  const { eventsByOwner: overlayEventsByOwner, loading: overlayLoading } =
    useCalendarOverlay(selectedIdsArray);

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

  function togglePartner(id: string) {
    setSelectedPartnerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Merge own + overlay events sorted by start_time
  const allEvents = useMemo<VisibleCalendarEvent[]>(() => {
    const overlayFlat = selectedIdsArray.flatMap(
      (id) => overlayEventsByOwner[id] ?? []
    );
    return [...events, ...overlayFlat].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [events, selectedIdsArray, overlayEventsByOwner]);

  const anyLoading = loading || overlayLoading;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Calendar</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push("/calendar/new")}
        >
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Partner overlay toggles */}
      <PartnerToggle
        partners={connectionUsers}
        selectedIds={selectedPartnerIds}
        getColor={getColor}
        onToggle={togglePartner}
      />

      {anyLoading ? (
        <ActivityIndicator color={theme.colors.primary[400]} style={{ marginTop: 32 }} />
      ) : allEvents.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No events yet.</Text>
          <TouchableOpacity onPress={() => router.push("/calendar/new")}>
            <Text style={styles.emptyLink}>Create your first event</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={allEvents}
          keyExtractor={(e) => `${e.creator_id}-${e.id}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <EventItem
              event={item}
              personColor={getColor(item.creator_id)}
              isOwn={item.creator_id === authUser?.id}
              onPress={() =>
                item.creator_id === authUser?.id
                  ? router.push(`/calendar/${item.id}`)
                  : undefined
              }
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
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[3],
  },
  heading: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.neutral[50],
  },
  newBtn: {
    backgroundColor: theme.colors.primary[600],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
  },
  newBtnText: {
    color: "#fff",
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  legend: {
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[3],
  },
  legendLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: theme.spacing[2],
  },
  legendRow: {
    gap: theme.spacing[2],
    paddingRight: theme.spacing[4],
  },
  legendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[1],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.neutral[600],
  },
  legendChipSelected: {
    backgroundColor: theme.colors.neutral[600],
    borderColor: "transparent",
  },
  chipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chipText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
  },
  chipTextSelected: {
    color: theme.colors.neutral[50],
  },
  list: {
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[8],
    gap: theme.spacing[2],
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[3],
    gap: theme.spacing[3],
  },
  cardBusy: {
    opacity: 0.7,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 2,
  },
  cardBody: {
    flex: 1,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.neutral[50],
    flex: 1,
  },
  cardTitleBusy: {
    color: theme.colors.neutral[400],
    fontStyle: "italic",
  },
  cardMeta: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[500],
  },
  cardOwn: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[500],
    marginLeft: theme.spacing[2],
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
    justifyContent: "center",
    gap: theme.spacing[3],
  },
  emptyText: {
    color: theme.colors.neutral[500],
    fontSize: theme.fontSize.sm,
  },
  emptyLink: {
    color: theme.colors.primary[400],
    fontSize: theme.fontSize.sm,
    textDecorationLine: "underline",
  },
});
