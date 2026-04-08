import { useCallback, useEffect, useState } from "react";
import type { CalendarEvent, VisibleCalendarEvent } from "@constellation/types";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  updateCalendarEvent,
} from "@constellation/api";

interface CalendarState {
  events: VisibleCalendarEvent[];
  loading: boolean;
  error: Error | null;
  create: (event: Omit<CalendarEvent, "id" | "creator_id" | "created_at">) => Promise<void>;
  update: (id: string, updates: Partial<Omit<CalendarEvent, "id" | "creator_id" | "created_at">>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useCalendar(range?: { start: string; end: string }): CalendarState {
  const [events, setEvents] = useState<VisibleCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getCalendarEvents({ range })
      .then(setEvents)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [range?.start, range?.end]);

  useEffect(() => { load(); }, [load]);

  const create = async (event: Omit<CalendarEvent, "id" | "creator_id" | "created_at">) => {
    await createCalendarEvent(event);
    load();
  };

  const update = async (id: string, updates: Partial<Omit<CalendarEvent, "id" | "creator_id" | "created_at">>) => {
    await updateCalendarEvent(id, updates);
    load();
  };

  const remove = async (id: string) => {
    await deleteCalendarEvent(id);
    load();
  };

  return { events, loading, error, create, update, remove };
}
