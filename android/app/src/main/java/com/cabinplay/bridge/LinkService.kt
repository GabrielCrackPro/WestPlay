package com.cabinplay.bridge

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat

/**
 * Keeps the phone's link to Cabin Play alive while the phone sleeps: a foreground service with a quiet
 * notification, and a reconnect with backoff whenever the PC can't be reached. It idles while the PC isn't
 * running (nothing to connect to), and stops when the player presses Disconnect.
 */
class LinkService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private var link: PhoneLink? = null
    private lateinit var calls: CallMonitor
    /** Invalidates the callbacks of a link that has been replaced or stopped. */
    private var generation = 0
    private var attempt = 0

    private val reconnect = Runnable { connect() }
    private val phoneStatus: (String) -> Unit = { statusChanged(it) }
    private val batteryTick = object : Runnable {
        override fun run() {
            link?.sendBattery()
            handler.postDelayed(this, BATTERY_EVERY)
        }
    }

    override fun onCreate() {
        super.onCreate()
        channel()
        val foreground = notification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION, foreground, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        } else {
            startForeground(NOTIFICATION, foreground)
        }
        PhoneHub.addStatusListener(phoneStatus)
        calls = CallMonitor(this) { call -> link?.sendCall(call) }
        calls.start()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // The player may have granted call or contact access since the service last started.
        if (::calls.isInitialized) calls.start()
        link?.sendContacts()
        connect()
        return START_STICKY
    }

    override fun onDestroy() {
        generation++
        handler.removeCallbacksAndMessages(null)
        PhoneHub.removeStatusListener(phoneStatus)
        if (::calls.isInitialized) calls.stop()
        link?.stop()
        link = null
        PhoneHub.bind(null)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun connect() {
        if (link != null) return
        val pairing = Pairing.load(this)
        if (pairing == null) {
            PhoneHub.setStatus("Pair this phone in the app first")
            return
        }
        val current = ++generation
        PhoneHub.setStatus("Connecting to ${pairing.host}:${pairing.port}…")
        val connecting = PhoneLink(this, pairing, object : PhoneLink.Events {
            override fun onOpen() {
                if (current != generation) return
                attempt = 0
                PhoneHub.setStatus("Connected to ${pairing.host}")
                // A call already ringing or answered when the link came back.
                calls.current()?.let { link?.sendCall(it) }
                handler.removeCallbacks(batteryTick)
                handler.postDelayed(batteryTick, BATTERY_EVERY)
            }

            override fun onClosed(reason: String) {
                if (current != generation) return
                link = null
                PhoneHub.bind(null)
                handler.removeCallbacks(batteryTick)
                PhoneHub.setStatus(reason)
                schedule()
            }
        })
        link = connecting
        PhoneHub.bind(connecting)
        connecting.connect()
    }

    private fun schedule() {
        handler.removeCallbacks(reconnect)
        val delay = (1_000L shl attempt.coerceAtMost(5)).coerceAtMost(30_000L)
        attempt++
        handler.postDelayed(reconnect, delay)
    }

    /** The link's state in the service's own notification: the player can see it without opening the app. */
    private fun statusChanged(status: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION, notification(status))
    }

    private fun channel() {
        val channel = NotificationChannel(
            CHANNEL,
            getString(R.string.channel_name),
            NotificationManager.IMPORTANCE_LOW,
        )
        channel.description = getString(R.string.channel_description)
        channel.setShowBadge(false)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun notification(status: String = PhoneHub.status) = NotificationCompat.Builder(this, CHANNEL)
        .setSmallIcon(android.R.drawable.stat_notify_sync)
        .setContentTitle(getString(R.string.service_title))
        .setContentText(status)
        .setContentIntent(
            PendingIntent.getActivity(
                this,
                0,
                Intent(this, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            ),
        )
        .setOngoing(true)
        .setSilent(true)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .build()

    companion object {
        private const val CHANNEL = "phone-link"
        private const val NOTIFICATION = 1
        private const val BATTERY_EVERY = 60_000L

        fun start(context: android.content.Context) {
            context.startForegroundService(Intent(context, LinkService::class.java))
        }

        fun stop(context: android.content.Context) {
            context.stopService(Intent(context, LinkService::class.java))
        }
    }
}
