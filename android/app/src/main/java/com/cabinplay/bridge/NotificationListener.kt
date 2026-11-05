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
