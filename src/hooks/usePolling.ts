'use client';

import { useEffect, useRef } from 'react';

interface UsePollingOptions {
  /** Polling is active only when enabled is true. */
  enabled: boolean;
  /** Polling interval in milliseconds. */
  intervalMs: number;
  /** Called when the fetcher returns a "completed" or "error" status. */
  onComplete?: (data: any) => void;
}

/**
 * Generic polling hook with auto-cleanup.
 *
 * Replaces duplicated setInterval + clearInterval logic
 * used for both ingestion and eval status polling.
 */
export function usePolling(
  fetcher: () => Promise<any>,
  options: UsePollingOptions
) {
  const { enabled, intervalMs, onComplete } = options;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return;

    const id = setInterval(async () => {
      try {
        const data = await fetcherRef.current();
        if (data?.status === 'completed' || data?.status === 'error') {
          onComplete?.(data);
        }
      } catch (err) {
        console.error('[usePolling] fetch error:', err);
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [enabled, intervalMs, onComplete]);
}
