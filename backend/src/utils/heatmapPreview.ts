export function buildHeatmapScreenshotUrl(
    sessionId: string | null | undefined,
    screenFirstSeenMs?: number | null,
): string | null {
    const normalizedSessionId = String(sessionId || '').trim();
    if (!normalizedSessionId) return null;

    const encodedSessionId = encodeURIComponent(normalizedSessionId);
    const timestamp = Number(screenFirstSeenMs);
    if (Number.isFinite(timestamp) && timestamp > 0) {
        return `/api/session/frame/${encodedSessionId}/${Math.round(timestamp)}.jpg`;
    }

    return `/api/session/thumbnail/${encodedSessionId}`;
}
