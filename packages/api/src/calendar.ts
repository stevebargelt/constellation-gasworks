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

// ---------------------------------------------------------------------------
// Recurring event edit/delete — three standard RFC 5545 edit modes
// ---------------------------------------------------------------------------

export type RecurringEditMode = "this" | "this_and_future" | "all";

/**
 * Update a recurring event occurrence.
 *
 * - "this": Create an exception instance with the same recurrence_parent_id
 *   and the provided updates. The parent is untouched.
 * - "this_and_future": Update the parent RRULE to add UNTIL before this
 *   occurrence, then create a new parent starting from this occurrence.
 * - "all": Update the parent event directly.
 */
export async function updateRecurringCalendarEvent(
  parentId: string,
  occurrenceStart: string,
  updates: Partial<Omit<CalendarEvent, "id" | "creator_id" | "created_at">>,
  mode: RecurringEditMode
): Promise<CalendarEvent | null> {
  if (mode === "all") {
    return updateCalendarEvent(parentId, updates);
  }

  if (mode === "this") {
    // Fetch the parent to copy its base fields.
    const { data: parent } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("id", parentId)
      .single();
    if (!parent) return null;

    const originalDuration =
      new Date(parent.end_time).getTime() - new Date(parent.start_time).getTime();
    const newStart = updates.start_time ?? occurrenceStart;
    const newEnd =
      updates.end_time ??
      new Date(new Date(newStart).getTime() + originalDuration).toISOString();

    const { data } = await supabase
      .from("calendar_events")
      .insert({
        title: parent.title,
        description: parent.description,
        location: parent.location,
        is_private: parent.is_private,
        is_all_day: parent.is_all_day,
        ...updates,
        start_time: newStart,
        end_time: newEnd,
        recurrence_rule: null,
        recurrence_parent_id: parentId,
      })
      .select()
      .single();
    return data;
  }

  // mode === "this_and_future"
  // 1. Cap the parent RRULE with UNTIL = one millisecond before occurrenceStart.
  const { data: parent } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", parentId)
    .single();
  if (!parent) return null;

  if (parent.recurrence_rule) {
    const untilDate = new Date(new Date(occurrenceStart).getTime() - 1);
    const cappedRule = capRRuleUntil(parent.recurrence_rule, untilDate);
    await supabase
      .from("calendar_events")
      .update({ recurrence_rule: cappedRule })
      .eq("id", parentId);
  }

  // 2. Create a new parent event for this occurrence onwards.
  const originalDuration =
    new Date(parent.end_time).getTime() - new Date(parent.start_time).getTime();
  const newStart = updates.start_time ?? occurrenceStart;
  const newEnd =
    updates.end_time ??
    new Date(new Date(newStart).getTime() + originalDuration).toISOString();

  const { data } = await supabase
    .from("calendar_events")
    .insert({
      title: parent.title,
      description: parent.description,
      location: parent.location,
      is_private: parent.is_private,
      is_all_day: parent.is_all_day,
      recurrence_rule: parent.recurrence_rule,
      recurrence_parent_id: null,
      ...updates,
      start_time: newStart,
      end_time: newEnd,
    })
    .select()
    .single();
  return data;
}

/**
 * Delete a recurring event occurrence.
 *
 * - "this": Create an exception instance with zero duration (tombstone) so
 *   the expansion layer knows to skip it. Simpler approach: set the
 *   recurrence_parent_id and mark with a sentinel title — but the cleanest
 *   client-side approach is to just insert a hidden exception row.
 *   Implementation here: insert an exception row with is_private=true and
 *   zero-length times so queries avoid it, or — more practically — delete
 *   only the single fetched DB row if it was materialized. Since we expand
 *   client-side, a "this" delete means: insert an exception that the
 *   expansion layer will find and exclude.
 * - "this_and_future": Cap the parent RRULE UNTIL to before this occurrence.
 * - "all": Delete the parent and all exception instances.
 */
export async function deleteRecurringCalendarEvent(
  parentId: string,
  occurrenceStart: string,
  mode: RecurringEditMode
): Promise<void> {
  if (mode === "all") {
    // Delete exception instances first, then the parent.
    await supabase
      .from("calendar_events")
      .delete()
      .eq("recurrence_parent_id", parentId);
    await supabase.from("calendar_events").delete().eq("id", parentId);
    return;
  }

  if (mode === "this_and_future") {
    const { data: parent } = await supabase
      .from("calendar_events")
      .select("recurrence_rule")
      .eq("id", parentId)
      .single();
    if (parent?.recurrence_rule) {
      const untilDate = new Date(new Date(occurrenceStart).getTime() - 1);
      const cappedRule = capRRuleUntil(parent.recurrence_rule, untilDate);
      await supabase
        .from("calendar_events")
        .update({ recurrence_rule: cappedRule })
        .eq("id", parentId);
    }
    // Also delete exception instances on or after this occurrence.
    await supabase
      .from("calendar_events")
      .delete()
      .eq("recurrence_parent_id", parentId)
      .gte("start_time", occurrenceStart);
    return;
  }

  // mode === "this": insert a "deleted occurrence" exception row.
  // The expansion layer (expandRecurringEvents) skips events that have
  // recurrence_parent_id set, so inserting an exception with the exact
  // occurrence start_time acts as a tombstone — the client sees it in the
  // raw list and omits the virtual occurrence.
  const { data: parent } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", parentId)
    .single();
  if (!parent) return;
  await supabase.from("calendar_events").insert({
    title: parent.title,
    description: parent.description,
    location: parent.location,
    is_private: true,
    is_all_day: parent.is_all_day,
    start_time: occurrenceStart,
    end_time: occurrenceStart, // zero-length tombstone
    recurrence_rule: null,
    recurrence_parent_id: parentId,
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Given an existing RRULE string, returns a new RRULE string with the UNTIL
 * property set to `date` (or replaced if one already exists).
 */
function capRRuleUntil(rruleStr: string, date: Date): string {
  const until = date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  if (/UNTIL=/i.test(rruleStr)) {
    return rruleStr.replace(/UNTIL=[^;]+/i, `UNTIL=${until}`);
  }
  if (/^RRULE:/i.test(rruleStr)) {
    return rruleStr.replace(/^RRULE:/i, `RRULE:UNTIL=${until};`);
  }
  return `UNTIL=${until};${rruleStr}`;
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
