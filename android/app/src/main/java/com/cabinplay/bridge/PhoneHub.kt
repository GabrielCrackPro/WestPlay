package com.cabinplay.bridge

import android.annotation.SuppressLint
import android.app.Notification
import android.app.PendingIntent
import android.app.RemoteInput
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Bundle
import android.service.notification.StatusBarNotification
import android.util.Base64
import java.io.ByteArrayOutputStream
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

    /** An app icon's edge, in pixels: the cab draws it at 32 dp, even at the larger text sizes. */
    private const val ICON_PIXELS = 64

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

    /** Each app's icon as a `data:` URL, worked out once: a package's icon never changes while the link is up. */
    private val icons = HashMap<String, String?>()

    // The service owns the link and clears it in onDestroy; the context inside is the application's.
    @SuppressLint("StaticFieldLeak")
    @Volatile private var link: PhoneLink? = null
    @Volatile private var listener: NotificationListener? = null

    /**
     * Whether Android has the notification listener bound right now. Access being granted is not the same thing:
     * the system also drops the binding without revoking the grant (an app update, a force-stop, or the OEM's own
     * background clean-up), and from then on nothing is posted to this hub while the settings still say it is on.
     * `NotificationListener.ensureBound` is what gets it back.
     */
    @Volatile
    var listening: Boolean = false
        private set

    private val statusListeners = mutableSetOf<(String) -> Unit>()

    @Volatile
    var status: String = ""
        private set

    @Volatile
    var phase: LinkPhase = LinkPhase.Idle
        private set

    /**
     * Why the link last dropped, kept after it came back: the status line says how things are now, and the
     * diagnostics row is where the answer to "it did that again" lives. Nothing here is a permission the cab has to
     * ask for — a close reason is what the phone's own socket said (a timeout, a reset, a refused token).
     */
    @Volatile
    var lastError: String? = null
        private set

    fun fail(reason: String) {
        lastError = reason
    }

    /** Unpairing throws away what the phone said; the reason the last link dropped goes with it. */
    fun clearError() {
        lastError = null
    }

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
        listening = true
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
        listening = false
    }

    /**
     * One notification posted — or posted again: an app updating its words or its progress bar posts it a second
     * time, and that second post is its own card (see [idOf]).
     */
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

    /**
     * Android took the notification down: every card filed under it goes, and the cab is told each one, because the
     * cab dismisses by the post's id and only the phone knows which posts were the same notification.
     */
    @Synchronized
    fun notificationRemoved(posted: StatusBarNotification) {
        removeAll(posted.key).forEach { id -> link?.sendNotificationRemoved(id) }
    }

    /** Takes every card filed under Android's key out of the list, and hands back the ids it took. */
    private fun removeAll(key: String): List<String> {
        val ids = notifications.filterValues { it.key == key }.keys.toList()
        ids.forEach(notifications::remove)
        return ids
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

    /**
     * The id the cab files one post under: the package, Android's id and the post time.
     *
     * A notification can appear more than once, and this is what lets it: an app that updates its notification
     * posts it again with a new post time (and is free to do that as often as it likes), so every post is its own
     * card rather than a card that quietly rewrites itself under the driver's eyes (owner 2026-11-12).
     *
     * Android's own key ([StatusBarNotification.key]) is deliberately not in the id: it names the notification,
     * not the post, so it would make the posts one card again. It is kept on the [Entry] instead, because that is
     * what Android cancels by, and a removal or a dismissal sweeps every card filed under it.
     */
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
        listener?.cancelNotification(entry.key)
        // The posts of one notification are one notification in Android's shade: taking one card down takes the
        // others down with it, or the cab would keep cards for something the phone no longer has (owner 2026-11-12).
        removeAll(entry.key).forEach { removed -> link?.sendNotificationRemoved(removed) }
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
            iconOf(context, posted.packageName)?.let { put("icon", it) }
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

    /**
     * The app's own icon, as a `data:` URL the cab can draw: its launcher icon at [ICON_PIXELS] square, PNG, so a
     * message says which app it came from without the cab keeping a table of every app on the phone. Too big to
     * send at the phone's own size, and no bigger than the card ever draws it.
     */
    private fun iconOf(context: Context, packageName: String): String? = synchronized(icons) {
        if (icons.containsKey(packageName)) return@synchronized icons[packageName]
        val url = runCatching {
            val drawable = context.packageManager.getApplicationIcon(packageName)
            val bitmap = Bitmap.createBitmap(ICON_PIXELS, ICON_PIXELS, Bitmap.Config.ARGB_8888)
            drawable.setBounds(0, 0, ICON_PIXELS, ICON_PIXELS)
            drawable.draw(Canvas(bitmap))
            val png = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, png)
            "data:image/png;base64," + Base64.encodeToString(png.toByteArray(), Base64.NO_WRAP)
        }.getOrNull()
        icons[packageName] = url
        url
    }
}
