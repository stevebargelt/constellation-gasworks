import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useAuth, useCalendar } from "@constellation/hooks";
import { getRelationships, getUsersByIds, inviteToEvent } from "@constellation/api";
import type { User } from "@constellation/types";
import EventForm from "./_EventForm";
import type { EventFormData } from "./_EventForm";

export default function NewCalendarEventScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { create } = useCalendar();
  const [partners, setPartners] = useState<User[]>([]);

  useEffect(() => {
    if (!authUser) return;
    getRelationships().then((rels) => {
      const active = rels.filter((r) => r.status === "active");
      const ids = active.flatMap((r) =>
        r.user_a_id === authUser.id ? [r.user_b_id] : [r.user_a_id]
      );
      getUsersByIds([...new Set(ids)]).then(setPartners);
    });
  }, [authUser]);

  async function handleSave(data: EventFormData, inviteeIds: string[]) {
    const created = await create(data);
    if (created && inviteeIds.length) {
      await inviteToEvent(created.id, inviteeIds);
    }
    router.replace("/calendar");
  }

  return (
    <EventForm
      partners={partners}
      onSave={handleSave}
      onCancel={() => router.back()}
    />
  );
}
