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

// ---------- types ----------

interface Partner {
  user: User;
  calendarPermission: "full" | "free_busy" | "none";
}

// ---------- EventItem ----------

interface EventItemProps {
  event: VisibleCalendarEvent;
  color: string;
  ownerName: string;
}

function EventItem({ event, color, ownerName }: EventItemProps) {
  const isBusy = event.viewer_permission === "free_busy";
  return (
    <View style={styles.card}>
      <View style={[styles.colorDot, { backgroundColor: color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text
            style={[styles.cardTitle, isBusy && styles.cardTitleBusy]}
            numberOfLines={1}
          >
            {event.title}
          </Text>
          <Text style={styles.cardOwner}>{ownerName}</Text>
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
    </View>
  );
}

// ---------- CalendarOverlayScreen ----------

export default function CalendarOverlayScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { events: ownEvents, loading: ownLoading } = useCalendar();

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [connectionUsers, setConnectionUsers] = useState<User[]>([]);
  const { userColors } = useConstellationGraph(connectionUsers);

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
        const perm = allPerms.find(
          (p) => p.grantor_id === u.id && p.resource_type === "calendar"
        );
        return {
          user: u,
          calendarPermission: (perm?.level ?? "none") as "full" | "free_busy" | "none",
        };
      });

      setPartners(partnerList);
      setConnectionUsers(users);

      const autoSelect = new Set(
        partnerList
          .filter((p) => p.calendarPermission !== "none")
          .map((p) => p.user.id)
      );
      setSelectedIds(autoSelect);
      setLoadingPartners(false);
    });
  }, [authUser]);

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

  const allEvents: VisibleCalendarEvent[] = useMemo(() => {
    const overlay = overlayOwnerIds.flatMap((id) => eventsByOwner[id] ?? []);
    return [...ownEvents, ...overlay].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [ownEvents, eventsByOwner, overlayOwnerIds]);

  const loading = ownLoading || loadingPartners || overlayLoading;

  const visiblePartners = partners.filter((p) => p.calendarPermission !== "none");

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Overlay</Text>
      </View>

      {/* Partner toggles */}
      <View style={styles.legendSection}>
        <Text style={styles.legendLabel}>SHOWING</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legendScroll}>
          {/* Own chip — always active */}
          <View style={[styles.chip, { backgroundColor: FALLBACK_COLOR, borderColor: FALLBACK_COLOR }]}>
            <View style={[styles.chipDot, { backgroundColor: "#fff" }]} />
            <Text style={styles.chipTextActive}>You</Text>
          </View>

          {loadingPartners ? (
            <ActivityIndicator color={theme.colors.primary[400]} style={{ marginLeft: 8 }} />
          ) : (
            visiblePartners.map((p) => {
              const color = userColors.get(p.user.id) ?? FALLBACK_COLOR;
              const active = selectedIds.has(p.user.id);
              return (
                <TouchableOpacity
                  key={p.user.id}
                  style={[
                    styles.chip,
                    active
                      ? { backgroundColor: color, borderColor: color }
                      : styles.chipInactive,
                  ]}
                  onPress={() => togglePartner(p.user.id)}
                >
                  <View style={[styles.chipDot, { backgroundColor: active ? "#fff" : color }]} />
                  <Text style={active ? styles.chipTextActive : styles.chipTextInactive}>
                    {p.user.preferred_name ?? p.user.display_name}
                  </Text>
                  {p.calendarPermission === "free_busy" && (
                    <Text style={styles.chipSuffix}> F/B</Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Event list */}
      {loading ? (
        <ActivityIndicator color={theme.colors.primary[400]} style={{ marginTop: 32 }} />
      ) : allEvents.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No events to display.</Text>
        </View>
      ) : (
        <FlatList
          data={allEvents}
          keyExtractor={(e) => `${e.creator_id}-${e.id}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <EventItem
              event={item}
              color={getColor(item.creator_id)}
              ownerName={getUserName(item.creator_id)}
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
    paddingBottom: theme.spacing[2],
  },
  backText: {
    color: theme.colors.neutral[400],
    fontSize: theme.fontSize.sm,
  },
  heading: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.neutral[50],
  },
  legendSection: {
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[3],
  },
  legendLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[500],
    letterSpacing: 1,
    marginBottom: theme.spacing[2],
  },
  legendScroll: {
    gap: theme.spacing[2],
    paddingRight: theme.spacing[4],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: 999,
    borderWidth: 1,
    gap: theme.spacing[1],
  },
  chipInactive: {
    borderColor: theme.colors.neutral[600],
    backgroundColor: "transparent",
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipTextActive: {
    color: "#fff",
    fontSize: theme.fontSize.sm,
  },
  chipTextInactive: {
    color: theme.colors.neutral[400],
    fontSize: theme.fontSize.sm,
  },
  chipSuffix: {
    color: theme.colors.neutral[500],
    fontSize: theme.fontSize.xs,
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
  cardOwner: {
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
  },
  emptyText: {
    color: theme.colors.neutral[500],
    fontSize: theme.fontSize.sm,
  },
});
