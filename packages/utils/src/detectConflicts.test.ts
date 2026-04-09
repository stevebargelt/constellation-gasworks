import { describe, it, expect } from "vitest";
import type { CalendarEvent } from "@constellation/types";
import { detectConflicts } from "./detectConflicts";

function event(
  id: string,
  creatorId: string,
  startIso: string,
  endIso: string,
  isAllDay = false
): CalendarEvent {
  return {
    id,
    creator_id: creatorId,
    title: id,
    description: null,
    location: null,
    start_time: startIso,
    end_time: endIso,
    is_private: false,
    is_all_day: isAllDay,
    recurrence_rule: null,
    recurrence_parent_id: null,
    created_at: "2024-01-01T00:00:00Z",
  };
}

const NEW = {
  start: new Date("2024-06-01T10:00:00Z"),
  end: new Date("2024-06-01T11:00:00Z"),
};

describe("detectConflicts", () => {
  it("returns empty array when there are no existing events", () => {
    expect(detectConflicts(NEW, [])).toEqual([]);
  });

  it("returns empty array when no events overlap", () => {
    const existing = [
      event("e1", "alice", "2024-06-01T08:00:00Z", "2024-06-01T09:00:00Z"),
      event("e2", "bob", "2024-06-01T11:00:00Z", "2024-06-01T12:00:00Z"),
    ];
    expect(detectConflicts(NEW, existing)).toEqual([]);
  });

  it("detects a simple overlap for one person", () => {
    const e = event("e1", "alice", "2024-06-01T10:30:00Z", "2024-06-01T11:30:00Z");
    const result = detectConflicts(NEW, [e]);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("alice");
    expect(result[0].events).toEqual([e]);
  });

  it("groups multiple overlapping events for the same person", () => {
    const e1 = event("e1", "alice", "2024-06-01T09:30:00Z", "2024-06-01T10:30:00Z");
    const e2 = event("e2", "alice", "2024-06-01T10:45:00Z", "2024-06-01T11:15:00Z");
    const result = detectConflicts(NEW, [e1, e2]);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("alice");
    expect(result[0].events).toHaveLength(2);
  });

  it("returns one entry per person when multiple people have conflicts", () => {
    const eA = event("e1", "alice", "2024-06-01T10:30:00Z", "2024-06-01T11:30:00Z");
    const eB = event("e2", "bob", "2024-06-01T09:00:00Z", "2024-06-01T10:30:00Z");
    const result = detectConflicts(NEW, [eA, eB]);
    expect(result).toHaveLength(2);
    const userIds = result.map((r) => r.userId).sort();
    expect(userIds).toEqual(["alice", "bob"]);
  });

  it("ignores all-day events", () => {
    const e = event("e1", "alice", "2024-06-01T00:00:00Z", "2024-06-02T00:00:00Z", true);
    expect(detectConflicts(NEW, [e])).toEqual([]);
  });

  it("treats a touching-start boundary as non-overlapping", () => {
    // new event ends at 11:00; existing starts at 11:00 → no overlap (abutting)
    const e = event("e1", "alice", "2024-06-01T11:00:00Z", "2024-06-01T12:00:00Z");
    expect(detectConflicts(NEW, [e])).toEqual([]);
  });

  it("treats a touching-end boundary as non-overlapping", () => {
    // new event starts at 10:00; existing ends at 10:00 → no overlap (abutting)
    const e = event("e1", "alice", "2024-06-01T09:00:00Z", "2024-06-01T10:00:00Z");
    expect(detectConflicts(NEW, [e])).toEqual([]);
  });

  it("detects a fully contained existing event", () => {
    // existing 10:15–10:45 is fully inside new 10:00–11:00
    const e = event("e1", "alice", "2024-06-01T10:15:00Z", "2024-06-01T10:45:00Z");
    const result = detectConflicts(NEW, [e]);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("alice");
  });

  it("detects when new event is fully inside an existing event", () => {
    // existing 09:00–12:00 fully contains new 10:00–11:00
    const e = event("e1", "alice", "2024-06-01T09:00:00Z", "2024-06-01T12:00:00Z");
    const result = detectConflicts(NEW, [e]);
    expect(result).toHaveLength(1);
  });

  it("does not flag non-overlapping events for other users", () => {
    const overlap = event("e1", "alice", "2024-06-01T10:30:00Z", "2024-06-01T11:30:00Z");
    const noOverlap = event("e2", "bob", "2024-06-01T12:00:00Z", "2024-06-01T13:00:00Z");
    const result = detectConflicts(NEW, [overlap, noOverlap]);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("alice");
  });
});
