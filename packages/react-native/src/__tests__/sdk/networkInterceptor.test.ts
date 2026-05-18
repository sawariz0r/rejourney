import { afterEach, describe, expect, it } from 'vitest';
import {
  disableNetworkInterceptor,
  getNetworkInterceptorStats,
  initNetworkInterceptor,
  restoreNetworkInterceptor,
  shouldIgnoreNetworkUrl,
} from '../../sdk/networkInterceptor';

describe('networkInterceptor lifecycle', () => {
  afterEach(() => {
    restoreNetworkInterceptor();
  });

  it('re-enables interception when init is called after disable', () => {
    initNetworkInterceptor(() => {});
    expect(getNetworkInterceptorStats().enabled).toBe(true);

    disableNetworkInterceptor();
    expect(getNetworkInterceptorStats().enabled).toBe(false);

    initNetworkInterceptor(() => {});
    expect(getNetworkInterceptorStats().enabled).toBe(true);
  });

  it('ignores Rejourney ingest and upload relay URLs across hosts', () => {
    expect(shouldIgnoreNetworkUrl('https://api.rejourney.co/api/sdk/config')).toBe(true);
    expect(shouldIgnoreNetworkUrl('https://api.rejourney.co/api/ingest/presign')).toBe(true);
    expect(shouldIgnoreNetworkUrl('https://ingest.example.com/upload/artifacts/artifact_123?token=secret')).toBe(true);
    expect(shouldIgnoreNetworkUrl('/upload/artifacts/artifact_123?token=secret')).toBe(true);
  });

  it('keeps app API traffic visible unless a custom ignore rule matches', () => {
    expect(shouldIgnoreNetworkUrl('https://app.example.com/api/orders')).toBe(false);
    expect(shouldIgnoreNetworkUrl('https://app.example.com/api/ingestor')).toBe(false);

    expect(shouldIgnoreNetworkUrl('https://app.example.com/api/health', {
      ignoreUrls: ['/api/health'],
    })).toBe(true);

    expect(shouldIgnoreNetworkUrl('https://selfhosted.example.com/rejourney/api/custom', {
      ignoreUrls: ['https://selfhosted.example.com/rejourney'],
    })).toBe(true);

    expect(shouldIgnoreNetworkUrl('https://analytics.example.com/v1/events', {
      ignoreUrls: [/analytics\.example\.com/],
    })).toBe(true);
  });
});
