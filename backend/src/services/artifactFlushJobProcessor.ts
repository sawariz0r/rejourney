import { deleteArtifactBuffer, getArtifactBuffer } from '../db/redis.js';
import { uploadBytesToS3ForArtifact } from '../db/s3.js';
import { logger } from '../logger.js';
import {
    markArtifactBufferLost,
    markArtifactUploadStored,
} from './ingestArtifactLifecycle.js';
import type { ArtifactFlushJobData, Job } from './artifactBullQueue.js';

export async function processArtifactFlushJobFromBullMQ(
    job: Job<ArtifactFlushJobData>,
): Promise<void> {
    const { artifactId } = job.data;
    if (!artifactId) {
        throw new Error('Artifact flush job missing artifactId');
    }

    const buf = await getArtifactBuffer(artifactId);
    if (!buf) {
        await markArtifactBufferLost({
            artifactId,
            reason: 'redis_buffer_missing',
            errorMsg: 'Buffered artifact payload missing or expired before S3 flush',
        });
        return;
    }

    const uploadResult = await uploadBytesToS3ForArtifact(artifactId, buf);
    if (!uploadResult.success) {
        throw new Error(uploadResult.error ?? 'Failed to flush buffered artifact to S3');
    }

    await markArtifactUploadStored({
        artifactId,
        sizeBytes: buf.byteLength,
        contentType: 'application/octet-stream',
        endpointId: uploadResult.endpointId,
    });
    await deleteArtifactBuffer(artifactId);

    logger.info({
        event: 'artifact.flush_stored',
        artifactId,
        endpointId: uploadResult.endpointId,
        sizeBytes: buf.byteLength,
    }, 'artifact.flush_stored');
}
