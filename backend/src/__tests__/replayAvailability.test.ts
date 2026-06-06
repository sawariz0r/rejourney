import { describe, expect, it } from 'vitest';
import { canOpenReplayFromSessionFields } from '../services/replayAvailability.js';

describe('replayAvailability', () => {
    it('opens only saved, retained replay rows', () => {
        expect(canOpenReplayFromSessionFields({
            replayAvailable: true,
            replayRetentionState: 'saved',
        })).toBe(true);
        expect(canOpenReplayFromSessionFields({
            replayAvailable: true,
            replayRetentionState: 'buffered',
        })).toBe(false);
        expect(canOpenReplayFromSessionFields({
            replayAvailable: true,
            replayRetentionState: 'analytics_only',
        })).toBe(false);
        expect(canOpenReplayFromSessionFields({
            replayAvailable: true,
            replayRetentionState: 'saved',
            smartCaptureStatus: 'discarded',
        })).toBe(false);
    });

    it('blocks deleted and expired recordings even when replay was retained', () => {
        expect(canOpenReplayFromSessionFields({
            replayAvailable: true,
            replayRetentionState: 'saved',
            recordingDeleted: true,
        })).toBe(false);
        expect(canOpenReplayFromSessionFields({
            replayAvailable: true,
            replayRetentionState: 'saved',
            isReplayExpired: true,
        })).toBe(false);
    });

    it('does not let artifact fallback override an explicit unavailable outcome', () => {
        expect(canOpenReplayFromSessionFields({
            replayAvailable: false,
            replayRetentionState: 'saved',
        }, true)).toBe(false);
        expect(canOpenReplayFromSessionFields({
            replayRetentionState: 'saved',
        }, true)).toBe(true);
    });
});
