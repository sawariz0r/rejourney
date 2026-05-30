import { gunzipSync } from 'zlib';
import { normalizeHeatmapScreenName } from './heatmapScreens.js';

const EVENT_TYPE_INCREMENTAL = 3;
const EVENT_TYPE_META = 4;
const INCREMENTAL_MOUSE_MOVE = 1;
const INCREMENTAL_MOUSE_INTERACTION = 2;
const INCREMENTAL_SCROLL = 3;
const INCREMENTAL_VIEWPORT_RESIZE = 4;
const INCREMENTAL_TOUCH_MOVE = 6;
const INTERACTION_CLICK = 2;
const INTERACTION_DBL_CLICK = 4;
const INTERACTION_TOUCH_START = 7;
const INTERACTION_TOUCH_END = 9;

// --- Attention weighting, grounded in eye-tracking / web-engagement research ---
// Fixations (the eye pauses where reading actually happens) last ~150-300ms; shorter gaps are
// saccades or active cursor motion, not reading. Chartbeat's engaged-time work finds a user who
// is inactive for >5s is no longer looking, so one gap credits at most ~5s of engaged time, and
// very long gaps are treated as the user having stepped away (only a small residual counts).
const FIXATION_MIN_MS = 150;
const ENGAGED_DWELL_CAP_MS = 5_000;
const IDLE_ABANDON_MS = 20_000;
const IDLE_RESIDUAL_FACTOR = 0.35;

// The mouse cursor is only a moderate gaze proxy (reported r ≈ 0.2-0.4, and the eyes lead the
// cursor by ~300ms); while reading, the cursor is frequently parked away from where the eyes are.
// So a fixation's engaged time is split: part credited to the resting cursor (a real but noisy
// signal) and the rest distributed across the empirical reading layout below.
const CURSOR_DWELL_SHARE = 0.45;
const READING_DWELL_SHARE = 0.55;
const CURSOR_MOVE_WEIGHT = 40;

// Vertical reading distribution within a viewport. Eye-tracking shows ~68% of attention falls in
// the top half of the screen and ~86% in the top two-thirds (F-pattern), so weights decay top→bottom.
const READ_BAND_ROWS = [
    { frac: 0.06, weight: 0.95 },
    { frac: 0.18, weight: 0.85 },
    { frac: 0.31, weight: 0.74 },
    { frac: 0.43, weight: 0.63 },
    { frac: 0.56, weight: 0.52 },
    { frac: 0.68, weight: 0.42 },
    { frac: 0.81, weight: 0.31 },
    { frac: 0.93, weight: 0.21 },
];
// Horizontal reading distribution. The F-pattern concentrates fixations on the left — the first
// words of each line draw more attention than the right edge — so weights decay left→right.
const READ_BAND_COLUMNS = [
    { frac: 0.12, weight: 1.0 },
    { frac: 0.28, weight: 0.82 },
    { frac: 0.44, weight: 0.66 },
    { frac: 0.60, weight: 0.52 },
    { frac: 0.76, weight: 0.40 },
    { frac: 0.90, weight: 0.30 },
];
const GRID_COLUMNS = 64;
const GRID_ROWS = 160;
const TOUCH_PRIOR_BUCKET_LIMIT = 300;
const DWELL_DEPTH_BUCKETS = 100;

// Converts the raw gap between two events into "engaged" attention time: below a fixation floor
// nothing is credited, continuous engagement is capped at ~5s, and long idle gaps (user stepped
// away) contribute only a small residual rather than the full cap.
function engagedDwellMs(gapMs: number): number {
    if (!Number.isFinite(gapMs) || gapMs < FIXATION_MIN_MS) return 0;
    if (gapMs <= ENGAGED_DWELL_CAP_MS) return gapMs;
    if (gapMs <= IDLE_ABANDON_MS) return ENGAGED_DWELL_CAP_MS;
    return ENGAGED_DWELL_CAP_MS * IDLE_RESIDUAL_FACTOR;
}

export type WebAttentionHotspot = {
    x: number;
    y: number;
    intensity: number;
    isRageTap: boolean;
    kind: 'attention' | 'touch' | 'rage';
    // Total engaged dwell (ms) credited to this bucket across all sampled sessions. Only
    // populated for attention dwell; cursor-move/click/touch weights do not contribute.
    dwellMs: number;
};

export type WebAttentionHeatmapDimensions = {
    pageWidth: number | null;
    pageHeight: number | null;
    viewportWidth: number | null;
    viewportHeight: number | null;
};

export type WebAttentionHeatmapResult = WebAttentionHeatmapDimensions & {
    hotspots: WebAttentionHotspot[];
    sampledSessions: number;
    avgSessionDurationMs: number | null;
    // Total engaged dwell time (ms, summed across all sampled sessions) at each depth down the
    // full document, in DWELL_DEPTH_BUCKETS equal slices top→bottom. Built from every dwell point
    // before the lossy top-hotspot cut, so hovering any depth recovers real time-spent rather than
    // the near-zeros the sparse hotspot list would give.
    dwellByDepth: number[];
    eventCount: number;
    generatedAt: string;
    confidence: 'high' | 'medium' | 'low';
};

export type WebAttentionTouchPrior = {
    touchBuckets?: Record<string, number> | null;
    rageTapBuckets?: Record<string, number> | null;
    totalTouches?: number | null;
    totalRageTaps?: number | null;
};

type AttentionPoint = {
    x: number;
    y: number;
    weight: number;
    kind: 'attention' | 'touch' | 'rage';
    dwellMs: number;
};

type RrwebSessionInput = {
    events: any[];
    dimensions?: Partial<WebAttentionHeatmapDimensions>;
    durationMs?: number | null;
};

function parseMaybeGzippedJson(data: Buffer, s3ObjectKey?: string | null): any {
    const isGzipped = (data.length > 2 && data[0] === 0x1f && data[1] === 0x8b) ||
        Boolean(s3ObjectKey?.endsWith('.gz'));
    if (!isGzipped) return JSON.parse(data.toString('utf8'));

    try {
        return JSON.parse(gunzipSync(data).toString('utf8'));
    } catch {
        return JSON.parse(data.toString('utf8'));
    }
}

export function extractRrwebEventsFromArtifact(data: Buffer, s3ObjectKey?: string | null): {
    events: any[];
    page: Record<string, unknown> | null;
    viewport: Record<string, unknown> | null;
} {
    const parsed = parseMaybeGzippedJson(data, s3ObjectKey);
    const events = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed?.events) ? parsed.events : []);
    return {
        events,
        page: parsed?.page && typeof parsed.page === 'object' ? parsed.page : null,
        viewport: parsed?.viewport && typeof parsed.viewport === 'object' ? parsed.viewport : null,
    };
}

function positiveNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function clampUnit(value: number): number {
    return Math.max(0.004, Math.min(0.996, value));
}

function readDimension(source: Record<string, unknown> | null | undefined, keys: string[]): number | null {
    if (!source) return null;
    for (const key of keys) {
        const value = positiveNumber(source[key]);
        if (value) return value;
    }
    return null;
}

function mergeDimensions(
    current: WebAttentionHeatmapDimensions,
    incoming?: Partial<WebAttentionHeatmapDimensions> | null,
): WebAttentionHeatmapDimensions {
    if (!incoming) return current;
    return {
        pageWidth: Math.max(current.pageWidth ?? 0, positiveNumber(incoming.pageWidth) ?? 0) || current.pageWidth,
        pageHeight: Math.max(current.pageHeight ?? 0, positiveNumber(incoming.pageHeight) ?? 0) || current.pageHeight,
        viewportWidth: Math.max(current.viewportWidth ?? 0, positiveNumber(incoming.viewportWidth) ?? 0) || current.viewportWidth,
        viewportHeight: Math.max(current.viewportHeight ?? 0, positiveNumber(incoming.viewportHeight) ?? 0) || current.viewportHeight,
    };
}

function bucketKey(x: number, y: number): string {
    const bx = Math.floor(clampUnit(x) * GRID_COLUMNS);
    const by = Math.floor(clampUnit(y) * GRID_ROWS);
    return `${bx}:${by}`;
}

function eventTimestamp(event: any, fallback: number): number {
    const timestamp = Number(event?.timestamp);
    return Number.isFinite(timestamp) ? timestamp : fallback;
}

function positiveDurationMs(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function durationMsFromEvents(events: any[]): number | null {
    let first = Number.POSITIVE_INFINITY;
    let last = Number.NEGATIVE_INFINITY;
    for (const event of events) {
        const timestamp = Number(event?.timestamp);
        if (!Number.isFinite(timestamp)) continue;
        first = Math.min(first, timestamp);
        last = Math.max(last, timestamp);
    }
    return Number.isFinite(first) && Number.isFinite(last) && last > first
        ? last - first
        : null;
}

function addPoint(
    points: AttentionPoint[],
    rawX: unknown,
    rawY: unknown,
    frame: WebAttentionHeatmapDimensions,
    scrollX: number,
    scrollY: number,
    weight: number,
    kind: AttentionPoint['kind'],
    dwellMs = 0,
): void {
    const viewportWidth = frame.viewportWidth ?? frame.pageWidth ?? 0;
    const viewportHeight = frame.viewportHeight ?? frame.pageHeight ?? 0;
    const pageWidth = frame.pageWidth ?? viewportWidth;
    const pageHeight = frame.pageHeight ?? viewportHeight;
    const x = Number(rawX);
    const y = Number(rawY);

    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || pageWidth <= 0 || pageHeight <= 0) {
        return;
    }

    const documentX = Math.max(0, Math.min(pageWidth, x + scrollX));
    const documentY = Math.max(0, Math.min(pageHeight, y + scrollY));
    points.push({
        x: documentX / pageWidth,
        y: documentY / pageHeight,
        weight,
        kind,
        dwellMs,
    });
}

// Spreads dwell time across the visible viewport as a soft, full-width "read band"
// (warmer near the top, following the F-pattern) instead of a single center point,
// which previously painted a hard vertical heat stripe down the middle of every page.
function addReadBand(
    points: AttentionPoint[],
    frame: WebAttentionHeatmapDimensions,
    scrollX: number,
    scrollY: number,
    weight: number,
): void {
    const viewportWidth = frame.viewportWidth ?? 0;
    const viewportHeight = frame.viewportHeight ?? 0;
    if (viewportWidth <= 0 || viewportHeight <= 0 || weight <= 0) return;

    let normalizer = 0;
    for (const row of READ_BAND_ROWS) {
        for (const col of READ_BAND_COLUMNS) {
            normalizer += row.weight * col.weight;
        }
    }
    if (normalizer <= 0) return;

    for (const row of READ_BAND_ROWS) {
        for (const col of READ_BAND_COLUMNS) {
            const cellWeight = (weight * row.weight * col.weight) / normalizer;
            if (cellWeight <= 0) continue;
            addPoint(points, viewportWidth * col.frac, viewportHeight * row.frac, frame, scrollX, scrollY, cellWeight, 'attention', cellWeight);
        }
    }
}

function addNormalizedPoint(
    points: AttentionPoint[],
    x: number,
    y: number,
    weight: number,
    kind: AttentionPoint['kind'],
): void {
    if (!Number.isFinite(x) || !Number.isFinite(y) || weight <= 0) return;
    points.push({
        x: clampUnit(x),
        y: clampUnit(y),
        weight,
        kind,
        dwellMs: 0,
    });
}

function parsePriorBucket(bucket: string): { x: number; y: number } | null {
    const [xStr, yStr] = bucket.includes(',') ? bucket.split(',') : bucket.split(':');
    const x = Number(xStr);
    const y = Number(yStr);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
}

function readPositiveBucketEntries(buckets?: Record<string, number> | null): Array<[string, number]> {
    if (!buckets || typeof buckets !== 'object') return [];
    return Object.entries(buckets)
        .map(([bucket, value]) => [bucket, Number(value)] as [string, number])
        .filter(([, value]) => Number.isFinite(value) && value > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOUCH_PRIOR_BUCKET_LIMIT);
}

function addTouchPriorPoints(
    points: AttentionPoint[],
    prior: WebAttentionTouchPrior | null | undefined,
    hasReplaySignals: boolean,
): number {
    if (!prior) return 0;

    const touchEntries = readPositiveBucketEntries(prior.touchBuckets);
    const rageEntries = readPositiveBucketEntries(prior.rageTapBuckets);
    const maxTouch = Math.max(1, ...touchEntries.map(([, count]) => count));
    const maxRage = Math.max(1, ...rageEntries.map(([, count]) => count));
    // When live replay dwell signals exist, clicks/rage taps are only a light accent on top
    // of the attention surface; without replay they carry the whole map, so weight them fully.
    const touchBaseWeight = hasReplaySignals ? 320 : 1_850;
    const rageBaseWeight = hasReplaySignals ? 900 : 3_700;
    let bucketSignalCount = 0;

    for (const [bucket, count] of touchEntries) {
        const point = parsePriorBucket(bucket);
        if (!point) continue;
        bucketSignalCount += count;
        const relative = Math.sqrt(count / maxTouch);
        const volume = Math.log1p(count) / Math.log1p(maxTouch);
        addNormalizedPoint(
            points,
            point.x,
            point.y,
            touchBaseWeight * (0.45 + relative * 0.55) * Math.max(0.3, volume),
            'touch',
        );
    }

    for (const [bucket, count] of rageEntries) {
        const point = parsePriorBucket(bucket);
        if (!point) continue;
        bucketSignalCount += count;
        const relative = Math.sqrt(count / maxRage);
        addNormalizedPoint(points, point.x, point.y, rageBaseWeight * (0.5 + relative * 0.5), 'rage');
    }

    return Math.max(
        bucketSignalCount,
        Number(prior.totalTouches ?? 0) + Number(prior.totalRageTaps ?? 0),
    );
}

function routeHintFromEvent(event: any): string | null {
    const data = event?.data && typeof event.data === 'object' ? event.data : {};
    const payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
    const candidates = [
        data.href,
        data.url,
        data.location,
        data.route,
        data.screen,
        data.screenName,
        payload.href,
        payload.url,
        payload.location,
        payload.route,
        payload.screen,
        payload.screenName,
        event?.href,
        event?.url,
        event?.route,
        event?.screen,
        event?.screenName,
    ];

    for (const candidate of candidates) {
        if (typeof candidate !== 'string') continue;
        const normalized = normalizeHeatmapScreenName(candidate);
        if (normalized) return normalized;
    }
    return null;
}

function hasMatchingRouteHint(events: any[], routeName: string | null | undefined): boolean {
    const normalizedRouteName = normalizeHeatmapScreenName(routeName);
    if (!normalizedRouteName) return false;
    return events.some((event) => routeHintFromEvent(event) === normalizedRouteName);
}

// Sums every dwell point's engaged ms into equal-height depth slices down the full document. This
// keeps the complete time-spent signal (the top-hotspot list throws most of it away), so the hover
// can report real average time at any depth instead of zeros wherever no hotspot survived the cut.
function buildDwellDepthProfile(points: AttentionPoint[]): number[] {
    const profile = new Array<number>(DWELL_DEPTH_BUCKETS).fill(0);
    for (const point of points) {
        if (point.dwellMs <= 0 || !Number.isFinite(point.y)) continue;
        const index = Math.min(DWELL_DEPTH_BUCKETS - 1, Math.max(0, Math.floor(clampUnit(point.y) * DWELL_DEPTH_BUCKETS)));
        profile[index] += point.dwellMs;
    }
    return profile.map((value) => Math.round(value));
}

function aggregateHotspots(points: AttentionPoint[]): WebAttentionHotspot[] {
    const buckets = new Map<string, { xSum: number; ySum: number; weight: number; rageWeight: number; touchWeight: number; dwellMs: number }>();
    for (const point of points) {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.weight <= 0) continue;
        const key = bucketKey(point.x, point.y);
        const current = buckets.get(key) ?? { xSum: 0, ySum: 0, weight: 0, rageWeight: 0, touchWeight: 0, dwellMs: 0 };
        current.xSum += clampUnit(point.x) * point.weight;
        current.ySum += clampUnit(point.y) * point.weight;
        current.weight += point.weight;
        current.dwellMs += point.dwellMs;
        if (point.kind === 'rage') current.rageWeight += point.weight;
        if (point.kind === 'touch') current.touchWeight += point.weight;
        buckets.set(key, current);
    }

    const maxWeight = Math.max(1, ...Array.from(buckets.values()).map((bucket) => bucket.weight));
    return Array.from(buckets.values())
        .map((bucket) => {
            const kind = bucket.rageWeight > 0
                ? 'rage'
                : bucket.touchWeight / Math.max(bucket.weight, 1) > 0.35
                    ? 'touch'
                    : 'attention';
            return {
                x: Number((bucket.xSum / bucket.weight).toFixed(4)),
                y: Number((bucket.ySum / bucket.weight).toFixed(4)),
                intensity: Number(Math.min(1, Math.pow(bucket.weight / maxWeight, 0.72)).toFixed(3)),
                isRageTap: kind === 'rage',
                kind,
                dwellMs: Math.round(bucket.dwellMs),
            } satisfies WebAttentionHotspot;
        })
        .sort((a, b) => b.intensity - a.intensity)
        .slice(0, 80);
}

export function buildWebAttentionHeatmap(
    sessions: RrwebSessionInput[],
    fallbackDimensions: Partial<WebAttentionHeatmapDimensions> = {},
    touchPrior?: WebAttentionTouchPrior | null,
    routeName?: string | null,
): WebAttentionHeatmapResult {
    let dimensions: WebAttentionHeatmapDimensions = mergeDimensions({
        pageWidth: null,
        pageHeight: null,
        viewportWidth: null,
        viewportHeight: null,
    }, fallbackDimensions);
    const points: AttentionPoint[] = [];
    let eventCount = 0;
    let sampledSessions = 0;
    let sessionDurationSumMs = 0;
    let sessionDurationCount = 0;
    const normalizedRouteName = normalizeHeatmapScreenName(routeName);

    for (const session of sessions) {
        const events = [...(session.events || [])]
            .filter((event) => event && typeof event === 'object')
            .sort((a, b) => eventTimestamp(a, 0) - eventTimestamp(b, 0));
        if (events.length === 0) continue;

        sampledSessions += 1;
        eventCount += events.length;
        const durationMs = positiveDurationMs(session.durationMs) ?? durationMsFromEvents(events);
        if (durationMs) {
            sessionDurationSumMs += durationMs;
            sessionDurationCount += 1;
        }
        dimensions = mergeDimensions(dimensions, session.dimensions);

        let scrollX = 0;
        let scrollY = 0;
        let viewportWidth = dimensions.viewportWidth ?? dimensions.pageWidth ?? 1440;
        let viewportHeight = dimensions.viewportHeight ?? 900;
        let pageWidth = dimensions.pageWidth ?? viewportWidth;
        let pageHeight = dimensions.pageHeight ?? viewportHeight;
        let lastCursor: { x: number; y: number } | null = null;
        let lastEventAt = eventTimestamp(events[0], Date.now());
        const shouldRouteScope = hasMatchingRouteHint(events, normalizedRouteName);
        let routeActive = !shouldRouteScope;

        const currentFrame = (): WebAttentionHeatmapDimensions => ({
            pageWidth,
            pageHeight,
            viewportWidth,
            viewportHeight,
        });

        for (const event of events) {
            const timestamp = eventTimestamp(event, lastEventAt);
            const engaged = engagedDwellMs(timestamp - lastEventAt);
            if (engaged > 0 && routeActive) {
                // Split each fixation's engaged time between the (noisy) resting-cursor signal and
                // the empirical reading layout, since the cursor only weakly tracks the gaze.
                if (lastCursor) {
                    const cursorDwell = engaged * CURSOR_DWELL_SHARE;
                    addPoint(points, lastCursor.x, lastCursor.y, currentFrame(), scrollX, scrollY, cursorDwell, 'attention', cursorDwell);
                }
                addReadBand(points, currentFrame(), scrollX, scrollY, engaged * READING_DWELL_SHARE);
            }

            const routeHint = normalizedRouteName ? routeHintFromEvent(event) : null;
            if (routeHint && shouldRouteScope) {
                const wasRouteActive = routeActive;
                routeActive = routeHint === normalizedRouteName;
                if (wasRouteActive !== routeActive) {
                    lastCursor = null;
                    if (routeActive) {
                        scrollX = 0;
                        scrollY = 0;
                    }
                }
            }

            if (event.type === EVENT_TYPE_META && event.data) {
                viewportWidth = positiveNumber(event.data.width) ?? viewportWidth;
                viewportHeight = positiveNumber(event.data.height) ?? viewportHeight;
                pageWidth = Math.max(pageWidth, viewportWidth);
                pageHeight = Math.max(pageHeight, viewportHeight);
            }

            if (event.type === EVENT_TYPE_INCREMENTAL && event.data) {
                const source = Number(event.data.source);
                if (source === INCREMENTAL_VIEWPORT_RESIZE) {
                    viewportWidth = positiveNumber(event.data.width) ?? viewportWidth;
                    viewportHeight = positiveNumber(event.data.height) ?? viewportHeight;
                    pageWidth = Math.max(pageWidth, viewportWidth);
                    pageHeight = Math.max(pageHeight, viewportHeight);
                } else if (source === INCREMENTAL_SCROLL) {
                    scrollX = Math.max(0, Number(event.data.x) || 0);
                    scrollY = Math.max(0, Number(event.data.y) || 0);
                    if (routeActive) {
                        pageWidth = Math.max(pageWidth, scrollX + viewportWidth);
                        pageHeight = Math.max(pageHeight, scrollY + viewportHeight);
                    }
                } else if (source === INCREMENTAL_MOUSE_MOVE || source === INCREMENTAL_TOUCH_MOVE) {
                    // A mousemove batch is a cursor *path*. Record only where it ends (a light
                    // baseline weight); the resting time is credited as a fixation via dwell above,
                    // so we no longer flood the whole trail with attention points.
                    const positions = Array.isArray(event.data.positions) ? event.data.positions : [];
                    let lastValid: { x: number; y: number } | null = null;
                    for (const position of positions) {
                        if (Number.isFinite(Number(position?.x)) && Number.isFinite(Number(position?.y))) {
                            lastValid = { x: Number(position.x), y: Number(position.y) };
                        }
                    }
                    if (lastValid) {
                        if (routeActive) {
                            addPoint(points, lastValid.x, lastValid.y, currentFrame(), scrollX, scrollY, CURSOR_MOVE_WEIGHT, 'attention');
                        }
                        lastCursor = lastValid;
                    }
                } else if (source === INCREMENTAL_MOUSE_INTERACTION) {
                    const interactionType = Number(event.data.type);
                    const isTouchOrClick = interactionType === INTERACTION_CLICK ||
                        interactionType === INTERACTION_DBL_CLICK ||
                        interactionType === INTERACTION_TOUCH_START ||
                        interactionType === INTERACTION_TOUCH_END;
                    if (isTouchOrClick && routeActive) {
                        const kind = interactionType === INTERACTION_DBL_CLICK ? 'rage' : 'touch';
                        addPoint(points, event.data.x, event.data.y, currentFrame(), scrollX, scrollY, kind === 'rage' ? 2_800 : 1_600, kind);
                        if (Number.isFinite(Number(event.data.x)) && Number.isFinite(Number(event.data.y))) {
                            lastCursor = { x: Number(event.data.x), y: Number(event.data.y) };
                        }
                    }
                }
            }

            lastEventAt = timestamp;
        }

        dimensions = mergeDimensions(dimensions, {
            pageWidth,
            pageHeight,
            viewportWidth,
            viewportHeight,
        });
    }

    const priorSignalCount = addTouchPriorPoints(points, touchPrior, sampledSessions > 0 && eventCount > 0);
    const hotspots = aggregateHotspots(points);
    const dwellByDepth = buildDwellDepthProfile(points);
    const confidence = (sampledSessions >= 12 && eventCount >= 1200) || (sampledSessions >= 4 && priorSignalCount >= 80)
        ? 'high'
        : (sampledSessions >= 4 && eventCount >= 250) || priorSignalCount >= 12 || (sampledSessions >= 2 && eventCount >= 100)
            ? 'medium'
            : 'low';

    return {
        hotspots,
        sampledSessions,
        avgSessionDurationMs: sessionDurationCount > 0
            ? Math.round(sessionDurationSumMs / sessionDurationCount)
            : null,
        dwellByDepth,
        eventCount,
        generatedAt: new Date().toISOString(),
        confidence,
        pageWidth: dimensions.pageWidth ?? dimensions.viewportWidth ?? null,
        pageHeight: dimensions.pageHeight ?? dimensions.viewportHeight ?? null,
        viewportWidth: dimensions.viewportWidth ?? null,
        viewportHeight: dimensions.viewportHeight ?? null,
    };
}

export function dimensionsFromRrwebEnvelope(
    page: Record<string, unknown> | null,
    viewport: Record<string, unknown> | null,
): Partial<WebAttentionHeatmapDimensions> {
    return {
        pageWidth: readDimension(page, ['width', 'pageWidth', 'documentWidth']),
        pageHeight: readDimension(page, ['height', 'pageHeight', 'documentHeight']),
        viewportWidth: readDimension(viewport, ['width', 'viewportWidth']),
        viewportHeight: readDimension(viewport, ['height', 'viewportHeight']),
    };
}
