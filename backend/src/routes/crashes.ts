/**
 * Crashes Routes
 */

import { Router } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, crashes, projects, sessions, teamMembers } from '../db/client.js';
import { sessionAuth, asyncHandler, ApiError } from '../middleware/index.js';

const router = Router();

function canOpenReplayFromSessionFields(session: {
    replayAvailable?: boolean | null;
    recordingDeleted?: boolean | null;
    isReplayExpired?: boolean | null;
}): boolean {
    return Boolean(session.replayAvailable) && !session.recordingDeleted && !session.isReplayExpired;
}

/**
 * Get crashes for a project
 */
router.get(
    '/projects/:projectId/crashes',
    sessionAuth,
    asyncHandler(async (req, res) => {
        const { projectId } = req.params;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const offset = parseInt(req.query.offset as string) || 0;

        // Verify access to project
        const [project] = await db
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);

        if (!project) {
            throw ApiError.notFound('Project not found');
        }

        const [membership] = await db
            .select()
            .from(teamMembers)
            .where(and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, req.user!.id)))
            .limit(1);

        if (!membership) {
            throw ApiError.forbidden('Access denied');
        }

        const crashList = await db
            .select()
            .from(crashes)
            .where(eq(crashes.projectId, projectId))
            .orderBy(desc(crashes.timestamp))
            .limit(limit)
            .offset(offset);

        const total = await db
            .select({ count: sql<number>`count(*)` })
            .from(crashes)
            .where(eq(crashes.projectId, projectId));

        res.json({
            crashes: crashList,
            total: Number(total[0]?.count || 0),
        });
    })
);

/**
 * Get crash details
 */
router.get(
    '/projects/:projectId/crashes/:crashId',
    sessionAuth,
    asyncHandler(async (req, res) => {
        const { projectId, crashId } = req.params;

        // Verify access to project
        const [project] = await db
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);

        if (!project) {
            throw ApiError.notFound('Project not found');
        }

        const [membership] = await db
            .select()
            .from(teamMembers)
            .where(and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, req.user!.id)))
            .limit(1);

        if (!membership) {
            throw ApiError.forbidden('Access denied');
        }

        const [row] = await db
            .select({
                crash: crashes,
                replayAvailable: sessions.replayAvailable,
                recordingDeleted: sessions.recordingDeleted,
                isReplayExpired: sessions.isReplayExpired,
            })
            .from(crashes)
            .leftJoin(sessions, eq(crashes.sessionId, sessions.id))
            .where(and(eq(crashes.id, crashId), eq(crashes.projectId, projectId)))
            .limit(1);

        if (!row) {
            throw ApiError.notFound('Crash not found');
        }
        const crash = row.crash;

        res.json({
            ...crash,
            stackTrace: crash.stackTrace || null,
            canOpenReplay: canOpenReplayFromSessionFields(row),
        });
    })
);

export default router;
