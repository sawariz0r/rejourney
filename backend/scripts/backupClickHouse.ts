import { createClient } from '@clickhouse/client';

function requireEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
}

function optionalEnv(name: string, fallback: string): string {
    return process.env[name]?.trim() || fallback;
}

function quoteClickHouseString(value: string): string {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function quoteIdentifier(value: string): string {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
        throw new Error(`Invalid ClickHouse identifier: ${value}`);
    }
    return `\`${value}\``;
}

function trimSlashes(value: string): string {
    return value.replace(/^\/+|\/+$/g, '');
}

function buildBackupId(): string {
    const explicit = process.env.CLICKHOUSE_BACKUP_ID?.trim();
    if (explicit) {
        if (!/^[A-Za-z0-9._=-]+$/.test(explicit)) {
            throw new Error('CLICKHOUSE_BACKUP_ID may only contain letters, numbers, dot, underscore, equals, or dash');
        }
        return explicit;
    }

    return `rejourney-${new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, 'Z')}`;
}

async function main(): Promise<void> {
    const clickhouseUrl = requireEnv('CLICKHOUSE_URL');
    const clickhouseUser = optionalEnv('CLICKHOUSE_USER', 'rejourney');
    const clickhousePassword = process.env.CLICKHOUSE_PASSWORD ?? '';
    const database = optionalEnv('CLICKHOUSE_DATABASE', 'rejourney');

    const endpoint = requireEnv('BACKUP_S3_ENDPOINT').replace(/\/+$/g, '');
    const bucket = trimSlashes(requireEnv('BACKUP_S3_BUCKET'));
    const prefix = trimSlashes(optionalEnv('CLICKHOUSE_BACKUP_PREFIX', 'clickhouse/rejourney'));
    const accessKeyId = requireEnv('AWS_ACCESS_KEY_ID');
    const secretAccessKey = requireEnv('AWS_SECRET_ACCESS_KEY');
    const backupId = buildBackupId();
    const destination = `${endpoint}/${bucket}/${prefix}/${backupId}`;
    const requestTimeout = Number(process.env.CLICKHOUSE_BACKUP_REQUEST_TIMEOUT_MS || process.env.CLICKHOUSE_REQUEST_TIMEOUT_MS || 3600000);

    const client = createClient({
        url: clickhouseUrl,
        username: clickhouseUser,
        password: clickhousePassword,
        database,
        application: 'rejourney-clickhouse-backup',
        request_timeout: requestTimeout,
    });

    try {
        const query = `
            BACKUP DATABASE ${quoteIdentifier(database)}
            TO S3(
                ${quoteClickHouseString(destination)},
                ${quoteClickHouseString(accessKeyId)},
                ${quoteClickHouseString(secretAccessKey)}
            )
            SETTINGS compression_method = 'zstd'
        `;

        await client.command({
            query,
            clickhouse_settings: {
                log_queries: 0,
                wait_end_of_query: 1,
            },
        });

        console.log(JSON.stringify({
            status: 'created',
            database,
            backupId,
            destination,
        }));
    } finally {
        await client.close();
    }
}

main().catch((error) => {
    console.error('[clickhouse-backup] failed', error instanceof Error ? error.message : error);
    process.exit(1);
});
