import { describe, expect, it } from 'vitest';

import {
    buildRevenueCatOverviewEndpoint,
    buildRevenueCatRevenueChartEndpoint,
    buildSuperwallProjectsEndpoint,
    buildSuperwallQueryEndpoint,
    buildSuperwallRevenueQuery,
    extractSuperwallOrganizationId,
    parseRevenueCatRevenueChartRows,
} from '../services/revenueSources.js';

describe('Superwall revenue source helpers', () => {
    it('builds the current organization-scoped query endpoint', () => {
        expect(buildSuperwallQueryEndpoint('https://api.superwall.com/', 'org_123')).toBe(
            'https://api.superwall.com/v2/organizations/org_123/query',
        );
    });

    it('builds the project discovery endpoint used to infer organization ID', () => {
        expect(buildSuperwallProjectsEndpoint('https://api.superwall.com/')).toBe(
            'https://api.superwall.com/v2/projects?limit=1',
        );
    });

    it('requires an organization ID for Superwall query syncs', () => {
        expect(() => buildSuperwallQueryEndpoint('https://api.superwall.com', '   ')).toThrow(
            'Superwall organization ID is required for revenue sync',
        );
    });

    it('extracts organization ID from Superwall project responses', () => {
        expect(extractSuperwallOrganizationId({
            data: [
                {
                    id: 'project_123',
                    organization_id: 42,
                    applications: [],
                },
            ],
        })).toBe('42');

        expect(extractSuperwallOrganizationId({
            projects: [
                {
                    id: 'project_123',
                    organizationId: 'org_abc',
                },
            ],
        })).toBe('org_abc');
    });

    it('builds a raw ClickHouse revenue query with an escaped app filter', () => {
        const query = buildSuperwallRevenueQuery(new Date('2026-06-05T14:22:53.000Z'), "app'one");

        expect(query).toContain("WHERE coalesce(transactionCompleteEventDate, purchasedAt, ts) >= toDateTime('2026-06-05 14:22:53')");
        expect(query).toContain("AND toString(applicationId) = 'app''one'");
        expect(query).toContain("lower(coalesce(currencyCode, 'usd')) AS currency");
        expect(query).toContain('coalesce(priceInPurchasedCurrency, price, proceeds, 0)');
        expect(query).toContain('FROM open_revenue.attributed_events_by_ts_rep');
        expect(query).toContain('FORMAT JSONEachRow');
    });
});

describe('RevenueCat revenue source helpers', () => {
    it('builds v2 overview and revenue chart endpoints', () => {
        expect(buildRevenueCatOverviewEndpoint('https://api.revenuecat.com/v2/', 'proj123', 'eur')).toBe(
            'https://api.revenuecat.com/v2/projects/proj123/metrics/overview?currency=EUR',
        );

        expect(buildRevenueCatRevenueChartEndpoint({
            baseUrl: 'https://api.revenuecat.com/v2/',
            revenueCatProjectId: 'proj123',
            startDate: '2026-05-01',
            endDate: '2026-06-05',
        })).toBe(
            'https://api.revenuecat.com/v2/projects/proj123/charts/revenue?realtime=true&resolution=0&start_date=2026-05-01&end_date=2026-06-05',
        );
    });

    it('requires a RevenueCat project ID for RevenueCat endpoints', () => {
        expect(() => buildRevenueCatOverviewEndpoint('https://api.revenuecat.com/v2', '  ')).toThrow(
            'RevenueCat project ID is required for revenue sync',
        );
    });

    it('parses RevenueCat chart data from object and array rows', () => {
        const rows = parseRevenueCatRevenueChartRows({
            yaxis_currency: 'USD',
            measures: [{ id: 'gross_revenue' }, { id: 'transactions' }],
            values: [
                ['2026-06-01', 12.34, 3],
                { date: '2026-06-02', revenue: 7.5, transactions: 2, currency: 'EUR' },
            ],
        });

        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({
            externalTransactionId: 'revenuecat:2026-06-01:usd',
            amountCents: 1234,
            grossAmountCents: 1234,
            currency: 'usd',
            metadata: expect.objectContaining({ transactionCount: 3 }),
        });
        expect(rows[1]).toMatchObject({
            externalTransactionId: 'revenuecat:2026-06-02:eur',
            amountCents: 750,
            grossAmountCents: 750,
            currency: 'eur',
            metadata: expect.objectContaining({ transactionCount: 2 }),
        });
    });
});
