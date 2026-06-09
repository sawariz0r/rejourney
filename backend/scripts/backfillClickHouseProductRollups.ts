import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { config } from '../src/config.js';
import { appDailyStats, deviceUsage, screenTouchHeatmaps } from '../src/db/schema.js';
import { db } from '../src/db/client.js';
import { getClickHouseClient, isClickHouseConfigured } from '../src/db/clickhouse.js';
import {
    buildClickHouseDeviceUsageDailyRollupRow,
    buildClickHouseProductAnalyticsDailyRollupRows,
    buildClickHouseScreenHeatmapDailyRollupRows,
    hasClickHouseDeviceUsageDailyRollupValue,
    type ClickHouseAppDailyRollupRow,
    type ClickHouseAppDimensionDailyRollupRow,
    type ClickHouseDeviceUsageDailyRollupRow,
    type ClickHouseScreenHeatmapDailyRollupRow,
} from '../src/services/clickhouseProductRollupsSink.js';

type SqlCondition = ReturnType<typeof eq>;

function readArg(name: string): string | undefined {
    const prefix = `--${name}=`;
    const match = process.argv.find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length).trim() : undefined;
}

function hasFlag(name: string): boolean {
    return process.argv.includes(`--${name}`);
}

function validateDate(name: string, value?: string): string | undefined {
    if (!value) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`${name} must be YYYY-MM-DD`);
    }
    return value;
}

function validatePositiveInt(name: string, value?: string): number {
    const parsed = Number(value ?? 1000);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }
    return parsed;
}

function whereClause(conditions: Array<SqlCondition | undefined>) {
    const filtered = conditions.filter(Boolean) as SqlCondition[];
    return filtered.length > 0 ? and(...filtered) : undefined;
}

function chunk<T>(values: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < values.length; i += size) {
        chunks.push(values.slice(i, i + size));
    }
    return chunks;
}

function clickHouseInsertSettings(): Record<string, unknown> {
    return {
        ...(config.CLICKHOUSE_ASYNC_INSERT ? { async_insert: 1 as const, wait_for_async_insert: 1 as const } : {}),
    };
}

async function insertRows<T>(table: string, rows: T[], batchSize: number): Promise<void> {
    for (const batch of chunk(rows, batchSize)) {
        if (batch.length === 0) continue;
        await getClickHouseClient().insert({
            table,
            values: batch,
            format: 'JSONEachRow',
            clickhouse_settings: clickHouseInsertSettings(),
        });
    }
}

async function main(): Promise<void> {
    if (!isClickHouseConfigured()) {
        console.log('[clickhouse-product-rollups-backfill] ClickHouse disabled; skipping');
        return;
    }

    const startDate = validateDate('--start-date', readArg('start-date') || process.env.CLICKHOUSE_PRODUCT_ROLLUPS_BACKFILL_START_DATE);
    const endDate = validateDate('--end-date', readArg('end-date') || process.env.CLICKHOUSE_PRODUCT_ROLLUPS_BACKFILL_END_DATE);
    const projectId = readArg('project-id') || process.env.CLICKHOUSE_PRODUCT_ROLLUPS_BACKFILL_PROJECT_ID;
    const batchSize = validatePositiveInt('--batch-size', readArg('batch-size') || process.env.CLICKHOUSE_PRODUCT_ROLLUPS_BACKFILL_BATCH_SIZE);
    const dryRun = hasFlag('dry-run');

    console.log('[clickhouse-product-rollups-backfill] starting', {
        startDate: startDate || null,
        endDate: endDate || null,
        projectId: projectId || null,
        batchSize,
        dryRun,
    });

    const appDailyRows = await db
        .select({
            projectId: appDailyStats.projectId,
            date: appDailyStats.date,
            totalSessions: appDailyStats.totalSessions,
            completedSessions: appDailyStats.completedSessions,
            avgDurationSeconds: appDailyStats.avgDurationSeconds,
            avgInteractionScore: appDailyStats.avgInteractionScore,
            avgUxScore: appDailyStats.avgUxScore,
            avgApiErrorRate: appDailyStats.avgApiErrorRate,
            avgApiResponseMs: appDailyStats.avgApiResponseMs,
            p50Duration: appDailyStats.p50Duration,
            p90Duration: appDailyStats.p90Duration,
            p50InteractionScore: appDailyStats.p50InteractionScore,
            p90InteractionScore: appDailyStats.p90InteractionScore,
            totalErrors: appDailyStats.totalErrors,
            totalRageTaps: appDailyStats.totalRageTaps,
            totalDeadTaps: appDailyStats.totalDeadTaps,
            totalCrashes: appDailyStats.totalCrashes,
            totalAnrs: appDailyStats.totalAnrs,
            totalBouncers: appDailyStats.totalBouncers,
            totalCasuals: appDailyStats.totalCasuals,
            totalExplorers: appDailyStats.totalExplorers,
            totalLoyalists: appDailyStats.totalLoyalists,
            totalTouches: appDailyStats.totalTouches,
            totalScrolls: appDailyStats.totalScrolls,
            totalGestures: appDailyStats.totalGestures,
            totalInteractions: appDailyStats.totalInteractions,
            deviceModelBreakdown: appDailyStats.deviceModelBreakdown,
            osVersionBreakdown: appDailyStats.osVersionBreakdown,
            platformBreakdown: appDailyStats.platformBreakdown,
            appVersionBreakdown: appDailyStats.appVersionBreakdown,
            screenViewBreakdown: appDailyStats.screenViewBreakdown,
            screenTransitionBreakdown: appDailyStats.screenTransitionBreakdown,
            entryScreenBreakdown: appDailyStats.entryScreenBreakdown,
            exitScreenBreakdown: appDailyStats.exitScreenBreakdown,
            geoCountryBreakdown: appDailyStats.geoCountryBreakdown,
            customEventBreakdown: appDailyStats.customEventBreakdown,
            uniqueUserCount: appDailyStats.uniqueUserCount,
        })
        .from(appDailyStats)
        .where(whereClause([
            projectId ? eq(appDailyStats.projectId, projectId) : undefined,
            startDate ? gte(appDailyStats.date, startDate) : undefined,
            endDate ? lte(appDailyStats.date, endDate) : undefined,
        ]));

    const appRollupRows: ClickHouseAppDailyRollupRow[] = [];
    const dimensionRows: ClickHouseAppDimensionDailyRollupRow[] = [];
    for (const row of appDailyRows) {
        const built = buildClickHouseProductAnalyticsDailyRollupRows({
            projectId: row.projectId,
            date: row.date,
            totalSessions: row.totalSessions,
            completedSessions: row.completedSessions,
            avgDurationSeconds: row.avgDurationSeconds,
            avgInteractionScore: row.avgInteractionScore,
            avgUxScore: row.avgUxScore,
            avgApiErrorRate: row.avgApiErrorRate,
            avgApiResponseMs: row.avgApiResponseMs,
            p50Duration: row.p50Duration,
            p90Duration: row.p90Duration,
            p50InteractionScore: row.p50InteractionScore,
            p90InteractionScore: row.p90InteractionScore,
            totalErrors: row.totalErrors,
            totalRageTaps: row.totalRageTaps,
            totalDeadTaps: row.totalDeadTaps,
            totalCrashes: row.totalCrashes,
            totalAnrs: row.totalAnrs,
            totalBouncers: row.totalBouncers,
            totalCasuals: row.totalCasuals,
            totalExplorers: row.totalExplorers,
            totalLoyalists: row.totalLoyalists,
            totalTouches: row.totalTouches,
            totalScrolls: row.totalScrolls,
            totalGestures: row.totalGestures,
            totalInteractions: row.totalInteractions,
            uniqueUserCount: row.uniqueUserCount,
            deviceModelBreakdown: row.deviceModelBreakdown,
            osVersionBreakdown: row.osVersionBreakdown,
            platformBreakdown: row.platformBreakdown,
            appVersionBreakdown: row.appVersionBreakdown,
            screenViewBreakdown: row.screenViewBreakdown,
            screenTransitionBreakdown: row.screenTransitionBreakdown,
            entryScreenBreakdown: row.entryScreenBreakdown,
            exitScreenBreakdown: row.exitScreenBreakdown,
            geoCountryBreakdown: row.geoCountryBreakdown,
            customEventBreakdown: row.customEventBreakdown,
            source: 'postgres_backfill',
        });
        appRollupRows.push(built.dailyRow);
        dimensionRows.push(...built.dimensionRows);
    }

    const heatmapRows = await db
        .select({
            projectId: screenTouchHeatmaps.projectId,
            screenName: screenTouchHeatmaps.screenName,
            date: screenTouchHeatmaps.date,
            touchBuckets: screenTouchHeatmaps.touchBuckets,
            rageTapBuckets: screenTouchHeatmaps.rageTapBuckets,
            screenFirstSeenMs: screenTouchHeatmaps.screenFirstSeenMs,
            pageWidth: screenTouchHeatmaps.pageWidth,
            pageHeight: screenTouchHeatmaps.pageHeight,
            viewportWidth: screenTouchHeatmaps.viewportWidth,
            viewportHeight: screenTouchHeatmaps.viewportHeight,
        })
        .from(screenTouchHeatmaps)
        .where(whereClause([
            projectId ? eq(screenTouchHeatmaps.projectId, projectId) : undefined,
            startDate ? gte(screenTouchHeatmaps.date, startDate) : undefined,
            endDate ? lte(screenTouchHeatmaps.date, endDate) : undefined,
        ]));

    const clickHouseHeatmapRows: ClickHouseScreenHeatmapDailyRollupRow[] = [];
    for (const row of heatmapRows) {
        clickHouseHeatmapRows.push(...buildClickHouseScreenHeatmapDailyRollupRows({
            projectId: row.projectId,
            date: row.date,
            screenName: row.screenName,
            touchBuckets: row.touchBuckets,
            rageTapBuckets: row.rageTapBuckets,
            screenFirstSeenMs: row.screenFirstSeenMs,
            pageWidth: row.pageWidth,
            pageHeight: row.pageHeight,
            viewportWidth: row.viewportWidth,
            viewportHeight: row.viewportHeight,
            source: 'postgres_heatmap_backfill',
        }));
    }

    const usageRows = await db
        .select({
            projectId: deviceUsage.projectId,
            period: deviceUsage.period,
            bytesUploaded: sql<string>`COALESCE(SUM(${deviceUsage.bytesUploaded}), 0)`,
            minutesRecorded: sql<string>`COALESCE(SUM(${deviceUsage.minutesRecorded}), 0)`,
            sessionsStarted: sql<string>`COALESCE(SUM(${deviceUsage.sessionsStarted}), 0)`,
            requestCount: sql<string>`COALESCE(SUM(${deviceUsage.requestCount}), 0)`,
        })
        .from(deviceUsage)
        .where(whereClause([
            projectId ? eq(deviceUsage.projectId, projectId) : undefined,
            startDate ? gte(deviceUsage.period, startDate) : undefined,
            endDate ? lte(deviceUsage.period, endDate) : undefined,
        ]))
        .groupBy(deviceUsage.projectId, deviceUsage.period);

    const deviceUsageRows: ClickHouseDeviceUsageDailyRollupRow[] = usageRows
        .map((row) => buildClickHouseDeviceUsageDailyRollupRow({
            projectId: row.projectId,
            period: row.period,
            bytesUploaded: row.bytesUploaded,
            minutesRecorded: row.minutesRecorded,
            sessionsStarted: row.sessionsStarted,
            requestCount: row.requestCount,
            source: 'postgres_device_usage_backfill',
        }))
        .filter(hasClickHouseDeviceUsageDailyRollupValue);

    console.log('[clickhouse-product-rollups-backfill] generated rows', {
        appDailyStatsSourceRows: appDailyRows.length,
        appRollupRows: appRollupRows.length,
        dimensionRows: dimensionRows.length,
        heatmapSourceRows: heatmapRows.length,
        heatmapBucketRows: clickHouseHeatmapRows.length,
        deviceUsageRows: deviceUsageRows.length,
    });

    if (dryRun) {
        console.log('[clickhouse-product-rollups-backfill] dry run complete; no ClickHouse writes performed');
        return;
    }

    await insertRows('app_daily_rollups', appRollupRows, batchSize);
    await insertRows('app_dimension_daily_rollups', dimensionRows, batchSize);
    await insertRows('screen_touch_heatmap_daily_rollups', clickHouseHeatmapRows, batchSize);
    await insertRows('device_usage_daily_rollups', deviceUsageRows, batchSize);

    console.log('[clickhouse-product-rollups-backfill] complete');
}

main().catch((error) => {
    console.error('[clickhouse-product-rollups-backfill] failed', error);
    process.exit(1);
});
