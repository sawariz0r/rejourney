import type { HeatmapMode } from '~/shared/api/client';

export function getDefaultHeatmapMode(viewer: 'web' | 'mobile'): HeatmapMode {
    return viewer === 'web' ? 'attention' : 'touch';
}

export function getAvailableHeatmapModes(viewer: 'web' | 'mobile'): HeatmapMode[] {
    return viewer === 'web' ? ['attention', 'touch'] : ['touch'];
}

export function getWebDocumentRatio(pageWidth?: number | null, pageHeight?: number | null, viewportWidth = 1440, viewportHeight = 900): number {
    const width = typeof pageWidth === 'number' && Number.isFinite(pageWidth) && pageWidth > 0 ? pageWidth : viewportWidth;
    const height = typeof pageHeight === 'number' && Number.isFinite(pageHeight) && pageHeight > 0 ? pageHeight : viewportHeight;
    return height / Math.max(width, 1);
}
