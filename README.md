<div align="center">
  <h1>
    <img src="https://rejourney.co/rejourneyIcon-removebg-preview.png" alt="Rejourney Logo" width="40" style="vertical-align: middle;" />
    Rejourney
  </h1>

  <img src="https://rejourney.co/images/session-replay-preview.png" alt="Rejourney Session Replay" width="100%" />

  <p>
    <strong>Lightweight session replay and observability for Mobile Apps</strong>
    <br />
    Mobile-first focus with pixel-perfect video capture and real-time incident detection.
  </p>
  
  <p>
    <a href="https://rejourney.co"><strong>Explore the Website »</strong></a>
  </p>
  
<p>
  <a href="https://reactnative.dev">
    <img src="https://img.shields.io/badge/React%20Native-61DAFB?logo=react&logoColor=black" alt="React Native" />
  </a>
  <a href="https://expo.dev">
    <img src="https://img.shields.io/badge/Expo-000020?logo=expo&logoColor=white" alt="Expo" />
  </a>
  <a href="https://www.swift.org">
    <img src="https://img.shields.io/badge/Swift-F05138?logo=swift&logoColor=white" alt="Swift" />
  </a>
</p>
</div>

## Features

### Pixel Perfect Capture
True FPS video playback capturing every rendered pixel. Unlike competitors, we capture everything—including Mapbox (Metal), custom shaders, and GPU-accelerated views.

### Live Incident Stream
![Issues Feed](https://rejourney.co/images/issues-feed.png)

See crashes, errors, and rage taps as they happen in real-time with instant crash reporting.

### Error/ANR/Crash Detection
![ANR Issues](https://rejourney.co/images/anr-issues.png)

Automatic detection of Application Not Responding events with full thread dumps and main thread analysis.

### Journey Mapping
![User Journeys](https://rejourney.co/images/user-journeys.png)

Visualize how users navigate your app. Identify high-friction drop-off points and optimize conversion funnels.

### Interaction Heat Maps
![Heatmaps](https://rejourney.co/images/heatmaps.png)

**Visualize user engagement with precision.** See where they tap, swipe, and scroll to optimize UI placement.

### Global Stability
![Geo Intelligence](https://rejourney.co/images/geo-intelligence.png)

Monitor performance and stability across different regions. Spot infrastructure issues before they affect your global audience.

### Growth Engines
![Growth Engines](https://rejourney.co/images/growth-engines.png)
Track user retention and loyalty segments. Understand how releases impact your power users versus bounce rates.

### Team Alerts
![Team Alerts](https://rejourney.co/images/team-alerts.png)
Smart email notifications for crashes, ANRs, and error spikes. Role-based access for engineering teams.

## Documentation

Full integration guides and API reference: https://rejourney.co/docs/reactnative/overview

### Self-Hosting

- Single-node Docker Compose self-hosting: https://rejourney.co/docs/selfhosted
- Enterprise-grade K3s hosting (architecture docs): https://rejourney.co/docs/architecture/distributed-vs-single-node

### Operations (K8s / Tailscale / admin hostnames)

- [Cloud architecture + Tailscale diagrams](dev_docs/allthingscloud.md) — deployment overview, public vs tailnet admin path.
- [Network exposure and Tailscale](dev_docs/network-exposure-and-tailscale.md) — which `rejourney.co` hosts stay public; kube API on tailnet.
- [Admin tools without public URLs](dev_docs/admin-tools-private-access.md) — pgweb, Redis Commander, Netdata, Traefik, Uptime Kuma via `kubectl port-forward`.

## Contributing

Want to contribute to Rejourney? See our Contributing Guide: https://rejourney.co/docs/community/contributing

## Local Development

Local development mirrors production through [`local-k8s/`](local-k8s). For a fresh checkout, copy `local-k8s/env.example` to `.env.k8s.local`, fill the required local secrets, then run `npm run ci:local` to install, validate, build, deploy, migrate, and start the local stack. After that first bootstrap, use `npm run dev` for the hot-reload daily workflow.

`docker-compose.selfhosted.yml` is the official single-node self-hosted deployment path.

## Benchmarks

Rejourney is designed to be **invisible to the eye**. We utilize an **Async Capture Pipeline** combined with **Run Loop Gating**, ensuring the SDK automatically pauses during interactions (touches/scrolls) to maintain 100% UI responsiveness.

**Device:** iPhone 15 Pro (iOS 26)  
**Environment:** Expo SDK 54, React Native New Architecture (Concurrent Mode)  
**Test App:** [Merch App](https://merchcampus.com) (Production build with Mapbox Metal + Firebase)  
**Test Workload:** 46 complex feed items, Mapbox GL View, 124 API calls, 31 subcomponents, active gesture tracking, and real-time privacy redaction.

| Metric | Avg (ms) | Max (ms) | Min (ms) | Thread |
| :--- | :---: | :---: | :---: | :---: |
| **Main: UIKit + Metal Capture** | **12.4** | 28.2 | 8.1 | Main |
| **BG: Async Image Processing** | 42.5 | 88.0 | 32.4 | Background |
| **BG: Tar+Gzip Compression** | 14.2 | 32.5 | 9.6 | Background |
| **BG: Upload Handshake** | 0.8 | 2.4 | 0.3 | Background |
| **Total Main Thread Impact** | **12.4** | 28.2 | 8.1 | Main |

*Note: Total Main Thread Impact is the only work that blocks your app's rendering.*

## Engineering

Engineering decisions and architecture: https://rejourney.co/engineering

## License

Client-side components (SDKs, CLIs) are licensed under Apache 2.0. Server-side components (backend, dashboard) are licensed under SSPL 1.0. See [LICENSE-APACHE](LICENSE-APACHE) and [LICENSE-SSPL](LICENSE-SSPL) for details.

---

## Translations

- [Arabic | العربية](i18n/README_AR.md)
- [Chinese (Simplified) | 简体中文](i18n/README_ZH_CN.md)
- [French | Français](i18n/README_FR.md)
- [German | Deutsch](i18n/README_DE.md)
- [Hindi | हिन्दी](i18n/README_HI.md)
- [Indonesian | Bahasa Indonesia](i18n/README_ID.md)
- [Japanese | 日本語](i18n/README_JA.md)
- [Korean | 한국어](i18n/README_KO.md)
- [Portuguese (Brazil) | Português do Brasil](i18n/README_PT_BR.md)
- [Spanish | Español](i18n/README_ES.md)
- [Turkish | Türkçe](i18n/README_TR.md)
