import { afterEach, describe, expect, it, vi } from 'vitest';
import { pingWorker, type WorkerMetric } from '../services/monitoring.js';

describe('monitoring metrics', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        delete process.env.PUSHGATEWAY_URL;
    });

    it('renders repeated labeled metrics with one HELP/TYPE block', async () => {
        process.env.PUSHGATEWAY_URL = 'http://pushgateway.test';
        const fetchMock = vi.fn(async () => ({ ok: true })) as any;
        vi.stubGlobal('fetch', fetchMock);

        const metrics: WorkerMetric[] = [
            {
                help: 'BullMQ jobs by queue and state, sampled by worker heartbeat',
                labels: { queue: 'rj-ingest-artifacts', state: 'waiting' },
                name: 'rejourney_bullmq_queue_jobs',
                value: 42,
            },
            {
                help: 'BullMQ jobs by queue and state, sampled by worker heartbeat',
                labels: { queue: 'rj-ingest-artifacts', state: 'active' },
                name: 'rejourney_bullmq_queue_jobs',
                value: 12,
            },
        ];

        await pingWorker('sessionLifecycleWorker', 'up', 'ok', undefined, metrics);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const body = String(fetchMock.mock.calls[0]?.[1]?.body ?? '');
        expect(body.match(/# HELP rejourney_bullmq_queue_jobs/g)).toHaveLength(1);
        expect(body.match(/# TYPE rejourney_bullmq_queue_jobs/g)).toHaveLength(1);
        expect(body).toContain('rejourney_bullmq_queue_jobs{queue="rj-ingest-artifacts",state="waiting"} 42');
        expect(body).toContain('rejourney_bullmq_queue_jobs{queue="rj-ingest-artifacts",state="active"} 12');
    });
});
