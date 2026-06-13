import { Router } from 'express';
import { config } from '../config.js';
import { sessionAuth, asyncHandler, ApiError } from '../middleware/index.js';
import { signInternalServiceRequest } from '../services/internalServiceAuth.js';
import { userCanAccessProject } from '../services/projectAccess.js';

const router = Router();

const ALLOWED_LEAK_STATUSES = new Set(['queued', 'researching', 'ready', 'resolved', 'ignored', 'budget_exhausted', 'failed']);

type LeakLike = {
    id?: string;
    projectId?: string;
    project_id?: string;
};

function ensureLeaksUiEnabled() {
    if (!config.SHOW_ISSUE_DETECTION_UI) {
        throw ApiError.notFound('Not found');
    }
}

function getIssueDetectionBaseUrl(): URL {
    ensureLeaksUiEnabled();
    if (!config.ISSUE_DETECTION_API_URL || !config.ISSUE_DETECTION_SERVICE_SECRET) {
        throw ApiError.serviceUnavailable('Issue detection is not configured');
    }
    return new URL(config.ISSUE_DETECTION_API_URL);
}

function buildUpstreamUrl(pathWithQuery: string): URL {
    const baseUrl = getIssueDetectionBaseUrl();
    return new URL(pathWithQuery, baseUrl.toString());
}

async function callIssueDetection<T>(input: {
    body?: unknown;
    method?: string;
    pathWithQuery: string;
    raw?: boolean;
}): Promise<T> {
    const method = input.method ?? 'GET';
    const headers = new Headers({
        ...signInternalServiceRequest({
            body: input.body,
            method,
            pathWithQuery: input.pathWithQuery,
            secret: config.ISSUE_DETECTION_SERVICE_SECRET!,
            service: 'rejourney',
        }),
    });

    let body: string | undefined;
    if (input.body !== undefined) {
        body = JSON.stringify(input.body);
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(buildUpstreamUrl(input.pathWithQuery), {
        method,
        headers,
        body,
    });

    if (!response.ok) {
        if (response.status === 404) throw ApiError.notFound('Leak not found');
        if (response.status === 409) throw ApiError.conflict('Issue detection rejected the request');
        if (response.status === 429) throw ApiError.tooManyRequests('Issue detection is rate limited');
        throw ApiError.serviceUnavailable('Issue detection service unavailable');
    }

    if (input.raw) return response as T;
    return await response.json() as T;
}

async function requireProjectAccess(userId: string, projectId: string) {
    const allowed = await userCanAccessProject(userId, projectId);
    if (!allowed) throw ApiError.forbidden('Access denied');
}

function getLeakProjectId(leak: LeakLike): string | null {
    return leak.projectId ?? leak.project_id ?? null;
}

async function fetchLeakForAccessCheck(leakId: string): Promise<LeakLike> {
    const leak = await callIssueDetection<LeakLike>({
        pathWithQuery: `/v1/leaks/${encodeURIComponent(leakId)}`,
    });
    const projectId = getLeakProjectId(leak);
    if (!projectId) throw ApiError.serviceUnavailable('Issue detection returned an invalid leak');
    return leak;
}

router.use(sessionAuth);

router.get('/leaks', asyncHandler(async (req, res) => {
    ensureLeaksUiEnabled();
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : '';
    if (!projectId) throw ApiError.badRequest('projectId is required');
    await requireProjectAccess(req.user!.id, projectId);

    const params = new URLSearchParams();
    for (const key of ['status', 'q', 'cursor', 'limit', 'severity', 'type']) {
        const value = req.query[key];
        if (typeof value === 'string' && value.trim()) params.set(key, value);
    }

    const query = params.toString();
    const data = await callIssueDetection<unknown>({
        pathWithQuery: `/v1/projects/${encodeURIComponent(projectId)}/leaks${query ? `?${query}` : ''}`,
    });
    res.json(data);
}));

router.get('/leaks/:leakId', asyncHandler(async (req, res) => {
    ensureLeaksUiEnabled();
    const leak = await fetchLeakForAccessCheck(req.params.leakId);
    await requireProjectAccess(req.user!.id, getLeakProjectId(leak)!);
    res.json(leak);
}));

router.post('/leaks/:leakId/context', asyncHandler(async (req, res) => {
    ensureLeaksUiEnabled();
    const leak = await fetchLeakForAccessCheck(req.params.leakId);
    await requireProjectAccess(req.user!.id, getLeakProjectId(leak)!);

    const data = await callIssueDetection<unknown>({
        method: 'POST',
        pathWithQuery: `/v1/leaks/${encodeURIComponent(req.params.leakId)}/context`,
        body: {
            actorUserId: req.user!.id,
        },
    });
    res.json(data);
}));

router.get('/leaks/:leakId/context/raw.md', asyncHandler(async (req, res) => {
    ensureLeaksUiEnabled();
    const leak = await fetchLeakForAccessCheck(req.params.leakId);
    await requireProjectAccess(req.user!.id, getLeakProjectId(leak)!);

    const response = await callIssueDetection<Response>({
        pathWithQuery: `/v1/leaks/${encodeURIComponent(req.params.leakId)}/context/raw.md`,
        raw: true,
    });
    const markdown = await response.text();
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(markdown);
}));

router.patch('/leaks/:leakId', asyncHandler(async (req, res) => {
    ensureLeaksUiEnabled();
    const status = req.body?.status;
    if (status !== undefined && (!ALLOWED_LEAK_STATUSES.has(status))) {
        throw ApiError.badRequest('Invalid leak status');
    }

    const leak = await fetchLeakForAccessCheck(req.params.leakId);
    await requireProjectAccess(req.user!.id, getLeakProjectId(leak)!);

    const data = await callIssueDetection<unknown>({
        method: 'PATCH',
        pathWithQuery: `/v1/leaks/${encodeURIComponent(req.params.leakId)}`,
        body: {
            ...req.body,
            actorUserId: req.user!.id,
        },
    });
    res.json(data);
}));

export default router;
