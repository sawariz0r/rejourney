import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));

function readWorkspaceFile(relativePathFromTestFile: string): string {
    return readFileSync(resolve(TEST_DIR, relativePathFromTestFile), 'utf8');
}

function extractFunctionBlock(source: string, functionName: string): string {
    const start = source.indexOf(`async function ${functionName}`);
    if (start === -1) {
        throw new Error(`Function not found: ${functionName}`);
    }

    const nextAsync = source.indexOf('\nasync function ', start + 1);
    return source.slice(start, nextAsync === -1 ? source.length : nextAsync);
}

describe('retention backlog drain', () => {
    it('collects currently expired ready/completed sessions without a backup prerequisite', () => {
        const worker = readWorkspaceFile('../worker/retentionWorker.ts');
        const block = extractFunctionBlock(worker, 'collectExpiredSessionsReadyForPurge');

        expect(block).toContain('.orderBy(sessions.startedAt, sessions.id)');
        expect(block).toContain('lt(sessions.startedAt, expiryDate)');
        expect(block).toContain("INTERVAL '1 day'");
        expect(block).toContain('eq(sessions.recordingDeleted, false)');
        expect(block).toContain("eq(sessions.status, 'ready')");
        expect(block).toContain("eq(sessions.status, 'completed')");
        expect(block).toContain('reachedProcessingCap: sessionsToPurge.length >= limit');
        expect(block).not.toContain('partitionBackedUpSessions');
    });

    it('keeps draining retention backlog when a full purgeable batch was collected', () => {
        const worker = readWorkspaceFile('../worker/retentionWorker.ts');
        const block = extractFunctionBlock(worker, 'runRetentionCycle');

        expect(block).toContain('expiredResult.reachedProcessingCap ||');
        expect(block).toContain('repairResult.reachedProcessingCap ||');
        expect(block).not.toContain('expiredResult.processedCount >= BATCH_SIZE');
    });

    it('keeps expired-repair cleanup bound to the current retention period', () => {
        const purgeSource = readWorkspaceFile('../services/sessionArtifactPurge.ts');
        const block = extractFunctionBlock(purgeSource, 'collectExpiredRepairCandidates');

        expect(block).toContain('.orderBy(sessions.startedAt, sessions.id)');
        expect(block).toContain('eq(sessions.recordingDeleted, true)');
        expect(block).toContain('eq(sessions.isReplayExpired, true)');
        expect(block).toContain("INTERVAL '1 day'");
        expect(block).toContain('reachedProcessingCap: sessionsToRepair.length >= limit');
        expect(block).not.toContain('partitionBackedUpSessions');
    });
});
