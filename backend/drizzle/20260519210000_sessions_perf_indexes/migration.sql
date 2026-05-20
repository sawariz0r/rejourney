-- Retention worker: queries sessions WHERE status IN ('ready','completed')
-- AND recording_deleted = false AND retention_tier = N AND started_at < cutoff.
-- The existing sessions_retention_eligible_idx excludes status='completed' in its
-- WHERE clause, so the retention query falls back to sessions_status_idx and scans
-- all ready+completed rows (~300K) before filtering on retention_tier/started_at.
CREATE INDEX "sessions_retention_due_idx"
    ON "sessions" ("retention_tier", "started_at", "id")
    WHERE "recording_deleted" = false
      AND "status" IN ('ready', 'completed');

-- sessionArtifactPurge: selectDistinct query filters sessions WHERE
-- recording_deleted = true OR is_replay_expired = true, then joins recording_artifacts.
-- No index covers this OR predicate — falls back to sessions_seed_started_at_idx
-- and scans ~438K rows to find the small subset needing artifact deletion.
CREATE INDEX "sessions_artifact_deletion_idx"
    ON "sessions" ("started_at", "id")
    WHERE "recording_deleted" = true OR "is_replay_expired" = true;

-- sessionReconciliation: finds stale processing/pending sessions by
-- last_ingest_activity_at <= cutoff. sessions_status_idx covers the status filter
-- but there is no index on last_ingest_activity_at to avoid the post-filter sort.
CREATE INDEX "sessions_reconciliation_activity_idx"
    ON "sessions" ("last_ingest_activity_at")
    WHERE "status" IN ('processing', 'pending');
