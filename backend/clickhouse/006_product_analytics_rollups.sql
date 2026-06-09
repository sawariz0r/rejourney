CREATE TABLE IF NOT EXISTS rejourney.app_daily_rollups
(
    project_id UUID,
    date Date,
    total_sessions UInt64,
    completed_sessions UInt64,
    avg_duration_seconds Nullable(Float64),
    avg_interaction_score Nullable(Float64),
    avg_ux_score Nullable(Float64),
    avg_api_error_rate Nullable(Float64),
    avg_api_response_ms Nullable(Float64),
    p50_duration Nullable(Float64),
    p90_duration Nullable(Float64),
    p50_interaction_score Nullable(Float64),
    p90_interaction_score Nullable(Float64),
    total_errors UInt64,
    total_rage_taps UInt64,
    total_dead_taps UInt64,
    total_crashes UInt64,
    total_anrs UInt64,
    total_bouncers UInt64,
    total_casuals UInt64,
    total_explorers UInt64,
    total_loyalists UInt64,
    total_touches UInt64,
    total_scrolls UInt64,
    total_gestures UInt64,
    total_interactions UInt64,
    unique_user_count UInt64,
    source LowCardinality(String),
    schema_version UInt16 DEFAULT 1,
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date)
ORDER BY (project_id, date);

CREATE TABLE IF NOT EXISTS rejourney.app_dimension_daily_rollups
(
    project_id UUID,
    date Date,
    dimension_type LowCardinality(String),
    dimension_value String,
    count UInt64,
    source LowCardinality(String),
    schema_version UInt16 DEFAULT 1,
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date)
ORDER BY (project_id, date, dimension_type, dimension_value);

CREATE TABLE IF NOT EXISTS rejourney.screen_touch_heatmap_daily_rollups
(
    project_id UUID,
    date Date,
    screen_name String,
    event_kind LowCardinality(String),
    bucket_x UInt16,
    bucket_y UInt16,
    bucket_count UInt64,
    screen_first_seen_ms UInt64,
    page_width UInt32,
    page_height UInt32,
    viewport_width UInt32,
    viewport_height UInt32,
    source LowCardinality(String),
    schema_version UInt16 DEFAULT 1,
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = SummingMergeTree((bucket_count))
PARTITION BY toYYYYMM(date)
ORDER BY (
    project_id,
    date,
    screen_name,
    event_kind,
    bucket_x,
    bucket_y,
    page_width,
    page_height,
    viewport_width,
    viewport_height
);

CREATE TABLE IF NOT EXISTS rejourney.device_usage_daily_rollups
(
    project_id UUID,
    period Date,
    bytes_uploaded UInt64,
    minutes_recorded UInt64,
    sessions_started UInt64,
    request_count UInt64,
    source LowCardinality(String),
    schema_version UInt16 DEFAULT 1,
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = SummingMergeTree((bytes_uploaded, minutes_recorded, sessions_started, request_count))
PARTITION BY toYYYYMM(period)
ORDER BY (project_id, period);
