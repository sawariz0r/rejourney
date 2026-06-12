import { describe, expect, it } from 'vitest';
import {
    MAX_FUTURE_CLIENT_CLOCK_SKEW_MS,
    SESSION_CLOCK_METADATA_KEY,
    normalizeArtifactTimeRangeForSession,
    normalizeClientEpochMsForSession,
    resolveSessionClock,
} from '../services/sessionClock.js';

const SERVER_NOW = new Date('2026-06-12T18:00:00.000Z');

function sessionIdFor(ms: number): string {
    return `session_${ms}_abc123`;
}

describe('sessionClock', () => {
    it('uses server time for session ids without a parseable timestamp', () => {
        const resolved = resolveSessionClock('session_not-a-timestamp', SERVER_NOW);

        expect(resolved.startedAt.toISOString()).toBe('2026-06-12T18:00:00.000Z');
        expect(resolved.clamped).toBe(false);
        expect(resolved.metadata).toBeNull();
    });

    it('accepts a client clock exactly ten minutes ahead', () => {
        const clientMs = SERVER_NOW.getTime() + MAX_FUTURE_CLIENT_CLOCK_SKEW_MS;
        const resolved = resolveSessionClock(sessionIdFor(clientMs), SERVER_NOW);

        expect(resolved.startedAt.getTime()).toBe(clientMs);
        expect(resolved.clamped).toBe(false);
    });

    it('clamps a client clock one millisecond beyond ten minutes', () => {
        const clientMs = SERVER_NOW.getTime() + MAX_FUTURE_CLIENT_CLOCK_SKEW_MS + 1;
        const resolved = resolveSessionClock(sessionIdFor(clientMs), SERVER_NOW);

        expect(resolved.startedAt.toISOString()).toBe('2026-06-12T18:00:00.000Z');
        expect(resolved.clamped).toBe(true);
        expect(resolved.metadata).toMatchObject({
            rawSessionStartedAtMs: clientMs,
            normalizedStartedAtMs: SERVER_NOW.getTime(),
            futureSkewMs: MAX_FUTURE_CLIENT_CLOCK_SKEW_MS + 1,
        });
    });

    it('clamps large future dates without depending on local timezone', () => {
        const clientMs = Date.UTC(2026, 5, 27, 12, 15, 14, 606);
        const resolved = resolveSessionClock(sessionIdFor(clientMs), SERVER_NOW);

        expect(resolved.startedAt.toISOString()).toBe('2026-06-12T18:00:00.000Z');
        expect(resolved.metadata?.rawSessionStartedAtMs).toBe(clientMs);
    });

    it('normalizes artifact ranges using stored session clock metadata', () => {
        const rawSessionStartedAtMs = Date.UTC(2026, 5, 27, 12, 15, 14, 606);
        const futureSkewMs = rawSessionStartedAtMs - SERVER_NOW.getTime();
        const session = {
            startedAt: SERVER_NOW,
            metadata: {
                [SESSION_CLOCK_METADATA_KEY]: {
                    ruleVersion: 'future-client-clock-v1',
                    clamped: true,
                    rawSessionStartedAtMs,
                    normalizedStartedAtMs: SERVER_NOW.getTime(),
                    serverObservedAtMs: SERVER_NOW.getTime(),
                    futureSkewMs,
                    maxFutureSkewMs: MAX_FUTURE_CLIENT_CLOCK_SKEW_MS,
                },
            },
        };

        const range = normalizeArtifactTimeRangeForSession({
            session,
            serverNow: SERVER_NOW,
            timestamp: rawSessionStartedAtMs,
            startTime: rawSessionStartedAtMs + 1000,
            endTime: rawSessionStartedAtMs + 2500,
        });

        expect(range.normalized).toBe(true);
        expect(range.normalizationSource).toBe('session_clock_metadata');
        expect(range.timestamp).toBe(SERVER_NOW.getTime());
        expect(range.startTime).toBe(SERVER_NOW.getTime() + 1000);
        expect(range.endTime).toBe(SERVER_NOW.getTime() + 2500);
    });

    it('does not subtract stored skew from later server-corrected artifact times', () => {
        const rawSessionStartedAtMs = Date.UTC(2026, 5, 27, 12, 15, 14, 606);
        const session = {
            startedAt: SERVER_NOW,
            metadata: {
                [SESSION_CLOCK_METADATA_KEY]: {
                    ruleVersion: 'future-client-clock-v1',
                    clamped: true,
                    rawSessionStartedAtMs,
                    normalizedStartedAtMs: SERVER_NOW.getTime(),
                    serverObservedAtMs: SERVER_NOW.getTime(),
                    futureSkewMs: rawSessionStartedAtMs - SERVER_NOW.getTime(),
                    maxFutureSkewMs: MAX_FUTURE_CLIENT_CLOCK_SKEW_MS,
                },
            },
        };
        const correctedClientTime = SERVER_NOW.getTime() + 5000;

        const normalized = normalizeClientEpochMsForSession(correctedClientTime, session, SERVER_NOW);

        expect(normalized.normalized).toBe(false);
        expect(normalized.value).toBe(correctedClientTime);
    });
});
