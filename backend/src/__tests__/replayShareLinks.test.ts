import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const replayShareLinks = {
        id: 'id',
        publicId: 'publicId',
        sessionId: 'sessionId',
        projectId: 'projectId',
        teamId: 'teamId',
        visibility: 'visibility',
        expirationPreset: 'expirationPreset',
        expiresAt: 'expiresAt',
        revokedAt: 'revokedAt',
        lastAccessedAt: 'lastAccessedAt',
        accessCount: 'accessCount',
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
    };

    return {
        db: {
            select: vi.fn(),
            insert: vi.fn(),
            update: vi.fn(),
        },
        replayShareLinks,
    };
});

vi.mock('../config.js', () => ({
    config: {
        SHARE_LINK_SECRET: 'test_share_link_secret_value_32_bytes_minimum',
        JWT_SECRET: 'test_jwt_secret_value_32_bytes_minimum',
    },
    isProduction: false,
}));

vi.mock('../db/client.js', () => ({
    db: mocks.db,
    replayShareLinks: mocks.replayShareLinks,
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    desc: vi.fn((column: unknown) => ({ op: 'desc', column })),
    eq: vi.fn((left: unknown, right: unknown) => ({ op: 'eq', left, right })),
    gt: vi.fn((left: unknown, right: unknown) => ({ op: 'gt', left, right })),
    isNull: vi.fn((value: unknown) => ({ op: 'isNull', value })),
    or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}));

import {
    buildReplayShareToken,
    buildReplayShareUrl,
    calculateReplayShareExpiresAt,
    createOrReuseReplayShareLink,
    isReplayShareLinkActive,
    resolveReplayShareLink,
    verifyReplayShareToken,
    type ReplayShareLinkRow,
} from '../services/replayShareLinks.js';

function makeReplayShareRow(overrides: Partial<ReplayShareLinkRow> = {}): ReplayShareLinkRow {
    const now = new Date('2026-06-03T12:00:00.000Z');
    return {
        id: 'share-1',
        publicId: 'public_1234567890',
        sessionId: 'session-1',
        projectId: 'project-1',
        teamId: 'team-1',
        createdByUserId: 'user-1',
        visibility: 'replay_only',
        expirationPreset: '7d',
        expiresAt: new Date('2026-06-10T12:00:00.000Z'),
        revokedAt: null,
        lastAccessedAt: null,
        accessCount: 0,
        createdAt: now,
        updatedAt: now,
        ...overrides,
    } as ReplayShareLinkRow;
}

function selectLimitRows(rows: ReplayShareLinkRow[]) {
    const chain = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(async () => rows),
    };
    return chain;
}

function insertReturningRows(rows: ReplayShareLinkRow[]) {
    const chain = {
        values: vi.fn(() => chain),
        returning: vi.fn(async () => rows),
    };
    return chain;
}

describe('replayShareLinks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('builds and verifies high-entropy unlisted replay tokens', () => {
        const token = buildReplayShareToken('public_1234567890');

        expect(token).toMatch(/^rps_public_1234567890\.[A-Za-z0-9_-]+$/);
        expect(token).not.toContain('session-1');
        expect(verifyReplayShareToken(token)).toEqual({ publicId: 'public_1234567890' });
    });

    it('rejects tampered tokens before any database lookup', async () => {
        const token = buildReplayShareToken('public_1234567890');
        const tampered = token.replace('public_1234567890', 'public_1234567891');

        expect(verifyReplayShareToken(tampered)).toBeNull();
        await expect(resolveReplayShareLink(tampered)).resolves.toBeNull();
        expect(mocks.db.select).not.toHaveBeenCalled();
    });

    it('calculates expiration presets and treats never as no expiry', () => {
        const now = new Date('2026-06-03T12:00:00.000Z');

        expect(calculateReplayShareExpiresAt('24h', now)?.toISOString()).toBe('2026-06-04T12:00:00.000Z');
        expect(calculateReplayShareExpiresAt('7d', now)?.toISOString()).toBe('2026-06-10T12:00:00.000Z');
        expect(calculateReplayShareExpiresAt('30d', now)?.toISOString()).toBe('2026-07-03T12:00:00.000Z');
        expect(calculateReplayShareExpiresAt('90d', now)?.toISOString()).toBe('2026-09-01T12:00:00.000Z');
        expect(calculateReplayShareExpiresAt('never', now)).toBeNull();
    });

    it('marks expired and revoked links inactive', () => {
        const now = new Date('2026-06-03T12:00:00.000Z');

        expect(isReplayShareLinkActive(makeReplayShareRow({ expiresAt: null }), now)).toBe(true);
        expect(isReplayShareLinkActive(makeReplayShareRow({ expiresAt: new Date('2026-06-03T12:00:01.000Z') }), now)).toBe(true);
        expect(isReplayShareLinkActive(makeReplayShareRow({ expiresAt: new Date('2026-06-03T11:59:59.000Z') }), now)).toBe(false);
        expect(isReplayShareLinkActive(makeReplayShareRow({ revokedAt: now }), now)).toBe(false);
    });

    it('resolves only active links for valid tokens', async () => {
        const activeRow = makeReplayShareRow({ publicId: 'public_1234567890' });
        mocks.db.select.mockReturnValueOnce(selectLimitRows([activeRow]));

        await expect(resolveReplayShareLink(buildReplayShareToken(activeRow.publicId))).resolves.toEqual(activeRow);

        const expiredRow = makeReplayShareRow({
            publicId: 'public_1234567890',
            expiresAt: new Date('2026-06-03T00:00:00.000Z'),
        });
        mocks.db.select.mockReturnValueOnce(selectLimitRows([expiredRow]));

        await expect(resolveReplayShareLink(buildReplayShareToken(expiredRow.publicId))).resolves.toBeNull();
    });

    it('reuses an active link with the same session, visibility, and expiration preset', async () => {
        const existing = makeReplayShareRow();
        mocks.db.select.mockReturnValueOnce(selectLimitRows([existing]));

        const result = await createOrReuseReplayShareLink({
            sessionId: existing.sessionId,
            projectId: existing.projectId,
            teamId: existing.teamId,
            createdByUserId: 'user-2',
            visibility: 'replay_only',
            expirationPreset: '7d',
            now: new Date('2026-06-03T12:00:00.000Z'),
        });

        expect(result).toEqual({ link: existing, reused: true });
        expect(mocks.db.insert).not.toHaveBeenCalled();
    });

    it('creates a new link when there is no reusable active link', async () => {
        const created = makeReplayShareRow({ publicId: 'created_public_id' });
        mocks.db.select.mockReturnValueOnce(selectLimitRows([]));
        mocks.db.insert.mockReturnValueOnce(insertReturningRows([created]));

        const result = await createOrReuseReplayShareLink({
            sessionId: created.sessionId,
            projectId: created.projectId,
            teamId: created.teamId,
            createdByUserId: 'user-2',
            visibility: 'full_workbench',
            expirationPreset: 'never',
            now: new Date('2026-06-03T12:00:00.000Z'),
        });

        expect(result).toEqual({ link: created, reused: false });
        expect(mocks.db.insert).toHaveBeenCalledWith(mocks.replayShareLinks);
    });

    it('builds public share URLs from the root origin', () => {
        expect(buildReplayShareUrl('https://rejourney.co/', 'public_1234567890'))
            .toMatch(/^https:\/\/rejourney\.co\/share\/replay\/rps_public_1234567890\./);
    });
});
