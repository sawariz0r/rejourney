import type {
    ReplayRetentionState,
    SmartCaptureDecision,
} from './smartCapture.js';

export type ReplayRetentionOutcome = {
    pendingSmartCaptureDecision: boolean;
    replayAvailable: boolean;
    replayQuotaBillingExhausted: boolean;
    replayRetentionState: ReplayRetentionState;
    shouldCountReplay: boolean;
    shouldDiscardVisualArtifacts: boolean;
    smartCaptureDecision: SmartCaptureDecision;
};

function resolveReplayRetentionState(input: {
    replayAvailable: boolean;
    replayQuotaBillingExhausted: boolean;
    smartCaptureDecision: SmartCaptureDecision;
}): ReplayRetentionState {
    if (input.replayQuotaBillingExhausted || input.smartCaptureDecision.status === 'discarded') {
        return 'analytics_only';
    }
    if (input.smartCaptureDecision.status === 'pending') {
        return input.replayAvailable ? 'buffered' : 'not_available';
    }
    if (input.replayAvailable) {
        return 'saved';
    }
    return 'not_available';
}

export function resolveReplayRetention(input: {
    hasReplayArtifacts: boolean;
    hasReplayQuotaCounted?: boolean;
    now?: Date;
    replayQuotaAtLimit?: boolean;
    replayQuotaBillingExhausted?: boolean;
    smartCaptureBufferAtLimit?: boolean;
    smartCaptureDecision: SmartCaptureDecision;
}): ReplayRetentionOutcome {
    const now = input.now ?? new Date();
    let smartCaptureDecision = input.smartCaptureDecision;
    let replayQuotaBillingExhausted = Boolean(input.replayQuotaBillingExhausted);
    let pendingSmartCaptureDecision = smartCaptureDecision.status === 'pending';

    if (pendingSmartCaptureDecision && input.smartCaptureBufferAtLimit) {
        smartCaptureDecision = {
            status: 'discarded',
            reason: 'buffer_limit_exhausted',
            ruleId: smartCaptureDecision.ruleId,
            decidedAt: now,
            shouldExposeReplay: false,
            shouldDiscardVisualArtifacts: true,
        };
        pendingSmartCaptureDecision = false;
    }

    if (
        input.replayQuotaAtLimit
        && input.hasReplayArtifacts
        && smartCaptureDecision.shouldExposeReplay
        && !pendingSmartCaptureDecision
        && !input.hasReplayQuotaCounted
    ) {
        replayQuotaBillingExhausted = true;
        smartCaptureDecision = {
            status: 'discarded',
            reason: 'quota_exhausted_at_promotion',
            ruleId: smartCaptureDecision.ruleId,
            decidedAt: now,
            shouldExposeReplay: false,
            shouldDiscardVisualArtifacts: true,
        };
    }

    const replayAvailable = !replayQuotaBillingExhausted
        && input.hasReplayArtifacts
        && smartCaptureDecision.shouldExposeReplay;
    const replayRetentionState = resolveReplayRetentionState({
        replayAvailable,
        replayQuotaBillingExhausted,
        smartCaptureDecision,
    });

    return {
        pendingSmartCaptureDecision,
        replayAvailable,
        replayQuotaBillingExhausted,
        replayRetentionState,
        shouldCountReplay: replayAvailable && !pendingSmartCaptureDecision,
        shouldDiscardVisualArtifacts: smartCaptureDecision.shouldDiscardVisualArtifacts,
        smartCaptureDecision,
    };
}
