import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAttributionFromSnapshot,
  captureAttribution,
  captureAttributionSnapshot,
  clearRememberedInitialAttributionSnapshot,
  getAttributionSnapshotForInit,
  rememberInitialAttributionSnapshot,
} from '../sdk/attribution.js';
import { mergeWebConfig } from '../sdk/config.js';
import type { AcquisitionChannel } from '../sdk/types.js';

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
    clearRememberedInitialAttributionSnapshot();
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

  it('keeps first-touch UTM and referrer when start happens after consent and URL cleanup', () => {
    const config = mergeWebConfig('rj_live_test');
    stubBrowserLocation(
      'https://shop.example.com/landing?utm_source=Newsletter&utm_medium=email&utm_campaign=Spring',
      'https://partner.example/ref',
    );

    const snapshot = captureAttributionSnapshot(config, 'Landing');
    stubBrowserLocation('https://shop.example.com/account', '');

    const attribution = buildAttributionFromSnapshot(config, snapshot, 'Account');

    expect(attribution).toMatchObject({
      source: 'Newsletter',
      medium: 'email',
      campaign: 'Spring',
      referrerDomain: 'partner.example',
      landingRoute: 'Landing',
      entryPath: '/landing?utm_source=Newsletter&utm_medium=email&utm_campaign=Spring',
      channel: 'email',
    });
  });

  it('keeps first-touch UTM/referrer when init itself is delayed but the SDK bundle loaded before consent', () => {
    stubBrowserLocation(
      'https://shop.example.com/?utm_source=google&utm_medium=cpc&utm_campaign=Brand&utm_content=hero',
      'https://www.google.com/search?q=shop',
    );
    rememberInitialAttributionSnapshot();

    stubBrowserLocation('https://shop.example.com/account', '');
    const config = mergeWebConfig('rj_live_test');
    const snapshot = getAttributionSnapshotForInit(config, 'Account');
    const attribution = buildAttributionFromSnapshot(config, snapshot, 'Account');

    expect(attribution).toMatchObject({
      source: 'google',
      medium: 'cpc',
      campaign: 'Brand',
      content: 'hero',
      referrerDomain: 'www.google.com',
      landingRoute: '/',
      entryPath: '/?utm_source=google&utm_medium=cpc&utm_campaign=Brand&utm_content=hero',
      channel: 'paid_search',
    });
  });

  it('uses current attribution when the remembered import-time URL had no useful attribution', () => {
    stubBrowserLocation('https://shop.example.com/', '');
    rememberInitialAttributionSnapshot();

    stubBrowserLocation(
      'https://shop.example.com/pricing?utm_source=linkedin&utm_medium=social&utm_campaign=Launch',
      '',
    );
    const config = mergeWebConfig('rj_live_test');
    const snapshot = getAttributionSnapshotForInit(config, 'Pricing');
    const attribution = buildAttributionFromSnapshot(config, snapshot, 'Pricing');

    expect(attribution).toMatchObject({
      source: 'linkedin',
      medium: 'social',
      campaign: 'Launch',
      landingRoute: 'Pricing',
      channel: 'organic_social',
    });
  });

  it('does not resurrect remembered attribution when captureAttribution is disabled', () => {
    stubBrowserLocation('https://shop.example.com/?utm_source=google', 'https://www.google.com/');
    rememberInitialAttributionSnapshot();

    stubBrowserLocation('https://shop.example.com/account', '');
    const config = mergeWebConfig('rj_live_test', { captureAttribution: false });

    expect(getAttributionSnapshotForInit(config, 'Account')).toBeNull();
    expect(captureAttribution(config, 'Account')).toBeNull();
  });

  it('captures every supported UTM field, even when query keys use different casing', () => {
    stubBrowserLocation(
      'https://shop.example.com/landing?UTM_Source=Google&utm_MEDIUM=cpc&utm_campaign=Spring&utm_id=cmp_42&utm_term=session%20replay&utm_content=hero_cta&utm_source_platform=google_ads&utm_creative_format=video&utm_marketing_tactic=retargeting',
      'https://www.google.com/search?q=shop',
    );

    const attribution = captureAttribution(mergeWebConfig('rj_live_test'));

    expect(attribution).toMatchObject({
      source: 'Google',
      medium: 'cpc',
      campaign: 'Spring',
      campaignId: 'cmp_42',
      term: 'session replay',
      content: 'hero_cta',
      sourcePlatform: 'google_ads',
      creativeFormat: 'video',
      marketingTactic: 'retargeting',
      utm: {
        utm_source: 'Google',
        utm_medium: 'cpc',
        utm_campaign: 'Spring',
        utm_id: 'cmp_42',
        utm_term: 'session replay',
        utm_content: 'hero_cta',
        utm_source_platform: 'google_ads',
        utm_creative_format: 'video',
        utm_marketing_tactic: 'retargeting',
      },
    });
  });

  it('still prefers remembered UTM when a custom query allowlist omits standard UTM keys', () => {
    stubBrowserLocation(
      'https://shop.example.com/landing?utm_source=newsletter&utm_medium=email&utm_campaign=May&partner_id=abc',
      '',
    );
    rememberInitialAttributionSnapshot();

    stubBrowserLocation('https://shop.example.com/landing', '');
    const config = mergeWebConfig('rj_live_test', {
      attribution: { allowedQueryParams: ['partner_id'] },
    });
    const attribution = buildAttributionFromSnapshot(config, getAttributionSnapshotForInit(config), undefined);

    expect(attribution).toMatchObject({
      source: 'newsletter',
      medium: 'email',
      campaign: 'May',
      channel: 'email',
    });
    expect(attribution?.entryQuery).toEqual({ partner_id: 'abc' });
    expect(attribution?.utm).toMatchObject({
      utm_source: 'newsletter',
      utm_medium: 'email',
      utm_campaign: 'May',
    });
  });

  it('redacts sensitive query params while preserving attribution params', () => {
    stubBrowserLocation(
      'https://shop.example.com/welcome?utm_source=google&email=buyer@example.com&token=super-secret',
      'https://partner.example/ref?email=partner@example.com',
    );

    const attribution = captureAttribution(mergeWebConfig('rj_live_test', {
      attribution: { captureEntryUrl: true, captureReferrer: true },
    }));

    expect(attribution?.entryUrl).toBe('https://shop.example.com/welcome?utm_source=google&email=%5BREDACTED%5D&token=%5BREDACTED%5D');
    expect(attribution?.entryQuery).toEqual({ utm_source: 'google' });
    expect(attribution?.referrer).toBe('https://partner.example/ref?email=%5BREDACTED%5D');
  });

  it('honors referrer capture modes', () => {
    stubBrowserLocation(
      'https://shop.example.com/landing?utm_source=partner',
      'https://partner.example/ref/path?campaign=abc&email=seller@example.com',
    );

    const domainOnly = captureAttribution(mergeWebConfig('rj_live_test'));
    const full = captureAttribution(mergeWebConfig('rj_live_test', { attribution: { captureReferrer: true } }));
    const disabled = captureAttribution(mergeWebConfig('rj_live_test', { attribution: { captureReferrer: false } }));

    expect(domainOnly?.referrer).toBe('partner.example');
    expect(domainOnly?.referrerDomain).toBe('partner.example');
    expect(full?.referrer).toBe('https://partner.example/ref/path?campaign=abc&email=%5BREDACTED%5D');
    expect(disabled?.referrer).toBeNull();
    expect(disabled?.referrerDomain).toBe('partner.example');
  });

  it('lets beforeSendAttribution transform or drop attribution', () => {
    stubBrowserLocation('https://shop.example.com/?utm_source=google', '');
    const transformed = captureAttribution(mergeWebConfig('rj_live_test', {
      attribution: {
        beforeSendAttribution: (context) => ({ ...context, source: 'rewritten' }),
      },
    }));
    const dropped = captureAttribution(mergeWebConfig('rj_live_test', {
      attribution: {
        beforeSendAttribution: () => null,
      },
    }));

    expect(transformed?.source).toBe('rewritten');
    expect(dropped).toBeNull();
  });

  it.each([
    ['https://shop.example.com/', '', 'direct'],
    ['https://shop.example.com/', 'https://shop.example.com/pricing', 'internal'],
    ['https://shop.example.com/', 'https://www.bing.com/search?q=shop', 'organic_search'],
    ['https://shop.example.com/', 'https://partner.example/review', 'referral'],
    ['https://shop.example.com/?gclid=abc', '', 'paid_search'],
    ['https://shop.example.com/?msclkid=abc', '', 'paid_search'],
    ['https://shop.example.com/?fbclid=abc', '', 'paid_social'],
    ['https://shop.example.com/?utm_source=instagram&utm_medium=social', '', 'organic_social'],
    ['https://shop.example.com/?utm_source=tiktok&utm_medium=paid_social', '', 'paid_social'],
    ['https://shop.example.com/?utm_source=newsletter&utm_medium=email', '', 'email'],
    ['https://shop.example.com/?utm_source=partner&utm_medium=affiliate', '', 'affiliate'],
    ['https://shop.example.com/?utm_source=adroll&utm_medium=display', '', 'display'],
  ] satisfies Array<[string, string, AcquisitionChannel]>)(
    'classifies channel %s / %s as %s',
    (href, referrer, expectedChannel) => {
      stubBrowserLocation(href, referrer);

      expect(captureAttribution(mergeWebConfig('rj_live_test'))?.channel).toBe(expectedChannel);
    },
  );
});
