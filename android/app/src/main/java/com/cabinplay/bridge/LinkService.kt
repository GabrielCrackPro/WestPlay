package com.cabinplay.bridge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.Network
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
    private var failures = 0
    private var alertShown = false
    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            if (link == null && Pairing.load(this@LinkService) != null) {
                handler.removeCallbacks(reconnect)
                attempt = 0
                connect()
            }
        }
    }

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
        runCatching {
            getSystemService(ConnectivityManager::class.java)?.registerDefaultNetworkCallback(networkCallback)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_DISCONNECT) {
            PhoneHub.setStatus(getString(R.string.disconnected), LinkPhase.Idle)
            cancelAlert()
            stopSelf()
            return START_NOT_STICKY
        }
        // The player may have granted call or contact access since the service last started.
        if (::calls.isInitialized) calls.start()
        link?.sendContacts()
        if (intent?.action == ACTION_RECONNECT) {
            handler.removeCallbacks(reconnect)
            attempt = 0
        }
        connect()
        return START_STICKY
    }

    override fun onDestroy() {
        generation++
        handler.removeCallbacksAndMessages(null)
        runCatching {
            getSystemService(ConnectivityManager::class.java)?.unregisterNetworkCallback(networkCallback)
        }
        cancelAlert()
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
            PhoneHub.setStatus(getString(R.string.pair_phone_first), LinkPhase.Idle)
            return
        }
        val current = ++generation
        PhoneHub.setStatus(
            getString(R.string.connecting_to, "${pairing.host}:${pairing.port}"),
            LinkPhase.Connecting,
        )
        val connecting = PhoneLink(this, pairing, object : PhoneLink.Events {
            override fun onReady() {
                if (current != generation) return
                attempt = 0
                failures = 0
                alertShown = false
                cancelAlert()
                PhoneHub.setStatus(getString(R.string.connected_to, pairing.host), LinkPhase.Live)
                PhoneHub.notifyLinked()
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
                PhoneHub.setStatus(reason, LinkPhase.Idle)
                failures++
                if (failures >= ALERT_AFTER && !alertShown) {
                    alertShown = true
                    alert()
                }
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

    /** One louder note when the link keeps failing: the quiet service row alone is easy to miss. */
    private fun alert() {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    ALERT_CHANNEL,
                    getString(R.string.alert_channel_name),
                    NotificationManager.IMPORTANCE_DEFAULT,
                ).apply { description = getString(R.string.alert_channel_description) },
            )
        }
        val alert = NotificationCompat.Builder(this, ALERT_CHANNEL)
            .setSmallIcon(R.drawable.ic_bolt)
            .setColor(ACCENT)
            .setContentTitle(getString(R.string.alert_title))
            .setContentText(getString(R.string.alert_body))
            .setContentIntent(openApp())
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_ERROR)
            .build()
        manager.notify(ALERT, alert)
    }

    private fun cancelAlert() {
        getSystemService(NotificationManager::class.java).cancel(ALERT)
    }

    private fun channel() {
        val channel = NotificationChannel(
            CHANNEL,
            getString(R.string.channel_name),
            NotificationManager.IMPORTANCE_LOW,
        )
        channel.description = getString(R.string.channel_description)
        channel.setShowBadge(false)
        channel.setSound(null, null)
        channel.enableVibration(false)
        channel.lockscreenVisibility = Notification.VISIBILITY_PRIVATE
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun notification(status: String = PhoneHub.status): Notification {
        val phase = PhoneHub.phase
        val title = when (phase) {
            LinkPhase.Live -> R.string.notification_title_connected
            LinkPhase.Connecting -> R.string.notification_title_connecting
            LinkPhase.Idle -> R.string.notification_title_idle
        }
        val body = status.ifBlank { getString(R.string.notification_body_idle) }
        val builder = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_bolt)
            .setColor(ACCENT)
            .setContentTitle(getString(title))
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(openApp())
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        if (phase == LinkPhase.Connecting) builder.setProgress(0, 0, true)
        if (phase == LinkPhase.Idle) {
            builder.addAction(
                NotificationCompat.Action(
                    R.drawable.ic_refresh,
                    getString(R.string.notification_action_reconnect),
                    serviceAction(ACTION_RECONNECT, 2),
                ),
            )
        }
        builder.addAction(
            NotificationCompat.Action(
                R.drawable.ic_close,
                getString(R.string.disconnect),
                serviceAction(ACTION_DISCONNECT, 3),
            ),
        )
        return builder.build()
    }

    private fun serviceAction(action: String, request: Int): PendingIntent = PendingIntent.getService(
        this,
        request,
        Intent(this, LinkService::class.java).setAction(action),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun openApp(): PendingIntent = PendingIntent.getActivity(
        this,
        0,
        Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    companion object {
        private const val CHANNEL = "phone-link"
        private const val NOTIFICATION = 1
        private const val BATTERY_EVERY = 60_000L
        private const val ACTION_DISCONNECT = "com.cabinplay.bridge.action.DISCONNECT"
        private const val ACTION_RECONNECT = "com.cabinplay.bridge.action.RECONNECT"
        private const val ALERT_CHANNEL = "link-alerts"
        private const val ALERT = 2
        private const val ALERT_AFTER = 3
        private val ACCENT = 0xFF8AF0C4.toInt()

        fun start(context: android.content.Context) {
            context.startForegroundService(Intent(context, LinkService::class.java))
        }

        fun stop(context: android.content.Context) {
            context.stopService(Intent(context, LinkService::class.java))
        }
    }
}
