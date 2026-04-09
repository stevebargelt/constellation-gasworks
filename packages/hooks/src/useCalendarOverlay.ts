import { useCallback, useEffect, useState } from "react";
import type { VisibleCalendarEvent } from "@constellation/types";
import { supabase, getCalendarEvents } from "@constellation/api";

interface CalendarOverlayState {
  eventsByOwner: Record<string, VisibleCalendarEvent[]>;
  loading: boolean;
  error: Error | null;
}

export function useCalendarOverlay(
  ownerIds: string[],
  range?: { start: string; end: string }
): CalendarOverlayState {
  const [eventsByOwner, setEventsByOwner] = useState<Record<string, VisibleCalendarEvent[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const ownerKey = ownerIds.join(",");

  const load = useCallback(() => {
    if (!ownerIds.length) {
      setEventsByOwner({});
      return;
    }
    setLoading(true);
    getCalendarEvents({ ownerIds, range })
      .then((events) => {
        // Group by creator_id (ownerId). Permission-masked events from the
        // visible_calendar_events view already have title/description/location
        // replaced with 'Busy' / null by the database-level field masking.
        const grouped: Record<string, VisibleCalendarEvent[]> = {};
        for (const event of events) {
          const key = event.creator_id;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(event);
        }
        setEventsByOwner(grouped);
      })
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [ownerKey, range?.start, range?.end]);

  useEffect(() => {
    load();

    if (!ownerIds.length) return;

    // Subscribe to Realtime changes for any of the overlay owners.
    // The visible_calendar_events view + RLS controls what each owner can see.
    const channel = supabase
      .channel(`calendar-overlay-${ownerKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events" },
        () => { load(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load, ownerKey]);

  return { eventsByOwner, loading, error };
}
