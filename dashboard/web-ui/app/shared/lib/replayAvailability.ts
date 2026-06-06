export type ReplayAvailabilityLike = {
  canOpenReplay?: boolean;
  hasSuccessfulRecording?: boolean;
  isReplayExpired?: boolean | null;
  recordingDeleted?: boolean | null;
  replayAvailable?: boolean | null;
  replayQuotaBillingExhausted?: boolean | null;
  replayRetentionState?: string | null;
  smartCaptureStatus?: string | null;
  stats?: {
    screenshotSegmentCount?: number | null;
  } | null;
};

export function canOpenReplayFromSession(
  session: ReplayAvailabilityLike | null | undefined,
  readyReplayArtifacts = false,
): boolean {
  if (!session) return false;
  if (typeof session.canOpenReplay === 'boolean') return session.canOpenReplay;
  if (session.replayRetentionState && session.replayRetentionState !== 'saved') return false;
  if (session.smartCaptureStatus === 'discarded') return false;
  if (session.replayQuotaBillingExhausted) return false;
  if (session.recordingDeleted || session.isReplayExpired) return false;
  if (session.replayAvailable === undefined || session.replayAvailable === null) {
    return Boolean(session.hasSuccessfulRecording) || readyReplayArtifacts;
  }
  return Boolean(session.replayAvailable);
}

export function hasSuccessfulRecordingFromSession(
  session: ReplayAvailabilityLike | null | undefined,
  readyReplayArtifacts = false,
): boolean {
  return canOpenReplayFromSession(session, readyReplayArtifacts);
}
