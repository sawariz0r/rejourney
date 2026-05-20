/**
 * Client-side rrweb segment loader.
 *
 * When the backend's /core endpoint returns `rrwebReplay.loadMode === 'segments'`
 * (because the total payload exceeded RJ_REPLAY_CORE_INLINE_LIMIT_BYTES), the
 * `events` array is empty and the browser must download each segment directly
 * from R2 in parallel, then concatenate the events.
 *
 * For small sessions (loadMode === 'inline' or unset), `events` is already
 * populated server-side and this hook is a no-op pass-through.
 *
 * The parallel-from-R2 path is faster than the inline path for two reasons:
 *   1. R2 → browser is a direct edge-cached fetch with no API hop.
 *   2. Concurrency is bounded by the browser's per-origin connection cap (~6
 *      for HTTP/1.1, much higher for HTTP/2) — typically 6–10× concurrent.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

export type RrwebReplaySegment = {
    index: number;
    startTime: number | null;
    endTime: number | null;
    eventCount: number;
    sizeBytes: number | null;
    url: string | null;
};

export type RrwebReplayPayload = {
    events: any[];
    eventCount: number;
    segments: RrwebReplaySegment[];
    page?: Record<string, unknown> | null;
    viewport?: Record<string, unknown> | null;
    loadMode?: 'inline' | 'segments';
};

export type RrwebReplayLoaderState = {
    /** Merged + chronologically sorted events array (empty until loaded). */
    events: any[];
    /** True while client-side segment fetches are in flight. */
    isLoading: boolean;
    /** Number of segments fetched so far / total. Used for progress display. */
    progress: { loaded: number; total: number };
    /** Set if any segment failed to fetch (still returns events from successful segments). */
    error: string | null;
};

// Browsers cap concurrent connections per origin (HTTP/1.1: ~6, HTTP/2: many).
// R2 serves HTTP/2 so this is closer to a memory / CPU cap than a wire cap.
// 12 is a sane balance between parallelism and not pegging the main thread.
const SEGMENT_FETCH_CONCURRENCY = 12;

async function fetchOneSegment(url: string, signal: AbortSignal): Promise<any[]> {
    const response = await fetch(url, { signal, credentials: 'omit' });
    if (!response.ok) {
        throw new Error(`segment fetch ${response.status}`);
    }

    // Most rrweb segments are gzipped on R2; the browser transparently
    // decompresses based on Content-Encoding. If the artifact was stored as
    // raw .json.gz without that header, response.arrayBuffer() will give us
    // the gzipped bytes — try DecompressionStream as a fallback.
    const contentEncoding = response.headers.get('content-encoding');
    if (contentEncoding === 'gzip' || contentEncoding === 'br') {
        const parsed = await response.json();
        return Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.events) ? parsed.events : []);
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const isGzipMagic = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

    if (isGzipMagic && typeof DecompressionStream !== 'undefined') {
        const stream = new Response(buffer).body!.pipeThrough(new DecompressionStream('gzip'));
        const text = await new Response(stream).text();
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.events) ? parsed.events : []);
    }

    const text = new TextDecoder().decode(buffer);
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.events) ? parsed.events : []);
}

async function mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    if (items.length === 0) return [];
    const output: R[] = new Array(items.length);
    let cursor = 0;
    const workers = Math.max(1, Math.min(concurrency, items.length));

    async function worker(): Promise<void> {
        while (cursor < items.length) {
            const index = cursor++;
            output[index] = await mapper(items[index], index);
        }
    }
    await Promise.all(Array.from({ length: workers }, () => worker()));
    return output;
}

/**
 * Returns a unified events array regardless of whether the payload came
 * inline from /core or has to be assembled from R2 segments client-side.
 *
 * Designed to be a drop-in for `rrwebReplay?.events || []` consumers:
 * existing components just see the events array, with the loading state
 * exposed separately for an optional spinner / progress bar.
 */
export function useRrwebReplayEvents(rrwebReplay: RrwebReplayPayload | undefined | null): RrwebReplayLoaderState {
    const inlineEvents = useMemo(() => {
        return Array.isArray(rrwebReplay?.events) ? rrwebReplay!.events : [];
    }, [rrwebReplay]);

    const segments = useMemo(() => {
        return Array.isArray(rrwebReplay?.segments) ? rrwebReplay!.segments : [];
    }, [rrwebReplay]);

    const loadMode = rrwebReplay?.loadMode ?? 'inline';

    const [clientEvents, setClientEvents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState<{ loaded: number; total: number }>({ loaded: 0, total: 0 });
    const [error, setError] = useState<string | null>(null);

    // Stable key so we re-fetch when the actual segment set changes (different
    // session navigated to), not on every render.
    const segmentKey = useMemo(
        () => segments.map((s) => s.url ?? '').join('|'),
        [segments],
    );
    const lastKeyRef = useRef<string>('');

    useEffect(() => {
        if (loadMode !== 'segments') {
            // Inline mode — events are already in the payload, nothing to do.
            setClientEvents([]);
            setIsLoading(false);
            setProgress({ loaded: 0, total: 0 });
            setError(null);
            lastKeyRef.current = segmentKey;
            return;
        }

        if (lastKeyRef.current === segmentKey) return;
        lastKeyRef.current = segmentKey;

        const fetchable = segments.filter((s): s is RrwebReplaySegment & { url: string } => typeof s.url === 'string' && s.url.length > 0);
        if (fetchable.length === 0) {
            setClientEvents([]);
            setIsLoading(false);
            setProgress({ loaded: 0, total: 0 });
            return;
        }

        const abort = new AbortController();
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        setProgress({ loaded: 0, total: fetchable.length });

        (async () => {
            let loadedCount = 0;
            const results = await mapWithConcurrency(fetchable, SEGMENT_FETCH_CONCURRENCY, async (segment) => {
                try {
                    const events = await fetchOneSegment(segment.url, abort.signal);
                    loadedCount += 1;
                    if (!cancelled) setProgress({ loaded: loadedCount, total: fetchable.length });
                    return events;
                } catch (err) {
                    if ((err as any)?.name === 'AbortError') return [];
                    // Swallow individual segment failures — return events from the rest.
                    return [];
                }
            });
            if (cancelled) return;

            const merged: any[] = [];
            for (const arr of results) {
                if (arr && arr.length > 0) merged.push(...arr);
            }
            merged.sort((a, b) => (a?.timestamp || 0) - (b?.timestamp || 0));
            setClientEvents(merged);
            setIsLoading(false);
            if (merged.length === 0 && fetchable.length > 0) {
                setError('Failed to load any replay segments.');
            }
        })();

        return () => {
            cancelled = true;
            abort.abort();
        };
    }, [loadMode, segmentKey, segments]);

    if (loadMode === 'segments') {
        return { events: clientEvents, isLoading, progress, error };
    }
    return { events: inlineEvents, isLoading: false, progress: { loaded: 0, total: 0 }, error: null };
}
