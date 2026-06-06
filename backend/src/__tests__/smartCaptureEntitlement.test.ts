import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TeamSubscriptionInfo } from '../services/stripeProducts.js';

const mocks = vi.hoisted(() => ({
    getTeamSubscription: vi.fn(),
    loggerWarn: vi.fn(),
}));

vi.mock('../services/stripeProducts.js', () => ({
    getTeamSubscription: mocks.getTeamSubscription,
}));

vi.mock('../logger.js', () => ({
    logger: {
        warn: mocks.loggerWarn,
    },
}));

import { isSmartCaptureEntitled } from '../services/smartCapture.js';

const subscriptionWithSmartCapture = (smartCaptureEnabled: boolean) => ({
    smartCaptureEnabled,
}) as TeamSubscriptionInfo;

describe('Smart Capture entitlement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('allows teams whose current plan includes Smart Capture', async () => {
        mocks.getTeamSubscription.mockResolvedValue(subscriptionWithSmartCapture(true));

        await expect(isSmartCaptureEntitled('team_scale')).resolves.toBe(true);

        expect(mocks.getTeamSubscription).toHaveBeenCalledWith('team_scale');
    });

    it('blocks teams below Scale', async () => {
        mocks.getTeamSubscription.mockResolvedValue(subscriptionWithSmartCapture(false));

        await expect(isSmartCaptureEntitled('team_pro')).resolves.toBe(false);
    });

    it('fails closed when billing entitlement cannot be resolved', async () => {
        mocks.getTeamSubscription.mockRejectedValue(new Error('billing unavailable'));

        await expect(isSmartCaptureEntitled('team_unknown')).resolves.toBe(false);

        expect(mocks.loggerWarn).toHaveBeenCalledWith(
            expect.objectContaining({ teamId: 'team_unknown' }),
            'Failed to resolve Smart Capture entitlement',
        );
    });
});
