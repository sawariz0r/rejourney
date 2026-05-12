# React Native SDK 1.2.0

Published to npm as `@rejourneyco/react-native@1.2.0`.

## Highlights

- Adds support for the new dashboard-controlled default text input masking setting. Supported React Native apps can now use `All text inputs` or `Secure fields only` without shipping a new app build.
- Enforces secure-only masking on both iOS and Android: password/secure inputs, explicit `<Mask>` views, and camera previews remain protected while ordinary text inputs may appear when the project setting allows it.
- Adds full remote config caching per public key. On startup, the SDK tries live config first, falls back to the last successful full config on timeout/network failure, and uses privacy-preserving defaults when no cache exists.
- Clears cached remote config on access denial responses so invalid project keys fail closed instead of using stale settings.
- Adds `captureNativeSheets?: boolean`, defaulting to `true`, to capture eligible app-owned native sheets and dialogs such as payment authorization modals when the OS permits capture.
- Adds `captureNativeSheets: false` for apps that want visual replay limited to the main app window.
- Captures eligible iOS non-key windows and Android app-owned dialog/popup roots best-effort while failing closed on protected OS surfaces.
- Keeps keyboard/text-input system sheets hidden when all text inputs are masked. In secure-fields-only mode, keyboard capture is best effort and cannot be reliable, especially when the OS renders keyboards as protected or remote surfaces.
- Notes that OS share sheets are also best-effort only and cannot be reliably captured when the system renders them as protected or remote surfaces.
- Adds a centered camera indicator on masked camera preview regions so replay viewers can tell the black redaction is a protected camera surface.
- Fixes Android replay touch overlays rendering in the lower-left corner by aligning Android touch, hierarchy, and device metadata coordinates with the replay frame coordinate space.
- Reduces Android replay payload size by downsampling screenshot capture by screen density before JPEG encoding, bringing React Native Android closer to iOS/Swift replay sizes.
- Passes effective recording state through native start options so visual capture is consistently disabled for observe-only or sampled-out sessions.

## Recording FPS guidance

Project Settings now includes a remote recording FPS control. We HIGHLY recommend keeping this at `1 FPS` for the best performance and battery life in end-user apps. If replay quality does not meet your needs, you can increase it up to `3 FPS`.

## Compatibility

- No breaking API changes.
- New bridge fields are additive. Older React Native SDKs and the Swift package ignore unknown remote config fields without crashing.
- Legacy remote configs that do not include `textInputMasking` default to `all`.

## Upgrade

```bash
npm install @rejourneyco/react-native@1.2.0
```
