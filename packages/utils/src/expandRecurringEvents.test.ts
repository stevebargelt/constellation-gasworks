import { describe, expect, it } from "vitest";
import { buildRRule, expandRecurringEvents } from "./expandRecurringEvents";
import type { CalendarEvent } from "@constellation/types";

const baseEvent: CalendarEvent = {
  id: "evt-1",
  creator_id: "user-1",
  title: "Stand-up",
  description: null,
  location: null,
  start_time: "2026-04-01T09:00:00.000Z",
  end_time: "2026-04-01T09:30:00.000Z",
  is_private: false,
  is_all_day: false,
  recurrence_rule: null,
  recurrence_parent_id: null,
  created_at: "2026-04-01T00:00:00.000Z",
};

describe("expandRecurringEvents", () => {
  it("passes through non-recurring events unchanged", () => {
    const range = {
      start: new Date("2026-04-01T00:00:00Z"),
      end: new Date("2026-04-07T23:59:59Z"),
    };
    const result = expandRecurringEvents([baseEvent], range);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(baseEvent);
  });

  it("expands a daily recurring event into occurrences within range", () => {
    const rule = buildRRule("daily", new Date("2026-04-01T09:00:00Z"));
    const event = { ...baseEvent, recurrence_rule: rule };
    const range = {
      start: new Date("2026-04-01T00:00:00Z"),
      end: new Date("2026-04-05T23:59:59Z"),
    };
    const result = expandRecurringEvents([event], range);
    expect(result).toHaveLength(5);
    expect(result[0].id).toMatch(/^evt-1_/);
    expect(result[0].start_time).toBe("2026-04-01T09:00:00.000Z");
    expect(result[4].start_time).toBe("2026-04-05T09:00:00.000Z");
  });

  it("expands a weekly recurring event", () => {
    const rule = buildRRule("weekly", new Date("2026-04-01T09:00:00Z"));
    const event = { ...baseEvent, recurrence_rule: rule };
    const range = {
      start: new Date("2026-04-01T00:00:00Z"),
      end: new Date("2026-04-30T23:59:59Z"),
    };
    const result = expandRecurringEvents([event], range);
    expect(result).toHaveLength(5); // Apr 1, 8, 15, 22, 29
  });

  it("expands a bi-weekly recurring event", () => {
    const rule = buildRRule("biweekly", new Date("2026-04-01T09:00:00Z"));
    const event = { ...baseEvent, recurrence_rule: rule };
    const range = {
      start: new Date("2026-04-01T00:00:00Z"),
      end: new Date("2026-04-30T23:59:59Z"),
    };
    const result = expandRecurringEvents([event], range);
    expect(result).toHaveLength(3); // Apr 1, 15, 29
  });

  it("expands a monthly recurring event", () => {
    const rule = buildRRule("monthly", new Date("2026-04-01T09:00:00Z"));
    const event = { ...baseEvent, recurrence_rule: rule };
    const range = {
      start: new Date("2026-04-01T00:00:00Z"),
      end: new Date("2026-06-30T23:59:59Z"),
    };
    const result = expandRecurringEvents([event], range);
    expect(result).toHaveLength(3); // Apr 1, May 1, Jun 1
  });

  it("preserves event duration across occurrences", () => {
    const rule = buildRRule("daily", new Date("2026-04-01T14:00:00Z"));
    const event: CalendarEvent = {
      ...baseEvent,
      start_time: "2026-04-01T14:00:00.000Z",
      end_time: "2026-04-01T15:30:00.000Z", // 90 min
      recurrence_rule: rule,
    };
    const range = {
      start: new Date("2026-04-01T00:00:00Z"),
      end: new Date("2026-04-02T23:59:59Z"),
    };
    const result = expandRecurringEvents([event], range);
    expect(result).toHaveLength(2);
    const secondOcc = result[1];
    const duration =
      new Date(secondOcc.end_time).getTime() -
      new Date(secondOcc.start_time).getTime();
    expect(duration).toBe(90 * 60 * 1000);
  });

  it("passes through exception instances (recurrence_parent_id set) unchanged", () => {
    const exception: CalendarEvent = {
      ...baseEvent,
      id: "exc-1",
      recurrence_parent_id: "evt-1",
      recurrence_rule: null,
    };
    const range = {
      start: new Date("2026-04-01T00:00:00Z"),
      end: new Date("2026-04-07T23:59:59Z"),
    };
    const result = expandRecurringEvents([exception], range);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(exception);
  });

  it("returns no occurrences when range is entirely before dtstart", () => {
    const rule = buildRRule("daily", new Date("2026-05-01T09:00:00Z"));
    const event = { ...baseEvent, recurrence_rule: rule };
    const range = {
      start: new Date("2026-04-01T00:00:00Z"),
      end: new Date("2026-04-30T23:59:59Z"),
    };
    const result = expandRecurringEvents([event], range);
    expect(result).toHaveLength(0);
  });

  it("respects UNTIL in the RRULE string", () => {
    const rule = buildRRule(
      "daily",
      new Date("2026-04-01T09:00:00Z"),
      new Date("2026-04-03T09:00:00Z")
    );
    const event = { ...baseEvent, recurrence_rule: rule };
    const range = {
      start: new Date("2026-04-01T00:00:00Z"),
      end: new Date("2026-04-07T23:59:59Z"),
    };
    const result = expandRecurringEvents([event], range);
    expect(result).toHaveLength(3); // Apr 1, 2, 3 only
  });
});
