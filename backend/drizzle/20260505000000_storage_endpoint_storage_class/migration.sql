-- Add optional storage_class column to storage_endpoints.
-- NULL means no StorageClass header is sent (provider default).
-- Set to e.g. 'ONEZONE_IA' for Scaleway single-zone Amsterdam.
ALTER TABLE storage_endpoints ADD COLUMN storage_class varchar(64);
