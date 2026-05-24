import { describe, expect, it } from 'vitest';
import { normalizeHeatmapScreenName, normalizeHeatmapScreenPath } from '../utils/heatmapScreens.js';

describe('heatmapScreens', () => {
    it('folds high-cardinality web routes into stable heatmap buckets', () => {
        expect(normalizeHeatmapScreenName('/products/12345/reviews')).toBe('/products/:id/reviews');
        expect(normalizeHeatmapScreenName('https://example.com/accounts/9efd4cc8-f0b6-4ded-b7bd-a40851a5b465/settings?tab=billing'))
            .toBe('/accounts/:id/settings');
        expect(normalizeHeatmapScreenName('/sessions/01HX2E5Z9F8B9R6W7T5Q4P3N2M')).toBe('/sessions/:id');
    });

    it('drops non-route noise from heatmap candidates', () => {
        expect(normalizeHeatmapScreenName('Unknown')).toBeNull();
        expect(normalizeHeatmapScreenName('/api/projects/123')).toBeNull();
        expect(normalizeHeatmapScreenName('/assets/app.js')).toBeNull();
    });

    it('deduplicates consecutive screens after normalization', () => {
        expect(normalizeHeatmapScreenPath(['/products/1', '/products/2', 'Checkout', 'Checkout']))
            .toEqual(['/products/:id', 'Checkout']);
    });
});
