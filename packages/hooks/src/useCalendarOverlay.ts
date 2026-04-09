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

    // One channel per overlay owner, named shared:{uid} per architecture.
    // Each channel multiplexes over the single Supabase Realtime connection
    // (free tier: 500 concurrent connections — client uses one with N channels).
    // RLS on visible_calendar_events controls which rows are returned on reconcile.
    const channels = ownerIds.map((uid) =>
      supabase
        .channel(`shared:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "calendar_events" },
          () => { load(); }
        )
        .subscribe()
    );

    return () => {
      for (const ch of channels) supabase.removeChannel(ch);
    };
  }, [load, ownerKey]);

  return { eventsByOwner, loading, error };
}
