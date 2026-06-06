import { logger } from '../logger.js';
import {
    SESSION_EFFECTS_QUEUE_NAME,
    createArtifactBullWorker,
    getSessionEffectsQueue,
    type Job,
    type SessionEffectsJobData,
} from './artifactBullQueue.js';
import { runArtifactCompletionEffects } from './artifactCompletionEffects.js';
import { canOpenReplayFromSessionFields } from './replayAvailability.js';
import { reconcileSessionState } from './sessionReconciliation.js';

const DEFAULT_SESSION_EFFECTS_DELAY_MS = 15_000;
const DEFAULT_SESSION_EFFECTS_CONCURRENCY = 12;

function parseBoundedInteger(
    raw: string | undefined,
    fallback: number,
    min: number,
    max: number,
): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(parsed)));
}

export function resolveSessionEffectsDelayMs(raw = process.env.RJ_SESSION_EFFECTS_DELAY_MS): number {
    return parseBoundedInteger(raw, DEFAULT_SESSION_EFFECTS_DELAY_MS, 1_000, 60_000);
}

export function resolveSessionEffectsConcurrency(raw = process.env.RJ_SESSION_EFFECTS_CONCURRENCY): number {
    return parseBoundedInteger(raw, DEFAULT_SESSION_EFFECTS_CONCURRENCY, 1, 64);
}

export function buildSessionEffectsJobId(
    sessionId: string,
    nowMs = Date.now(),
    delayMs = resolveSessionEffectsDelayMs(),
): string {
    const dueBucket = Math.floor((nowMs + delayMs) / Math.max(1, delayMs));
    return `session-effects-${sessionId}-${dueBucket}`;
}

export async function enqueueSessionEffectsJob(
    sessionId: string,
    options: { delayMs?: number; nowMs?: number } = {},
): Promise<boolean> {
    if (!sessionId) return false;

    const delayMs = options.delayMs ?? resolveSessionEffectsDelayMs();
    const queue = getSessionEffectsQueue();
    const jobId = buildSessionEffectsJobId(sessionId, options.nowMs ?? Date.now(), delayMs);
    const existing = await queue.getJob(jobId);

    if (existing) {
        logger.debug({ sessionId, jobId }, 'session.effects_job_already_exists');
        return false;
    }

    await queue.add('session-effects', { sessionId }, { jobId, delay: delayMs });
    logger.debug({ sessionId, jobId, delayMs }, 'session.effects_job_enqueued');
    return true;
}

export async function processSessionEffectsJobFromBullMQ(
    job: Job<SessionEffectsJobData>,
): Promise<void> {
    const sessionId = job.data.sessionId;
    if (!sessionId) {
        throw new Error('Session effects job missing sessionId');
    }

    const log = logger.child({
        event: 'session.effects_job',
        jobId: job.id,
        sessionId,
        attemptNumber: (job.attemptsMade ?? 0) + 1,
    });

    const reconcileResult = await reconcileSessionState(sessionId);
    if (!reconcileResult) {
        log.warn('Session not found, skipping session effects job');
        return;
    }

    await runArtifactCompletionEffects({
        kind: 'events',
        replayAvailable: canOpenReplayFromSessionFields(reconcileResult),
        sessionId,
    });

    log.info({
        finalized: reconcileResult.finalized,
        replayAvailable: reconcileResult.replayAvailable,
        status: reconcileResult.status,
    }, 'session.effects_job_processed');
}

export function startSessionEffectsWorker(): { close: () => Promise<void> } {
    const concurrency = resolveSessionEffectsConcurrency();
    logger.info(
        { queueName: SESSION_EFFECTS_QUEUE_NAME, concurrency },
        'Session effects BullMQ worker starting',
    );

    return createArtifactBullWorker<SessionEffectsJobData>(
        SESSION_EFFECTS_QUEUE_NAME,
        processSessionEffectsJobFromBullMQ,
        concurrency,
    );
}
