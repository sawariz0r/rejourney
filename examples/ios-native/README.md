# Rejourney Native iOS Example

Small SwiftUI app that consumes the root Swift package by local path. Open `RejourneyNativeExample.xcodeproj` or build it from the repo root:

```sh
xcodebuild \
  -project examples/ios-native/RejourneyNativeExample.xcodeproj \
  -scheme RejourneyNativeExample \
  -destination 'generic/platform=iOS Simulator' \
  build CODE_SIGNING_ALLOWED=NO
```

Replace `pk_test_replace_me` in the app source before doing a dashboard smoke test.
