package com.cabinplay.bridge

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.app.NotificationManagerCompat
import java.util.Locale

/**
 * The bridge's one screen: where the PC is, the pairing code from the cabin's Phone app, and the switch that
 * keeps the link running. Pairing happens in the companion window's Setup, and lives here in the app's private
 * preferences; the notification access switch is Android's own.
 */
class MainActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var access: TextView
    private lateinit var contactsAccess: TextView
    private lateinit var callsAccess: TextView
    private lateinit var host: EditText
    private lateinit var port: EditText
    private lateinit var token: EditText
    private lateinit var line: EditText

    private val statusListener: (String) -> Unit = { value ->
        runOnUiThread { status.text = value }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }
        setContentView(screen())
        val saved = Pairing.load(this)
        if (saved != null) {
            host.setText(saved.host)
            port.setText(String.format(Locale.ROOT, "%d", saved.port))
            token.setText(saved.token)
        }
    }

    override fun onStart() {
        super.onStart()
        PhoneHub.addStatusListener(statusListener)
        status.text = PhoneHub.status
    }

    override fun onResume() {
        super.onResume()
        refreshAccess()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        refreshAccess()
        // A permission granted after the link was already up needs the service to look again.
        if (requestCode == ACCESS_REQUEST && Pairing.load(this) != null) LinkService.start(this)
    }

    override fun onStop() {
        PhoneHub.removeStatusListener(statusListener)
        super.onStop()
    }

    private fun refreshAccess() {
        val notifications = NotificationManagerCompat.getEnabledListenerPackages(this).contains(packageName)
        access.text = if (notifications) getString(R.string.access_granted) else getString(R.string.access_missing)
        contactsAccess.text = if (Contacts.allowed(this)) {
            getString(R.string.contacts_granted)
        } else {
            getString(R.string.contacts_missing)
        }
        val phone = allowed(Manifest.permission.READ_PHONE_STATE)
        val answer = allowed(Manifest.permission.ANSWER_PHONE_CALLS)
        callsAccess.text = when {
            phone && answer -> getString(R.string.calls_granted)
            phone -> getString(R.string.calls_partial)
            else -> getString(R.string.calls_missing)
        }
    }

    private fun requestAccess() {
        val needed = listOf(
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.ANSWER_PHONE_CALLS,
        ).filter { !allowed(it) }
        if (needed.isEmpty()) {
            status.text = getString(R.string.permissions_all)
            return
        }
        requestPermissions(needed.toTypedArray(), ACCESS_REQUEST)
    }

    private fun allowed(permission: String): Boolean =
        checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    private fun screen(): ScrollView {
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(28), dp(32), dp(28), dp(32))
        }
        column.addView(title(getString(R.string.app_name)))
        column.addView(note(getString(R.string.intro)))
        status = note(PhoneHub.status).also { it.setTextColor(getColor(R.color.status)) }
        column.addView(status)
        access = note("")
        column.addView(access)
        contactsAccess = note("")
        column.addView(contactsAccess)
        callsAccess = note("")
        column.addView(callsAccess)

        column.addView(label(getString(R.string.host)))
        host = field(getString(R.string.host_hint))
        column.addView(host)
        column.addView(label(getString(R.string.port)))
        port = field(getString(R.string.default_port)).apply { setText(getString(R.string.default_port)) }
        column.addView(port)
        column.addView(label(getString(R.string.token)))
        token = field(getString(R.string.token_hint))
        column.addView(token)

        column.addView(button(getString(R.string.connect)) { connect() })
        column.addView(button(getString(R.string.disconnect)) { disconnect() })
        column.addView(button(getString(R.string.permissions)) { requestAccess() })
        column.addView(button(getString(R.string.notification_access)) { notificationAccess() })

        column.addView(label(getString(R.string.pairing_line)))
        line = field(getString(R.string.pairing_line_hint))
        column.addView(line)
        column.addView(button(getString(R.string.use_line)) { useLine() })

        column.addView(note(getString(R.string.caveats)))
        return ScrollView(this).apply { addView(column) }
    }

    private fun connect() {
        val hostText = host.text.toString().trim()
        val portNumber = port.text.toString().trim().toIntOrNull()
        val tokenText = token.text.toString().trim()
        if (hostText.isEmpty() || portNumber == null || portNumber !in 1..65535 || tokenText.isEmpty()) {
            status.text = getString(R.string.bad_pairing)
            return
        }
        Pairing.save(this, Pairing(hostText, portNumber, tokenText))
        LinkService.start(this)
    }

    private fun disconnect() {
        LinkService.stop(this)
        PhoneHub.setStatus(getString(R.string.disconnected))
    }

    private fun notificationAccess() {
        startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }

    private fun useLine() {
        val pairing = Pairing.parse(line.text.toString())
        if (pairing == null) {
            status.text = getString(R.string.bad_line)
            return
        }
        host.setText(pairing.host)
        port.setText(String.format(Locale.ROOT, "%d", pairing.port))
        token.setText(pairing.token)
        line.setText("")
        status.text = getString(R.string.line_used)
    }

    private fun label(text: String) = TextView(this).apply {
        this.text = text
        textSize = 14f
        setPadding(0, dp(16), 0, dp(4))
        setTextColor(getColor(R.color.secondary))
    }

    private fun field(hintText: String) = EditText(this).apply {
        hint = hintText
        textSize = 16f
        isSingleLine = true
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    private fun title(text: String) = TextView(this).apply {
        this.text = text
        textSize = 26f
    }

    private fun note(text: String) = TextView(this).apply {
        this.text = text
        textSize = 15f
        setPadding(0, dp(8), 0, dp(4))
    }

    private fun button(text: String, action: () -> Unit) = Button(this).apply {
        this.text = text
        setOnClickListener { action() }
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            .apply { topMargin = dp(12) }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private companion object {
        const val ACCESS_REQUEST = 2
    }
}
