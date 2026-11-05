package com.cabinplay.bridge

import android.content.Context
import android.net.Uri
import java.net.URLEncoder

/**
 * How this phone finds the PC and proves it may connect. The cabin's Phone app shows the same address and
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

        /** A `cabinplay://pair?...` line, as the cabin's Phone app shows it. */
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
