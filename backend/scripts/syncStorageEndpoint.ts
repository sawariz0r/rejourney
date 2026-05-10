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

  if (existing) {
    await db
      .update(storageEndpoints)
      .set(endpointData)
      .where(eq(storageEndpoints.id, existing.id));

    console.log(`[${logPrefix}] Synced storage endpoint: ${endpointUrl} (${bucket})`);
    return;
  }

  // No row matches the K8s secret's URL. Before inserting a brand-new active
  // endpoint, refuse to run if another global active endpoint already exists —
  // otherwise we'd silently dual-activate two buckets and split traffic.
  // Switching endpoints must be an intentional, two-step operation:
  //   1. Mark the current active endpoint inactive (UPDATE … SET active=false)
  //   2. THEN update the K8s s3-secret + redeploy
  // Bootstrap case (no active rows yet) is allowed.
  const otherActive = await db
    .select({ id: storageEndpoints.id, endpointUrl: storageEndpoints.endpointUrl, bucket: storageEndpoints.bucket })
    .from(storageEndpoints)
    .where(and(
      isNull(storageEndpoints.projectId),
      eq(storageEndpoints.active, true),
      eq(storageEndpoints.shadow, false),
    ));

  if (otherActive.length > 0) {
    const existingList = otherActive.map((r) => `  - ${r.endpointUrl} (${r.bucket})`).join('\n');
    throw new Error(
      `[${logPrefix}] REFUSING to insert new active endpoint ${endpointUrl} (${bucket}): ` +
      `another global active endpoint already exists. To switch endpoints, first mark ` +
      `the current active endpoint inactive in the DB, then redeploy.\n\n` +
      `Currently active global endpoints:\n${existingList}`,
    );
  }

  await db.insert(storageEndpoints).values({
    projectId: null,
    priority: 0,
    ...endpointData,
  });
  console.log(`[${logPrefix}] Inserted storage endpoint: ${endpointUrl} (${bucket})`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(`[${getLogPrefix()}] Failed to sync storage endpoints:`, error);
    process.exit(1);
  });
