-- Drop ingest_jobs table.
-- This table was the Postgres-backed poll queue prior to the BullMQ migration.
-- All job dispatch now goes through Redis/BullMQ (rj-ingest-artifacts,
-- rj-replay-artifacts queues). The table had 19.7M rows (99.7% status='done')
-- that were purged via batched DELETE before this migration was applied.
DROP TABLE IF EXISTS ingest_jobs;
