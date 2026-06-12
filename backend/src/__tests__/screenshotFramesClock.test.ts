import { describe, expect, it, vi } from 'vitest';
import { gzipSync } from 'zlib';

vi.mock('drizzle-orm', () => ({
    and: vi.fn(),
    eq: vi.fn(),
}));

vi.mock('../db/client.js', () => ({
    db: {},
    recordingArtifacts: {},
    sessions: {},
}));

vi.mock('../db/redis.js', () => ({
    getRedis: vi.fn(() => ({
        del: vi.fn(),
        get: vi.fn(),
        setex: vi.fn(),
    })),
}));

vi.mock('../db/s3.js', () => ({
    downloadFromS3ForArtifact: vi.fn(),
    getSignedDownloadUrl: vi.fn(),
    getSignedDownloadUrlForProject: vi.fn(),
    uploadToS3ForArtifact: vi.fn(),
}));

vi.mock('../logger.js', () => ({
    logger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

import {
    extractFramesFromArchive,
    normalizeScreenshotArchiveClockFields,
} from '../services/screenshotFrames.js';

function tarHeader(name: string, size: number): Buffer {
    const header = Buffer.alloc(512, 0);
    header.write(name, 0, 100, 'utf8');
    header.write('0000777\0', 100, 8, 'ascii');
    header.write('0000000\0', 108, 8, 'ascii');
    header.write('0000000\0', 116, 8, 'ascii');
    header.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
    header.write('00000000000\0', 136, 12, 'ascii');
    header.fill(0x20, 148, 156);
    header[156] = '0'.charCodeAt(0);

    let checksum = 0;
    for (const byte of header) checksum += byte;
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
    return header;
}

function tarGzipFile(name: string, data: Buffer): Buffer {
    const padding = Buffer.alloc((512 - (data.length % 512)) % 512, 0);
    const end = Buffer.alloc(1024, 0);
    return gzipSync(Buffer.concat([tarHeader(name, data.length), data, padding, end]));
}

function androidBinaryGzipFrame(timestampOffsetMs: number, data: Buffer): Buffer {
    const header = Buffer.alloc(12);
    const high = Math.floor(timestampOffsetMs / 0x100000000);
    const low = timestampOffsetMs >>> 0;
    header.writeUInt32BE(high, 0);
    header.writeUInt32BE(low, 4);
    header.writeUInt32BE(data.length, 8);
    return gzipSync(Buffer.concat([header, data]));
}

describe('screenshot frame clock normalization', () => {
    const rawSessionStartMs = Date.UTC(2026, 5, 27, 12, 15, 14, 606);
    const normalizedSessionStartMs = Date.UTC(2026, 5, 12, 18, 0, 0, 0);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

    it('maps legacy relative frame filenames onto the normalized session start', async () => {
        const archive = tarGzipFile(`${rawSessionStartMs}_1_500.jpeg`, jpeg);

        const frames = await extractFramesFromArchive(archive, normalizedSessionStartMs);

        expect(frames).toHaveLength(1);
        expect(frames[0].timestamp).toBe(normalizedSessionStartMs + 500);
    });

    it('maps legacy absolute frame filenames by the filename session epoch delta', async () => {
        const archive = tarGzipFile(`${rawSessionStartMs}_1_${rawSessionStartMs + 750}.jpeg`, jpeg);

        const frames = await extractFramesFromArchive(archive, normalizedSessionStartMs);

        expect(frames).toHaveLength(1);
        expect(frames[0].timestamp).toBe(normalizedSessionStartMs + 750);
    });

    it('rewrites legacy relative screenshot archive frame filenames in the stored object body', async () => {
        const archive = tarGzipFile(`${rawSessionStartMs}_1_500.jpeg`, jpeg);

        const normalized = normalizeScreenshotArchiveClockFields(archive, normalizedSessionStartMs, {
            s3Key: 'tenant/t/project/p/sessions/s/screenshots/segment.tar.gz',
        });
        const frames = await extractFramesFromArchive(normalized.data, normalizedSessionStartMs);

        expect(normalized.normalized).toBe(true);
        expect(normalized.normalizedFrameNameCount).toBe(1);
        expect(frames[0].filename).toBe(`${normalizedSessionStartMs}_1_500.jpeg`);
        expect(frames[0].timestamp).toBe(normalizedSessionStartMs + 500);
    });

    it('rewrites legacy absolute screenshot archive frame filenames in the stored object body', async () => {
        const archive = tarGzipFile(`${rawSessionStartMs}_1_${rawSessionStartMs + 750}.jpeg`, jpeg);

        const normalized = normalizeScreenshotArchiveClockFields(archive, normalizedSessionStartMs, {
            s3Key: 'tenant/t/project/p/sessions/s/screenshots/segment.tar.gz',
        });
        const frames = await extractFramesFromArchive(normalized.data, normalizedSessionStartMs);

        expect(normalized.normalized).toBe(true);
        expect(normalized.normalizedFrameNameCount).toBe(1);
        expect(frames[0].filename).toBe(`${normalizedSessionStartMs}_1_${normalizedSessionStartMs + 750}.jpeg`);
        expect(frames[0].timestamp).toBe(normalizedSessionStartMs + 750);
    });

    it('does not rewrite Android binary screenshot bundles because they already store offsets', () => {
        const archive = androidBinaryGzipFrame(500, jpeg);

        const normalized = normalizeScreenshotArchiveClockFields(archive, normalizedSessionStartMs, {
            s3Key: 'tenant/t/project/p/sessions/s/screenshots/segment.bin.gz',
        });

        expect(normalized.normalized).toBe(false);
        expect(normalized.data).toEqual(archive);
    });
});
