import type { CalendarEvent, EventAttendee, VisibleCalendarEvent } from "@constellation/types";
import { supabase } from "./client";

export async function getCalendarEvents(params: {
  ownerIds?: string[];
  range?: { start: string; end: string };
}): Promise<VisibleCalendarEvent[]> {
  let query = supabase.from("visible_calendar_events").select("*");
  if (params.ownerIds?.length) {
    query = query.in("creator_id", params.ownerIds);
  }
  if (params.range) {
    query = query
      .gte("start_time", params.range.start)
      .lte("end_time", params.range.end);
  }
  const { data } = await query;
  return (data as VisibleCalendarEvent[]) ?? [];
}

export async function createCalendarEvent(
  event: Omit<CalendarEvent, "id" | "creator_id" | "created_at">
): Promise<CalendarEvent | null> {
  const { data } = await supabase
    .from("calendar_events")
    .insert(event)
    .select()
    .single();
  return data;
}

export async function updateCalendarEvent(
  id: string,
  updates: Partial<Omit<CalendarEvent, "id" | "creator_id" | "created_at">>
): Promise<CalendarEvent | null> {
  const { data } = await supabase
    .from("calendar_events")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  return data;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await supabase.from("calendar_events").delete().eq("id", id);
}

export async function getEventAttendees(
  eventId: string
): Promise<EventAttendee[]> {
  const { data } = await supabase
    .from("event_attendees")
    .select("*")
    .eq("event_id", eventId);
  return data ?? [];
}

export async function rsvpToEvent(
  eventId: string,
  status: EventAttendee["status"]
): Promise<EventAttendee | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("event_attendees")
    .upsert({ event_id: eventId, user_id: user.id, status }, { onConflict: "event_id,user_id" })
    .select()
    .single();
  return data;
}

export async function inviteToEvent(eventId: string, userIds: string[]): Promise<void> {
  if (!userIds.length) return;
  const rows = userIds.map((user_id) => ({ event_id: eventId, user_id, status: "invited" as const }));
  await supabase.from("event_attendees").upsert(rows, { onConflict: "event_id,user_id" });
}

export async function getMyEventInvites(): Promise<{ event: VisibleCalendarEvent; attendee: EventAttendee }[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch attendee rows where I'm invited
  const { data: attendees } = await supabase
    .from("event_attendees")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "invited");

  if (!attendees?.length) return [];

  const eventIds = attendees.map((a: EventAttendee) => a.event_id);
  const { data: events } = await supabase
    .from("visible_calendar_events")
    .select("*")
    .in("id", eventIds);

  const eventMap = new Map<string, VisibleCalendarEvent>(
    ((events ?? []) as VisibleCalendarEvent[]).map((e) => [e.id, e])
  );

  return attendees
    .filter((a: EventAttendee) => eventMap.has(a.event_id))
    .map((a: EventAttendee) => ({ event: eventMap.get(a.event_id)!, attendee: a }));
}
