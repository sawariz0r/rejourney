import { Router, Request, Response, NextFunction } from 'express';
import { and, eq } from 'drizzle-orm';

import { db, teamMembers } from '../db/client.js';
import { sessionAuth, requireProjectAccess } from '../middleware/auth.js';
import { dashboardRateLimiter, writeApiRateLimiter } from '../middleware/rateLimit.js';
import { auditFromRequest } from '../services/auditLog.js';
import {
    configureCustomEventRevenue,
    connectSuperwallRevenue,
    deleteManualRevenueEntry,
    disconnectGenericRevenueProvider,
    enqueueGenericRevenueSync,
    getRevenueOverview,
    RevenueProvider,
    SUPPORTED_REVENUE_PROVIDERS,
    updateProjectRevenueSource,
    upsertManualRevenueEntry,
} from '../services/revenueSources.js';

const REVENUE_SOURCE_MANAGER_ROLES = new Set(['owner', 'admin', 'billing_admin']);

export const revenueProjectRouter = Router({ mergeParams: true });

async function getProjectMembershipRole(teamId: string, userId: string): Promise<string | null> {
    const [membership] = await db
        .select({ role: teamMembers.role })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
        .limit(1);

    return membership?.role ?? null;
}

async function getCurrentProjectRole(req: Request): Promise<string | null> {
    if (!req.user || !req.project) return null;
    return getProjectMembershipRole(req.project.teamId, req.user.id);
}

async function requireRevenueManager(req: Request, res: Response, next: NextFunction): Promise<void> {
    const role = await getCurrentProjectRole(req);
    if (!role || !REVENUE_SOURCE_MANAGER_ROLES.has(role)) {
        res.status(403).json({ error: 'Forbidden', message: 'Project owner, admin, or billing admin access required' });
        return;
    }

    next();
}

function parseRevenueProvider(value: unknown): RevenueProvider | null {
    return (SUPPORTED_REVENUE_PROVIDERS as readonly string[]).includes(String(value)) ? value as RevenueProvider : null;
}

function parseManualAmountCents(value: unknown): number | null {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) && Number.isInteger(numeric) ? numeric : null;
}

revenueProjectRouter.get(
    '/',
    sessionAuth,
    dashboardRateLimiter,
    requireProjectAccess,
    async (req, res) => {
        if (!req.project || !req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const role = await getCurrentProjectRole(req);
        const canManage = Boolean(role && REVENUE_SOURCE_MANAGER_ROLES.has(role));
        const timeRange = typeof req.query.timeRange === 'string' ? req.query.timeRange : undefined;
        const currency = typeof req.query.currency === 'string' ? req.query.currency : null;

        const overview = await getRevenueOverview(req.project.id, {
            timeRange,
            currency,
            canManage,
        });

        res.json(overview);
    },
);

revenueProjectRouter.post(
    '/manual',
    sessionAuth,
    writeApiRateLimiter,
    requireProjectAccess,
    requireRevenueManager,
    async (req, res) => {
        if (!req.project || !req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const amountCents = parseManualAmountCents(req.body?.amountCents);
        if (amountCents === null) {
            res.status(400).json({ error: 'Invalid manual revenue amount' });
            return;
        }

        const entry = await upsertManualRevenueEntry({
            projectId: req.project.id,
            userId: req.user.id,
            date: String(req.body?.date || ''),
            amountCents,
            currency: String(req.body?.currency || 'usd'),
            transactionCount: parseManualAmountCents(req.body?.transactionCount) ?? 1,
            note: typeof req.body?.note === 'string' ? req.body.note : null,
        });

        await auditFromRequest(req, 'manual_revenue_created', {
            targetType: 'revenue_source',
            targetId: entry.id,
            metadata: { projectId: req.project.id, currency: entry.currency, amountCents: entry.amountCents },
        });

        res.status(201).json({ success: true, entry });
    },
);

revenueProjectRouter.put(
    '/manual/:entryId',
    sessionAuth,
    writeApiRateLimiter,
    requireProjectAccess,
    requireRevenueManager,
    async (req, res) => {
        if (!req.project || !req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const amountCents = parseManualAmountCents(req.body?.amountCents);
        if (amountCents === null) {
            res.status(400).json({ error: 'Invalid manual revenue amount' });
            return;
        }

        const entry = await upsertManualRevenueEntry({
            projectId: req.project.id,
            userId: req.user.id,
            entryId: req.params.entryId,
            date: String(req.body?.date || ''),
            amountCents,
            currency: String(req.body?.currency || 'usd'),
            transactionCount: parseManualAmountCents(req.body?.transactionCount) ?? 1,
            note: typeof req.body?.note === 'string' ? req.body.note : null,
        });

        await auditFromRequest(req, 'manual_revenue_updated', {
            targetType: 'revenue_source',
            targetId: entry.id,
            metadata: { projectId: req.project.id, currency: entry.currency, amountCents: entry.amountCents },
        });

        res.json({ success: true, entry });
    },
);

revenueProjectRouter.delete(
    '/manual/:entryId',
    sessionAuth,
    writeApiRateLimiter,
    requireProjectAccess,
    requireRevenueManager,
    async (req, res) => {
        if (!req.project) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const deleted = await deleteManualRevenueEntry(req.project.id, req.params.entryId);
        if (!deleted) {
            res.status(404).json({ error: 'Starting revenue baseline not found' });
            return;
        }

        await auditFromRequest(req, 'manual_revenue_deleted', {
            targetType: 'revenue_source',
            targetId: req.params.entryId,
            metadata: { projectId: req.project.id },
        });

        res.status(204).send();
    },
);

revenueProjectRouter.put(
    '/source',
    sessionAuth,
    writeApiRateLimiter,
    requireProjectAccess,
    requireRevenueManager,
    async (req, res) => {
        if (!req.project || !req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const provider = parseRevenueProvider(req.body?.provider);
        if (!provider) {
            res.status(400).json({ error: 'Invalid revenue provider' });
            return;
        }

        await updateProjectRevenueSource(req.project.id, provider, req.user.id);
        await auditFromRequest(req, 'revenue_source_changed', {
            targetType: 'revenue_source',
            targetId: req.project.id,
            metadata: { projectId: req.project.id, provider },
        });

        res.json({ success: true, provider });
    },
);

revenueProjectRouter.post(
    '/sync',
    sessionAuth,
    writeApiRateLimiter,
    requireProjectAccess,
    requireRevenueManager,
    async (req, res) => {
        if (!req.project) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const provider = parseRevenueProvider(req.body?.provider);
        if (!provider) {
            res.status(400).json({ error: 'Invalid revenue provider' });
            return;
        }

        const result = await enqueueGenericRevenueSync(req.project.id, provider, 'manual');

        await auditFromRequest(req, 'revenue_sync_requested', {
            targetType: 'revenue_source',
            targetId: req.project.id,
            metadata: {
                projectId: req.project.id,
                provider,
                enqueued: result.enqueued,
            },
        });

        res.json({ success: true, ...result });
    },
);

revenueProjectRouter.post(
    '/superwall/connect',
    sessionAuth,
    writeApiRateLimiter,
    requireProjectAccess,
    requireRevenueManager,
    async (req, res) => {
        if (!req.project || !req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey : '';
        const organizationId = typeof req.body?.organizationId === 'string' ? req.body.organizationId : null;
        const applicationId = typeof req.body?.applicationId === 'string' ? req.body.applicationId : null;
        const result = await connectSuperwallRevenue({
            projectId: req.project.id,
            userId: req.user.id,
            apiKey,
            organizationId,
            applicationId,
        });

        await auditFromRequest(req, 'superwall_revenue_connected', {
            targetType: 'revenue_source',
            targetId: result.connectionId,
            metadata: { projectId: req.project.id },
        });

        res.json({ success: true, ...result });
    },
);

revenueProjectRouter.put(
    '/custom-events',
    sessionAuth,
    writeApiRateLimiter,
    requireProjectAccess,
    requireRevenueManager,
    async (req, res) => {
        if (!req.project || !req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const result = await configureCustomEventRevenue({
            projectId: req.project.id,
            userId: req.user.id,
            config: {
                revenueEventName: String(req.body?.revenueEventName || ''),
                revenueAmountProperty: String(req.body?.revenueAmountProperty || 'amount'),
                revenueCurrencyProperty: String(req.body?.revenueCurrencyProperty || 'currency'),
                defaultCurrency: String(req.body?.defaultCurrency || 'usd'),
                amountUnit: req.body?.amountUnit === 'minor' ? 'minor' : 'major',
                refundEventName: typeof req.body?.refundEventName === 'string' ? req.body.refundEventName : null,
                subscriberEventName: typeof req.body?.subscriberEventName === 'string' ? req.body.subscriberEventName : null,
                trialStartedEventName: typeof req.body?.trialStartedEventName === 'string' ? req.body.trialStartedEventName : null,
                subscriptionStartedEventName: typeof req.body?.subscriptionStartedEventName === 'string' ? req.body.subscriptionStartedEventName : null,
                cancellationEventName: typeof req.body?.cancellationEventName === 'string' ? req.body.cancellationEventName : null,
                conversionEventName: typeof req.body?.conversionEventName === 'string' ? req.body.conversionEventName : null,
            },
        });

        await auditFromRequest(req, 'custom_event_revenue_configured', {
            targetType: 'revenue_source',
            targetId: result.connectionId,
            metadata: { projectId: req.project.id },
        });

        res.json({ success: true, ...result });
    },
);

revenueProjectRouter.delete(
    '/providers/:provider',
    sessionAuth,
    writeApiRateLimiter,
    requireProjectAccess,
    requireRevenueManager,
    async (req, res) => {
        if (!req.project) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const provider = parseRevenueProvider(req.params.provider);
        if (!provider) {
            res.status(400).json({ error: 'Invalid revenue provider' });
            return;
        }

        await disconnectGenericRevenueProvider(req.project.id, provider);

        await auditFromRequest(req, 'revenue_source_disconnected', {
            targetType: 'revenue_source',
            targetId: req.project.id,
            metadata: { projectId: req.project.id, provider },
        });

        res.status(204).send();
    },
);
