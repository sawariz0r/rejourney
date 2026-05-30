import { describe, expect, it } from 'vitest';
import { gzipSync } from 'zlib';

import {
    buildWebAttentionHeatmap,
    extractRrwebEventsFromArtifact,
} from '../utils/webAttentionHeatmap.js';

const meta = (timestamp: number, width = 1440, height = 900, href = 'https://example.test/pricing') => ({
    type: 4,
    timestamp,
    data: { width, height, href },
});

const incremental = (timestamp: number, data: Record<string, unknown>) => ({
    type: 3,
    timestamp,
    data,
});

describe('webAttentionHeatmap', () => {
    it('converts cursor positions plus scroll into full-document coordinates', () => {
        const result = buildWebAttentionHeatmap([{
            events: [
                meta(1_000),
                incremental(1_200, { source: 3, id: 1, x: 0, y: 1800 }),
                incremental(1_400, { source: 1, positions: [{ x: 720, y: 300, id: 2, timeOffset: 0 }] }),
                incremental(4_400, { source: 1, positions: [{ x: 720, y: 320, id: 2, timeOffset: 0 }] }),
            ],
            dimensions: {
                pageWidth: 1440,
                pageHeight: 3600,
                viewportWidth: 1440,
                viewportHeight: 900,
            },
        }]);

        const strongest = result.hotspots[0];
        expect(result.pageHeight).toBe(3600);
        expect(strongest?.x).toBeGreaterThan(0.45);
        expect(strongest?.x).toBeLessThan(0.55);
        expect(strongest?.y).toBeGreaterThan(0.56);
        expect(strongest?.y).toBeLessThan(0.66);
    });

    it('preserves long landing page dimensions instead of capping to the first viewport', () => {
        const result = buildWebAttentionHeatmap([{
            events: [
                meta(1_000),
                incremental(1_200, { source: 3, id: 1, x: 0, y: 3200 }),
                incremental(1_400, { source: 1, positions: [{ x: 500, y: 700, id: 2, timeOffset: 0 }] }),
            ],
            dimensions: {
                pageWidth: 1440,
                pageHeight: 5200,
                viewportWidth: 1440,
                viewportHeight: 900,
            },
        }]);

        expect(result.pageWidth).toBe(1440);
        expect(result.pageHeight).toBe(5200);
        expect(result.viewportHeight).toBe(900);
    });

    it('weights click interactions above passive dwell points', () => {
        const result = buildWebAttentionHeatmap([{
            events: [
                meta(1_000, 1000, 800),
                incremental(1_100, { source: 1, positions: [{ x: 100, y: 100, id: 2, timeOffset: 0 }] }),
                incremental(1_200, { source: 2, type: 2, id: 3, x: 800, y: 600 }),
            ],
            dimensions: {
                pageWidth: 1000,
                pageHeight: 800,
                viewportWidth: 1000,
                viewportHeight: 800,
            },
        }]);

        const strongest = result.hotspots[0];
        expect(strongest?.kind).toBe('touch');
        expect(strongest?.x).toBeGreaterThan(0.7);
        expect(strongest?.y).toBeGreaterThan(0.65);
    });

    it('returns an empty low-confidence result for empty rrweb sessions', () => {
        const result = buildWebAttentionHeatmap([{ events: [] }], {
            pageWidth: 1440,
            pageHeight: 4200,
            viewportWidth: 1440,
            viewportHeight: 900,
        });

        expect(result.hotspots).toEqual([]);
        expect(result.sampledSessions).toBe(0);
        expect(result.avgSessionDurationMs).toBeNull();
        expect(result.eventCount).toBe(0);
        expect(result.confidence).toBe('low');
        expect(result.pageHeight).toBe(4200);
    });

    it('reports average sampled session duration for attention tooltips', () => {
        const result = buildWebAttentionHeatmap([
            {
                events: [
                    meta(1_000, 1000, 800),
                    incremental(3_000, { source: 3, id: 1, x: 0, y: 0 }),
                ],
                durationMs: 10_000,
                dimensions: { pageWidth: 1000, pageHeight: 800, viewportWidth: 1000, viewportHeight: 800 },
            },
            {
                events: [
                    meta(2_000, 1000, 800),
                    incremental(4_000, { source: 3, id: 1, x: 0, y: 0 }),
                ],
                durationMs: 20_000,
                dimensions: { pageWidth: 1000, pageHeight: 800, viewportWidth: 1000, viewportHeight: 800 },
            },
        ]);

        expect(result.sampledSessions).toBe(2);
        expect(result.avgSessionDurationMs).toBe(15_000);
    });

    it('uses the touch heatmap prior when rrweb is sparse or unavailable', () => {
        const result = buildWebAttentionHeatmap([], {
            pageWidth: 1200,
            pageHeight: 3000,
            viewportWidth: 1200,
            viewportHeight: 800,
        }, {
            touchBuckets: { '0.25,0.72': 18 },
            rageTapBuckets: {},
            totalTouches: 18,
            totalRageTaps: 0,
        }, '/pricing');

        const strongest = result.hotspots[0];
        expect(result.sampledSessions).toBe(0);
        expect(result.eventCount).toBe(0);
        expect(result.confidence).toBe('medium');
        expect(strongest?.kind).toBe('touch');
        expect(strongest?.x).toBeGreaterThan(0.2);
        expect(strongest?.x).toBeLessThan(0.3);
        expect(strongest?.y).toBeGreaterThan(0.68);
        expect(strongest?.y).toBeLessThan(0.76);
    });

    it('promotes rage tap buckets into high-intensity rage hotspots', () => {
        const result = buildWebAttentionHeatmap([], {
            pageWidth: 1200,
            pageHeight: 3000,
            viewportWidth: 1200,
            viewportHeight: 800,
        }, {
            touchBuckets: { '0.4,0.5': 8, '0.1,0.1': 12 },
            rageTapBuckets: { '0.4,0.5': 6 },
            totalTouches: 20,
            totalRageTaps: 6,
        }, '/pricing');

        const rage = result.hotspots.find((hotspot) => hotspot.kind === 'rage');
        expect(rage?.isRageTap).toBe(true);
        expect(rage?.x).toBeGreaterThan(0.36);
        expect(rage?.x).toBeLessThan(0.44);
        expect(rage?.y).toBeGreaterThan(0.46);
        expect(rage?.y).toBeLessThan(0.54);
    });

    it('route-scopes rrweb signals when href events identify the selected route', () => {
        const result = buildWebAttentionHeatmap([{
            events: [
                meta(1_000, 1000, 800, 'https://example.test/home'),
                incremental(1_200, { source: 1, positions: [{ x: 100, y: 120, id: 2, timeOffset: 0 }] }),
                incremental(5_200, { source: 1, positions: [{ x: 110, y: 130, id: 2, timeOffset: 0 }] }),
                meta(5_400, 1000, 800, 'https://example.test/pricing'),
                incremental(5_600, { source: 2, type: 2, id: 3, x: 820, y: 620 }),
            ],
            dimensions: {
                pageWidth: 1000,
                pageHeight: 800,
                viewportWidth: 1000,
                viewportHeight: 800,
            },
        }], {}, null, '/pricing');

        const strongest = result.hotspots[0];
        expect(strongest?.x).toBeGreaterThan(0.75);
        expect(strongest?.y).toBeGreaterThan(0.7);
    });

    it('credits a long fixation over a fast cursor sweep instead of flooding the trail', () => {
        const sweep = Array.from({ length: 12 }, (_, index) => ({
            x: 100 + index * 70,
            y: 120,
            id: 2,
            timeOffset: index * 4,
        }));
        const result = buildWebAttentionHeatmap([{
            events: [
                meta(1_000, 1440, 900),
                // Fast sweep across the page (tiny dwell between samples).
                incremental(1_050, { source: 1, positions: sweep }),
                // Cursor then rests at the bottom-right for ~3s.
                incremental(1_100, { source: 1, positions: [{ x: 1_100, y: 760, id: 2, timeOffset: 0 }] }),
                incremental(4_100, { source: 1, positions: [{ x: 1_100, y: 760, id: 2, timeOffset: 0 }] }),
            ],
            dimensions: { pageWidth: 1440, pageHeight: 900, viewportWidth: 1440, viewportHeight: 900 },
        }]);

        const strongest = result.hotspots[0];
        // The resting spot (~0.76, ~0.84) must dominate, not the mid-sweep path (~0.37, 0.13).
        expect(strongest?.x).toBeGreaterThan(0.7);
        expect(strongest?.y).toBeGreaterThan(0.75);
    });

    it('spreads passive dwell across a full-width read band rather than a center stripe', () => {
        const result = buildWebAttentionHeatmap([{
            events: [
                meta(1_000, 1440, 900),
                // No cursor activity at all — only the passage of time on screen.
                incremental(5_000, { source: 3, id: 1, x: 0, y: 0 }),
            ],
            dimensions: { pageWidth: 1440, pageHeight: 900, viewportWidth: 1440, viewportHeight: 900 },
        }]);

        const distinctColumns = new Set(result.hotspots.map((hotspot) => Math.round(hotspot.x * 10)));
        // A center stripe would collapse to one column; the read band should span several.
        expect(distinctColumns.size).toBeGreaterThanOrEqual(3);
        const centerHeavy = result.hotspots.filter((hotspot) => Math.abs(hotspot.x - 0.5) < 0.05);
        expect(centerHeavy.length).toBeLessThan(result.hotspots.length);
    });

    it('extracts gzipped rrweb envelopes', () => {
        const artifact = gzipSync(JSON.stringify({
            format: 'rrweb',
            page: { width: 1440, height: 4200 },
            viewport: { width: 1440, height: 900 },
            events: [meta(1_000)],
        }));

        const extracted = extractRrwebEventsFromArtifact(artifact, 'segment.rrweb.json.gz');
        expect(extracted.events).toHaveLength(1);
        expect(extracted.page?.height).toBe(4200);
        expect(extracted.viewport?.height).toBe(900);
    });
});
