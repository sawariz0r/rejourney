-- queueRecoverableArtifacts (sessionLifecycleWorker, every 10s) runs two queries:
--   SELECT ... FROM recording_artifacts JOIN sessions WHERE status = 'uploaded' LIMIT 100
--   SELECT ... FROM recording_artifacts JOIN sessions WHERE status = 'buffered' LIMIT 100
--
-- Neither has a partial index. The existing recording_artifacts_session_status_idx is
-- (session_id, status) — finding all rows with a given status requires a full skip-scan
-- (264+ index probes, 57K buffer reads, ~168ms each). Both queries run 5000+ times/day.
--
-- 'uploaded' = artifact bytes received, waiting for ingest worker to process.
-- 'buffered'  = artifact in edge-node buffer, waiting for flush-to-S3.
-- Both are transient states that should have at most a few hundred rows at any time.
-- A partial index on each makes the scan a tiny targeted seek instead of a full skip-scan.

CREATE INDEX "recording_artifacts_uploaded_idx"
    ON "recording_artifacts" ("created_at")
    WHERE "status" = 'uploaded';

CREATE INDEX "recording_artifacts_buffered_idx"
    ON "recording_artifacts" ("created_at")
    WHERE "status" = 'buffered';
