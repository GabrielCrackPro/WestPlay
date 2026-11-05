package com.cabinplay.bridge

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Android starts a paired link again after a reboot; without this the player had to open the app first. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED && Pairing.load(context) != null) {
            LinkService.start(context)
        }
    }
}
