# Rejourney vs PostHog Web Analytics Benchmark

Generated: 2026-05-19T03:46:20.704Z

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
| sveltekit | rejourney | 3 | 22.3 | 11 | 6.12 KiB | 2.48 MiB | 28 | 20 | 0 |
| nuxt | rejourney | 3 | 228.9 | 14 | 8.4 KiB | 5.32 MiB | 39 | 42 | 0 |
| sveltekit | posthog | 3 | 34.8 | 14 | 24.93 KiB | 2.07 MiB | 81 | 0 | 0 |
| nuxt | posthog | 3 | 241.4 | 15 | 25.39 KiB | 4.91 MiB | 82 | 0 | 0 |

## Browser CPU And Memory Intensity

CPU intensity uses Chrome DevTools Protocol `Performance.getMetrics()`: `TaskDuration` is the main-thread busy-time proxy across the full scripted visit, including the fixed flush wait. Memory is JS heap used at the end of the run plus the JS heap delta from start to finish.

| app | mode | n | busy % | busy ms/s | task ms | script ms | layout+style ms | long tasks | long-task ms | JS heap delta | JS heap end | DOM node delta |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sveltekit | rejourney | 3 | 3.39 | 33.92 | 299.28 | 22.22 | 9.67 | 1 | 86 | 6.1 MiB | 6.65 MiB | 316 |
| nuxt | rejourney | 3 | 3.36 | 33.62 | 304.26 | 21.9 | 9.82 | 1 | 86 | 10.84 MiB | 11.39 MiB | 255 |
| sveltekit | posthog | 3 | 2.95 | 29.54 | 292.19 | 39.98 | 9.33 | 1 | 88 | 7.08 MiB | 9.13 MiB | 354 |
| nuxt | posthog | 3 | 3.02 | 30.15 | 303.84 | 39.18 | 9.89 | 1 | 87 | 11.22 MiB | 13.27 MiB | 261 |

## Per-Run Browser Metrics

| app | mode | iteration | load ms | task ms | busy % | script ms | layout+style ms | long tasks | long-task ms | JS heap delta | JS heap end | SDK upload body |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sveltekit | rejourney | 1 | 52.2 | 370.59 | 4.13 | 31.92 | 27.52 | 1 | 87 | 6.1 MiB | 6.65 MiB | 6.11 KiB |
| sveltekit | rejourney | 2 | 17.9 | 299.28 | 3.39 | 22.22 | 9.06 | 1 | 86 | 5.91 MiB | 6.47 MiB | 8.79 KiB |
| sveltekit | rejourney | 3 | 22.3 | 271.72 | 3.08 | 16.96 | 9.67 | 1 | 85 | 6.1 MiB | 6.66 MiB | 6.12 KiB |
| nuxt | rejourney | 1 | 270.3 | 309.97 | 3.41 | 21.9 | 9.85 | 1 | 86 | 10.84 MiB | 11.39 MiB | 8.39 KiB |
| nuxt | rejourney | 2 | 206.1 | 301.55 | 3.34 | 22.17 | 9.57 | 1 | 86 | 10.84 MiB | 11.39 MiB | 8.4 KiB |
| nuxt | rejourney | 3 | 228.9 | 304.26 | 3.36 | 21.86 | 10.07 | 1 | 86 | 12.12 MiB | 12.67 MiB | 8.4 KiB |
| sveltekit | posthog | 1 | 45.8 | 276.4 | 2.81 | 38.4 | 9.34 | 1 | 86 | 7.08 MiB | 9.13 MiB | 26.4 KiB |
| sveltekit | posthog | 2 | 33.9 | 306.99 | 3.11 | 41.27 | 9.28 | 1 | 88 | 6.92 MiB | 8.97 MiB | 24.93 KiB |
| sveltekit | posthog | 3 | 34.8 | 292.19 | 2.95 | 39.98 | 9.13 | 1 | 88 | 7.12 MiB | 9.18 MiB | 24.92 KiB |
| nuxt | posthog | 1 | 241.4 | 316.52 | 3.14 | 40.06 | 11.38 | 1 | 87 | 13.49 MiB | 15.54 MiB | 26.6 KiB |
| nuxt | posthog | 2 | 218.7 | 303.84 | 3.02 | 38.7 | 9.89 | 1 | 87 | 10.45 MiB | 12.51 MiB | 24.42 KiB |
| nuxt | posthog | 3 | 251.1 | 302.24 | 2.99 | 39.18 | 9.15 | 1 | 87 | 11.22 MiB | 13.27 MiB | 25.39 KiB |

## Package Footprint

| package | version | dist bytes | dist gzip bytes | files |
| --- | --- | --- | --- | --- |
| @rejourneyco/browser dist | 0.1.0 | 299.56 KiB | 85.06 KiB | 140 |
| posthog-js package dist | 1.374.2 | 29.75 MiB | 8.05 MiB | 239 |

## Rejourney Capture Coverage

| app | analytics events | rrweb events | analytics event types |
| --- | --- | --- | --- |
| sveltekit | 28 | 20 | navigation: 7, $user_property: 4, session_start: 3, app_startup: 3, user_identity_changed: 3, custom: 3, tap: 1, error: 1, scroll: 1, long_task: 1, resource_error: 1 |
| nuxt | 39 | 42 | navigation: 9, session_start: 3, app_startup: 3, user_identity_changed: 3, custom: 3, $user_property: 3, tap: 3, error: 3, scroll: 3, long_task: 3, resource_error: 3 |

## PostHog Capture Coverage

| app | parsed/internal events | internal rrweb events | event names |
| --- | --- | --- | --- |
| sveltekit | 81 | 0 | $autocapture: 21, $opt_in: 12, $pageview: 9, $set: 6, $identify: 6, $$heatmap: 6, $web_vitals: 6, benchmark_complete: 6, web_fixture_custom_event: 3, benchmark_synthetic_error: 3, $snapshot: 3 |
| nuxt | 82 | 0 | $autocapture: 18, $opt_in: 12, $pageview: 9, $snapshot: 7, $set: 6, $identify: 6, $$heatmap: 6, $web_vitals: 6, benchmark_complete: 6, web_fixture_custom_event: 3, benchmark_synthetic_error: 3 |

## Privacy Scan

Sensitive test tokens scanned in decoded payloads: PostHog project key, fixture secret token, benchmark-entered email address, password placeholder, and benchmark private note. Fixture placeholder copy is not counted as a privacy finding. A privacy finding means one of those exact strings appeared in captured upload content after decoding known JSON/form/gzip payload formats.

| app | mode | iteration | privacy findings | page errors | long tasks |
| --- | --- | --- | --- | --- | --- |
| sveltekit | rejourney | 1 | 0 | 1 | 1 |
| sveltekit | rejourney | 2 | 0 | 1 | 1 |
| sveltekit | rejourney | 3 | 0 | 1 | 1 |
| nuxt | rejourney | 1 | 0 | 1 | 1 |
| nuxt | rejourney | 2 | 0 | 1 | 1 |
| nuxt | rejourney | 3 | 0 | 1 | 1 |
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

- Generated artifacts have the PostHog key redacted.
- The benchmark intentionally uses local fixture pages and synthetic data only.
- Re-run with a larger `BENCHMARK_ITERATIONS` value before publishing final numbers if you want tighter confidence intervals.
