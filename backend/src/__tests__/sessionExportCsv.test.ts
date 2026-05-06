import { describe, expect, it } from 'vitest';
import {
    buildSessionExportCsvRow,
    createSessionExportDateTimeFormatters,
    encodeCsvRow,
    SESSION_EXPORT_CSV_HEADERS,
} from '../services/sessionExportCsv.js';

function column(name: typeof SESSION_EXPORT_CSV_HEADERS[number]): number {
    return SESSION_EXPORT_CSV_HEADERS.indexOf(name);
}

describe('session export CSV', () => {
    it('keeps visible replay columns aligned with expanded metadata', () => {
        const row = buildSessionExportCsvRow({
            session: {
                id: 'session-1',
                userDisplayId: 'user-123',
                anonymousHash: 'anon-456',
                deviceModel: 'iPhone 15 Pro',
                appVersion: '2.1.1',
                osVersion: '26.3.1',
                status: 'ready',
                startedAt: new Date('2026-05-03T04:23:00.000Z'),
                geoCity: 'Chicago',
                geoCountry: 'United States',
                geoCountryCode: 'US',
            },
            metrics: {
                screensVisited: ['Index', 'Home', 'Community'],
                networkType: 'wifi',
                apiSuccessCount: 99,
                apiErrorCount: 1,
                apiTotalCount: 100,
                apiAvgResponseMs: 418.2,
                rageTapCount: 0,
                deadTapCount: 0,
                crashCount: 0,
                anrCount: 0,
                errorCount: 0,
                interactionScore: 49,
                appStartupTimeMs: 0,
            },
            presentation: {
                effectiveStatus: 'ready',
                isLiveIngest: false,
                isBackgroundProcessing: false,
                canOpenReplay: true,
            },
            durationSeconds: 16,
            successfulRecording: true,
            isFirstSession: false,
            visitorSessionNumber: 108,
            visitorFinalSessionNumber: 1,
            formatters: createSessionExportDateTimeFormatters('en-US', 'America/Chicago'),
        });

        expect(row).toHaveLength(SESSION_EXPORT_CSV_HEADERS.length);
        expect(row[column('Date')]).toBe('5/2/2026');
        expect(row[column('Time')]).toBe('11:23 PM');
        expect(row[column('Duration')]).toBe('0:16');
        expect(row[column('Screens')]).toBe('3');
        expect(row[column('API Avg (ms)')]).toBe('418');
        expect(row[column('API Errors')]).toBe('1');
        expect(row[column('Replay')]).toBe('Open Replay');
        expect(row[column('Loyalty')]).toBe('Top 1%');
        expect(row[column('Session Number')]).toBe('108');
        expect(row[column('Engagement')]).toBe('49/100');
        expect(row[column('Page Journey')]).toBe('Index > Home > Community');
    });

    it('quotes all cells and escapes quotes', () => {
        expect(encodeCsvRow(['a "quoted" value', 'b,c', 'line\nbreak'])).toBe('"a ""quoted"" value","b,c","line\nbreak"');
    });
});
