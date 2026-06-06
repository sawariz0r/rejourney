import { afterEach, describe, expect, it, vi } from 'vitest';

const originalStorageKey = process.env.STORAGE_ENCRYPTION_KEY;
const originalSuperwallKey = process.env.SUPERWALL_API_KEY_ENCRYPTION_KEY;
const originalRevenueCatKey = process.env.REVENUECAT_API_KEY_ENCRYPTION_KEY;
const originalDockerEnv = process.env.DOCKER_ENV;

function restoreEnv() {
    if (originalStorageKey === undefined) {
        delete process.env.STORAGE_ENCRYPTION_KEY;
    } else {
        process.env.STORAGE_ENCRYPTION_KEY = originalStorageKey;
    }

    if (originalSuperwallKey === undefined) {
        delete process.env.SUPERWALL_API_KEY_ENCRYPTION_KEY;
    } else {
        process.env.SUPERWALL_API_KEY_ENCRYPTION_KEY = originalSuperwallKey;
    }

    if (originalRevenueCatKey === undefined) {
        delete process.env.REVENUECAT_API_KEY_ENCRYPTION_KEY;
    } else {
        process.env.REVENUECAT_API_KEY_ENCRYPTION_KEY = originalRevenueCatKey;
    }

    if (originalDockerEnv === undefined) {
        delete process.env.DOCKER_ENV;
    } else {
        process.env.DOCKER_ENV = originalDockerEnv;
    }
}

describe('revenue provider API key encryption config', () => {
    afterEach(() => {
        restoreEnv();
        vi.resetModules();
    });

    it('does not treat the storage encryption key as Superwall configuration', async () => {
        process.env.STORAGE_ENCRYPTION_KEY = '1'.repeat(64);
        delete process.env.SUPERWALL_API_KEY_ENCRYPTION_KEY;
        process.env.DOCKER_ENV = 'true';
        vi.resetModules();

        const { isEncryptionKeyConfigured } = await import('../services/crypto.js');

        expect(isEncryptionKeyConfigured('superwallApiKey')).toBe(false);
    });

    it('encrypts Superwall API keys with the dedicated key purpose', async () => {
        process.env.STORAGE_ENCRYPTION_KEY = '1'.repeat(64);
        process.env.SUPERWALL_API_KEY_ENCRYPTION_KEY = '2'.repeat(64);
        process.env.DOCKER_ENV = 'true';
        vi.resetModules();

        const { decrypt, encrypt } = await import('../services/crypto.js');
        const encrypted = encrypt('superwall_api_key_123', 'superwallApiKey');

        expect(decrypt(encrypted, 'superwallApiKey')).toBe('superwall_api_key_123');
        expect(() => decrypt(encrypted, 'storage')).toThrow();
    });

    it('does not treat the storage encryption key as RevenueCat configuration', async () => {
        process.env.STORAGE_ENCRYPTION_KEY = '1'.repeat(64);
        delete process.env.REVENUECAT_API_KEY_ENCRYPTION_KEY;
        process.env.DOCKER_ENV = 'true';
        vi.resetModules();

        const { isEncryptionKeyConfigured } = await import('../services/crypto.js');

        expect(isEncryptionKeyConfigured('revenueCatApiKey')).toBe(false);
    });

    it('encrypts RevenueCat API keys with the dedicated key purpose', async () => {
        process.env.STORAGE_ENCRYPTION_KEY = '1'.repeat(64);
        process.env.REVENUECAT_API_KEY_ENCRYPTION_KEY = '3'.repeat(64);
        process.env.DOCKER_ENV = 'true';
        vi.resetModules();

        const { decrypt, encrypt } = await import('../services/crypto.js');
        const encrypted = encrypt('revenuecat_api_key_123', 'revenueCatApiKey');

        expect(decrypt(encrypted, 'revenueCatApiKey')).toBe('revenuecat_api_key_123');
        expect(() => decrypt(encrypted, 'storage')).toThrow();
    });
});
