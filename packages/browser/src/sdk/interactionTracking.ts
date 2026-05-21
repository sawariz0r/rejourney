import { CLICK_ID_PARAMS, DEFAULT_ALLOWED_ATTRIBUTION_PARAMS } from './constants.js';
import { scrubUrl } from './urlScrubber.js';
import type { RejourneyEvent, RejourneyWebConfig, WebLinkClickContext } from './types.js';

let cleanupFns: Array<() => void> = [];
let lastScrollAt = 0;
const recentClicks: Array<{ x: number; y: number; timestamp: number }> = [];

function isAnchorElement(value: unknown): value is HTMLAnchorElement {
  if (!value || typeof value !== 'object') return false;
  const element = value as HTMLElement;
  return element.tagName?.toLowerCase() === 'a' && typeof (element as HTMLAnchorElement).href === 'string';
}

function findAnchorFromClick(event: MouseEvent): HTMLAnchorElement | null {
  if (typeof event.composedPath === 'function') {
    const anchor = event.composedPath().find(isAnchorElement);
    if (anchor) return anchor;
  }

  const target = event.target;
  if (target && typeof (target as Element).closest === 'function') {
    const closest = (target as Element).closest('a[href]');
    if (isAnchorElement(closest)) return closest;
  }

  return null;
}

function normalizeLinkText(value: string | null | undefined): string | null {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  const scrubbed = normalized
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\+?[0-9][0-9 .()_-]{7,}[0-9]/g, '[phone]')
    .replace(/\b[A-Za-z0-9._~+/=-]{32,}\b/g, '[token]');

  return scrubbed.slice(0, 120);
}

function readAnchorText(anchor: HTMLAnchorElement): string | null {
  return normalizeLinkText(
    anchor.getAttribute('aria-label') ||
    anchor.getAttribute('title') ||
    anchor.textContent,
  );
}

function getAllowedLinkQueryParams(config: RejourneyWebConfig): string[] {
  if (config.linkTracking?.allowedQueryParams) return config.linkTracking.allowedQueryParams;
  const allowed = config.attribution?.allowedQueryParams || DEFAULT_ALLOWED_ATTRIBUTION_PARAMS;
  return config.attribution?.preserveClickIds === true ? [...allowed, ...CLICK_ID_PARAMS] : allowed;
}

function scrubLinkHref(parsed: URL, allowedQueryParams: string[]): string {
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    return scrubUrl(parsed.href, { allowedQueryParams });
  }
  if (parsed.protocol === 'mailto:') return 'mailto:[email]';
  if (parsed.protocol === 'tel:') return 'tel:[phone]';
  return parsed.protocol ? parsed.protocol.replace(/:$/, '') : 'unknown';
}

export function buildLinkClickContext(event: MouseEvent, config: RejourneyWebConfig): WebLinkClickContext | null {
  if (config.autoTrackLinks === false) return null;

  const anchor = findAnchorFromClick(event);
  if (!anchor) return null;

  const rawHref = anchor.getAttribute('href') || anchor.href;
  if (!rawHref || rawHref.trim().startsWith('#')) return null;

  let parsed: URL;
  try {
    parsed = new URL(anchor.href, window.location.href);
  } catch {
    return null;
  }

  const allowedQueryParams = getAllowedLinkQueryParams(config);
  const currentOrigin = window.location.origin;
  const webUrl = parsed.protocol === 'http:' || parsed.protocol === 'https:';
  const sameOrigin = webUrl && parsed.origin === currentOrigin;

  return {
    href: scrubLinkHref(parsed, allowedQueryParams),
    path: sameOrigin ? scrubUrl(parsed.href, { allowedQueryParams, pathOnly: true }) : null,
    host: parsed.host || null,
    protocol: parsed.protocol ? parsed.protocol.replace(/:$/, '') : null,
    text: config.linkTracking?.captureText === false ? null : readAnchorText(anchor),
    target: anchor.target || null,
    rel: anchor.rel || null,
    download: anchor.hasAttribute('download'),
    external: !sameOrigin,
    sameOrigin,
    modifierKey: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
  };
}

function linkClickProperties(link: WebLinkClickContext, screenName: string | undefined): Record<string, unknown> {
  return {
    linkHref: link.href,
    linkPath: link.path,
    linkHost: link.host,
    linkProtocol: link.protocol,
    linkText: link.text,
    linkTarget: link.target,
    linkRel: link.rel,
    linkDownload: link.download,
    linkExternal: link.external,
    linkSameOrigin: link.sameOrigin,
    modifierKey: link.modifierKey,
    screen: screenName,
    screenName,
  };
}

function getPageMetrics(): {
  viewportWidth: number;
  viewportHeight: number;
  documentWidth: number;
  documentHeight: number;
  scrollX: number;
  scrollY: number;
} {
  const root = document.documentElement;
  const body = document.body;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const documentWidth = Math.max(
    viewportWidth,
    root?.scrollWidth || 0,
    root?.offsetWidth || 0,
    body?.scrollWidth || 0,
    body?.offsetWidth || 0,
  );
  const documentHeight = Math.max(
    viewportHeight,
    root?.scrollHeight || 0,
    root?.offsetHeight || 0,
    body?.scrollHeight || 0,
    body?.offsetHeight || 0,
  );

  return {
    viewportWidth,
    viewportHeight,
    documentWidth,
    documentHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  };
}

export function initInteractionTracking(
  getScreen: () => string | null,
  callback: (event: RejourneyEvent) => void,
  config: RejourneyWebConfig,
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  cleanupInteractionTracking();

  const onClick = (event: MouseEvent) => {
    const timestamp = Date.now();
    const x = event.clientX;
    const y = event.clientY;
    const screenName = getScreen() || undefined;
    const link = buildLinkClickContext(event, config);
    const linkProperties = link ? linkClickProperties(link, screenName) : null;
    const pageMetrics = getPageMetrics();

    callback({
      type: 'tap',
      timestamp,
      x,
      y,
      screen: screenName,
      screenName,
      ...pageMetrics,
      payload: linkProperties || undefined,
    });

    if (linkProperties) {
      callback({
        type: 'link_click',
        timestamp,
        name: 'link_click',
        properties: linkProperties,
        payload: linkProperties,
      });
    }

    while (recentClicks.length > 0 && timestamp - recentClicks[0]!.timestamp > 500) {
      recentClicks.shift();
    }
    const nearbyClicks = recentClicks.filter((click) => Math.abs(click.x - x) < 50 && Math.abs(click.y - y) < 50);
    recentClicks.push({ x, y, timestamp });

    if (nearbyClicks.length >= 2) {
      callback({
        type: 'rage_tap',
        timestamp,
        x,
        y,
        screen: screenName,
        screenName,
        ...pageMetrics,
      });
    }
  };

  const onScroll = () => {
    const timestamp = Date.now();
    if (timestamp - lastScrollAt < 500) return;
    lastScrollAt = timestamp;
    callback({
      type: 'scroll',
      timestamp,
      screen: getScreen() || undefined,
      screenName: getScreen() || undefined,
      ...getPageMetrics(),
    });
  };

  document.addEventListener('click', onClick, true);
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanupFns = [
    () => document.removeEventListener('click', onClick, true),
    () => window.removeEventListener('scroll', onScroll),
  ];
}

export function cleanupInteractionTracking(): void {
  cleanupFns.forEach((cleanup) => cleanup());
  cleanupFns = [];
  lastScrollAt = 0;
  recentClicks.splice(0, recentClicks.length);
}
