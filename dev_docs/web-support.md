# Web Support Implementation Plan

Research checked: 2026-05-16

This document describes how to add website session replay and general web analytics to Rejourney while preserving the end-user functionality of the existing mobile SDKs. The main recommendation is to build a first-party `@rejourneyco/web` package on top of rrweb, not to build our own DOM recorder.

The important difference from mobile is the capture model:

- Mobile replay is image based. The SDK captures rendered screenshots and uploads `screenshots` and `hierarchy` artifacts.
- Web replay should be DOM/event based. rrweb records the initial DOM, subsequent DOM mutations, input/mouse/scroll/media events, and optional assets/canvas/console data. The dashboard replays those events with rrweb's replayer.

That means web support is not just "add a package." It needs a web SDK, a new replay artifact kind, backend processing and availability rules, dashboard playback, web-specific privacy defaults, and framework integration helpers.

## Current Rejourney Behavior To Preserve

Local files reviewed:

- `packages/react-native/src/index.ts`
- `packages/react-native/src/types/index.ts`
- `packages/react-native/src/sdk/networkInterceptor.ts`
- `packages/react-native/src/sdk/autoTracking.ts`
- `packages/ios/Sources/Rejourney/Recording/ReplayOrchestrator.swift`
- `backend/src/routes/ingestUploads.ts`
- `backend/src/routes/ingestLifecycle.ts`
- `backend/src/services/ingestEventArtifactProcessor.ts`
- `backend/src/services/ingestReplayArtifactProcessor.ts`
- `backend/src/services/sessionReconciliation.ts`
- `backend/src/services/sessionPresentationState.ts`
- `dashboard/web-ui/app/shared/ui/core/ScreenshotReplayPlayer.tsx`
- `docs/react-native/getting-started.md`
- `dev_docs/ingest-session-recording-lifecycle.md`

The mobile SDK/product surface to keep:

| Capability | Mobile behavior today | Web equivalent |
|---|---|---|
| Initialize/start/stop | `Rejourney.init()`, `Rejourney.start()`, `Rejourney.stop()` | Same names in `@rejourneyco/web`; no import side effects before `init`/`start` |
| Remote config | `/api/sdk/config` controls enabled, recording, sample rate, max duration, input masking | Reuse endpoint, add web-specific fields without breaking mobile |
| Sampling | Client and backend both guard sampled-out sessions | Same, plus domain abuse protection |
| Observe-only | Telemetry without visual screenshots | Telemetry without rrweb DOM capture |
| Replay | Screenshot artifacts make sessions replayable | rrweb artifact makes sessions replayable |
| Custom events | `logEvent(name, properties)` stored per session and filterable | Same API and dashboard filters |
| Metadata | `setMetadata()` via `$user_property` custom event into `sessions.metadata` | Same API and backend behavior |
| Identity | `setUserIdentity()` and anonymous device ID | Same, using first-party anonymous visitor ID |
| Screen tracking | Expo Router automatic, React Navigation helper, manual `trackScreen` | URL/router tracking, framework adapters, manual `trackScreen` |
| Network | fetch/XHR interception, URL scrubbing, size-only bodies | Same, with browser fetch/XHR patching and ignore list |
| Errors | JS/native errors, crashes, ANRs | JS errors, unhandled rejections, resource errors, long tasks as "ui freeze" |
| Console | Optional console capture with privacy warning | Same feature, but recommended off by default for public websites |
| Heatmaps | Touch/scroll/rage/dead tap counts and coordinate buckets | Click/scroll/rage/dead click buckets normalized per page/viewport |
| Privacy masks | Text inputs masked by default, explicit mask APIs | rrweb masks/blocks plus Rejourney selectors and DOM attributes |
| Lifecycle | 60s inactivity/rollover; backend does not trust final `/session/end` | Same principle, using `visibilitychange`, `pagehide`, periodic flush, and backend inactivity |
| Bot/scraper suppression | Mobile does not have a direct equivalent | Do not record bots, scrapers, link unfurlers, synthetic monitors, or automation by default |
| Upload reliability | Batching, gzip, idempotency, retry/circuit breaker, SDK telemetry | Same, using IndexedDB for offline queue and browser lifecycle-safe small final flushes |

## Use rrweb, But Wrap It

rrweb is the correct capture engine because it already handles the hard browser-specific work:

- DOM serialization and rebuild.
- DOM mutation observation.
- Mouse, click, scroll, input, media, viewport, and custom events.
- Privacy controls such as `blockClass`, `blockSelector`, `ignoreClass`, `maskTextClass`, `maskAllInputs`, `maskInputOptions`, `maskInputFn`, and `maskTextFn`.
- Full snapshot checkpoints via `checkoutEveryNth` and `checkoutEveryNms`.
- Storage optimization hooks such as sampling and `packFn`.
- Asset capture controls for stylesheets, images, object URLs, fonts, and origins.
- Optional console and canvas plugins.
- Replay APIs and `rrweb-player`.

What rrweb does not solve for us:

- Rejourney project auth, upload tokens, sampling, billing gates, storage layout, retention, backup, and dashboard authorization.
- Consent gating and customer privacy defaults.
- Web-specific session lifecycle across reload, bfcache, tab close, background tabs, and offline.
- Framework-specific "start only in the browser" helpers.
- Network/error/custom event parity with mobile.
- Rejourney dashboard player, archive filters, metrics, and thumbnails.
- Abuse protection for public browser keys.

### Version Pinning

As of the research date, npm reports `@rrweb/record`, `@rrweb/replay`, `@rrweb/packer`, and the rrweb console plugins at `2.0.0-alpha.20`, while the main `rrweb` package `latest` tag is older (`2.0.0-alpha.4`) and its `alpha` tag points elsewhere. Do not use `rrweb@latest` or CDN `@latest` in production.

Recommended initial dependencies:

```json
{
  "@rrweb/record": "2.0.0-alpha.20",
  "@rrweb/replay": "2.0.0-alpha.20",
  "@rrweb/packer": "2.0.0-alpha.20",
  "@rrweb/rrweb-plugin-console-record": "2.0.0-alpha.20",
  "@rrweb/rrweb-plugin-console-replay": "2.0.0-alpha.20",
  "fflate": "^0.8.2"
}
```

Pin all rrweb packages together and upgrade only after replay fixture tests pass. If alpha churn becomes painful, vendor a known-good rrweb build or maintain a Rejourney patch package rather than drifting package-by-package.

## Target Package Layout

Create a new workspace package:

```text
packages/web/
  package.json
  tsconfig.json
  src/
    index.ts
    sdk/
      client.ts
      config.ts
      consent.ts
      domPrivacy.ts
      errors.ts
      lifecycle.ts
      networkInterceptor.ts
      recorder.ts
      replayUploadQueue.ts
      routeTracking.ts
      sdkTelemetry.ts
      storage.ts
      types.ts
      visitorId.ts
    integrations/
      angular.ts
      astro.ts
      gatsby.ts
      next.tsx
      nuxt.ts
      react.tsx
      remix.tsx
      svelte.ts
      vue.ts
```

Package entrypoints:

```json
{
  "name": "@rejourneyco/web",
  "exports": {
    ".": "./dist/index.js",
    "./react": "./dist/integrations/react.js",
    "./next": "./dist/integrations/next.js",
    "./vue": "./dist/integrations/vue.js",
    "./nuxt": "./dist/integrations/nuxt.js",
    "./svelte": "./dist/integrations/svelte.js",
    "./angular": "./dist/integrations/angular.js",
    "./remix": "./dist/integrations/remix.js",
    "./astro": "./dist/integrations/astro.js",
    "./gatsby": "./dist/integrations/gatsby.js"
  }
}
```

Build requirements:

- ESM first. CJS can be added if customer demand appears.
- `sideEffects: false` except CSS entrypoints if any.
- No `window`, `document`, `navigator`, `localStorage`, or `indexedDB` access at module import time.
- Browser checks must sit inside `initRejourney`, `startRejourney`, adapter hooks, or explicit `isBrowser()` guards.
- Ship a UMD/IIFE browser snippet only after the npm package is stable.

## Public Web SDK API

The web SDK should feel like the mobile SDK:

```ts
import { Rejourney, initRejourney, startRejourney } from '@rejourneyco/web';

initRejourney('rj_live_xxxxxxxxxxxx', {
  apiUrl: 'https://api.rejourney.co',
  captureReplay: true,
  autoStart: false,
  autoTrackRoutes: true,
  autoTrackNetwork: true,
  trackConsoleLogs: false,
  maskAllInputs: true,
  blockSelector: '[data-rj-block], [data-rejourney-block]',
  maskTextSelector: '[data-rj-mask], [data-rejourney-mask]',
});

// Call after consent when required.
startRejourney();

Rejourney.setUserIdentity('user_123');
Rejourney.setMetadata({ plan: 'pro', role: 'admin' });
Rejourney.logEvent('checkout_started', { source: 'pricing_page' });
Rejourney.trackScreen('Pricing');
Rejourney.stop();
```

Key naming:

- Keep the public API name `publicKey` to match the existing mobile SDK language.
- Example key values should use Rejourney's `rj_...` prefix, not Stripe-style `pk_...`.
- Environment variable names may still need framework-required public prefixes such as `NEXT_PUBLIC_`, `PUBLIC_`, `GATSBY_`, or `VITE_`, but the value itself should be an `rj_...` key.

Recommended types:

```ts
export interface WebRecordingContext {
  userAgent: string;
  url: string;
  origin: string;
  referrer: string;
  webdriver: boolean;
  prerendering: boolean;
}

export interface RejourneyWebConfig {
  publicKey?: string;
  apiUrl?: string;
  enabled?: boolean;
  autoStart?: boolean;
  disableInDev?: boolean;
  debug?: boolean;

  observeOnly?: boolean;
  captureReplay?: boolean;
  maxSessionDuration?: number;
  collectGeoLocation?: boolean;
  ignoreBots?: boolean;
  recordAutomation?: boolean;
  botUserAgentPattern?: RegExp;
  shouldRecord?: (context: WebRecordingContext) => boolean;

  autoTrackRoutes?: boolean;
  routeName?: (location: Location) => string;
  autoTrackNetwork?: boolean;
  networkIgnoreUrls?: (string | RegExp)[];
  networkCaptureSizes?: boolean;
  trackConsoleLogs?: boolean;
  trackLongTasks?: boolean;
  trackResourceErrors?: boolean;

  maskAllInputs?: boolean;
  maskInputOptions?: Record<string, boolean>;
  blockClass?: string | RegExp;
  blockSelector?: string;
  ignoreClass?: string | RegExp;
  ignoreSelector?: string;
  maskTextClass?: string | RegExp;
  maskTextSelector?: string;
  maskInputFn?: (value: string, element: HTMLElement) => string;
  maskTextFn?: (text: string, element: HTMLElement) => string;

  rrweb?: {
    checkoutEveryNms?: number;
    checkoutEveryNth?: number;
    sampling?: Record<string, unknown>;
    inlineStylesheet?: boolean | 'all';
    inlineImages?: boolean;
    collectFonts?: boolean;
    captureAssets?: {
      objectURLs?: boolean;
      origins?: string[] | true | false;
      images?: boolean;
      video?: boolean;
      audio?: boolean;
      stylesheets?: boolean | 'without-fetch';
      processStylesheetsWithin?: number;
      stylesheetsRuleThreshold?: number;
    };
    recordCanvas?: boolean;
    canvasSamplingFps?: number;
  };

  beforeSendEvent?: (event: unknown) => unknown | null;
  beforeSendNetwork?: (request: NetworkRequestParams) => NetworkRequestParams | null;
  onAuthError?: (error: { code: number; message: string; domain?: string }) => void;
}
```

Defaults should be privacy-first for websites:

```ts
const DEFAULT_WEB_CONFIG = {
  enabled: true,
  autoStart: false,
  observeOnly: false,
  captureReplay: true,
  autoTrackRoutes: true,
  autoTrackNetwork: true,
  trackConsoleLogs: false,
  trackLongTasks: true,
  trackResourceErrors: true,
  collectGeoLocation: true,
  ignoreBots: true,
  recordAutomation: false,

  maskAllInputs: true,
  maskInputOptions: {
    password: true,
    email: true,
    tel: true,
    text: true,
    number: true,
    search: true,
    url: true
  },
  blockClass: 'rr-block',
  ignoreClass: 'rr-ignore',
  maskTextClass: 'rr-mask',
  blockSelector: '[data-rj-block], [data-rejourney-block]',
  ignoreSelector: '[data-rj-ignore], [data-rejourney-ignore]',
  maskTextSelector: '[data-rj-mask], [data-rejourney-mask], [data-private], [data-testid*="password"]',

  rrweb: {
    checkoutEveryNms: 60_000,
    checkoutEveryNth: 200,
    sampling: {
      mousemove: 50,
      scroll: 150,
      media: 800,
      input: 'last'
    },
    inlineStylesheet: true,
    inlineImages: false,
    collectFonts: false,
    captureAssets: {
      objectURLs: true,
      origins: false,
      images: false,
      stylesheets: 'without-fetch',
      processStylesheetsWithin: 2000
    },
    recordCanvas: false
  }
};
```

Do not silently collect all text content just because rrweb can. Website replay has materially higher privacy exposure than mobile screenshot capture because DOM snapshots can include hidden text, rendered user data, prefilled fields, and app state embedded in markup.

### Bot And Scraper Suppression

Do not record bots, scrapers, link unfurlers, SEO crawlers, synthetic monitors, or test automation by default. This should be a launch requirement, not a dashboard cleanup task.

Use layered detection:

- SDK preflight before config fetch. If the visitor is bot-like, return a local disabled state and do not call `/api/sdk/config`, create a visitor id, start rrweb, patch network APIs, or upload anything.
- Backend classification on `/api/sdk/config`, auth, presign, complete, and lifecycle routes. Public `rj_...` keys are visible by design, so the server must still reject bot-like and abuse traffic.
- Dashboard/accounting should count suppressed bot attempts separately from billable sessions.

Client-side skip conditions:

- `navigator.userAgent` matches known crawler/link-preview/synthetic-monitor patterns. Start with a small vendored wrapper around `isbot` instead of maintaining a large regex by hand.
- `navigator.webdriver === true`, unless `recordAutomation: true` is set for an explicit test project or local QA.
- `document.prerendering === true`. Defer startup until activation; do not record prerender speculation.
- Obvious non-browser user agents such as `curl`, `wget`, `python-requests`, headless fetchers, link checkers, and uptime probes.
- Customer-provided `shouldRecord(context) === false`.

Do not depend only on user agent. It is easy to spoof and many bots do not execute JavaScript anyway. Treat it as cost/privacy suppression, not security.

Suggested server response for a classified bot:

```json
{
  "enabled": false,
  "recording": false,
  "reason": "bot"
}
```

Implementation notes:

- Keep a shared `classifyWebClient()` helper in the web SDK and backend so behavior is consistent.
- Allow explicit overrides only through project config or SDK config, never through URL query params.
- Include bot suppression in SDK telemetry at aggregate level only; do not store full bot page views as sessions.
- Add tests for Googlebot/Bingbot/DuckDuckBot, link unfurlers like Slackbot/Discordbot/facebookexternalhit, SEO crawlers like AhrefsBot/SemrushBot, Lighthouse/PageSpeed/GTmetrix, `navigator.webdriver`, and a normal Chrome/Safari/Firefox UA.

## Web Session Lifecycle

The web SDK should use the same high-level lifecycle contract as mobile:

1. `initRejourney(publicKey, options)` stores the Rejourney `rj_...` public key and prepares browser-safe state.
2. `startRejourney()`:
   - runs bot/scraper/automation suppression locally before any network call;
   - fetches `/api/sdk/config`;
   - applies remote gates;
   - samples locally;
   - obtains an upload token;
   - creates a client session id `session_{Date.now()}_{cryptoRandom}`;
   - starts telemetry;
   - starts rrweb only when visual replay is allowed.
3. Events and rrweb chunks flush periodically.
4. `stopRejourney()` stops capture, drains queues, and sends `/api/ingest/session/end`.
5. If the page dies before stop completes, backend reconciliation still closes the session.

Browser lifecycle constraints:

- Use `visibilitychange` as the last reliable moment to persist/drain a small amount of data.
- Use `pagehide` as a fallback and for bfcache-aware cleanup.
- Avoid `unload`. It is unreliable, harms bfcache, and may not run.
- Avoid `beforeunload` except for app-owned unsaved-work prompts. It is not a reliable analytics close signal.
- `navigator.sendBeacon()` and `fetch(..., { keepalive: true })` are useful only for small final payloads. Both have practical body limits around 64 KiB.
- Treat final close as best-effort. The backend already has the right posture: session end is a hint, not the source of truth.

Session rollover recommendation:

- Keep the existing 60 second live ingest window on the server.
- Do not copy the mobile "backgrounded for 60 seconds means new session" rule directly to web. It is right for native apps because background usually means the app is not usable. On the web, background tabs, quick tab switches, reading another tab, OAuth/payment redirects, and bfcache restores are normal parts of one browsing session.
- For web, keep the same session across short and medium hidden periods as long as the page is still alive and the max session duration has not been reached.
- Roll over on explicit boundaries: max recording duration, user identity switch, domain/origin change, storage/auth reset, very long inactivity, or a new top-level page load after the old session has already been finalized server-side.
- Recommended client hidden rollover threshold: 30 minutes, configurable from remote config. Use 60 seconds only for the backend live-ingest badge/fail-safe, not for splitting web sessions.
- If the page is restored from bfcache with `pageshow.persisted === true`, resume the same tab session if the local session is still valid; otherwise start a new one and send a best-effort close for the old session.
- If multiple tabs for the same site are open, either:
  - create a separate Rejourney session per tab, recommended for replay fidelity; or
  - coordinate with `BroadcastChannel` and a tab id if product wants one active tab per visitor.

## Web Upload Model

Do not send every rrweb event directly to the API. Use the existing artifact pattern:

```text
Browser SDK
  rrweb emits events
  event buffer accumulates
  gzip JSON chunk
  POST /api/ingest/rrweb/presign
  PUT upload relay URL
  POST /api/ingest/rrweb/complete

Backend
  recording_artifacts(kind='rrweb')
  Redis buffer + flush worker
  S3 canonical object
  artifact worker validates JSON
  session reconciliation marks replayAvailable
```

Chunk format:

```json
{
  "version": 1,
  "format": "rrweb",
  "sessionId": "session_1770000000000_abcd",
  "sdk": {
    "name": "@rejourneyco/web",
    "version": "0.1.0"
  },
  "page": {
    "url": "https://example.com/pricing",
    "title": "Pricing",
    "referrer": "https://example.com/"
  },
  "viewport": {
    "width": 1440,
    "height": 900,
    "devicePixelRatio": 2
  },
  "startedAt": 1770000000000,
  "chunkStartedAt": 1770000000200,
  "chunkEndedAt": 1770000005200,
  "sequence": 0,
  "isCheckout": false,
  "events": []
}
```

Flush policy:

- Flush rrweb chunks every 5 seconds, 250 events, or 512 KiB uncompressed, whichever comes first.
- Flush event/analytics chunks every 5 seconds or 100 events.
- Compress chunks as gzip before upload, preferably off the main thread.
- Persist unsent chunks to IndexedDB with a session-scoped queue.
- Cap local queue size, for example 20 MB or 100 chunks, then evict oldest replay chunks before telemetry/error chunks.
- Use idempotency keys and deterministic client upload ids:

```text
rrweb_{sessionId}_{sequence}_{chunkStartedAt}_{sha1(gzipBytes).slice(0,8)}
```

Final flush:

- On `visibilitychange:hidden`, write in-memory buffers to IndexedDB first.
- Attempt a small `sendBeacon` or `fetch(keepalive)` only for `/session/end` and a tiny telemetry summary.
- Do not attempt to flush large rrweb chunks during page hide. Let the next page load/service worker/background queue retry when possible.

## Backend Changes

### 1. Project/Auth Changes

`projects.webDomain` already exists in validation. Web support should use it.

Add web-specific auth checks:

- Extend `/api/sdk/config` response with platform fields when `x-platform: web`.
- Validate `Origin` and/or `Referer` against `projects.webDomain` for browser SDK config, device auth, and ingest.
- Accept localhost/dev origins when project settings explicitly allow development domains.
- Do not treat Origin as perfect security. It protects normal browsers, not curl abuse.
- Classify bots/scrapers/synthetic monitors before materializing a session, issuing an upload token, counting usage, or accepting replay bytes.
- Keep existing byte budgets and rate limits.
- Add per-project domain abuse dashboards/alerts.

Bot/scraper handling on the backend:

- Add `classifyWebClient({ userAgent, origin, referer, platform, webdriverHint })`.
- Use an established UA classifier such as `isbot` behind a tiny Rejourney wrapper so rules can be pinned, tested, and patched.
- Return disabled config for classified bots on `/api/sdk/config`.
- Reject classified bot traffic on auth/presign/complete with a non-retryable response, for example `403` with code `bot_suppressed`.
- Log aggregate suppression counts by project/origin/reason, but do not create full sessions for bot traffic.
- Keep a project-level escape hatch for QA/synthetic monitoring, default off.

Web upload token:

- Reuse `/api/ingest/auth/device` if practical, but rename internally from "device" to "client" over time.
- Use a browser visitor id as `deviceId`, for example `web_anon_{uuid}`.
- Include `platform: 'web'`, `origin`, and `projectId` in the upload token payload.
- Token TTL can stay 1 hour.
- For web, do not require a native bundle id/package name.

### 2. New Artifact Kind

Add `recording_artifacts.kind = 'rrweb'`.

The schema currently stores artifact kind as a varchar, so a migration is not required for the kind itself. Still update:

- comments in `backend/src/db/schema.ts`;
- worker kind priority in `backend/src/worker/workerDefinitions.ts`;
- artifact lifecycle helpers where replay kinds are hard-coded;
- session backup reports and quality checks;
- stats/bytes displays;
- cache invalidation;
- retention/purge safety checks if they filter by replay kinds.

Recommended replay-kind helper:

```ts
export function isReplayArtifactKind(kind: string | null | undefined): boolean {
  return kind === 'screenshots' || kind === 'hierarchy' || kind === 'rrweb';
}

export function isReplayAvailabilityArtifactKind(kind: string | null | undefined): boolean {
  return kind === 'screenshots' || kind === 'rrweb';
}
```

Do not make `hierarchy` alone openable; it is auxiliary on mobile.

### 3. Ingest Routes

Lowest-risk path:

- Add new routes:
  - `POST /api/ingest/rrweb/presign`
  - `POST /api/ingest/rrweb/complete`
- Internally reuse `prepareReplayArtifactForUpload`, `completeArtifactUpload`, upload relay URLs, idempotency, byte budgets, and project gates.

Presign body:

```json
{
  "sessionId": "session_1770000000000_abcd",
  "sequence": 0,
  "startTime": 1770000000200,
  "endTime": 1770000005200,
  "eventCount": 225,
  "sizeBytes": 88421,
  "compression": "gzip",
  "platform": "web",
  "sdkVersion": "0.1.0",
  "isCheckout": false,
  "isSampledIn": true
}
```

Storage path:

```text
tenant/{teamId}/project/{projectId}/sessions/{sessionId}/rrweb/rrweb_{sequence}_{startTime}.json.gz
```

Keep mobile `events` artifacts separate. rrweb contains replay data and may be very large; product events/network/errors stay in existing `events` artifacts so dashboard analytics can continue to use `processEventsArtifact`.

### 4. Artifact Processor

Add `processRrwebArtifact`:

- Gunzip if needed.
- Parse JSON.
- Accept either `{ events: [...] }` or a raw array only for migration convenience. New SDK should send the envelope.
- Verify non-empty events.
- Verify event timestamps are finite.
- Verify at least one full snapshot exists in the first chunk or in a known earlier chunk. rrweb event types are numeric, so use `@rrweb/types` in backend only if it does not bloat production builds too much; otherwise define a tiny local validator.
- Enforce event count and size ceilings per chunk.
- Strip or reject events that exceed maximum serialized node sizes.
- Save size, start/end, event count.
- Mark artifact ready.

Important: do not inline rrweb events into `sessions.events`. Store rrweb in object storage only. Keep Postgres rows as metadata and searchable analytics only.

### 5. Session Reconciliation

Current code marks `replayAvailable` from ready screenshot artifacts:

```ts
const replayAvailable = readyScreenshotCount > 0;
```

Update to:

```ts
const replayAvailable = readyScreenshotCount > 0 || readyRrwebCount > 0;
```

Update `loadSessionWorkAggregate`:

- `readyRrwebCount`
- `readyRrwebBytes`
- `openReplayArtifactCount` includes `rrweb`
- `latestReplayArtifactEndMs` includes `rrweb`
- `latestReadyAt` includes `rrweb`

Update metrics:

- Add `rrwebSegmentCount`
- Add `rrwebTotalBytes`
- Keep `screenshotSegmentCount` for mobile.

This likely needs a migration for `session_metrics` if we want first-class columns. If not, stats can compute from `recording_artifacts`, but columns are better for archive list performance.

### 6. Session Detail API

Current detail payloads are screenshot-first. Add:

- `playbackMode: 'screenshots' | 'rrweb' | 'none'`
- `rrwebEventChunks: Array<{ artifactId, startTime, endTime, eventCount, sizeBytes, url? }>`
- `rrwebEventsStatus: 'ready' | 'preparing' | 'none'`
- `rrwebEventCount`

Do not return all rrweb events in `/bootstrap` or `/core`.

Add either:

- `GET /api/session/:id/rrweb/events` to stream/merge events server-side with pagination; or
- `GET /api/session/:id/rrweb/chunks` returning signed URLs and metadata.

Recommendation: start with a server-side merge endpoint for access control and future redaction repair:

```text
GET /api/session/:id/rrweb/events?from=0&to=600000
```

The endpoint should:

- authorize via existing `sessionAuth`;
- load ready `rrweb` artifacts;
- stream or chunk JSON to the client;
- optionally filter by time range;
- set cache headers based on artifact readiness;
- support gzip response.

### 7. Event Analytics Processor

The web SDK should continue uploading normalized analytics events as `events` artifacts. Add web event normalization to `processEventsArtifact`:

- `type: 'navigation'` or `type: 'screen_change'` from route changes.
- `type: 'click'`, `type: 'tap'`, `type: 'rage_click'`, `type: 'dead_click'`.
- `type: 'scroll'`.
- `type: 'network_request'`.
- `type: 'error'`.
- `type: 'resource_error'`.
- `type: 'long_task'` or `type: 'ui_freeze'`.
- `type: 'custom'`.
- `type: '$user_property'`.

Coordinate heatmap changes:

- Web coordinates should include page route, viewport width/height, document scroll offset, and target bounding box when available.
- Normalize to viewport for click heatmaps.
- Consider page-specific heatmaps, not mobile screen-only heatmaps.

## Dashboard Changes

### Player

Add:

```text
dashboard/web-ui/app/shared/ui/core/RrwebReplayPlayer.tsx
```

Use either:

- `@rrweb/replay` plus our existing Rejourney controls, recommended for visual consistency; or
- `rrweb-player`, faster for MVP but harder to make look like the current player.

Recommendation: use `@rrweb/replay` directly and keep current Rejourney controls/timeline.

Player responsibilities:

- Fetch rrweb events after core payload loads.
- Instantiate rrweb `Replayer` inside a sandboxed container.
- Use `skipInactive` and `inactivePeriodThreshold` to match current playback expectations.
- Map Rejourney custom/network/error events to timeline markers.
- Expose `seekTo`, `play`, `pause`, `getCurrentTime` like `ScreenshotReplayPlayer`.
- Destroy the replayer on unmount to release iframe/memory.
- Load console replay plugin only when console events are present.
- For canvas replay, use `UNSAFE_replayCanvas` only if that session explicitly opted into canvas and the dashboard warns internally that the rrweb sandbox is reduced.

### Replay Selection

In session detail:

```tsx
if (playbackMode === 'rrweb') {
  return <RrwebReplayPlayer ... />;
}
return <ScreenshotReplayPlayer ... />;
```

Do not try to convert rrweb into screenshot frames for initial launch.

### Thumbnails

Mobile thumbnails come from screenshot archives. Web rrweb has no image frames. Options:

1. MVP: use a generic web replay thumbnail plus metadata.
2. Better: async thumbnail worker uses headless Chromium to replay first N seconds and capture a PNG/JPEG.
3. Later: capture a customer-provided page preview or first full snapshot render.

Recommendation:

- MVP generic thumbnail is acceptable for launch if the replay opens reliably.
- Add headless thumbnail generation after replay playback is stable.

### Timeline And Network

Keep the existing timeline shape:

- custom events;
- network requests;
- JS errors;
- resource errors;
- long tasks;
- console logs;
- clicks/rage clicks/dead clicks;
- route changes.

Do not rely only on rrweb custom events for product analytics. Store normalized events in existing event artifacts so archive filters and dashboards remain fast.

## Privacy And Legal Guardrails

Web session replay is legally and reputationally riskier than mobile replay. The implementation should bias toward source-side minimization.

### Consent

Recommended product behavior:

- Web SDK should not auto-start visual replay unless the customer explicitly passes `autoStart: true`.
- Documentation should show consent-gated startup by default.
- For EEA/UK users, customers should be able to initialize after CMP consent or start in `observeOnly` until consent is granted.
- The SDK must provide `stop()` and `clearUserIdentity()`.
- The SDK should expose `setConsent({ replay: boolean, analytics: boolean })` or document a simple consent integration pattern.

CNIL's 2026 draft recommendation specifically treats session replay as needing prior consent in France. CNIL also warns that replay should be limited to explicit purposes and configured according to those purposes. Even outside France, this is the safer default posture.

### Source-Side Masking

Default:

- `maskAllInputs: true`.
- Password/secure fields always masked.
- Common data attributes:
  - `data-rj-mask`
  - `data-rejourney-mask`
  - `data-rj-block`
  - `data-rejourney-block`
  - `data-rj-ignore`
  - `data-rejourney-ignore`
- Common classes:
  - `rr-mask`
  - `rr-block`
  - `rr-ignore`

Blocking vs masking:

- Mask text when the layout is useful but content is sensitive.
- Block entire elements for payment forms, account numbers, health data, legal documents, private messages, admin notes, and third-party widgets.
- Always block third-party payment iframes, chat widgets, CAPTCHA, one-time-code inputs, and file previews unless the customer explicitly opts in.

### Console And Network

Default recommendation:

- `trackConsoleLogs: false` on web.
- `autoTrackNetwork: true`, but never capture request or response bodies by default.
- Capture URL, method, status, duration, size, and content type only.
- Scrub query params using sensitive-key denylist:
  - `token`
  - `key`
  - `secret`
  - `password`
  - `auth`
  - `access_token`
  - `id_token`
  - `refresh_token`
  - `api_key`
  - `code`
  - `state`
  - `session`
  - `email`
  - `phone`
- Allow customers to add URL ignore patterns.
- Always ignore Rejourney endpoints.

### Data Processing

Update Rejourney docs/contracts to distinguish:

- Rejourney as processor for customer-owned replay/analytics.
- Any Rejourney-owned product-improvement telemetry, if collected, as a separate purpose and toggle.

Do not reuse customer replay content for Rejourney model/product improvement unless the customer explicitly opts in contractually and technically.

### Retention

Use existing retention tiers, but document that web replay can contain more personal data than mobile screenshots because DOM text can include hidden or server-rendered data.

Add admin controls:

- Disable replay by project.
- Disable console capture by project.
- Force mask all inputs by project.
- Disable IP geolocation by project.
- Domain allowlist by project.
- Delete recordings by session/user/project.

## Web-Specific Replay Limitations

Customers need honest docs. rrweb is excellent, but not magic.

| Area | Expected behavior |
|---|---|
| CSS | Best if stylesheets are same-origin/CORS-readable or captured as assets. CSS that changes after the session can alter old replay unless captured. |
| Images | Not captured by default. Replays may load current image URLs. Offer same-origin/allowlist asset capture for apps that need long-lived exactness. |
| Fonts | `collectFonts` can improve fidelity but increases data. Off by default. |
| Canvas/WebGL/maps/charts | Not recorded by default. `recordCanvas` can capture snapshots but increases storage and requires unsafe canvas replay. |
| Video/audio | Media interactions can be captured; media pixels/audio are not replayed as a recorded video unless assets are available/captured. |
| Cross-origin iframes | Cannot inspect third-party frame DOM. rrweb can record cross-origin iframes only when the recorder is injected into the child frame too. |
| Payment/CAPTCHA iframes | Should be blocked, not captured. |
| Shadow DOM | Open shadow roots should be tested. Closed shadow roots cannot be inspected by page JavaScript by design; treat as opaque and require manual block/mask if sensitive. |
| Browser extensions | Extension-injected DOM may appear. Consider default ignore selectors for common extension roots if this becomes noisy. |
| Ad blockers | Some users may block the SDK or ingest endpoint. Dashboard should tolerate missing sessions. |

## Framework Support

The core SDK should work in any browser. Framework adapters should be thin wrappers that solve "when do I start in the browser?" and "how do I track routes?".

### Plain HTML / Script Tag

Needed for Webflow, WordPress, Rails, Laravel, Django, Shopify custom themes, and simple static sites.

```html
<script>
  window.RejourneySettings = {
    publicKey: 'rj_live_xxxxxxxxxxxx',
    autoStart: false
  };
</script>
<script async src="https://cdn.rejourney.co/web/v0/rejourney.min.js"></script>
```

After consent:

```html
<script>
  window.Rejourney.start();
</script>
```

For CSP:

- Offer a self-hosted script URL.
- Publish SRI hashes per exact version.
- Document required `connect-src` domains.
- Do not require `unsafe-inline`.

### React / Vite / CRA

Use an effect in the app root:

```tsx
import { useEffect } from 'react';
import { initRejourney, startRejourney } from '@rejourneyco/web';

export function RejourneyWeb() {
  useEffect(() => {
    initRejourney('rj_live_xxxxxxxxxxxx');
    startRejourney();
  }, []);

  return null;
}
```

React Strict Mode runs effect setup/cleanup extra in development. The SDK must be idempotent: multiple `init()` or `start()` calls should not create duplicate sessions or double-patch fetch/XHR.

Adapter:

```tsx
import { RejourneyProvider } from '@rejourneyco/web/react';

<RejourneyProvider publicKey="rj_live_xxxxxxxxxxxx" startOnMount />
```

### Next.js App Router

Next App Router layouts/pages are Server Components by default. Browser APIs must live in a Client Component.

```tsx
// app/rejourney-client.tsx
'use client';

import { useEffect } from 'react';
import { initRejourney, startRejourney } from '@rejourneyco/web';

export function RejourneyClient() {
  useEffect(() => {
    initRejourney(process.env.NEXT_PUBLIC_REJOURNEY_KEY!);
    startRejourney();
  }, []);

  return null;
}
```

```tsx
// app/layout.tsx
import { RejourneyClient } from './rejourney-client';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <RejourneyClient />
        {children}
      </body>
    </html>
  );
}
```

Adapter:

```tsx
import { RejourneyNext } from '@rejourneyco/web/next';
```

`next/script` can be supported for CDN installs, but handler callbacks only work in Client Components.

### Next.js Pages Router

Initialize in `_app.tsx` with a browser-only effect.

```tsx
import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import { initRejourney, startRejourney } from '@rejourneyco/web';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    initRejourney(process.env.NEXT_PUBLIC_REJOURNEY_KEY!);
    startRejourney();
  }, []);

  return <Component {...pageProps} />;
}
```

Route tracking can patch History API generically, but the adapter should also listen to Next router events for cleaner route names.

### Remix

Best integration point is `app/entry.client.tsx`, because Remix documents it as the browser entrypoint where client libraries can be initialized.

```tsx
import { RemixBrowser } from '@remix-run/react';
import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { initRejourney, startRejourney } from '@rejourneyco/web';

initRejourney(window.ENV.REJOURNEY_KEY);
startRejourney();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
```

Alternative: root route `useEffect`. Avoid browser-only side effects in route modules that render on the server.

### Vue

Offer a Vue plugin:

```ts
import { createApp } from 'vue';
import { createRejourney } from '@rejourneyco/web/vue';
import App from './App.vue';
import router from './router';

const app = createApp(App);
app.use(createRejourney({
  publicKey: 'rj_live_xxxxxxxxxxxx',
  router
}));
app.mount('#app');
```

The plugin should:

- initialize after `app.use`;
- start based on config/consent;
- use `router.afterEach` for route names when a router is supplied;
- expose `$rejourney` on app config and `useRejourney()` for Composition API.

### Nuxt 3

Use a client-only plugin. Nuxt supports `.client` plugin suffixes.

```ts
// plugins/rejourney.client.ts
import { defineNuxtPlugin, useRuntimeConfig } from '#app';
import { initRejourney, startRejourney } from '@rejourneyco/web';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  initRejourney(config.public.rejourneyKey);
  startRejourney();
});
```

Adapter:

```ts
import { defineRejourneyNuxtPlugin } from '@rejourneyco/web/nuxt';
```

### Angular

Angular v19+ deprecates `APP_INITIALIZER`; current docs recommend `provideAppInitializer`.

```ts
import { ApplicationConfig, provideAppInitializer } from '@angular/core';
import { initRejourney, startRejourney } from '@rejourneyco/web';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => {
      initRejourney('rj_live_xxxxxxxxxxxx');
      startRejourney();
    })
  ]
};
```

Adapter should also provide:

- `RejourneyService`
- router event tracking for `NavigationEnd`
- `rejourneyMask` directive that writes `data-rj-mask`
- `rejourneyBlock` directive that writes `data-rj-block`

For older NgModule apps, document `APP_INITIALIZER` as legacy.

### SvelteKit

Use `onMount` or a `browser` guard. Svelte `onMount` does not run during server rendering.

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { initRejourney, startRejourney } from '@rejourneyco/web';

  onMount(() => {
    initRejourney('rj_live_xxxxxxxxxxxx');
    startRejourney();
  });
</script>

<slot />
```

SvelteKit-specific route tracking can use `$app/navigation` hooks later, but History API patching is enough for MVP.

### Astro

Astro pages are server-rendered by default and only hydrate client islands when directed. For a global SDK, plain script integration is simplest:

```astro
---
const key = import.meta.env.PUBLIC_REJOURNEY_KEY;
---

<script define:vars={{ key }}>
  window.RejourneySettings = { publicKey: key, autoStart: true };
</script>
<script async src="https://cdn.rejourney.co/web/v0/rejourney.min.js"></script>
```

If using a React/Vue/Svelte island, hydrate it with `client:load`:

```astro
<RejourneyClient client:load />
```

### Gatsby

Use `gatsby-browser.ts` because Gatsby documents it as the browser-side API file.

```ts
// gatsby-browser.ts
import { initRejourney, startRejourney, Rejourney } from '@rejourneyco/web';

export const onClientEntry = () => {
  initRejourney(process.env.GATSBY_REJOURNEY_KEY!);
  startRejourney();
};

export const onRouteUpdate = ({ location }) => {
  Rejourney.trackScreen(location.pathname);
};
```

### SolidStart

Use `onMount` in a root client component and guard server rendering:

```tsx
import { onMount } from 'solid-js';
import { isServer } from 'solid-js/web';
import { initRejourney, startRejourney } from '@rejourneyco/web';

export function RejourneySolid() {
  onMount(() => {
    if (isServer) return;
    initRejourney('rj_live_xxxxxxxxxxxx');
    startRejourney();
  });
  return null;
}
```

### Qwik

Use a visible/browser task or script integration. Because Qwik's resumability model is sensitive to eager client code, prefer the CDN snippet or a small component that starts after the app is interactive. Treat Qwik as a second-wave adapter unless customers ask for it.

## Implementation Phases

### Phase 0: Spike

Goal: prove rrweb event capture, upload, and dashboard playback inside Rejourney.

- Create throwaway local web test app.
- Record rrweb events with strict masking.
- Store a sample `.json.gz` artifact manually.
- Build a temporary dashboard route that loads events and replays them.
- Verify CSS, route changes, click markers, network markers, errors, and bfcache behavior.

Exit criteria:

- A local rrweb replay opens in the Rejourney dashboard.
- Masked inputs never appear in stored payloads.
- Session closes correctly without `/session/end`.

### Phase 1: Backend Artifact Support

- Add `rrweb` artifact routes or extend ingest with a safe new kind.
- Add processor validation.
- Update worker kind priorities.
- Update session reconciliation and presentation state.
- Add session detail payload fields.
- Add stats bytes and cache invalidation.
- Add tests for:
  - rrweb presign/complete;
  - ready rrweb marks replay available;
  - hierarchy alone does not mark replay available;
  - mixed mobile/web artifacts do not break existing sessions;
  - immutable/closed sessions reject new replay work correctly.

### Phase 2: Web SDK Core

- Build `@rejourneyco/web`.
- Implement config fetch, auth token, session id, sampling, start/stop.
- Implement rrweb recorder wrapper.
- Implement event queue, rrweb queue, gzip, retry, IndexedDB persistence.
- Implement lifecycle handling.
- Implement network/error/long task/route tracking.
- Implement privacy selectors and APIs.
- Implement bot/scraper/prerender/automation suppression before config fetch.
- Implement SDK telemetry.
- Add vitest/unit tests and Playwright browser tests.

### Phase 3: Dashboard Playback

- Add `RrwebReplayPlayer`.
- Integrate with session detail route.
- Add loading/error/empty states.
- Add timeline marker sync.
- Add web stats labels.
- Add generic web thumbnail.
- Add E2E tests with saved rrweb fixtures.

### Phase 4: Framework Adapters And Docs

- React/Next/Vue/Nuxt/SvelteKit/Angular/Remix/Astro/Gatsby docs.
- Thin adapter entrypoints.
- Consent/CMP examples.
- Privacy policy wording.
- CSP/SRI docs.
- Troubleshooting docs for CSS, iframes, canvas, ad blockers, and masking.

### Phase 5: Hardening And Rollout

- Internal dogfood on `rejourney.co`.
- Launch behind project-level feature flag.
- Start with low sample rate.
- Monitor:
  - ingest byte volume;
  - chunk failure rate;
  - replay open failure rate;
  - rrweb player crash rate;
  - P95 SDK main-thread overhead;
  - average bytes per minute;
  - bot/scraper suppression count and false-positive reports;
  - privacy-block/mask coverage.
- Expand to beta customers after fixture coverage includes their frameworks.

## Test Matrix

Browsers:

- Chrome desktop and Android
- Safari desktop and iOS
- Firefox desktop
- Edge desktop

Framework fixtures:

- Plain HTML
- React + Vite
- Next App Router
- Next Pages Router
- Remix
- Vue
- Nuxt 3
- Angular standalone
- SvelteKit
- Astro
- Gatsby

Replay fidelity fixtures:

- Static DOM
- SPA navigation
- Forms with text, email, password, OTP
- Masked content and blocked content
- Long lists
- CSS animations
- Lazy-loaded images
- Same-origin and cross-origin stylesheets
- Shadow DOM open component
- Closed shadow root component as opaque/blocked
- Canvas chart with recording disabled
- Canvas chart with recording enabled
- Same-origin iframe
- Cross-origin iframe
- Payment iframe blocked
- Offline then reconnect
- bfcache restore
- Multiple tabs

Privacy fixtures:

- Password show/hide toggle.
- Credit-card field.
- Email in input and in normal text.
- API token in URL query params.
- Console log with email/token.
- Hidden DOM node with sensitive text.
- Third-party widget.

Performance fixtures:

- 10 minute session.
- 1,000 DOM mutations/min.
- Large stylesheet.
- High-frequency scroll.
- Background tab throttling.
- CPU-throttled mobile browser.

Bot/scraper suppression fixtures:

- Googlebot, Bingbot, DuckDuckBot, Applebot.
- Slackbot, Discordbot, facebookexternalhit, Twitterbot/X bot, LinkedInBot.
- AhrefsBot, SemrushBot, MJ12bot, DotBot, CCBot, GPTBot.
- Chrome Lighthouse, PageSpeed Insights, GTmetrix, Pingdom/UptimeRobot.
- `navigator.webdriver === true` in Playwright.
- Normal Chrome, Safari, Firefox, and Edge user agents are not suppressed.

## Decisions To Make Before Coding

1. Console default on web.
   - Recommendation: off by default, supported as opt-in.
2. Canvas support at launch.
   - Recommendation: off by default, documented opt-in after security review.
3. CDN snippet at launch.
   - Recommendation: npm first, CDN after package stabilizes and CSP/SRI docs are ready.
4. rrweb event endpoint shape.
   - Recommendation: server-side `/api/session/:id/rrweb/events` first; signed chunk URLs later if needed.
5. Thumbnail strategy.
   - Recommendation: generic web thumbnail for MVP, headless renderer later.
6. Consent API.
   - Recommendation: explicit `start()` after consent, plus helper `setConsent()`.
7. Framework adapter depth.
   - Recommendation: maintain deep adapters only for React/Next/Vue/Nuxt/Angular/SvelteKit; docs-only examples for the rest until demand appears.
8. Web hidden-tab rollover threshold.
   - Recommendation: do not use 60 seconds for client session splitting. Use 30 minutes, configurable remotely, while keeping the server's 60-second live-ingest fail-safe.

## Things That Will Bite Later If Ignored

- Treating rrweb chunks as mobile screenshots. This will fight the entire dashboard and lifecycle model.
- Marking only `screenshots` as replay-available. Web sessions would ingest successfully but never open.
- Copying mobile's 60-second background rollover directly to web and splitting normal tab-switch/OAuth/payment flows.
- Recording bots, scrapers, link unfurlers, synthetic monitors, and Playwright/Cypress traffic by default.
- Starting capture before consent on public websites.
- Leaving inputs unmasked by default.
- Capturing console logs by default without clear warning.
- Trying to flush large rrweb chunks on `pagehide`.
- Using `unload` or trusting `/session/end`.
- Loading the SDK in SSR paths without browser guards.
- Using `@latest` rrweb packages.
- Capturing all images/fonts/canvas by default and exploding storage.
- Letting the public browser key become a cheap abuse vector without origin checks and byte budgets.
- Returning full rrweb event arrays from `/bootstrap`.
- Letting old CSS/assets drift so old replays no longer look like the original session.
- Not building replay fixture tests before upgrading rrweb.

## Source Notes

Primary/reference sources used:

- rrweb overview and use cases: https://rrweb.com/
- rrweb guide, install, record/replay options, privacy controls, checkout snapshots: https://rrweb.com/docs/guide
- rrweb asset capture behavior and stylesheet/image options: https://rrweb.com/docs/assets
- rrweb storage optimization, sampling, and compression guidance: https://rrweb.com/docs/recipes/optimize-storage
- rrweb canvas recording and unsafe replay caveat: https://rrweb.com/docs/recipes/canvas
- rrweb console plugin: https://rrweb.com/docs/recipes/console
- `isbot` package for bot/crawler user-agent classification: https://www.npmjs.com/package/isbot
- MDN `sendBeacon`, visibility guidance, and 64 KiB queued-data limit: https://developer.mozilla.org/docs/Web/API/Navigator/sendBeacon
- MDN `fetch` `keepalive` body-size limit: https://developer.mozilla.org/en-US/docs/Web/API/RequestInit
- web.dev bfcache guidance against `unload`: https://web.dev/articles/bfcache
- Chrome Page Lifecycle guidance: https://developer.chrome.com/docs/web-platform/page-lifecycle-api
- React `useEffect` as the browser/external-system hook: https://react.dev/reference/react/useEffect
- Next.js Client Components and browser API boundary: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js scripts guide: https://nextjs.org/docs/app/guides/scripts
- Vue plugins: https://vuejs.org/guide/reusability/plugins
- Nuxt client-only plugins: https://nuxt.com/docs/3.x/guide/directory-structure/plugins
- Angular `provideAppInitializer`: https://angular.dev/api/core/provideAppInitializer
- Svelte `onMount`: https://svelte.dev/docs/svelte/lifecycle-hooks
- SvelteKit `$app/environment` browser flag: https://svelte.dev/docs/kit/$app-environment
- Remix `entry.client`: https://remix.run/docs/en/main/file-conventions/entry.client
- Remix module constraints for browser-only code: https://remix.run/docs/en/main/guides/constraints
- Astro client directives: https://docs.astro.build/en/reference/directives-reference/
- Gatsby browser APIs: https://www.gatsbyjs.com/docs/reference/config-files/gatsby-browser/
- CNIL 2026 draft recommendation concerning session replay tools: https://www.cnil.fr/sites/default/files/2026-02/recommendation_draft_session_replay.pdf
- CNIL audience measurement/cookie exemption context: https://www.cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience
- FTC PrivacyCon transcript discussing session replay privacy leakage research: https://www.ftc.gov/system/files/documents/videos/privacy-con-2018-part-1/ftc_privacycon_2018_-_transcript_segment_1.pdf
