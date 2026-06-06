import { sql } from 'drizzle-orm';
import { db, recordingArtifacts, sessions } from '../db/client.js';
import { shouldApplySuccessorSessionCap } from './sessionTiming.js';

/** Inactivity window before fail-safe session finalization (no ingest touches). */
export const SESSION_LIVE_INGEST_WINDOW_MS = 60_000;

export type SessionWorkAggregate = {
    readyScreenshotCount: number;
    readyScreenshotBytes: number;
    readyWebReplayCount: number;
    readyWebReplayBytes: number;
    readyHierarchyCount: number;
    openArtifactCount: number;
    activeJobCount: number;
    openReplayArtifactCount: number;
    activeReplayJobCount: number;
    latestReplayArtifactEndMs: number | null;
    latestEventArtifactEndMs: number | null;
    latestReadyAt: Date | null;
    pendingEventEvidenceCount: number;
    readyEventArtifactMissingDerivedCount: number;
    hasPendingProcessingWork: boolean;
    hasPendingWork: boolean;
    hasPendingReplayWork: boolean;
};

type SessionAggregateRow = {
    readyScreenshotCount: number | string | null;
    readyScreenshotBytes: number | string | null;
    readyWebReplayCount: number | string | null;
    readyWebReplayBytes: number | string | null;
    readyHierarchyCount: number | string | null;
    openArtifactCount: number | string | null;
    activeJobCount: number | string | null;
    openReplayArtifactCount: number | string | null;
    activeReplayJobCount: number | string | null;
    latestReplayArtifactEndMs: number | string | null;
    latestEventArtifactEndMs: number | string | null;
    latestReadyAt: Date | string | null;
    pendingEventEvidenceCount: number | string | null;
    readyEventArtifactMissingDerivedCount: number | string | null;
};

type EvidenceSession = {
    endedAt?: Date | string | null;
    lastIngestActivityAt?: Date | string | null;
    platform?: string | null;
    startedAt: Date;
};

export type SessionEvidenceState = SessionWorkAggregate & {
    hasReplayArtifacts: boolean;
    latestClientEvidenceEndMs: number | null;
    smartCaptureEvidenceSettled: boolean;
    supersededByNewerVisitorSession: boolean;
};

function toFiniteNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toDateOrNull(value: unknown): Date | null {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(String(value));
    return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export async function loadSessionWorkAggregate(sessionId: string): Promise<SessionWorkAggregate> {
    const result = await db.execute(sql`
        select
            coalesce((
                select count(*)::int
                from ${recordingArtifacts} ra
                where ra.session_id = s.id
                  and ra.kind = 'screenshots'
                  and ra.status = 'ready'
            ), 0) as "readyScreenshotCount",
            coalesce((
                select sum(coalesce(ra.size_bytes, ra.declared_size_bytes, 0))::bigint
                from ${recordingArtifacts} ra
                where ra.session_id = s.id
                  and ra.kind = 'screenshots'
                  and ra.status = 'ready'
            ), 0) as "readyScreenshotBytes",
            coalesce((
                select count(*)::int
                from ${recordingArtifacts} ra
                where ra.session_id = s.id
                  and ra.kind = 'rrweb'
                  and ra.status = 'ready'
            ), 0) as "readyWebReplayCount",
            coalesce((
                select sum(coalesce(ra.size_bytes, ra.declared_size_bytes, 0))::bigint
                from ${recordingArtifacts} ra
                where ra.session_id = s.id
                  and ra.kind = 'rrweb'
                  and ra.status = 'ready'
            ), 0) as "readyWebReplayBytes",
            coalesce((
                select count(*)::int
                from ${recordingArtifacts} ra
                where ra.session_id = s.id
                  and ra.kind = 'hierarchy'
                  and ra.status = 'ready'
            ), 0) as "readyHierarchyCount",
            coalesce((
                select count(*)::int
                from ${recordingArtifacts} ra
                where ra.session_id = s.id
                  and ra.status in ('pending', 'buffered', 'uploaded')
            ), 0) as "openArtifactCount",
            coalesce((
                select count(*)::int
                from ${recordingArtifacts} ra
                where ra.session_id = s.id
                  and ra.status = 'uploaded'
            ), 0) as "activeJobCount",
            coalesce((
                select count(*)::int
                from ${recordingArtifacts} ra
                where ra.session_id = s.id
                  and ra.kind in ('screenshots', 'hierarchy', 'rrweb')
                  and ra.status in ('pending', 'buffered', 'uploaded')
            ), 0) as "openReplayArtifactCount",
            coalesce((
                select count(*)::int
                from ${recordingArtifacts} ra
                where ra.session_id = s.id
                  and ra.kind in ('screenshots', 'hierarchy', 'rrweb')
                  and ra.status = 'uploaded'
            ), 0) as "activeReplayJobCount",
            (
                select max(ra.end_time)
                from ${recordingArtifacts} ra
                where ra.session_id = s.id
                  and ra.kind in ('screenshots', 'hierarchy', 'rrweb')
            ) as "latestReplayArtifactEndMs",
            (
                select max(coalesce(ra.end_time, ra.timestamp))
                from ${recordingArtifacts} ra
                where ra.session_id = s.id
                  and ra.kind = 'events'
                  and ra.status = 'ready'
            ) as "latestEventArtifactEndMs",
            coalesce((
                select count(*)::int
                from ${recordingArtifacts} ra
                where ra.session_id = s.id
                  and ra.kind = 'events'
                  and ra.status = 'ready'
                  and (ra.start_time is null or ra.end_time is null)
            ), 0) as "readyEventArtifactMissingDerivedCount",
            (
                select max(coalesce(ra.ready_at, ra.verified_at, ra.upload_completed_at, ra.created_at))
                from ${recordingArtifacts} ra
                where ra.session_id = s.id
                  and ra.kind in ('screenshots', 'rrweb')
                  and ra.status = 'ready'
            ) as "latestReadyAt",
            coalesce((
                select count(*)::int
                from ${recordingArtifacts} ra
                where ra.session_id = s.id
                  and ra.kind = 'events'
                  and (
                    ra.status in ('buffered', 'uploaded')
                    or (
                        ra.status = 'pending'
                        and ra.created_at > now() - interval '60 seconds'
                    )
                    or (
                        ra.status = 'ready'
                        and (
                            ra.event_rollup_processed_at is null
                            or ra.start_time is null
                            or ra.end_time is null
                        )
                    )
                  )
            ), 0) as "pendingEventEvidenceCount"
        from ${sessions} s
        where s.id = ${sessionId}
    `);

    const row = ((result as any).rows as SessionAggregateRow[] | undefined)?.[0];
    const openArtifactCount = toFiniteNumber(row?.openArtifactCount) ?? 0;
    const activeJobCount = toFiniteNumber(row?.activeJobCount) ?? 0;
    const openReplayArtifactCount = toFiniteNumber(row?.openReplayArtifactCount) ?? 0;
    const activeReplayJobCount = toFiniteNumber(row?.activeReplayJobCount) ?? 0;
    const readyEventArtifactMissingDerivedCount = toFiniteNumber(row?.readyEventArtifactMissingDerivedCount) ?? 0;

    const hasPendingProcessingWork =
        activeJobCount > 0
        || openReplayArtifactCount > 0
        || activeReplayJobCount > 0
        || readyEventArtifactMissingDerivedCount > 0;

    return {
        readyScreenshotCount: toFiniteNumber(row?.readyScreenshotCount) ?? 0,
        readyScreenshotBytes: toFiniteNumber(row?.readyScreenshotBytes) ?? 0,
        readyWebReplayCount: toFiniteNumber(row?.readyWebReplayCount) ?? 0,
        readyWebReplayBytes: toFiniteNumber(row?.readyWebReplayBytes) ?? 0,
        readyHierarchyCount: toFiniteNumber(row?.readyHierarchyCount) ?? 0,
        openArtifactCount,
        activeJobCount,
        openReplayArtifactCount,
        activeReplayJobCount,
        latestReplayArtifactEndMs: toFiniteNumber(row?.latestReplayArtifactEndMs),
        latestEventArtifactEndMs: toFiniteNumber(row?.latestEventArtifactEndMs),
        latestReadyAt: toDateOrNull(row?.latestReadyAt),
        pendingEventEvidenceCount: toFiniteNumber(row?.pendingEventEvidenceCount) ?? 0,
        readyEventArtifactMissingDerivedCount,
        hasPendingProcessingWork,
        hasPendingWork: openArtifactCount > 0 || activeJobCount > 0 || readyEventArtifactMissingDerivedCount > 0,
        hasPendingReplayWork: openReplayArtifactCount > 0 || activeReplayJobCount > 0,
    };
}

export function deriveSessionEvidenceState(input: {
    aggregate: SessionWorkAggregate;
    finalizationIdleMs?: number;
    now?: Date;
    session: EvidenceSession;
    successorStartedAt?: Date | null;
}): SessionEvidenceState {
    const now = input.now ?? new Date();
    const finalizationIdleMs = input.finalizationIdleMs ?? SESSION_LIVE_INGEST_WINDOW_MS;
    const { aggregate, session } = input;
    const latestClientEvidenceEndMs = Math.max(
        Number(aggregate.latestReplayArtifactEndMs ?? 0),
        Number(aggregate.latestEventArtifactEndMs ?? 0),
    ) || null;
    const supersededByNewerVisitorSession = shouldApplySuccessorSessionCap({
        platform: session.platform,
        successorStartedAt: input.successorStartedAt ?? null,
        latestClientEvidenceEndMs,
    });
    const lastIngestActivityAt = toDateOrNull(session.lastIngestActivityAt) ?? session.startedAt;
    const lastIngestActivityMs = lastIngestActivityAt.getTime();
    const smartCaptureEvidenceSettled = (
        Boolean(session.endedAt)
        || supersededByNewerVisitorSession
        || !Number.isFinite(lastIngestActivityMs)
        || lastIngestActivityMs <= now.getTime() - finalizationIdleMs
    ) && aggregate.pendingEventEvidenceCount === 0;

    return {
        ...aggregate,
        hasReplayArtifacts: aggregate.readyScreenshotCount > 0 || aggregate.readyWebReplayCount > 0,
        latestClientEvidenceEndMs,
        smartCaptureEvidenceSettled,
        supersededByNewerVisitorSession,
    };
}
