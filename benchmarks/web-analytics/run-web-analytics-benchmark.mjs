#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { chromium } from 'playwright';

const benchmarkDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(benchmarkDir, '..', '..');
const resultsRoot = path.join(benchmarkDir, 'results');

const APPS = [
  {
    id: 'next',
    label: 'Next.js App Router',
    cwd: path.join(repoRoot, 'examples', 'web-next'),
    port: 3100,
    publicOrigin: 'http://localhost:5174',
    rejourneyEnv: {
      NEXT_PUBLIC_REJOURNEY_KEY: 'rj_benchmark_public_key',
      NEXT_PUBLIC_REJOURNEY_API_URL: null,
    },
    clearEnv: ['NEXT_PUBLIC_REJOURNEY_KEY', 'NEXT_PUBLIC_REJOURNEY_API_URL'],
  },
  {
    id: 'sveltekit',
    label: 'SvelteKit',
    cwd: path.join(repoRoot, 'examples', 'web-sveltekit'),
    port: 3101,
    publicOrigin: 'http://localhost:8000',
    rejourneyEnv: {
      PUBLIC_REJOURNEY_KEY: 'rj_benchmark_public_key',
      PUBLIC_REJOURNEY_API_URL: null,
    },
    clearEnv: ['PUBLIC_REJOURNEY_KEY', 'PUBLIC_REJOURNEY_API_URL'],
  },
  {
    id: 'nuxt',
    label: 'Nuxt 3',
    cwd: path.join(repoRoot, 'examples', 'web-nuxt'),
    port: 3102,
    publicOrigin: 'http://localhost:8001',
    rejourneyEnv: {
      NUXT_PUBLIC_REJOURNEY_KEY: 'rj_benchmark_public_key',
      NUXT_PUBLIC_REJOURNEY_API_URL: null,
    },
    clearEnv: ['NUXT_PUBLIC_REJOURNEY_KEY', 'NUXT_PUBLIC_REJOURNEY_API_URL'],
  },
];

const DEFAULT_MODES = ['baseline', 'rejourney', 'posthog'];
const iterations = positiveInteger(process.env.BENCHMARK_ITERATIONS, 3);
const requestedModes = listFromEnv('BENCHMARK_MODES', DEFAULT_MODES);
const requestedApps = listFromEnv('BENCHMARK_APPS', APPS.map((app) => app.id));
const modes = DEFAULT_MODES.filter((mode) => requestedModes.includes(mode));
const apps = APPS.filter((app) => requestedApps.includes(app.id));
const rejourneyKey = process.env.REJOURNEY_KEY || '';
const rejourneyApiUrl = normalizeUrl(process.env.REJOURNEY_API_URL || 'https://api.rejourney.co');
const posthogKey = process.env.POSTHOG_KEY || '';
const posthogHost = normalizeUrl(process.env.POSTHOG_HOST || 'https://us.i.posthog.com');
const posthogDefaults = process.env.POSTHOG_DEFAULTS || '2026-01-30';
const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = path.join(resultsRoot, runTimestamp);
const viewport = { width: 1365, height: 768 };
const waitAfterInteractionsMs = positiveInteger(process.env.BENCHMARK_FLUSH_WAIT_MS, 7000);

const secretValues = [
  rejourneyKey,
  posthogKey,
  'secret-test-token',
  'super-secret-password',
  'benchmark-private-note',
  'benchmark+analytics@example.com',
].filter(Boolean);

if (modes.includes('posthog') && !posthogKey) {
  throw new Error('POSTHOG_KEY is required when BENCHMARK_MODES includes posthog.');
}
if (modes.includes('rejourney') && !rejourneyKey) {
  throw new Error('REJOURNEY_KEY is required when BENCHMARK_MODES includes rejourney.');
}

await fs.mkdir(outputDir, { recursive: true });

const packageFootprint = await collectPackageFootprint();
const browser = await chromium.launch({
  headless: true,
  args: ['--disable-dev-shm-usage'],
});

const allRuns = [];
const rejourneyCaptures = [];
const posthogCaptures = [];
let hadFailure = false;

try {
  console.log(`Writing benchmark artifacts to ${outputDir}`);
  console.log(`Modes: ${modes.join(', ')}; apps: ${apps.map((app) => app.id).join(', ')}; iterations: ${iterations}`);
  console.log(`Live analytics endpoints: Rejourney ${rejourneyApiUrl}; PostHog ${posthogHost}`);

  for (const mode of modes) {
    for (const app of apps) {
      const server = await startExampleServer(app, mode, rejourneyApiUrl);
      try {
        for (let iteration = 1; iteration <= iterations; iteration += 1) {
          const runId = `${app.id}-${mode}-${iteration}`;
          console.log(`[${runId}] starting`);
          const run = await runBrowserIteration({
            app,
            mode,
            iteration,
            runId,
            browser,
          });
          allRuns.push(run);
          rejourneyCaptures.push(...run.rejourney.captures);
          posthogCaptures.push(...run.posthog.captures);
          console.log(`[${runId}] done: ${run.summary.sdkRequestCount} sdk requests, ${run.summary.sdkUploadBodyBytes} upload bytes`);
        }
      } catch (error) {
        hadFailure = true;
        const failure = serializeError(error);
        allRuns.push({
          app: app.id,
          appLabel: app.label,
          mode,
          iteration: null,
          runId: `${app.id}-${mode}-failed`,
          failed: true,
          failure,
        });
        console.error(`[${app.id}-${mode}] failed`, failure.message);
      } finally {
        await server.stop();
      }
    }
  }
} finally {
  await browser.close().catch(() => undefined);
}

const results = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  repoRoot,
  environment: {
    node: process.version,
    platform: `${os.type()} ${os.release()} ${os.arch()}`,
    playwrightBrowser: 'chromium',
    viewport,
    iterations,
    modes,
    apps: apps.map(({ id, label, port, publicOrigin }) => ({ id, label, port, publicOrigin })),
    posthog: {
      networkMode: 'live',
      host: posthogHost,
      defaults: posthogDefaults,
      key: redact(posthogKey),
    },
    rejourney: {
      networkMode: 'live',
      apiUrl: rejourneyApiUrl,
      key: redact(rejourneyKey),
    },
  },
  methodology: {
    interactions: [
      'load home route with benchmark UTM query',
      'fill email/private-note inputs and switch plan selectors',
      'click custom event, metadata, and network-call controls',
      'perform route navigation',
      'dispatch synthetic JS error and resource error',
      'scroll page and execute an 85 ms controlled long task',
      `wait ${waitAfterInteractionsMs} ms for SDK flush timers`,
    ],
    posthogNetworkPolicy: 'PostHog static/config/event/session-upload requests are sent to the configured live PostHog project and captured locally for measurement.',
    rejourneyNetworkPolicy: 'Rejourney SDK points to the configured live Rejourney API and project; config, auth, presign, artifact upload, complete, and session-end calls are captured locally for measurement.',
  },
  packageFootprint,
  runs: allRuns,
  aggregates: aggregateRuns(allRuns),
};

const resultsJson = redactJson(results);
await fs.writeFile(path.join(outputDir, 'benchmark-results.json'), JSON.stringify(resultsJson, null, 2));
await fs.writeFile(
  path.join(outputDir, 'rejourney-live-network-captures.json'),
  JSON.stringify(redactJson(rejourneyCaptures), null, 2),
);
await fs.writeFile(path.join(outputDir, 'posthog-network-captures.json'), JSON.stringify(redactJson(posthogCaptures), null, 2));
await fs.writeFile(path.join(outputDir, 'benchmark-report.md'), renderMarkdownReport(resultsJson));

console.log(`Report: ${path.join(outputDir, 'benchmark-report.md')}`);
console.log(`Raw data: ${path.join(outputDir, 'benchmark-results.json')}`);

if (hadFailure) process.exitCode = 1;

async function runBrowserIteration({ app, mode, iteration, runId, browser }) {
  const context = await browser.newContext({
    viewport,
    ignoreHTTPSErrors: true,
    javaScriptEnabled: true,
  });

  await context.addInitScript(benchmarkObserverScript({
    mode,
    rejourneyApiUrl,
  }));
  if (mode === 'posthog') {
    const bundlePath = await findPosthogBundle();
    if (bundlePath) {
      await context.addInitScript(await fs.readFile(bundlePath, 'utf8'));
    }
    await context.addInitScript(posthogInitScript({
      key: posthogKey,
      host: posthogHost,
      defaults: posthogDefaults,
      shouldLoadCdn: !bundlePath,
    }));
  }

  const network = [];
  const posthogRequestSamples = [];

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    const requestRecord = captureRequestRecord(request, app, mode, runId);
    network.push(requestRecord);

    if (mode === 'posthog' && isPosthogUrl(url)) {
      const sample = decodeRequestBodySample(requestRecord);
      if (sample) posthogRequestSamples.push(sample);
    }

    await route.continue();
  });

  context.on('response', async (response) => {
    const request = response.request();
    const match = [...network].reverse().find((record) => (
      record.url === request.url()
      && record.method === request.method()
      && record.responseStatus === undefined
    ));
    if (!match) return;
    match.responseStatus = response.status();
    match.responseContentLength = parseInteger(await response.headerValue('content-length'));
  });

  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', (message) => {
    consoleMessages.push({
      type: message.type(),
      text: redact(message.text()).slice(0, 1000),
    });
  });
  page.on('pageerror', (error) => {
    pageErrors.push(serializeError(error));
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable').catch(() => undefined);
  const startMetrics = await cdp.send('Performance.getMetrics').catch(() => ({ metrics: [] }));

  const baseUrl = app.publicOrigin || `http://127.0.0.1:${app.port}`;
  const actions = [];
  const startedAt = Date.now();

  try {
    const rejourneyCacheBust = mode === 'rejourney' ? '1' : '0';
    await page.goto(`${baseUrl}/?utm_source=benchmark&utm_medium=automation&utm_campaign=analytics_compare&rj=${rejourneyCacheBust}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });

    if (mode === 'posthog') {
      await page.waitForFunction(() => window.__benchmarkPosthog?.ready === true, null, { timeout: 15_000 }).catch(() => undefined);
      await page.evaluate(() => {
        window.posthog?.opt_in_capturing?.();
        window.posthog?.startSessionRecording?.();
      }).catch(() => undefined);
    }

    await page.waitForTimeout(1000);
    await exerciseFixture(page, actions, mode, app.id);
    await page.waitForTimeout(waitAfterInteractionsMs);
  } finally {
    await page.evaluate(() => {
      window.posthog?.capture?.('benchmark_complete', { source: 'rejourney-benchmark' });
      window.posthog?.sessionRecording?._lazyLoadedSessionRecording?._flushBuffer?.();
      window.posthog?.sessionRecording?._lazyLoadedSessionRecording?._onBeforeUnload?.();
      window.posthog?._requestQueue?.unload?.();
      window.posthog?.flush?.();
    }).catch(() => undefined);
    if (mode === 'posthog') {
      await page.waitForTimeout(1000).catch(() => undefined);
    }
  }

  const endMetrics = await cdp.send('Performance.getMetrics').catch(() => ({ metrics: [] }));
  const client = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      url: location.href,
      title: document.title,
      benchmark: window.__analyticsBenchmark || null,
      navigation: nav ? nav.toJSON() : null,
      paints: performance.getEntriesByType('paint').map((entry) => entry.toJSON()),
      resources: performance.getEntriesByType('resource').map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        duration: Math.round(entry.duration * 100) / 100,
        transferSize: entry.transferSize || 0,
        encodedBodySize: entry.encodedBodySize || 0,
        decodedBodySize: entry.decodedBodySize || 0,
      })),
      memory: performance.memory ? {
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        usedJSHeapSize: performance.memory.usedJSHeapSize,
      } : null,
      posthog: window.posthog ? {
        version: window.posthog.version || window.posthog.__loaded || null,
        sessionRecordingStarted: window.posthog.sessionRecordingStarted?.() ?? null,
        distinctId: window.posthog.get_distinct_id?.() || null,
        isCapturing: window.posthog.is_capturing?.() ?? null,
        requestQueueLength: window.posthog._requestQueue?._queue?.length ?? null,
        bootstrapQueueLength: window.posthog.__request_queue?.length ?? null,
      } : null,
      localStorageKeys: Object.keys(localStorage).filter((key) => /rejourney|posthog/i.test(key)),
    };
  });

  const rawBeacons = client.benchmark?.beacons || [];
  const rawTransports = client.benchmark?.transports || [];
  if (client.benchmark?.beacons) {
    client.benchmark.beacons = rawBeacons.map((beacon) => ({
      ...beacon,
      bodyPreview: safeRequestBodyPreview(beacon.bodyPreview || '', beacon.url).slice(0, 2000),
    }));
  }
  if (client.benchmark?.transports) {
    client.benchmark.transports = rawTransports.map((transport) => ({
      ...transport,
      bodyPreview: safeRequestBodyPreview(transport.bodyPreview || '', transport.url).slice(0, 2000),
    }));
  }

  const posthogBrowserTransportRecords = [...rawBeacons, ...rawTransports]
    .filter((transport) => isPosthogUrl(transport.url))
    .map((transport) => ({
      runId,
      app: app.id,
      mode,
      method: transport.method || 'BEACON',
      url: transport.url,
      resourceType: transport.kind || 'beacon',
      headers: {},
      requestBodyBytes: transport.bodyBytes || 0,
      requestBodyPreview: safeRequestBodyPreview(transport.bodyPreview || '', transport.url).slice(0, 10_000),
      requestDecodedBodyPreview: decodedRequestBodyPreview(transport.bodyPreview || '', transport.url),
      responseStatus: 200,
      responseContentLength: 0,
      at: transport.at || new Date().toISOString(),
      sdk: 'posthog',
    }));
  for (const transportRecord of posthogBrowserTransportRecords) {
    if (hasEquivalentNetworkRecord(network, transportRecord)) continue;
    network.push(transportRecord);
    const sample = decodeRequestBodySample(transportRecord);
    if (sample) posthogRequestSamples.push(sample);
  }

  await context.close();

  const rejourneySummary = summarizeRejourneyNetwork(network);
  const rejourneyCaptureRecords = rejourneySummary.captures || [];
  const { captures: _captures, ...rejourneySummaryForOutput } = rejourneySummary;
  const posthogSummary = summarizePosthogRequests(posthogRequestSamples, network, client);
  const summary = summarizeRun({
    mode,
    network,
    client,
    startMetrics,
    endMetrics,
    rejourneySummary,
    posthogSummary,
    durationMs: Date.now() - startedAt,
  });

  return redactJson({
    app: app.id,
    appLabel: app.label,
    mode,
    iteration,
    runId,
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    actions,
    summary,
    client,
    cdp: {
      start: metricsObject(startMetrics.metrics),
      end: metricsObject(endMetrics.metrics),
    },
    consoleMessages,
    pageErrors,
    network: network.map(trimNetworkRecord),
    rejourney: {
      summary: rejourneySummaryForOutput,
      captures: rejourneyCaptureRecords,
    },
    posthog: {
      summary: posthogSummary,
      captures: posthogRequestSamples,
    },
  });
}

async function exerciseFixture(page, actions, mode, appId) {
  await action(actions, 'fill email inputs', async () => {
    const inputs = await page.locator('input[type="email"]').all();
    for (const input of inputs) {
      await input.fill('benchmark+analytics@example.com');
    }
  });

  await action(actions, 'fill private note textareas', async () => {
    const textareas = await page.locator('textarea').all();
    for (const textarea of textareas) {
      await textarea.fill('benchmark-private-note should be masked');
    }
  });

  await action(actions, 'select enterprise plan where available', async () => {
    const selects = await page.locator('select').all();
    for (const select of selects) {
      const values = await select.evaluate((element) => Array.from(element.options).map((option) => option.value));
      const target = values.includes('enterprise') ? 'enterprise' : values.includes('pro') ? 'pro' : values[0];
      if (target) await select.selectOption(target);
    }
  });

  await action(actions, 'click custom event control', async () => {
    await page.getByRole('button', { name: 'Log custom event' }).first().click();
  });

  await action(actions, 'click metadata control', async () => {
    await page.getByRole('button', { name: 'Set user metadata' }).first().click();
  });

  await action(actions, 'click network control', async () => {
    await page.getByRole('button', { name: 'Run network call' }).first().click();
    await page.waitForTimeout(500);
  });

  if (mode === 'posthog') {
    await action(actions, 'emit equivalent posthog custom analytics', async () => {
      await page.evaluate((fixtureAppId) => {
        window.posthog?.identify?.('web_fixture_user', { fixture: fixtureAppId, plan: 'enterprise' });
        window.posthog?.people?.set?.({ fixture: fixtureAppId, plan: 'enterprise' });
        window.posthog?.capture?.('web_fixture_custom_event', {
          fixture: fixtureAppId,
          plan: 'enterprise',
          source: 'benchmark-equivalent-event',
        });
      }, appId);
    });
  }

  await action(actions, 'perform route transition', async () => {
    const changeRoute = page.getByRole('button', { name: 'Change route' }).first();
    if (await changeRoute.count()) {
      await changeRoute.click();
      return;
    }
    await Promise.all([
      page.waitForLoadState('domcontentloaded').catch(() => undefined),
      page.getByText('Pricing Page').first().click(),
    ]);
  });

  if (mode === 'posthog') {
    await action(actions, 'emit posthog route marker', async () => {
      await page.evaluate(() => {
        window.posthog?.capture?.('$pageview', {
          $current_url: location.href,
          source: 'benchmark-route-marker',
        });
      });
    });
  }

  await action(actions, 'dispatch synthetic error/resource/long task', async () => {
    await page.evaluate(() => {
      console.log('benchmark console signal');
      window.dispatchEvent(new ErrorEvent('error', {
        message: 'Benchmark synthetic error',
        error: new Error('Benchmark synthetic error'),
        filename: location.href,
      }));
      const img = document.createElement('img');
      img.alt = '';
      img.width = 1;
      img.height = 1;
      img.style.cssText = 'position:absolute;opacity:0;pointer-events:none';
      img.src = `/missing-benchmark-image.png?benchmark=${Date.now()}`;
      document.body.appendChild(img);
      window.scrollTo(0, document.body.scrollHeight);
      const start = performance.now();
      while (performance.now() - start < 85) {
        Math.sqrt(Math.random());
      }
    });
  });

  if (mode === 'posthog') {
    await action(actions, 'emit posthog error marker', async () => {
      await page.evaluate(() => {
        window.posthog?.capture?.('benchmark_synthetic_error', {
          message: 'Benchmark synthetic error',
          source: 'benchmark-error-marker',
        });
      });
    });
  }
}

async function action(actions, label, fn) {
  const startedAt = Date.now();
  try {
    await fn();
    actions.push({ label, ok: true, durationMs: Date.now() - startedAt });
  } catch (error) {
    actions.push({ label, ok: false, durationMs: Date.now() - startedAt, error: serializeError(error).message });
  }
}

function benchmarkObserverScript({ mode, rejourneyApiUrl }) {
  return `(() => {
    try {
      Object.defineProperty(Navigator.prototype, 'webdriver', {
        configurable: true,
        get: () => false
      });
    } catch {}
    window.__analyticsBenchmark = {
      startedAt: performance.now(),
      longTasks: [],
      errors: [],
      unhandledRejections: [],
      beacons: [],
      transports: [],
      posthogCapturedEvents: [],
      posthogRrwebEvents: []
    };
    const benchmarkMode = ${JSON.stringify(mode)};
    const rejourneyApiHost = (() => {
      try {
        return new URL(${JSON.stringify(rejourneyApiUrl)}).hostname;
      } catch {
        return 'api.rejourney.co';
      }
    })();
    const isPosthogTarget = (url) => /posthog|us\\.i\\.posthog\\.com|us-assets\\.i\\.posthog\\.com/i.test(String(url || ''));
    const isRejourneyTarget = (url) => {
      try {
        const parsed = new URL(String(url || ''), location.href);
        return parsed.hostname === rejourneyApiHost || /api\\.rejourney\\.co/i.test(parsed.hostname) || /\\/api\\/sdk\\/config|\\/api\\/ingest\\//i.test(parsed.pathname);
      } catch {
        return /api\\.rejourney\\.co|\\/api\\/sdk\\/config|\\/api\\/ingest\\//i.test(String(url || ''));
      }
    };
    const shouldRecordTransport = (url, method) => {
      const upperMethod = String(method || 'GET').toUpperCase();
      if (upperMethod === 'GET') return false;
      if (isPosthogTarget(url)) return true;
      if (isRejourneyTarget(url)) return true;
      return benchmarkMode === 'rejourney' && upperMethod === 'PUT';
    };
    const originalSendBeacon = navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null;
    const sizeOfBeaconBody = (body) => {
      try {
        if (!body) return 0;
        if (typeof body === 'string') return new TextEncoder().encode(body).byteLength;
        if (body instanceof URLSearchParams) return new TextEncoder().encode(body.toString()).byteLength;
        if (body instanceof Blob) return body.size;
        if (body instanceof ArrayBuffer) return body.byteLength;
        if (ArrayBuffer.isView(body)) return body.byteLength;
      } catch {}
      return 0;
    };
    const previewBeaconBody = (body) => {
      try {
        if (typeof body === 'string') return body;
        if (body instanceof URLSearchParams) return body.toString();
      } catch {}
      return '';
    };
    if (originalSendBeacon) {
      navigator.sendBeacon = (url, body) => {
        const target = String(url || '');
        const record = {
          url: target,
          bodyBytes: sizeOfBeaconBody(body),
          bodyPreview: previewBeaconBody(body),
          at: new Date().toISOString()
        };
        if (shouldRecordTransport(target, 'BEACON')) {
          window.__analyticsBenchmark.beacons.push(record);
        }
        return originalSendBeacon(url, body);
      };
    }
    const originalFetch = window.fetch ? window.fetch.bind(window) : null;
    const previewFetchBody = async (body) => {
      try {
        if (!body) return '';
        if (typeof body === 'string') return body;
        if (body instanceof URLSearchParams) return body.toString();
        if (body instanceof Blob) return await body.text();
        if (body instanceof ArrayBuffer) return new TextDecoder().decode(body);
        if (ArrayBuffer.isView(body)) return new TextDecoder().decode(body);
      } catch {}
      return '';
    };
    if (originalFetch) {
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' || input instanceof URL ? String(input) : String(input?.url || '');
        const method = String(init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
        let body = init?.body || null;
        if (!body && typeof Request !== 'undefined' && input instanceof Request) {
          try {
            body = await input.clone().text();
          } catch {}
        }
        if (shouldRecordTransport(url, method)) {
          const bodyPreview = await previewFetchBody(body);
          window.__analyticsBenchmark.transports.push({
            kind: 'fetch',
            url,
            method,
            bodyBytes: sizeOfBeaconBody(body),
            bodyPreview,
            at: new Date().toISOString()
          });
        }
        return originalFetch(input, init);
      };
    }
    const OriginalXMLHttpRequest = window.XMLHttpRequest;
    if (OriginalXMLHttpRequest) {
      window.XMLHttpRequest = function BenchmarkXMLHttpRequest() {
        const xhr = new OriginalXMLHttpRequest();
        let method = 'GET';
        let url = '';
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        xhr.open = function patchedOpen(nextMethod, nextUrl, ...rest) {
          method = String(nextMethod || 'GET').toUpperCase();
          url = String(nextUrl || '');
          return originalOpen.call(xhr, nextMethod, nextUrl, ...rest);
        };
        xhr.send = function patchedSend(body) {
          if (shouldRecordTransport(url, method)) {
            window.__analyticsBenchmark.transports.push({
              kind: 'xhr',
              url,
              method,
              bodyBytes: sizeOfBeaconBody(body),
              bodyPreview: previewBeaconBody(body),
              at: new Date().toISOString()
            });
          }
          return originalSend.call(xhr, body);
        };
        return xhr;
      };
      window.XMLHttpRequest.prototype = OriginalXMLHttpRequest.prototype;
    }
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__analyticsBenchmark.longTasks.push({
            name: entry.name,
            startTime: Math.round(entry.startTime * 100) / 100,
            duration: Math.round(entry.duration * 100) / 100
          });
        }
      }).observe({ entryTypes: ['longtask'] });
    } catch {}
    window.addEventListener('error', (event) => {
      window.__analyticsBenchmark.errors.push({
        message: String(event.message || ''),
        filename: String(event.filename || ''),
        lineno: event.lineno || 0,
        colno: event.colno || 0
      });
    });
    window.addEventListener('unhandledrejection', (event) => {
      window.__analyticsBenchmark.unhandledRejections.push({
        reason: String(event.reason?.message || event.reason || '')
      });
    });
  })();`;
}

function posthogInitScript({ key, host, defaults, shouldLoadCdn }) {
  const cdnLoader = shouldLoadCdn ? `
    const script = document.createElement('script');
    script.async = false;
    script.src = ${JSON.stringify(assetHostForPosthog(host) + '/static/array.js')};
    script.onload = initPostHog;
    script.onerror = (error) => {
      window.__benchmarkPosthog.errors.push(String(error?.message || 'failed to load posthog script'));
    };
    (document.head || document.documentElement).appendChild(script);
  ` : 'initPostHog();';

  return `(() => {
    window.__benchmarkPosthog = { ready: false, errors: [] };
    function initPostHog() {
      try {
        if (!window.posthog || !window.posthog.init) {
          window.__benchmarkPosthog.errors.push('posthog init function unavailable');
          return;
        }
        window.posthog.init(${JSON.stringify(key)}, {
          api_host: ${JSON.stringify(host)},
          defaults: ${JSON.stringify(defaults)},
          autocapture: true,
          capture_pageview: true,
          capture_pageleave: true,
          person_profiles: 'always',
          opt_out_useragent_filter: true,
          __preview_capture_bot_pageviews: true,
          request_queue_config: {
            flush_interval_ms: 250
          },
          disable_session_recording: false,
          session_recording: {
            maskAllInputs: true,
            maskTextSelector: '[data-rj-mask], [data-rejourney-mask], [data-private]',
            maskInputOptions: {
              password: true,
              email: true
            }
          },
          loaded: function(posthog) {
            try {
              posthog.on && posthog.on('eventCaptured', function(event) {
                try {
                  window.__analyticsBenchmark.posthogCapturedEvents.push({
                    event: event && event.event,
                    bytes: JSON.stringify(event || {}).length,
                    at: new Date().toISOString()
                  });
                } catch {}
              });
              const patchSessionRecording = function() {
                try {
                  const recorder = posthog.sessionRecording;
                  if (recorder && recorder.onRRwebEmit && !recorder.__benchmarkPatched) {
                    const originalEmit = recorder.onRRwebEmit.bind(recorder);
                    recorder.onRRwebEmit = function(rawEvent) {
                      try {
                        window.__analyticsBenchmark.posthogRrwebEvents.push({
                          type: rawEvent && rawEvent.type,
                          bytes: JSON.stringify(rawEvent || {}).length,
                          at: new Date().toISOString()
                        });
                      } catch {}
                      return originalEmit(rawEvent);
                    };
                    recorder.__benchmarkPatched = true;
                  }
                  if (!recorder || !recorder.__benchmarkPatched) {
                    setTimeout(patchSessionRecording, 100);
                  }
                } catch {}
              };
              patchSessionRecording();
              posthog.opt_in_capturing && posthog.opt_in_capturing();
              posthog.startSessionRecording && posthog.startSessionRecording();
            } catch (error) {
              window.__benchmarkPosthog.errors.push(String(error?.message || error));
            }
            window.__benchmarkPosthog.ready = true;
          }
        });
      } catch (error) {
        window.__benchmarkPosthog.errors.push(String(error?.message || error));
      }
    }
    ${cdnLoader}
  })();`;
}

async function startExampleServer(app, mode, rejourneyApiUrl) {
  const env = {
    ...process.env,
    CI: '1',
    NO_COLOR: '1',
    FORCE_COLOR: '0',
  };
  for (const key of app.clearEnv) {
    env[key] = '';
  }
  if (mode === 'rejourney') {
    for (const [key, value] of Object.entries(app.rejourneyEnv)) {
      if (key.endsWith('_KEY')) {
        env[key] = rejourneyKey;
      } else {
        env[key] = value === null ? rejourneyApiUrl : value;
      }
    }
  }

  const child = spawn('npm', ['run', 'dev'], {
    cwd: app.cwd,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logs = [];
  const pushLog = (source, chunk) => {
    logs.push({ source, text: chunk.toString() });
    if (logs.length > 200) logs.shift();
  };
  child.stdout.on('data', (chunk) => pushLog('stdout', chunk));
  child.stderr.on('data', (chunk) => pushLog('stderr', chunk));

  const devUrl = `http://127.0.0.1:${app.port}/`;
  await waitForServer(devUrl, child, logs, 120_000);
  const proxy = app.publicOrigin ? await startProxyServer({
    publicOrigin: app.publicOrigin,
    targetOrigin: devUrl.replace(/\/$/, ''),
  }) : null;
  const url = app.publicOrigin ? `${app.publicOrigin}/` : devUrl;
  await waitForServer(url, child, logs, 30_000);
  await sleep(1000);
  return {
    child,
    logs,
    stop: async () => {
      await proxy?.stop().catch(() => undefined);
      if (child.exitCode !== null) return;
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
      await waitForExit(child, 8000).catch(() => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      });
    },
  };
}

async function startProxyServer({ publicOrigin, targetOrigin }) {
  const publicUrl = new URL(publicOrigin);
  const targetBase = new URL(normalizeUrl(targetOrigin));
  const server = createServer((req, res) => {
    try {
      const targetUrl = new URL(req.url || '/', `${targetBase.protocol}//${targetBase.host}`);
      const headers = {
        ...req.headers,
        host: targetBase.host,
      };
      const proxyReq = httpRequest(targetUrl, {
        method: req.method,
        headers,
      }, (proxyRes) => {
        const responseHeaders = { ...proxyRes.headers };
        if (typeof responseHeaders.location === 'string') {
          responseHeaders.location = responseHeaders.location.replace(
            `${targetBase.protocol}//${targetBase.host}`,
            `${publicUrl.protocol}//${publicUrl.host}`,
          );
        }
        res.writeHead(proxyRes.statusCode || 502, responseHeaders);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (error) => {
        if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
        res.end(`Benchmark proxy error: ${error?.message || error}`);
      });
      req.pipe(proxyReq);
    } catch (error) {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end(`Benchmark proxy error: ${error?.message || error}`);
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(Number(publicUrl.port), publicUrl.hostname, () => {
      server.off('error', reject);
      resolve();
    });
  });

  return {
    stop() {
      return new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    },
  };
}

async function waitForServer(url, child, logs, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Dev server exited early with code ${child.exitCode}.\n${logs.map((entry) => entry.text).join('')}`);
    }
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.status < 500) return;
    } catch {
      // Keep polling until the dev server binds the port.
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}.\n${logs.map((entry) => entry.text).join('')}`);
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.off('exit', onExit);
      reject(new Error('Timed out waiting for process exit'));
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timeout);
      resolve();
    };
    child.once('exit', onExit);
  });
}

function captureRequestRecord(request, app, mode, runId) {
  const body = request.postDataBuffer();
  const bodyText = body ? decodeBodyPreview(body, request.headers()) : '';
  const decodedBodyPreview = body ? decodedRequestBodyPreview(bodyText, request.url()) : '';
  return {
    runId,
    app: app.id,
    mode,
    method: request.method(),
    url: request.url(),
    resourceType: request.resourceType(),
    headers: sanitizeHeaders(request.headers()),
    requestBodyBytes: body?.byteLength || 0,
    requestBodyPreview: body ? safeRequestBodyPreview(bodyText, request.url()).slice(0, 10_000) : '',
    requestDecodedBodyPreview: decodedBodyPreview ? redact(decodedBodyPreview).slice(0, 10_000) : '',
    responseStatus: undefined,
    responseContentLength: undefined,
    at: new Date().toISOString(),
    sdk: classifySdkUrl(request.url(), request.method(), app, mode),
  };
}

function trimNetworkRecord(record) {
  return {
    ...record,
    requestBodyPreview: record.requestBodyPreview ? record.requestBodyPreview.slice(0, 2000) : '',
    requestDecodedBodyPreview: record.requestDecodedBodyPreview ? record.requestDecodedBodyPreview.slice(0, 2000) : '',
  };
}

function hasEquivalentNetworkRecord(network, candidate) {
  return network.some((record) => (
    record.sdk === candidate.sdk
    && record.url === candidate.url
    && record.method === candidate.method
    && Number(record.requestBodyBytes || 0) === Number(candidate.requestBodyBytes || 0)
  ));
}

function classifySdkUrl(url, method = 'GET', app = null, mode = '') {
  if (isPosthogUrl(url)) return 'posthog';
  if (isRejourneyUrl(url)) return 'rejourney';
  if (/\/api\/sdk\/config|\/api\/ingest\//.test(url)) return 'rejourney';
  if (mode === 'rejourney' && method === 'PUT' && !isAppUrl(url, app)) return 'rejourney';
  return 'app';
}

function isPosthogUrl(url) {
  try {
    const parsed = new URL(url);
    const posthog = new URL(posthogHost);
    return parsed.hostname === posthog.hostname || parsed.hostname.includes('posthog.com') || parsed.hostname.includes('posthog');
  } catch {
    return false;
  }
}

function isRejourneyUrl(url) {
  try {
    const parsed = new URL(url);
    const api = new URL(rejourneyApiUrl);
    return parsed.hostname === api.hostname || parsed.hostname === 'api.rejourney.co';
  } catch {
    return /api\.rejourney\.co/i.test(url);
  }
}

function isAppUrl(url, app) {
  if (!app) return false;
  try {
    const parsed = new URL(url);
    const publicOrigin = app.publicOrigin ? new URL(app.publicOrigin) : null;
    if (publicOrigin && parsed.host === publicOrigin.host) return true;
    return parsed.hostname === '127.0.0.1' && parsed.port === String(app.port);
  } catch {
    return false;
  }
}

function summarizeRun({ mode, network, client, startMetrics, endMetrics, rejourneySummary, posthogSummary, durationMs }) {
  const sdkNetwork = network.filter((record) => record.sdk === mode || (mode === 'rejourney' && record.sdk === 'rejourney') || (mode === 'posthog' && record.sdk === 'posthog'));
  const resources = client.resources || [];
  const nav = client.navigation || {};
  const start = metricsObject(startMetrics.metrics);
  const end = metricsObject(endMetrics.metrics);
  const taskDurationDeltaMs = round(((end.TaskDuration || 0) - (start.TaskDuration || 0)) * 1000);
  const scriptDurationDeltaMs = round(((end.ScriptDuration || 0) - (start.ScriptDuration || 0)) * 1000);
  const layoutDurationDeltaMs = round(((end.LayoutDuration || 0) - (start.LayoutDuration || 0)) * 1000);
  const recalcStyleDurationDeltaMs = round(((end.RecalcStyleDuration || 0) - (start.RecalcStyleDuration || 0)) * 1000);
  const summary = {
    durationMs,
    pageLoadMs: round(nav.loadEventEnd || nav.domContentLoadedEventEnd || 0),
    domContentLoadedMs: round(nav.domContentLoadedEventEnd || 0),
    firstPaintMs: round((client.paints || []).find((paint) => paint.name === 'first-paint')?.startTime || 0),
    firstContentfulPaintMs: round((client.paints || []).find((paint) => paint.name === 'first-contentful-paint')?.startTime || 0),
    resourceTransferBytes: sum(resources.map((resource) => resource.transferSize || 0)),
    scriptTransferBytes: sum(resources.filter((resource) => resource.initiatorType === 'script').map((resource) => resource.transferSize || 0)),
    sdkRequestCount: sdkNetwork.length,
    sdkUploadBodyBytes: sum(sdkNetwork.map((record) => record.requestBodyBytes || 0)),
    sdkResponseContentLengthBytes: sum(sdkNetwork.map((record) => record.responseContentLength || 0)),
    longTaskCount: client.benchmark?.longTasks?.length || 0,
    longTaskDurationMs: round(sum((client.benchmark?.longTasks || []).map((task) => task.duration || 0))),
    pageErrorCount: client.benchmark?.errors?.length || 0,
    jsHeapDeltaBytes: round((end.JSHeapUsedSize || 0) - (start.JSHeapUsedSize || 0)),
    jsHeapUsedEndBytes: round(end.JSHeapUsedSize || 0),
    jsHeapTotalEndBytes: round(end.JSHeapTotalSize || 0),
    domNodesDelta: round((end.Nodes || 0) - (start.Nodes || 0)),
    documentsDelta: round((end.Documents || 0) - (start.Documents || 0)),
    layoutCountDelta: round((end.LayoutCount || 0) - (start.LayoutCount || 0)),
    recalcStyleCountDelta: round((end.RecalcStyleCount || 0) - (start.RecalcStyleCount || 0)),
    taskDurationDeltaMs,
    scriptDurationDeltaMs,
    layoutDurationDeltaMs,
    recalcStyleDurationDeltaMs,
    mainThreadBusyMsPerSecond: durationMs > 0 ? round(taskDurationDeltaMs / (durationMs / 1000)) : 0,
    mainThreadBusyPercent: durationMs > 0 ? round((taskDurationDeltaMs / durationMs) * 100) : 0,
    privacyLeakCount: 0,
  };

  if (mode === 'rejourney') {
    Object.assign(summary, {
      rejourneyEventArtifacts: rejourneySummary.eventArtifactCount,
      rejourneyReplayArtifacts: rejourneySummary.replayArtifactCount,
      rejourneyAnalyticsEventCount: rejourneySummary.analyticsEventCount,
      rejourneyRrwebEventCount: rejourneySummary.rrwebEventCount,
      rejourneyAnalyticsGzipBytes: rejourneySummary.analyticsGzipBytes,
      rejourneyReplayGzipBytes: rejourneySummary.replayGzipBytes,
      privacyLeakCount: rejourneySummary.privacyLeakCount,
    });
  }

  if (mode === 'posthog') {
    Object.assign(summary, {
      posthogCapturedRequestCount: posthogSummary.capturedRequestCount,
      posthogParsedEventCount: posthogSummary.parsedEventCount,
      posthogBodyBytes: posthogSummary.bodyBytes,
      posthogSessionRecordingRequestCount: posthogSummary.sessionRecordingRequestCount,
      posthogInternalCapturedEventCount: posthogSummary.internalCapturedEventCount,
      posthogInternalRrwebEventCount: posthogSummary.internalRrwebEventCount,
      posthogInternalEstimatedBytes: posthogSummary.internalEstimatedBytes,
      privacyLeakCount: posthogSummary.privacyLeakCount,
    });
  }

  return summary;
}

function summarizeRejourneyNetwork(network) {
  const rejourneyNetwork = network.filter((record) => record.sdk === 'rejourney');
  const uploadRecords = rejourneyNetwork.filter((record) => (
    record.method === 'PUT'
    && record.requestBodyBytes
    && (record.requestBodyPreview || record.requestDecodedBodyPreview)
  ));
  const captures = uploadRecords.map((record) => {
    const text = record.requestDecodedBodyPreview || record.requestBodyPreview || '';
    const decodedJson = parseJsonString(text);
    const kind = decodedJson?.format === 'rrweb' ? 'rrweb' : 'events';
    return {
      run: {
        runId: record.runId,
        app: record.app,
        mode: record.mode,
      },
      kind,
      uploadUrl: record.url,
      rawBytes: record.requestBodyBytes || 0,
      decodedBytes: text.length,
      decodedJson,
      privacy: privacyScan(text),
    };
  });
  const eventCaptures = captures.filter((capture) => capture.kind === 'events');
  const replayCaptures = captures.filter((capture) => capture.kind === 'rrweb');
  const analyticsEvents = eventCaptures.flatMap((capture) => capture.decodedJson?.events || []);
  const rrwebEvents = replayCaptures.flatMap((capture) => capture.decodedJson?.events || []);
  const privacyLeakCount = sum(captures.map((capture) => capture.privacy.findings.length));

  return {
    requestCount: rejourneyNetwork.length,
    eventArtifactCount: eventCaptures.length,
    replayArtifactCount: replayCaptures.length,
    analyticsEventCount: analyticsEvents.length,
    rrwebEventCount: rrwebEvents.length,
    analyticsGzipBytes: sum(eventCaptures.map((capture) => capture.rawBytes)),
    replayGzipBytes: sum(replayCaptures.map((capture) => capture.rawBytes)),
    analyticsEventTypes: countBy(analyticsEvents.map((event) => event.type || event.name || 'unknown')),
    rrwebEventTypes: countBy(rrwebEvents.map((event) => String(event.type ?? 'unknown'))),
    privacyLeakCount,
    privacyFindings: captures.flatMap((capture) => capture.privacy.findings.map((finding) => ({
      kind: capture.kind,
      url: capture.uploadUrl,
      ...finding,
    }))),
    captures,
  };
}

function summarizePosthogRequests(samples, network, client) {
  const posthogNetwork = network.filter((record) => record.sdk === 'posthog');
  const events = samples.flatMap((sample) => sample.events || []);
  const internalEvents = client.benchmark?.posthogCapturedEvents || [];
  const internalRrwebEvents = client.benchmark?.posthogRrwebEvents || [];
  const privacyLeakCount = sum(samples.map((sample) => sample.privacy.findings.length));
  return {
    capturedRequestCount: posthogNetwork.length,
    bodyBytes: sum(posthogNetwork.map((record) => record.requestBodyBytes || 0)),
    parsedEventCount: events.length + internalEvents.length,
    eventNames: mergeCounts([
      countBy(events.map((event) => event.event || event.name || 'unknown')),
      countBy(internalEvents.map((event) => event.event || 'unknown')),
    ]),
    sessionRecordingRequestCount: posthogNetwork.filter((record) => /\/s\/|recording|snapshot|rrweb|replay/i.test(record.url + record.requestBodyPreview + record.requestDecodedBodyPreview)).length,
    internalCapturedEventCount: internalEvents.length,
    internalRrwebEventCount: internalRrwebEvents.length,
    internalEstimatedBytes: sum([...internalEvents, ...internalRrwebEvents].map((event) => event.bytes || 0)),
    privacyLeakCount,
    privacyFindings: samples.flatMap((sample) => sample.privacy.findings.map((finding) => ({
      url: sample.url,
      ...finding,
    }))),
  };
}

function decodeRequestBodySample(record) {
  if (!record.requestBodyBytes || (!record.requestBodyPreview && !record.requestDecodedBodyPreview)) return null;
  const text = record.requestDecodedBodyPreview || record.requestBodyPreview;
  const events = extractEventsFromBodyText(text);
  return {
    runId: record.runId,
    app: record.app,
    mode: record.mode,
    method: record.method,
    url: record.url,
    bodyBytes: record.requestBodyBytes,
    bodyPreview: redact(text).slice(0, 10_000),
    events,
    privacy: privacyScan(text),
  };
}

function extractEventsFromBodyText(text) {
  const candidates = [text];
  try {
    const params = new URLSearchParams(text);
    for (const value of params.values()) {
      candidates.push(value);
      if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 20) {
        try {
          candidates.push(Buffer.from(value, 'base64').toString('utf8'));
        } catch {
          // ignore non-base64 params
        }
      }
    }
  } catch {
    // not form-urlencoded
  }

  const events = [];
  for (const candidate of candidates) {
    const parsed = parseJsonString(candidate);
    collectPosthogEvents(parsed, events);
  }
  return events;
}

function collectPosthogEvents(value, events) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectPosthogEvents(item, events);
    return;
  }
  if (typeof value.event === 'string') events.push({ event: value.event });
  if (Array.isArray(value.batch)) collectPosthogEvents(value.batch, events);
  if (Array.isArray(value.events)) collectPosthogEvents(value.events, events);
}

function aggregateRuns(runs) {
  const successful = runs.filter((run) => !run.failed);
  const groups = new Map();
  for (const run of successful) {
    const key = `${run.app}:${run.mode}`;
    const group = groups.get(key) || [];
    group.push(run);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, group]) => {
    const [app, mode] = key.split(':');
    const summaries = group.map((run) => run.summary);
    return {
      app,
      mode,
      iterations: group.length,
      medianPageLoadMs: median(summaries.map((summary) => summary.pageLoadMs)),
      medianSdkRequestCount: median(summaries.map((summary) => summary.sdkRequestCount)),
      medianSdkUploadBodyBytes: median(summaries.map((summary) => summary.sdkUploadBodyBytes)),
      medianScriptTransferBytes: median(summaries.map((summary) => summary.scriptTransferBytes)),
      medianResourceTransferBytes: median(summaries.map((summary) => summary.resourceTransferBytes)),
      medianLongTaskCount: median(summaries.map((summary) => summary.longTaskCount)),
      medianLongTaskDurationMs: median(summaries.map((summary) => summary.longTaskDurationMs)),
      medianJsHeapDeltaBytes: median(summaries.map((summary) => summary.jsHeapDeltaBytes)),
      medianJsHeapUsedEndBytes: median(summaries.map((summary) => summary.jsHeapUsedEndBytes)),
      medianJsHeapTotalEndBytes: median(summaries.map((summary) => summary.jsHeapTotalEndBytes)),
      medianTaskDurationDeltaMs: median(summaries.map((summary) => summary.taskDurationDeltaMs)),
      medianScriptDurationDeltaMs: median(summaries.map((summary) => summary.scriptDurationDeltaMs)),
      medianLayoutDurationDeltaMs: median(summaries.map((summary) => summary.layoutDurationDeltaMs)),
      medianRecalcStyleDurationDeltaMs: median(summaries.map((summary) => summary.recalcStyleDurationDeltaMs)),
      medianMainThreadBusyMsPerSecond: median(summaries.map((summary) => summary.mainThreadBusyMsPerSecond)),
      medianMainThreadBusyPercent: median(summaries.map((summary) => summary.mainThreadBusyPercent)),
      medianDomNodesDelta: median(summaries.map((summary) => summary.domNodesDelta)),
      medianLayoutCountDelta: median(summaries.map((summary) => summary.layoutCountDelta)),
      medianRecalcStyleCountDelta: median(summaries.map((summary) => summary.recalcStyleCountDelta)),
      medianPrivacyLeakCount: median(summaries.map((summary) => summary.privacyLeakCount)),
      rejourneyAnalyticsEvents: sum(summaries.map((summary) => summary.rejourneyAnalyticsEventCount || 0)),
      rejourneyRrwebEvents: sum(summaries.map((summary) => summary.rejourneyRrwebEventCount || 0)),
      posthogParsedEvents: sum(summaries.map((summary) => summary.posthogParsedEventCount || 0)),
      posthogInternalRrwebEvents: sum(summaries.map((summary) => summary.posthogInternalRrwebEventCount || 0)),
      eventTypes: mergeCounts(group.map((run) => run.rejourney?.summary?.analyticsEventTypes || {})),
      posthogEventNames: mergeCounts(group.map((run) => run.posthog?.summary?.eventNames || {})),
    };
  });
}

function renderMarkdownReport(results) {
  const aggregates = results.aggregates || [];
  const rows = aggregates.map((row) => [
    row.app,
    row.mode,
    row.iterations,
    formatNumber(row.medianPageLoadMs),
    formatNumber(row.medianSdkRequestCount),
    formatBytes(row.medianSdkUploadBodyBytes),
    formatBytes(row.medianScriptTransferBytes),
    formatNumber(row.rejourneyAnalyticsEvents || row.posthogParsedEvents || 0),
    formatNumber(row.rejourneyRrwebEvents || row.posthogInternalRrwebEvents || 0),
    formatNumber(row.medianPrivacyLeakCount),
  ]);

  const browserIntensityRows = aggregates.map((row) => [
    row.app,
    row.mode,
    row.iterations,
    formatNumber(row.medianMainThreadBusyPercent),
    formatNumber(row.medianMainThreadBusyMsPerSecond),
    formatNumber(row.medianTaskDurationDeltaMs),
    formatNumber(row.medianScriptDurationDeltaMs),
    formatNumber(row.medianLayoutDurationDeltaMs + row.medianRecalcStyleDurationDeltaMs),
    formatNumber(row.medianLongTaskCount),
    formatNumber(row.medianLongTaskDurationMs),
    formatBytes(row.medianJsHeapDeltaBytes),
    formatBytes(row.medianJsHeapUsedEndBytes),
    formatNumber(row.medianDomNodesDelta),
  ]);

  const perRunBrowserRows = results.runs
    .filter((run) => !run.failed)
    .map((run) => [
      run.app,
      run.mode,
      run.iteration,
      formatNumber(run.summary.pageLoadMs),
      formatNumber(run.summary.taskDurationDeltaMs),
      formatNumber(run.summary.mainThreadBusyPercent),
      formatNumber(run.summary.scriptDurationDeltaMs),
      formatNumber(run.summary.layoutDurationDeltaMs + run.summary.recalcStyleDurationDeltaMs),
      formatNumber(run.summary.longTaskCount),
      formatNumber(run.summary.longTaskDurationMs),
      formatBytes(run.summary.jsHeapDeltaBytes),
      formatBytes(run.summary.jsHeapUsedEndBytes),
      formatBytes(run.summary.sdkUploadBodyBytes),
    ]);

  const rejourneyRows = aggregates
    .filter((row) => row.mode === 'rejourney')
    .map((row) => [
      row.app,
      formatNumber(row.rejourneyAnalyticsEvents),
      formatNumber(row.rejourneyRrwebEvents),
      inlineCounts(row.eventTypes),
    ]);

  const posthogRows = aggregates
    .filter((row) => row.mode === 'posthog')
    .map((row) => [
      row.app,
      formatNumber(row.posthogParsedEvents),
      formatNumber(row.posthogInternalRrwebEvents),
      inlineCounts(row.posthogEventNames),
    ]);

  const footprintRows = [
    ['@rejourneyco/browser dist', results.packageFootprint.rejourney.version, formatBytes(results.packageFootprint.rejourney.distBytes), formatBytes(results.packageFootprint.rejourney.distGzipBytes), `${results.packageFootprint.rejourney.fileCount}`],
    ['posthog-js package dist', results.packageFootprint.posthog.version, formatBytes(results.packageFootprint.posthog.distBytes), formatBytes(results.packageFootprint.posthog.distGzipBytes), `${results.packageFootprint.posthog.fileCount}`],
  ];

  return `# Rejourney vs PostHog Web Analytics Benchmark

Generated: ${results.generatedAt}

## Scope

- Apps: ${results.environment.apps.map((app) => `${app.label} (${app.id})`).join(', ')}
- Modes: ${results.environment.modes.join(', ')}
- Iterations per app/mode: ${results.environment.iterations}
- Browser: ${results.environment.playwrightBrowser}, viewport ${results.environment.viewport.width}x${results.environment.viewport.height}
- Rejourney network/API: ${results.environment.rejourney.networkMode}, ${results.environment.rejourney.apiUrl}
- Rejourney key: ${results.environment.rejourney.key}
- PostHog network/API: ${results.environment.posthog.networkMode}, ${results.environment.posthog.host}
- PostHog defaults: ${results.environment.posthog.defaults}
- PostHog key: ${results.environment.posthog.key}

The benchmark runs the same scripted flow in each fixture: load, form edits, custom analytics, identity/metadata, network request, route transition, synthetic error, missing image, scroll, and an 85 ms controlled long task. Both SDKs use live project endpoints; request payloads are also captured locally for measurement.

- Rejourney network policy: ${results.methodology.rejourneyNetworkPolicy}
- PostHog network policy: ${results.methodology.posthogNetworkPolicy}

## Aggregate Results

${markdownTable(
  ['app', 'mode', 'n', 'median load ms', 'median SDK reqs', 'median SDK upload body', 'median script transfer', 'analytics events', 'rrweb events', 'privacy findings'],
  rows,
)}

## Browser CPU And Memory Intensity

CPU intensity uses Chrome DevTools Protocol \`Performance.getMetrics()\`: \`TaskDuration\` is the main-thread busy-time proxy across the full scripted visit, including the fixed flush wait. Memory is JS heap used at the end of the run plus the JS heap delta from start to finish.

${markdownTable(
  ['app', 'mode', 'n', 'busy %', 'busy ms/s', 'task ms', 'script ms', 'layout+style ms', 'long tasks', 'long-task ms', 'JS heap delta', 'JS heap end', 'DOM node delta'],
  browserIntensityRows,
)}

## Per-Run Browser Metrics

${markdownTable(
  ['app', 'mode', 'iteration', 'load ms', 'task ms', 'busy %', 'script ms', 'layout+style ms', 'long tasks', 'long-task ms', 'JS heap delta', 'JS heap end', 'SDK upload body'],
  perRunBrowserRows,
)}

## Package Footprint

${markdownTable(['package', 'version', 'dist bytes', 'dist gzip bytes', 'files'], footprintRows)}

## Rejourney Capture Coverage

${markdownTable(['app', 'analytics events', 'rrweb events', 'analytics event types'], rejourneyRows)}

## PostHog Capture Coverage

${markdownTable(['app', 'parsed/internal events', 'internal rrweb events', 'event names'], posthogRows)}

## Privacy Scan

Sensitive test tokens scanned in decoded payloads: Rejourney project key, PostHog project key, fixture secret token, benchmark-entered email address, password placeholder, and benchmark private note. Fixture placeholder copy is not counted as a privacy finding. A privacy finding means one of those exact strings appeared in captured upload content after decoding known JSON/form/gzip payload formats.

${markdownTable(
  ['app', 'mode', 'iteration', 'privacy findings', 'page errors', 'long tasks'],
  results.runs
    .filter((run) => !run.failed)
    .map((run) => [
      run.app,
      run.mode,
      run.iteration,
      run.summary.privacyLeakCount,
      run.summary.pageErrorCount,
      run.summary.longTaskCount,
    ]),
)}

## Raw Artifacts

- \`benchmark-results.json\`: all run summaries, performance timings, resource timings, redacted request previews, and aggregate data
- \`rejourney-live-network-captures.json\`: decoded Rejourney event and rrweb upload envelopes when available
- \`posthog-network-captures.json\`: decoded PostHog upload request samples

## Notes For Publishing

- Generated artifacts have the Rejourney and PostHog keys redacted.
- The benchmark intentionally uses local fixture pages and synthetic data only.
- Re-run with a larger \`BENCHMARK_ITERATIONS\` value before publishing final numbers if you want tighter confidence intervals.
`;
}

async function collectPackageFootprint() {
  const rejourneyPackage = JSON.parse(await fs.readFile(path.join(repoRoot, 'packages', 'browser', 'package.json'), 'utf8'));
  const posthogPackagePath = path.join(benchmarkDir, 'node_modules', 'posthog-js', 'package.json');
  const posthogPackage = existsSync(posthogPackagePath)
    ? JSON.parse(await fs.readFile(posthogPackagePath, 'utf8'))
    : { version: 'not-installed' };

  const rejourneyDist = await directoryFootprint(path.join(repoRoot, 'packages', 'browser', 'dist'));
  const posthogDist = await directoryFootprint(path.join(benchmarkDir, 'node_modules', 'posthog-js', 'dist'));

  return {
    rejourney: {
      version: rejourneyPackage.version,
      ...rejourneyDist,
    },
    posthog: {
      version: posthogPackage.version,
      ...posthogDist,
    },
  };
}

async function directoryFootprint(dir) {
  if (!existsSync(dir)) {
    return { distBytes: 0, distGzipBytes: 0, fileCount: 0, files: [] };
  }
  const files = await walkFiles(dir);
  const measured = [];
  let distBytes = 0;
  let distGzipBytes = 0;
  for (const file of files) {
    const bytes = await fs.readFile(file);
    const gzipBytes = zlib.gzipSync(bytes).byteLength;
    distBytes += bytes.byteLength;
    distGzipBytes += gzipBytes;
    measured.push({
      file: path.relative(dir, file),
      bytes: bytes.byteLength,
      gzipBytes,
    });
  }
  return {
    distBytes,
    distGzipBytes,
    fileCount: files.length,
    files: measured.sort((a, b) => b.bytes - a.bytes).slice(0, 25),
  };
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(fullPath));
    } else if (entry.isFile() && /\.(js|mjs|cjs|css|json|map|d\.ts)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

async function findPosthogBundle() {
  const distDir = path.join(benchmarkDir, 'node_modules', 'posthog-js', 'dist');
  const candidates = [
    'array.full.no-external.js',
    'array.full.js',
    'array.no-external.js',
    'array.js',
    'posthog.js',
  ];
  for (const candidate of candidates) {
    const fullPath = path.join(distDir, candidate);
    if (existsSync(fullPath)) return fullPath;
  }
  return null;
}

function decodeBodyPreview(buffer, headers) {
  const encoding = String(headers['content-encoding'] || headers['Content-Encoding'] || '').toLowerCase();
  if (encoding.includes('gzip')) return decodeMaybeGzip(buffer).text;
  if (buffer?.byteLength >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) return decodeMaybeGzip(buffer).text;
  return bufferToUtf8(buffer);
}

function safeRequestBodyPreview(text, url) {
  if (isPosthogUrl(url)) {
    const decoded = decodeEmbeddedPosthogData(text);
    if (decoded) {
      return `data=<BASE64_PAYLOAD_REDACTED>\nDecoded data: ${redact(decoded)}`;
    }
  }
  return redact(text);
}

function decodedRequestBodyPreview(text, url) {
  if (!isPosthogUrl(url)) return '';
  return decodeEmbeddedPosthogData(text) || '';
}

function decodeEmbeddedPosthogData(text) {
  try {
    const params = new URLSearchParams(text);
    const data = params.get('data');
    if (!data) return '';
    return Buffer.from(data, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function decodeMaybeGzip(buffer) {
  try {
    return { text: zlib.gunzipSync(buffer).toString('utf8'), compressed: true };
  } catch {
    return { text: bufferToUtf8(buffer), compressed: false };
  }
}

function bufferToUtf8(buffer) {
  return Buffer.isBuffer(buffer) ? buffer.toString('utf8') : Buffer.from(buffer || []).toString('utf8');
}

function parseJsonString(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function privacyScan(text) {
  const findings = [];
  for (const secret of secretValues) {
    if (secret && text.includes(secret)) {
      findings.push({
        token: redact(secret),
        occurrences: text.split(secret).length - 1,
      });
    }
  }
  return { findings };
}

function redactJson(value) {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(redactJson);
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = redactJson(child);
    }
    return output;
  }
  return value;
}

function redact(value) {
  let output = String(value);
  for (const secret of secretValues) {
    if (!secret) continue;
    output = output.split(secret).join(redactedToken(secret));
  }
  return output;
}

function redactedToken(secret) {
  if (secret === rejourneyKey) return 'rj_***';
  if (secret === posthogKey) return 'phc_***';
  if (secret.includes('@')) return '<TEST_EMAIL_REDACTED>';
  if (secret.includes('secret') || secret.includes('password') || secret.includes('private')) return '<SENSITIVE_TEST_VALUE_REDACTED>';
  return '<REDACTED>';
}

function sanitizeHeaders(headers) {
  const output = {};
  for (const [key, value] of Object.entries(headers || {})) {
    if (/authorization|cookie|token|key/i.test(key)) {
      output[key] = redact(String(value));
    } else {
      output[key] = String(value);
    }
  }
  return output;
}

function metricsObject(metrics = []) {
  return Object.fromEntries(metrics.map((metric) => [metric.name, metric.value]));
}

function positiveInteger(input, fallback) {
  const parsed = Number.parseInt(input || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseInteger(input) {
  const parsed = Number.parseInt(input || '', 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function listFromEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeUrl(value) {
  return value.replace(/\/+$/, '');
}

function assetHostForPosthog(host) {
  try {
    const parsed = new URL(host);
    if (parsed.hostname === 'us.i.posthog.com') return 'https://us-assets.i.posthog.com';
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return 'https://us-assets.i.posthog.com';
  }
}

function countBy(values) {
  const output = {};
  for (const value of values) {
    output[value] = (output[value] || 0) + 1;
  }
  return output;
}

function mergeCounts(counts) {
  const output = {};
  for (const count of counts) {
    for (const [key, value] of Object.entries(count)) {
      output[key] = (output[key] || 0) + value;
    }
  }
  return output;
}

function inlineCounts(counts) {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '';
  return entries.map(([key, value]) => `${key}: ${value}`).join(', ');
}

function sum(values) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

function median(values) {
  const numeric = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!numeric.length) return 0;
  const middle = Math.floor(numeric.length / 2);
  return numeric.length % 2 ? numeric[middle] : (numeric[middle - 1] + numeric[middle]) / 2;
}

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatBytes(value) {
  const number = Number(value || 0);
  if (number >= 1024 * 1024) return `${formatNumber(number / (1024 * 1024))} MiB`;
  if (number >= 1024) return `${formatNumber(number / 1024)} KiB`;
  return `${formatNumber(number)} B`;
}

function markdownTable(headers, rows) {
  const normalizedRows = rows.length ? rows : [headers.map(() => '')];
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...normalizedRows.map((row) => `| ${row.map((cell) => String(cell ?? '').replace(/\n/g, '<br>')).join(' | ')} |`),
  ].join('\n');
}

function serializeError(error) {
  return {
    name: error?.name || 'Error',
    message: redact(error?.message || String(error)),
    stack: redact(error?.stack || ''),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
