-- Defensive covering index for any query of the shape:
--   SELECT ... FROM sessions WHERE project_id = $1 AND started_at > NOW() - INTERVAL $2 AND status = $3
-- or the COUNT(*) FILTER variant that uses the same columns.
--
-- The existing sessions_project_started_idx covers (project_id, started_at) but not status.
-- With 1.19M sessions on the top project, a status post-filter still scans the full
-- project window. Adding status as a third column makes the scan stop as soon as the
-- status predicate changes, reducing reads by an order of magnitude for the common
-- "ready sessions in last 30 days" shape.
--
-- Does NOT replace sessions_project_started_idx — other queries use it without status.
CREATE INDEX "sessions_project_started_status_idx"
    ON "sessions" ("project_id", "started_at", "status");
