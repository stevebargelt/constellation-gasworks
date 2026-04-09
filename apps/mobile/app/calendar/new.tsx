import React from "react";
import { useRouter } from "expo-router";
import { useCalendar } from "@constellation/hooks";
import EventForm from "./_EventForm";
import type { EventFormData } from "./_EventForm";

export default function NewCalendarEventScreen() {
  const router = useRouter();
  const { create } = useCalendar();

  async function handleSave(data: EventFormData) {
    await create(data);
    router.replace("/calendar");
  }

  return (
    <EventForm
      onSave={handleSave}
      onCancel={() => router.back()}
    />
  );
}
