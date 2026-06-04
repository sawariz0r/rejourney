import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/redis.js', () => ({
    checkRateLimit: vi.fn(),
    isRedisConnected: vi.fn(() => false),
    getRedis: vi.fn(() => ({ status: 'end' })),
    getRedisDiagnosticsForLog: vi.fn(() => ({ redisStatus: 'end' })),
}));

vi.mock('../logger.js', () => ({
    logger: {
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

import {
    checkInMemoryRateLimit,
    rateLimit,
    resetInMemoryRateLimitFallbacksForTests,
} from '../middleware/rateLimit.js';

function createResponse() {
    const res = {
        set: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
    };
    return res as unknown as Response & typeof res;
}

describe('OTP rate-limit Redis fallback', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
        process.env.NODE_ENV = 'production';
        resetInMemoryRateLimitFallbacksForTests();
    });

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
        resetInMemoryRateLimitFallbacksForTests();
        vi.clearAllMocks();
    });

    it('uses in-memory fallback instead of returning 503 when Redis is unavailable', async () => {
        const middleware = rateLimit({
            windowMs: 60_000,
            max: 2,
            keyGenerator: () => 'rate:otp:send:test@example.com',
            redisUnavailableFallback: true,
            message: 'Too many OTP requests.',
        });
        const req = {
            ip: '127.0.0.1',
            path: '/api/auth/otp/send',
            body: { email: 'test@example.com' },
        } as Request;
        const res = createResponse();
        const next = vi.fn() as unknown as NextFunction;

        await middleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.rateLimitFallbackUsed).toBe(true);
        expect(res.status).not.toHaveBeenCalledWith(503);
        expect(res.set).toHaveBeenCalledWith('X-RateLimit-Fallback', 'memory');
    });

    it('returns 429 from fallback only after the configured threshold', async () => {
        const middleware = rateLimit({
            windowMs: 60_000,
            max: 2,
            keyGenerator: () => 'rate:otp:send:test@example.com',
            redisUnavailableFallback: true,
            message: 'Too many OTP requests.',
        });
        const req = {
            ip: '127.0.0.1',
            path: '/api/auth/otp/send',
            body: { email: 'test@example.com' },
        } as Request;
        const firstRes = createResponse();
        const secondRes = createResponse();
        const thirdRes = createResponse();
        const next = vi.fn() as unknown as NextFunction;

        await middleware(req, firstRes, next);
        await middleware(req, secondRes, next);
        await middleware(req, thirdRes, next);

        expect(next).toHaveBeenCalledTimes(2);
        expect(firstRes.status).not.toHaveBeenCalled();
        expect(secondRes.status).not.toHaveBeenCalled();
        expect(thirdRes.status).toHaveBeenCalledWith(429);
        expect(thirdRes.json).toHaveBeenCalledWith(expect.objectContaining({
            error: 'Too Many Requests',
            message: 'Too many OTP requests.',
        }));
    });

    it('tracks fallback windows in memory', () => {
        const store = new Map();
        expect(checkInMemoryRateLimit('rate:test', 1000, 2, 100, store)).toMatchObject({
            allowed: true,
            remaining: 1,
            resetAt: 1100,
        });
        expect(checkInMemoryRateLimit('rate:test', 1000, 2, 200, store)).toMatchObject({
            allowed: true,
            remaining: 0,
            resetAt: 1100,
        });
        expect(checkInMemoryRateLimit('rate:test', 1000, 2, 300, store)).toMatchObject({
            allowed: false,
            remaining: 0,
            resetAt: 1100,
        });
        expect(checkInMemoryRateLimit('rate:test', 1000, 2, 1200, store)).toMatchObject({
            allowed: true,
            remaining: 1,
            resetAt: 2200,
        });
    });
});
