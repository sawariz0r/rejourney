# Contributing to Rejourney

We welcome contributions! Please see the guides below to get started.

## Project Structure

Rejourney is a monorepo with backend services, the dashboard, SDK packages,
examples, and Kubernetes manifests in one repo.

Main work areas:

- `backend/`: API, ingest, workers, migrations, and billing logic
- `dashboard/web-ui/`: React Router dashboard and public site
- `packages/react-native/`: `@rejourneyco/react-native`
- `packages/browser/`: `@rejourneyco/browser`, the web SDK and framework adapters
- `packages/ios/`: the native Swift SDK source exported by the root
  `Package.swift` as the SwiftPM product `Rejourney`
- `examples/`: standalone apps used to test the local SDK packages end to end

## Prerequisites

Install these before running the local stack:

- **Node.js 24+** and npm
- **Docker Desktop**
- **kubectl**
- **k3d**
- **iOS / Swift work:** Xcode and CocoaPods
- **Android work:** Android Studio and JDK 17

Docker Desktop must be running before you start the local Kubernetes flow.

## Initial Setup

Start from the repository root.

```bash
cp local-k8s/env.example .env.k8s.local
```

Fill the required local secrets in `.env.k8s.local`. For a local development
environment, random 32-byte hex values are fine:

```bash
for key in JWT_SECRET JWT_SIGNING_KEY INGEST_HMAC_SECRET STORAGE_ENCRYPTION_KEY SUPERWALL_API_KEY_ENCRYPTION_KEY REVENUECAT_API_KEY_ENCRYPTION_KEY; do
  perl -0pi -e "s|^$key=.*$|$key=$(openssl rand -hex 32)|m" .env.k8s.local
done
```

Most optional integrations can stay blank locally, including Stripe, OAuth,
Mapbox, and SMTP.

Then run the local CI-parity bootstrap:

```bash
npm run ci:local
```

This is the recommended first-run command. It installs dependencies, runs the
same validation path we expect in CI, builds local Docker images, imports them
into `k3d`, applies the local Kubernetes manifests, runs migrations/setup, and
starts the host-side development services.

When it completes, the main local URLs are:

- Dashboard: `http://127.0.0.1:8080`
- API: `http://127.0.0.1:3000`
- Upload relay: `http://127.0.0.1:3001`
- MinIO API: `http://127.0.0.1:9000`
- MinIO Console: `http://127.0.0.1:9001`

The dashboard on `:8080` is the live React Router dev server. UI edits should
show up there without rebuilding or rerunning deploy commands.

## Daily Local Development

After the first successful `npm run ci:local`, use these commands for the common
loops:

```bash
# Restart the host-side API, upload relay, workers, and hot-reload dashboard.
npm run dev

# After restarting Docker Desktop, wake the existing local cluster/data and
# restart the host-side services without CI checks or Docker image rebuilds.
npm run dev:resume

# Stop host-side services. Local infra/data are preserved.
npm run dev:down

# Watch host-process logs.
npm run dev:logs
```

Use the local CI runner again when you want to rebuild/revalidate the full local
stack:

```bash
# Full local CI-parity run: installs deps, runs checks/tests, builds images,
# imports into k3d, deploys, migrates, and restarts host services.
npm run ci:local

# Faster repeat run: same flow, but skips npm reinstall steps.
npm run ci:local:fast

# Rebuild/import/deploy local images without rerunning validation checks.
npm run ci:local:deploy
```

## What `npm run ci:local` Does

The local CI-parity flow intentionally exercises the same pieces that tend to
break in production:

- Updates `.env.k8s.local` and example app local API settings with your current LAN IP
- Runs schema and migration guards
- Runs backend lint/tests and billing-specific checks
- Runs browser SDK checks
- Runs dashboard typecheck/build
- Builds API, dashboard web, and migration Docker images
- Imports the images into the local `k3d` cluster
- Applies local app manifests and runs database setup
- Restarts host-side API, upload relay, workers, and dashboard dev server

The image import step can be quiet for a while. If the command is printing k3d
image import logs and Docker is active, it is usually still working.

## Local Environment File

The template lives at `local-k8s/env.example`. Copy it to `.env.k8s.local` and
edit only what you need:

```env
NODE_ENV=development
POSTGRES_USER=rejourney
POSTGRES_PASSWORD=rejourney
POSTGRES_DB=rejourney

S3_ENDPOINT=http://127.0.0.1:9000
S3_PUBLIC_ENDPOINT=http://127.0.0.1:9000

JWT_SECRET=<random 32-byte hex>
JWT_SIGNING_KEY=<random 32-byte hex>
INGEST_HMAC_SECRET=<random 32-byte hex>
STORAGE_ENCRYPTION_KEY=<random 32-byte hex>
SUPERWALL_API_KEY_ENCRYPTION_KEY=<random 32-byte hex>
REVENUECAT_API_KEY_ENCRYPTION_KEY=<random 32-byte hex>

PUBLIC_DASHBOARD_URL=http://127.0.0.1:8080
PUBLIC_API_URL=http://127.0.0.1:3000
PUBLIC_INGEST_URL=http://127.0.0.1:3001
DASHBOARD_ORIGIN=http://127.0.0.1:8080
```

`scripts/local-k8s/update-ips.sh` rewrites the public URLs to your LAN IP when
the local stack starts. That is expected and helps physical devices reach your
computer. It also updates the React Native example env files and the Swift
example fallback API URL. The web examples can derive `http://<current browser
host>:3000` automatically when their explicit API URL env var is blank.

## Physical Device Testing

If you are testing on a **physical device** (iOS or Android) connected to the same WiFi, the SDK and Dashboard need to know your computer's local IP address to communicate.

### Finding your IP Address (Mac)

Run the following command in your terminal:

```bash
ipconfig getifaddr en0
```

Or find it in **System Settings > WiFi > [Your Network] Details**.

### Update `.env.k8s.local`

The following variables **MUST** use your local IP address (e.g., `http://192.168.1.5:3000`) instead of `localhost`:

| Variable                 | Key Usage                                      |
| ------------------------ | ---------------------------------------------- |
| `S3_PUBLIC_ENDPOINT`     | Public access to MinIO for video replays       |
| `PUBLIC_DASHBOARD_URL`   | Base URL for the dashboard UI                  |
| `PUBLIC_API_URL`         | Base URL for the API                           |
| `PUBLIC_INGEST_URL`      | Base URL for SDK event ingestion               |
| `DASHBOARD_ORIGIN`       | CORS origin for the dashboard                  |
| `OAUTH_REDIRECT_BASE`    | Base URL for OAuth callbacks                   |

> [!IMPORTANT]
> Failure to set these correctly will result in "Connection Refused" errors on physical devices or broken image/video links in the dashboard.

`npm run ci:local` and `npm run dev` update these LAN-facing values
automatically through `scripts/local-k8s/update-ips.sh`, and they also update
the local API settings used by the Expo and Swift examples.

### Example Configuration (`.env.k8s.local`)

Assuming your computer's IP address is `192.168.1.100`:

```env
# Object storage (host access to local-k8s MinIO)
S3_ENDPOINT=http://127.0.0.1:9000
S3_PUBLIC_ENDPOINT=http://192.168.1.100:9000

# Public URLs
PUBLIC_DASHBOARD_URL=http://192.168.1.100:8080
PUBLIC_API_URL=http://192.168.1.100:3000
PUBLIC_INGEST_URL=http://192.168.1.100:3001
DASHBOARD_ORIGIN=http://192.168.1.100:8080
OAUTH_REDIRECT_BASE=http://192.168.1.100:3000
```

## Local Kubernetes Files

The local Kubernetes manifests intentionally mirror the production `k8s/` layout:

- `local-k8s/namespace.yaml`
- `local-k8s/postgres.yaml`
- `local-k8s/redis.yaml`
- `local-k8s/minio.yaml`
- `local-k8s/api.yaml`
- `local-k8s/web.yaml`
- `local-k8s/workers.yaml`
- `local-k8s/ingress.yaml`

## Troubleshooting Local Setup

- If `:8080` is occupied, free it and rerun `npm run dev`. The hot-reload
  dashboard is expected to own `http://127.0.0.1:8080`.
- If `npm run ci:local` reports that Docker, `kubectl`, or `k3d` is missing,
  install the missing prerequisite and rerun the command.
- If `kubectl` points at the wrong cluster, switch back to the local context:
  `kubectl config use-context k3d-rejourney-dev`.
- If an old local database was created by a previous schema flow, reset the local
  namespace once:

```bash
./scripts/local-k8s/deploy.sh down
npm run ci:local
```

## SDK Package Development

The repo currently has three SDK package lanes:

| Package | Source | Build / check | Primary examples |
| ------- | ------ | ------------- | ---------------- |
| React Native | `packages/react-native` | `npm run build:react-native`; `npm --prefix packages/react-native test` | `examples/react-native-boilerplate`, `examples/react-native-bare`, `examples/brew-coffee-labs` |
| Web | `packages/browser` | `npm run build:browser`; `npm --prefix packages/browser test` | `examples/web-next`, `examples/web-sveltekit`, `examples/web-nuxt` |
| Swift iOS | `packages/ios` through root `Package.swift` | `xcodebuild -scheme Rejourney -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO` | `examples/swift-clean-arch`, `examples/ios-native` |

Use `npm run build:sdk` when you want to rebuild both JavaScript SDK packages.
That runs the React Native package build and the browser package build.

The Swift package is not published through npm. It is a SwiftPM package exposed
by the root `Package.swift`, and releases are driven by `packages/ios/VERSION`
plus `packages/ios/Sources/Rejourney/RejourneySDKInfo.swift`.

## Running Example Apps

Run `npm run ci:local` once first so the API, dashboard, ingest path, MinIO, and
local secrets are ready. If an example app has no `node_modules`, run
`npm install` inside that example directory once. The examples are intentionally
standalone rather than npm workspaces so they can pin different framework and
React Native versions without fighting the root dependency tree.

### React Native Examples

The React Native examples point at the local React Native SDK with
`file:../../packages/react-native`. Their Metro configs watch
`packages/react-native`, so TypeScript-side SDK edits are picked up during
development. Native iOS or Android SDK changes still require rebuilding the app.

```bash
# Expo boilerplate Metro/dev server
npm run example:boilerplate

# Rebuild/run the Expo boilerplate app
npm run example:boilerplate:ios
npm run example:boilerplate:android

# Brew Coffee Labs
npm run example:brew
npm run example:brew:ios
npm run example:brew:android

# Bare React Native fixture
npm run example:bare
npm run example:bare:ios
npm run example:bare:android
```

For the boilerplate app directly:

```bash
cd examples/react-native-boilerplate
npm run dev
npm run ios
npm run android
```

### Web Examples

The web examples point at the local browser SDK with
`"@rejourneyco/browser": "file:../../packages/browser"`. Each example rebuilds
`packages/browser` before `dev`, `build`, or `preview`, so local browser SDK
changes are reflected when you restart the example command.

```bash
# Next.js App Router, http://127.0.0.1:3100
npm run example:web-next

# SvelteKit, http://127.0.0.1:3101
npm run example:web-sveltekit

# Nuxt, http://127.0.0.1:3102
npm run example:web-nuxt
```

Configure each web example from its `.env.example`:

- `examples/web-next/.env.local`: `NEXT_PUBLIC_REJOURNEY_KEY`
- `examples/web-sveltekit/.env.local`: `PUBLIC_REJOURNEY_KEY`
- `examples/web-nuxt/.env.local` or `.env`: `NUXT_PUBLIC_REJOURNEY_KEY`

Leave the example's API URL env var blank for local testing unless you need a
custom backend. With a blank API URL, the examples derive the API from the
current browser host, so opening `http://192.168.1.25:3100` points the SDK at
`http://192.168.1.25:3000`. For web replay ingestion, add the example host and
port to the project's allowed web domains.

### Swift iOS Examples

The native Swift SDK lives in `packages/ios`, but the SwiftPM package entry
point is the root `Package.swift`.

Use the clean architecture app for day-to-day Swift SDK testing:

```bash
# Show whether the example is using the released package or the local package.
npm run example:swift:sdk:status

# Switch the example to the local in-repo Swift package at ../..
npm run example:swift:sdk:new

# Open the app in Xcode.
npm run example:swift
```

The switch script rewrites both `examples/swift-clean-arch/Package.swift` and
`examples/swift-clean-arch/CountriesSwiftUI.xcodeproj`. Use
`npm run example:swift:sdk:old` to switch back to the latest released SwiftPM
package before checking release behavior.

## How Example Linking Works

The root npm workspaces cover JavaScript packages with `package.json` files:
`packages/*`, `backend`, and `dashboard/web-ui`. Example apps stay outside the
workspace on purpose.

- React Native examples use local `file:` dependencies for
  `packages/react-native`; Metro watches the local package source.
- Web examples use local `file:` dependencies for `packages/browser`; the
  example scripts rebuild the browser package before starting.
- Swift examples use SwiftPM. `examples/swift-clean-arch` can switch between
  the released remote package and the local root package with the SDK switch
  script.

React Native codegen still runs during native builds when the example includes
the SDK package and the SDK's `codegenConfig` is present.

## Repository Layout

```text
rejourney/
|-- backend/                    # API, ingest, workers, migrations
|-- dashboard/web-ui/           # Dashboard and public site
|-- packages/
|   |-- browser/                # @rejourneyco/browser web SDK
|   |-- ios/                    # Native Swift SDK source
|   `-- react-native/           # @rejourneyco/react-native SDK
|-- examples/
|   |-- web-next/               # Next.js web SDK fixture
|   |-- web-sveltekit/          # SvelteKit web SDK fixture
|   |-- web-nuxt/               # Nuxt web SDK fixture
|   |-- swift-clean-arch/       # SwiftUI Swift SDK fixture
|   |-- ios-native/             # Smaller native iOS fixture
|   |-- react-native-boilerplate/
|   |-- react-native-bare/
|   `-- brew-coffee-labs/
|-- local-k8s/                  # Local k3d manifests
|-- k8s/                        # Production Kubernetes manifests
|-- Package.swift               # SwiftPM entry for packages/ios
`-- package.json                # Root scripts and npm workspaces
```

## CI/CD & Deployment

Rejourney uses GitHub Actions to automate testing, building, and deployment across the entire monorepo.

For a detailed breakdown of our test suites, native integration testing, and automated deployment logic, please see the [CI/CD & Testing Documentation](/docs/architecture/ci-cd).

---

Explore the [Architecture Comparison](/docs/architecture/distributed-vs-single-node) for details on Cloud (K8s) vs. Self-Hosted (Docker).

## Best Practices

1. Run `npm run ci:local` before testing example ingestion against the local API.
2. Use the matching example for the package you changed: React Native examples
   for `packages/react-native`, web examples for `packages/browser`, and Swift
   examples for `packages/ios`.
3. Rebuild the relevant package before testing if you are not using an example
   script that does it for you.
4. Clear Metro cache when React Native resolution gets stale. The boilerplate
   `npm run dev` script already starts Expo with cache clearing; for Bare or
   Brew, use `npm start -- --reset-cache` from the example directory.
5. Rebuild native apps after native iOS, Android, or Swift SDK changes.
6. For web examples, test from the same host/origin you added to the project's
   allowed web domains.
