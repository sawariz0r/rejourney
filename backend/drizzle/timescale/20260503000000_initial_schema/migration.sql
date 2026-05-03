CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

CREATE TABLE ts_recording_artifacts (
    artifact_id       TEXT        NOT NULL,
    session_id        TEXT        NOT NULL,
    project_id        TEXT        NOT NULL,
    kind              TEXT        NOT NULL,
    s3_object_key     TEXT        NOT NULL,
    endpoint_id       TEXT        NOT NULL DEFAULT '',
    status            TEXT        NOT NULL DEFAULT 'pending',
    size_bytes        BIGINT      NOT NULL DEFAULT 0,
    frame_count       INT         NOT NULL DEFAULT 0,
    start_time_ms     BIGINT      NOT NULL DEFAULT 0,
    end_time_ms       BIGINT      NOT NULL DEFAULT 0,
    client_upload_id  TEXT        NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ NOT NULL,
    uploaded_at       TIMESTAMPTZ,
    ready_at          TIMESTAMPTZ,
    PRIMARY KEY (artifact_id, created_at)
);

SELECT create_hypertable('ts_recording_artifacts', 'created_at',
    chunk_time_interval => INTERVAL '7 days');

ALTER TABLE ts_recording_artifacts SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'project_id,session_id',
    timescaledb.compress_orderby   = 'created_at DESC');

SELECT add_compression_policy('ts_recording_artifacts', INTERVAL '1 day');

CREATE INDEX ON ts_recording_artifacts (session_id, created_at DESC);
CREATE INDEX ON ts_recording_artifacts (project_id, created_at DESC);

CREATE MATERIALIZED VIEW session_artifact_summary
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
    session_id,
    project_id,
    time_bucket('1 hour', created_at)                                             AS bucket,
    COUNT(*) FILTER (WHERE kind = 'screenshots' AND status = 'ready')             AS ready_screenshot_count,
    SUM(size_bytes) FILTER (WHERE kind = 'screenshots' AND status = 'ready')      AS ready_screenshot_bytes,
    COUNT(*) FILTER (WHERE kind = 'hierarchy'    AND status = 'ready')            AS ready_hierarchy_count,
    COUNT(*) FILTER (WHERE status IN ('pending', 'uploaded'))                     AS open_artifact_count,
    COUNT(*) FILTER (WHERE kind IN ('screenshots', 'hierarchy')
                      AND  status IN ('pending', 'uploaded'))                     AS open_replay_count,
    MAX(end_time_ms) FILTER (WHERE kind = 'screenshots')                          AS latest_replay_end_ms
FROM ts_recording_artifacts
GROUP BY session_id, project_id, time_bucket('1 hour', created_at)
WITH NO DATA;

SELECT add_continuous_aggregate_policy('session_artifact_summary',
    start_offset      => INTERVAL '2 hours',
    end_offset        => INTERVAL '10 minutes',
    schedule_interval => INTERVAL '10 minutes');
