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

package com.rejourney.recording

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import java.net.URI

object RejourneyNetworkEventFilter {
    private val internalPathPrefixes = listOf(
        "/api/sdk/config",
        "/api/ingest",
        "/upload/artifacts"
    )

    @Volatile
    private var apiBaseUrl: String = normalizeBaseUrl("https://api.rejourney.co")

    fun configure(apiUrl: String?) {
        apiBaseUrl = normalizeBaseUrl(apiUrl ?: "https://api.rejourney.co")
    }

    fun shouldIgnore(url: HttpUrl): Boolean {
        val configuredBase = apiBaseUrl
        if (configuredBase.isNotEmpty() && url.toString().contains(configuredBase)) {
            return true
        }
        return shouldIgnorePath(url.encodedPath)
    }

    fun shouldIgnore(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val configuredBase = apiBaseUrl
        if (configuredBase.isNotEmpty() && url.contains(configuredBase)) {
            return true
        }
        return shouldIgnorePath(pathForUrl(url))
    }

    fun shouldIgnore(details: Map<String, Any>): Boolean {
        val url = details["url"] as? String
        if (shouldIgnore(url)) return true

        val path = details["urlPath"] as? String
        return path != null && shouldIgnorePath(path)
    }

    private fun shouldIgnorePath(path: String): Boolean {
        return internalPathPrefixes.any { prefix ->
            path == prefix || path.startsWith("$prefix/")
        }
    }

    private fun pathForUrl(value: String): String {
        value.toHttpUrlOrNull()?.let { return it.encodedPath }
        return try {
            URI(value).rawPath ?: value.substringBefore('?')
        } catch (_: Exception) {
            value.substringBefore('?')
        }
    }

    private fun normalizeBaseUrl(value: String): String {
        return value.trim().trimEnd('/')
    }
}
