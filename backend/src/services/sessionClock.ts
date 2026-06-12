import { parseSessionStartedAtOrNull } from './sessionId.js';

export const MAX_FUTURE_CLIENT_CLOCK_SKEW_MS = 10 * 60 * 1000;
export const SESSION_CLOCK_METADATA_KEY = 'ingestClock';
export const SESSION_CLOCK_RULE_VERSION = 'future-client-clock-v1';

export type SessionClockMetadata = {
    ruleVersion: typeof SESSION_CLOCK_RULE_VERSION;
    clamped: boolean;
    rawSessionStartedAtMs: number | null;
    normalizedStartedAtMs: number;
    serverObservedAtMs: number;
    futureSkewMs: number | null;
    maxFutureSkewMs: number;
};

export type SessionClockResolution = {
    clamped: boolean;
    metadata: SessionClockMetadata | null;
    rawSessionStartedAtMs: number | null;
    serverObservedAtMs: number;
    startedAt: Date;
};

export type ArtifactTimeRangeNormalization = {
    endTime: number | null;
    normalized: boolean;
    normalizationSource: 'session_clock_metadata' | 'future_artifact_timestamp' | null;
    startTime: number | null;
    timestamp: number | null;
};

type ClockCorrection = {
    correctionMs: number;
    normalizedStartedAtMs: number;
    rawSessionStartedAtMs: number | null;
    source: 'session_clock_metadata' | 'future_artifact_timestamp';
};

function finiteDateMs(value: unknown): number | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    const ms = date.getTime();
    return Number.isFinite(ms) ? ms : null;
}

function finitePositiveMs(value: unknown): number | null {
    const ms = Number(value);
    return Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function buildClockMetadata(params: {
    clamped: boolean;
    futureSkewMs: number | null;
    normalizedStartedAtMs: number;
    rawSessionStartedAtMs: number | null;
    serverObservedAtMs: number;
}): SessionClockMetadata {
    return {
        ruleVersion: SESSION_CLOCK_RULE_VERSION,
        clamped: params.clamped,
        rawSessionStartedAtMs: params.rawSessionStartedAtMs,
        normalizedStartedAtMs: params.normalizedStartedAtMs,
        serverObservedAtMs: params.serverObservedAtMs,
        futureSkewMs: params.futureSkewMs,
        maxFutureSkewMs: MAX_FUTURE_CLIENT_CLOCK_SKEW_MS,
    };
}

export function resolveSessionClock(sessionId: string, serverNow: Date = new Date()): SessionClockResolution {
    const serverObservedAtMs = finiteDateMs(serverNow) ?? Date.now();
    const parsedStartedAt = parseSessionStartedAtOrNull(sessionId);
    const rawSessionStartedAtMs = parsedStartedAt?.getTime() ?? null;

    if (rawSessionStartedAtMs === null || !Number.isFinite(rawSessionStartedAtMs)) {
        return {
            clamped: false,
            metadata: null,
            rawSessionStartedAtMs: null,
            serverObservedAtMs,
            startedAt: new Date(serverObservedAtMs),
        };
    }

    if (rawSessionStartedAtMs > serverObservedAtMs + MAX_FUTURE_CLIENT_CLOCK_SKEW_MS) {
        const metadata = buildClockMetadata({
            clamped: true,
            futureSkewMs: rawSessionStartedAtMs - serverObservedAtMs,
            normalizedStartedAtMs: serverObservedAtMs,
            rawSessionStartedAtMs,
            serverObservedAtMs,
        });
        return {
            clamped: true,
            metadata,
            rawSessionStartedAtMs,
            serverObservedAtMs,
            startedAt: new Date(serverObservedAtMs),
        };
    }

    return {
        clamped: false,
        metadata: null,
        rawSessionStartedAtMs,
        serverObservedAtMs,
        startedAt: new Date(rawSessionStartedAtMs),
    };
}

export function extractSessionClockMetadata(session: { metadata?: unknown } | null | undefined): SessionClockMetadata | null {
    const metadata = asRecord(session?.metadata);
    const clock = asRecord(metadata?.[SESSION_CLOCK_METADATA_KEY]);
    if (!clock || clock.ruleVersion !== SESSION_CLOCK_RULE_VERSION) return null;

    const normalizedStartedAtMs = finitePositiveMs(clock.normalizedStartedAtMs);
    const serverObservedAtMs = finitePositiveMs(clock.serverObservedAtMs);
    const maxFutureSkewMs = finitePositiveMs(clock.maxFutureSkewMs) ?? MAX_FUTURE_CLIENT_CLOCK_SKEW_MS;
    if (normalizedStartedAtMs === null || serverObservedAtMs === null) return null;

    const rawSessionStartedAtMs = clock.rawSessionStartedAtMs === null
        ? null
        : finitePositiveMs(clock.rawSessionStartedAtMs);
    const futureSkewMs = clock.futureSkewMs === null
        ? null
        : finitePositiveMs(clock.futureSkewMs);

    return {
        ruleVersion: SESSION_CLOCK_RULE_VERSION,
        clamped: clock.clamped === true,
        rawSessionStartedAtMs,
        normalizedStartedAtMs,
        serverObservedAtMs,
        futureSkewMs,
        maxFutureSkewMs,
    };
}

export function buildExistingFutureSessionClockMetadata(
    session: { id?: string | null; startedAt?: Date | string | null },
    serverNow: Date = new Date(),
): SessionClockMetadata | null {
    const serverObservedAtMs = finiteDateMs(serverNow) ?? Date.now();
    const startedAtMs = finiteDateMs(session.startedAt);
    if (startedAtMs === null || startedAtMs <= serverObservedAtMs + MAX_FUTURE_CLIENT_CLOCK_SKEW_MS) {
        return null;
    }

    const parsedFromSessionId = session.id ? parseSessionStartedAtOrNull(session.id)?.getTime() ?? null : null;
    return buildClockMetadata({
        clamped: true,
        futureSkewMs: startedAtMs - serverObservedAtMs,
        normalizedStartedAtMs: serverObservedAtMs,
        rawSessionStartedAtMs: parsedFromSessionId ?? startedAtMs,
        serverObservedAtMs,
    });
}

function getSessionClockCorrection(
    session: { metadata?: unknown; startedAt?: Date | string | null } | null | undefined,
    serverNow: Date,
): ClockCorrection | null {
    const metadata = extractSessionClockMetadata(session);
    if (metadata?.clamped && metadata.futureSkewMs && metadata.futureSkewMs > 0) {
        return {
            correctionMs: metadata.futureSkewMs,
            normalizedStartedAtMs: metadata.normalizedStartedAtMs,
            rawSessionStartedAtMs: metadata.rawSessionStartedAtMs,
            source: 'session_clock_metadata',
        };
    }

    const serverObservedAtMs = finiteDateMs(serverNow) ?? Date.now();
    const startedAtMs = finiteDateMs(session?.startedAt);
    if (startedAtMs !== null && startedAtMs > serverObservedAtMs + MAX_FUTURE_CLIENT_CLOCK_SKEW_MS) {
        return {
            correctionMs: startedAtMs - serverObservedAtMs,
            normalizedStartedAtMs: serverObservedAtMs,
            rawSessionStartedAtMs: startedAtMs,
            source: 'future_artifact_timestamp',
        };
    }

    return null;
}

function shouldApplyStoredCorrection(valueMs: number, correction: ClockCorrection, serverNowMs: number): boolean {
    if (valueMs > serverNowMs + MAX_FUTURE_CLIENT_CLOCK_SKEW_MS) {
        return true;
    }

    if (correction.rawSessionStartedAtMs !== null) {
        const oneHourBeforeRawSession = correction.rawSessionStartedAtMs - 60 * 60 * 1000;
        return valueMs >= oneHourBeforeRawSession;
    }

    return false;
}

export function normalizeClientEpochMsForSession(
    value: unknown,
    session: { metadata?: unknown; startedAt?: Date | string | null } | null | undefined,
    serverNow: Date = new Date(),
): { normalized: boolean; normalizationSource: ClockCorrection['source'] | null; value: number | null } {
    const valueMs = finitePositiveMs(value);
    if (valueMs === null) {
        return { normalized: false, normalizationSource: null, value: null };
    }

    const serverNowMs = finiteDateMs(serverNow) ?? Date.now();
    const correction = getSessionClockCorrection(session, serverNow);
    if (correction && shouldApplyStoredCorrection(valueMs, correction, serverNowMs)) {
        const normalizedValue = Math.floor(valueMs - correction.correctionMs);
        if (normalizedValue > 0) {
            return {
                normalized: normalizedValue !== valueMs,
                normalizationSource: correction.source,
                value: normalizedValue,
            };
        }
    }

    if (!correction && valueMs > serverNowMs + MAX_FUTURE_CLIENT_CLOCK_SKEW_MS) {
        return {
            normalized: true,
            normalizationSource: 'future_artifact_timestamp',
            value: serverNowMs,
        };
    }

    return { normalized: false, normalizationSource: null, value: valueMs };
}

export function normalizeArtifactTimeRangeForSession(params: {
    endTime?: unknown;
    serverNow?: Date;
    session: { metadata?: unknown; startedAt?: Date | string | null } | null | undefined;
    startTime?: unknown;
    timestamp?: unknown;
}): ArtifactTimeRangeNormalization {
    const serverNow = params.serverNow ?? new Date();
    const rawValues = [params.timestamp, params.startTime, params.endTime]
        .map(finitePositiveMs)
        .filter((value): value is number => value !== null);
    const serverNowMs = finiteDateMs(serverNow) ?? Date.now();
    const storedCorrection = getSessionClockCorrection(params.session, serverNow);
    const futureRawValues = rawValues.filter((value) => value > serverNowMs + MAX_FUTURE_CLIENT_CLOCK_SKEW_MS);
    const dynamicCorrectionMs = storedCorrection
        ? null
        : futureRawValues.length > 0
            ? Math.min(...futureRawValues)
            : null;
    const dynamicCorrection = dynamicCorrectionMs !== null
        ? Math.max(0, dynamicCorrectionMs - serverNowMs)
        : 0;

    let normalized = false;
    let normalizationSource: ArtifactTimeRangeNormalization['normalizationSource'] = null;

    const normalizeOne = (value: unknown): number | null => {
        const valueMs = finitePositiveMs(value);
        if (valueMs === null) return null;

        let nextValue = valueMs;
        if (storedCorrection && shouldApplyStoredCorrection(valueMs, storedCorrection, serverNowMs)) {
            const corrected = Math.floor(valueMs - storedCorrection.correctionMs);
            if (corrected > 0) {
                nextValue = corrected;
                normalizationSource = storedCorrection.source;
            }
        } else if (!storedCorrection && dynamicCorrection > 0 && valueMs > serverNowMs + MAX_FUTURE_CLIENT_CLOCK_SKEW_MS) {
            const corrected = Math.floor(valueMs - dynamicCorrection);
            if (corrected > 0) {
                nextValue = corrected;
                normalizationSource = 'future_artifact_timestamp';
            }
        }

        normalized = normalized || nextValue !== valueMs;
        return nextValue;
    };

    return {
        endTime: normalizeOne(params.endTime),
        normalized,
        normalizationSource,
        startTime: normalizeOne(params.startTime),
        timestamp: normalizeOne(params.timestamp),
    };
}
