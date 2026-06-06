import { describe, expect, it } from 'vitest';
import {
    deriveSessionEvidenceState,
    SESSION_LIVE_INGEST_WINDOW_MS,
    type SessionWorkAggregate,
} from '../services/sessionEvidence.js';

function aggregate(overrides: Partial<SessionWorkAggregate> = {}): SessionWorkAggregate {
    return {
        readyScreenshotCount: 0,
        readyScreenshotBytes: 0,
        readyWebReplayCount: 0,
        readyWebReplayBytes: 0,
        readyHierarchyCount: 0,
        openArtifactCount: 0,
        activeJobCount: 0,
        openReplayArtifactCount: 0,
        activeReplayJobCount: 0,
        latestReplayArtifactEndMs: null,
        latestEventArtifactEndMs: null,
        latestReadyAt: null,
        pendingEventEvidenceCount: 0,
        readyEventArtifactMissingDerivedCount: 0,
        hasPendingProcessingWork: false,
        hasPendingWork: false,
        hasPendingReplayWork: false,
        ...overrides,
    };
}

describe('sessionEvidence', () => {
    it('treats ready screenshot or rrweb artifacts as replay evidence', () => {
        const screenshotEvidence = deriveSessionEvidenceState({
            aggregate: aggregate({ readyScreenshotCount: 1 }),
            session: { startedAt: new Date('2026-06-06T12:00:00.000Z') },
            now: new Date('2026-06-06T12:02:00.000Z'),
        });
        const noReplayEvidence = deriveSessionEvidenceState({
            aggregate: aggregate(),
            session: { startedAt: new Date('2026-06-06T12:00:00.000Z') },
            now: new Date('2026-06-06T12:02:00.000Z'),
        });

        expect(screenshotEvidence.hasReplayArtifacts).toBe(true);
        expect(noReplayEvidence.hasReplayArtifacts).toBe(false);
    });

    it('keeps Smart Capture evidence unsettled while fresh event evidence is pending', () => {
        const now = new Date('2026-06-06T12:02:00.000Z');
        const state = deriveSessionEvidenceState({
            aggregate: aggregate({ pendingEventEvidenceCount: 1 }),
            session: {
                startedAt: new Date('2026-06-06T12:00:00.000Z'),
                lastIngestActivityAt: new Date(now.getTime() - SESSION_LIVE_INGEST_WINDOW_MS - 1),
            },
            now,
        });

        expect(state.smartCaptureEvidenceSettled).toBe(false);
    });

    it('settles Smart Capture evidence once ingest is idle and no event evidence is pending', () => {
        const now = new Date('2026-06-06T12:02:00.000Z');
        const state = deriveSessionEvidenceState({
            aggregate: aggregate({ pendingEventEvidenceCount: 0 }),
            session: {
                startedAt: new Date('2026-06-06T12:00:00.000Z'),
                lastIngestActivityAt: new Date(now.getTime() - SESSION_LIVE_INGEST_WINDOW_MS - 1),
            },
            now,
        });

        expect(state.smartCaptureEvidenceSettled).toBe(true);
    });

    it('uses the latest replay or event artifact timestamp as client evidence', () => {
        const state = deriveSessionEvidenceState({
            aggregate: aggregate({
                latestReplayArtifactEndMs: 1_000,
                latestEventArtifactEndMs: 2_000,
            }),
            session: { startedAt: new Date('2026-06-06T12:00:00.000Z') },
        });

        expect(state.latestClientEvidenceEndMs).toBe(2_000);
    });
});
