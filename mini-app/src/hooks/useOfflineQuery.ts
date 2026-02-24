import { useState, useEffect } from "react";
import { useOfflineCache } from "./useOfflineCache";

interface UseOfflineQueryOptions<T> {
  queryKey: string;
  queryFn: () => Promise<T>;
  enabled?: boolean;
  staleTime?: number; // ms, default 5 min
}

export function useOfflineQuery<T>({ queryKey, queryFn, enabled = true, staleTime = 5 * 60 * 1000 }: UseOfflineQueryOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const { isOnline, getItem, setItem } = useOfflineCache();

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      // Try cache first
      try {
        const cached = await getItem<T>(queryKey);
        if (cached && !cancelled) {
          setData(cached.data);
          setIsFromCache(true);
          // If cache is fresh enough and offline, stop here
          if (!isOnline || Date.now() - cached.ts < staleTime) {
            setLoading(false);
            if (!isOnline) return;
          }
        }
      } catch {}

      // Fetch from network
      if (isOnline) {
        try {
          const result = await queryFn();
          if (!cancelled) {
            setData(result);
            setIsFromCache(false);
            await setItem(queryKey, result);
          }
        } catch (e: unknown) {
          if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка загрузки");
        }
      }

      if (!cancelled) setLoading(false);
    };

    run();
    return () => { cancelled = true; };
  }, [queryKey, enabled, isOnline]);

  return { data, loading, error, isFromCache, isOnline };
}
