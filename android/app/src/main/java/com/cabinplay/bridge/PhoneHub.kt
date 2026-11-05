package com.cabinplay.bridge

import android.annotation.SuppressLint
import android.app.Notification
import android.app.PendingIntent
import android.app.RemoteInput
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
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
/** Whether the link is down, trying, or up. The screen draws its state from this, never from translated words. */
enum class LinkPhase { Idle, Connecting, Live }

object PhoneHub {
    private const val MOST = 100

    private data class ActionSlot(
        val label: String,
        val intent: PendingIntent,
        val inputs: Array<RemoteInput>,
    ) {
        val reply: Boolean get() = inputs.isNotEmpty()
    }

    private data class Entry(
        val id: String,
        val key: String,
        val json: JSONObject,
        val actions: List<ActionSlot>,
    )

    private val notifications = LinkedHashMap<String, Entry>()

    // The service owns the link and clears it in onDestroy; the context inside is the application's.
    @SuppressLint("StaticFieldLeak")
    @Volatile private var link: PhoneLink? = null
    @Volatile private var listener: NotificationListener? = null
    private val statusListeners = mutableSetOf<(String) -> Unit>()

    @Volatile
    var status: String = ""
        private set

    @Volatile
    var phase: LinkPhase = LinkPhase.Idle
        private set

    /** Whether the cab is only told an app posted something, not what it says. */
    @Volatile
    var hideContent: Boolean = false
        private set

    fun setHideContent(value: Boolean) {
        hideContent = value
        // The change applies to what the cab already has, not only to the next post.
        link?.sendNotifications()
    }

    fun setStatus(value: String, phase: LinkPhase) {
        this.phase = phase
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

    /** The socket has connected: flush any notifications that arrived before the handshake. */
    @Synchronized
    fun notifyLinked() {
        val entries = synchronized(notifications) { notifications.values.toList() }
        for (entry in entries) {
            link?.sendNotification(publicJson(entry).toString())
        }
    }

    fun listenerDisconnected() {
        listener = null
    }

    /** One notification posted (or updated: Android posts it again with the same id). */
    @Synchronized
    fun notificationPosted(context: Context, posted: StatusBarNotification) {
        val entry = entryOf(context, posted) ?: return
        notifications[entry.id] = entry
        trim()
        if (link != null) {
            link?.sendNotification(publicJson(entry).toString())
        }
    }

    /**
     * The notifications already on the phone when the listener comes up: Android reports only what is posted after
     * it is bound, so without these the cab shows nothing until every app posts again (after a reboot, or access
     * granted while notifications wait). The link is sent the whole list, marked a backlog, so the cab fills its
     * list without announcing each as news.
     */
    @Synchronized
    fun seed(context: Context, posted: Array<StatusBarNotification>?) {
        posted?.forEach { sbn ->
            val entry = entryOf(context, sbn) ?: return@forEach
            notifications[entry.id] = entry
        }
        trim()
        link?.sendNotifications()
    }

    @Synchronized
    fun notificationRemoved(posted: StatusBarNotification) {
        val id = idOf(posted)
        if (notifications.remove(id) != null) link?.sendNotificationRemoved(id)
    }

    private fun entryOf(context: Context, posted: StatusBarNotification): Entry? {
        if (posted.packageName == context.packageName) return null
        val notification = posted.notification ?: return null
        if ((notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0) return null
        val id = idOf(posted)
        val json = jsonOf(context, posted, id, notification) ?: return null
        val actions = notification.actions.orEmpty().mapNotNull { action ->
            val label = action.title?.toString()?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
            val inputs = action.remoteInputs?.toList()?.toTypedArray() ?: emptyArray()
            ActionSlot(label, action.actionIntent, inputs)
        }
        return Entry(id, posted.key, json, actions)
    }

    /** What the cab may see: the app always, the words only when content isn't hidden. */
    private fun publicJson(entry: Entry): JSONObject = JSONObject(entry.json.toString()).apply {
        if (hideContent) {
            remove("title")
            remove("text")
        }
    }

    private fun idOf(posted: StatusBarNotification): String =
        "${posted.packageName}|${posted.id}|${posted.postTime}"

    private fun trim() {
        while (notifications.size > MOST) {
            val oldest = notifications.keys.firstOrNull() ?: break
            notifications.remove(oldest)
        }
    }

    /** The whole list, as a `notifications` message's array. */
    @Synchronized
    fun snapshot(): JSONArray {
        val array = JSONArray()
        notifications.values.forEach { array.put(publicJson(it)) }
        return array
    }

    /** The cab pressed one of a notification's buttons. */
    @Synchronized
    fun action(context: Context, id: String, index: Int): Boolean {
        val entry = notifications[id] ?: return false
        val slot = entry.actions.getOrNull(index) ?: return false
        if (slot.reply) return false
        return runCatching { slot.intent.send(context, 0, Intent()) }.isSuccess
    }

    /** The cab replied to a notification through its first reply-capable button. */
    @Synchronized
    fun reply(context: Context, id: String, text: String): Boolean {
        val entry = notifications[id] ?: return false
        val slot = entry.actions.firstOrNull { it.reply } ?: return false
        if (text.isBlank()) return false
        val results = Bundle().apply {
            slot.inputs.forEach { input -> putCharSequence(input.resultKey, text) }
        }
        val intent = Intent().also { RemoteInput.addResultsToIntent(slot.inputs, it, results) }
        return runCatching { slot.intent.send(context, 0, intent) }.isSuccess
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
            put("clearable", posted.isClearable)
            (posted.groupKey ?: notification.group)?.let { put("group", it) }
            notification.category?.let { put("category", it) }
            put("priority", notification.priority)
            put("actions", JSONArray().apply {
                notification.actions?.forEach { action ->
                    action.title?.toString()?.takeIf { it.isNotBlank() }?.let { label ->
                        put(
                            JSONObject().apply {
                                put("label", label)
                                if (!action.remoteInputs.isNullOrEmpty()) put("reply", true)
                            },
                        )
                    }
                }
            })
        }
    }.getOrNull()

    private fun appName(context: Context, packageName: String): String = runCatching {
        val info = context.packageManager.getApplicationInfo(packageName, PackageManager.GET_META_DATA)
        context.packageManager.getApplicationLabel(info).toString()
    }.getOrDefault(packageName)
}
