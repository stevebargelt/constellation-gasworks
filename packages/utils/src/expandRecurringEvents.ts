import { RRule } from "rrule";
import type { CalendarEvent } from "@constellation/types";

/**
 * Given a list of raw calendar events (which may include recurring parent
 * events with a `recurrence_rule` string), expands each recurring parent into
 * concrete occurrences within the requested view window.
 *
 * Non-recurring events and exception instances (those with a
 * `recurrence_parent_id`) are passed through unchanged.
 *
 * The returned list never contains the unexpanded parent events themselves —
 * only the concrete occurrence copies, each stamped with a synthetic `id` of
 * the form `<parentId>_<isoDate>` so they can be referenced for edit/delete.
 */
export function expandRecurringEvents(
  events: CalendarEvent[],
  range: { start: Date; end: Date }
): CalendarEvent[] {
  const result: CalendarEvent[] = [];

  for (const event of events) {
    // Exception instances and plain events pass through as-is.
    if (!event.recurrence_rule) {
      result.push(event);
      continue;
    }

    const eventDuration =
      new Date(event.end_time).getTime() - new Date(event.start_time).getTime();

    let rule: RRule;
    try {
      rule = RRule.fromString(event.recurrence_rule);
    } catch {
      // Malformed rule — treat the event as a one-off.
      result.push(event);
      continue;
    }

    // Clamp occurrence generation to the requested view window.
    const occurrences = rule.between(range.start, range.end, true /* inc */);

    for (const occStart of occurrences) {
      const occEnd = new Date(occStart.getTime() + eventDuration);
      result.push({
        ...event,
        id: `${event.id}_${occStart.toISOString()}`,
        start_time: occStart.toISOString(),
        end_time: occEnd.toISOString(),
        // Keep recurrence_rule on occurrences so callers know they are
        // part of a recurring series.
      });
    }
  }

  return result;
}

/**
 * Builds an RRULE string for the most common recurring patterns.
 */
export type RecurrenceFrequency = "daily" | "weekly" | "biweekly" | "monthly";

export function buildRRule(
  freq: RecurrenceFrequency,
  dtstart: Date,
  until?: Date
): string {
  const freqMap: Record<RecurrenceFrequency, RRule["options"]["freq"]> = {
    daily: RRule.DAILY,
    weekly: RRule.WEEKLY,
    biweekly: RRule.WEEKLY,
    monthly: RRule.MONTHLY,
  };

  const rule = new RRule({
    freq: freqMap[freq],
    interval: freq === "biweekly" ? 2 : 1,
    dtstart,
    until,
  });

  return rule.toString();
}
