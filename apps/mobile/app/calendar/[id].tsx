import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth, useCalendar } from "@constellation/hooks";
import { getEventAttendees, rsvpToEvent, supabase } from "@constellation/api";
import type { EventAttendee } from "@constellation/types";
import EventForm from "./_EventForm";
import type { EventFormData } from "./_EventForm";
import { theme } from "../../src/theme";

export default function EditCalendarEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { events, loading, update, remove } = useCalendar();

  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [rsvping, setRsvping] = useState(false);

  const event = events.find((e) => e.id === id);
  const isOwn = event?.creator_id === authUser?.id;

  // My attendee record — I'm invited if it exists and status=invited
  const myAttendee = attendees.find((a) => a.user_id === authUser?.id);
  const isInvited = myAttendee?.status === "invited";

  useEffect(() => {
    if (!id) return;
    const load = () => getEventAttendees(id).then(setAttendees);
    load();

    // Realtime: refresh when attendees change
    const channel = supabase
      .channel(`event-attendees-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_attendees" }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary[400]} />
      </View>
    );
  }

  if (!event) {
    router.replace("/calendar");
    return null;
  }

  async function handleSave(data: EventFormData) {
    await update(id, data);
    router.replace("/calendar");
  }

  function handleDelete() {
    remove(id);
    router.replace("/calendar");
  }

  async function handleRsvp(status: EventAttendee["status"]) {
    setRsvping(true);
    try {
      await rsvpToEvent(id, status);
      getEventAttendees(id).then(setAttendees);
    } finally {
      setRsvping(false);
    }
  }

  // Show RSVP panel if I'm invited (not creator)
  if (isInvited && !isOwn) {
    return (
      <View style={styles.container}>
        <View style={styles.rsvpCard}>
          <Text style={styles.rsvpTitle}>{event.title}</Text>
          <Text style={styles.rsvpSub}>
            {new Date(event.start_time).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
            {!event.is_all_day && ` · ${new Date(event.start_time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
          </Text>
          <Text style={styles.rsvpPrompt}>You've been invited to this event.</Text>
          <View style={styles.rsvpButtons}>
            <TouchableOpacity
              style={[styles.rsvpBtn, styles.rsvpAccept]}
              onPress={() => handleRsvp("accepted")}
              disabled={rsvping}
            >
              <Text style={styles.rsvpBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rsvpBtn, styles.rsvpMaybe]}
              onPress={() => handleRsvp("tentative")}
              disabled={rsvping}
            >
              <Text style={styles.rsvpBtnText}>Maybe</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rsvpBtn, styles.rsvpDecline]}
              onPress={() => handleRsvp("declined")}
              disabled={rsvping}
            >
              <Text style={styles.rsvpBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <EventForm
      initialData={event}
      readOnly={!isOwn}
      onSave={handleSave}
      onDelete={isOwn ? handleDelete : undefined}
      onCancel={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.neutral[950],
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.neutral[950],
    padding: theme.spacing[4],
    justifyContent: "center",
  },
  rsvpCard: {
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[5],
    gap: theme.spacing[2],
  },
  rsvpTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.neutral[50],
  },
  rsvpSub: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.neutral[400],
  },
  rsvpPrompt: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.neutral[300],
    marginTop: theme.spacing[2],
  },
  rsvpButtons: {
    flexDirection: "row",
    gap: theme.spacing[2],
    marginTop: theme.spacing[3],
  },
  rsvpBtn: {
    flex: 1,
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  rsvpAccept: {
    backgroundColor: "#15803d",
  },
  rsvpMaybe: {
    backgroundColor: "#a16207",
  },
  rsvpDecline: {
    backgroundColor: theme.colors.neutral[600],
  },
  rsvpBtnText: {
    color: "#fff",
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  backLink: {
    marginTop: theme.spacing[4],
  },
  backLinkText: {
    color: theme.colors.neutral[400],
    fontSize: theme.fontSize.sm,
  },
});
