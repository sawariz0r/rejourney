import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { config, isTest } from '../config.js';
import { db, dbRead } from '../db/client.js';
import {
    projectRevenueConnections,
    projectRevenueDaily,
    projectRevenueSourceSettings,
    projects,
    revenueProviderTransactions,
    sessions,
} from '../db/schema.js';
import { logger } from '../logger.js';
import {
    buildClickHouseRevenueEventRow,
    writeRevenueEventsToClickHouse,
} from './clickhouseRevenueEventsSink.js';
import { encrypt, isEncryptionKeyConfigured, safeDecrypt, safeEncrypt } from './crypto.js';

// Providers all write into the same generic revenue tables and ClickHouse
// revenue_events fact table.
export const SUPPORTED_REVENUE_PROVIDERS = ['custom_events', 'superwall', 'revenuecat'] as const;
export type RevenueProvider = typeof SUPPORTED_REVENUE_PROVIDERS[number];
export type RevenueConnectionStatus = 'not_connected' | 'connected' | 'syncing' | 'error' | 'disconnected';
export type RevenueSyncMode = 'initial' | 'manual' | 'scheduled';

export interface RevenueCurrencySummary {
    currency: string;
    grossAmountCents: number;
}

export interface RevenueManualEntry {
    id: string;
    date: string;
    currency: string;
    amountCents: number;
    transactionCount: number;
    note: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface RevenueDailyRow {
    date: string;
    currency: string;
    grossAmountCents: number;
    refundAmountCents: number;
    feeAmountCents: number;
    netAmountCents: number;
    transactionCount: number;
    refundCount: number;
    subscriberCount: number;
    trialCount: number;
    subscriptionStartCount: number;
    cancellationCount: number;
    conversionCount: number;
    customEventCounts: Record<string, number>;
}

export interface RevenueProviderStatus {
    provider: RevenueProvider;
    label: string;
    configured: boolean;
    status: RevenueConnectionStatus;
    accountId: string | null;
    accountName: string | null;
    connectedAt: string | null;
    lastSyncStartedAt: string | null;
    lastSyncCompletedAt: string | null;
    lastSyncError: string | null;
}

export interface RevenueSyncPreview {
    provider: RevenueProvider;
    scannedSessionCount: number;
    matchedSessionCount: number;
    matchedEventCount: number;
    revenueEventCount: number;
}

export interface CustomRevenueEventConfig {
    revenueEventName: string;
    revenueAmountProperty: string;
    revenueCurrencyProperty: string;
    defaultCurrency: string;
    amountUnit: 'major' | 'minor';
    refundEventName?: string | null;
    subscriberEventName?: string | null;
    trialStartedEventName?: string | null;
    subscriptionStartedEventName?: string | null;
    cancellationEventName?: string | null;
    conversionEventName?: string | null;
}

export interface RevenueOverview {
    configured: boolean;
    activeProvider: RevenueProvider | null;
    providers: RevenueProviderStatus[];
    connection: RevenueProviderStatus & { canManage: boolean };
    customEventConfig: CustomRevenueEventConfig | null;
    syncPreview: RevenueSyncPreview | null;
    manualEntries: RevenueManualEntry[];
    currencies: RevenueCurrencySummary[];
    selectedCurrency: string | null;
    summary: {
        grossAmountCents: number;
        refundAmountCents: number;
        feeAmountCents: number;
        netAmountCents: number;
        transactionCount: number;
        refundCount: number;
        subscriberCount: number;
        trialCount: number;
        subscriptionStartCount: number;
        cancellationCount: number;
        conversionCount: number;
        previousGrossAmountCents: number | null;
        grossChangePercent: number | null;
    };
    daily: RevenueDailyRow[];
}

export interface GenericRevenueTransaction {
    externalTransactionId: string;
    externalSourceId?: string | null;
    occurredAt: Date;
    amountCents: number;
    feeCents: number;
    netCents: number;
    grossAmountCents: number;
    refundAmountCents: number;
    currency: string;
    type: string;
    reportingCategory?: string | null;
    metadata?: Record<string, unknown>;
}

interface RawAggregateRow {
    date: string;
    currency: string;
    gross_amount_cents: string | number;
    refund_amount_cents: string | number;
    fee_amount_cents: string | number;
    net_amount_cents: string | number;
    transaction_count: string | number;
    refund_count: string | number;
    subscriber_count?: string | number;
    trial_count?: string | number;
    subscription_start_count?: string | number;
    cancellation_count?: string | number;
    conversion_count?: string | number;
}

interface CustomEventAggregateRow extends RawAggregateRow {
    custom_event_counts?: Record<string, number> | null;
}

const PROVIDER_LABELS: Record<RevenueProvider, string> = {
    superwall: 'Superwall',
    revenuecat: 'RevenueCat',
    custom_events: 'Custom events',
};

const MANUAL_REVENUE_SOURCE = 'manual_historical';
const GENERIC_REVENUE_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const GENERIC_REVENUE_SYNC_STALE_MS = 60 * 60 * 1000;
const GENERIC_REVENUE_UPSERT_BATCH_SIZE = 500;
const GENERIC_REVENUE_BACKFILL_DAYS = 365;
const GENERIC_REVENUE_INCREMENTAL_OVERLAP_MS = 48 * 60 * 60 * 1000;

const runningProviderSyncs = new Set<string>();
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

interface GenericRevenueProviderSyncResult {
    importedDateCount: number;
    transactionCount: number;
    fullBackfill: boolean;
}

export function resolveGenericRevenueSyncWindow(input: {
    mode: RevenueSyncMode;
    newestSyncedAt?: Date | null;
    hasProviderTransactions: boolean;
    now?: Date;
}): { startDate: Date; fullBackfill: boolean } {
    const now = input.now ?? new Date();
    const newestSyncedAt = input.newestSyncedAt ?? null;
    const fullBackfill = input.mode === 'initial' || !newestSyncedAt || !input.hasProviderTransactions;
    const startDate = fullBackfill
        ? new Date(now.getTime() - GENERIC_REVENUE_BACKFILL_DAYS * 24 * 60 * 60 * 1000)
        : new Date(newestSyncedAt.getTime() - GENERIC_REVENUE_INCREMENTAL_OVERLAP_MS);
    return { startDate, fullBackfill };
}
let initialSchedulerTimeout: ReturnType<typeof setTimeout> | null = null;

function providerSyncKey(projectId: string, provider: RevenueProvider): string {
    return `${projectId}:${provider}`;
}

export function isSuperwallRevenueSourceConfigured(): boolean {
    return isEncryptionKeyConfigured('superwallApiKey');
}

export function isRevenueCatRevenueSourceConfigured(): boolean {
    return isEncryptionKeyConfigured('revenueCatApiKey');
}

function isProviderConfigured(provider: RevenueProvider): boolean {
    if (provider === 'superwall') return isSuperwallRevenueSourceConfigured();
    if (provider === 'revenuecat') return isRevenueCatRevenueSourceConfigured();
    return true;
}

function toUtcDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function numberFromDb(value: string | number | null | undefined): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function normalizeCurrency(value: unknown, fallback = 'usd'): string {
    const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return text || fallback;
}

function parseIsoDate(value: unknown): Date | null {
    if (value instanceof Date && Number.isFinite(value.getTime())) return value;
    if (typeof value === 'number' && Number.isFinite(value)) {
        const millis = value > 10_000_000_000 ? value : value * 1000;
        const date = new Date(millis);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value !== 'string' || !value.trim()) return null;
    const date = new Date(value.includes('T') ? value : `${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function minorFromMajorAmount(value: unknown): number | null {
    const numeric = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''));
    if (!Number.isFinite(numeric)) return null;
    return Math.round(numeric * 100);
}

function positiveInt(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function safeJsonRecord(value: string): Record<string, unknown> {
    try {
        return asRecord(JSON.parse(value)) ?? {};
    } catch {
        return {};
    }
}

function modeSafeDateKey(value: Date | null): string {
    return value ? value.toISOString().slice(0, 10) : 'full';
}

async function getProjectForRevenue(projectId: string): Promise<{ id: string; teamId: string } | null> {
    const [project] = await dbRead
        .select({ id: projects.id, teamId: projects.teamId })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

    return project ?? null;
}

async function getActiveProvider(projectId: string): Promise<RevenueProvider | null> {
    const [settings] = await dbRead
        .select({ activeProvider: projectRevenueSourceSettings.activeProvider })
        .from(projectRevenueSourceSettings)
        .where(eq(projectRevenueSourceSettings.projectId, projectId))
        .limit(1);

    if (isRevenueProvider(settings?.activeProvider)) return settings.activeProvider;

    return null;
}

function isRevenueProvider(value: unknown): value is RevenueProvider {
    return (SUPPORTED_REVENUE_PROVIDERS as readonly string[]).includes(String(value));
}

async function providerHasRevenueTransactions(projectId: string, provider: RevenueProvider): Promise<boolean> {
    const rows = await dbRead
        .select({ id: revenueProviderTransactions.id })
        .from(revenueProviderTransactions)
        .where(and(
            eq(revenueProviderTransactions.projectId, projectId),
            eq(revenueProviderTransactions.provider, provider),
            sql`(
                ${revenueProviderTransactions.amountCents} <> 0
                OR ${revenueProviderTransactions.grossAmountCents} <> 0
                OR ${revenueProviderTransactions.refundAmountCents} <> 0
                OR ${revenueProviderTransactions.netCents} <> 0
            )`,
        ))
        .limit(1);
    return rows.length > 0;
}

export async function setProjectRevenueActiveProvider(
    projectId: string,
    provider: RevenueProvider,
    userId: string | null,
): Promise<void> {
    const now = new Date();
    await db
        .insert(projectRevenueSourceSettings)
        .values({
            projectId,
            activeProvider: provider,
            connectedByUserId: userId,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: projectRevenueSourceSettings.projectId,
            set: {
                activeProvider: provider,
                connectedByUserId: userId,
                updatedAt: now,
            },
        });
}

export async function updateProjectRevenueSource(
    projectId: string,
    provider: RevenueProvider,
    userId: string | null,
): Promise<void> {
    const connection = await getProviderConnection(projectId, provider);
    if (!connection || connection.status === 'disconnected') {
        throw new Error(`${PROVIDER_LABELS[provider]} revenue is not connected for this project`);
    }

    await setProjectRevenueActiveProvider(projectId, provider, userId);
}

function defaultProviderStatus(provider: RevenueProvider): RevenueProviderStatus {
    return {
        provider,
        label: PROVIDER_LABELS[provider],
        configured: isProviderConfigured(provider),
        status: 'not_connected',
        accountId: null,
        accountName: null,
        connectedAt: null,
        lastSyncStartedAt: null,
        lastSyncCompletedAt: null,
        lastSyncError: null,
    };
}

async function getProviderStatuses(projectId: string): Promise<RevenueProviderStatus[]> {
    const statuses = new Map<RevenueProvider, RevenueProviderStatus>(
        SUPPORTED_REVENUE_PROVIDERS
            .map((provider) => [provider, defaultProviderStatus(provider)]),
    );

    const genericConnections = await dbRead
        .select()
        .from(projectRevenueConnections)
        .where(eq(projectRevenueConnections.projectId, projectId));

    for (const connection of genericConnections) {
        if (!isRevenueProvider(connection.provider)) continue;
        statuses.set(connection.provider, {
            ...defaultProviderStatus(connection.provider),
            status: connection.status as RevenueConnectionStatus,
            accountId: connection.externalAccountId ?? null,
            accountName: connection.externalAccountName ?? null,
            connectedAt: connection.createdAt?.toISOString() ?? null,
            lastSyncStartedAt: connection.lastSyncStartedAt?.toISOString() ?? null,
            lastSyncCompletedAt: connection.lastSyncCompletedAt?.toISOString() ?? null,
            lastSyncError: connection.lastSyncError ?? null,
        });
    }

    return Array.from(statuses.values());
}

function parseRevenueTimeRange(timeRange: string | undefined): number | null {
    if (!timeRange || timeRange === 'all') return null;
    if (timeRange === '24h') return 1;
    const match = /^(\d+)d$/.exec(timeRange);
    if (!match) return 30;
    const days = Number(match[1]);
    return Number.isFinite(days) && days > 0 ? days : 30;
}

function buildRevenueDateBounds(timeRange: string | undefined): {
    currentStartKey: string | null;
    previousStartKey: string | null;
    previousEndKey: string | null;
} {
    const days = parseRevenueTimeRange(timeRange);
    if (!days) return { currentStartKey: null, previousStartKey: null, previousEndKey: null };

    const today = new Date();
    const currentStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    currentStart.setUTCDate(currentStart.getUTCDate() - (days - 1));

    const previousStart = new Date(currentStart);
    previousStart.setUTCDate(previousStart.getUTCDate() - days);

    return {
        currentStartKey: toUtcDateKey(currentStart),
        previousStartKey: toUtcDateKey(previousStart),
        previousEndKey: toUtcDateKey(currentStart),
    };
}

async function getCurrencySummaries(
    projectId: string,
    provider: RevenueProvider | null,
    currentStartKey: string | null,
): Promise<RevenueCurrencySummary[]> {
    if (!provider) return [];
    const conditions = [
        eq(projectRevenueDaily.projectId, projectId),
        eq(projectRevenueDaily.sourceProvider, provider),
    ];
    if (currentStartKey) conditions.push(gte(projectRevenueDaily.date, currentStartKey));

    const rows = await dbRead
        .select({
            currency: projectRevenueDaily.currency,
            grossAmountCents: sql<number>`COALESCE(SUM(${projectRevenueDaily.grossAmountCents}), 0)`,
        })
        .from(projectRevenueDaily)
        .where(and(...conditions))
        .groupBy(projectRevenueDaily.currency)
        .orderBy(desc(sql`COALESCE(SUM(${projectRevenueDaily.grossAmountCents}), 0)`));

    return rows.map((row) => ({
        currency: row.currency,
        grossAmountCents: numberFromDb(row.grossAmountCents),
    }));
}

async function getDailyRows(
    projectId: string,
    provider: RevenueProvider | null,
    selectedCurrency: string | null,
    currentStartKey: string | null,
): Promise<RevenueDailyRow[]> {
    if (!provider || !selectedCurrency) return [];
    const conditions = [
        eq(projectRevenueDaily.projectId, projectId),
        eq(projectRevenueDaily.sourceProvider, provider),
        eq(projectRevenueDaily.currency, selectedCurrency),
    ];
    if (currentStartKey) conditions.push(gte(projectRevenueDaily.date, currentStartKey));

    const rows = await dbRead
        .select({
            date: projectRevenueDaily.date,
            currency: projectRevenueDaily.currency,
            grossAmountCents: projectRevenueDaily.grossAmountCents,
            refundAmountCents: projectRevenueDaily.refundAmountCents,
            feeAmountCents: projectRevenueDaily.feeAmountCents,
            netAmountCents: projectRevenueDaily.netAmountCents,
            transactionCount: projectRevenueDaily.transactionCount,
            refundCount: projectRevenueDaily.refundCount,
            subscriberCount: projectRevenueDaily.subscriberCount,
            trialCount: projectRevenueDaily.trialCount,
            subscriptionStartCount: projectRevenueDaily.subscriptionStartCount,
            cancellationCount: projectRevenueDaily.cancellationCount,
            conversionCount: projectRevenueDaily.conversionCount,
            customEventCounts: projectRevenueDaily.customEventCounts,
        })
        .from(projectRevenueDaily)
        .where(and(...conditions))
        .orderBy(projectRevenueDaily.date);

    return rows.map((row) => ({
        date: row.date,
        currency: row.currency,
        grossAmountCents: row.grossAmountCents,
        refundAmountCents: row.refundAmountCents,
        feeAmountCents: row.feeAmountCents,
        netAmountCents: row.netAmountCents,
        transactionCount: row.transactionCount,
        refundCount: row.refundCount,
        subscriberCount: row.subscriberCount,
        trialCount: row.trialCount,
        subscriptionStartCount: row.subscriptionStartCount,
        cancellationCount: row.cancellationCount,
        conversionCount: row.conversionCount,
        customEventCounts: row.customEventCounts || {},
    }));
}

async function getPreviousGrossAmountCents(
    projectId: string,
    provider: RevenueProvider | null,
    selectedCurrency: string | null,
    previousStartKey: string | null,
    previousEndKey: string | null,
): Promise<number | null> {
    if (!provider || !selectedCurrency || !previousStartKey || !previousEndKey) return null;

    const [row] = await dbRead
        .select({
            grossAmountCents: sql<number>`COALESCE(SUM(${projectRevenueDaily.grossAmountCents}), 0)`,
        })
        .from(projectRevenueDaily)
        .where(and(
            eq(projectRevenueDaily.projectId, projectId),
            eq(projectRevenueDaily.sourceProvider, provider),
            eq(projectRevenueDaily.currency, selectedCurrency),
            gte(projectRevenueDaily.date, previousStartKey),
            lt(projectRevenueDaily.date, previousEndKey),
        ));

    return numberFromDb(row?.grossAmountCents);
}

function normalizeCustomEventConfig(raw: unknown): CustomRevenueEventConfig | null {
    const record = asRecord(raw);
    if (!record) return null;
    const revenueEventName = String(record.revenueEventName || '').trim();
    if (!revenueEventName) return null;

    return {
        revenueEventName,
        revenueAmountProperty: String(record.revenueAmountProperty || 'amount').trim() || 'amount',
        revenueCurrencyProperty: String(record.revenueCurrencyProperty || 'currency').trim() || 'currency',
        defaultCurrency: normalizeCurrency(record.defaultCurrency, 'usd'),
        amountUnit: record.amountUnit === 'minor' ? 'minor' : 'major',
        refundEventName: nullableTrim(record.refundEventName),
        subscriberEventName: nullableTrim(record.subscriberEventName),
        trialStartedEventName: nullableTrim(record.trialStartedEventName),
        subscriptionStartedEventName: nullableTrim(record.subscriptionStartedEventName),
        cancellationEventName: nullableTrim(record.cancellationEventName),
        conversionEventName: nullableTrim(record.conversionEventName),
    };
}

function nullableTrim(value: unknown): string | null {
    const text = typeof value === 'string' ? value.trim() : '';
    return text || null;
}

function escapeClickHouseString(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

async function superwallResponseErrorMessage(response: Response, fallback: string): Promise<string> {
    const detail = await response.text()
        .then((text) => text
            .replace(/sk_[a-zA-Z0-9]+/g, 'sk_[REDACTED]')
            .replace(/pk_[a-zA-Z0-9]+/g, 'pk_[REDACTED]')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 240))
        .catch(() => '');
    return detail ? `${fallback}: ${detail}` : fallback;
}

export function buildSuperwallQueryEndpoint(baseUrl: string, organizationId: string): string {
    const trimmedOrganizationId = nullableTrim(organizationId);
    if (!trimmedOrganizationId) {
        throw new Error('Superwall organization ID is required for revenue sync');
    }

    return `${baseUrl.replace(/\/+$/, '')}/v2/organizations/${encodeURIComponent(trimmedOrganizationId)}/query`;
}

export function buildSuperwallProjectsEndpoint(baseUrl: string): string {
    return `${baseUrl.replace(/\/+$/, '')}/v2/projects?limit=1`;
}

function normalizeSuperwallId(value: unknown): string | null {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return nullableTrim(value);
}

export function extractSuperwallOrganizationId(payload: unknown): string | null {
    const seen = new Set<unknown>();
    const visit = (value: unknown): string | null => {
        if (!value || typeof value !== 'object') return null;
        if (seen.has(value)) return null;
        seen.add(value);

        if (Array.isArray(value)) {
            for (const item of value) {
                const found = visit(item);
                if (found) return found;
            }
            return null;
        }

        const record = value as Record<string, unknown>;
        const direct = normalizeSuperwallId(record.organization_id ?? record.organizationId);
        if (direct) return direct;

        for (const child of Object.values(record)) {
            const found = visit(child);
            if (found) return found;
        }
        return null;
    };

    return visit(payload);
}

export function buildSuperwallRevenueQuery(since: Date, applicationId?: string | null): string {
    const appId = nullableTrim(applicationId);
    const appFilter = appId ? `AND toString(applicationId) = '${escapeClickHouseString(appId)}'` : '';
    const eventTimestamp = 'coalesce(transactionCompleteEventDate, purchasedAt, ts)';
    const amountExpression = 'toFloat64(coalesce(priceInPurchasedCurrency, price, proceeds, 0))';

    return `
        SELECT
          toDate(${eventTimestamp}) AS date,
          lower(coalesce(currencyCode, 'usd')) AS currency,
          sum(if(isRefund = 1, -abs(${amountExpression}), abs(${amountExpression}))) AS gross_amount,
          count() AS transaction_count
        FROM open_revenue.attributed_events_by_ts_rep
        WHERE ${eventTimestamp} >= toDateTime('${since.toISOString().replace('T', ' ').slice(0, 19)}')
          ${appFilter}
        GROUP BY date, currency
        ORDER BY date ASC
        FORMAT JSONEachRow
    `;
}

async function discoverSuperwallOrganizationId(apiKey: string): Promise<string> {
    const response = await fetch(buildSuperwallProjectsEndpoint(config.SUPERWALL_API_BASE_URL), {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
        },
    });

    if (response.status === 401) {
        throw new Error('Superwall API key is invalid or revoked');
    }
    if (response.status === 403) {
        throw new Error('Superwall API key needs projects:read and data:read scopes');
    }
    if (!response.ok) {
        throw new Error(await superwallResponseErrorMessage(
            response,
            `Superwall project discovery failed (${response.status})`,
        ));
    }

    const payload = await response.json().catch(() => null);
    const organizationId = extractSuperwallOrganizationId(payload);
    if (!organizationId) {
        throw new Error('Unable to discover Superwall organization ID. Make sure the key has projects:read access to at least one Superwall project.');
    }

    return organizationId;
}

async function validateSuperwallDataReadAccess(apiKey: string, organizationId: string): Promise<void> {
    const response = await fetch(buildSuperwallQueryEndpoint(config.SUPERWALL_API_BASE_URL, organizationId), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'text/plain; charset=utf-8',
            Accept: 'application/json, text/plain',
        },
        body: 'SELECT 1 FORMAT JSONEachRow',
    });

    if (response.status === 401) {
        throw new Error('Superwall API key is invalid or revoked');
    }
    if (response.status === 403) {
        throw new Error('Superwall API key needs projects:read and data:read scopes');
    }
    if (!response.ok) {
        throw new Error(await superwallResponseErrorMessage(
            response,
            `Superwall query access check failed (${response.status})`,
        ));
    }
}

async function revenueCatResponseErrorMessage(response: Response, fallback: string): Promise<string> {
    const detail = await response.text()
        .then((text) => {
            let message = text;
            try {
                const parsed = JSON.parse(text) as { message?: unknown };
                if (typeof parsed.message === 'string') message = parsed.message;
            } catch {
                // Keep the original response text when RevenueCat returns non-JSON errors.
            }
            return message
                .replace(/sk_[a-zA-Z0-9_:-]+/g, 'sk_[REDACTED]')
                .replace(/atk_[a-zA-Z0-9_:-]+/g, 'atk_[REDACTED]')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 240);
        })
        .catch(() => '');
    return detail ? `${fallback}: ${detail}` : fallback;
}

function buildRevenueCatApiUrl(baseUrl: string, path: string): URL {
    return new URL(`${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`);
}

export function buildRevenueCatOverviewEndpoint(
    baseUrl: string,
    revenueCatProjectId: string,
    currency?: string | null,
): string {
    const projectId = nullableTrim(revenueCatProjectId);
    if (!projectId) {
        throw new Error('RevenueCat project ID is required for revenue sync');
    }

    const url = buildRevenueCatApiUrl(
        baseUrl,
        `/projects/${encodeURIComponent(projectId)}/metrics/overview`,
    );
    const currencyCode = nullableTrim(currency);
    if (currencyCode) url.searchParams.set('currency', currencyCode.toUpperCase());
    return url.toString();
}

export function buildRevenueCatRevenueChartEndpoint(input: {
    baseUrl: string;
    revenueCatProjectId: string;
    startDate: string;
    endDate: string;
    currency?: string | null;
}): string {
    const projectId = nullableTrim(input.revenueCatProjectId);
    if (!projectId) {
        throw new Error('RevenueCat project ID is required for revenue sync');
    }

    const url = buildRevenueCatApiUrl(
        input.baseUrl,
        `/projects/${encodeURIComponent(projectId)}/charts/revenue`,
    );
    url.searchParams.set('realtime', 'true');
    url.searchParams.set('resolution', '0');
    url.searchParams.set('start_date', input.startDate);
    url.searchParams.set('end_date', input.endDate);
    const currencyCode = nullableTrim(input.currency);
    if (currencyCode) url.searchParams.set('currency', currencyCode.toUpperCase());
    return url.toString();
}

function parseRevenueCatDateKey(value: unknown): string | null {
    if (typeof value === 'string') {
        const text = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
        const numeric = Number(text);
        if (Number.isFinite(numeric)) return parseRevenueCatDateKey(numeric);
        const parsed = new Date(text);
        return Number.isNaN(parsed.getTime()) ? null : toUtcDateKey(parsed);
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        const millis = value > 10_000_000_000 ? value : value * 1000;
        const parsed = new Date(millis);
        return Number.isNaN(parsed.getTime()) ? null : toUtcDateKey(parsed);
    }

    return null;
}

function addDaysToDateKey(dateKey: string, days: number): string {
    const date = new Date(`${dateKey}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return toUtcDateKey(date);
}

function measureName(value: unknown): string {
    const record = asRecord(value);
    const raw = record
        ? record.id ?? record.name ?? record.display_name ?? record.key ?? record.label
        : value;
    return typeof raw === 'string' ? raw.toLowerCase() : '';
}

function findRevenueCatMeasureValue(
    values: unknown[],
    measures: string[],
    patterns: RegExp[],
    fallbackIndex: number,
): unknown {
    const measureIndex = measures.findIndex((name) => patterns.some((pattern) => pattern.test(name)));
    if (measureIndex >= 0) {
        const valueIndex = measures.length === values.length - 1 ? measureIndex + 1 : measureIndex;
        return values[valueIndex];
    }
    return values[fallbackIndex];
}

function findRevenueCatMeasureIndex(
    measures: string[],
    patterns: RegExp[],
    fallbackIndex: number,
): number {
    const measureIndex = measures.findIndex((name) => patterns.some((pattern) => pattern.test(name)));
    return measureIndex >= 0 ? measureIndex : fallbackIndex;
}

function revenueCatMeasureIndex(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
    return null;
}

function firstRecordValue(record: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
        if (record[key] !== undefined && record[key] !== null) return record[key];
    }
    return undefined;
}

export function parseRevenueCatRevenueChartRows(payload: unknown): GenericRevenueTransaction[] {
    const record = asRecord(payload) ?? {};
    const chartCurrency = normalizeCurrency(
        record.yaxis_currency ?? record.currency ?? record.currency_code,
        'usd',
    );
    const values = Array.isArray(record.values) ? record.values : [];
    const measures = Array.isArray(record.measures) ? record.measures.map(measureName) : [];
    const revenueMeasureIndex = findRevenueCatMeasureIndex(
        measures,
        [/gross/, /revenue/, /proceeds/, /value/, /amount/],
        0,
    );
    const transactionMeasureIndex = findRevenueCatMeasureIndex(
        measures,
        [/transaction/, /purchase/, /count/],
        1,
    );
    const measureRowsByDate = new Map<string, {
        dateKey: string;
        amountValue?: unknown;
        transactionCountValue?: unknown;
        currency: string;
    }>();

    const rows = values.flatMap((point) => {
        const pointRecord = !Array.isArray(point) ? asRecord(point) : null;
        const measureIndex = pointRecord ? revenueCatMeasureIndex(pointRecord.measure) : null;
        const measureDateKey = pointRecord
            ? parseRevenueCatDateKey(firstRecordValue(pointRecord, [
                'date',
                'start_date',
                'end_date',
                'timestamp',
                'time',
                'cohort',
                'x',
            ]))
            : null;
        if (
            pointRecord
            && measureIndex !== null
            && measureDateKey
            && pointRecord.value !== undefined
            && (measureIndex === revenueMeasureIndex || measureIndex === transactionMeasureIndex)
        ) {
            const currency = normalizeCurrency(pointRecord.currency ?? pointRecord.currency_code, chartCurrency);
            const aggregate = measureRowsByDate.get(`${measureDateKey}:${currency}`) ?? {
                dateKey: measureDateKey,
                currency,
            };
            if (measureIndex === revenueMeasureIndex) {
                aggregate.amountValue = pointRecord.value;
            } else {
                aggregate.transactionCountValue = pointRecord.value;
            }
            measureRowsByDate.set(`${measureDateKey}:${currency}`, aggregate);
            return [];
        }

        let dateKey: string | null = null;
        let amountCents: number | null = null;
        let transactionCount = 0;
        let currency = chartCurrency;

        if (Array.isArray(point)) {
            dateKey = parseRevenueCatDateKey(point[0]);
            const amountValue = findRevenueCatMeasureValue(
                point,
                measures,
                [/gross/, /revenue/, /proceeds/, /value/, /amount/],
                1,
            );
            amountCents = minorFromMajorAmount(amountValue);
            transactionCount = positiveInt(findRevenueCatMeasureValue(
                point,
                measures,
                [/transaction/, /purchase/, /count/],
                2,
            ));
        } else {
            const pointRecord = asRecord(point);
            if (!pointRecord) return [];
            dateKey = parseRevenueCatDateKey(firstRecordValue(pointRecord, [
                'date',
                'start_date',
                'end_date',
                'timestamp',
                'time',
                'cohort',
                'x',
            ]));
            amountCents = minorFromMajorAmount(firstRecordValue(pointRecord, [
                'gross_revenue',
                'revenue',
                'proceeds',
                'amount',
                'value',
                'y',
            ]));
            transactionCount = positiveInt(firstRecordValue(pointRecord, [
                'transaction_count',
                'transactions',
                'purchase_count',
                'purchases',
                'count',
            ]));
            currency = normalizeCurrency(pointRecord.currency ?? pointRecord.currency_code, chartCurrency);
        }

        if (!dateKey || amountCents === null || amountCents === 0) return [];
        const effectiveTransactionCount = transactionCount || 1;
        const occurredAt = new Date(`${dateKey}T00:00:00Z`);
        const reportingCategory = amountCents < 0 ? 'refund' : 'revenue';
        return [{
            externalTransactionId: `revenuecat:${dateKey}:${currency}`,
            occurredAt,
            amountCents,
            feeCents: 0,
            netCents: amountCents,
            grossAmountCents: amountCents > 0 ? amountCents : 0,
            refundAmountCents: amountCents < 0 ? Math.abs(amountCents) : 0,
            currency,
            type: reportingCategory,
            reportingCategory,
            metadata: {
                source: 'revenuecat_revenue_chart',
                chart: 'revenue',
                transactionCount: effectiveTransactionCount,
            },
        } satisfies GenericRevenueTransaction];
    });

    for (const aggregate of measureRowsByDate.values()) {
        const amountCents = minorFromMajorAmount(aggregate.amountValue);
        if (amountCents === null || amountCents === 0) continue;
        const effectiveTransactionCount = positiveInt(aggregate.transactionCountValue) || 1;
        const occurredAt = new Date(`${aggregate.dateKey}T00:00:00Z`);
        const reportingCategory = amountCents < 0 ? 'refund' : 'revenue';
        rows.push({
            externalTransactionId: `revenuecat:${aggregate.dateKey}:${aggregate.currency}`,
            occurredAt,
            amountCents,
            feeCents: 0,
            netCents: amountCents,
            grossAmountCents: amountCents > 0 ? amountCents : 0,
            refundAmountCents: amountCents < 0 ? Math.abs(amountCents) : 0,
            currency: aggregate.currency,
            type: reportingCategory,
            reportingCategory,
            metadata: {
                source: 'revenuecat_revenue_chart',
                chart: 'revenue',
                transactionCount: effectiveTransactionCount,
            },
        });
    }

    return rows;
}

async function assertRevenueCatApiResponseOk(response: Response, fallback: string): Promise<void> {
    if (response.status === 401) {
        throw new Error('RevenueCat API key is invalid or revoked');
    }
    if (response.status === 403) {
        const detail = await revenueCatResponseErrorMessage(response, 'RevenueCat API access denied');
        if (/does not belong to the project/i.test(detail)) {
            throw new Error(detail);
        }
        throw new Error(`${detail}. Ensure the key has charts_metrics:overview:read and charts_metrics:charts:read permissions`);
    }
    if (response.status === 404) {
        throw new Error('RevenueCat project not found for this API key');
    }
    if (!response.ok) {
        throw new Error(await revenueCatResponseErrorMessage(
            response,
            fallback,
        ));
    }
}

async function validateRevenueCatApiAccess(apiKey: string, revenueCatProjectId: string): Promise<void> {
    const headers = {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
    };
    const overviewResponse = await fetch(buildRevenueCatOverviewEndpoint(
        config.REVENUECAT_API_BASE_URL,
        revenueCatProjectId,
    ), {
        method: 'GET',
        headers,
    });
    await assertRevenueCatApiResponseOk(
        overviewResponse,
        `RevenueCat overview access check failed (${overviewResponse.status})`,
    );

    const today = toUtcDateKey(new Date());
    const chartResponse = await fetch(buildRevenueCatRevenueChartEndpoint({
        baseUrl: config.REVENUECAT_API_BASE_URL,
        revenueCatProjectId,
        startDate: today,
        endDate: today,
    }), {
        method: 'GET',
        headers,
    });
    await assertRevenueCatApiResponseOk(
        chartResponse,
        `RevenueCat revenue chart access check failed (${chartResponse.status})`,
    );
}

function normalizeRevenueDateKey(value: unknown): string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error('Revenue date must be YYYY-MM-DD');
    }
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || toUtcDateKey(parsed) !== value) {
        throw new Error('Revenue date is invalid');
    }
    return value;
}

function manualOccurredAt(dateKey: string): Date {
    return new Date(`${dateKey}T12:00:00Z`);
}

function normalizeManualAmountCents(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
        throw new Error('Manual revenue amount must be an integer number of cents');
    }
    if (Math.abs(numeric) > 2_000_000_000) {
        throw new Error('Manual revenue amount is too large');
    }
    return numeric;
}

function manualRevenueMetadata(input: {
    existing?: Record<string, unknown> | null;
    note?: string | null;
    transactionCount: number;
    userId: string;
}): Record<string, unknown> {
    return {
        ...(input.existing ?? {}),
        source: MANUAL_REVENUE_SOURCE,
        eventName: 'manual_historical_revenue',
        note: nullableTrim(input.note),
        transactionCount: Math.max(1, input.transactionCount),
        updatedByUserId: input.userId,
        createdByUserId: input.existing?.createdByUserId ?? input.userId,
    };
}

async function getManualRevenueEntries(
    projectId: string,
    selectedCurrency: string | null,
    currentStartKey: string | null,
): Promise<RevenueManualEntry[]> {
    const conditions = [
        eq(revenueProviderTransactions.projectId, projectId),
        eq(revenueProviderTransactions.provider, 'custom_events'),
        sql`${revenueProviderTransactions.metadata}->>'source' = ${MANUAL_REVENUE_SOURCE}`,
    ];
    if (selectedCurrency) conditions.push(eq(revenueProviderTransactions.currency, selectedCurrency));
    if (currentStartKey) conditions.push(gte(revenueProviderTransactions.occurredAt, new Date(`${currentStartKey}T00:00:00Z`)));

    const rows = await dbRead
        .select({
            id: revenueProviderTransactions.id,
            occurredAt: revenueProviderTransactions.occurredAt,
            currency: revenueProviderTransactions.currency,
            netCents: revenueProviderTransactions.netCents,
            metadata: revenueProviderTransactions.metadata,
            importedAt: revenueProviderTransactions.importedAt,
            updatedAt: revenueProviderTransactions.updatedAt,
        })
        .from(revenueProviderTransactions)
        .where(and(...conditions))
        .orderBy(desc(revenueProviderTransactions.occurredAt), desc(revenueProviderTransactions.updatedAt))
        .limit(100);

    return rows.map((row) => {
        const metadata = asRecord(row.metadata) ?? {};
        return {
            id: row.id,
            date: toUtcDateKey(row.occurredAt),
            currency: row.currency,
            amountCents: row.netCents,
            transactionCount: positiveInt(metadata.transactionCount) || 1,
            note: nullableTrim(metadata.note),
            createdAt: row.importedAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        };
    });
}

async function getCustomEventSyncPreview(
    projectId: string,
    config: CustomRevenueEventConfig | null,
): Promise<RevenueSyncPreview | null> {
    const normalizedConfig = normalizeCustomEventConfig(config);
    if (!normalizedConfig) return null;

    const eventNames = [
        normalizedConfig.revenueEventName,
        normalizedConfig.refundEventName,
        normalizedConfig.subscriberEventName,
        normalizedConfig.trialStartedEventName,
        normalizedConfig.subscriptionStartedEventName,
        normalizedConfig.cancellationEventName,
        normalizedConfig.conversionEventName,
    ]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase());
    if (eventNames.length === 0) return null;

    const eventNameArraySql = sql`ARRAY[${sql.join(eventNames.map((eventName) => sql`${eventName}`), sql`, `)}]::text[]`;
    const amountMultiplier = normalizedConfig.amountUnit === 'minor' ? 1 : 100;
    const previewQuery = await dbRead.execute(sql`
        WITH project_sessions AS (
          SELECT id, events
          FROM ${sessions}
          WHERE ${sessions.projectId} = ${projectId}
        ),
        event_rows AS (
          SELECT
            s.id AS session_id,
            lower(COALESCE(NULLIF(event->>'name', ''), NULLIF(event->>'type', ''))) AS event_name,
            event,
            CASE
              WHEN jsonb_typeof(event->'properties') = 'object' THEN event->'properties'
              WHEN jsonb_typeof(event->'properties') = 'string' THEN (event->>'properties')::jsonb
              WHEN jsonb_typeof(event->'payload') = 'object' THEN event->'payload'
              WHEN jsonb_typeof(event->'payload') = 'string' THEN (event->>'payload')::jsonb
              ELSE '{}'::jsonb
            END AS props
          FROM project_sessions s
          CROSS JOIN LATERAL jsonb_array_elements(s.events) AS events(event)
        ),
        matched AS (
          SELECT
            session_id,
            event_name,
            event,
            props,
            CASE
              WHEN COALESCE(NULLIF(props->>${normalizedConfig.revenueAmountProperty}, ''), NULLIF(event->>${normalizedConfig.revenueAmountProperty}, ''), '0') ~ '^-?[0-9]+(\\.[0-9]+)?$'
              THEN (COALESCE(NULLIF(props->>${normalizedConfig.revenueAmountProperty}, ''), NULLIF(event->>${normalizedConfig.revenueAmountProperty}, ''), '0')::numeric * ${amountMultiplier})::int
              ELSE 0
            END AS amount_cents
          FROM event_rows
          WHERE event_name = ANY(${eventNameArraySql})
        )
        SELECT
          (SELECT COUNT(*)::int FROM project_sessions) AS scanned_session_count,
          COUNT(DISTINCT session_id)::int AS matched_session_count,
          COUNT(*)::int AS matched_event_count,
          COUNT(*) FILTER (
            WHERE event_name = ${normalizedConfig.revenueEventName.toLowerCase()}
              AND amount_cents > 0
          )::int AS revenue_event_count
        FROM matched
    `);
    const rows = Array.isArray(previewQuery)
        ? previewQuery as Array<{
            scanned_session_count: string | number;
            matched_session_count: string | number;
            matched_event_count: string | number;
            revenue_event_count: string | number;
        }>
        : (((previewQuery as unknown) as { rows?: Array<{
            scanned_session_count: string | number;
            matched_session_count: string | number;
            matched_event_count: string | number;
            revenue_event_count: string | number;
        }> }).rows ?? []);
    const row = rows[0];

    return {
        provider: 'custom_events',
        scannedSessionCount: numberFromDb(row?.scanned_session_count),
        matchedSessionCount: numberFromDb(row?.matched_session_count),
        matchedEventCount: numberFromDb(row?.matched_event_count),
        revenueEventCount: numberFromDb(row?.revenue_event_count),
    };
}

export async function getRevenueOverview(
    projectId: string,
    options: { timeRange?: string; currency?: string | null; canManage: boolean },
): Promise<RevenueOverview> {
    const providers = await getProviderStatuses(projectId);
    const activeProvider = await getActiveProvider(projectId);
    const activeStatus = activeProvider
        ? providers.find((provider) => provider.provider === activeProvider) ?? defaultProviderStatus(activeProvider)
        : defaultProviderStatus('custom_events');

    const bounds = buildRevenueDateBounds(options.timeRange);
    const currencies = await getCurrencySummaries(projectId, activeProvider, bounds.currentStartKey);
    const requestedCurrency = options.currency?.trim().toLowerCase() || null;
    const selectedCurrency = requestedCurrency && currencies.some((row) => row.currency === requestedCurrency)
        ? requestedCurrency
        : (currencies[0]?.currency ?? null);
    const daily = await getDailyRows(projectId, activeProvider, selectedCurrency, bounds.currentStartKey);
    const previousGrossAmountCents = await getPreviousGrossAmountCents(
        projectId,
        activeProvider,
        selectedCurrency,
        bounds.previousStartKey,
        bounds.previousEndKey,
    );

    const summary = daily.reduce(
        (acc, row) => {
            acc.grossAmountCents += row.grossAmountCents;
            acc.refundAmountCents += row.refundAmountCents;
            acc.feeAmountCents += row.feeAmountCents;
            acc.netAmountCents += row.netAmountCents;
            acc.transactionCount += row.transactionCount;
            acc.refundCount += row.refundCount;
            acc.subscriberCount += row.subscriberCount;
            acc.trialCount += row.trialCount;
            acc.subscriptionStartCount += row.subscriptionStartCount;
            acc.cancellationCount += row.cancellationCount;
            acc.conversionCount += row.conversionCount;
            return acc;
        },
        {
            grossAmountCents: 0,
            refundAmountCents: 0,
            feeAmountCents: 0,
            netAmountCents: 0,
            transactionCount: 0,
            refundCount: 0,
            subscriberCount: 0,
            trialCount: 0,
            subscriptionStartCount: 0,
            cancellationCount: 0,
            conversionCount: 0,
        },
    );

    const customConnection = await getProviderConnection(projectId, 'custom_events');
    const customEventConfig = normalizeCustomEventConfig(customConnection?.customEventConfig);
    const syncPreview = activeProvider === 'custom_events'
        ? await getCustomEventSyncPreview(projectId, customEventConfig)
        : null;
    const manualEntries = await getManualRevenueEntries(projectId, selectedCurrency, bounds.currentStartKey);
    const grossChangePercent = previousGrossAmountCents && previousGrossAmountCents > 0
        ? ((summary.grossAmountCents - previousGrossAmountCents) / previousGrossAmountCents) * 100
        : null;

    return {
        configured: activeProvider ? activeStatus.configured : providers.some((provider) => provider.configured),
        activeProvider,
        providers,
        connection: {
            ...activeStatus,
            canManage: options.canManage,
        },
        customEventConfig,
        syncPreview,
        manualEntries,
        currencies,
        selectedCurrency,
        summary: {
            ...summary,
            previousGrossAmountCents,
            grossChangePercent,
        },
        daily,
    };
}

async function getProviderConnection(projectId: string, provider: RevenueProvider) {
    const [connection] = await db
        .select()
        .from(projectRevenueConnections)
        .where(and(
            eq(projectRevenueConnections.projectId, projectId),
            eq(projectRevenueConnections.provider, provider),
        ))
        .limit(1);

    return connection ?? null;
}

async function ensureManualRevenueConnection(projectId: string, userId: string) {
    const project = await getProjectForRevenue(projectId);
    if (!project) throw new Error('Project not found');

    const existing = await getProviderConnection(projectId, 'custom_events');
    if (existing) {
        if (existing.status === 'disconnected') {
            await db
                .update(projectRevenueConnections)
                .set({
                    status: 'connected',
                    externalAccountName: existing.externalAccountName || 'Custom events and historical revenue',
                    lastSyncError: null,
                    updatedAt: new Date(),
                })
                .where(eq(projectRevenueConnections.id, existing.id));
            return {
                ...existing,
                status: 'connected',
                externalAccountName: existing.externalAccountName || 'Custom events and historical revenue',
            };
        }
        return existing;
    }

    const [connection] = await db
        .insert(projectRevenueConnections)
        .values({
            projectId: project.id,
            teamId: project.teamId,
            connectedByUserId: userId,
            provider: 'custom_events',
            externalAccountId: 'manual_historical_revenue',
            externalAccountName: 'Custom events and historical revenue',
            status: 'connected',
            customEventConfig: {},
            connectionConfig: { hasManualHistoricalRevenue: true },
            updatedAt: new Date(),
        })
        .returning();

    return connection;
}

async function writeManualRevenueEntryToClickHouse(params: {
    projectId: string;
    entryId: string;
    externalTransactionId: string;
    occurredAt: Date;
    amountCents: number;
    currency: string;
    metadata: Record<string, unknown>;
    isDeleted?: boolean;
    operationId: string;
}): Promise<void> {
    await writeRevenueEventsToClickHouse({
        dedupeKey: `${params.projectId}:custom_events:manual:${params.externalTransactionId}:${params.operationId}`,
        rows: [buildClickHouseRevenueEventRow({
            projectId: params.projectId,
            provider: 'custom_events',
            occurredAt: params.occurredAt,
            externalTransactionId: params.externalTransactionId,
            externalSourceId: params.entryId,
            amountCents: params.amountCents,
            grossAmountCents: params.amountCents > 0 ? params.amountCents : 0,
            refundAmountCents: params.amountCents < 0 ? Math.abs(params.amountCents) : 0,
            feeCents: 0,
            netCents: params.amountCents,
            currency: params.currency,
            type: 'manual_adjustment',
            reportingCategory: params.isDeleted ? 'deleted' : (params.amountCents < 0 ? 'refund' : 'revenue'),
            metadata: params.metadata,
            isDeleted: params.isDeleted,
        })],
    });
}

export async function upsertManualRevenueEntry(input: {
    projectId: string;
    userId: string;
    entryId?: string | null;
    date: string;
    amountCents: number;
    currency: string;
    transactionCount?: number | null;
    note?: string | null;
}): Promise<RevenueManualEntry> {
    const dateKey = normalizeRevenueDateKey(input.date);
    const occurredAt = manualOccurredAt(dateKey);
    const amountCents = normalizeManualAmountCents(input.amountCents);
    const currency = normalizeCurrency(input.currency, 'usd');
    const transactionCount = Math.max(1, positiveInt(input.transactionCount ?? 1));
    const connection = await ensureManualRevenueConnection(input.projectId, input.userId);
    const now = new Date();
    let oldDateKey: string | null = null;
    let externalTransactionId = `manual:${randomUUID()}`;
    let existingMetadata: Record<string, unknown> | null = null;
    let targetEntryId = input.entryId ?? null;
    let staleManualRows: Array<{
        id: string;
        occurredAt: Date;
        externalTransactionId: string;
        currency: string;
        metadata: Record<string, unknown>;
    }> = [];

    if (targetEntryId) {
        const [existing] = await db
            .select()
            .from(revenueProviderTransactions)
            .where(and(
                eq(revenueProviderTransactions.id, targetEntryId),
                eq(revenueProviderTransactions.projectId, input.projectId),
                eq(revenueProviderTransactions.provider, 'custom_events'),
                sql`${revenueProviderTransactions.metadata}->>'source' = ${MANUAL_REVENUE_SOURCE}`,
            ))
            .limit(1);
        if (!existing) throw new Error('Starting revenue baseline not found');
        oldDateKey = toUtcDateKey(existing.occurredAt);
        externalTransactionId = existing.externalTransactionId;
        existingMetadata = asRecord(existing.metadata) ?? {};
    } else {
        const existingRows = await db
            .select({
                id: revenueProviderTransactions.id,
                occurredAt: revenueProviderTransactions.occurredAt,
                externalTransactionId: revenueProviderTransactions.externalTransactionId,
                currency: revenueProviderTransactions.currency,
                metadata: revenueProviderTransactions.metadata,
                updatedAt: revenueProviderTransactions.updatedAt,
            })
            .from(revenueProviderTransactions)
            .where(and(
                eq(revenueProviderTransactions.projectId, input.projectId),
                eq(revenueProviderTransactions.provider, 'custom_events'),
                sql`${revenueProviderTransactions.metadata}->>'source' = ${MANUAL_REVENUE_SOURCE}`,
            ))
            .orderBy(desc(revenueProviderTransactions.updatedAt), desc(revenueProviderTransactions.occurredAt))
            .limit(100);
        const existing = existingRows[0] ?? null;
        if (existing) {
            targetEntryId = existing.id;
            oldDateKey = toUtcDateKey(existing.occurredAt);
            externalTransactionId = existing.externalTransactionId;
            existingMetadata = asRecord(existing.metadata) ?? {};
            staleManualRows = existingRows.slice(1).map((row) => ({
                id: row.id,
                occurredAt: row.occurredAt,
                externalTransactionId: row.externalTransactionId,
                currency: row.currency,
                metadata: asRecord(row.metadata) ?? {},
            }));
        }
    }

    const metadata = manualRevenueMetadata({
        existing: existingMetadata,
        note: input.note,
        transactionCount,
        userId: input.userId,
    });
    const values = {
        connectionId: connection.id,
        projectId: input.projectId,
        provider: 'custom_events' as const,
        externalTransactionId,
        externalSourceId: 'manual',
        occurredAt,
        amountCents,
        feeCents: 0,
        netCents: amountCents,
        grossAmountCents: amountCents > 0 ? amountCents : 0,
        refundAmountCents: amountCents < 0 ? Math.abs(amountCents) : 0,
        currency,
        type: 'manual_adjustment',
        reportingCategory: amountCents < 0 ? 'refund' : 'revenue',
        metadata,
        updatedAt: now,
    };

    const [row] = targetEntryId
        ? await db
            .update(revenueProviderTransactions)
            .set(values)
            .where(and(
                eq(revenueProviderTransactions.id, targetEntryId),
                eq(revenueProviderTransactions.projectId, input.projectId),
            ))
            .returning()
        : await db
            .insert(revenueProviderTransactions)
            .values(values)
            .returning();

    const rebuildDateKeys = [dateKey, oldDateKey ?? dateKey];
    if (staleManualRows.length > 0) {
        const staleIds = staleManualRows.map((staleRow) => staleRow.id);
        await db
            .delete(revenueProviderTransactions)
            .where(inArray(revenueProviderTransactions.id, staleIds));
        rebuildDateKeys.push(...staleManualRows.map((staleRow) => toUtcDateKey(staleRow.occurredAt)));
        await Promise.all(staleManualRows.map((staleRow) => writeManualRevenueEntryToClickHouse({
            projectId: input.projectId,
            entryId: staleRow.id,
            externalTransactionId: staleRow.externalTransactionId,
            occurredAt: staleRow.occurredAt,
            amountCents: 0,
            currency: staleRow.currency,
            metadata: {
                ...staleRow.metadata,
                source: MANUAL_REVENUE_SOURCE,
                eventName: 'manual_historical_revenue',
                deleted: true,
                deletedAt: now.toISOString(),
                replacedByEntryId: row.id,
            },
            isDeleted: true,
            operationId: `${now.toISOString()}:${staleRow.id}`,
        })));
    }

    await setProjectRevenueActiveProvider(input.projectId, 'custom_events', input.userId);
    await rebuildGenericProviderDailyRollups(input.projectId, 'custom_events', rebuildDateKeys);
    await writeManualRevenueEntryToClickHouse({
        projectId: input.projectId,
        entryId: row.id,
        externalTransactionId,
        occurredAt,
        amountCents,
        currency,
        metadata,
        operationId: now.toISOString(),
    });

    return {
        id: row.id,
        date: dateKey,
        currency,
        amountCents,
        transactionCount,
        note: nullableTrim(input.note),
        createdAt: row.importedAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

export async function deleteManualRevenueEntry(projectId: string, entryId: string): Promise<boolean> {
    const [existing] = await db
        .select({
            id: revenueProviderTransactions.id,
            occurredAt: revenueProviderTransactions.occurredAt,
            externalTransactionId: revenueProviderTransactions.externalTransactionId,
            currency: revenueProviderTransactions.currency,
            metadata: revenueProviderTransactions.metadata,
        })
        .from(revenueProviderTransactions)
        .where(and(
            eq(revenueProviderTransactions.id, entryId),
            eq(revenueProviderTransactions.projectId, projectId),
            eq(revenueProviderTransactions.provider, 'custom_events'),
            sql`${revenueProviderTransactions.metadata}->>'source' = ${MANUAL_REVENUE_SOURCE}`,
        ))
        .limit(1);

    if (!existing) return false;
    const dateKey = toUtcDateKey(existing.occurredAt);
    const deletedAt = new Date();
    await db
        .delete(revenueProviderTransactions)
        .where(eq(revenueProviderTransactions.id, entryId));
    await rebuildGenericProviderDailyRollups(projectId, 'custom_events', [dateKey]);
    await writeManualRevenueEntryToClickHouse({
        projectId,
        entryId: existing.id,
        externalTransactionId: existing.externalTransactionId,
        occurredAt: existing.occurredAt,
        amountCents: 0,
        currency: existing.currency,
        metadata: {
            ...(asRecord(existing.metadata) ?? {}),
            source: MANUAL_REVENUE_SOURCE,
            eventName: 'manual_historical_revenue',
            deleted: true,
            deletedAt: deletedAt.toISOString(),
        },
        isDeleted: true,
        operationId: deletedAt.toISOString(),
    });
    return true;
}

export async function connectSuperwallRevenue(input: {
    projectId: string;
    userId: string;
    apiKey: string;
}): Promise<{ connectionId: string }> {
    if (!isSuperwallRevenueSourceConfigured()) {
        throw new Error('SUPERWALL_API_KEY_ENCRYPTION_KEY is required for Superwall API key storage');
    }

    const project = await getProjectForRevenue(input.projectId);
    if (!project) throw new Error('Project not found');
    const apiKey = input.apiKey.trim();
    if (apiKey.length < 12) throw new Error('A scoped Superwall API key is required');
    const organizationId = await discoverSuperwallOrganizationId(apiKey);
    await validateSuperwallDataReadAccess(apiKey, organizationId);
    const encryptedApiKey = encrypt(apiKey, 'superwallApiKey');
    const now = new Date();
    const [connection] = await db
        .insert(projectRevenueConnections)
        .values({
            projectId: project.id,
            teamId: project.teamId,
            connectedByUserId: input.userId,
            provider: 'superwall',
            externalAccountId: organizationId,
            externalAccountName: 'Superwall',
            status: 'connected',
            apiKeyEncrypted: encryptedApiKey,
            apiKeyLast4: apiKey.slice(-4),
            connectionConfig: {
                organizationId,
                applicationId: null,
            },
            lastSyncStartedAt: now,
            lastSyncError: null,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: [projectRevenueConnections.projectId, projectRevenueConnections.provider],
            set: {
                teamId: project.teamId,
                connectedByUserId: input.userId,
                externalAccountId: organizationId,
                externalAccountName: 'Superwall',
                status: 'connected',
                apiKeyEncrypted: encryptedApiKey,
                apiKeyLast4: apiKey.slice(-4),
                connectionConfig: {
                    organizationId,
                    applicationId: null,
                },
                lastSyncStartedAt: now,
                lastSyncError: null,
                updatedAt: now,
            },
        })
        .returning({ id: projectRevenueConnections.id });

    await setProjectRevenueActiveProvider(input.projectId, 'superwall', input.userId);
    void enqueueGenericRevenueSync(input.projectId, 'superwall', 'initial').catch((err) => {
        logger.error({ err, projectId: input.projectId }, 'Unable to enqueue initial Superwall revenue sync');
    });

    return { connectionId: connection.id };
}

async function syncSuperwallRevenue(projectId: string, mode: RevenueSyncMode): Promise<GenericRevenueProviderSyncResult> {
    if (!isSuperwallRevenueSourceConfigured()) {
        throw new Error('SUPERWALL_API_KEY_ENCRYPTION_KEY is required for Superwall API key storage');
    }

    const connection = await getProviderConnection(projectId, 'superwall');
    if (!connection || connection.status === 'disconnected') {
        throw new Error('Superwall revenue is not connected for this project');
    }
    const apiKey = connection.apiKeyEncrypted ? safeDecrypt(connection.apiKeyEncrypted, 'superwallApiKey') : null;
    if (!apiKey || apiKey === 'disconnected') {
        throw new Error('Superwall API key is unavailable');
    }

    const connectionConfig = asRecord(connection.connectionConfig) || {};
    const hasProviderTransactions = await providerHasRevenueTransactions(projectId, 'superwall');
    const syncWindow = resolveGenericRevenueSyncWindow({
        mode,
        newestSyncedAt: connection.newestSyncedAt,
        hasProviderTransactions,
    });
    const since = syncWindow.startDate;
    let organizationId = nullableTrim(connectionConfig.organizationId);
    if (!organizationId) {
        organizationId = await discoverSuperwallOrganizationId(apiKey);
        await validateSuperwallDataReadAccess(apiKey, organizationId);
        await db
            .update(projectRevenueConnections)
            .set({
                externalAccountId: organizationId,
                connectionConfig: {
                    ...connectionConfig,
                    organizationId,
                    applicationId: nullableTrim(connectionConfig.applicationId),
                },
                lastSyncError: null,
                updatedAt: new Date(),
            })
            .where(eq(projectRevenueConnections.id, connection.id));
    }
    const queryEndpoint = buildSuperwallQueryEndpoint(config.SUPERWALL_API_BASE_URL, organizationId);
    const applicationId = nullableTrim(connectionConfig.applicationId);
    const query = buildSuperwallRevenueQuery(since, applicationId);

    const response = await fetch(queryEndpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'text/plain; charset=utf-8',
            Accept: 'application/json, text/plain',
        },
        body: query,
    });
    if (!response.ok) {
        throw new Error(await superwallResponseErrorMessage(
            response,
            `Superwall revenue query failed (${response.status})`,
        ));
    }

    const body = await response.text();
    const transactions: GenericRevenueTransaction[] = body
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .flatMap((line) => {
            try {
                const row = JSON.parse(line) as Record<string, unknown>;
                const occurredAt = parseIsoDate(row.date);
                const amount = minorFromMajorAmount(row.gross_amount);
                if (!occurredAt || amount === null || amount === 0) return [];
                const currency = normalizeCurrency(row.currency, 'usd');
                const reportingCategory = amount < 0 ? 'refund' : 'revenue';
                return [{
                    externalTransactionId: `superwall:${toUtcDateKey(occurredAt)}:${currency}`,
                    occurredAt,
                    amountCents: amount,
                    feeCents: 0,
                    netCents: amount,
                    grossAmountCents: amount > 0 ? amount : 0,
                    refundAmountCents: amount < 0 ? Math.abs(amount) : 0,
                    currency,
                    type: reportingCategory,
                    reportingCategory,
                    metadata: { transactionCount: positiveInt(row.transaction_count) },
                } satisfies GenericRevenueTransaction];
            } catch {
                return [];
            }
        });

    const rebuildDateKeys = transactions.map((row) => toUtcDateKey(row.occurredAt));
    if (syncWindow.fullBackfill) {
        const existingRows = await dbRead
            .select({
                id: revenueProviderTransactions.id,
                externalTransactionId: revenueProviderTransactions.externalTransactionId,
                date: sql<string>`${revenueProviderTransactions.occurredAt}::date::text`,
            })
            .from(revenueProviderTransactions)
            .where(and(
                eq(revenueProviderTransactions.projectId, projectId),
                eq(revenueProviderTransactions.provider, 'superwall'),
            ));
        const nextTransactionIds = new Set(transactions.map((row) => row.externalTransactionId));
        const staleIds = existingRows
            .filter((row) => !nextTransactionIds.has(row.externalTransactionId))
            .map((row) => row.id);
        for (let index = 0; index < staleIds.length; index += GENERIC_REVENUE_UPSERT_BATCH_SIZE) {
            const batch = staleIds.slice(index, index + GENERIC_REVENUE_UPSERT_BATCH_SIZE);
            await db
                .delete(revenueProviderTransactions)
                .where(inArray(revenueProviderTransactions.id, batch));
        }
        rebuildDateKeys.push(...existingRows.map((row) => row.date).filter(Boolean));
    }

    await upsertGenericRevenueTransactions(connection, 'superwall', transactions);
    const importedDateCount = await rebuildGenericProviderDailyRollups(projectId, 'superwall', rebuildDateKeys);
    return {
        importedDateCount,
        transactionCount: transactions.length,
        fullBackfill: syncWindow.fullBackfill,
    };
}

export async function connectRevenueCatRevenue(input: {
    projectId: string;
    userId: string;
    apiKey: string;
    revenueCatProjectId: string;
}): Promise<{ connectionId: string }> {
    if (!isRevenueCatRevenueSourceConfigured()) {
        throw new Error('REVENUECAT_API_KEY_ENCRYPTION_KEY is required for RevenueCat API key storage');
    }

    const project = await getProjectForRevenue(input.projectId);
    if (!project) throw new Error('Project not found');
    const apiKey = input.apiKey.trim();
    const revenueCatProjectId = input.revenueCatProjectId.trim();
    if (!/^sk_[a-zA-Z0-9_:-]{8,}$/.test(apiKey)) {
        throw new Error('A RevenueCat v2 secret API key is required');
    }
    if (!/^proj[a-zA-Z0-9_:-]{4,}$/.test(revenueCatProjectId)) {
        throw new Error('RevenueCat project ID must start with proj');
    }

    await validateRevenueCatApiAccess(apiKey, revenueCatProjectId);
    const encryptedApiKey = encrypt(apiKey, 'revenueCatApiKey');
    const now = new Date();
    const [connection] = await db
        .insert(projectRevenueConnections)
        .values({
            projectId: project.id,
            teamId: project.teamId,
            connectedByUserId: input.userId,
            provider: 'revenuecat',
            externalAccountId: revenueCatProjectId,
            externalAccountName: `RevenueCat project ${revenueCatProjectId}`,
            status: 'connected',
            apiKeyEncrypted: encryptedApiKey,
            apiKeyLast4: apiKey.slice(-4),
            connectionConfig: {
                projectId: revenueCatProjectId,
                apiVersion: 'v2',
                requiredPermissions: [
                    'charts_metrics:overview:read',
                    'charts_metrics:charts:read',
                ],
            },
            lastSyncStartedAt: now,
            lastSyncError: null,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: [projectRevenueConnections.projectId, projectRevenueConnections.provider],
            set: {
                teamId: project.teamId,
                connectedByUserId: input.userId,
                externalAccountId: revenueCatProjectId,
                externalAccountName: `RevenueCat project ${revenueCatProjectId}`,
                status: 'connected',
                apiKeyEncrypted: encryptedApiKey,
                apiKeyLast4: apiKey.slice(-4),
                connectionConfig: {
                    projectId: revenueCatProjectId,
                    apiVersion: 'v2',
                    requiredPermissions: [
                        'charts_metrics:overview:read',
                        'charts_metrics:charts:read',
                    ],
                },
                lastSyncStartedAt: now,
                lastSyncError: null,
                updatedAt: now,
            },
        })
        .returning({ id: projectRevenueConnections.id });

    await setProjectRevenueActiveProvider(input.projectId, 'revenuecat', input.userId);
    void enqueueGenericRevenueSync(input.projectId, 'revenuecat', 'initial').catch((err) => {
        logger.error({ err, projectId: input.projectId }, 'Unable to enqueue initial RevenueCat revenue sync');
    });

    return { connectionId: connection.id };
}

async function replaceRevenueProviderTransactionsForDateRange(
    connection: NonNullable<Awaited<ReturnType<typeof getProviderConnection>>>,
    provider: RevenueProvider,
    rows: GenericRevenueTransaction[],
    startDateKey: string,
    endDateKey: string,
): Promise<string[]> {
    const startAt = new Date(`${startDateKey}T00:00:00Z`);
    const endExclusive = new Date(`${addDaysToDateKey(endDateKey, 1)}T00:00:00Z`);
    const existingRows = await dbRead
        .select({
            id: revenueProviderTransactions.id,
            date: sql<string>`${revenueProviderTransactions.occurredAt}::date::text`,
        })
        .from(revenueProviderTransactions)
        .where(and(
            eq(revenueProviderTransactions.projectId, connection.projectId),
            eq(revenueProviderTransactions.provider, provider),
            gte(revenueProviderTransactions.occurredAt, startAt),
            lt(revenueProviderTransactions.occurredAt, endExclusive),
        ));

    for (let index = 0; index < existingRows.length; index += GENERIC_REVENUE_UPSERT_BATCH_SIZE) {
        const batch = existingRows.slice(index, index + GENERIC_REVENUE_UPSERT_BATCH_SIZE).map((row) => row.id);
        await db
            .delete(revenueProviderTransactions)
            .where(inArray(revenueProviderTransactions.id, batch));
    }

    await upsertGenericRevenueTransactions(connection, provider, rows);
    return [
        ...existingRows.map((row) => row.date).filter(Boolean),
        ...rows.map((row) => toUtcDateKey(row.occurredAt)),
    ];
}

async function syncRevenueCatRevenue(projectId: string, mode: RevenueSyncMode): Promise<GenericRevenueProviderSyncResult> {
    if (!isRevenueCatRevenueSourceConfigured()) {
        throw new Error('REVENUECAT_API_KEY_ENCRYPTION_KEY is required for RevenueCat API key storage');
    }

    const connection = await getProviderConnection(projectId, 'revenuecat');
    if (!connection || connection.status === 'disconnected') {
        throw new Error('RevenueCat revenue is not connected for this project');
    }
    const apiKey = connection.apiKeyEncrypted ? safeDecrypt(connection.apiKeyEncrypted, 'revenueCatApiKey') : null;
    if (!apiKey || apiKey === 'disconnected') {
        throw new Error('RevenueCat API key is unavailable');
    }

    const connectionConfig = asRecord(connection.connectionConfig) || {};
    const revenueCatProjectId = nullableTrim(connectionConfig.projectId) || nullableTrim(connection.externalAccountId);
    if (!revenueCatProjectId) {
        throw new Error('RevenueCat project ID is unavailable');
    }

    const hasProviderTransactions = await providerHasRevenueTransactions(projectId, 'revenuecat');
    const syncWindow = resolveGenericRevenueSyncWindow({
        mode,
        newestSyncedAt: connection.newestSyncedAt,
        hasProviderTransactions,
    });
    const startDate = syncWindow.startDate;
    const startDateKey = toUtcDateKey(startDate);
    const endDateKey = toUtcDateKey(new Date());
    const response = await fetch(buildRevenueCatRevenueChartEndpoint({
        baseUrl: config.REVENUECAT_API_BASE_URL,
        revenueCatProjectId,
        startDate: startDateKey,
        endDate: endDateKey,
    }), {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
        },
    });

    await assertRevenueCatApiResponseOk(
        response,
        `RevenueCat revenue chart sync failed (${response.status})`,
    );

    const payload = await response.json().catch(() => null);
    const transactions = parseRevenueCatRevenueChartRows(payload);
    const rebuildDateKeys = await replaceRevenueProviderTransactionsForDateRange(
        connection,
        'revenuecat',
        transactions,
        startDateKey,
        endDateKey,
    );
    const importedDateCount = await rebuildGenericProviderDailyRollups(projectId, 'revenuecat', rebuildDateKeys);
    return {
        importedDateCount,
        transactionCount: transactions.length,
        fullBackfill: syncWindow.fullBackfill,
    };
}

export async function configureCustomEventRevenue(input: {
    projectId: string;
    userId: string;
    config: CustomRevenueEventConfig;
}): Promise<{ connectionId: string }> {
    const project = await getProjectForRevenue(input.projectId);
    if (!project) throw new Error('Project not found');
    const normalizedConfig = normalizeCustomEventConfig(input.config);
    if (!normalizedConfig) throw new Error('A revenue custom event name is required');

    const now = new Date();
    const [connection] = await db
        .insert(projectRevenueConnections)
        .values({
            projectId: project.id,
            teamId: project.teamId,
            connectedByUserId: input.userId,
            provider: 'custom_events',
            externalAccountId: normalizedConfig.revenueEventName,
            externalAccountName: 'Track Revenue With Custom Events',
            status: 'connected',
            customEventConfig: normalizedConfig as unknown as Record<string, unknown>,
            lastSyncStartedAt: now,
            lastSyncError: null,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: [projectRevenueConnections.projectId, projectRevenueConnections.provider],
            set: {
                teamId: project.teamId,
                connectedByUserId: input.userId,
                externalAccountId: normalizedConfig.revenueEventName,
                externalAccountName: 'Track Revenue With Custom Events',
                status: 'connected',
                customEventConfig: normalizedConfig as unknown as Record<string, unknown>,
                lastSyncStartedAt: now,
                lastSyncError: null,
                updatedAt: now,
            },
        })
        .returning({ id: projectRevenueConnections.id });

    await setProjectRevenueActiveProvider(input.projectId, 'custom_events', input.userId);
    void enqueueGenericRevenueSync(input.projectId, 'custom_events', 'initial').catch((err) => {
        logger.error({ err, projectId: input.projectId }, 'Unable to enqueue custom event revenue rebuild');
    });

    return { connectionId: connection.id };
}

async function upsertGenericRevenueTransactions(
    connection: NonNullable<Awaited<ReturnType<typeof getProviderConnection>>>,
    provider: RevenueProvider,
    rows: GenericRevenueTransaction[],
): Promise<void> {
    if (!rows.length) return;

    for (let index = 0; index < rows.length; index += GENERIC_REVENUE_UPSERT_BATCH_SIZE) {
        const batch = rows.slice(index, index + GENERIC_REVENUE_UPSERT_BATCH_SIZE);
        const updatedAt = new Date();
        await db
            .insert(revenueProviderTransactions)
            .values(batch.map((row) => ({
                connectionId: connection.id,
                projectId: connection.projectId,
                provider,
                externalTransactionId: row.externalTransactionId,
                externalSourceId: row.externalSourceId ?? null,
                occurredAt: row.occurredAt,
                amountCents: row.amountCents,
                feeCents: row.feeCents,
                netCents: row.netCents,
                grossAmountCents: row.grossAmountCents,
                refundAmountCents: row.refundAmountCents,
                currency: row.currency,
                type: row.type,
                reportingCategory: row.reportingCategory ?? null,
                metadata: row.metadata ?? {},
                updatedAt,
            })))
            .onConflictDoUpdate({
                target: [
                    revenueProviderTransactions.projectId,
                    revenueProviderTransactions.provider,
                    revenueProviderTransactions.externalTransactionId,
                ],
                set: {
                    connectionId: sql`excluded.connection_id`,
                    externalSourceId: sql`excluded.external_source_id`,
                    occurredAt: sql`excluded.occurred_at`,
                    amountCents: sql`excluded.amount_cents`,
                    feeCents: sql`excluded.fee_cents`,
                    netCents: sql`excluded.net_cents`,
                    grossAmountCents: sql`excluded.gross_amount_cents`,
                    refundAmountCents: sql`excluded.refund_amount_cents`,
                    currency: sql`excluded.currency`,
                    type: sql`excluded.type`,
                    reportingCategory: sql`excluded.reporting_category`,
                    metadata: sql`excluded.metadata`,
                    updatedAt: sql`excluded.updated_at`,
                },
            });

        await writeRevenueEventsToClickHouse({
            dedupeKey: `${connection.projectId}:${provider}:${batch[0]?.externalTransactionId ?? index}:${batch[batch.length - 1]?.externalTransactionId ?? index}`,
            rows: batch.map((row) => buildClickHouseRevenueEventRow({
                projectId: connection.projectId,
                provider,
                occurredAt: row.occurredAt,
                externalTransactionId: row.externalTransactionId,
                externalSourceId: row.externalSourceId,
                amountCents: row.amountCents,
                grossAmountCents: row.grossAmountCents,
                refundAmountCents: row.refundAmountCents,
                feeCents: row.feeCents,
                netCents: row.netCents,
                currency: row.currency,
                type: row.type,
                reportingCategory: row.reportingCategory,
                metadata: row.metadata,
            })),
        });
    }
}

async function rebuildGenericProviderDailyRollups(
    projectId: string,
    provider: RevenueProvider,
    dateKeys: string[],
): Promise<number> {
    const uniqueDateKeys = Array.from(new Set(dateKeys)).filter(Boolean);
    if (!uniqueDateKeys.length) return 0;
    const dateKeyArraySql = sql`ARRAY[${sql.join(uniqueDateKeys.map((dateKey) => sql`${dateKey}`), sql`, `)}]::date[]`;

    await db
        .delete(projectRevenueDaily)
        .where(and(
            eq(projectRevenueDaily.projectId, projectId),
            eq(projectRevenueDaily.sourceProvider, provider),
            sql`${projectRevenueDaily.date} = ANY(${dateKeyArraySql})`,
        ));

    const aggregateQuery = await db.execute(sql`
        WITH base AS (
          SELECT
            occurred_at::date::text AS date,
            currency,
            provider,
            type,
            reporting_category,
            gross_amount_cents,
            refund_amount_cents,
            fee_cents,
            net_cents,
            metadata,
            COALESCE(NULLIF(metadata->>'eventName', ''), reporting_category, type) AS event_name
          FROM ${revenueProviderTransactions}
          WHERE ${revenueProviderTransactions.projectId} = ${projectId}
            AND ${revenueProviderTransactions.provider} = ${provider}
            AND occurred_at::date = ANY(${dateKeyArraySql})
        ),
        event_counts AS (
          SELECT date, currency, event_name, COUNT(*)::int AS event_count
          FROM base
          WHERE event_name IS NOT NULL AND event_name <> ''
          GROUP BY date, currency, event_name
        ),
        aggregates AS (
          SELECT
            date,
            currency,
            COALESCE(SUM(gross_amount_cents), 0) AS gross_amount_cents,
            COALESCE(SUM(refund_amount_cents), 0) AS refund_amount_cents,
            COALESCE(SUM(fee_cents), 0) AS fee_amount_cents,
            COALESCE(SUM(net_cents), 0) AS net_amount_cents,
            COALESCE(SUM(CASE WHEN reporting_category = 'revenue' THEN COALESCE((metadata->>'transactionCount')::int, 1) ELSE 0 END), 0) AS transaction_count,
            COALESCE(SUM(CASE WHEN reporting_category = 'refund' OR refund_amount_cents > 0 THEN 1 ELSE 0 END), 0) AS refund_count,
            COALESCE(SUM(CASE WHEN reporting_category = 'subscriber' THEN 1 ELSE 0 END), 0) AS subscriber_count,
            COALESCE(SUM(CASE WHEN reporting_category = 'trial' THEN 1 ELSE 0 END), 0) AS trial_count,
            COALESCE(SUM(CASE WHEN reporting_category = 'subscription_start' THEN 1 ELSE 0 END), 0) AS subscription_start_count,
            COALESCE(SUM(CASE WHEN reporting_category = 'cancellation' THEN 1 ELSE 0 END), 0) AS cancellation_count,
            COALESCE(SUM(CASE WHEN reporting_category = 'conversion' THEN 1 ELSE 0 END), 0) AS conversion_count
          FROM base
          GROUP BY date, currency
        )
        SELECT
          aggregates.*,
          COALESCE((
            SELECT jsonb_object_agg(event_counts.event_name, event_counts.event_count)
            FROM event_counts
            WHERE event_counts.date = aggregates.date
              AND event_counts.currency = aggregates.currency
          ), '{}'::jsonb) AS custom_event_counts
        FROM aggregates
    `);

    const rows = Array.isArray(aggregateQuery)
        ? aggregateQuery as CustomEventAggregateRow[]
        : (((aggregateQuery as unknown) as { rows?: CustomEventAggregateRow[] }).rows ?? []);

    for (const row of rows) {
        await upsertDailyRow(projectId, provider, row, {
            customEventCounts: row.custom_event_counts || {},
        });
    }

    return uniqueDateKeys.length;
}

async function upsertDailyRow(
    projectId: string,
    provider: RevenueProvider,
    row: RawAggregateRow,
    extra: { customEventCounts?: Record<string, number> },
): Promise<void> {
    await db
        .insert(projectRevenueDaily)
        .values({
            projectId,
            sourceProvider: provider,
            date: row.date,
            currency: row.currency,
            grossAmountCents: numberFromDb(row.gross_amount_cents),
            refundAmountCents: numberFromDb(row.refund_amount_cents),
            feeAmountCents: numberFromDb(row.fee_amount_cents),
            netAmountCents: numberFromDb(row.net_amount_cents),
            transactionCount: numberFromDb(row.transaction_count),
            refundCount: numberFromDb(row.refund_count),
            subscriberCount: numberFromDb(row.subscriber_count),
            trialCount: numberFromDb(row.trial_count),
            subscriptionStartCount: numberFromDb(row.subscription_start_count),
            cancellationCount: numberFromDb(row.cancellation_count),
            conversionCount: numberFromDb(row.conversion_count),
            customEventCounts: extra.customEventCounts ?? {},
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [
                projectRevenueDaily.projectId,
                projectRevenueDaily.sourceProvider,
                projectRevenueDaily.date,
                projectRevenueDaily.currency,
            ],
            set: {
                grossAmountCents: numberFromDb(row.gross_amount_cents),
                refundAmountCents: numberFromDb(row.refund_amount_cents),
                feeAmountCents: numberFromDb(row.fee_amount_cents),
                netAmountCents: numberFromDb(row.net_amount_cents),
                transactionCount: numberFromDb(row.transaction_count),
                refundCount: numberFromDb(row.refund_count),
                subscriberCount: numberFromDb(row.subscriber_count),
                trialCount: numberFromDb(row.trial_count),
                subscriptionStartCount: numberFromDb(row.subscription_start_count),
                cancellationCount: numberFromDb(row.cancellation_count),
                conversionCount: numberFromDb(row.conversion_count),
                customEventCounts: extra.customEventCounts ?? {},
                updatedAt: new Date(),
            },
        });
}

async function rebuildCustomEventRevenueTransactions(
    connection: NonNullable<Awaited<ReturnType<typeof getProviderConnection>>>,
    config: CustomRevenueEventConfig,
    since: Date | null,
): Promise<number> {
    const normalizedConfig = normalizeCustomEventConfig(config);
    if (!normalizedConfig) throw new Error('A revenue custom event name is required');

    const amountMultiplier = normalizedConfig.amountUnit === 'minor' ? 1 : 100;
    const eventNames = [
        normalizedConfig.revenueEventName,
        normalizedConfig.refundEventName,
        normalizedConfig.subscriberEventName,
        normalizedConfig.trialStartedEventName,
        normalizedConfig.subscriptionStartedEventName,
        normalizedConfig.cancellationEventName,
        normalizedConfig.conversionEventName,
    ]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase());

    if (eventNames.length === 0) return 0;
    const eventNameArraySql = sql`ARRAY[${sql.join(eventNames.map((eventName) => sql`${eventName}`), sql`, `)}]::text[]`;

    if (!since) {
        await db
            .delete(revenueProviderTransactions)
            .where(and(
                eq(revenueProviderTransactions.projectId, connection.projectId),
                eq(revenueProviderTransactions.provider, 'custom_events'),
                sql`COALESCE(${revenueProviderTransactions.metadata}->>'source', '') <> ${MANUAL_REVENUE_SOURCE}`,
            ));
        await db
            .delete(projectRevenueDaily)
            .where(and(
                eq(projectRevenueDaily.projectId, connection.projectId),
                eq(projectRevenueDaily.sourceProvider, 'custom_events'),
            ));
    }

    const insertQuery = await db.execute(sql`
        WITH event_rows AS (
          SELECT
            s.id AS session_id,
            s.device_id,
            s.user_display_id,
            s.anonymous_hash,
            s.anonymous_display_id,
            s.platform,
            s.app_version,
            s.started_at,
            event,
            ordinality - 1 AS event_index,
            lower(COALESCE(NULLIF(event->>'name', ''), NULLIF(event->>'type', ''))) AS event_name,
            CASE
              WHEN jsonb_typeof(event->'properties') = 'object' THEN event->'properties'
              WHEN jsonb_typeof(event->'properties') = 'string' THEN (event->>'properties')::jsonb
              WHEN jsonb_typeof(event->'payload') = 'object' THEN event->'payload'
              WHEN jsonb_typeof(event->'payload') = 'string' THEN (event->>'payload')::jsonb
              ELSE '{}'::jsonb
            END AS props
          FROM ${sessions} s
          CROSS JOIN LATERAL jsonb_array_elements(s.events) WITH ORDINALITY AS events(event, ordinality)
          WHERE s.project_id = ${connection.projectId}
            ${since ? sql`AND s.started_at >= ${since}` : sql``}
        ),
        normalized AS (
          SELECT
            session_id,
            device_id,
            user_display_id,
            anonymous_hash,
            anonymous_display_id,
            platform,
            app_version,
            started_at,
            event,
            event_index,
            event_name,
            props,
            lower(COALESCE(
              NULLIF(props->>${normalizedConfig.revenueCurrencyProperty}, ''),
              NULLIF(event->>${normalizedConfig.revenueCurrencyProperty}, ''),
              ${normalizedConfig.defaultCurrency}
            )) AS currency,
            CASE
              WHEN COALESCE(NULLIF(props->>${normalizedConfig.revenueAmountProperty}, ''), NULLIF(event->>${normalizedConfig.revenueAmountProperty}, ''), '0') ~ '^-?[0-9]+(\\.[0-9]+)?$'
              THEN (COALESCE(NULLIF(props->>${normalizedConfig.revenueAmountProperty}, ''), NULLIF(event->>${normalizedConfig.revenueAmountProperty}, ''), '0')::numeric * ${amountMultiplier})::int
              ELSE 0
            END AS amount_cents
          FROM event_rows
          WHERE event_name = ANY(${eventNameArraySql})
        ),
        typed AS (
          SELECT
            *,
            CASE
              WHEN event_name = ${normalizedConfig.revenueEventName.toLowerCase()} THEN 'revenue'
              WHEN event_name = ${normalizedConfig.refundEventName?.toLowerCase() || '__none__'} THEN 'refund'
              WHEN event_name = ${normalizedConfig.subscriberEventName?.toLowerCase() || '__none__'} THEN 'subscriber'
              WHEN event_name = ${normalizedConfig.trialStartedEventName?.toLowerCase() || '__none__'} THEN 'trial'
              WHEN event_name = ${normalizedConfig.subscriptionStartedEventName?.toLowerCase() || '__none__'} THEN 'subscription_start'
              WHEN event_name = ${normalizedConfig.cancellationEventName?.toLowerCase() || '__none__'} THEN 'cancellation'
              WHEN event_name = ${normalizedConfig.conversionEventName?.toLowerCase() || '__none__'} THEN 'conversion'
              ELSE 'custom_event'
            END AS category
          FROM normalized
        ),
        inserted AS (
          INSERT INTO ${revenueProviderTransactions} (
            id,
            connection_id,
            project_id,
            provider,
            external_transaction_id,
            external_source_id,
            occurred_at,
            amount_cents,
            fee_cents,
            net_cents,
            gross_amount_cents,
            refund_amount_cents,
            currency,
            type,
            reporting_category,
            metadata,
            updated_at
          )
          SELECT
            gen_random_uuid(),
            ${connection.id},
            ${connection.projectId},
            'custom_events',
            concat(
              'custom_events:',
              event_name,
              ':',
              COALESCE(NULLIF(props->>'transaction_id', ''), NULLIF(props->>'transactionId', ''), NULLIF(event->>'id', ''), session_id || ':' || event_index::text)
            ),
            session_id,
            started_at,
            CASE WHEN category IN ('revenue', 'refund') THEN amount_cents ELSE 0 END,
            0,
            CASE
              WHEN category = 'revenue' THEN GREATEST(amount_cents, 0)
              WHEN category = 'refund' THEN -ABS(amount_cents)
              ELSE 0
            END,
            CASE WHEN category = 'revenue' THEN GREATEST(amount_cents, 0) ELSE 0 END,
            CASE WHEN category = 'refund' THEN ABS(amount_cents) ELSE 0 END,
            currency,
            category,
            category,
            jsonb_strip_nulls(jsonb_build_object(
              'source', 'rejourney_custom_events',
              'eventName', event_name,
              'eventIndex', event_index,
              'sessionId', session_id,
              'deviceId', device_id,
              'userDisplayId', user_display_id,
              'anonymousHash', anonymous_hash,
              'anonymousDisplayId', anonymous_display_id,
              'platform', platform,
              'appVersion', app_version
            )),
            now()
          FROM typed
          WHERE (
            (category = 'revenue' AND amount_cents > 0)
            OR (category = 'refund' AND amount_cents <> 0)
            OR category NOT IN ('revenue', 'refund')
          )
          ON CONFLICT (project_id, provider, external_transaction_id)
          DO UPDATE SET
            connection_id = excluded.connection_id,
            external_source_id = excluded.external_source_id,
            occurred_at = excluded.occurred_at,
            amount_cents = excluded.amount_cents,
            fee_cents = excluded.fee_cents,
            net_cents = excluded.net_cents,
            gross_amount_cents = excluded.gross_amount_cents,
            refund_amount_cents = excluded.refund_amount_cents,
            currency = excluded.currency,
            type = excluded.type,
            reporting_category = excluded.reporting_category,
            metadata = excluded.metadata,
            updated_at = excluded.updated_at
          RETURNING
            external_transaction_id,
            external_source_id,
            occurred_at,
            amount_cents,
            gross_amount_cents,
            refund_amount_cents,
            fee_cents,
            net_cents,
            currency,
            type,
            reporting_category,
            metadata,
            occurred_at::date::text AS date
        )
        SELECT *
        FROM inserted
    `);

    type CustomRevenueInsertedRow = {
        external_transaction_id: string;
        external_source_id: string | null;
        occurred_at: Date | string;
        amount_cents: string | number;
        gross_amount_cents: string | number;
        refund_amount_cents: string | number;
        fee_cents: string | number;
        net_cents: string | number;
        currency: string;
        type: string;
        reporting_category: string | null;
        metadata: Record<string, unknown> | string | null;
        date: string;
    };
    const rows = Array.isArray(insertQuery)
        ? insertQuery as CustomRevenueInsertedRow[]
        : (((insertQuery as unknown) as { rows?: CustomRevenueInsertedRow[] }).rows ?? []);
    let dateKeys = Array.from(new Set(rows.map((row) => row.date).filter(Boolean)));
    if (!since) {
        const allDateRows = await dbRead
            .select({
                date: sql<string>`${revenueProviderTransactions.occurredAt}::date::text`,
            })
            .from(revenueProviderTransactions)
            .where(and(
                eq(revenueProviderTransactions.projectId, connection.projectId),
                eq(revenueProviderTransactions.provider, 'custom_events'),
            ))
            .groupBy(sql`${revenueProviderTransactions.occurredAt}::date::text`);
        dateKeys = allDateRows.map((row) => row.date).filter(Boolean);
    }
    const clickHouseRows = rows.map((row) => {
        const occurredAt = row.occurred_at instanceof Date ? row.occurred_at : new Date(row.occurred_at);
        const metadata = typeof row.metadata === 'string'
            ? safeJsonRecord(row.metadata)
            : (row.metadata ?? {});
        return buildClickHouseRevenueEventRow({
            projectId: connection.projectId,
            provider: 'custom_events',
            occurredAt,
            externalTransactionId: row.external_transaction_id,
            externalSourceId: row.external_source_id,
            amountCents: numberFromDb(row.amount_cents),
            grossAmountCents: numberFromDb(row.gross_amount_cents),
            refundAmountCents: numberFromDb(row.refund_amount_cents),
            feeCents: numberFromDb(row.fee_cents),
            netCents: numberFromDb(row.net_cents),
            currency: row.currency,
            type: row.type,
            reportingCategory: row.reporting_category,
            metadata,
        });
    });
    await writeRevenueEventsToClickHouse({
        dedupeKey: `${connection.projectId}:custom_events:${modeSafeDateKey(since)}:${rows[0]?.external_transaction_id ?? 'empty'}:${rows[rows.length - 1]?.external_transaction_id ?? 'empty'}`,
        rows: clickHouseRows,
    });
    await rebuildGenericProviderDailyRollups(connection.projectId, 'custom_events', dateKeys);
    return rows.length;
}

export async function enqueueGenericRevenueSync(
    projectId: string,
    provider: RevenueProvider,
    mode: RevenueSyncMode,
): Promise<{ enqueued: boolean; status: RevenueConnectionStatus }> {
    const connection = await getProviderConnection(projectId, provider);
    if (!connection || connection.status === 'disconnected') {
        throw new Error(`${PROVIDER_LABELS[provider]} revenue is not connected for this project`);
    }

    const key = providerSyncKey(projectId, provider);
    if (runningProviderSyncs.has(key)) {
        return { enqueued: false, status: 'syncing' };
    }

    const now = new Date();
    const staleBefore = new Date(now.getTime() - GENERIC_REVENUE_SYNC_STALE_MS);
    const claimed = await db
        .update(projectRevenueConnections)
        .set({
            status: 'syncing',
            lastSyncStartedAt: now,
            lastSyncError: null,
            updatedAt: now,
        })
        .where(and(
            eq(projectRevenueConnections.id, connection.id),
            sql`(
                ${projectRevenueConnections.status} <> 'syncing'
                OR ${projectRevenueConnections.lastSyncStartedAt} IS NULL
                OR ${projectRevenueConnections.lastSyncStartedAt} < ${staleBefore}
            )`,
        ))
        .returning({ id: projectRevenueConnections.id });

    if (claimed.length === 0) {
        return { enqueued: false, status: 'syncing' };
    }

    setTimeout(() => {
        void syncGenericRevenueProvider(projectId, provider, mode).catch((err) => {
            logger.error({ err, projectId, provider, mode }, 'Revenue provider sync failed after enqueue');
        });
    }, 0);

    return { enqueued: true, status: 'syncing' };
}

export async function syncGenericRevenueProvider(
    projectId: string,
    provider: RevenueProvider,
    mode: RevenueSyncMode,
): Promise<void> {
    const key = providerSyncKey(projectId, provider);
    if (runningProviderSyncs.has(key)) return;
    runningProviderSyncs.add(key);

    const startedAt = new Date();
    let syncResult: GenericRevenueProviderSyncResult = {
        importedDateCount: 0,
        transactionCount: 0,
        fullBackfill: mode === 'initial',
    };
    try {
        const connection = await getProviderConnection(projectId, provider);
        if (!connection || connection.status === 'disconnected') {
            throw new Error(`${PROVIDER_LABELS[provider]} revenue is not connected for this project`);
        }

        if (provider === 'superwall') {
            syncResult = await syncSuperwallRevenue(projectId, mode);
        } else if (provider === 'revenuecat') {
            syncResult = await syncRevenueCatRevenue(projectId, mode);
        } else if (provider === 'custom_events') {
            const normalizedConfig = normalizeCustomEventConfig(connection.customEventConfig);
            const fullBackfill = mode === 'initial' || !connection.newestSyncedAt;
            let importedDateCount = 0;
            if (normalizedConfig) {
                const since = mode === 'initial'
                    ? null
                    : (connection.newestSyncedAt
                        ? new Date(connection.newestSyncedAt.getTime() - GENERIC_REVENUE_INCREMENTAL_OVERLAP_MS)
                        : null);
                importedDateCount = await rebuildCustomEventRevenueTransactions(connection, normalizedConfig, since);
            } else {
                const manualDateRows = await dbRead
                    .select({
                        date: sql<string>`${revenueProviderTransactions.occurredAt}::date::text`,
                    })
                    .from(revenueProviderTransactions)
                    .where(and(
                        eq(revenueProviderTransactions.projectId, projectId),
                        eq(revenueProviderTransactions.provider, 'custom_events'),
                        sql`${revenueProviderTransactions.metadata}->>'source' = ${MANUAL_REVENUE_SOURCE}`,
                    ))
                    .groupBy(sql`${revenueProviderTransactions.occurredAt}::date::text`);
                importedDateCount = await rebuildGenericProviderDailyRollups(
                    projectId,
                    'custom_events',
                    manualDateRows.map((row) => row.date).filter(Boolean),
                );
            }
            syncResult = {
                importedDateCount,
                transactionCount: importedDateCount,
                fullBackfill,
            };
        }

        const completedAt = new Date();
        const latestTransactionConditions = [
            eq(revenueProviderTransactions.projectId, projectId),
            eq(revenueProviderTransactions.provider, provider),
        ];
        if (provider === 'superwall' || provider === 'revenuecat') {
            latestTransactionConditions.push(sql`(
                ${revenueProviderTransactions.amountCents} <> 0
                OR ${revenueProviderTransactions.grossAmountCents} <> 0
                OR ${revenueProviderTransactions.refundAmountCents} <> 0
                OR ${revenueProviderTransactions.netCents} <> 0
            )`);
        }
        const latestTransaction = await dbRead
            .select({ occurredAt: revenueProviderTransactions.occurredAt })
            .from(revenueProviderTransactions)
            .where(and(...latestTransactionConditions))
            .orderBy(desc(revenueProviderTransactions.occurredAt))
            .limit(1);

        await db
            .update(projectRevenueConnections)
            .set({
                status: 'connected',
                lastSyncStartedAt: startedAt,
                lastSyncCompletedAt: completedAt,
                lastSyncError: null,
                newestSyncedAt: latestTransaction[0]?.occurredAt ?? null,
                updatedAt: completedAt,
            })
            .where(and(
                eq(projectRevenueConnections.projectId, projectId),
                eq(projectRevenueConnections.provider, provider),
            ));

        logger.info({
            projectId,
            provider,
            mode,
            importedDateCount: syncResult.importedDateCount,
            transactionCount: syncResult.transactionCount,
            fullBackfill: syncResult.fullBackfill,
            newestSyncedAt: latestTransaction[0]?.occurredAt ?? null,
        }, 'Revenue provider sync completed');
    } catch (err) {
        const errorText = err instanceof Error ? err.message : String(err);
        await db
            .update(projectRevenueConnections)
            .set({
                status: 'error',
                lastSyncError: errorText,
                updatedAt: new Date(),
            })
            .where(and(
                eq(projectRevenueConnections.projectId, projectId),
                eq(projectRevenueConnections.provider, provider),
            ));
        logger.error({ err, projectId, provider, mode }, 'Revenue provider sync failed');
    } finally {
        runningProviderSyncs.delete(key);
    }
}

export async function disconnectGenericRevenueProvider(projectId: string, provider: RevenueProvider): Promise<void> {
    const connection = await getProviderConnection(projectId, provider);
    if (!connection) return;
    const credentialKeyPurpose = provider === 'superwall'
        ? 'superwallApiKey'
        : provider === 'revenuecat'
            ? 'revenueCatApiKey'
            : 'storage';

    await db
        .update(projectRevenueConnections)
        .set({
            status: 'disconnected',
            accessTokenEncrypted: connection.accessTokenEncrypted ? safeEncrypt('disconnected', credentialKeyPurpose) : null,
            refreshTokenEncrypted: null,
            apiKeyEncrypted: connection.apiKeyEncrypted ? safeEncrypt('disconnected', credentialKeyPurpose) : null,
            lastSyncError: null,
            updatedAt: new Date(),
        })
        .where(eq(projectRevenueConnections.id, connection.id));
}

export async function getConnectedGenericRevenueProvidersDueForSync(): Promise<Array<{ projectId: string; provider: RevenueProvider }>> {
    const rows = await dbRead
        .select({
            projectId: projectRevenueConnections.projectId,
            provider: projectRevenueConnections.provider,
            lastSyncStartedAt: projectRevenueConnections.lastSyncStartedAt,
            lastSyncCompletedAt: projectRevenueConnections.lastSyncCompletedAt,
        })
        .from(projectRevenueConnections)
        .where(inArray(projectRevenueConnections.status, ['connected', 'syncing', 'error']))
        .orderBy(projectRevenueConnections.updatedAt);

    const due: Array<{ projectId: string; provider: RevenueProvider }> = [];
    for (const row of rows) {
        if (!isRevenueProvider(row.provider)) continue;
        const lastSyncAt = row.lastSyncCompletedAt ?? row.lastSyncStartedAt ?? null;
        if (lastSyncAt && Date.now() - lastSyncAt.getTime() < GENERIC_REVENUE_SYNC_INTERVAL_MS) continue;
        due.push({ projectId: row.projectId, provider: row.provider });
    }
    return due;
}

async function syncDueGenericRevenueConnections(): Promise<void> {
    const dueConnections = await getConnectedGenericRevenueProvidersDueForSync();
    for (const connection of dueConnections) {
        await enqueueGenericRevenueSync(connection.projectId, connection.provider, 'scheduled').catch((err) => {
            logger.warn(
                { err, projectId: connection.projectId, provider: connection.provider },
                'Unable to enqueue scheduled revenue provider sync',
            );
        });
    }
}

export function startRevenueSourceSyncScheduler(): void {
    if (isTest || schedulerInterval) return;

    initialSchedulerTimeout = setTimeout(() => {
        void syncDueGenericRevenueConnections().catch((err) => {
            logger.error({ err }, 'Initial revenue provider scheduled sync failed');
        });
    }, 45_000);

    schedulerInterval = setInterval(() => {
        void syncDueGenericRevenueConnections().catch((err) => {
            logger.error({ err }, 'Scheduled revenue provider sync failed');
        });
    }, 6 * 60 * 60 * 1000);

    logger.info('Revenue provider sync scheduler started');
}

export function stopRevenueSourceSyncScheduler(): void {
    if (initialSchedulerTimeout) {
        clearTimeout(initialSchedulerTimeout);
        initialSchedulerTimeout = null;
    }
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
    }
}
