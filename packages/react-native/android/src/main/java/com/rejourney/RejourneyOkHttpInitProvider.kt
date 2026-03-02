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

package com.rejourney

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider
import com.rejourney.recording.RejourneyNetworkInterceptor

/**
 * ContentProvider that runs before Application.onCreate() (and thus before the React Native
 * bridge and NetworkingModule are created). It registers our OkHttpClientFactory so the
 * first (and all) OkHttpClient instances created by OkHttpClientProvider already include
 * RejourneyNetworkInterceptor, ensuring native API calls are captured on Android like on iOS.
 */
class RejourneyOkHttpInitProvider : ContentProvider() {

    override fun onCreate(): Boolean {
        try {
            OkHttpClientProvider.setOkHttpClientFactory(OkHttpClientFactory {
                OkHttpClientProvider.createClientBuilder()
                    .addInterceptor(RejourneyNetworkInterceptor())
                    .build()
            })
        } catch (_: Exception) {
            // Ignore; RejourneyModuleImpl will still register factory + CustomClientBuilder later
        }
        return true
    }

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?
    ): Cursor? = null

    override fun getType(uri: Uri): String? = null

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?
    ): Int = 0
}
