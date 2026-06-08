import { normalizeApiEndpointPath } from './apiEndpointNormalization.js';

const HTTP_METHOD_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE|CONNECT)\s+/i;
const MAX_IGNORED_ENDPOINTS = 50;

function collapseSpaces(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
}

function splitMethodAndPath(value: string): { method: string | null; path: string } {
    const trimmed = collapseSpaces(value);
    const methodMatch = trimmed.match(HTTP_METHOD_RE);
    if (!methodMatch) {
        return { method: null, path: trimmed };
    }
    return {
        method: methodMatch[1].toUpperCase(),
        path: trimmed.slice(methodMatch[0].length).trim() || '/',
    };
}

export function normalizeIgnoredApiEndpointPattern(value: string): string | null {
    const trimmed = collapseSpaces(value);
    if (!trimmed) return null;

    const { method, path } = splitMethodAndPath(trimmed);
    const normalizedPath = path.startsWith('/') ? normalizeApiEndpointPath(path) : path;
    return method ? `${method} ${normalizedPath}` : normalizedPath;
}

export function normalizeIgnoredApiEndpointPatterns(value: unknown): string[] {
    const rawValues = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(/[\n,]+/)
            : [];
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const raw of rawValues) {
        if (typeof raw !== 'string') continue;
        const pattern = normalizeIgnoredApiEndpointPattern(raw);
        if (!pattern) continue;
        const key = pattern.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        normalized.push(pattern);
        if (normalized.length >= MAX_IGNORED_ENDPOINTS) break;
    }

    return normalized;
}

function escapeRegExp(value: string): string {
    return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(value: string): RegExp {
    const source = value
        .split('*')
        .map(escapeRegExp)
        .join('.*');
    return new RegExp(`^${source}$`, 'i');
}

export function endpointMatchesIgnoredPattern(endpoint: string, patterns: string[]): boolean {
    const normalizedEndpoint = normalizeIgnoredApiEndpointPattern(endpoint);
    if (!normalizedEndpoint) return false;
    const { path } = splitMethodAndPath(normalizedEndpoint);

    return normalizeIgnoredApiEndpointPatterns(patterns).some((pattern) => {
        const { method } = splitMethodAndPath(pattern);
        const target = method ? normalizedEndpoint : path;
        return pattern.includes('*')
            ? globToRegExp(pattern).test(target)
            : target.toLowerCase() === pattern.toLowerCase();
    });
}

function clickHouseRegexForPattern(pattern: string): string {
    const { method } = splitMethodAndPath(pattern);
    const source = pattern
        .toLowerCase()
        .split('*')
        .map(escapeRegExp)
        .join('.*');
    return method ? `^${source}$` : `^[a-z]+\\s+${source}$`;
}

export function buildClickHouseIgnoredEndpointCondition(
    patterns: string[],
    endpointColumn = 'endpoint',
    paramPrefix = 'ignoredEndpoint',
    methodColumn?: string,
    pathColumn?: string,
): { condition: string; queryParams: Record<string, string> } {
    const normalizedPatterns = normalizeIgnoredApiEndpointPatterns(patterns);
    if (normalizedPatterns.length === 0) return { condition: '', queryParams: {} };

    const queryParams: Record<string, string> = {};
    const clauses = normalizedPatterns.map((pattern, index) => {
        const paramName = `${paramPrefix}${index}`;
        const { method, path } = splitMethodAndPath(pattern);
        if (pattern.includes('*')) {
            queryParams[paramName] = clickHouseRegexForPattern(pattern);
            const matchExpressions = [`match(lower(${endpointColumn}), {${paramName}: String})`];
            if (methodColumn && pathColumn) {
                matchExpressions.push(`match(concat(lower(${methodColumn}), ' ', lower(${pathColumn})), {${paramName}: String})`);
            }
            return `AND NOT (${matchExpressions.join(' OR ')})`;
        }

        if (method) {
            const methodParamName = `${paramName}Method`;
            const pathParamName = `${paramName}Path`;
            queryParams[paramName] = pattern.toLowerCase();
            queryParams[methodParamName] = method.toLowerCase();
            queryParams[pathParamName] = path.toLowerCase();
            const separateShape = methodColumn
                ? ` OR (lower(${methodColumn}) = {${methodParamName}: String} AND lower(${endpointColumn}) = {${pathParamName}: String})`
                : '';
            const pathShape = methodColumn && pathColumn
                ? ` OR (lower(${methodColumn}) = {${methodParamName}: String} AND lower(${pathColumn}) = {${pathParamName}: String})`
                : '';
            return `AND NOT (lower(${endpointColumn}) = {${paramName}: String}${separateShape}${pathShape})`;
        }

        const suffixParamName = `${paramName}Suffix`;
        queryParams[paramName] = pattern.toLowerCase();
        queryParams[suffixParamName] = `% ${pattern.toLowerCase()}`;
        const pathShape = pathColumn ? ` OR lower(${pathColumn}) = {${paramName}: String}` : '';
        return `AND NOT (lower(${endpointColumn}) = {${paramName}: String} OR lower(${endpointColumn}) LIKE {${suffixParamName}: String}${pathShape})`;
    });

    return {
        condition: clauses.join('\n'),
        queryParams,
    };
}
