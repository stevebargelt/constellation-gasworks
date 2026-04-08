import { useEffect, useState } from "react";
import type { VisibleCalendarEvent } from "@constellation/types";
import { getCalendarEvents } from "@constellation/api";

interface CalendarOverlayState {
  events: VisibleCalendarEvent[];
  loading: boolean;
  error: Error | null;
}

export function useCalendarOverlay(
  ownerIds: string[],
  range?: { start: string; end: string }
): CalendarOverlayState {
  const [events, setEvents] = useState<VisibleCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ownerIds.length) {
      setEvents([]);
      return;
    }
    setLoading(true);
    getCalendarEvents({ ownerIds, range })
      .then(setEvents)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [ownerIds.join(","), range?.start, range?.end]);

  return { events, loading, error };
}
