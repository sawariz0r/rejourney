import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { storageEndpoints } from '../src/db/schema.js';
import { safeEncrypt } from '../src/services/crypto.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function getLogPrefix(): string {
  return process.env.STORAGE_SYNC_LABEL || 'storage-sync';
}

async function main() {
  const endpointUrl = normalizeUrl(requireEnv('S3_ENDPOINT'));
  const bucket = requireEnv('S3_BUCKET');
  const region = process.env.S3_REGION || 'us-east-1';
  const accessKeyId = requireEnv('S3_ACCESS_KEY_ID');
  const secretAccessKey = requireEnv('S3_SECRET_ACCESS_KEY');
  const logPrefix = getLogPrefix();

  const keyRef = safeEncrypt(secretAccessKey);

  const endpointData = {
    endpointUrl,
    bucket,
    region,
    accessKeyId,
    keyRef,
    active: true,
    shadow: false,
  };

  // Only touch the row that matches this exact endpoint URL + is a global default.
  // Never update rows for other endpoints — those are managed via manage-s3-endpoints.mjs.
  const [existing] = await db
    .select({ id: storageEndpoints.id })
    .from(storageEndpoints)
    .where(and(
      isNull(storageEndpoints.projectId),
      eq(storageEndpoints.endpointUrl, endpointUrl),
      eq(storageEndpoints.shadow, false),
    ))
    .limit(1);

  if (!existing) {
    await db.insert(storageEndpoints).values({
      projectId: null,
      priority: 0,
      ...endpointData,
    });
    console.log(`[${logPrefix}] Inserted storage endpoint: ${endpointUrl} (${bucket})`);
    return;
  }

  await db
    .update(storageEndpoints)
    .set(endpointData)
    .where(eq(storageEndpoints.id, existing.id));

  console.log(`[${logPrefix}] Synced storage endpoint: ${endpointUrl} (${bucket})`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(`[${getLogPrefix()}] Failed to sync storage endpoints:`, error);
    process.exit(1);
  });
