import React from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth, useCalendar } from "@constellation/hooks";
import EventForm from "./_EventForm";
import type { EventFormData } from "./_EventForm";
import { theme } from "../../src/theme";

export default function EditCalendarEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { events, loading, update, remove } = useCalendar();

  const event = events.find((e) => e.id === id);

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

  const isOwn = event.creator_id === authUser?.id;

  async function handleSave(data: EventFormData) {
    await update(id, data);
    router.replace("/calendar");
  }

  function handleDelete() {
    remove(id);
    router.replace("/calendar");
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
});
