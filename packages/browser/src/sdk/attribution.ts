import { CLICK_ID_PARAMS, DEFAULT_ALLOWED_ATTRIBUTION_PARAMS } from './constants.js';
import { getDocument, getLocation } from './browser.js';
import { referrerDomain, scrubUrl } from './urlScrubber.js';
import type { AcquisitionChannel, RejourneyWebConfig, WebAttributionContext } from './types.js';

export interface WebAttributionSnapshot {
  href: string;
  referrer: string;
  routeName?: string;
  navigationType: WebAttributionContext['navigationType'];
}

let initialAttributionSnapshot: WebAttributionSnapshot | null = null;

function getNavigationType(): WebAttributionContext['navigationType'] {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
    return 'unknown';
  }

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const type = navigation?.type;
  if (type === 'navigate' || type === 'reload' || type === 'back_forward' || type === 'prerender') {
    return type;
  }
  return 'unknown';
}

function normalizeHost(host: string | null | undefined): string {
  return (host || '').toLowerCase().replace(/^www\./, '');
}

function getQueryValue(params: URLSearchParams, key: string): string | null {
  const exact = params.get(key);
  if (exact) return exact;

  const lowerKey = key.toLowerCase();
  for (const [candidate, value] of params.entries()) {
    if (candidate.toLowerCase() === lowerKey && value) return value;
  }
  return null;
}

function hasQueryParam(params: URLSearchParams, key: string): boolean {
  if (params.has(key)) return true;
  const lowerKey = key.toLowerCase();
  for (const candidate of params.keys()) {
    if (candidate.toLowerCase() === lowerKey) return true;
  }
  return false;
}

function collectQueryValues(params: URLSearchParams, keys: string[]): Record<string, string> {
  const query: Record<string, string> = {};
  const seen = new Set<string>();

  for (const key of keys) {
    const normalizedKey = key.toLowerCase();
    if (seen.has(normalizedKey)) continue;
    seen.add(normalizedKey);

    const value = getQueryValue(params, key);
    if (value) query[normalizedKey] = value.slice(0, 256);
  }
  return query;
}

function attributionSignalScore(snapshot: WebAttributionSnapshot | null, allowedQueryParams = DEFAULT_ALLOWED_ATTRIBUTION_PARAMS): number {
  if (!snapshot) return 0;
  try {
    const url = new URL(snapshot.href);
    const params = url.searchParams;
    let score = 0;
    for (const key of allowedQueryParams) {
      if (getQueryValue(params, key)) score += 8;
    }
    for (const key of CLICK_ID_PARAMS) {
      if (getQueryValue(params, key)) score += 6;
    }
    if (snapshot.referrer) score += 3;
    return score;
  } catch {
    return snapshot.referrer ? 3 : 0;
  }
}

function classifyChannel(params: URLSearchParams, referrerHost: string | null, currentHost: string): AcquisitionChannel {
  const medium = getQueryValue(params, 'utm_medium')?.toLowerCase() || '';
  const source = getQueryValue(params, 'utm_source')?.toLowerCase() || '';
  const normalizedReferrerHost = normalizeHost(referrerHost);
  const normalizedCurrentHost = normalizeHost(currentHost);

  if (medium) {
    if (/cpc|ppc|paidsearch|paid_search/.test(medium)) return 'paid_search';
    if (/paid.*social|social_paid/.test(medium)) return 'paid_social';
    if (/social/.test(medium)) return 'organic_social';
    if (/email|newsletter/.test(medium)) return 'email';
    if (/affiliate/.test(medium)) return 'affiliate';
    if (/display|banner|programmatic/.test(medium)) return 'display';
  }

  if (hasQueryParam(params, 'gclid') || hasQueryParam(params, 'gbraid') || hasQueryParam(params, 'wbraid') || hasQueryParam(params, 'msclkid')) return 'paid_search';
  if (hasQueryParam(params, 'fbclid') || hasQueryParam(params, 'ttclid') || hasQueryParam(params, 'twclid') || hasQueryParam(params, 'li_fat_id')) return 'paid_social';
  if (source && /facebook|instagram|tiktok|twitter|linkedin|reddit|pinterest|threads|youtube|(^|[._-])x($|[._-])/.test(source)) return 'organic_social';
  if (!normalizedReferrerHost) return 'direct';
  if (normalizedReferrerHost === normalizedCurrentHost) return 'internal';
  if (/google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave/.test(normalizedReferrerHost)) return 'organic_search';
  return 'referral';
}

export function captureAttributionSnapshot(config: RejourneyWebConfig, routeName?: string): WebAttributionSnapshot | null {
  if (config.captureAttribution === false) return null;

  const location = getLocation();
  const doc = getDocument();
  if (!location || !doc) return null;

  return {
    href: location.href,
    referrer: doc.referrer || '',
    routeName: routeName || location.pathname,
    navigationType: getNavigationType(),
  };
}

export function rememberInitialAttributionSnapshot(snapshot = captureAttributionSnapshot({ captureAttribution: true })): void {
  if (!snapshot) return;
  if (attributionSignalScore(snapshot) >= attributionSignalScore(initialAttributionSnapshot)) {
    initialAttributionSnapshot = snapshot;
  }
}

export function clearRememberedInitialAttributionSnapshot(): void {
  initialAttributionSnapshot = null;
}

export function getAttributionSnapshotForInit(config: RejourneyWebConfig, routeName?: string): WebAttributionSnapshot | null {
  if (config.captureAttribution === false) return null;
  const currentSnapshot = captureAttributionSnapshot(config, routeName);
  const allowedQueryParams = [
    ...DEFAULT_ALLOWED_ATTRIBUTION_PARAMS,
    ...(config.attribution?.allowedQueryParams || []),
  ];

  return attributionSignalScore(initialAttributionSnapshot, allowedQueryParams) > attributionSignalScore(currentSnapshot, allowedQueryParams)
    ? initialAttributionSnapshot
    : currentSnapshot;
}

export function buildAttributionFromSnapshot(
  config: RejourneyWebConfig,
  snapshot: WebAttributionSnapshot | null,
  routeName?: string,
): WebAttributionContext | null {
  if (config.captureAttribution === false || !snapshot) return null;

  const allowedQueryParams = config.attribution?.allowedQueryParams || DEFAULT_ALLOWED_ATTRIBUTION_PARAMS;
  const attributionQueryParams = config.attribution?.preserveClickIds === true
    ? [...allowedQueryParams, ...CLICK_ID_PARAMS]
    : allowedQueryParams;
  const allowlisted = new Set(attributionQueryParams.map((key) => key.toLowerCase()));
  const url = new URL(snapshot.href);
  const entryQuery = collectQueryValues(url.searchParams, attributionQueryParams);

  const clickIds: Record<string, string> = {};
  if (config.attribution?.preserveClickIds === true) {
    for (const key of CLICK_ID_PARAMS) {
      const value = getQueryValue(url.searchParams, key);
      if (value) clickIds[key] = value.slice(0, 256);
    }
  }

  const referrerCapture = config.attribution?.captureReferrer ?? 'domain-only';
  const rawReferrer = snapshot.referrer || '';
  const domain = referrerDomain(rawReferrer);
  const referrer = referrerCapture === false
    ? null
    : referrerCapture === 'domain-only'
      ? domain
      : scrubUrl(rawReferrer);

  const entryPath = scrubUrl(snapshot.href, { allowedQueryParams, pathOnly: true });
  const entryUrl = config.attribution?.captureEntryUrl === false
    ? ''
    : config.attribution?.captureEntryUrl === 'path-only'
      ? entryPath
      : scrubUrl(snapshot.href, { allowedQueryParams: [...allowlisted] });
  const utm = collectQueryValues(url.searchParams, DEFAULT_ALLOWED_ATTRIBUTION_PARAMS);

  const context: WebAttributionContext = {
    entryUrl,
    entryPath,
    entryQuery,
    referrer,
    referrerDomain: domain,
    source: getQueryValue(url.searchParams, 'utm_source'),
    medium: getQueryValue(url.searchParams, 'utm_medium'),
    campaign: getQueryValue(url.searchParams, 'utm_campaign'),
    term: getQueryValue(url.searchParams, 'utm_term'),
    content: getQueryValue(url.searchParams, 'utm_content'),
    campaignId: getQueryValue(url.searchParams, 'utm_id'),
    sourcePlatform: getQueryValue(url.searchParams, 'utm_source_platform'),
    creativeFormat: getQueryValue(url.searchParams, 'utm_creative_format'),
    marketingTactic: getQueryValue(url.searchParams, 'utm_marketing_tactic'),
    utm,
    clickIds,
    landingRoute: snapshot.routeName || routeName || url.pathname,
    navigationType: snapshot.navigationType,
    channel: classifyChannel(url.searchParams, domain, url.hostname),
  };

  const nextContext = config.attribution?.beforeSendAttribution?.(context);
  return nextContext === undefined ? context : nextContext;
}

export function captureAttribution(config: RejourneyWebConfig, routeName?: string): WebAttributionContext | null {
  return buildAttributionFromSnapshot(config, captureAttributionSnapshot(config, routeName), routeName);
}
