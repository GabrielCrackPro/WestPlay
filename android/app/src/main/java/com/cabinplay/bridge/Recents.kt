package com.cabinplay.bridge

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CallLog
import org.json.JSONArray
import org.json.JSONObject

/**
 * The phone's call log, read through `CallLog.Calls` when the player has granted call log access: the newest
 * calls first, each with the name Android has cached for its number (the log keeps no photo).
 */
object Recents {
    /** The newest calls only: enough for the cab's list, and far under the host's message size. */
    private const val MOST = 60

    fun allowed(context: Context): Boolean =
        context.checkSelfPermission(Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED

    /** The newest calls, or an empty array without access. */
    fun snapshot(context: Context): JSONArray {
        if (!allowed(context)) return JSONArray()
        val recents = JSONArray()
        val projection = arrayOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
        )
        runCatching {
            context.contentResolver
                .query(CallLog.Calls.CONTENT_URI, projection, null, null, "${CallLog.Calls.DATE} DESC")
                ?.use { cursor ->
                    val idAt = cursor.getColumnIndexOrThrow(CallLog.Calls._ID)
                    val numberAt = cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)
                    val nameAt = cursor.getColumnIndexOrThrow(CallLog.Calls.CACHED_NAME)
                    val typeAt = cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE)
                    val dateAt = cursor.getColumnIndexOrThrow(CallLog.Calls.DATE)
                    val durationAt = cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION)
                    while (cursor.moveToNext() && recents.length() < MOST) {
                        val number = cursor.getString(numberAt)?.trim().orEmpty()
                        if (number.isBlank()) continue
                        val name = cursor.getString(nameAt)?.trim().orEmpty()
                        recents.put(
                            JSONObject().apply {
                                put("id", cursor.getString(idAt) ?: number)
                                put("number", number)
                                if (name.isNotBlank()) put("name", name)
                                put("kind", kindOf(cursor.getInt(typeAt)))
                                // The log counts milliseconds; the cab's times are Unix seconds.
                                put("time", cursor.getLong(dateAt) / 1000)
                                put("duration", cursor.getLong(durationAt))
                            },
                        )
                    }
                }
        }
        return recents
    }

    /** Android's call types, as the cab names them. */
    private fun kindOf(type: Int): String = when (type) {
        CallLog.Calls.INCOMING_TYPE -> "incoming"
        CallLog.Calls.OUTGOING_TYPE -> "outgoing"
        CallLog.Calls.MISSED_TYPE -> "missed"
        else -> "other"
    }
}
