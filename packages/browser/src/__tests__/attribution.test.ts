import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureAttribution } from '../sdk/attribution.js';
import { mergeWebConfig } from '../sdk/config.js';

function stubBrowserLocation(href: string, referrer = ''): void {
  const location = new URL(href);
  vi.stubGlobal('window', { location });
  vi.stubGlobal('document', { referrer });
  vi.stubGlobal('performance', {
    getEntriesByType: (type: string) => type === 'navigation' ? [{ type: 'navigate' }] : [],
  });
}

describe('web attribution capture', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('captures UTM params case-insensitively and preserves click ids when enabled', () => {
    stubBrowserLocation(
      'https://shop.example.com/landing?UTM_Source=Newsletter&utm_medium=email&utm_campaign=Spring&utm_id=cmp_42&gclid=click-123&email=secret@example.com',
      'https://www.google.com/search?q=shop',
    );

    const config = mergeWebConfig('rj_live_test', {
      attribution: { preserveClickIds: true },
    });
    const attribution = captureAttribution(config, 'Landing');

    expect(attribution?.source).toBe('Newsletter');
    expect(attribution?.medium).toBe('email');
    expect(attribution?.campaign).toBe('Spring');
    expect(attribution?.campaignId).toBe('cmp_42');
    expect(attribution?.entryQuery).toMatchObject({
      utm_source: 'Newsletter',
      utm_medium: 'email',
      utm_campaign: 'Spring',
      utm_id: 'cmp_42',
      gclid: 'click-123',
    });
    expect(attribution?.clickIds).toEqual({ gclid: 'click-123' });
    expect(attribution?.entryPath).toContain('UTM_Source=Newsletter');
    expect(attribution?.entryPath).toContain('email=%5BREDACTED%5D');
    expect(attribution?.referrerDomain).toBe('www.google.com');
    expect(attribution?.channel).toBe('email');
  });
});
