package com.cabinplay.bridge

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions

/**
 * The phone's grants, as the screen draws them. Calls need both the state and the control permission.
 *
 * `notifications` is the grant and `listening` is Android actually delivering: they come apart, and the screen says
 * so rather than promising notifications it isn't getting (`capturing`). `batteryExempt` is the same kind of state
 * for the other thing the app asks for: whether Android has been told to leave the link alone.
 */
data class PhoneAccess(
    val notifications: Boolean = false,
    val listening: Boolean = false,
    val contacts: Boolean = false,
    val phone: Boolean = false,
    val answer: Boolean = false,
    val batteryExempt: Boolean = false,
) {
    val calls: Boolean get() = phone && answer
    val callsPartial: Boolean get() = phone && !answer
    val capturing: Boolean get() = notifications && listening
}

private val Ink = Color(0xFF000000)
private val Card = Color(0xFF050505)
private val Field = Color(0xFF070707)
private val Mint = Color(0xFF8AF0C4)
private val Muted = Color(0xFF9A9A9F)
private val Hairline = Color(0x14FFFFFF)
private val Amber = Color(0xFFFFC46B)

/**
 * The two steps of white the screen writes in, plus a faint one for decoration only.
 *
 * These were 0.34–0.42 over the AMOLED black, which is about 3–3.5:1 — under the 4.5:1 that text below ~18sp needs
 * to be read at arm's length, and very nearly all of this screen is below 18sp (owner 2026-11-12). Read against
 * `Card` #050505: `Body` is about 9:1 and `Soft` about 7:1, so the quiet, dashboard look survives at a legible
 * weight. `Faint` is for rules and marks that carry no words.
 */
private val Body = Color.White.copy(alpha = 0.70f)
private val Soft = Color.White.copy(alpha = 0.58f)
private val Faint = Color.White.copy(alpha = 0.45f)

/**
 * The screen's type, in one place: the look is a dash's — wide letter-spaced overlines over quiet body copy — and
 * every size and weight used to be written at its call site, where they drifted apart. The smallest step is 11sp:
 * 10sp letter-spaced capitals on a phone in one hand are a decoration, not a label.
 */
private object Type {
    val brand = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp)
    val hero = TextStyle(fontSize = 30.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.6).sp)
    val overline = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.8.sp)
    val section = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.6.sp)
    val cardTitle = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
    val rowTitle = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    val action = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    val body = TextStyle(fontSize = 13.sp, lineHeight = 19.sp)
    val bodySmall = TextStyle(fontSize = 12.sp, lineHeight = 17.sp)
    val micro = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    val field = TextStyle(fontSize = 15.sp)
}

private val Palette = darkColorScheme(
    primary = Mint,
    onPrimary = Ink,
    primaryContainer = Color(0xFF123326),
    onPrimaryContainer = Mint,
    secondary = Mint,
    onSecondary = Ink,
    tertiary = Amber,
    onTertiary = Ink,
    background = Ink,
    onBackground = Color.White,
    surface = Card,
    onSurface = Color.White,
    surfaceVariant = Color(0xFF101012),
    onSurfaceVariant = Muted,
    outline = Color(0xFF2A2A2E),
    error = Color(0xFFFF8A80),
    onError = Ink,
)

@Composable
fun BridgeTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Palette, content = content)
}

private enum class LinkState {
    Live,
    Working,
    Idle,
}

/** How an access row stands: given and working, given but not being delivered, or not given at all. */
private enum class GrantState { Granted, Waiting, Missing }

@Composable
fun BridgeScreen(
    status: String,
    phase: LinkPhase,
    lastError: String?,
    access: PhoneAccess,
    notice: String?,
    hideContent: Boolean,
    pairingSaved: Boolean,
    onNotice: (String?) -> Unit,
    onHideContent: (Boolean) -> Unit,
    onConnect: (String, Int, String) -> Unit,
    onDisconnect: () -> Unit,
    onRequestPermissions: () -> Unit,
    onNotificationSettings: () -> Unit,
    onAppInfo: () -> Unit,
    onBatteryOptimization: () -> Unit,
    onForget: () -> Unit,
) {
    val context = LocalContext.current
    val saved = remember { Pairing.load(context) }
    var host by rememberSaveable { mutableStateOf(saved?.host.orEmpty()) }
    var port by rememberSaveable {
        mutableStateOf(saved?.port?.toString() ?: context.getString(R.string.default_port))
    }
    var token by rememberSaveable { mutableStateOf(saved?.token.orEmpty()) }
    var line by rememberSaveable { mutableStateOf("") }
    var lineOpen by rememberSaveable { mutableStateOf(false) }
    // A code that failed a press on Connect stays marked under its field until the player edits it, so the words in
    // the snackbar still point at something on screen after the snackbar has gone (owner 2026-11-12).
    var codeRejected by rememberSaveable { mutableStateOf(false) }

    val scanOptions = remember {
        ScanOptions()
            .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            .setPrompt(context.getString(R.string.scan_prompt))
            .setBeepEnabled(false)
            .setOrientationLocked(true)
            .setBarcodeImageEnabled(false)
            .setCaptureActivity(QrScanActivity::class.java)
    }
    val scanLauncher = rememberLauncherForActivityResult(ScanContract()) { result ->
        val scanned = result.contents
        if (scanned != null) {
            val parsed = Pairing.parse(scanned)
            if (parsed == null) {
                onNotice(context.getString(R.string.bad_line))
            } else if (!Pairing.isValidToken(parsed.token)) {
                // A code shaped like no code Cabin Play makes, arriving inside an otherwise good line: fill the form
                // and stop there rather than knock on the door with it (owner 2026-11-12).
                host = parsed.host
                port = parsed.port.toString()
                token = parsed.token
                lineOpen = false
                codeRejected = true
                onNotice(context.getString(R.string.bad_code))
            } else {
                host = parsed.host
                port = parsed.port.toString()
                token = parsed.token
                lineOpen = false
                codeRejected = false
                onNotice(null)
                onConnect(parsed.host, parsed.port, parsed.token)
            }
        }
    }
    val cameraPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            scanLauncher.launch(scanOptions)
        } else {
            onNotice(context.getString(R.string.camera_needed))
        }
    }
    val startScan: () -> Unit = {
        if (context.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            scanLauncher.launch(scanOptions)
        } else {
            cameraPermission.launch(Manifest.permission.CAMERA)
        }
    }

    val state = when (phase) {
        LinkPhase.Live -> LinkState.Live
        LinkPhase.Connecting -> LinkState.Working
        LinkPhase.Idle -> LinkState.Idle
    }

    // The cab's reply to a press as a snackbar at the foot of the screen rather than a card at its top: the card
    // sat above the pairing card, so a bad code or a refused camera showed its words off the top of the screen, on
    // a column that keeps its scroll where the press was (owner 2026-11-12). It goes by itself, and a press on the
    // action takes it away.
    val snackbar = remember { SnackbarHostState() }
    val dismissWords = stringResource(R.string.snackbar_dismiss)
    LaunchedEffect(notice) {
        val words = notice ?: return@LaunchedEffect
        snackbar.showSnackbar(
            message = words,
            actionLabel = dismissWords,
            withDismissAction = false,
            duration = SnackbarDuration.Long,
        )
        onNotice(null)
    }

    Surface(modifier = Modifier.fillMaxSize(), color = Ink) {
        Box(Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .windowInsetsPadding(WindowInsets.safeDrawing)
                    .imePadding()
                    .padding(horizontal = 20.dp)
                    .padding(top = 14.dp, bottom = 32.dp),
            ) {
                Header()
                Spacer(Modifier.height(22.dp))
                StatusCard(status = status, state = state, host = host, port = port)

                if (!access.capturing) {
                    Spacer(Modifier.height(14.dp))
                    NotificationWarning(
                        title = stringResource(
                            if (access.notifications) {
                                R.string.notifications_waiting_title
                            } else {
                                R.string.notifications_warning_title
                            },
                        ),
                        body = stringResource(
                            if (access.notifications) {
                                R.string.notifications_waiting_body
                            } else {
                                R.string.notifications_warning_body
                            },
                        ),
                        onOpenSettings = onNotificationSettings,
                        // Android 13 greys a sideloaded app's toggle out until it is allowed restricted settings,
                        // and that switch lives on this app's info page (on HyperOS: App info › Advanced settings).
                        onAppInfo = if (access.notifications) null else onAppInfo,
                    )
                }

                Spacer(Modifier.height(30.dp))
                SectionLabel(stringResource(R.string.section_pairing))
                Spacer(Modifier.height(10.dp))
                PairingCard(
                    host = host,
                    port = port,
                    token = token,
                    line = line,
                    lineOpen = lineOpen,
                    connected = state != LinkState.Idle,
                    onHost = { host = it },
                    onPort = { port = it },
                    onToken = {
                        token = it
                        codeRejected = false
                    },
                    codeError = if (codeRejected) context.getString(R.string.code_rule) else null,
                    onLine = { line = it },
                    onToggleLine = { lineOpen = !lineOpen },
                    onUseLine = {
                        val parsed = Pairing.parse(line)
                        if (parsed == null) {
                            onNotice(context.getString(R.string.bad_line))
                        } else {
                            host = parsed.host
                            port = parsed.port.toString()
                            token = parsed.token
                            line = ""
                            lineOpen = false
                            codeRejected = !Pairing.isValidToken(parsed.token)
                            onNotice(
                                context.getString(if (codeRejected) R.string.bad_code else R.string.line_used),
                            )
                        }
                    },
                    onConnect = {
                        val number = port.trim().toIntOrNull()
                        val code = token.trim()
                        if (host.isBlank() || number == null || number !in 1..65535 || code.isEmpty()) {
                            onNotice(context.getString(R.string.bad_pairing))
                        } else if (!Pairing.isValidToken(code)) {
                            // Said here, where the player can see the field they mistyped, instead of letting the
                            // socket fail and reading back "the PC closed the link" about a code that never was
                            // (owner 2026-11-12).
                            codeRejected = true
                            onNotice(context.getString(R.string.bad_code))
                        } else {
                            codeRejected = false
                            onNotice(null)
                            onConnect(host.trim(), number, code)
                        }
                    },
                    onDisconnect = onDisconnect,
                    onScan = startScan,
                )

                Spacer(Modifier.height(30.dp))
                SectionLabel(stringResource(R.string.section_access))
                Spacer(Modifier.height(10.dp))
                AccessCard(
                    access = access,
                    onNotificationSettings = onNotificationSettings,
                    onRequestPermissions = onRequestPermissions,
                )

                Spacer(Modifier.height(28.dp))
                GoodToKnow(stringResource(R.string.caveats))

                Spacer(Modifier.height(16.dp))
                SettingsCard(
                    hideContent = hideContent,
                    batteryExempt = access.batteryExempt,
                    pairingSaved = pairingSaved,
                    onHideContent = onHideContent,
                    onBatteryOptimization = onBatteryOptimization,
                    onForget = onForget,
                )

                Spacer(Modifier.height(16.dp))
                DiagnosticsCard(
                    phase = phase,
                    access = access,
                    lastError = lastError,
                    onCopied = { onNotice(context.getString(R.string.diagnostics_copied)) },
                )
            }

            SnackbarHost(
                hostState = snackbar,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    // A message is the one thing here that has to be noticed, so the host is a polite live region:
                    // otherwise it is drawn for six seconds and a screen reader is never told it exists.
                    .semantics { liveRegion = LiveRegionMode.Polite }
                    .windowInsetsPadding(WindowInsets.safeDrawing)
                    .imePadding()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) { data ->
                Snackbar(
                    snackbarData = data,
                    shape = RoundedCornerShape(16.dp),
                    containerColor = Color(0xFF101012),
                    contentColor = Body,
                    actionColor = Mint,
                    modifier = Modifier.border(1.dp, Hairline, RoundedCornerShape(16.dp)),
                )
            }
        }
    }
}

@Composable
private fun SettingsCard(
    hideContent: Boolean,
    batteryExempt: Boolean,
    pairingSaved: Boolean,
    onHideContent: (Boolean) -> Unit,
    onBatteryOptimization: () -> Unit,
    onForget: () -> Unit,
) {
    var confirmForget by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(20.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Card)
            .border(1.dp, Hairline, shape),
    ) {
        // The whole row is the switch, not just the switch: the label and its explanation sat beside a control that
        // was the only thing on the row a press did anything to.
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .toggleable(value = hideContent, role = Role.Switch, onValueChange = onHideContent)
                .padding(start = 16.dp, top = 14.dp, end = 12.dp, bottom = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.hide_content),
                    style = Type.rowTitle.copy(fontSize = 14.sp),
                    color = Color.White,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = stringResource(R.string.hide_content_body),
                    style = Type.bodySmall,
                    color = Soft,
                )
            }
            Spacer(Modifier.width(12.dp))
            Switch(checked = hideContent, onCheckedChange = null)
        }
        HorizontalDivider(color = Hairline, modifier = Modifier.padding(horizontal = 16.dp))
        // Battery optimisation states what Android thinks, not just where the button goes: the row offered the
        // request whether or not it had already been answered.
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .then(if (batteryExempt) Modifier else Modifier.clickable(onClick = onBatteryOptimization))
                .padding(start = 16.dp, top = 13.dp, end = 12.dp, bottom = 13.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.battery_optimization),
                    style = Type.rowTitle.copy(fontSize = 14.sp),
                    color = Color.White,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = stringResource(
                        if (batteryExempt) R.string.battery_on_body else R.string.battery_off_body,
                    ),
                    style = Type.bodySmall,
                    color = Soft,
                )
            }
            Spacer(Modifier.width(12.dp))
            if (batteryExempt) {
                Icon(
                    imageVector = Icons.Filled.CheckCircle,
                    contentDescription = stringResource(R.string.granted),
                    tint = Mint,
                    modifier = Modifier.size(17.dp),
                )
            } else {
                ActionChip(stringResource(R.string.battery_allow), Mint)
            }
        }
        if (pairingSaved) {
            HorizontalDivider(color = Hairline, modifier = Modifier.padding(horizontal = 16.dp))
            TextButton(
                onClick = { confirmForget = true },
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 13.dp),
            ) {
                Text(
                    text = stringResource(R.string.forget_pc),
                    color = MaterialTheme.colorScheme.error,
                    style = Type.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                )
            }
        }
    }
    if (confirmForget) {
        AlertDialog(
            onDismissRequest = { confirmForget = false },
            title = { Text(stringResource(R.string.forget_confirm_title)) },
            text = { Text(stringResource(R.string.forget_confirm_body)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmForget = false
                        onForget()
                    },
                ) { Text(stringResource(R.string.forget_confirm), color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { confirmForget = false }) {
                    Text(stringResource(R.string.settings_cancel))
                }
            },
        )
    }
}

/**
 * What the link and the listener are doing, on one card, for the failures a status line forgets: a socket dropped on
 * a Xiaomi phone, access that is granted but not delivering, the last reason the link went. The last error outlives
 * the status that replaced it. Copy puts those three facts on the clipboard with the phone they happened on, so a
 * report is a paste rather than a description.
 */
@Composable
private fun DiagnosticsCard(
    phase: LinkPhase,
    access: PhoneAccess,
    lastError: String?,
    onCopied: () -> Unit,
) {
    val context = LocalContext.current
    val link = stringResource(
        when (phase) {
            LinkPhase.Live -> R.string.diagnostics_link_live
            LinkPhase.Connecting -> R.string.diagnostics_link_working
            LinkPhase.Idle -> R.string.diagnostics_link_idle
        },
    )
    val listener = stringResource(
        when {
            !access.notifications -> R.string.diagnostics_listener_off
            access.listening -> R.string.diagnostics_listener_bound
            else -> R.string.diagnostics_listener_unbound
        },
    )
    val none = stringResource(R.string.diagnostics_none)
    val shape = RoundedCornerShape(20.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Card)
            .border(1.dp, Hairline, shape)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = stringResource(R.string.diagnostics).uppercase(),
                style = Type.section,
                color = Soft,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(Modifier.weight(1f))
            TextButton(
                onClick = {
                    val phone = "${Build.MANUFACTURER} ${Build.MODEL} (Android ${Build.VERSION.RELEASE})"
                    val summary = "$phone, app ${BuildConfig.VERSION_NAME}; " +
                        "link=$link; listener=$listener; error=${lastError ?: none}"
                    context.getSystemService(ClipboardManager::class.java)
                        ?.setPrimaryClip(ClipData.newPlainText("Cabin Play Bridge", summary))
                    onCopied()
                },
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
            ) {
                Text(
                    text = stringResource(R.string.diagnostics_copy),
                    style = Type.micro,
                    color = Mint,
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        DiagnosticLine(stringResource(R.string.diagnostics_link), link)
        Spacer(Modifier.height(6.dp))
        DiagnosticLine(stringResource(R.string.diagnostics_listener), listener)
        Spacer(Modifier.height(6.dp))
        DiagnosticLine(stringResource(R.string.diagnostics_last_error), lastError ?: none, wrap = true)
    }
}

/** One fact on the diagnostics card: its name on the left, its state on the right, cut short only if it's long. */
@Composable
private fun DiagnosticLine(label: String, value: String, wrap: Boolean = false) {
    Row(verticalAlignment = Alignment.Top) {
        Text(
            text = label,
            style = Type.bodySmall,
            color = Soft,
            modifier = Modifier.width(132.dp),
        )
        Text(
            text = value,
            style = Type.bodySmall,
            color = Body,
            maxLines = if (wrap) 3 else 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun Header() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Image(
            painter = painterResource(R.drawable.cabinplay),
            contentDescription = null,
            modifier = Modifier.size(48.dp).clip(RoundedCornerShape(11.dp)),
        )
        Spacer(Modifier.width(12.dp))
        Column {
            Text(
                text = stringResource(R.string.brand_over),
                style = Type.overline.copy(fontSize = 10.sp, letterSpacing = 2.sp),
                color = Soft,
            )
            Text(
                text = stringResource(R.string.brand_title),
                style = Type.brand,
                color = Color.White,
            )
        }
    }
}

@Composable
private fun StatusCard(status: String, state: LinkState, host: String, port: String) {
    val color = stateColor(state)
    val shape = RoundedCornerShape(28.dp)
    val title = stringResource(
        when (state) {
            LinkState.Live -> R.string.hero_live
            LinkState.Working -> R.string.hero_working
            LinkState.Idle -> R.string.hero_idle
        },
    )
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Card)
            .border(1.dp, Hairline, shape)
            .drawBehind {
                val center = Offset(size.width * 0.9f, 0f)
                val radius = size.width * 0.85f
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(color.copy(alpha = 0.10f), Color.Transparent),
                        center = center,
                        radius = radius,
                    ),
                    radius = radius,
                    center = center,
                )
            }
            .padding(22.dp),
    ) {
        Image(
            painter = painterResource(R.drawable.ic_bolt),
            contentDescription = null,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .offset(x = 16.dp, y = (-12).dp)
                .size(104.dp)
                .alpha(0.05f),
        )
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                PulsingDot(color = color, pulse = state != LinkState.Idle)
                Spacer(Modifier.width(10.dp))
                Text(
                    text = stringResource(R.string.state_overline).uppercase(),
                    style = Type.overline,
                    color = color,
                )
                Spacer(Modifier.weight(1f))
            }
            Spacer(Modifier.height(18.dp))
            Text(
                text = title,
                style = Type.hero,
                color = Color.White,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = status.ifBlank { stringResource(R.string.disconnected) },
                style = Type.body,
                color = Soft,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (host.isNotBlank() && port.isNotBlank()) {
                Spacer(Modifier.height(14.dp))
                Row(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.05f))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(5.dp).clip(CircleShape).background(color))
                    Spacer(Modifier.width(7.dp))
                    Text(
                        text = "$host:$port",
                        style = Type.micro.copy(fontWeight = FontWeight.Normal),
                        color = Body,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.widthIn(max = 200.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text("·", style = Type.micro, color = Faint)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = stringResource(R.string.local_network),
                        style = Type.micro.copy(fontWeight = FontWeight.Normal),
                        color = Soft,
                    )
                }
            }
        }
    }
}

/**
 * The link's light: lit while the link is working, still while it idles. The glow exists only while it pulses — the
 * transition used to run at `Idle` too, recomposing this card every frame on a phone that is meant to sleep.
 */
@Composable
private fun PulsingDot(color: Color, pulse: Boolean) {
    Box(Modifier.size(18.dp), contentAlignment = Alignment.Center) {
        if (pulse) Glow(color)
        Box(Modifier.size(7.dp).clip(CircleShape).background(color))
    }
}

@Composable
private fun Glow(color: Color) {
    val transition = rememberInfiniteTransition(label = "link")
    val glow by transition.animateFloat(
        initialValue = 0.12f,
        targetValue = 0.4f,
        animationSpec = infiniteRepeatable(tween(1_400), RepeatMode.Reverse),
        label = "glow",
    )
    Box(Modifier.size(18.dp).clip(CircleShape).background(color.copy(alpha = glow)))
}

@Composable
private fun NotificationWarning(
    title: String,
    body: String,
    onOpenSettings: () -> Unit,
    onAppInfo: (() -> Unit)?,
) {
    val shape = RoundedCornerShape(22.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Amber.copy(alpha = 0.06f))
            .border(1.dp, Amber.copy(alpha = 0.28f), shape)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Warning, contentDescription = null, tint = Amber, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                text = title,
                style = Type.rowTitle,
                color = Color.White,
            )
        }
        Spacer(Modifier.height(8.dp))
        Text(
            text = body,
            style = Type.body,
            color = Body,
        )
        Spacer(Modifier.height(10.dp))
        Row {
            TextButton(onClick = onOpenSettings, contentPadding = PaddingValues(0.dp)) {
                Text(
                    text = stringResource(R.string.open_settings),
                    style = Type.body.copy(fontWeight = FontWeight.SemiBold),
                    color = Amber,
                )
            }
            if (onAppInfo != null) {
                Spacer(Modifier.width(20.dp))
                TextButton(onClick = onAppInfo, contentPadding = PaddingValues(0.dp)) {
                    Text(
                        text = stringResource(R.string.app_info),
                        style = Type.body.copy(fontWeight = FontWeight.SemiBold),
                        color = Soft,
                    )
                }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        style = Type.section,
        color = Soft,
        // A heading, so TalkBack can jump between the screen's sections instead of reading one long column.
        modifier = Modifier
            .padding(start = 4.dp)
            .semantics { heading() },
    )
}

@Composable
private fun PairingCard(
    host: String,
    port: String,
    token: String,
    line: String,
    lineOpen: Boolean,
    connected: Boolean,
    codeError: String?,
    onHost: (String) -> Unit,
    onPort: (String) -> Unit,
    onToken: (String) -> Unit,
    onLine: (String) -> Unit,
    onToggleLine: () -> Unit,
    onUseLine: () -> Unit,
    onConnect: () -> Unit,
    onDisconnect: () -> Unit,
    onScan: () -> Unit,
) {
    val shape = RoundedCornerShape(26.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Card)
            .border(1.dp, Hairline, shape)
            .padding(18.dp),
    ) {
        Text(
            text = stringResource(R.string.pairing_title),
            style = Type.cardTitle,
            color = Color.White,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = stringResource(R.string.pairing_body),
            style = Type.bodySmall,
            color = Soft,
        )
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            BridgeField(
                value = host,
                onValueChange = onHost,
                label = stringResource(R.string.host),
                modifier = Modifier.weight(1f),
                enabled = !connected,
            )
            BridgeField(
                value = port,
                onValueChange = { value -> onPort(value.filter(Char::isDigit)) },
                label = stringResource(R.string.port),
                modifier = Modifier.width(110.dp),
                keyboardType = KeyboardType.Number,
                enabled = !connected,
            )
        }
        Spacer(Modifier.height(10.dp))
        // The pairing code is the link's shared secret: it is masked until the player asks to see it, rather than
        // printed on the screen for whoever is holding the phone.
        BridgeField(
            value = token,
            onValueChange = onToken,
            label = stringResource(R.string.token),
            keyboardType = KeyboardType.Password,
            masked = true,
            errorText = codeError,
            enabled = !connected,
        )
        Spacer(Modifier.height(16.dp))
        if (connected) {
            OutlinedButton(
                onClick = onDisconnect,
                modifier = Modifier.fillMaxWidth().height(54.dp),
                shape = RoundedCornerShape(18.dp),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.14f)),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White.copy(alpha = 0.82f)),
            ) {
                Icon(Icons.Filled.Close, contentDescription = null, modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.disconnect), style = Type.action)
            }
        } else {
            Button(
                onClick = onConnect,
                modifier = Modifier.fillMaxWidth().height(54.dp),
                shape = RoundedCornerShape(18.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Mint, contentColor = Ink),
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_bolt),
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.connect), style = Type.action.copy(fontWeight = FontWeight.Bold))
            }
        }
        if (!connected) {
            Spacer(Modifier.height(10.dp))
            OutlinedButton(
                onClick = onScan,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                contentPadding = PaddingValues(horizontal = 16.dp),
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_qr_code),
                    contentDescription = null,
                    tint = Mint,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.scan_qr),
                    style = Type.action.copy(fontSize = 14.sp),
                    color = Color.White.copy(alpha = 0.82f),
                )
            }
        }
        if (connected) {
            Spacer(Modifier.height(4.dp))
            Text(
                text = stringResource(R.string.pairing_locked),
                style = Type.bodySmall,
                color = Soft,
                modifier = Modifier.padding(start = 4.dp, top = 2.dp),
            )
        } else {
            Spacer(Modifier.height(6.dp))
            TextButton(
                onClick = onToggleLine,
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(vertical = 10.dp),
            ) {
                Icon(Icons.Filled.Edit, contentDescription = null, tint = Muted, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.paste_line), style = Type.body, color = Soft)
                Spacer(Modifier.width(4.dp))
                Icon(
                    imageVector = if (lineOpen) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown,
                    contentDescription = null,
                    tint = Muted,
                    modifier = Modifier.size(18.dp),
                )
            }
            AnimatedVisibility(visible = lineOpen) {
                Column {
                    BridgeField(
                        value = line,
                        onValueChange = onLine,
                        label = stringResource(R.string.pairing_line_label),
                        placeholder = stringResource(R.string.pairing_line_hint),
                        singleLine = false,
                        minLines = 2,
                        maxLines = 4,
                    )
                    Spacer(Modifier.height(8.dp))
                    TextButton(onClick = onUseLine, contentPadding = PaddingValues(0.dp)) {
                        Text(
                            text = stringResource(R.string.use_line),
                            style = Type.body.copy(fontWeight = FontWeight.SemiBold),
                            color = Mint,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BridgeField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    placeholder: String? = null,
    modifier: Modifier = Modifier,
    keyboardType: KeyboardType = KeyboardType.Text,
    singleLine: Boolean = true,
    minLines: Int = 1,
    maxLines: Int = 1,
    masked: Boolean = false,
    errorText: String? = null,
    enabled: Boolean = true,
) {
    var revealed by remember { mutableStateOf(false) }
    val error = errorText
    // The field's own words, amber rather than red: amber is what this screen uses for "look here", and the code
    // field's border turns with it so the snackbar's message has somewhere to point after it goes (owner 2026-11-12).
    val supporting: (@Composable () -> Unit)? = if (error != null) {
        { Text(text = error, style = Type.bodySmall, color = Amber) }
    } else {
        null
    }
    val hintText = placeholder
    val hint: (@Composable () -> Unit)? = if (hintText != null) {
        { Text(text = hintText, style = Type.body, color = Soft) }
    } else {
        null
    }
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier.fillMaxWidth(),
        label = { Text(label, style = Type.bodySmall) },
        placeholder = hint,
        trailingIcon = if (masked) {
            {
                TextButton(
                    onClick = { revealed = !revealed },
                    contentPadding = PaddingValues(horizontal = 12.dp),
                ) {
                    Text(
                        text = stringResource(if (revealed) R.string.token_hide else R.string.token_show),
                        style = Type.micro,
                        color = Mint,
                    )
                }
            }
        } else {
            null
        },
        isError = error != null,
        supportingText = supporting,
        enabled = enabled,
        singleLine = singleLine,
        minLines = minLines,
        maxLines = maxLines,
        visualTransformation = if (masked && !revealed) {
            PasswordVisualTransformation()
        } else {
            VisualTransformation.None
        },
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(16.dp),
        textStyle = Type.field.copy(color = Color.White),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Color.White,
            unfocusedTextColor = Color.White.copy(alpha = 0.9f),
            focusedBorderColor = Mint.copy(alpha = 0.7f),
            unfocusedBorderColor = Color.White.copy(alpha = 0.12f),
            errorBorderColor = Amber.copy(alpha = 0.7f),
            errorLabelColor = Amber,
            errorCursorColor = Amber,
            errorContainerColor = Field,
            focusedLabelColor = Mint,
            unfocusedLabelColor = Soft,
            cursorColor = Mint,
            focusedContainerColor = Field,
            unfocusedContainerColor = Field,
            disabledTextColor = Color.White.copy(alpha = 0.55f),
            disabledBorderColor = Color.White.copy(alpha = 0.06f),
            disabledLabelColor = Faint,
            disabledContainerColor = Field,
        ),
    )
}

@Composable
private fun GoodToKnow(text: String) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    val shape = RoundedCornerShape(20.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Card)
            .border(1.dp, Hairline, shape)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = Icons.Filled.Info,
                contentDescription = null,
                tint = Soft,
                modifier = Modifier.size(15.dp),
            )
            Spacer(Modifier.width(7.dp))
            Text(
                text = stringResource(R.string.good_to_know).uppercase(),
                style = Type.section,
                color = Soft,
            )
        }
        Spacer(Modifier.height(9.dp))
        // A paragraph this long is a wall at the foot of the screen: three lines stay, the rest is one press away.
        Text(
            text = text,
            style = Type.bodySmall,
            color = Body,
            maxLines = if (expanded) Int.MAX_VALUE else 3,
            overflow = TextOverflow.Ellipsis,
        )
        TextButton(
            onClick = { expanded = !expanded },
            contentPadding = PaddingValues(horizontal = 0.dp, vertical = 6.dp),
        ) {
            Text(
                text = stringResource(if (expanded) R.string.good_to_know_less else R.string.good_to_know_more),
                style = Type.body.copy(fontWeight = FontWeight.SemiBold),
                color = Mint,
            )
        }
    }
}

@Composable
private fun AccessCard(
    access: PhoneAccess,
    onNotificationSettings: () -> Unit,
    onRequestPermissions: () -> Unit,
) {
    val shape = RoundedCornerShape(26.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Card)
            .border(1.dp, Hairline, shape),
    ) {
        // A grant counts as shared only when it is working: an allowed-but-dead listener is not the cab seeing
        // notifications, and the summary used to call it "all set".
        val grants = listOf(access.capturing, access.contacts, access.calls)
        val granted = grants.count { it }
        Column(Modifier.padding(start = 16.dp, top = 15.dp, end = 16.dp, bottom = 14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = stringResource(R.string.access_summary_title),
                    style = Type.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                    color = Soft,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    text = if (granted == 3) {
                        stringResource(R.string.access_all)
                    } else {
                        stringResource(R.string.access_count, granted)
                    },
                    style = Type.micro,
                    color = if (granted == 3) Mint else Soft,
                )
            }
            Spacer(Modifier.height(9.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                grants.forEach { on ->
                    Box(
                        Modifier
                            .weight(1f)
                            .height(3.dp)
                            .clip(CircleShape)
                            .background(if (on) Mint else Color.White.copy(alpha = 0.08f)),
                    )
                }
            }
        }
        HorizontalDivider(color = Hairline, modifier = Modifier.padding(horizontal = 16.dp))
        AccessRow(
            icon = Icons.Filled.Notifications,
            title = stringResource(R.string.access_notifications),
            detail = stringResource(
                when {
                    !access.notifications -> R.string.notifications_off_body
                    !access.listening -> R.string.notifications_waiting_row
                    else -> R.string.notifications_on_body
                },
            ),
            state = when {
                !access.notifications -> GrantState.Missing
                !access.listening -> GrantState.Waiting
                else -> GrantState.Granted
            },
            actionLabel = stringResource(
                if (access.notifications) R.string.repair else R.string.grant,
            ),
            onClick = if (access.capturing) null else onNotificationSettings,
        )
        HorizontalDivider(color = Hairline, modifier = Modifier.padding(horizontal = 16.dp))
        AccessRow(
            icon = Icons.Filled.Person,
            title = stringResource(R.string.access_contacts),
            detail = stringResource(
                if (access.contacts) R.string.contacts_on_body else R.string.contacts_off_body,
            ),
            state = if (access.contacts) GrantState.Granted else GrantState.Missing,
            actionLabel = stringResource(R.string.grant),
            onClick = if (access.contacts) null else onRequestPermissions,
        )
        HorizontalDivider(color = Hairline, modifier = Modifier.padding(horizontal = 16.dp))
        AccessRow(
            icon = Icons.Filled.Phone,
            title = stringResource(R.string.access_calls),
            detail = stringResource(
                when {
                    access.calls -> R.string.calls_on_body
                    access.callsPartial -> R.string.calls_partial_body
                    else -> R.string.calls_off_body
                },
            ),
            state = if (access.calls) GrantState.Granted else GrantState.Missing,
            actionLabel = stringResource(R.string.grant),
            onClick = if (access.calls) null else onRequestPermissions,
        )
    }
}

@Composable
private fun AccessRow(
    icon: ImageVector,
    title: String,
    detail: String,
    state: GrantState,
    actionLabel: String,
    onClick: (() -> Unit)?,
) {
    val tint = when (state) {
        GrantState.Granted -> Mint
        GrantState.Waiting -> Amber
        GrantState.Missing -> Color.White.copy(alpha = 0.55f)
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(42.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(if (state == GrantState.Missing) Color.White.copy(alpha = 0.05f) else tint.copy(alpha = 0.10f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = tint,
                modifier = Modifier.size(20.dp),
            )
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = Type.rowTitle, color = Color.White)
            Spacer(Modifier.height(2.dp))
            Text(
                text = detail,
                style = Type.bodySmall,
                color = Soft,
            )
        }
        Spacer(Modifier.width(10.dp))
        when (state) {
            GrantState.Granted -> Icon(
                imageVector = Icons.Filled.CheckCircle,
                contentDescription = stringResource(R.string.granted),
                tint = Mint,
                modifier = Modifier.size(17.dp),
            )
            GrantState.Waiting -> ActionChip(actionLabel, Amber)
            GrantState.Missing -> ActionChip(actionLabel, Mint)
        }
    }
}

/** A small rounded word on a wash of the tone it stands for: the row's one press, and what it is for. */
@Composable
private fun ActionChip(label: String, color: Color) {
    Box(
        modifier = Modifier
            .clip(CircleShape)
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 12.dp, vertical = 7.dp),
    ) {
        Text(
            text = label,
            style = Type.micro,
            color = color,
        )
    }
}

private fun stateColor(state: LinkState): Color = when (state) {
    LinkState.Live -> Mint
    LinkState.Working -> Amber
    LinkState.Idle -> Color(0xFF8E8E93)
}

/*
 * The screen's cards, state by state, in Android Studio's preview pane: a live link, a listener that is allowed but
 * dead, a phone with nothing allowed. Each of those used to need the phone in hand and the failure to happen at the
 * right moment, which is how a wrong "notifications appear in the cab" went unseen for so long.
 */
@Composable
private fun PreviewFrame(content: @Composable () -> Unit) {
    BridgeTheme {
        Surface(color = Ink) {
            Column(Modifier.fillMaxWidth().padding(20.dp)) { content() }
        }
    }
}

@Preview(name = "Link live", widthDp = 400, showBackground = true, backgroundColor = 0xFF000000)
@Composable
private fun StatusCardLivePreview() {
    PreviewFrame {
        StatusCard(
            status = "Connected to 192.168.1.20",
            state = LinkState.Live,
            host = "192.168.1.20",
            port = "47654",
        )
    }
}

@Preview(name = "Link idle", widthDp = 400, showBackground = true, backgroundColor = 0xFF000000)
@Composable
private fun StatusCardIdlePreview() {
    PreviewFrame { StatusCard(status = "", state = LinkState.Idle, host = "", port = "") }
}

@Preview(name = "Access, nothing allowed", widthDp = 400, showBackground = true, backgroundColor = 0xFF000000)
@Composable
private fun AccessCardEmptyPreview() {
    PreviewFrame {
        AccessCard(access = PhoneAccess(), onNotificationSettings = {}, onRequestPermissions = {})
    }
}

@Preview(name = "Access, notifications allowed but dead", widthDp = 400, showBackground = true, backgroundColor = 0xFF000000)
@Composable
private fun AccessCardWaitingPreview() {
    PreviewFrame {
        AccessCard(
            access = PhoneAccess(notifications = true, contacts = true, phone = true, answer = true),
            onNotificationSettings = {},
            onRequestPermissions = {},
        )
    }
}

@Preview(name = "Access, all set", widthDp = 400, showBackground = true, backgroundColor = 0xFF000000)
@Composable
private fun AccessCardAllPreview() {
    PreviewFrame {
        AccessCard(
            access = PhoneAccess(
                notifications = true,
                listening = true,
                contacts = true,
                phone = true,
                answer = true,
            ),
            onNotificationSettings = {},
            onRequestPermissions = {},
        )
    }
}

@Preview(name = "Notifications warning", widthDp = 400, showBackground = true, backgroundColor = 0xFF000000)
@Composable
private fun NotificationWarningPreview() {
    PreviewFrame {
        NotificationWarning(
            title = "Notifications aren’t arriving",
            body = "Access is allowed, but Android isn’t running the bridge’s listener.",
            onOpenSettings = {},
            onAppInfo = null,
        )
    }
}

@Preview(name = "Pairing, disconnected", widthDp = 400, showBackground = true, backgroundColor = 0xFF000000)
@Composable
private fun PairingCardPreview() {
    PreviewFrame {
        PairingCard(
            host = "192.168.1.20",
            port = "47654",
            token = "Zk3l0Qx9Tf2aB7mn",
            line = "",
            lineOpen = false,
            connected = false,
            codeError = null,
            onHost = {},
            onPort = {},
            onToken = {},
            onLine = {},
            onToggleLine = {},
            onUseLine = {},
            onConnect = {},
            onDisconnect = {},
            onScan = {},
        )
    }
}

@Preview(name = "Pairing, bad code", widthDp = 400, showBackground = true, backgroundColor = 0xFF000000)
@Composable
private fun PairingCardBadCodePreview() {
    PreviewFrame {
        PairingCard(
            host = "192.168.1.20",
            port = "47654",
            token = "Zk3l Qx9Tf",
            line = "",
            lineOpen = false,
            connected = false,
            codeError = "The code is 8–128 letters, digits, - or _, with no spaces.",
            onHost = {},
            onPort = {},
            onToken = {},
            onLine = {},
            onToggleLine = {},
            onUseLine = {},
            onConnect = {},
            onDisconnect = {},
            onScan = {},
        )
    }
}

@Preview(name = "Diagnostics", widthDp = 400, showBackground = true, backgroundColor = 0xFF000000)
@Composable
private fun DiagnosticsCardPreview() {
    PreviewFrame {
        DiagnosticsCard(
            phase = LinkPhase.Idle,
            access = PhoneAccess(notifications = true),
            lastError = "Can’t reach the PC: failed to connect to /192.168.1.20 (port 47654)",
            onCopied = {},
        )
    }
}

@Preview(name = "Settings", widthDp = 400, showBackground = true, backgroundColor = 0xFF000000)
@Composable
private fun SettingsCardPreview() {
    PreviewFrame {
        SettingsCard(
            hideContent = false,
            batteryExempt = false,
            pairingSaved = true,
            onHideContent = {},
            onBatteryOptimization = {},
            onForget = {},
        )
    }
}
