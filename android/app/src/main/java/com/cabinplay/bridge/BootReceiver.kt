package com.cabinplay.bridge

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Android starts a paired link again after a reboot, and after this app is replaced by an update: without these the
 * player had to open the app first.
 *
 * The update is the quieter of the two. Android kills the process to swap the APK, and MIUI/HyperOS drops the
 * notification listener's binding on the way through as well, so the phone comes back linked to nothing and
 * capturing nothing until its screen is opened. Both actions are exempt from Android 12's rules against starting a
 * foreground service from the background, so the link can come back on its own (owner 2026-11-12).
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        if (Pairing.load(context) == null) return
        // The service asks Android for the listener's binding as it starts, which is the other half of what an
        // update takes away (LinkService.onStartCommand).
        LinkService.start(context)
    }
}
