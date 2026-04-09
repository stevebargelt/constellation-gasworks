import type { CalendarEvent } from "@constellation/types";

export interface ConflictResult {
  userId: string;
  events: CalendarEvent[];
}

/**
 * Detects scheduling conflicts between a proposed event and existing events.
 *
 * For each person whose events overlap the proposed time window, returns one
 * ConflictResult entry with that person's conflicting events grouped together.
 * All-day events are never flagged as conflicts.
 */
export function detectConflicts(
  newEvent: { start: Date; end: Date },
  existingEvents: CalendarEvent[]
): ConflictResult[] {
  const newStart = newEvent.start.getTime();
  const newEnd = newEvent.end.getTime();

  const byUser = new Map<string, CalendarEvent[]>();

  for (const event of existingEvents) {
    if (event.is_all_day) continue;
    const eStart = new Date(event.start_time).getTime();
    const eEnd = new Date(event.end_time).getTime();
    if (newStart < eEnd && newEnd > eStart) {
      const list = byUser.get(event.creator_id) ?? [];
      list.push(event);
      byUser.set(event.creator_id, list);
    }
  }

  return Array.from(byUser.entries()).map(([userId, events]) => ({
    userId,
    events,
  }));
}
