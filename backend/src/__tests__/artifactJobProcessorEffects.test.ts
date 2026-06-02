import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    downloadFromS3ForArtifactMock,
    enqueueSessionEffectsJobMock,
    executeMock,
    limitResults,
    processEventsArtifactMock,
    processRecoveredReplayArtifactMock,
    reconcileSessionStateMock,
    runArtifactCompletionEffectsMock,
    transactionMock,
    txUpdateSetMock,
} = vi.hoisted(() => {
    const txUpdateSetMock = vi.fn();
    return {
        downloadFromS3ForArtifactMock: vi.fn(async () => Buffer.from('{"events":[]}')),
        enqueueSessionEffectsJobMock: vi.fn(async () => true),
        executeMock: vi.fn(async () => undefined),
        limitResults: [] as any[][],
        processEventsArtifactMock: vi.fn(async () => undefined),
        processRecoveredReplayArtifactMock: vi.fn(async () => undefined),
        reconcileSessionStateMock: vi.fn(async () => ({
            finalized: false,
            replayAvailable: true,
            sessionId: 'session-1',
            status: 'processing',
        })),
        runArtifactCompletionEffectsMock: vi.fn(async () => undefined),
        transactionMock: vi.fn(async (fn: any) => fn({
            execute: vi.fn(async () => undefined),
            update: vi.fn(() => ({
                set: vi.fn((values: any) => {
                    txUpdateSetMock(values);
                    return { where: vi.fn(async () => undefined) };
                }),
            })),
        })),
        txUpdateSetMock,
    };
});

const loggerMock = vi.hoisted(() => {
    const log: any = {
        child: vi.fn(() => log),
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };
    return log;
});

function selectBuilder(result: any[]) {
    const builder: any = {};
    builder.from = vi.fn(() => builder);
    builder.leftJoin = vi.fn(() => builder);
    builder.where = vi.fn(() => builder);
    builder.limit = vi.fn(async () => result);
    return builder;
}

vi.mock('drizzle-orm', () => ({
    eq: vi.fn(() => ({ op: 'eq' })),
    sql: vi.fn(() => ({ op: 'sql' })),
}));

vi.mock('../db/client.js', () => ({
    db: {
        execute: executeMock,
        select: vi.fn(() => selectBuilder(limitResults.shift() ?? [])),
        transaction: transactionMock,
    },
    projects: { id: 'projects.id' },
    recordingArtifacts: {
        id: 'recording_artifacts.id',
        uploadCompletedAt: 'recording_artifacts.upload_completed_at',
    },
    sessionMetrics: { sessionId: 'session_metrics.session_id' },
    sessions: {
        id: 'sessions.id',
        projectId: 'sessions.project_id',
    },
}));

vi.mock('../db/s3.js', () => ({
    downloadFromS3ForArtifact: downloadFromS3ForArtifactMock,
}));

vi.mock('../logger.js', () => ({
    logger: loggerMock,
}));

vi.mock('../services/artifactCompletionEffects.js', () => ({
    runArtifactCompletionEffects: runArtifactCompletionEffectsMock,
}));

vi.mock('../services/hierarchyArtifactCompression.js', () => ({
    ensureHierarchyArtifactCompressed: vi.fn(async () => ({ sizeBytes: 128 })),
}));

vi.mock('../services/ingestEventArtifactProcessor.js', () => ({
    processEventsArtifact: processEventsArtifactMock,
}));

vi.mock('../services/ingestFaultArtifactProcessors.js', () => ({
    processAnrsArtifact: vi.fn(async () => undefined),
    processCrashesArtifact: vi.fn(async () => undefined),
}));

vi.mock('../services/ingestReplayArtifactProcessor.js', () => ({
    processRecoveredReplayArtifact: processRecoveredReplayArtifactMock,
}));

vi.mock('../services/sessionEffectsQueue.js', () => ({
    enqueueSessionEffectsJob: enqueueSessionEffectsJobMock,
}));

vi.mock('../services/sessionReconciliation.js', () => ({
    reconcileSessionState: reconcileSessionStateMock,
}));

import { processArtifactJobFromBullMQ } from '../services/artifactJobProcessor.js';

const sessionResult = {
    metrics: { sessionId: 'session-1' },
    project: { id: 'project-1' },
    session: {
        id: 'session-1',
        projectId: 'project-1',
        startedAt: new Date('2026-06-02T00:00:00.000Z'),
    },
};

function makeJob(kind: string) {
    return {
        attemptsMade: 0,
        data: {
            artifactId: 'artifact-1',
            endpointId: null,
            kind,
            projectId: 'project-1',
            s3ObjectKey: 'artifact.json.gz',
            sessionId: 'session-1',
        },
        id: `artifact-artifact-1`,
    };
}

describe('processArtifactJobFromBullMQ completion effects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        limitResults.length = 0;
        limitResults.push([sessionResult]);
        limitResults.push([{
            endpointId: null,
            frameCount: null,
            id: 'artifact-1',
            status: 'uploaded',
            uploadCompletedAt: null,
            verifiedAt: null,
        }]);
    });

    it('defers session effects for event artifacts after marking them ready', async () => {
        await processArtifactJobFromBullMQ(makeJob('events') as any, {
            maxAttempts: 5,
            workerId: 'worker-1',
        });

        expect(processEventsArtifactMock).toHaveBeenCalledTimes(1);
        expect(txUpdateSetMock).toHaveBeenCalledWith(expect.objectContaining({
            sizeBytes: expect.any(Number),
            status: 'ready',
        }));
        expect(enqueueSessionEffectsJobMock).toHaveBeenCalledWith('session-1');
        expect(reconcileSessionStateMock).not.toHaveBeenCalled();
        expect(runArtifactCompletionEffectsMock).not.toHaveBeenCalled();
    });

    it('keeps replay artifacts on the immediate reconcile path', async () => {
        await processArtifactJobFromBullMQ(makeJob('screenshots') as any, {
            maxAttempts: 5,
            workerId: 'worker-1',
        });

        expect(processRecoveredReplayArtifactMock).toHaveBeenCalledTimes(1);
        expect(enqueueSessionEffectsJobMock).not.toHaveBeenCalled();
        expect(reconcileSessionStateMock).toHaveBeenCalledWith('session-1');
        expect(runArtifactCompletionEffectsMock).toHaveBeenCalledWith({
            kind: 'screenshots',
            replayAvailable: true,
            sessionId: 'session-1',
        });
    });
});
