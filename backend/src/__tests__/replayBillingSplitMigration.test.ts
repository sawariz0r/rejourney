import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
    resolve(__dirname, '../../drizzle/20260601130000_replay_usage_split/migration.sql'),
    'utf8'
);
const quotaCheckSource = readFileSync(
    resolve(__dirname, '../services/quotaCheck.ts'),
    'utf8'
);

describe('replay billing split migration', () => {
    it('adds replay usage columns and the replay quota counted marker', () => {
        expect(migrationSql).toContain("SET lock_timeout = '5s'");
        expect(migrationSql).toContain('ALTER TABLE "project_usage"');
        expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS "session_replays" integer DEFAULT 0 NOT NULL');
        expect(migrationSql).toContain('ALTER TABLE "billing_usage"');
        expect(migrationSql).toContain('ALTER TABLE "sessions"');
        expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS "replay_quota_counted_at" timestamp');
        expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS "billing_cutovers"');
    });

    it('preserves existing session usage into replay usage without lowering usage', () => {
        expect(migrationSql).toMatch(/UPDATE "project_usage"\s+SET "session_replays" = "sessions"\s+WHERE "session_replays" = 0\s+AND "sessions" <> 0;/);
        expect(migrationSql).toMatch(/UPDATE "billing_usage"\s+SET "session_replays" = "sessions"\s+WHERE "session_replays" = 0\s+AND "sessions" <> 0;/);
    });

    it('does not backfill or index the hot sessions table during deploy', () => {
        expect(migrationSql).not.toContain('UPDATE "sessions"');
        expect(migrationSql).not.toContain('sessions_replay_quota_counted_idx');
        expect(migrationSql).toContain("billing_cutovers('replay_usage_split')");
    });

    it('adds keyed warning dedupe without requiring historical duplicates to be deleted', () => {
        expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS "dedupe_key" text');
        expect(migrationSql).toContain("AND \"type\" IN ('warning_80', 'limit_100')");
        expect(migrationSql).toContain('ROW_NUMBER() OVER');
        expect(migrationSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "billing_notifications_dedupe_key_unique"');
    });

    it('keeps replay usage increments paused until the production cutover row exists', () => {
        expect(quotaCheckSource).toContain("REPLAY_USAGE_SPLIT_CUTOVER_NAME = 'replay_usage_split'");
        expect(quotaCheckSource).toContain("to_regclass('public.billing_cutovers')");
        expect(quotaCheckSource).toContain("reason: 'missing_cutover_table'");
        expect(quotaCheckSource).toContain('Replay usage split cutover is not finalized; replay usage increment skipped');
        expect(quotaCheckSource).toContain('row.startedAt < cutover.cutoverAt');
    });
});
