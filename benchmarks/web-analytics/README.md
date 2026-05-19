# Rejourney vs PostHog Web Analytics Benchmark

Runs the three local web fixtures against:

- baseline with no analytics SDK active
- Rejourney browser SDK against a live Rejourney project
- PostHog web SDK/session replay injected into the page against a live PostHog project

The benchmark scripts identical interactions across Next.js, SvelteKit, and Nuxt:
form edits, custom events, identity/metadata, network calls, route changes, click
tracking, synthetic errors, resource errors, scrolling, and a controlled long task.
It also records browser-side performance metrics through Playwright and Chrome
DevTools Protocol: load timing, resource/script transfer, JS heap, main-thread
task duration as a CPU proxy, long tasks, layout/style work, and DOM node deltas.

## Run

```bash
npm install
POSTHOG_KEY="phc_***" \
POSTHOG_HOST="https://us.i.posthog.com" \
POSTHOG_DEFAULTS="2026-01-30" \
REJOURNEY_KEY="rj_***" \
REJOURNEY_API_URL="https://api.rejourney.co" \
BENCHMARK_ITERATIONS=3 \
npm run benchmark
```

Results are written to `results/<timestamp>/`:

- `benchmark-results.json`: redacted raw run data
- `benchmark-report.md`: aggregated report for review and later publishing
- `rejourney-live-network-captures.json`: decoded, redacted Rejourney ingest payloads when available
- `posthog-network-captures.json`: decoded, redacted PostHog request samples

The script redacts the Rejourney and PostHog project keys from generated artifacts.
