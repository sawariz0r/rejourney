import { Router } from 'express';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { config } from '../config.js';
import {
    anrs,
    crashes,
    dbRead,
    errors,
    projects,
    recordingArtifacts,
    sessionMetrics,
    sessions,
} from '../db/client.js';
import { downloadRawFromS3ForArtifact } from '../db/s3.js';
import { requireIssueDetectionInternalAuth } from '../middleware/internalServiceAuth.js';
import { ApiError, asyncHandler } from '../middleware/index.js';

const router = Router();

const MAX_CANDIDATE_LIMIT = 64;
const DEFAULT_CANDIDATE_LIMIT = 32;
const DEFAULT_CANDIDATE_LOOKBACK_HOURS = 24;
const DEFAULT_CANDIDATE_LOOKBACK = `${DEFAULT_CANDIDATE_LOOKBACK_HOURS}h`;

type CandidateTimeWindow = {
    lookback: string;
    since: Date | null;
};

function ensureInternalDataApiAllowed() {
    if (config.RJ_API_ROLE === 'ingest') {
        throw ApiError.notFound('Not found');
    }
    if (!config.REJOURNEY_INTERNAL_SERVICE_SECRET) {
        throw ApiError.serviceUnavailable('Internal issue-detection API is not configured');
    }
}

function parseLimit(value: unknown, fallback: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function parseLookback(value: unknown): CandidateTimeWindow | null {
    if (typeof value !== 'string' || !value.trim()) return null;

    const normalized = value.trim().toLowerCase();
    if (['all', 'all-time', 'all_time', 'lifetime'].includes(normalized)) {
        return { lookback: 'all', since: null };
    }

    const match = normalized.match(/^(\d+)\s*(m|h|d|w)$/);
    if (!match) return null;

    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const unitToMs: Record<string, number> = {
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
    };

    return {
        lookback: `${amount}${match[2]}`,
        since: new Date(Date.now() - amount * unitToMs[match[2]]),
    };
}

function parseCandidateTimeWindow(input: { lookback?: unknown; since?: unknown }): CandidateTimeWindow {
    if (typeof input.since === 'string' && input.since.trim()) {
        const normalizedSince = input.since.trim().toLowerCase();
        if (['all', 'all-time', 'all_time', 'lifetime'].includes(normalizedSince)) {
            return { lookback: 'all', since: null };
        }

        const parsed = new Date(input.since);
        if (Number.isFinite(parsed.getTime())) {
            return { lookback: 'custom', since: parsed };
        }
    }

    return parseLookback(input.lookback) ?? parseLookback(DEFAULT_CANDIDATE_LOOKBACK)!;
}

function toIso(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

router.use((_req, _res, next) => {
    try {
        ensureInternalDataApiAllowed();
        next();
    } catch (error) {
        next(error);
    }
});

router.use(requireIssueDetectionInternalAuth);

router.get('/projects', asyncHandler(async (_req, res) => {
    const rows = await dbRead
        .select({
            id: projects.id,
            teamId: projects.teamId,
            name: projects.name,
            platform: projects.platform,
            bundleId: projects.bundleId,
            packageName: projects.packageName,
            webDomain: projects.webDomain,
            webAllowedDomains: projects.webAllowedDomains,
            recordingEnabled: projects.recordingEnabled,
            rejourneyEnabled: projects.rejourneyEnabled,
            createdAt: projects.createdAt,
            updatedAt: projects.updatedAt,
        })
        .from(projects)
        .where(and(
            eq(projects.rejourneyEnabled, true),
            eq(projects.recordingEnabled, true),
            sql`${projects.deletedAt} is null`,
        ))
        .orderBy(desc(projects.createdAt));

    res.json({
        projects: rows.map((project) => ({
            ...project,
            createdAt: toIso(project.createdAt),
            updatedAt: toIso(project.updatedAt),
        })),
    });
}));

router.get('/projects/:projectId/candidate-sessions', asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const limit = parseLimit(req.query.limit, DEFAULT_CANDIDATE_LIMIT, MAX_CANDIDATE_LIMIT);
    const timeWindow = parseCandidateTimeWindow({
        lookback: req.query.lookback,
        since: req.query.since,
    });

    const signalScore = sql<number>`
        (
            coalesce(${sessionMetrics.crashCount}, 0) * 20
            + coalesce(${sessionMetrics.anrCount}, 0) * 16
            + coalesce(${sessionMetrics.errorCount}, 0) * 8
            + coalesce(${sessionMetrics.apiErrorCount}, 0) * 5
            + coalesce(${sessionMetrics.rageTapCount}, 0) * 4
            + coalesce(${sessionMetrics.deadTapCount}, 0) * 3
            + case when coalesce(${sessions.durationSeconds}, 0) >= 15 then 2 else 0 end
            + case when coalesce(${sessionMetrics.touchCount}, 0) + coalesce(${sessionMetrics.scrollCount}, 0) >= 3 then 2 else 0 end
        )
    `;

    const conditions = [
        eq(sessions.projectId, projectId),
        eq(sessions.replayAvailable, true),
        eq(sessions.recordingDeleted, false),
        eq(sessions.isReplayExpired, false),
        sql`coalesce(${sessions.replayRetentionState}, 'saved') = 'saved'`,
        sql`${sessions.smartCaptureStatus} <> 'discarded'`,
        sql`${signalScore} > 0`,
    ];
    if (timeWindow.since) conditions.push(gte(sessions.startedAt, timeWindow.since));

    const rows = await dbRead
        .select({
            id: sessions.id,
            projectId: sessions.projectId,
            startedAt: sessions.startedAt,
            endedAt: sessions.endedAt,
            durationSeconds: sessions.durationSeconds,
            platform: sessions.platform,
            appVersion: sessions.appVersion,
            deviceModel: sessions.deviceModel,
            osVersion: sessions.osVersion,
            userDisplayId: sessions.userDisplayId,
            anonymousHash: sessions.anonymousHash,
            replayAvailable: sessions.replayAvailable,
            smartCaptureStatus: sessions.smartCaptureStatus,
            totalEvents: sessionMetrics.totalEvents,
            errorCount: sessionMetrics.errorCount,
            crashCount: sessionMetrics.crashCount,
            anrCount: sessionMetrics.anrCount,
            apiErrorCount: sessionMetrics.apiErrorCount,
            rageTapCount: sessionMetrics.rageTapCount,
            deadTapCount: sessionMetrics.deadTapCount,
            touchCount: sessionMetrics.touchCount,
            scrollCount: sessionMetrics.scrollCount,
            screenshotSegmentCount: sessionMetrics.screenshotSegmentCount,
            hierarchySnapshotCount: sessionMetrics.hierarchySnapshotCount,
            signalScore,
            readyVisualArtifactCount: sql<number>`count(${recordingArtifacts.id})`,
        })
        .from(sessions)
        .leftJoin(sessionMetrics, eq(sessionMetrics.sessionId, sessions.id))
        .innerJoin(recordingArtifacts, and(
            eq(recordingArtifacts.sessionId, sessions.id),
            eq(recordingArtifacts.status, 'ready'),
            inArray(recordingArtifacts.kind, ['screenshots', 'rrweb', 'video']),
        ))
        .where(and(...conditions))
        .groupBy(
            sessions.id,
            sessionMetrics.id,
        )
        .orderBy(desc(signalScore), desc(sessions.startedAt))
        .limit(limit);

    res.json({
        projectId,
        lookback: timeWindow.lookback,
        since: timeWindow.since?.toISOString() ?? null,
        limit,
        sessions: rows.map((row) => ({
            id: row.id,
            projectId: row.projectId,
            startedAt: toIso(row.startedAt),
            endedAt: toIso(row.endedAt),
            durationSeconds: row.durationSeconds,
            platform: row.platform,
            appVersion: row.appVersion,
            deviceModel: row.deviceModel,
            osVersion: row.osVersion,
            userDisplayId: row.userDisplayId,
            anonymousHash: row.anonymousHash,
            replayAvailable: row.replayAvailable,
            smartCaptureStatus: row.smartCaptureStatus,
            signalScore: Number(row.signalScore ?? 0),
            readyVisualArtifactCount: Number(row.readyVisualArtifactCount ?? 0),
            metrics: {
                totalEvents: row.totalEvents ?? 0,
                errorCount: row.errorCount ?? 0,
                crashCount: row.crashCount ?? 0,
                anrCount: row.anrCount ?? 0,
                apiErrorCount: row.apiErrorCount ?? 0,
                rageTapCount: row.rageTapCount ?? 0,
                deadTapCount: row.deadTapCount ?? 0,
                touchCount: row.touchCount ?? 0,
                scrollCount: row.scrollCount ?? 0,
                screenshotSegmentCount: row.screenshotSegmentCount ?? 0,
                hierarchySnapshotCount: row.hierarchySnapshotCount ?? 0,
            },
        })),
    });
}));

router.get('/sessions/:sessionId/feature-record', asyncHandler(async (req, res) => {
    const sessionId = req.params.sessionId;
    const [row] = await dbRead
        .select({
            session: sessions,
            metrics: sessionMetrics,
            projectName: projects.name,
            projectTeamId: projects.teamId,
        })
        .from(sessions)
        .innerJoin(projects, eq(projects.id, sessions.projectId))
        .leftJoin(sessionMetrics, eq(sessionMetrics.sessionId, sessions.id))
        .where(eq(sessions.id, sessionId))
        .limit(1);

    if (!row) throw ApiError.notFound('Session not found');

    const [sessionCrashes, sessionAnrs, sessionErrors, artifacts] = await Promise.all([
        dbRead.select().from(crashes).where(eq(crashes.sessionId, sessionId)).limit(50),
        dbRead.select().from(anrs).where(eq(anrs.sessionId, sessionId)).limit(50),
        dbRead.select().from(errors).where(eq(errors.sessionId, sessionId)).limit(50),
        dbRead
            .select({
                id: recordingArtifacts.id,
                sessionId: recordingArtifacts.sessionId,
                kind: recordingArtifacts.kind,
                status: recordingArtifacts.status,
                sizeBytes: recordingArtifacts.sizeBytes,
                declaredSizeBytes: recordingArtifacts.declaredSizeBytes,
                readyAt: recordingArtifacts.readyAt,
                uploadCompletedAt: recordingArtifacts.uploadCompletedAt,
                timestamp: recordingArtifacts.timestamp,
                startTime: recordingArtifacts.startTime,
                endTime: recordingArtifacts.endTime,
                frameCount: recordingArtifacts.frameCount,
                createdAt: recordingArtifacts.createdAt,
            })
            .from(recordingArtifacts)
            .where(and(eq(recordingArtifacts.sessionId, sessionId), eq(recordingArtifacts.status, 'ready')))
            .orderBy(recordingArtifacts.createdAt)
            .limit(200),
    ]);

    res.json({
        session: {
            ...row.session,
            startedAt: toIso(row.session.startedAt),
            endedAt: toIso(row.session.endedAt),
            explicitEndedAt: toIso(row.session.explicitEndedAt),
            finalizedAt: toIso(row.session.finalizedAt),
            lastIngestActivityAt: toIso(row.session.lastIngestActivityAt),
            createdAt: toIso(row.session.createdAt),
            updatedAt: toIso(row.session.updatedAt),
        },
        project: {
            id: row.session.projectId,
            name: row.projectName,
            teamId: row.projectTeamId,
        },
        metrics: row.metrics ?? null,
        crashes: sessionCrashes.map((item) => ({ ...item, timestamp: toIso(item.timestamp), createdAt: toIso(item.createdAt), updatedAt: toIso(item.updatedAt) })),
        anrs: sessionAnrs.map((item) => ({ ...item, timestamp: toIso(item.timestamp), createdAt: toIso(item.createdAt), updatedAt: toIso(item.updatedAt) })),
        errors: sessionErrors.map((item) => ({ ...item, timestamp: toIso(item.timestamp), createdAt: toIso(item.createdAt), updatedAt: toIso(item.updatedAt) })),
        artifacts: artifacts.map((artifact) => ({
            ...artifact,
            readyAt: toIso(artifact.readyAt),
            uploadCompletedAt: toIso(artifact.uploadCompletedAt),
            createdAt: toIso(artifact.createdAt),
            bytesUrl: `/api/internal/issue-detection/artifacts/${artifact.id}/bytes`,
        })),
    });
}));

router.get('/sessions/:sessionId/artifacts', asyncHandler(async (req, res) => {
    const sessionId = req.params.sessionId;
    const kind = typeof req.query.kind === 'string' && req.query.kind.trim() ? req.query.kind.trim() : null;

    const conditions = [eq(recordingArtifacts.sessionId, sessionId), eq(recordingArtifacts.status, 'ready')];
    if (kind) conditions.push(eq(recordingArtifacts.kind, kind));

    const rows = await dbRead
        .select({
            id: recordingArtifacts.id,
            sessionId: recordingArtifacts.sessionId,
            kind: recordingArtifacts.kind,
            status: recordingArtifacts.status,
            sizeBytes: recordingArtifacts.sizeBytes,
            declaredSizeBytes: recordingArtifacts.declaredSizeBytes,
            readyAt: recordingArtifacts.readyAt,
            uploadCompletedAt: recordingArtifacts.uploadCompletedAt,
            timestamp: recordingArtifacts.timestamp,
            startTime: recordingArtifacts.startTime,
            endTime: recordingArtifacts.endTime,
            frameCount: recordingArtifacts.frameCount,
            createdAt: recordingArtifacts.createdAt,
        })
        .from(recordingArtifacts)
        .where(and(...conditions))
        .orderBy(recordingArtifacts.createdAt);

    res.json({
        sessionId,
        artifacts: rows.map((artifact) => ({
            ...artifact,
            readyAt: toIso(artifact.readyAt),
            uploadCompletedAt: toIso(artifact.uploadCompletedAt),
            createdAt: toIso(artifact.createdAt),
            bytesUrl: `/api/internal/issue-detection/artifacts/${artifact.id}/bytes`,
        })),
    });
}));

router.get('/artifacts/:artifactId/bytes', asyncHandler(async (req, res) => {
    const artifactId = req.params.artifactId;
    const [row] = await dbRead
        .select({
            artifact: recordingArtifacts,
            projectId: sessions.projectId,
        })
        .from(recordingArtifacts)
        .innerJoin(sessions, eq(sessions.id, recordingArtifacts.sessionId))
        .where(and(eq(recordingArtifacts.id, artifactId), eq(recordingArtifacts.status, 'ready')))
        .limit(1);

    if (!row) throw ApiError.notFound('Artifact not found');

    const data = await downloadRawFromS3ForArtifact(row.projectId, row.artifact.s3ObjectKey, row.artifact.endpointId);
    if (!data) throw ApiError.notFound('Artifact bytes not found');

    res.setHeader('Content-Type', row.artifact.s3ObjectKey.endsWith('.gz') ? 'application/gzip' : 'application/octet-stream');
    res.setHeader('Content-Length', String(data.length));
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(data);
}));

export default router;
