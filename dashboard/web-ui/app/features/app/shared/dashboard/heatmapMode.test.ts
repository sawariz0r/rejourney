import { describe, expect, it } from 'vitest';

import { getAvailableHeatmapModes, getDefaultHeatmapMode, getWebDocumentRatio } from './heatmapMode';

describe('heatmapMode', () => {
    it('defaults web routes to attention maps', () => {
        expect(getDefaultHeatmapMode('web')).toBe('attention');
        expect(getAvailableHeatmapModes('web')).toEqual(['attention', 'touch']);
    });

    it('keeps mobile screens touch-only', () => {
        expect(getDefaultHeatmapMode('mobile')).toBe('touch');
        expect(getAvailableHeatmapModes('mobile')).toEqual(['touch']);
    });

    it('preserves long web document ratios', () => {
        expect(getWebDocumentRatio(1440, 5200)).toBeCloseTo(3.611, 3);
    });
});
