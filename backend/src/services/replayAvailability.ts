export type ReplayVisibilitySession = {
    isReplayExpired?: boolean | null;
    recordingDeleted?: boolean | null;
    replayAvailable?: boolean | null;
    replayQuotaBillingExhausted?: boolean | null;
    replayRetentionState?: string | null;
    smartCaptureStatus?: string | null;
};

export function isSavedReplayRetentionState(retentionState: string | null | undefined): boolean {
    return retentionState === undefined || retentionState === null || retentionState === 'saved';
}

export function canOpenReplayFromSessionFields(
    session: ReplayVisibilitySession | null | undefined,
    readyReplayArtifacts = false,
): boolean {
    const retentionState = session?.replayRetentionState;
    if (!isSavedReplayRetentionState(retentionState)) return false;
    if (session?.smartCaptureStatus === 'discarded') {
        return false;
    }
    if (session?.replayQuotaBillingExhausted) {
        return false;
    }
    if (session?.recordingDeleted || session?.isReplayExpired) {
        return false;
    }
    if (session?.replayAvailable === undefined || session?.replayAvailable === null) {
        return readyReplayArtifacts;
    }
    return Boolean(session.replayAvailable);
}

export function hasSuccessfulRecording(
    session: ReplayVisibilitySession | null | undefined,
    _metrics?: any,
    readyScreenshotArtifacts = false
): boolean {
    return canOpenReplayFromSessionFields(session, readyScreenshotArtifacts);
}
