/**
 * Copyright 2026 Rejourney
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Foundation

enum RejourneyNetworkEventFilter {
    private static let lock = NSLock()
    private static let internalPathPrefixes = [
        "/api/sdk/config",
        "/api/ingest",
        "/upload/artifacts"
    ]
    private static var apiBaseURLString = normalizeBaseURLString("https://api.rejourney.co")

    static func configure(apiURLString: String) {
        lock.lock()
        apiBaseURLString = normalizeBaseURLString(apiURLString)
        lock.unlock()
    }

    static func shouldIgnore(url: URL) -> Bool {
        let absoluteString = url.absoluteString
        let configuredBase = currentAPIBaseURLString()
        if !configuredBase.isEmpty && absoluteString.contains(configuredBase) {
            return true
        }

        return shouldIgnore(path: url.path.isEmpty ? "/" : url.path)
    }

    static func shouldIgnore(details: [String: Any]) -> Bool {
        if let urlString = details["url"] as? String,
           let url = URL(string: urlString),
           shouldIgnore(url: url) {
            return true
        }

        if let path = details["urlPath"] as? String {
            return shouldIgnore(path: path)
        }

        return false
    }

    private static func shouldIgnore(path: String) -> Bool {
        internalPathPrefixes.contains { prefix in
            path == prefix || path.hasPrefix("\(prefix)/")
        }
    }

    private static func currentAPIBaseURLString() -> String {
        lock.lock()
        defer { lock.unlock() }
        return apiBaseURLString
    }

    private static func normalizeBaseURLString(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }
}
