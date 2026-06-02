import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    addMock,
    closeMock,
    createArtifactBullWorkerMock,
    getJobMock,
    reconcileSessionStateMock,
    runArtifactCompletionEffectsMock,
} = vi.hoisted(() => ({
    addMock: vi.fn(async () => undefined),
    closeMock: vi.fn(async () => undefined),
    createArtifactBullWorkerMock: vi.fn(() => ({ close: closeMock })),
    getJobMock: vi.fn(async (): Promise<any> => null),
    reconcileSessionStateMock: vi.fn(async () => ({
        finalized: false,
        replayAvailable: true,
        sessionId: 'session-1',
        status: 'processing',
    })),
    runArtifactCompletionEffectsMock: vi.fn(async () => undefined),
}));

vi.mock('../services/artifactBullQueue.js', () => ({
    SESSION_EFFECTS_QUEUE_NAME: 'rj-session-effects',
    createArtifactBullWorker: createArtifactBullWorkerMock,
    getSessionEffectsQueue: () => ({
        add: addMock,
        getJob: getJobMock,
    }),
}));

vi.mock('../services/artifactCompletionEffects.js', () => ({
    runArtifactCompletionEffects: runArtifactCompletionEffectsMock,
}));

vi.mock('../services/sessionReconciliation.js', () => ({
    reconcileSessionState: reconcileSessionStateMock,
}));

import {
    buildSessionEffectsJobId,
    enqueueSessionEffectsJob,
    processSessionEffectsJobFromBullMQ,
    resolveSessionEffectsConcurrency,
    resolveSessionEffectsDelayMs,
    startSessionEffectsWorker,
} from '../services/sessionEffectsQueue.js';

describe('sessionEffectsQueue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getJobMock.mockResolvedValue(null);
        reconcileSessionStateMock.mockResolvedValue({
            finalized: false,
            replayAvailable: true,
            sessionId: 'session-1',
            status: 'processing',
        });
    });

    it('builds one job id per session debounce bucket', () => {
        expect(buildSessionEffectsJobId('session-1', 100_000, 15_000))
            .toBe('session-effects-session-1-7');
        expect(buildSessionEffectsJobId('session-1', 110_000, 15_000))
            .toBe('session-effects-session-1-8');
    });

    it('bounds delay and concurrency env values', () => {
        expect(resolveSessionEffectsDelayMs('50')).toBe(1000);
        expect(resolveSessionEffectsDelayMs('120000')).toBe(60000);
        expect(resolveSessionEffectsDelayMs('bad')).toBe(15000);
        expect(resolveSessionEffectsConcurrency('0')).toBe(1);
        expect(resolveSessionEffectsConcurrency('128')).toBe(64);
        expect(resolveSessionEffectsConcurrency('bad')).toBe(12);
    });

    it('enqueues a delayed session effects job', async () => {
        const queued = await enqueueSessionEffectsJob('session-1', {
            delayMs: 15_000,
            nowMs: 100_000,
        });

        expect(queued).toBe(true);
        expect(addMock).toHaveBeenCalledWith(
            'session-effects',
            { sessionId: 'session-1' },
            {
                delay: 15_000,
                jobId: 'session-effects-session-1-7',
            },
        );
    });

    it('dedupes jobs already scheduled for the same session bucket', async () => {
        getJobMock.mockResolvedValue({ id: 'existing' });

        const queued = await enqueueSessionEffectsJob('session-1', {
            delayMs: 15_000,
            nowMs: 100_000,
        });

        expect(queued).toBe(false);
        expect(addMock).not.toHaveBeenCalled();
    });

    it('runs reconciliation and cache invalidation from the worker processor', async () => {
        await processSessionEffectsJobFromBullMQ({
            attemptsMade: 0,
            data: { sessionId: 'session-1' },
            id: 'job-1',
        } as any);

        expect(reconcileSessionStateMock).toHaveBeenCalledWith('session-1');
        expect(runArtifactCompletionEffectsMock).toHaveBeenCalledWith({
            kind: 'events',
            replayAvailable: true,
            sessionId: 'session-1',
        });
    });

    it('starts a BullMQ worker with configured concurrency', () => {
        const worker = startSessionEffectsWorker();

        expect(createArtifactBullWorkerMock).toHaveBeenCalledWith(
            'rj-session-effects',
            processSessionEffectsJobFromBullMQ,
            12,
        );
        expect(worker.close).toBe(closeMock);
    });
});
