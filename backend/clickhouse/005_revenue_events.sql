CREATE TABLE IF NOT EXISTS rejourney.revenue_events
(
    project_id UUID,
    provider LowCardinality(String),
    event_date Date,
    event_time DateTime64(3, 'UTC'),
    external_transaction_id String,
    external_source_id String,
    session_id String,
    visitor_id String,
    user_display_id String,
    anonymous_hash String,
    anonymous_display_id String,
    device_id String,
    platform LowCardinality(String),
    app_version LowCardinality(String),
    event_name LowCardinality(String),
    currency LowCardinality(String),
    amount_cents Int64,
    gross_amount_cents Int64,
    refund_amount_cents Int64,
    fee_cents Int64,
    net_cents Int64,
    type LowCardinality(String),
    reporting_category LowCardinality(String),
    metadata_json String,
    is_deleted UInt8 DEFAULT 0,
    schema_version UInt16 DEFAULT 1,
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3),
    inserted_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(event_date)
ORDER BY (project_id, provider, event_date, external_transaction_id)
TTL event_date + INTERVAL 1095 DAY DELETE
SETTINGS index_granularity = 8192;
