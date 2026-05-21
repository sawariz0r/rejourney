# Browser SDK 0.2.0

Published to npm as `@rejourneyco/browser@0.2.0`.

## Highlights

- Adds UTM tracking for web replays, including first-touch campaign metadata, raw UTM mirrors, referral attribution, and landing page context.
- Adds Console Logs For Every Replay. Browser `console.log`, `console.info`, `console.warn`, `console.error`, and `console.debug` calls are captured as replay timeline events by default.
- Adds JS API Call Tracking for `fetch` and `XMLHttpRequest`, including request method, URL, timing, status, success state, and optional payload size telemetry.

## Compatibility

- No breaking API changes.
- Console capture remains configurable with `trackConsoleLogs`; set it to `false` to opt out.
- JS API call payload sizes stay disabled unless `networkCaptureSizes` is enabled.

## Upgrade

```bash
npm install @rejourneyco/browser@0.2.0
```
