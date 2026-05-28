import { getDocument, getLocation } from './browser.js';

const UNKNOWN_APP_VERSION = 'unknown';
const MAX_APP_VERSION_LENGTH = 128;
const APP_VERSION_FETCH_TIMEOUT_MS = 350;

const META_VERSION_KEYS = [
  'app-version',
  'application-version',
  'build-version',
  'release-version',
  'release',
  'version',
  'revision',
  'commit-sha',
  'git-sha',
  'sentry-release',
  'sentry:release',
];

const DATA_VERSION_ATTRIBUTES = [
  'data-app-version',
  'data-application-version',
  'data-build-version',
  'data-release-version',
  'data-release',
  'data-version',
  'data-revision',
  'data-commit-sha',
  'data-git-sha',
];

const GLOBAL_VERSION_PATHS = [
  ['__REJOURNEY_APP_VERSION__'],
  ['__APP_VERSION__'],
  ['APP_VERSION'],
  ['__APP_RELEASE__'],
  ['APP_RELEASE'],
  ['__BUILD_VERSION__'],
  ['BUILD_VERSION'],
  ['__BUILD_ID__'],
  ['BUILD_ID'],
  ['__COMMIT_SHA__'],
  ['COMMIT_SHA'],
  ['__GIT_SHA__'],
  ['GIT_SHA'],
  ['SENTRY_RELEASE', 'id'],
  ['SENTRY_RELEASE'],
  ['__NEXT_DATA__', 'buildId'],
  ['__webpack_hash__'],
];

const JSON_VERSION_PATHS = [
  ['version'],
  ['appVersion'],
  ['app_version'],
  ['applicationVersion'],
  ['buildVersion'],
  ['build_version'],
  ['releaseVersion'],
  ['release'],
  ['revision'],
  ['commitSha'],
  ['commit_sha'],
  ['gitSha'],
  ['git_sha'],
  ['build', 'version'],
  ['build', 'id'],
  ['build', 'sha'],
];

function normalizeAppVersion(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const normalized = String(value).trim();
  if (!normalized) return undefined;
  if (/[<>{}\[\]\n\r]/.test(normalized)) return undefined;
  return normalized.slice(0, MAX_APP_VERSION_LENGTH);
}

function readObjectPath(source: unknown, path: string[]): unknown {
  let current = source;
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function readVersionFromObject(source: unknown): string | undefined {
  for (const path of JSON_VERSION_PATHS) {
    const version = normalizeAppVersion(readObjectPath(source, path));
    if (version) return version;
  }
  return undefined;
}

function detectGlobalAppVersion(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const win = window as unknown as Record<string, unknown>;
  for (const path of GLOBAL_VERSION_PATHS) {
    const version = normalizeAppVersion(readObjectPath(win, path));
    if (version) return version;
  }
  return undefined;
}

function detectDomAppVersion(): string | undefined {
  const doc = getDocument();
  if (!doc) return undefined;

  const allowedMetaKeys = new Set(META_VERSION_KEYS);
  for (const meta of Array.from(doc.querySelectorAll('meta'))) {
    const key = (
      meta.getAttribute('name') ||
      meta.getAttribute('property') ||
      meta.getAttribute('http-equiv') ||
      meta.getAttribute('itemprop') ||
      ''
    ).trim().toLowerCase();
    if (!allowedMetaKeys.has(key)) continue;
    const version = normalizeAppVersion(meta.getAttribute('content'));
    if (version) return version;
  }

  const elements: Array<Element | null> = [doc.documentElement, doc.body, doc.currentScript];
  for (const script of Array.from(doc.scripts || [])) elements.push(script);
  for (const element of elements) {
    if (!element) continue;
    for (const attribute of DATA_VERSION_ATTRIBUTES) {
      const version = normalizeAppVersion(element.getAttribute(attribute));
      if (version) return version;
    }
  }

  return undefined;
}

function collectVersionJsonUrls(): string[] {
  const doc = getDocument();
  const location = getLocation();
  if (!location) return [];

  const urls: string[] = [];
  const pushSameOrigin = (value: string | null | undefined) => {
    if (!value) return;
    try {
      const url = new URL(value, location.href);
      if (url.origin !== location.origin) return;
      if (urls.includes(url.href)) return;
      urls.push(url.href);
    } catch {
      // Ignore malformed version hints.
    }
  };

  pushSameOrigin(doc?.querySelector<HTMLLinkElement>('link[rel~="manifest"]')?.href);
  pushSameOrigin('/version.json');
  pushSameOrigin('/build.json');
  pushSameOrigin('/package.json');

  return urls.slice(0, 4);
}

async function fetchJsonVersion(url: string): Promise<string | undefined> {
  if (typeof fetch !== 'function') return undefined;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = typeof setTimeout !== 'undefined' && controller
    ? setTimeout(() => controller.abort(), APP_VERSION_FETCH_TIMEOUT_MS)
    : null;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'force-cache',
      signal: controller?.signal,
    });
    if (!response.ok) return undefined;
    const payload = await response.json().catch(() => null);
    return readVersionFromObject(payload);
  } catch {
    return undefined;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let fetchedAppVersion: Promise<string | undefined> | null = null;

async function detectFetchedAppVersion(): Promise<string | undefined> {
  fetchedAppVersion ??= Promise.all(collectVersionJsonUrls().map((url) => fetchJsonVersion(url)))
    .then((versions) => versions.find(Boolean));
  return fetchedAppVersion;
}

export function detectAppVersionSync(): string | undefined {
  return detectGlobalAppVersion() || detectDomAppVersion();
}

export async function detectAppVersion(): Promise<string> {
  return detectAppVersionSync() || await detectFetchedAppVersion() || UNKNOWN_APP_VERSION;
}
