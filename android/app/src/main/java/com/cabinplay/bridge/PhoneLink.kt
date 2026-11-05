package com.cabinplay.bridge

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.telecom.TelecomManager
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The WebSocket to the PC (`crates/link`), in the protocol of phone_plan.md: a hello with the pairing token,
 * the phone's notifications, contacts, battery and call state, and the cab's commands back.
 *
 * OkHttp owns the socket's thread. One link is one connection: when it goes, the service makes another.
 */
class PhoneLink(context: Context, private val pairing: Pairing, private val events: Events) {
    /** Never an Activity: the link outlives any screen. */
    private val context = context.applicationContext

    interface Events {
        fun onOpen()
        fun onClosed(reason: String)
    }

    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .build()
    private val closed = AtomicBoolean(false)
    @Volatile private var socket: WebSocket? = null

    fun connect() {
        val request = Request.Builder().url(pairing.url).build()
        socket = client.newWebSocket(request, Socket())
    }

    /** Closes without telling the service: it is stopping, not losing the link. */
    fun stop() {
        if (closed.compareAndSet(false, true)) socket?.close(1000, "Cabin Play closing")
    }

    fun sendNotification(notification: String): Boolean = send(JSONObject().apply {
        put("type", "notification")
        put("notification", JSONObject(notification))
    })

    fun sendNotificationRemoved(id: String): Boolean = send(JSONObject().apply {
        put("type", "notificationRemoved")
        put("id", id)
    })

    fun sendBattery(): Boolean {
        val (level, charging) = batteryState()
        return send(JSONObject().apply {
            put("type", "battery")
            put("level", level)
            put("charging", charging)
        })
    }

    fun sendNotifications(): Boolean = send(JSONObject().apply {
        put("type", "notifications")
        put("notifications", PhoneHub.snapshot())
    })

    /** The address book, when the player has let the app read it. */
    fun sendContacts(): Boolean {
        if (!Contacts.allowed(context)) return false
        return send(JSONObject().apply {
            put("type", "contacts")
            put("contacts", Contacts.snapshot(context))
        })
    }

    /** The call log, when the player has let the app read it. */
    fun sendRecents(): Boolean {
        if (!Recents.allowed(context)) return false
        return send(JSONObject().apply {
            put("type", "recents")
            put("recents", Recents.snapshot(context))
        })
    }

    /** A call ringing, answered or over; over is `state: "idle"`, which clears the cab's banner. */
    fun sendCall(call: PhoneCall): Boolean = send(JSONObject().apply {
        put("type", "call")
        put("call", JSONObject().apply {
            put("id", call.id)
            put("state", call.state)
            call.startedAt?.let { put("startedAt", it) }
        })
    })

    private fun send(json: JSONObject): Boolean = socket?.send(json.toString()) == true

    private inner class Socket : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            socket = webSocket
            val (level, charging) = batteryState()
            send(JSONObject().apply {
                put("type", "hello")
                put("protocol", 1)
                put("token", pairing.token)
                put("device", JSONObject().apply {
                    put("name", Build.MODEL)
                    put("model", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
                    put("battery", level)
                    put("charging", charging)
                })
            })
            sendNotifications()
            sendContacts()
            sendRecents()
            events.onOpen()
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            val message = runCatching { JSONObject(text) }.getOrNull() ?: return
            if (message.optString("type") != "command") return
            command(message)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            if (!closed.get()) events.onClosed("The PC closed the link ($code)")
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            if (!closed.get()) events.onClosed("Can’t reach the PC: ${t.message ?: "no answer"}")
        }
    }

    /** The cab's commands: sync and dismiss, dial, and best-effort answer/end; the call log comes with sync. */
    private fun command(message: JSONObject) {
        val id = message.optLong("id", 0)
        val command = message.optJSONObject("command") ?: return
        when (command.optString("action")) {
            "sync" -> {
                sendBattery()
                sendNotifications()
                val contacts = sendContacts()
                sendRecents()
                ack(id, true, if (contacts || !Contacts.allowed(context)) null else "Contact access isn’t granted")
            }
            "dismiss" -> ack(id, PhoneHub.dismiss(command.optString("id")))
            "dial" -> dial(id, command.optString("number"))
            "answer" -> ack(id, answer())
            "end" -> ack(id, end())
            else -> ack(id, false, "Not supported yet")
        }
    }

    private fun dial(id: Long, number: String) {
        val opened = runCatching {
            val intent = Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", number, null))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }.isSuccess
        // A background service may not be allowed to open the dialer on recent Android; the phone's own
        // notification and the cab's banner still say who called.
        ack(id, opened, if (opened) null else "The dialer couldn’t be opened")
    }

    /** Answers the ringing call, when the player has granted call control. OEMs differ; a false ack says so. */
    @SuppressLint("MissingPermission") // Checked in allowed() just above; lint can't see through the helper.
    @Suppress("DEPRECATION")
    private fun answer(): Boolean {
        if (!allowed(Manifest.permission.ANSWER_PHONE_CALLS)) return false
        val telecom = context.getSystemService(TelecomManager::class.java) ?: return false
        return runCatching { telecom.acceptRingingCall() }.isSuccess
    }

    /** Ends the call in progress (Android 9+; older phones can only use the phone's own screen). */
    @SuppressLint("MissingPermission") // Checked in allowed() just above; lint can't see through the helper.
    @Suppress("DEPRECATION")
    private fun end(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return false
        if (!allowed(Manifest.permission.ANSWER_PHONE_CALLS)) return false
        val telecom = context.getSystemService(TelecomManager::class.java) ?: return false
        return runCatching { telecom.endCall() }.isSuccess
    }

    private fun allowed(permission: String): Boolean =
        context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    private fun ack(id: Long, ok: Boolean, error: String? = null) {
        send(JSONObject().apply {
            put("type", "ack")
            put("id", id)
            put("ok", ok)
            error?.let { put("error", it) }
        })
    }

    private fun batteryState(): Pair<Int, Boolean> {
        val manager = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val level = manager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 0
        val changed = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val status = changed?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
            status == BatteryManager.BATTERY_STATUS_FULL
        return level.coerceIn(0, 100) to charging
    }
}
