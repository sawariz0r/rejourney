# Rejourney vs PostHog Web Analytics Benchmark

Generated: 2026-05-19T03:50:44.647Z

## Scope

- Apps: Next.js App Router (next), SvelteKit (sveltekit), Nuxt 3 (nuxt)
- Modes: rejourney, posthog
- Iterations per app/mode: 3
- Browser: chromium, viewport 1365x768
- Rejourney network/API: live, https://api.rejourney.co
- Rejourney key: rj_***
- PostHog network/API: live, https://us.i.posthog.com
- PostHog defaults: 2026-01-30
- PostHog key: phc_***

The benchmark runs the same scripted flow in each fixture: load, form edits, custom analytics, identity/metadata, network request, route transition, synthetic error, missing image, scroll, and an 85 ms controlled long task. Both SDKs use live project endpoints; request payloads are also captured locally for measurement.

- Rejourney network policy: Rejourney SDK points to the configured live Rejourney API and project; config, auth, presign, artifact upload, complete, and session-end calls are captured locally for measurement.
- PostHog network policy: PostHog static/config/event/session-upload requests are sent to the configured live PostHog project and captured locally for measurement.

## Aggregate Results

| app | mode | n | median load ms | median SDK reqs | median SDK upload body | median script transfer | analytics events | rrweb events | privacy findings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| next | rejourney | 3 | 303.4 | 11 | 21.29 KiB | 2.28 MiB | 24 | 0 | 0 |
| sveltekit | rejourney | 3 | 20.1 | 13 | 8.38 KiB | 2.48 MiB | 33 | 25 | 0 |
| nuxt | rejourney | 3 | 173.2 | 14 | 8.4 KiB | 5.32 MiB | 39 | 42 | 0 |
| next | posthog | 3 | 319.9 | 14 | 45.35 KiB | 1.99 MiB | 87 | 0 | 0 |
| sveltekit | posthog | 3 | 51.3 | 14 | 24.99 KiB | 2.07 MiB | 81 | 0 | 0 |
| nuxt | posthog | 3 | 265.6 | 15 | 26.57 KiB | 4.91 MiB | 82 | 0 | 0 |

## Browser CPU And Memory Intensity

CPU intensity uses Chrome DevTools Protocol `Performance.getMetrics()`: `TaskDuration` is the main-thread busy-time proxy across the full scripted visit, including the fixed flush wait. Memory is JS heap used at the end of the run plus the JS heap delta from start to finish.

| app | mode | n | busy % | busy ms/s | task ms | script ms | layout+style ms | long tasks | long-task ms | JS heap delta | JS heap end | DOM node delta |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| next | rejourney | 3 | 4.71 | 47.1 | 417.96 | 160.46 | 11.57 | 2 | 203 | 15.25 MiB | 15.81 MiB | 385 |
| sveltekit | rejourney | 3 | 3.05 | 30.47 | 268.72 | 19.35 | 8.93 | 1 | 85 | 6.07 MiB | 6.63 MiB | 316 |
| nuxt | rejourney | 3 | 3.39 | 33.87 | 305.51 | 21.12 | 9.71 | 1 | 86 | 10.77 MiB | 11.33 MiB | 255 |
| next | posthog | 3 | 4.52 | 45.19 | 449.91 | 185.06 | 11.68 | 2 | 205 | 14.14 MiB | 16.19 MiB | 358 |
| sveltekit | posthog | 3 | 3.06 | 30.58 | 304.03 | 42.02 | 10.59 | 1 | 88 | 7.12 MiB | 9.17 MiB | 354 |
| nuxt | posthog | 3 | 3.19 | 31.88 | 322.24 | 41.17 | 9.77 | 1 | 87 | 13.39 MiB | 15.44 MiB | 264 |

## Per-Run Browser Metrics

| app | mode | iteration | load ms | task ms | busy % | script ms | layout+style ms | long tasks | long-task ms | JS heap delta | JS heap end | SDK upload body |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| next | rejourney | 1 | 343.6 | 511.23 | 5.73 | 187.11 | 27.28 | 2 | 227 | 14.93 MiB | 15.48 MiB | 21.29 KiB |
| next | rejourney | 2 | 303.4 | 413.25 | 4.66 | 159.78 | 11.57 | 2 | 199 | 15.27 MiB | 15.82 MiB | 21.57 KiB |
| next | rejourney | 3 | 297.8 | 417.96 | 4.71 | 160.46 | 10.29 | 2 | 203 | 15.25 MiB | 15.81 MiB | 21.29 KiB |
| sveltekit | rejourney | 1 | 20.3 | 282.69 | 3.2 | 22.6 | 9.02 | 1 | 86 | 5.91 MiB | 6.46 MiB | 8.79 KiB |
| sveltekit | rejourney | 2 | 14.9 | 242.62 | 2.75 | 15.86 | 7.98 | 1 | 85 | 6.07 MiB | 6.63 MiB | 6.11 KiB |
| sveltekit | rejourney | 3 | 20.1 | 268.72 | 3.05 | 19.35 | 9.07 | 1 | 85 | 6.4 MiB | 6.96 MiB | 8.38 KiB |
| nuxt | rejourney | 1 | 211.3 | 305.94 | 3.39 | 20.91 | 10.15 | 1 | 86 | 10.77 MiB | 11.33 MiB | 8.4 KiB |
| nuxt | rejourney | 2 | 165.2 | 295.84 | 3.3 | 21.12 | 9.35 | 1 | 86 | 10.77 MiB | 11.33 MiB | 8.4 KiB |
| nuxt | rejourney | 3 | 173.2 | 305.51 | 3.4 | 22.13 | 9.71 | 1 | 86 | 11.81 MiB | 12.37 MiB | 8.4 KiB |
| next | posthog | 1 | 319.9 | 450.7 | 4.53 | 178.24 | 12.41 | 2 | 199 | 12.93 MiB | 14.98 MiB | 45.12 KiB |
| next | posthog | 2 | 337.8 | 449.91 | 4.52 | 186.28 | 11.5 | 2 | 205 | 14.14 MiB | 16.19 MiB | 45.35 KiB |
| next | posthog | 3 | 316.8 | 432.84 | 4.36 | 185.06 | 11.68 | 2 | 206 | 26.22 MiB | 28.27 MiB | 47.52 KiB |
| sveltekit | posthog | 1 | 51.3 | 300.96 | 3.05 | 47.05 | 10.59 | 1 | 87 | 7.63 MiB | 9.68 MiB | 26.41 KiB |
| sveltekit | posthog | 2 | 44.5 | 307.92 | 3.1 | 42.02 | 10.92 | 1 | 88 | 7.1 MiB | 9.14 MiB | 24.95 KiB |
| sveltekit | posthog | 3 | 87.7 | 304.03 | 3.06 | 41.85 | 10.52 | 1 | 88 | 7.12 MiB | 9.17 MiB | 24.99 KiB |
| nuxt | posthog | 1 | 265.6 | 322.24 | 3.19 | 41.5 | 9.7 | 1 | 87 | 10.74 MiB | 12.79 MiB | 26.57 KiB |
| nuxt | posthog | 2 | 189.8 | 305.38 | 3.04 | 39.78 | 9.91 | 1 | 87 | 13.62 MiB | 15.67 MiB | 26.58 KiB |
| nuxt | posthog | 3 | 268.5 | 325.05 | 3.21 | 41.17 | 9.55 | 1 | 87 | 13.39 MiB | 15.44 MiB | 24.45 KiB |

## Package Footprint

| package | version | dist bytes | dist gzip bytes | files |
| --- | --- | --- | --- | --- |
| @rejourneyco/browser dist | 0.1.0 | 299.56 KiB | 85.06 KiB | 140 |
| posthog-js package dist | 1.374.2 | 29.75 MiB | 8.05 MiB | 239 |

## Rejourney Capture Coverage

| app | analytics events | rrweb events | analytics event types |
| --- | --- | --- | --- |
| next | 24 | 0 | navigation: 6, session_start: 3, app_startup: 3, user_identity_changed: 3, custom: 3, $user_property: 3, scroll: 1, network_request: 1, resource_error: 1 |
| sveltekit | 33 | 25 | navigation: 8, session_start: 3, app_startup: 3, user_identity_changed: 3, custom: 3, $user_property: 3, tap: 2, error: 2, scroll: 2, long_task: 2, resource_error: 2 |
| nuxt | 39 | 42 | navigation: 9, session_start: 3, app_startup: 3, user_identity_changed: 3, custom: 3, $user_property: 3, tap: 3, error: 3, scroll: 3, long_task: 3, resource_error: 3 |

## PostHog Capture Coverage

| app | parsed/internal events | internal rrweb events | event names |
| --- | --- | --- | --- |
| next | 87 | 0 | $autocapture: 27, $opt_in: 12, $pageview: 9, $set: 6, $identify: 6, $$heatmap: 6, $web_vitals: 6, benchmark_complete: 6, web_fixture_custom_event: 3, benchmark_synthetic_error: 3, $snapshot: 3 |
| sveltekit | 81 | 0 | $autocapture: 21, $opt_in: 12, $pageview: 9, $set: 6, $identify: 6, $$heatmap: 6, $web_vitals: 6, benchmark_complete: 6, web_fixture_custom_event: 3, benchmark_synthetic_error: 3, $snapshot: 3 |
| nuxt | 82 | 0 | $autocapture: 18, $opt_in: 12, $pageview: 9, $snapshot: 7, $set: 6, $identify: 6, $$heatmap: 6, $web_vitals: 6, benchmark_complete: 6, web_fixture_custom_event: 3, benchmark_synthetic_error: 3 |

## Privacy Scan

Sensitive test tokens scanned in decoded payloads: Rejourney project key, PostHog project key, fixture secret token, benchmark-entered email address, password placeholder, and benchmark private note. Fixture placeholder copy is not counted as a privacy finding. A privacy finding means one of those exact strings appeared in captured upload content after decoding known JSON/form/gzip payload formats.

| app | mode | iteration | privacy findings | page errors | long tasks |
| --- | --- | --- | --- | --- | --- |
| next | rejourney | 1 | 0 | 1 | 2 |
| next | rejourney | 2 | 0 | 1 | 2 |
| next | rejourney | 3 | 0 | 1 | 2 |
| sveltekit | rejourney | 1 | 0 | 1 | 1 |
| sveltekit | rejourney | 2 | 0 | 1 | 1 |
| sveltekit | rejourney | 3 | 0 | 1 | 1 |
| nuxt | rejourney | 1 | 0 | 1 | 1 |
| nuxt | rejourney | 2 | 0 | 1 | 1 |
| nuxt | rejourney | 3 | 0 | 1 | 1 |
| next | posthog | 1 | 0 | 2 | 2 |
| next | posthog | 2 | 0 | 2 | 2 |
| next | posthog | 3 | 0 | 2 | 2 |
| sveltekit | posthog | 1 | 0 | 2 | 1 |
| sveltekit | posthog | 2 | 0 | 2 | 1 |
| sveltekit | posthog | 3 | 0 | 2 | 1 |
| nuxt | posthog | 1 | 0 | 2 | 1 |
| nuxt | posthog | 2 | 0 | 2 | 1 |
| nuxt | posthog | 3 | 0 | 2 | 1 |

## Raw Artifacts

- `benchmark-results.json`: all run summaries, performance timings, resource timings, redacted request previews, and aggregate data
- `rejourney-live-network-captures.json`: decoded Rejourney event and rrweb upload envelopes when available
- `posthog-network-captures.json`: decoded PostHog upload request samples

## Notes For Publishing

- Generated artifacts have the Rejourney and PostHog keys redacted.
- The benchmark intentionally uses local fixture pages and synthetic data only.
- Re-run with a larger `BENCHMARK_ITERATIONS` value before publishing final numbers if you want tighter confidence intervals.
