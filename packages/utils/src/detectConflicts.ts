import type { CalendarEvent } from "@constellation/types";

export interface ConflictPair {
  a: CalendarEvent;
  b: CalendarEvent;
}

/**
 * Detects scheduling conflicts among a set of calendar events.
 * Two events conflict if their time ranges overlap and neither is all-day.
 * All-day events never conflict with timed events.
 */
export function detectConflicts(events: CalendarEvent[]): ConflictPair[] {
  const conflicts: ConflictPair[] = [];
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (a.is_all_day || b.is_all_day) continue;
      const aStart = new Date(a.start_time).getTime();
      const aEnd = new Date(a.end_time).getTime();
      const bStart = new Date(b.start_time).getTime();
      const bEnd = new Date(b.end_time).getTime();
      if (aStart < bEnd && aEnd > bStart) {
        conflicts.push({ a, b });
      }
    }
  }
  return conflicts;
}
