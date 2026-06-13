import { and, eq } from 'drizzle-orm';
import { db, projects, teamMembers } from '../db/client.js';

export async function userCanAccessProject(userId: string, projectId: string): Promise<boolean> {
    const [row] = await db
        .select({ projectId: projects.id })
        .from(projects)
        .innerJoin(teamMembers, eq(teamMembers.teamId, projects.teamId))
        .where(and(
            eq(projects.id, projectId),
            eq(teamMembers.userId, userId),
        ))
        .limit(1);

    return Boolean(row);
}
