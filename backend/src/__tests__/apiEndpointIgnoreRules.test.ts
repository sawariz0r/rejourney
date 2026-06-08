import { describe, expect, it } from 'vitest';
import {
    buildClickHouseIgnoredEndpointCondition,
    endpointMatchesIgnoredPattern,
    normalizeIgnoredApiEndpointPatterns,
} from '../utils/apiEndpointIgnoreRules.js';

describe('apiEndpointIgnoreRules', () => {
    it('normalizes and deduplicates ignored endpoint patterns', () => {
        expect(normalizeIgnoredApiEndpointPatterns([
            ' head   /generate_204 ',
            'HEAD /generate_204',
            'POST /123/httpapi',
        ])).toEqual(['HEAD /generate_204', 'POST /:id/httpapi']);
    });

    it('matches method-specific, path-only, and wildcard endpoint patterns', () => {
        expect(endpointMatchesIgnoredPattern('HEAD /generate_204', ['HEAD /generate_204'])).toBe(true);
        expect(endpointMatchesIgnoredPattern('GET /generate_204', ['HEAD /generate_204'])).toBe(false);
        expect(endpointMatchesIgnoredPattern('HEAD /generate_204', ['/generate_204'])).toBe(true);
        expect(endpointMatchesIgnoredPattern('POST /:id/httpapi', ['POST /*/httpapi'])).toBe(true);
    });

    it('builds ClickHouse predicates for combined and split endpoint shapes', () => {
        const condition = buildClickHouseIgnoredEndpointCondition(
            ['HEAD /generate_204'],
            'endpoint',
            'ignoredEndpoint',
            'method',
            'path',
        );

        expect(condition.condition).toContain('lower(endpoint) = {ignoredEndpoint0: String}');
        expect(condition.condition).toContain('lower(method) = {ignoredEndpoint0Method: String}');
        expect(condition.condition).toContain('lower(path) = {ignoredEndpoint0Path: String}');
        expect(condition.queryParams).toMatchObject({
            ignoredEndpoint0: 'head /generate_204',
            ignoredEndpoint0Method: 'head',
            ignoredEndpoint0Path: '/generate_204',
        });
    });
});
