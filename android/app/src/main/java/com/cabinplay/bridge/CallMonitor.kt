package com.cabinplay.bridge

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.annotation.RequiresApi

/** A call as Android's telephony state reports it. This carries no caller number; the cab names the caller from
 * the dialer's own notification instead. */
data class PhoneCall(val id: String, val state: String, val startedAt: Long?)

/**
 * Watches the phone's cellular call state (`READ_PHONE_STATE`) and tells the link when it changes, so the cab
 * can show a ringing call and offer answer/end. Android 12+ uses `TelephonyCallback`; older phones use the
 * deprecated `PhoneStateListener`, which is still the only way there.
 */
@Suppress("DEPRECATION")
class CallMonitor(private val context: Context, private val onCall: (PhoneCall) -> Unit) {
    private val telephony = context.getSystemService(TelephonyManager::class.java)
    private var listening = false
    private var last = STATE_IDLE
    private var id = ""
    private var startedAt: Long? = null

    @RequiresApi(Build.VERSION_CODES.S)
    private var callback: TelephonyCallback? = null

    @Suppress("DEPRECATION")
    private var legacy: PhoneStateListener? = null

    /** The call in progress or ringing, for a phone that connects mid-call. */
    @Synchronized
    fun current(): PhoneCall? = if (last == STATE_IDLE) null else PhoneCall(id, last, startedAt)

    fun start() {
        val manager = telephony ?: return
        if (listening || !allowed()) return
        listening = true
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val listener = Callback()
                callback = listener
                manager.registerTelephonyCallback(context.mainExecutor, listener)
            } else {
                val listener = Legacy()
                legacy = listener
                manager.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
            }
            update(manager.callState)
        }.onFailure { listening = false }
    }

    fun stop() {
        if (!listening) return
        listening = false
        val manager = telephony ?: return
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                callback?.let { manager.unregisterTelephonyCallback(it) }
                callback = null
            } else {
                @Suppress("DEPRECATION")
                legacy?.let { manager.listen(it, PhoneStateListener.LISTEN_NONE) }
                legacy = null
            }
        }
    }

    @Synchronized
    private fun update(state: Int) {
        val next = when (state) {
            TelephonyManager.CALL_STATE_RINGING -> STATE_RINGING
            TelephonyManager.CALL_STATE_OFFHOOK -> STATE_OFF_HOOK
            else -> STATE_IDLE
        }
        if (next == last) return
        if (next != STATE_IDLE && last == STATE_IDLE) {
            id = System.currentTimeMillis().toString()
            startedAt = System.currentTimeMillis() / 1000
        }
        last = next
        if (next == STATE_IDLE) startedAt = null
        onCall(PhoneCall(id, next, startedAt))
    }

    private fun allowed(): Boolean =
        context.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED

    @Suppress("DEPRECATION")
    private inner class Legacy : PhoneStateListener() {
        override fun onCallStateChanged(state: Int, phoneNumber: String?) {
            update(state)
        }
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private inner class Callback : TelephonyCallback(), TelephonyCallback.CallStateListener {
        override fun onCallStateChanged(state: Int) {
            update(state)
        }
    }

    private companion object {
        const val STATE_IDLE = "idle"
        const val STATE_RINGING = "ringing"
        const val STATE_OFF_HOOK = "offHook"
    }
}
