import { describe, expect, it } from 'vitest';
import { resolveReplayRetention } from '../services/replayRetention.js';
import type { SmartCaptureDecision } from '../services/smartCapture.js';

function decision(overrides: Partial<SmartCaptureDecision> = {}): SmartCaptureDecision {
    return {
        status: 'kept',
        reason: 'matched_rule',
        ruleId: 'rule_1',
        decidedAt: new Date('2026-06-06T12:00:00.000Z'),
        shouldExposeReplay: true,
        shouldDiscardVisualArtifacts: false,
        ...overrides,
    };
}

describe('replayRetention', () => {
    it('saves replay when visual evidence exists and capture policy keeps it', () => {
        const result = resolveReplayRetention({
            hasReplayArtifacts: true,
            smartCaptureDecision: decision(),
        });

        expect(result.replayAvailable).toBe(true);
        expect(result.replayRetentionState).toBe('saved');
        expect(result.shouldCountReplay).toBe(true);
    });

    it('buffers replay while Smart Capture is still pending', () => {
        const result = resolveReplayRetention({
            hasReplayArtifacts: true,
            smartCaptureDecision: decision({
                status: 'pending',
                reason: 'waiting_for_session_evidence',
                decidedAt: null,
            }),
        });

        expect(result.replayAvailable).toBe(true);
        expect(result.replayRetentionState).toBe('buffered');
        expect(result.shouldCountReplay).toBe(false);
    });

    it('moves discarded or quota-exhausted replay to analytics-only', () => {
        const discarded = resolveReplayRetention({
            hasReplayArtifacts: true,
            smartCaptureDecision: decision({
                status: 'discarded',
                reason: 'analytics_only',
                shouldExposeReplay: false,
                shouldDiscardVisualArtifacts: true,
            }),
        });
        const quotaExhausted = resolveReplayRetention({
            hasReplayArtifacts: true,
            replayQuotaAtLimit: true,
            smartCaptureDecision: decision(),
        });

        expect(discarded.replayAvailable).toBe(false);
        expect(discarded.replayRetentionState).toBe('analytics_only');
        expect(discarded.shouldDiscardVisualArtifacts).toBe(true);
        expect(quotaExhausted.replayAvailable).toBe(false);
        expect(quotaExhausted.replayRetentionState).toBe('analytics_only');
        expect(quotaExhausted.smartCaptureDecision.reason).toBe('quota_exhausted_at_promotion');
    });

    it('marks sessions without visual replay artifacts as not available', () => {
        const result = resolveReplayRetention({
            hasReplayArtifacts: false,
            smartCaptureDecision: decision(),
        });

        expect(result.replayAvailable).toBe(false);
        expect(result.replayRetentionState).toBe('not_available');
        expect(result.shouldCountReplay).toBe(false);
    });
});
