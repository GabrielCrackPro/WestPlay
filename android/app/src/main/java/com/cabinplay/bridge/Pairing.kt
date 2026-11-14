package com.cabinplay.bridge

import android.content.Context
import android.net.Uri
import java.net.URLEncoder

/**
 * How this phone finds the PC and proves it may connect. The Cabin Play companion shows the same address and
 * token while no phone is connected (`Pairing` in crates/link); `cabinplay://pair?host=…&port=…&token=…` is
 * the whole of it in one line.
 *
 * The token lives in the app's private preferences. It is not an account and never leaves the LAN.
 */
data class Pairing(val host: String, val port: Int, val token: String) {
    val url: String
        get() = "ws://$host:$port/phone?token=${URLEncoder.encode(token, "UTF-8")}"

    companion object {
        private const val PREFS = "pairing"
        private const val HOST = "host"
        private const val PORT = "port"
        private const val TOKEN = "token"

        fun load(context: Context): Pairing? {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val host = prefs.getString(HOST, null) ?: return null
            val port = prefs.getInt(PORT, 0)
            val token = prefs.getString(TOKEN, null) ?: return null
            if (port !in 1..65535) return null
            return Pairing(host, port, token)
        }

        fun save(context: Context, pairing: Pairing) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(HOST, pairing.host)
                .putInt(PORT, pairing.port)
                .putString(TOKEN, pairing.token)
                .apply()
        }

        fun clear(context: Context) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
        }

        /**
         * Whether a code is one Cabin Play could have made. The PC writes sixteen characters of URL-safe base64 from
         * twelve random bytes and reads back a saved token of 8–128 (`token_from` in crates/link), so anything
         * outside that shape is not a code from any Cabin Play: a pasted line break, an obscured character, a code
         * from another PC's screen. It used to be sent to the socket anyway and come back as the PC closing the link
         * with a numeric code, which says nothing about the code the player is looking at (owner 2026-11-12).
         */
        fun isValidToken(token: String): Boolean =
            token.length in 8..128 && token.all { it in 'a'..'z' || it in 'A'..'Z' || it in '0'..'9' || it == '-' || it == '_' }

        /** A `cabinplay://pair?...` line, as the Cabin Play companion shows it. */
        fun parse(raw: String): Pairing? {
            val uri = runCatching { Uri.parse(raw.trim()) }.getOrNull() ?: return null
            if (uri.scheme != "cabinplay" || uri.host != "pair") return null
            val host = uri.getQueryParameter("host") ?: return null
            val port = uri.getQueryParameter("port")?.toIntOrNull() ?: return null
            val token = uri.getQueryParameter("token") ?: return null
            if (host.isBlank() || port !in 1..65535 || token.isBlank()) return null
            return Pairing(host, port, token)
        }
    }
}
