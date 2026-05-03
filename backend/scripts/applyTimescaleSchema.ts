/**
 * Applies pending TimescaleDB migrations from backend/drizzle/timescale/.
 * Mirrors applyDatabaseSchema.ts but targets the TimescaleDB cluster.
 *
 * - TIMESCALE_URL not set → skip silently (exit 0). Safe before Phase 1 SSH.
 * - TIMESCALE_URL set but unreachable → warn and exit 0. Does not fail db-setup.
 * - Fresh DB → applies all migrations in order, stamps _ts_migrations table.
 * - Existing DB → applies only unapplied migrations by hash comparison.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const MIGRATIONS_TABLE = '_ts_migrations';
const CONNECT_TIMEOUT_MS = 10_000;

function formatToMillis(dateStr: string): number {
    const year  = parseInt(dateStr.slice(0, 4),  10);
    const month = parseInt(dateStr.slice(4, 6),  10) - 1;
    const day   = parseInt(dateStr.slice(6, 8),  10);
    const hour  = parseInt(dateStr.slice(8, 10), 10);
    const min   = parseInt(dateStr.slice(10, 12), 10);
    const sec   = parseInt(dateStr.slice(12, 14), 10);
    return Date.UTC(year, month, day, hour, min, sec);
}

type MigrationMeta = {
    folder: string;
    sql: string;
    hash: string;
    folderMillis: number;
};

function listMigrations(migrationsFolder: string): MigrationMeta[] {
    if (!existsSync(migrationsFolder)) {
        console.log(`[applyTimescaleSchema] Migrations folder not found: ${migrationsFolder} — nothing to apply.`);
        return [];
    }

    const entries = readdirSync(migrationsFolder, { withFileTypes: true });
    const metas: MigrationMeta[] = [];

    for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const folder = ent.name;
        const sqlPath = join(migrationsFolder, folder, 'migration.sql');
        if (!existsSync(sqlPath)) continue;

        const migrationDate = folder.slice(0, 14);
        if (!/^\d{14}$/.test(migrationDate)) {
            throw new Error(`Invalid TS migration folder name (expected timestamp prefix): ${folder}`);
        }

        const sql = readFileSync(sqlPath, 'utf8');
        const hash = createHash('sha256').update(sql).digest('hex');
        metas.push({ folder, sql, hash, folderMillis: formatToMillis(migrationDate) });
    }

    metas.sort((a, b) => a.folder.localeCompare(b.folder));
    return metas;
}

async function getAppliedHashes(client: pg.PoolClient): Promise<Set<string>> {
    await client.query(`
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
            id         SERIAL  PRIMARY KEY,
            hash       TEXT    NOT NULL,
            folder     TEXT    NOT NULL,
            created_at BIGINT  NOT NULL
        )
    `);
    const result = await client.query<{ hash: string }>(`SELECT hash FROM ${MIGRATIONS_TABLE}`);
    return new Set(result.rows.map(r => r.hash));
}

async function main(): Promise<void> {
    const timescaleUrl = process.env.TIMESCALE_URL;
    if (!timescaleUrl) {
        console.log('[applyTimescaleSchema] TIMESCALE_URL not set — skipping TimescaleDB schema setup.');
        return;
    }

    const migrationsFolder = join(process.cwd(), 'drizzle', 'timescale');
    const migrations = listMigrations(migrationsFolder);
    if (migrations.length === 0) return;

    const pool = new pg.Pool({
        connectionString: timescaleUrl,
        max: 1,
        connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
        idleTimeoutMillis: 5_000,
    });

    let client: pg.PoolClient;
    try {
        client = await pool.connect();
    } catch (err) {
        console.warn(
            '[applyTimescaleSchema] Could not connect to TimescaleDB — skipping schema setup.',
            err instanceof Error ? err.message : String(err),
        );
        await pool.end();
        return;
    }

    try {
        const appliedHashes = await getAppliedHashes(client);
        let applied = 0;

        for (const migration of migrations) {
            if (appliedHashes.has(migration.hash)) continue;

            console.log(`[applyTimescaleSchema] Applying: ${migration.folder}`);
            await client.query(migration.sql);
            await client.query(
                `INSERT INTO ${MIGRATIONS_TABLE} (hash, folder, created_at) VALUES ($1, $2, $3)`,
                [migration.hash, migration.folder, migration.folderMillis],
            );
            applied++;
            console.log(`[applyTimescaleSchema] Applied:  ${migration.folder}`);
        }

        if (applied === 0) {
            console.log('[applyTimescaleSchema] TimescaleDB schema is up to date.');
        } else {
            console.log(`[applyTimescaleSchema] Applied ${applied} TimescaleDB migration(s).`);
        }
    } finally {
        client!.release();
        await pool.end();
    }
}

main().catch(err => {
    console.error('[applyTimescaleSchema] Fatal:', err);
    process.exit(1);
});
