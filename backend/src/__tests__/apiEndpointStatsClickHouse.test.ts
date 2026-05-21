import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    config: {
        CLICKHOUSE_CUTOVER_DATE: '',
        CLICKHOUSE_RAW_READS_AFTER: '',
    },
    isReadsEnabled: vi.fn(() => true),
    query: vi.fn(),
}));

vi.mock('../config.js', () => ({
    config: mocks.config,
}));

vi.mock('../db/clickhouse.js', () => ({
    getClickHouseClient: () => ({ query: mocks.query }),
    isClickHouseReadsEnabled: mocks.isReadsEnabled,
}));

import {
    queryApiEndpointStatusRowsFromClickHouse,
    queryRegionStatsFromClickHouse,
} from '../services/apiEndpointStatsClickHouse.js';

describe('apiEndpointStatsClickHouse', () => {
    beforeEach(() => {
        mocks.config.CLICKHOUSE_CUTOVER_DATE = '';
        mocks.config.CLICKHOUSE_RAW_READS_AFTER = '';
        mocks.isReadsEnabled.mockReturnValue(true);
        mocks.query.mockReset();
        mocks.query.mockResolvedValue({ json: async () => [] });
    });

    it('reads only raw request facts when no cutover date is configured', async () => {
        await queryApiEndpointStatusRowsFromClickHouse({
            projectIds: ['3f4f7d8a-7660-4a78-b944-442051c62eca'],
            startDate: '2026-05-01',
        });

        const call = mocks.query.mock.calls[0]?.[0];
        expect(call.query).toContain('FROM api_endpoint_request_events');
        expect(call.query).not.toContain('api_endpoint_daily_stats_imported');
        expect(call.query).not.toContain('UNION ALL');
        expect(call.query_params).toEqual({
            projectIds: ['3f4f7d8a-7660-4a78-b944-442051c62eca'],
            startDate: '2026-05-01',
        });
    });

    it('unions imported history and raw facts when a cutover date is configured', async () => {
        mocks.config.CLICKHOUSE_CUTOVER_DATE = '2026-05-21';

        await queryApiEndpointStatusRowsFromClickHouse({
            projectIds: ['3f4f7d8a-7660-4a78-b944-442051c62eca'],
            startDate: '2026-05-01',
        });

        const call = mocks.query.mock.calls[0]?.[0];
        expect(call.query).toContain('FROM api_endpoint_daily_stats_imported FINAL');
        expect(call.query).toContain('date < {cutoverDate:Date}');
        expect(call.query).toContain('FROM api_endpoint_request_events');
        expect(call.query).toContain('event_date >= {cutoverDate:Date}');
        expect(call.query).toContain('UNION ALL');
        expect(call.query_params).toEqual({
            projectIds: ['3f4f7d8a-7660-4a78-b944-442051c62eca'],
            startDate: '2026-05-01',
            cutoverDate: '2026-05-21',
        });
    });

    it('can add same-day raw facts after a final backfill timestamp', async () => {
        mocks.config.CLICKHOUSE_CUTOVER_DATE = '2026-05-22';
        mocks.config.CLICKHOUSE_RAW_READS_AFTER = '2026-05-21T20:15:30.123Z';

        await queryApiEndpointStatusRowsFromClickHouse({
            projectIds: ['3f4f7d8a-7660-4a78-b944-442051c62eca'],
            startDate: '2026-05-01',
        });

        const call = mocks.query.mock.calls[0]?.[0];
        expect(call.query).toContain('date < {cutoverDate:Date}');
        expect(call.query).toContain('event_date >= {cutoverDate:Date}');
        expect(call.query).toContain('event_date = {rawReadsAfterDate:Date}');
        expect(call.query).toContain("inserted_at > toDateTime64({rawReadsAfter:String}, 3, 'UTC')");
        expect(call.query_params).toEqual({
            projectIds: ['3f4f7d8a-7660-4a78-b944-442051c62eca'],
            startDate: '2026-05-01',
            cutoverDate: '2026-05-22',
            rawReadsAfterDate: '2026-05-21',
            rawReadsAfter: '2026-05-21 20:15:30.123',
        });
    });

    it('applies the same cutover split to region stats', async () => {
        mocks.config.CLICKHOUSE_CUTOVER_DATE = '2026-05-21';

        await queryRegionStatsFromClickHouse({
            projectId: '3f4f7d8a-7660-4a78-b944-442051c62eca',
            startDate: '2026-05-01',
        });

        const call = mocks.query.mock.calls[0]?.[0];
        expect(call.query).toContain('FROM api_endpoint_daily_stats_imported FINAL');
        expect(call.query).toContain('date < {cutoverDate:Date}');
        expect(call.query).toContain('FROM api_endpoint_request_events');
        expect(call.query).toContain('event_date >= {cutoverDate:Date}');
        expect(call.query).toContain('GROUP BY region');
        expect(call.query_params).toEqual({
            projectId: '3f4f7d8a-7660-4a78-b944-442051c62eca',
            startDate: '2026-05-01',
            cutoverDate: '2026-05-21',
        });
    });

    it('applies the same-day raw window to region stats', async () => {
        mocks.config.CLICKHOUSE_CUTOVER_DATE = '2026-05-22';
        mocks.config.CLICKHOUSE_RAW_READS_AFTER = '2026-05-21T20:15:30.123Z';

        await queryRegionStatsFromClickHouse({
            projectId: '3f4f7d8a-7660-4a78-b944-442051c62eca',
            startDate: '2026-05-01',
        });

        const call = mocks.query.mock.calls[0]?.[0];
        expect(call.query).toContain('event_date = {rawReadsAfterDate:Date}');
        expect(call.query).toContain("inserted_at > toDateTime64({rawReadsAfter:String}, 3, 'UTC')");
        expect(call.query_params).toEqual({
            projectId: '3f4f7d8a-7660-4a78-b944-442051c62eca',
            startDate: '2026-05-01',
            cutoverDate: '2026-05-22',
            rawReadsAfterDate: '2026-05-21',
            rawReadsAfter: '2026-05-21 20:15:30.123',
        });
    });
});
