package com.cabinplay.bridge

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf

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
    private val lastError = mutableStateOf<String?>(null)

    /** Re-reads the grants a moment after the screen comes back: the listener binding Android is asked for below is
     *  answered asynchronously, so reading the state once would show the warning for a link that is already back. */
    private val resumer = Handler(Looper.getMainLooper())
    private val refreshSoon = Runnable { refreshAccess() }

    private val statusListener: (String) -> Unit = { value ->
        runOnUiThread {
            status.value = value
            phase.value = PhoneHub.phase
            lastError.value = PhoneHub.lastError
            // A link coming up or going down changes what the listener is doing too, and the screen draws both.
            refreshAccess()
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
                    lastError = lastError.value,
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
                    onAppInfo = ::appInfo,
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
        lastError.value = PhoneHub.lastError
    }

    override fun onResume() {
        super.onResume()
        refreshAccess()
        pairingSaved.value = Pairing.load(this) != null
        // The screen comes back to the front after the player granted something, and notification access is granted
        // on another screen entirely: Android binds the listener for a grant only sometimes, so the return is when
        // the app asks for the binding instead of making the player reinstall to get one (owner 2026-11-12).
        NotificationListener.ensureBound(this)
        resumer.postDelayed(refreshSoon, 400)
        resumer.postDelayed(refreshSoon, 1_600)
    }

    override fun onPause() {
        resumer.removeCallbacks(refreshSoon)
        super.onPause()
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
            // The grant and the binding are two different things: the screen says which it has.
            notifications = NotificationListener.granted(this),
            listening = PhoneHub.listening,
            contacts = Contacts.allowed(this),
            phone = allowed(Manifest.permission.READ_PHONE_STATE),
            answer = allowed(Manifest.permission.ANSWER_PHONE_CALLS),
            batteryExempt = batteryExempt(),
        )
    }

    private fun batteryExempt(): Boolean =
        getSystemService(PowerManager::class.java)?.isIgnoringBatteryOptimizations(packageName) == true

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
        PhoneHub.clearError()
        PhoneHub.setStatus(getString(R.string.disconnected), LinkPhase.Idle)
        pairingSaved.value = false
        recreate()
    }

    /**
     * The screen where this app is allowed to read notifications, opened in the order that reaches it.
     *
     * The list of listeners is the page to aim at: it is the one every build has, and on HyperOS it is the real
     * screen — Settings › Privacy protection › Special permissions › Notification access — while the MIUI intent this
     * used to open first is the Security Center's app-permissions editor, a different page that has no notification
     * access on it (owner 2026-11-12). The fragment arguments scroll that list to this app where the Settings build
     * reads them. Android 11's per-app page is this app alone, with its toggle, where the build answers it — kept
     * second because an OEM Settings that doesn't would open nothing at all. The MIUI editor stays as a route into
     * special permissions for builds that answer neither, and the app's own info page is the last resort, because
     * that is where Android 13's *Allow restricted settings* lives — on HyperOS a switch under App info › Advanced
     * settings — without which a sideloaded app's notification toggle is greyed out. That page also has a button of
     * its own on the warning card, for a toggle the player has now seen greyed out.
     */
    private fun notificationAccess() {
        val listener = NotificationListener.component(this).flattenToString()
        val key = ":settings:fragment_args_key"
        val candidates = buildList {
            add(
                Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
                    putExtra(key, listener)
                    putExtra(":settings:show_fragment_args", Bundle().apply { putString(key, listener) })
                },
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                add(
                    Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                        .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, listener),
                )
            }
            add(
                Intent("miui.intent.action.APP_PERM_EDITOR").apply {
                    setClassName(
                        "com.miui.securitycenter",
                        "com.miui.permcenter.permissions.PermissionsEditorActivity",
                    )
                    putExtra("extra_pkgname", packageName)
                },
            )
            add(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null)))
        }
        // Whichever screen answers first is the one the player sees; a build that has none throws instead.
        for (candidate in candidates) {
            if (runCatching { startActivity(candidate) }.isSuccess) return
        }
    }

    /** This app's own info page: where *Allow restricted settings* is, for a notification toggle that is greyed. */
    private fun appInfo() {
        runCatching {
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null)))
        }
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
