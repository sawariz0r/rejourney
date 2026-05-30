import type {
    HeatmapHotspot,
    HeatmapIterationScreen,
    HeatmapIterationSummary,
    HeatmapOverviewResponse,
    HeatmapOverviewScreen,
    WebAttentionHeatmapResponse,
} from '~/shared/api/client';
import { demoReplayFixture as mobileReplayFixture } from './demoReplayDataFrankfurt';
import { demoReplayFixture as webReplayFixture } from './demoReplayDataWeb';

type DemoReplayFixture = typeof webReplayFixture | typeof mobileReplayFixture;
type DemoReplayEvent = Record<string, unknown> & {
    timestamp?: number;
    type?: string;
    x?: number;
    y?: number;
    scrollX?: number;
    scrollY?: number;
    viewportWidth?: number;
    viewportHeight?: number;
    documentWidth?: number;
    documentHeight?: number;
    screen?: string;
    screenName?: string;
    viewId?: string;
    frustrationKind?: string;
    gestureType?: string;
};

type DemoHeatmapScreen = HeatmapOverviewScreen & {
    platform: 'web' | 'ios' | 'android';
};

const WEB_DEMO_ROUTE = webReplayFixture.webLandingRoute || '/docs/web/getting-started';
const MOBILE_DEMO_SCREEN = 'Community';

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
const READ_BAND_COLUMNS = [0.12, 0.28, 0.44, 0.6, 0.76, 0.9];

const clampUnit = (value: number) => Math.max(0.004, Math.min(0.996, value));
const positiveNumber = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

function sortedEvents(fixture: DemoReplayFixture): DemoReplayEvent[] {
    return [...((fixture as { events?: DemoReplayEvent[] }).events || [])]
        .filter((event) => event && typeof event === 'object')
        .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
}

function getWebDimensions(events = sortedEvents(webReplayFixture)) {
    const viewportWidth = positiveNumber(events.find((event) => positiveNumber(event.viewportWidth))?.viewportWidth)
        ?? positiveNumber(webReplayFixture.rrwebReplay?.viewport?.width)
        ?? positiveNumber(webReplayFixture.deviceInfo.screenWidth)
        ?? 1280;
    const viewportHeight = positiveNumber(events.find((event) => positiveNumber(event.viewportHeight))?.viewportHeight)
        ?? positiveNumber(webReplayFixture.rrwebReplay?.viewport?.height)
        ?? positiveNumber(webReplayFixture.deviceInfo.screenHeight)
        ?? 900;
    const pageWidth = Math.max(
        viewportWidth,
        ...events.map((event) => positiveNumber(event.documentWidth) ?? 0),
    );
    const pageHeight = Math.max(
        viewportHeight,
        ...events.map((event) => positiveNumber(event.documentHeight) ?? 0),
    );

    return {
        pageWidth,
        pageHeight,
        viewportWidth,
        viewportHeight,
    };
}

function aggregatePoints(
    points: Array<{ x: number; y: number; weight: number; isRageTap: boolean; kind?: HeatmapHotspot['kind']; dwellMs?: number }>,
    limit: number,
): HeatmapHotspot[] {
    const buckets = new Map<string, {
        xTotal: number;
        yTotal: number;
        weight: number;
        rageWeight: number;
        touchWeight: number;
        dwellMs: number;
    }>();

    for (const point of points) {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.weight <= 0) continue;
        const x = clampUnit(point.x);
        const y = clampUnit(point.y);
        const bucketX = Math.floor(x * 64);
        const bucketY = Math.floor(y * 180);
        const key = `${bucketX}:${bucketY}:${point.kind || 'touch'}`;
        const current = buckets.get(key) || { xTotal: 0, yTotal: 0, weight: 0, rageWeight: 0, touchWeight: 0, dwellMs: 0 };
        current.xTotal += x * point.weight;
        current.yTotal += y * point.weight;
        current.weight += point.weight;
        current.dwellMs += point.dwellMs ?? 0;
        if (point.isRageTap || point.kind === 'rage') current.rageWeight += point.weight;
        if (point.kind === 'touch') current.touchWeight += point.weight;
        buckets.set(key, current);
    }

    const maxWeight = Math.max(1, ...Array.from(buckets.values()).map((bucket) => bucket.weight));
    return Array.from(buckets.values())
        .map((bucket) => {
            const kind: HeatmapHotspot['kind'] = bucket.rageWeight > 0
                ? 'rage'
                : bucket.touchWeight / Math.max(bucket.weight, 1) > 0.35
                    ? 'touch'
                    : 'attention';
            return {
                x: Number((bucket.xTotal / bucket.weight).toFixed(4)),
                y: Number((bucket.yTotal / bucket.weight).toFixed(4)),
                intensity: Number(Math.min(1, Math.pow(bucket.weight / maxWeight, 0.7)).toFixed(3)),
                isRageTap: kind === 'rage',
                kind,
                dwellMs: Math.round(bucket.dwellMs),
            };
        })
        .sort((a, b) => b.intensity - a.intensity)
        .slice(0, limit);
}

function buildWebTouchHotspots(): HeatmapHotspot[] {
    const events = sortedEvents(webReplayFixture);
    const { pageWidth, pageHeight } = getWebDimensions(events);
    const points = events
        .filter((event) => event.type === 'tap' || event.type === 'rage_tap')
        .map((event) => {
            const x = positiveNumber(event.x);
            const y = positiveNumber(event.y);
            if (!x || !y) return null;
            const isRageTap = event.type === 'rage_tap' || event.frustrationKind === 'rage_tap';
            const scrollX = Number(event.scrollX || 0);
            const scrollY = Number(event.scrollY || 0);
            return {
                x: (x + scrollX) / pageWidth,
                y: (y + scrollY) / pageHeight,
                weight: isRageTap ? 1.8 : 1,
                isRageTap,
                kind: isRageTap ? 'rage' as const : 'touch' as const,
            };
        })
        .filter((point): point is NonNullable<typeof point> => point !== null);

    return aggregatePoints(points, 18);
}

function engagedDwellMs(gapMs: number): number {
    if (!Number.isFinite(gapMs) || gapMs < 150) return 0;
    if (gapMs <= 5_000) return gapMs;
    if (gapMs <= 20_000) return 5_000;
    return 1_750;
}

const DWELL_DEPTH_BUCKETS = 100;

function buildWebAttentionHotspots(): { hotspots: HeatmapHotspot[]; dwellByDepth: number[] } {
    const events = sortedEvents(webReplayFixture);
    const dimensions = getWebDimensions(events);
    const points: Array<{ x: number; y: number; weight: number; isRageTap: boolean; kind?: HeatmapHotspot['kind']; dwellMs?: number }> = [];
    let scrollX = 0;
    let scrollY = 0;
    let viewportWidth = dimensions.viewportWidth;
    let viewportHeight = dimensions.viewportHeight;
    const readWeightTotal = READ_BAND_ROWS.reduce((sum, row) => sum + row.weight, 0) * READ_BAND_COLUMNS.length;

    for (let index = 0; index < events.length; index += 1) {
        const event = events[index];
        viewportWidth = positiveNumber(event.viewportWidth) ?? viewportWidth;
        viewportHeight = positiveNumber(event.viewportHeight) ?? viewportHeight;
        scrollX = Number.isFinite(Number(event.scrollX)) ? Math.max(0, Number(event.scrollX)) : scrollX;
        scrollY = Number.isFinite(Number(event.scrollY)) ? Math.max(0, Number(event.scrollY)) : scrollY;

        const next = events[index + 1];
        const dwell = engagedDwellMs(Number(next?.timestamp || webReplayFixture.endTime) - Number(event.timestamp || webReplayFixture.startTime));
        if (dwell > 0) {
            for (const row of READ_BAND_ROWS) {
                for (const col of READ_BAND_COLUMNS) {
                    points.push({
                        x: (scrollX + viewportWidth * col) / dimensions.pageWidth,
                        y: (scrollY + viewportHeight * row.frac) / dimensions.pageHeight,
                        weight: dwell * (row.weight / readWeightTotal),
                        isRageTap: false,
                        kind: 'attention',
                        dwellMs: dwell * (row.weight / readWeightTotal),
                    });
                }
            }
        }

        if (event.type === 'tap' || event.type === 'rage_tap') {
            const x = positiveNumber(event.x);
            const y = positiveNumber(event.y);
            if (x && y) {
                const isRageTap = event.type === 'rage_tap' || event.frustrationKind === 'rage_tap';
                points.push({
                    x: (x + scrollX) / dimensions.pageWidth,
                    y: (y + scrollY) / dimensions.pageHeight,
                    weight: isRageTap ? 3_400 : 1_800,
                    isRageTap,
                    kind: isRageTap ? 'rage' : 'touch',
                });
            }
        }
    }

    const dwellByDepth = new Array<number>(DWELL_DEPTH_BUCKETS).fill(0);
    for (const point of points) {
        if (!point.dwellMs || point.dwellMs <= 0 || !Number.isFinite(point.y)) continue;
        const clampedY = Math.min(1, Math.max(0, point.y));
        const bucket = Math.min(DWELL_DEPTH_BUCKETS - 1, Math.floor(clampedY * DWELL_DEPTH_BUCKETS));
        dwellByDepth[bucket] += point.dwellMs;
    }

    return {
        hotspots: aggregatePoints(points, 80),
        dwellByDepth: dwellByDepth.map((value) => Math.round(value)),
    };
}

function findNavigationEvent(fixture: DemoReplayFixture, screenName: string): DemoReplayEvent | null {
    return sortedEvents(fixture).find((event) => (
        event.type === 'navigation'
        && (event.screenName === screenName || event.screen === screenName || event.viewId === screenName)
    )) || null;
}

function latestScreenAt(timestamp: number, navigationEvents: DemoReplayEvent[]): string | null {
    let current: string | null = null;
    for (const event of navigationEvents) {
        if (Number(event.timestamp || 0) > timestamp) break;
        current = String(event.screenName || event.screen || event.viewId || current || '');
    }
    return current;
}

function findFrameAt(fixture: typeof mobileReplayFixture, timestamp: number): { file: string; timestamp: number } | null {
    const frames = fixture.screenshotFrames || [];
    if (frames.length === 0) return null;

    let best = frames[0];
    let bestDistance = Math.abs(best.timestamp - timestamp);
    for (const frame of frames) {
        const distance = Math.abs(frame.timestamp - timestamp);
        if (distance < bestDistance) {
            best = frame;
            bestDistance = distance;
        }
    }
    return best;
}

function buildMobileTouchHotspots(screenName: string): HeatmapHotspot[] {
    const width = positiveNumber(mobileReplayFixture.deviceInfo.screenWidth) ?? 393;
    const height = positiveNumber(mobileReplayFixture.deviceInfo.screenHeight) ?? 852;
    const navigationEvents = sortedEvents(mobileReplayFixture)
        .filter((event) => event.type === 'navigation')
        .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
    const screenEvents = sortedEvents(mobileReplayFixture).filter((event) => {
        if (event.type !== 'touch' && event.type !== 'gesture') return false;
        return latestScreenAt(Number(event.timestamp || 0), navigationEvents) === screenName;
    });

    const points = screenEvents
        .map((event) => {
            const x = positiveNumber(event.x);
            const y = positiveNumber(event.y);
            if (!x || !y) return null;
            const isRageTap = event.frustrationKind === 'rage_tap' || event.gestureType === 'rage_tap';
            return {
                x: x / width,
                y: y / height,
                weight: event.type === 'touch' ? 1.35 : 0.82,
                isRageTap,
                kind: isRageTap ? 'rage' as const : 'touch' as const,
            };
        })
        .filter((point): point is NonNullable<typeof point> => point !== null);

    return aggregatePoints(points, 18);
}

function buildWebDemoScreen(): DemoHeatmapScreen {
    const dimensions = getWebDimensions();
    const touchHotspots = buildWebTouchHotspots();
    const rageTaps = touchHotspots.filter((hotspot) => hotspot.isRageTap).length;

    return {
        name: WEB_DEMO_ROUTE,
        visits: 1,
        rageTaps,
        errors: 0,
        exitRate: 0,
        frictionScore: 92,
        screenshotUrl: null,
        sessionIds: [webReplayFixture.sessionId],
        screenFirstSeenMs: webReplayFixture.startTime,
        touchHotspots,
        pageWidth: dimensions.pageWidth,
        pageHeight: dimensions.pageHeight,
        viewportWidth: dimensions.viewportWidth,
        viewportHeight: dimensions.viewportHeight,
        rangeVisits: 1,
        rangeRageTaps: rageTaps,
        rangeErrors: 0,
        rangeExitRate: 0,
        rangeFrictionScore: 92,
        rangeImpactScore: 140,
        rangeRageTapRatePer100: rageTaps * 100,
        rangeErrorRatePer100: 0,
        rangeIncidentRatePer100: rageTaps * 100,
        rangeEstimatedAffectedSessions: 1,
        primarySignal: rageTaps > 0 ? 'rage_taps' : 'mixed',
        confidence: 'high',
        priority: 'critical',
        evidenceSessionId: webReplayFixture.sessionId,
        platform: 'web',
    };
}

function buildMobileDemoScreen(): DemoHeatmapScreen {
    const navigationEvent = findNavigationEvent(mobileReplayFixture, MOBILE_DEMO_SCREEN);
    const timestamp = Number(navigationEvent?.timestamp || mobileReplayFixture.startTime);
    const frame = findFrameAt(mobileReplayFixture, timestamp);
    const touchHotspots = buildMobileTouchHotspots(MOBILE_DEMO_SCREEN);
    const rageTaps = touchHotspots.filter((hotspot) => hotspot.isRageTap).length;

    return {
        name: MOBILE_DEMO_SCREEN,
        visits: 1,
        rageTaps,
        errors: 0,
        exitRate: 0,
        frictionScore: 68,
        screenshotUrl: frame ? `/demo/${mobileReplayFixture.sessionId}/frames/${frame.file}` : null,
        sessionIds: [mobileReplayFixture.sessionId],
        screenFirstSeenMs: timestamp,
        touchHotspots,
        pageWidth: mobileReplayFixture.deviceInfo.screenWidth,
        pageHeight: mobileReplayFixture.deviceInfo.screenHeight,
        viewportWidth: mobileReplayFixture.deviceInfo.screenWidth,
        viewportHeight: mobileReplayFixture.deviceInfo.screenHeight,
        rangeVisits: 1,
        rangeRageTaps: rageTaps,
        rangeErrors: 0,
        rangeExitRate: 0,
        rangeFrictionScore: 68,
        rangeImpactScore: 88,
        rangeRageTapRatePer100: rageTaps * 100,
        rangeErrorRatePer100: 0,
        rangeIncidentRatePer100: rageTaps * 100,
        rangeEstimatedAffectedSessions: 1,
        primarySignal: rageTaps > 0 ? 'rage_taps' : 'mixed',
        confidence: 'high',
        priority: 'high',
        evidenceSessionId: mobileReplayFixture.sessionId,
        platform: 'ios',
    };
}

function toIterationScreen(screen: DemoHeatmapScreen): HeatmapIterationScreen {
    return {
        name: screen.name,
        screenshotUrl: screen.screenshotUrl,
        screenFirstSeenMs: screen.screenFirstSeenMs,
        touchHotspots: screen.touchHotspots,
        pageWidth: screen.pageWidth,
        pageHeight: screen.pageHeight,
        viewportWidth: screen.viewportWidth,
        viewportHeight: screen.viewportHeight,
        visits: screen.rangeVisits,
        touches: screen.touchHotspots?.length || 0,
        rageTaps: screen.rangeRageTaps,
        errors: screen.rangeErrors,
        incidentRatePer100: screen.rangeIncidentRatePer100,
        lastSeenAt: new Date(
            screen.platform === 'web' ? webReplayFixture.endTime : mobileReplayFixture.endTime,
        ).toISOString(),
        evidenceSessionId: screen.evidenceSessionId,
    };
}

export function buildDemoHeatmapOverview(): HeatmapOverviewResponse {
    const webScreen = buildWebDemoScreen();
    const mobileScreen = buildMobileDemoScreen();
    const overall = [toIterationScreen(webScreen), toIterationScreen(mobileScreen)];
    const screenIteration: HeatmapIterationSummary = {
        overall,
        versions: [
            {
                appVersion: webReplayFixture.deviceInfo.appVersion,
                firstSeenAt: new Date(webReplayFixture.startTime).toISOString(),
                lastSeenAt: new Date(webReplayFixture.endTime).toISOString(),
                sessions: 1,
                screens: [overall[0]],
            },
            {
                appVersion: mobileReplayFixture.deviceInfo.appVersion,
                firstSeenAt: new Date(mobileReplayFixture.startTime).toISOString(),
                lastSeenAt: new Date(mobileReplayFixture.endTime).toISOString(),
                sessions: 1,
                screens: [overall[1]],
            },
        ],
    };

    return {
        screens: [webScreen, mobileScreen],
        screenIteration,
        lastUpdated: new Date(Math.max(webReplayFixture.endTime, mobileReplayFixture.endTime)).toISOString(),
        failedSections: [],
    };
}

export function getDemoWebAttentionHeatmap(screenName?: string | null): WebAttentionHeatmapResponse {
    const normalized = (screenName || WEB_DEMO_ROUTE).trim();
    const isWebDemoRoute = normalized === WEB_DEMO_ROUTE || normalized === 'Docs / Web / Getting Started';
    const dimensions = getWebDimensions();
    if (!isWebDemoRoute) {
        return {
            hotspots: [],
            sampledSessions: 0,
            avgSessionDurationMs: null,
            eventCount: 0,
            generatedAt: new Date().toISOString(),
            confidence: 'low',
            pageWidth: dimensions.pageWidth,
            pageHeight: dimensions.pageHeight,
            viewportWidth: dimensions.viewportWidth,
            viewportHeight: dimensions.viewportHeight,
            reason: 'No demo web replay matched this route',
        };
    }

    const attention = buildWebAttentionHotspots();
    return {
        hotspots: attention.hotspots,
        dwellByDepth: attention.dwellByDepth,
        sampledSessions: 1,
        avgSessionDurationMs: Math.max(0, webReplayFixture.endTime - webReplayFixture.startTime),
        eventCount: webReplayFixture.rrwebReplay?.eventCount || sortedEvents(webReplayFixture).length,
        generatedAt: new Date().toISOString(),
        confidence: 'high',
        pageWidth: dimensions.pageWidth,
        pageHeight: dimensions.pageHeight,
        viewportWidth: dimensions.viewportWidth,
        viewportHeight: dimensions.viewportHeight,
        reason: null,
    };
}
