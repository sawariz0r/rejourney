const NOISE_SCREEN_VALUES = new Set(['unknown', 'undefined', 'null', 'none', 'n/a']);
const UUID_PATH_SEGMENT_RE = /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi;
const LONG_HEX_PATH_SEGMENT_RE = /\/[0-9a-f]{16,}(?=\/|$)/gi;
const NUMERIC_PATH_SEGMENT_RE = /\/\d+(?=\/|$)/g;
const LONG_TOKEN_PATH_SEGMENT_RE = /\/(?=[A-Za-z0-9_]{20,}(?=\/|$))(?=[A-Za-z0-9_]*\d)[A-Za-z0-9_]+(?=\/|$)/g;
const STATIC_ASSET_PATH_RE = /\.(jpg|jpeg|png|gif|webp|avif|svg|ico|css|js|map|woff2?|ttf|otf|mp4|webm|mov|m4v|mp3|wav|pdf)(?:$|[?#])/i;

function stripUrlToPath(value: string): string {
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;
    try {
        return new URL(value).pathname || '/';
    } catch {
        return value;
    }
}

function normalizeWebRoutePath(value: string): string | null {
    const withoutOrigin = stripUrlToPath(value);
    const pathOnly = withoutOrigin.split('#')[0].split('?')[0].trim();
    if (!pathOnly) return null;
    if (STATIC_ASSET_PATH_RE.test(pathOnly)) return null;

    const withLeadingSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
    const normalized = withLeadingSlash
        .replace(/\/{2,}/g, '/')
        .replace(UUID_PATH_SEGMENT_RE, '/:id')
        .replace(LONG_HEX_PATH_SEGMENT_RE, '/:id')
        .replace(NUMERIC_PATH_SEGMENT_RE, '/:id')
        .replace(LONG_TOKEN_PATH_SEGMENT_RE, '/:id')
        .replace(/\/+$/, '') || '/';

    if (normalized === '/api' || normalized.startsWith('/api/')) return null;
    return normalized;
}

export function normalizeHeatmapScreenName(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (NOISE_SCREEN_VALUES.has(trimmed.toLowerCase())) return null;

    if (trimmed.startsWith('/') || /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
        return normalizeWebRoutePath(trimmed);
    }

    return trimmed.replace(/\s+/g, ' ');
}

export function normalizeHeatmapScreenPath(screens: Array<string | null | undefined>): string[] {
    const normalized: string[] = [];
    for (const screen of screens) {
        const cleaned = normalizeHeatmapScreenName(screen);
        if (!cleaned) continue;
        if (normalized.length === 0 || normalized[normalized.length - 1] !== cleaned) {
            normalized.push(cleaned);
        }
    }
    return normalized;
}
