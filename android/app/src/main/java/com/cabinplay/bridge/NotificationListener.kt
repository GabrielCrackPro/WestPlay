package com.cabinplay.bridge

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Android's notification listener: what the phone posts and removes goes into `PhoneHub`. The player grants
 * Notification access in the app; without it Android starts no listener and the cab shows nothing.
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
}
