import { Router, type Request } from 'express';
import { eq } from 'drizzle-orm';
import { db, recordingArtifacts, sessions } from '../db/client.js';
import { config } from '../config.js';
import { ApiError, asyncHandler } from '../middleware/index.js';
import { logger } from '../logger.js';
import {
    markArtifactBuffered,
    markArtifactUploadInterrupted,
} from '../services/ingestArtifactLifecycle.js';
import {
    verifyArtifactUploadRelayTokenResult,
} from '../services/ingestUploadRelay.js';
import { deleteArtifactBuffer, getRedisDiagnosticsForLog, setArtifactBuffer } from '../db/redis.js';
import { assertSessionAcceptsNewIngestWork } from '../services/sessionIngestImmutability.js';

const router = Router();

function parseContentLength(value: string | undefined): number | null {
    if (!value) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.floor(parsed);
}

async function collectRequestBody(req: Request, maxBytes: number): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Buffer);
        totalBytes += buf.byteLength;
        if (totalBytes > maxBytes) {
            throw ApiError.badRequest('Artifact exceeds ingest max object size');
        }
        chunks.push(buf);
    }

    return Buffer.concat(chunks, totalBytes);
}

router.put(
    '/artifacts/:artifactId',
    asyncHandler(async (req, res) => {
        const artifactId = req.params.artifactId;
        const token = typeof req.query.token === 'string' ? req.query.token : undefined;
        const tokenResult = verifyArtifactUploadRelayTokenResult(token, artifactId);

        if (!tokenResult.ok) {
            logger.warn(
                {
                    event: 'ingest.relay_auth_failed',
                    artifactId,
                    reason: tokenResult.reason,
                    hasToken: Boolean(token),
                    ...getRedisDiagnosticsForLog(),
                },
                'ingest.relay_auth_failed',
            );
            throw ApiError.forbidden('Invalid or expired upload token');
        }
        const payload = tokenResult.payload;

        const [artifactResult] = await db.select({
            artifact: recordingArtifacts,
            session: sessions,
        })
            .from(recordingArtifacts)
            .innerJoin(sessions, eq(recordingArtifacts.sessionId, sessions.id))
            .where(eq(recordingArtifacts.id, artifactId))
            .limit(1);

        if (!artifactResult) {
            logger.warn(
                {
                    event: 'ingest.relay_artifact_not_found',
                    artifactId,
                    projectIdFromToken: payload.projectId,
                    sessionIdFromToken: payload.sessionId,
                    ...getRedisDiagnosticsForLog(),
                },
                'ingest.relay_artifact_not_found',
            );
            throw ApiError.notFound('Artifact not found');
        }

        const { artifact, session } = artifactResult;
        if (session.projectId !== payload.projectId || session.id !== payload.sessionId) {
            logger.warn(
                {
                    event: 'ingest.relay_token_scope_mismatch',
                    artifactId,
                    sessionProjectId: session.projectId,
                    tokenProjectId: payload.projectId,
                    sessionId: session.id,
                    tokenSessionId: payload.sessionId,
                    ...getRedisDiagnosticsForLog(),
                },
                'ingest.relay_token_scope_mismatch',
            );
            throw ApiError.forbidden('Upload token scope mismatch');
        }

        try {
            assertSessionAcceptsNewIngestWork(session);
        } catch (err) {
            logger.warn(
                {
                    event: 'ingest.relay_rejected_session_immutable',
                    sessionId: session.id,
                    artifactId,
                    projectId: session.projectId,
                },
                'ingest.relay_rejected_session_immutable',
            );
            throw err;
        }

        const contentLength = parseContentLength(req.header('content-length') || undefined);
        if (contentLength && contentLength > config.INGEST_MAX_OBJECT_BYTES) {
            logger.warn(
                {
                    event: 'ingest.relay_payload_too_large',
                    artifactId,
                    contentLength,
                    maxObjectBytes: config.INGEST_MAX_OBJECT_BYTES,
                    ...getRedisDiagnosticsForLog(),
                },
                'ingest.relay_payload_too_large',
            );
            throw ApiError.badRequest('Artifact exceeds ingest max object size');
        }

        const contentType = req.header('content-type') || 'application/octet-stream';
        const log = logger.child({
            route: '/upload/artifacts/:artifactId',
            artifactId,
            sessionId: session.id,
            projectId: session.projectId,
            kind: artifact.kind,
            endpointId: artifact.endpointId ?? null,
            s3ObjectKey: artifact.s3ObjectKey,
        });

        log.info({
            contentLength,
            contentType,
            previousStatus: artifact.status,
        }, 'artifact.upload_received');

        if (artifact.status === 'ready' || artifact.status === 'uploaded') {
            log.info({
                event: 'ingest.relay_artifact_already_stored',
                status: artifact.status,
            }, 'ingest.relay_artifact_already_stored');
            res.status(204).end();
            return;
        }

        if (artifact.status !== 'pending' && artifact.status !== 'buffered') {
            throw ApiError.conflict(`Artifact is not accepting uploads in status ${artifact.status}`);
        }

        let requestInterrupted = Boolean(req.aborted);
        const markInterrupted = () => {
            requestInterrupted = true;
        };
        req.once('aborted', markInterrupted);
        req.once('error', markInterrupted);
        req.once('close', () => {
            if (!res.writableEnded) {
                requestInterrupted = true;
            }
        });

        let body: Buffer;
        try {
            body = await collectRequestBody(req, config.INGEST_MAX_OBJECT_BYTES);
        } catch (err) {
            if (err instanceof ApiError) {
                throw err;
            }

            const wasInterrupted = requestInterrupted || req.aborted;
            log.error(
                {
                    event: 'ingest.relay_body_read_failed',
                    wasInterrupted,
                    errorMessage: String(err),
                    contentLength,
                    ...getRedisDiagnosticsForLog(),
                },
                'ingest.relay_body_read_failed',
            );
            await markArtifactUploadInterrupted({
                artifactId: artifact.id,
                reason: wasInterrupted ? 'relay_upload_aborted' : 'relay_upload_failed',
                errorMsg: String(err),
            });

            if (!res.headersSent && !res.writableEnded && !res.destroyed) {
                const statusCode = wasInterrupted ? 499 : 503;
                res.status(statusCode).json({
                    error: wasInterrupted ? 'CLIENT_CLOSED_REQUEST' : 'SERVICE_UNAVAILABLE',
                    message: wasInterrupted
                        ? 'Artifact upload interrupted before storage completed'
                        : 'Failed to store artifact upload',
                });
            }
            return;
        }

        try {
            await setArtifactBuffer(artifact.id, body);
            const bufferState = await markArtifactBuffered(artifact.id);
            if (!bufferState.buffered) {
                deleteArtifactBuffer(artifact.id).catch((err) => {
                    log.warn({ err }, 'ingest.relay_buffer_cleanup_failed');
                });
            }
        } catch (err) {
            log.error(
                {
                    event: 'ingest.relay_buffer_write_failed',
                    errorMessage: String(err),
                    contentLength,
                    receivedBytes: body.byteLength,
                    ...getRedisDiagnosticsForLog(),
                },
                'ingest.relay_buffer_write_failed',
            );
            throw ApiError.serviceUnavailable('Failed to buffer artifact upload');
        }

        log.info({
            event: 'ingest.relay_artifact_buffered',
            contentLength,
            receivedBytes: body.byteLength,
            contentType,
        });

        res.status(204).end();
    })
);

export default router;
