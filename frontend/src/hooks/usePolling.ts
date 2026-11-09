import { useCallback, useEffect, useRef, useState } from 'react';

export interface PollingState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches immediately and then every `intervalMs`. When a refresh fails the last good data is
 * kept (and `error` is set), so a short server outage does not blank the page.
 * Changing `key` resets the state and starts over (e.g. a different student ID).
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, key: string): PollingState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const runRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let active = true;
    setData(undefined);
    setError(undefined);
    setLoading(true);
    setLastUpdated(null);

    const run = async () => {
      try {
        const result = await fetcherRef.current();
        if (!active) return;
        setData(result);
        setError(undefined);
        setLastUpdated(new Date());
      } catch (e) {
        if (active) setError(e);
      } finally {
        if (active) setLoading(false);
      }
    };

    runRef.current = run;
    void run();
    const id = setInterval(run, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [key, intervalMs]);

  const refresh = useCallback(() => runRef.current(), []);

  return { data, error, loading, lastUpdated, refresh };
}
