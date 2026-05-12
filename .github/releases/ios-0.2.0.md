# iOS SDK 0.2.0

## Highlights

- Adds support for remote Project Settings in the native Swift package. Supported apps now pick up dashboard-controlled sample rate, max observability duration, recording FPS, and default text input masking when `Rejourney.start()` runs.
- Adds remote text input privacy levels. `All text inputs` remains the privacy-preserving default, while `Secure fields only` allows ordinary text inputs to appear in debugging replays while still masking password/secure fields.
- Adds `captureNativeSheets` to `RejourneyOptions`, defaulting to `true`, so app-owned native sheets and dialogs such as payment authorization modals can appear in replays when iOS permits capture.
- Adds a local opt-out for native sheet capture with `RejourneyOptions(captureNativeSheets: false)`, keeping visual replay limited to the main app window.
- Keeps keyboard/text-input system sheets excluded when all text inputs are masked. In secure-fields-only mode, keyboard capture is best effort and cannot be reliable on iOS because the keyboard may be rendered as a protected or remote system surface.
- Notes that OS share sheets are also best-effort only and cannot be reliably captured when the system renders them as protected or remote surfaces.
- Keeps secure/password fields, explicit masked views, and camera views protected even when ordinary text inputs are allowed.
- Tightens sampling behavior so sampled-out sessions return before replay capture, network interception, uploads, or other recording work starts.

## Recording FPS guidance

Project Settings now includes a remote recording FPS control. We HIGHLY recommend keeping this at `1 FPS` for the best performance and battery life in end-user apps. If replay quality does not meet your needs, you can increase it up to `3 FPS`.

## Compatibility

- No breaking API changes.
- Older SDK versions ignore the new dashboard text input masking setting and keep their existing masking behavior.

## Upgrade

Use the SwiftPM package tag `v0.2.0`:

```swift
.package(url: "https://github.com/rejourneyco/rejourney", from: "0.2.0")
```
