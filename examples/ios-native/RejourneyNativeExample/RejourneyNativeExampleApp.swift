import Rejourney
import SwiftUI

@main
struct RejourneyNativeExampleApp: App {
    @MainActor
    init() {
        Rejourney.configure(
            publicKey: "rj_94f602bb3ff12873008b16fb2f3389cc",
            options: RejourneyOptions(
                observeOnly: true,
                captureFPS: 1,
                captureQuality: .medium,
                autoTrackNetwork: true,
                debug: true
            )
        )
    }

    var body: some Scene {
        WindowGroup {
            RejourneyNativeExampleView()
        }
    }
}

struct RejourneyNativeExampleView: View {
    @State private var sessionId: String?
    @State private var status = "Idle"
    @State private var username = ""
    @State private var password = ""
    @State private var notes = ""

    var body: some View {
        NavigationView {
            Form {
                Section("Session") {
                    Text(sessionId ?? "No active session")
                    Text(status)
                }

                // These fields verify that all text inputs are masked in session
                // replay by default (no text content captured, black overlay shown).
                Section("Masked Inputs (privacy test)") {
                    TextField("Username", text: $username)
                        .textContentType(.username)
                        .autocapitalization(.none)
                    SecureField("Password", text: $password)
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }

                Section("Actions") {
                    Button("Start") {
                        Task { await startSession() }
                    }
                    Button("Track Screen") {
                        Rejourney.trackScreen("Native Example")
                        status = "Tracked screen"
                    }
                    Button("Log Event") {
                        Rejourney.logEvent(
                            "native_sample_event",
                            properties: [
                                "source": "ios-native-example",
                                "success": true
                            ]
                        )
                        status = "Logged event"
                    }
                    Button("Stop") {
                        Task { await stopSession() }
                    }
                }
            }
            .navigationTitle("Rejourney")
        }
    }

    @MainActor
    private func startSession() async {
        let result = await Rejourney.start()
        sessionId = result.sessionId
        status = result.success ? "Started" : (result.error ?? "Start failed")
    }

    @MainActor
    private func stopSession() async {
        let result = await Rejourney.stop()
        sessionId = nil
        status = result.success ? "Stopped" : "Stop failed"
    }
}
