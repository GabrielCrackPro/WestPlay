package com.cabinplay.bridge

import android.annotation.SuppressLint
import android.app.Notification
import android.content.Context
import android.content.pm.PackageManager
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

/**
 * What the notification listener collects and what the link sends: the latest notifications, in memory only,
 * newest last (the host sorts and caps them). Notifications from this app never go back to the PC.
 *
 * The listener and the service are both in this process. The listener may run before the service (and after
 * it), so the hub keeps the list even while no link is up.
 */
object PhoneHub {
    private const val MOST = 100

    private data class Entry(val id: String, val key: String, val json: JSONObject)

    private val notifications = LinkedHashMap<String, Entry>()

    // The service owns the link and clears it in onDestroy; the context inside is the application's.
    @SuppressLint("StaticFieldLeak")
    @Volatile private var link: PhoneLink? = null
    @Volatile private var listener: NotificationListener? = null
    private val statusListeners = mutableSetOf<(String) -> Unit>()

    @Volatile
    var status: String = "Not connected"
        private set

    fun setStatus(value: String) {
        status = value
        val snapshot = synchronized(statusListeners) { statusListeners.toList() }
        snapshot.forEach { it(value) }
    }

    fun addStatusListener(listener: (String) -> Unit) {
        synchronized(statusListeners) { statusListeners.add(listener) }
    }

    fun removeStatusListener(listener: (String) -> Unit) {
        synchronized(statusListeners) { statusListeners.remove(listener) }
    }

    fun bind(link: PhoneLink?) {
        this.link = link
    }

    fun listenerConnected(service: NotificationListener) {
        listener = service
    }

    fun listenerDisconnected() {
        listener = null
    }

    /** One notification posted (or updated: Android posts it again with the same id). */
    @Synchronized
    fun notificationPosted(context: Context, posted: StatusBarNotification) {
        if (posted.packageName == context.packageName) return
        val notification = posted.notification ?: return
        if ((notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0) return
        val id = "${posted.packageName}|${posted.id}|${posted.postTime}"
        val json = jsonOf(context, posted, id, notification) ?: return
        val entry = Entry(id, posted.key, json)
        notifications[id] = entry
        while (notifications.size > MOST) {
            val oldest = notifications.keys.firstOrNull() ?: break
            notifications.remove(oldest)
        }
        link?.sendNotification(entry.json.toString())
    }

    @Synchronized
    fun notificationRemoved(posted: StatusBarNotification) {
        val id = "${posted.packageName}|${posted.id}|${posted.postTime}"
        if (notifications.remove(id) != null) link?.sendNotificationRemoved(id)
    }

    /** The whole list, as a `notifications` message's array. */
    @Synchronized
    fun snapshot(): JSONArray {
        val array = JSONArray()
        notifications.values.forEach { array.put(it.json) }
        return array
    }

    /** The phone's answer to the cab's `dismiss`: Android's own cancellation, then the host is told. */
    @Synchronized
    fun dismiss(id: String): Boolean {
        val entry = notifications[id] ?: return false
        notifications.remove(id)
        listener?.cancelNotification(entry.key)
        link?.sendNotificationRemoved(id)
        return true
    }

    private fun jsonOf(
        context: Context,
        posted: StatusBarNotification,
        id: String,
        notification: Notification,
    ): JSONObject? = runCatching {
        val extras = notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.takeIf { it.isNotBlank() }
        val text = (extras.getCharSequence(Notification.EXTRA_TEXT)
            ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT))?.toString()?.takeIf { it.isNotBlank() }
        JSONObject().apply {
            put("id", id)
            put("package", posted.packageName)
            put("app", appName(context, posted.packageName))
            title?.let { put("title", it) }
            text?.let { put("text", it) }
            put("time", posted.postTime / 1000)
            put("ongoing", posted.isOngoing || (notification.flags and Notification.FLAG_ONGOING_EVENT) != 0)
            put("actions", JSONArray().apply {
                notification.actions?.forEach { action ->
                    action.title?.toString()?.takeIf { it.isNotBlank() }?.let { put(it) }
                }
            })
        }
    }.getOrNull()

    private fun appName(context: Context, packageName: String): String = runCatching {
        val info = context.packageManager.getApplicationInfo(packageName, PackageManager.GET_META_DATA)
        context.packageManager.getApplicationLabel(info).toString()
    }.getOrDefault(packageName)
}
