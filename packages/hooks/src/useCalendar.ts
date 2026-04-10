import { useCallback, useEffect, useRef, useState } from "react";
import type { CalendarEvent, EventAttendee, VisibleCalendarEvent } from "@constellation/types";
import {
  supabase,
  createCalendarEvent,
  deleteCalendarEvent,
  deleteRecurringCalendarEvent,
  getCalendarEvents,
  updateCalendarEvent,
  updateRecurringCalendarEvent,
  type RecurringEditMode,
} from "@constellation/api";
import { expandRecurringEvents } from "@constellation/utils";

interface CalendarState {
  events: VisibleCalendarEvent[];
  invites: EventAttendee[];
  loading: boolean;
  error: Error | null;
  create: (event: Omit<CalendarEvent, "id" | "creator_id" | "created_at">) => Promise<CalendarEvent | null>;
  update: (id: string, updates: Partial<Omit<CalendarEvent, "id" | "creator_id" | "created_at">>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  updateOccurrence: (
    parentId: string,
    occurrenceStart: string,
    updates: Partial<Omit<CalendarEvent, "id" | "creator_id" | "created_at">>,
    mode: RecurringEditMode
  ) => Promise<void>;
  removeOccurrence: (
    parentId: string,
    occurrenceStart: string,
    mode: RecurringEditMode
  ) => Promise<void>;
}

export function useCalendar(range?: { start: string; end: string }): CalendarState {
  const [events, setEvents] = useState<VisibleCalendarEvent[]>([]);
  const [invites, setInvites] = useState<EventAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const uidRef = useRef<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    // Fetch raw events (including recurring parents) then expand client-side.
    getCalendarEvents({ range })
      .then((raw) => {
        if (range) {
          const expanded = expandRecurringEvents(raw as CalendarEvent[], {
            start: new Date(range.start),
            end: new Date(range.end),
          });
          setEvents(expanded as VisibleCalendarEvent[]);
        } else {
          setEvents(raw);
        }
      })
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [range?.start, range?.end]);

  const loadInvites = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("event_attendees")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "invited");
    setInvites((data as EventAttendee[]) ?? []);
  }, []);

  useEffect(() => {
    load();
    loadInvites();

    let sharedChannel: ReturnType<typeof supabase.channel> | null = null;
    let userChannel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const id = Math.random().toString(36).slice(2);

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      uidRef.current = user.id;
      const uid = user.id;

      sharedChannel = supabase
        .channel(`cal-events:${uid}:${id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "calendar_events" },
          (payload) => {
            // Optimistic insert — reconcile with full load to pick up viewer_permission.
            const newEvent = payload.new as VisibleCalendarEvent;
            setEvents((prev) => {
              if (prev.some((e) => e.id === newEvent.id)) return prev;
              return [...prev, { ...newEvent, viewer_permission: "full" }];
            });
            load();
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "calendar_events" },
          (payload) => {
            const updated = payload.new as VisibleCalendarEvent;
            setEvents((prev) =>
              prev.map((e) =>
                e.id === updated.id ? { ...e, ...updated } : e
              )
            );
            load();
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "calendar_events" },
          (payload) => {
            const deleted = payload.old as { id: string };
            setEvents((prev) => prev.filter((e) => e.id !== deleted.id));
            load();
          }
        )
        .subscribe();

      userChannel = supabase
        .channel(`cal-attendees:${uid}:${id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "event_attendees",
            filter: `user_id=eq.${uid}`,
          },
          () => {
            // Reload invites on any attendee row change (invite received,
            // status updated, row deleted when removed).
            loadInvites();
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (sharedChannel) supabase.removeChannel(sharedChannel);
      if (userChannel) supabase.removeChannel(userChannel);
    };
  }, [load, loadInvites]);

  const create = async (event: Omit<CalendarEvent, "id" | "creator_id" | "created_at">): Promise<CalendarEvent | null> => {
    const created = await createCalendarEvent(event);
    load();
    return created;
  };

  const update = async (id: string, updates: Partial<Omit<CalendarEvent, "id" | "creator_id" | "created_at">>) => {
    await updateCalendarEvent(id, updates);
    load();
  };

  const remove = async (id: string) => {
    await deleteCalendarEvent(id);
    load();
  };

  const updateOccurrence = async (
    parentId: string,
    occurrenceStart: string,
    updates: Partial<Omit<CalendarEvent, "id" | "creator_id" | "created_at">>,
    mode: RecurringEditMode
  ) => {
    await updateRecurringCalendarEvent(parentId, occurrenceStart, updates, mode);
    load();
  };

  const removeOccurrence = async (
    parentId: string,
    occurrenceStart: string,
    mode: RecurringEditMode
  ) => {
    await deleteRecurringCalendarEvent(parentId, occurrenceStart, mode);
    load();
  };

  return { events, invites, loading, error, create, update, remove, updateOccurrence, removeOccurrence };
}
