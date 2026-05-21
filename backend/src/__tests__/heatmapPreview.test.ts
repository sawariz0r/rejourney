import { describe, expect, it } from 'vitest';

import { buildHeatmapScreenshotUrl } from '../utils/heatmapPreview.js';

describe('heatmapPreview', () => {
    it('uses timestamped frame URLs for screen-specific screenshot previews', () => {
        expect(buildHeatmapScreenshotUrl('session_1', 1770000000123.7))
            .toBe('/api/session/frame/session_1/1770000000124.jpg');
    });

    it('falls back to the session thumbnail when no screen timestamp is available', () => {
        expect(buildHeatmapScreenshotUrl('session_1', null))
            .toBe('/api/session/thumbnail/session_1');
    });

    it('returns null for empty session ids', () => {
        expect(buildHeatmapScreenshotUrl('', 1770000000123)).toBeNull();
    });
});
