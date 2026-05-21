# @rejourneyco/browser

Web analytics and rrweb-powered session replay for Rejourney.

```ts
import { initRejourney, startRejourney } from '@rejourneyco/browser';

initRejourney('rj_xxxxxxxxxxxx', {
  apiUrl: 'https://api.rejourney.co',
  autoStart: false,
});

startRejourney();
```

The package does not access browser globals at module import time. Call `initRejourney`
and `startRejourney` from browser-only code after consent when your site requires it.

By default the browser SDK captures session attribution (referrer, UTM parameters,
and the landing URL path) and emits privacy-scrubbed `link_click` events for anchor
clicks after the SDK has started. Disable link tracking with `autoTrackLinks: false`,
or pass `linkTracking.allowedQueryParams` to keep additional campaign parameters on
captured link URLs.

Console log capture is also enabled by default so browser replays include the same
console timeline that mobile sessions provide. Console output can contain sensitive
application data, so disable it with `trackConsoleLogs: false` if your app logs PII
or secrets that cannot be sanitized before logging.
