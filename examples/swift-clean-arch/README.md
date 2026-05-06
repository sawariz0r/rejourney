# swift-clean-arch — Rejourney Swift SDK Example

A full-featured SwiftUI iOS app ([nalexn/clean-architecture-swiftui](https://github.com/nalexn/clean-architecture-swiftui), MIT) instrumented with the Rejourney iOS SDK.

## What this demonstrates

- SDK initialisation at app launch via `Rejourney.configure()`
- Session recording across multiple screens: country list, search, country detail, flag modal, locale settings
- Network request capture (`autoTrackNetwork: true`) via `URLSession`
- SwiftData persistence integration
- Clean Architecture (Interactors → Repositories → AppState) with Rejourney running transparently alongside it

## App screens

| Screen | Description |
|--------|-------------|
| Countries list | Searchable paginated list of all countries |
| Country detail | Flag, region, population, currencies, languages |
| Flag modal | Full-screen flag viewer |
| Locale / environment overrides | Change language and display settings at runtime |

## Open in Xcode

```bash
open examples/swift-clean-arch/CountriesSwiftUI.xcodeproj
```

Or from the repo root:

```bash
npm run example:swift
```

Xcode will automatically resolve the local Rejourney package from the repo root (`../..` relative to this folder) along with the two remote dependencies (EnvironmentOverrides, ViewInspector).

## SDK configuration

`CountriesSwiftUI/Core/AppDelegate.swift` starts Rejourney at launch through `CountriesSwiftUI/Core/RejourneyExample.swift`:

```swift
Rejourney.configure(
    publicKey: "rj_94f602bb3ff12873008b16fb2f3389cc",
    options: RejourneyOptions(
        apiURL: resolvedAPIURL,
        captureFPS: 1,
        captureQuality: .medium,
        autoTrackNetwork: true,
        debug: true
    )
)
```

The example resolves the API URL the same way the other example apps do: set `API_URL` (or `PUBLIC_API_URL` / `REJOURNEY_API_URL`) for a custom backend, otherwise it uses the local development API at `http://127.0.0.1:3000`.

The example also calls `Rejourney.start()`, attaches demo metadata, tracks the countries list/detail/flag modal screens, records navigation and search events, and leaves `autoTrackNetwork` enabled so the app's `URLSession` requests appear in replay telemetry.

## How the local package is linked

`CountriesSwiftUI.xcodeproj` references the monorepo root `Package.swift` via an `XCLocalSwiftPackageReference` pointing to `../..` — the same mechanism used by `examples/ios-native`. No symlinks or CocoaPods needed; SwiftPM resolves it automatically when you open the `.xcodeproj`.

## Switching SDK source

Use the switch script to test the released SwiftPM package and then jump back to the local in-repo SDK:

From the repo root:

```bash
npm run example:swift:sdk:old
npm run example:swift:sdk:new
npm run example:swift:sdk:status
```

Or from `examples/swift-clean-arch`:

```bash
bash ./scripts/switch-rejourney-sdk.sh --old
bash ./scripts/switch-rejourney-sdk.sh --new
bash ./scripts/switch-rejourney-sdk.sh --status
```

`--old` switches both `Package.swift` and `CountriesSwiftUI.xcodeproj` to the latest released `https://github.com/rejourneyco/rejourney` tag. `--new` switches both back to the local package at `../..`. Add `--no-resolve` if you only want to rewrite the dependency files and skip SwiftPM/Xcode dependency resolution.

## License

The base app is MIT © Alexey Naumov. Rejourney SDK additions are covered by the Rejourney license.
