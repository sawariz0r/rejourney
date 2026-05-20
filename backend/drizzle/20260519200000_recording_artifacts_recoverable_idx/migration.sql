-- Partial index for queueRecoverableArtifacts (sessionLifecycleWorker runs every 10s).
-- Without this, the query does a full sort of the 33GB recording_artifacts table,
-- spilling hundreds of GB of temp files that can fill the node disk.
CREATE INDEX "recording_artifacts_recoverable_idx"
    ON "recording_artifacts" ("created_at" DESC)
    WHERE "status" = 'ready'
      AND "kind" = 'events'
      AND ("start_time" IS NULL OR "end_time" IS NULL);
