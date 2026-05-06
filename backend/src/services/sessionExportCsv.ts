export const SESSION_EXPORT_CSV_HEADERS = [
    'Health',
    'Session ID',
    'User',
    'Anonymous ID',
    'Device Model',
    'App Version',
    'Date',
    'Time',
    'Location',
    'Country',
    'City',
    'Duration',
    'Duration Seconds',
    'Screens',
    'API Avg (ms)',
    'API Errors',
    'Notes',
    'Replay',
    'Loyalty',
    'Session Number',
    'Visitor Total Sessions',
    'Engagement',
    'Startup (ms)',
    'Network',
    'OS Version',
    'API OK',
    'API Total',
    'Rage Taps',
    'Dead Taps',
    'Crashes',
    'ANRs',
    'Errors',
    'Page Journey',
    'Entry Screen',
    'Exit Screen',
] as const;

type SessionExportCsvSession = {
    id: string;
    userDisplayId?: string | null;
    anonymousHash?: string | null;
    anonymousDisplayId?: string | null;
    deviceModel?: string | null;
    appVersion?: string | null;
    osVersion?: string | null;
    status?: string | null;
    recordingDeleted?: boolean | null;
    isReplayExpired?: boolean | null;
    startedAt: Date;
    geoCity?: string | null;
    geoRegion?: string | null;
    geoCountry?: string | null;
    geoCountryCode?: string | null;
};

type SessionExportCsvMetrics = {
    screensVisited?: string[] | null;
    networkType?: string | null;
    cellularGeneration?: string | null;
    apiSuccessCount?: number | null;
    apiErrorCount?: number | null;
    apiTotalCount?: number | null;
    apiAvgResponseMs?: number | null;
    rageTapCount?: number | null;
    deadTapCount?: number | null;
    crashCount?: number | null;
    anrCount?: number | null;
    errorCount?: number | null;
    interactionScore?: number | null;
    appStartupTimeMs?: number | null;
};

type SessionExportCsvPresentation = {
    effectiveStatus: string;
    isLiveIngest: boolean;
    isBackgroundProcessing: boolean;
    canOpenReplay: boolean;
};

export type SessionExportCsvDateTimeFormatters = {
    formatDate: (date: Date) => string;
    formatTime: (date: Date) => string;
};

type BuildSessionExportCsvRowInput = {
    session: SessionExportCsvSession;
    metrics: SessionExportCsvMetrics | null;
    presentation: SessionExportCsvPresentation;
    durationSeconds: number;
    successfulRecording: boolean;
    isFirstSession: boolean;
    anonymousDisplayName?: string | null;
    visitorSessionNumber?: number | null;
    visitorFinalSessionNumber?: number | null;
    formatters: SessionExportCsvDateTimeFormatters;
};

function queryValueToString(value: unknown): string | undefined {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || undefined;
    }
    if (Array.isArray(value)) {
        return queryValueToString(value[0]);
    }
    return undefined;
}

export function createSessionExportDateTimeFormatters(
    localeRaw?: unknown,
    timeZoneRaw?: unknown
): SessionExportCsvDateTimeFormatters {
    const requestedLocale = queryValueToString(localeRaw) ?? 'en-US';
    const requestedTimeZone = queryValueToString(timeZoneRaw) ?? 'UTC';

    const createFormatters = (locale: string, timeZone: string): SessionExportCsvDateTimeFormatters => {
        const dateFormatter = new Intl.DateTimeFormat(locale, {
            timeZone,
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
        });
        const timeFormatter = new Intl.DateTimeFormat(locale, {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
        });

        dateFormatter.format(new Date(0));
        timeFormatter.format(new Date(0));

        return {
            formatDate: (date: Date) => dateFormatter.format(date),
            formatTime: (date: Date) => timeFormatter.format(date),
        };
    };

    try {
        return createFormatters(requestedLocale, requestedTimeZone);
    } catch {
        try {
            return createFormatters('en-US', requestedTimeZone);
        } catch {
            return createFormatters('en-US', 'UTC');
        }
    }
}

export function encodeCsvRow(values: readonly unknown[]): string {
    return values
        .map((value) => {
            const text = value === null || value === undefined ? '' : String(value);
            return `"${text.replace(/"/g, '""')}"`;
        })
        .join(',');
}

function text(value: string | null | undefined): string {
    return typeof value === 'string' ? value.trim() : '';
}

function num(value: number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function rounded(value: number | null | undefined): number {
    return Math.round(num(value));
}

function formatDuration(seconds: number): string {
    const safeSeconds = Math.max(0, Math.round(num(seconds)));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = String(safeSeconds % 60).padStart(2, '0');
    return `${minutes}:${remainder}`;
}

function normalizeCountry(country: string, countryCode: string): string {
    const normalizedCode = countryCode.toUpperCase();
    if (normalizedCode === 'IL' || normalizedCode === 'PS/IL' || /\bisrael\b/i.test(country)) {
        return 'Palestine / Israel';
    }
    return country;
}

function formatLocation(session: SessionExportCsvSession): { location: string; country: string; city: string } {
    const city = text(session.geoCity);
    const region = text(session.geoRegion);
    const country = normalizeCountry(text(session.geoCountry), text(session.geoCountryCode));
    const location = [city, country].filter(Boolean).join(', ') || region || country;
    return { location, country, city };
}

function getLoyaltyLabel(sessionNumber: number | null | undefined, isFirstSession: boolean): string {
    if (!sessionNumber || sessionNumber <= 0) return '';
    if (sessionNumber === 1 || isFirstSession) return 'New';
    if (sessionNumber >= 50) return 'Top 1%';
    if (sessionNumber >= 20) return 'Top 5%';
    if (sessionNumber >= 10) return 'Top 15%';
    if (sessionNumber >= 5) return 'Regular';
    return 'Returning';
}

function canNavigateToSession(input: BuildSessionExportCsvRowInput): boolean {
    const status = input.session.status ?? '';
    return Boolean(
        input.presentation.canOpenReplay ||
        input.presentation.isLiveIngest ||
        input.presentation.isBackgroundProcessing ||
        input.presentation.effectiveStatus === 'processing' ||
        input.presentation.effectiveStatus === 'pending' ||
        status === 'processing' ||
        status === 'pending' ||
        input.successfulRecording
    );
}

function getReplayState(input: BuildSessionExportCsvRowInput): string {
    if (!canNavigateToSession(input)) {
        if (input.session.recordingDeleted) return 'Deleted';
        if (input.session.isReplayExpired) return 'Expired';
        return 'Unavailable';
    }
    if (input.presentation.isLiveIngest) return 'Live Replay';
    if (
        !input.presentation.canOpenReplay &&
        (input.presentation.isBackgroundProcessing ||
            input.presentation.effectiveStatus === 'processing' ||
            input.presentation.effectiveStatus === 'pending')
    ) {
        return 'Preparing';
    }
    return 'Open Replay';
}

export function buildSessionExportCsvRow(input: BuildSessionExportCsvRowInput): string[] {
    const { session, metrics, durationSeconds, formatters } = input;
    const screensVisited = Array.isArray(metrics?.screensVisited) ? metrics.screensVisited : [];
    const apiAvgResponseMs = rounded(metrics?.apiAvgResponseMs);
    const apiErrors = rounded(metrics?.apiErrorCount);
    const apiOk = rounded(metrics?.apiSuccessCount);
    const apiTotal = rounded(metrics?.apiTotalCount) || apiOk + apiErrors;
    const rageTaps = rounded(metrics?.rageTapCount);
    const deadTaps = rounded(metrics?.deadTapCount);
    const crashes = rounded(metrics?.crashCount);
    const anrs = rounded(metrics?.anrCount);
    const errors = rounded(metrics?.errorCount);
    const startupMs = rounded(metrics?.appStartupTimeMs);
    const engagementScore = rounded(metrics?.interactionScore);
    const hasSlowStart = startupMs > 3000;
    const hasSlowApi = apiAvgResponseMs > 1000;
    const hasIssues = crashes > 0 || anrs > 0 || errors > 0 || rageTaps > 0 || deadTaps > 0 || hasSlowStart || hasSlowApi;
    const notes = [
        input.isFirstSession ? 'NEW USER' : '',
        !hasIssues ? 'HEALTHY' : '',
        crashes > 0 ? 'CRASH' : '',
        anrs > 0 ? 'ANR' : '',
        errors > 0 ? 'ERR' : '',
        rageTaps > 0 ? 'RAGE' : '',
        deadTaps > 0 ? 'DEAD' : '',
        hasSlowStart ? 'SLOW' : '',
        hasSlowApi ? 'API' : '',
    ].filter(Boolean);
    const showLiveReplayDuration =
        input.presentation.isLiveIngest ||
        (!input.presentation.canOpenReplay &&
            (input.presentation.isBackgroundProcessing ||
                input.presentation.effectiveStatus === 'processing' ||
                input.presentation.effectiveStatus === 'pending'));
    const visitorSessionNumber = input.visitorSessionNumber && input.visitorSessionNumber > 0
        ? input.visitorSessionNumber
        : null;
    const visitorTotalSessions = visitorSessionNumber && input.visitorFinalSessionNumber && input.visitorFinalSessionNumber > 0
        ? visitorSessionNumber + input.visitorFinalSessionNumber - 1
        : null;
    const location = formatLocation(session);
    const network = text(metrics?.networkType) || text(metrics?.cellularGeneration) || 'Unknown';
    const replayState = getReplayState(input);
    const health = !canNavigateToSession(input) ? 'Replay unavailable' : hasIssues ? 'Issues' : 'Healthy';

    return [
        health,
        session.id,
        text(session.userDisplayId) || text(input.anonymousDisplayName) || 'Anonymous',
        text(session.anonymousDisplayId) || text(session.anonymousHash),
        text(session.deviceModel) || 'Unknown Device',
        text(session.appVersion) || 'Unknown',
        formatters.formatDate(session.startedAt),
        formatters.formatTime(session.startedAt),
        location.location,
        location.country,
        location.city,
        showLiveReplayDuration ? 'LIVE REPLAY' : formatDuration(durationSeconds),
        String(Math.max(0, Math.round(durationSeconds))),
        String(screensVisited.length),
        apiAvgResponseMs > 0 ? String(apiAvgResponseMs) : '',
        apiErrors > 0 ? String(apiErrors) : '',
        notes.join('; '),
        replayState,
        getLoyaltyLabel(visitorSessionNumber, input.isFirstSession),
        visitorSessionNumber ? String(visitorSessionNumber) : '',
        visitorTotalSessions ? String(visitorTotalSessions) : '',
        `${engagementScore}/100`,
        startupMs > 0 ? String(startupMs) : '',
        network,
        text(session.osVersion),
        String(apiOk),
        String(apiTotal),
        String(rageTaps),
        String(deadTaps),
        String(crashes),
        String(anrs),
        String(errors),
        screensVisited.join(' > '),
        screensVisited[0] ?? '',
        screensVisited[screensVisited.length - 1] ?? '',
    ];
}
