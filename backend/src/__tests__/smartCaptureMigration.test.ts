import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
    resolve(__dirname, '../../drizzle/20260604193000_scale_smart_capture/migration.sql'),
    'utf8'
);
const manualIndexSql = readFileSync(
    resolve(__dirname, '../../drizzle/manual/smart-capture-session-indexes-concurrent.sql'),
    'utf8'
);

describe('scale smart capture migration', () => {
    it('stores shared Smart Capture config on the project record', () => {
        expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS "smart_capture_enabled" boolean DEFAULT false NOT NULL');
        expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS "smart_capture_mode" varchar(32) DEFAULT \'record_all\' NOT NULL');
        expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS "smart_capture_preset" varchar(64) DEFAULT \'none\' NOT NULL');
        expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS "smart_capture_rules" jsonb DEFAULT \'[]\'::jsonb NOT NULL');
        expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS "smart_capture_decision_window_hours" integer DEFAULT 168 NOT NULL');
    });

    it('keeps the deploy migration metadata-only for the hot sessions table', () => {
        expect(migrationSql).toContain("SET lock_timeout = '5s'");
        expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS "replay_retention_state" varchar(32)');
        expect(migrationSql).not.toContain('DEFAULT \'saved\'');
        expect(migrationSql).not.toContain('replay_retention_state" varchar(32) DEFAULT');
        expect(migrationSql).not.toContain('UPDATE "sessions"');
        expect(migrationSql).not.toContain('CREATE INDEX IF NOT EXISTS "sessions_');
    });

    it('keeps session indexes in an out-of-band concurrent script', () => {
        expect(manualIndexSql).toContain('CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_smart_capture_status_started_idx"');
        expect(manualIndexSql).toContain('CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_replay_retention_state_started_idx"');
        expect(manualIndexSql).toContain('CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_archive_saved_replay_idx"');
    });
});
