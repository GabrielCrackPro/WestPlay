package com.cabinplay.bridge

import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationManagerCompat

/**
 * Android's notification listener: what the phone posts and removes goes into `PhoneHub`. The player grants
 * Notification access in the app; without it Android starts no listener and the cab shows nothing.
 *
 * A grant is not the same as a binding. Android binds this service itself, and it also drops the binding without
 * revoking the grant — when the app is updated, force-stopped, or cleaned up by the OEM's background manager — and
 * then no notification is posted at all while the Notification access screen still shows it as on. The app had
 * nothing that asked for the binding back, so the only cure the player found was uninstalling and installing the
 * APK again: a fresh install is the one thing that asked Android for the binding afresh (owner 2026-11-12).
 * [ensureBound] is that ask, made on the link's start, on the screen coming back to the front, and on the link's
 * minute tick.
 */
class NotificationListener : NotificationListenerService() {
    override fun onListenerConnected() {
        PhoneHub.listenerConnected(this)
        // What was posted before the listener was bound (access just granted, or the app restarted) is still on the
        // phone: Android only calls back for what comes next, so the hub takes the list now.
        PhoneHub.seed(this, activeNotifications)
    }

    override fun onListenerDisconnected() {
        PhoneHub.listenerDisconnected()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        PhoneHub.notificationPosted(this, sbn)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        PhoneHub.notificationRemoved(sbn)
    }

    companion object {
        /** This listener, as the system names it. */
        fun component(context: Context): ComponentName = ComponentName(context, NotificationListener::class.java)

        /**
         * Whether this app may read the phone's notifications. `getEnabledListenerPackages` is not the answer it
         * looks like: it lists packages that *declare* an enabled listener, granted or not, so the screen could
         * promise notifications it was never allowed to see. Android 8.1's own check is the real one.
         */
        fun granted(context: Context): Boolean {
            val manager = context.getSystemService(NotificationManager::class.java)
            if (manager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                return manager.isNotificationListenerAccessGranted(component(context))
            }
            return NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
        }

        /**
         * Asks Android to bind the listener again, when access is granted and the listener isn't bound. Android
         * ignores the request while access is off, and answers it at once when it is on, so this can be called as
         * often as a state needs re-checking: a bound listener makes it a no-op, and a dropped one is back to
         * collecting on the same second — with `onListenerConnected` seeding what the phone already had.
         */
        fun ensureBound(context: Context) {
            if (PhoneHub.listening) return
            if (!granted(context)) return
            runCatching {
                NotificationListenerService.requestRebind(component(context))
            }
        }
    }
}
