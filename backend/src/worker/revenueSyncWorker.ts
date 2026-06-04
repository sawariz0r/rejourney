/**
 * Revenue Sync Worker
 *
 * Runs scheduled Superwall and custom-event revenue sync outside API pods.
 * Individual sync jobs still use the DB claim in revenueSources to prevent
 * duplicate provider work if this process is ever scaled above one replica.
 */

import { pool } from '../db/client.js';
import { closeRedis, initRedis } from '../db/redis.js';
import { logger } from '../logger.js';
import { pingWorker } from '../services/monitoring.js';
import {
    startRevenueSourceSyncScheduler,
    stopRevenueSourceSyncScheduler,
} from '../services/revenueSources.js';

const WORKER_NAME = 'revenueSyncWorker';
const HEARTBEAT_INTERVAL_MS = 60_000;

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let isShuttingDown = false;

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

async function sendHeartbeat(): Promise<void> {
    await pingWorker(WORKER_NAME, 'up', 'scheduler=running').catch((err) => {
        logger.debug({ err }, 'Failed to send revenue sync worker heartbeat');
    });
}

async function shutdown(signal: string, exitCode = 0): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ signal }, 'Revenue sync worker shutting down');

    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    stopRevenueSourceSyncScheduler();

    await Promise.allSettled([
        closeRedis(),
        pool.end(),
    ]);

    process.exit(exitCode);
}

async function startRevenueSyncWorker(): Promise<void> {
    await initRedis();

    startRevenueSourceSyncScheduler();
    await sendHeartbeat();
    heartbeatInterval = setInterval(() => {
        void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    logger.info({ heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS }, 'Revenue sync worker started');
}

process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
    void shutdown('SIGINT');
});
process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Revenue sync worker uncaught exception');
    void pingWorker(WORKER_NAME, 'down', errorMessage(err))
        .finally(() => shutdown('uncaughtException', 1));
});
process.on('unhandledRejection', (err) => {
    logger.error({ err }, 'Revenue sync worker unhandled rejection');
    void pingWorker(WORKER_NAME, 'down', errorMessage(err))
        .finally(() => shutdown('unhandledRejection', 1));
});

startRevenueSyncWorker().catch((err) => {
    logger.error({ err }, 'Revenue sync worker fatal startup error');
    void pingWorker(WORKER_NAME, 'down', errorMessage(err))
        .finally(() => shutdown('startupError', 1));
});
