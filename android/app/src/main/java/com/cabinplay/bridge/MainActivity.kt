package com.cabinplay.bridge

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import androidx.core.app.NotificationManagerCompat

/**
 * The bridge's one screen: where the PC is, the pairing code from the Cabin Play companion, and the access that lets
 * notifications, contacts and calls through. The link itself is owned by [LinkService]; this screen only saves
 * the pairing and asks Android for the grants.
 */
class MainActivity : ComponentActivity() {
    private val status = mutableStateOf(PhoneHub.status)
    private val phase = mutableStateOf(PhoneHub.phase)
    private val access = mutableStateOf(PhoneAccess())
    private val notice = mutableStateOf<String?>(null)
    private val hideContent = mutableStateOf(false)
    private val pairingSaved = mutableStateOf(false)

    private val statusListener: (String) -> Unit = { value ->
        runOnUiThread {
            status.value = value
            phase.value = PhoneHub.phase
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.BLACK),
        )
        hideContent.value = preferences().getBoolean(HIDE_CONTENT, false)
        PhoneHub.setHideContent(hideContent.value)
        pairingSaved.value = Pairing.load(this) != null
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), NOTIFICATIONS_REQUEST)
        }
        refreshAccess()
        setContent {
            BridgeTheme {
                BridgeScreen(
                    status = status.value,
                    phase = phase.value,
                    access = access.value,
                    notice = notice.value,
                    hideContent = hideContent.value,
                    pairingSaved = pairingSaved.value,
                    onNotice = { notice.value = it },
                    onHideContent = ::setHideContent,
                    onConnect = ::connect,
                    onDisconnect = ::disconnect,
                    onRequestPermissions = ::requestAccess,
                    onNotificationSettings = ::notificationAccess,
                    onBatteryOptimization = ::batteryOptimization,
                    onForget = ::forget,
                )
            }
        }
    }

    override fun onStart() {
        super.onStart()
        PhoneHub.addStatusListener(statusListener)
        status.value = PhoneHub.status
        phase.value = PhoneHub.phase
    }

    override fun onResume() {
        super.onResume()
        refreshAccess()
        pairingSaved.value = Pairing.load(this) != null
    }

    override fun onStop() {
        PhoneHub.removeStatusListener(statusListener)
        super.onStop()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        refreshAccess()
        // A permission granted after the link was already up needs the service to look again.
        if (requestCode == ACCESS_REQUEST && Pairing.load(this) != null) LinkService.start(this)
    }

    private fun refreshAccess() {
        access.value = PhoneAccess(
            notifications = NotificationManagerCompat.getEnabledListenerPackages(this).contains(packageName),
            contacts = Contacts.allowed(this),
            phone = allowed(Manifest.permission.READ_PHONE_STATE),
            answer = allowed(Manifest.permission.ANSWER_PHONE_CALLS),
        )
    }

    private fun requestAccess() {
        val needed = listOf(
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.ANSWER_PHONE_CALLS,
        ).filter { !allowed(it) }
        if (needed.isEmpty()) {
            notice.value = getString(R.string.permissions_all)
            return
        }
        requestPermissions(needed.toTypedArray(), ACCESS_REQUEST)
    }

    private fun connect(host: String, port: Int, token: String) {
        Pairing.save(this, Pairing(host, port, token))
        LinkService.start(this)
    }

    private fun disconnect() {
        LinkService.stop(this)
        PhoneHub.setStatus(getString(R.string.disconnected), LinkPhase.Idle)
    }

    private fun setHideContent(value: Boolean) {
        hideContent.value = value
        preferences().edit().putBoolean(HIDE_CONTENT, value).apply()
        PhoneHub.setHideContent(value)
        Pairing.load(this)?.let { LinkService.start(this) }
    }

    private fun batteryOptimization() {
        val request = Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:$packageName"),
        )
        runCatching { startActivity(request) }.onFailure {
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }
    }

    private fun forget() {
        LinkService.stop(this)
        Pairing.clear(this)
        PhoneHub.setStatus(getString(R.string.disconnected), LinkPhase.Idle)
        pairingSaved.value = false
        recreate()
    }

    private fun notificationAccess() {
        startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }

    private fun allowed(permission: String): Boolean =
        checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    private fun preferences() = getSharedPreferences("settings", MODE_PRIVATE)

    private companion object {
        const val NOTIFICATIONS_REQUEST = 1
        const val ACCESS_REQUEST = 2
        const val HIDE_CONTENT = "hide_notification_content"
    }
}
