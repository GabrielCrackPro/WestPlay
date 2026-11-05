package com.cabinplay.bridge

import android.Manifest
import android.content.pm.PackageManager
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.AlertDialog
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.delay

/** The phone's grants, as the screen draws them. Calls need both the state and the control permission. */
data class PhoneAccess(
    val notifications: Boolean = false,
    val contacts: Boolean = false,
    val phone: Boolean = false,
    val answer: Boolean = false,
) {
    val calls: Boolean get() = phone && answer
    val callsPartial: Boolean get() = phone && !answer
}

private val Ink = Color(0xFF000000)
private val Card = Color(0xFF050505)
private val Field = Color(0xFF070707)
private val Mint = Color(0xFF8AF0C4)
private val Muted = Color(0xFF9A9A9F)
private val Hairline = Color(0x14FFFFFF)
private val Amber = Color(0xFFFFC46B)

private val Palette = darkColorScheme(
    primary = Mint,
    onPrimary = Ink,
    primaryContainer = Color(0xFF123326),
    onPrimaryContainer = Mint,
    secondary = Mint,
    onSecondary = Ink,
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

@Composable
fun BridgeScreen(
    status: String,
    phase: LinkPhase,
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
            } else {
                host = parsed.host
                port = parsed.port.toString()
                token = parsed.token
                lineOpen = false
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

    LaunchedEffect(notice) {
        if (notice != null) {
            delay(6_000)
            onNotice(null)
        }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = Ink) {
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

            if (notice != null) {
                Spacer(Modifier.height(14.dp))
                NoticeCard(notice) { onNotice(null) }
            }

            if (!access.notifications) {
                Spacer(Modifier.height(14.dp))
                NotificationWarning(onNotificationSettings)
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
                onToken = { token = it },
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
                        onNotice(context.getString(R.string.line_used))
                    }
                },
                onConnect = {
                    val number = port.trim().toIntOrNull()
                    if (host.isBlank() || number == null || number !in 1..65535 || token.isBlank()) {
                        onNotice(context.getString(R.string.bad_pairing))
                    } else {
                        onNotice(null)
                        onConnect(host.trim(), number, token.trim())
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
                pairingSaved = pairingSaved,
                onHideContent = onHideContent,
                onBatteryOptimization = onBatteryOptimization,
                onForget = onForget,
            )
        }
    }
}

@Composable
private fun SettingsCard(
    hideContent: Boolean,
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
        Row(
            modifier = Modifier.padding(start = 16.dp, top = 14.dp, end = 12.dp, bottom = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.hide_content),
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = stringResource(R.string.hide_content_body),
                    color = Color.White.copy(alpha = 0.4f),
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                )
            }
            Spacer(Modifier.width(12.dp))
            Switch(checked = hideContent, onCheckedChange = onHideContent)
        }
        HorizontalDivider(color = Hairline, modifier = Modifier.padding(horizontal = 16.dp))
        TextButton(
            onClick = onBatteryOptimization,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 13.dp),
        ) {
            Text(
                text = stringResource(R.string.battery_optimization),
                color = Color.White.copy(alpha = 0.78f),
                fontSize = 13.sp,
            )
            Spacer(Modifier.weight(1f))
            Text("›", color = Color.White.copy(alpha = 0.3f), fontSize = 18.sp)
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
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
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
                color = Color.White.copy(alpha = 0.4f),
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 2.sp,
            )
            Text(
                text = stringResource(R.string.brand_title),
                color = Color.White,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.5).sp,
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
                    color = color,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.8.sp,
                )
                Spacer(Modifier.weight(1f))
            }
            Spacer(Modifier.height(18.dp))
            Text(
                text = title,
                color = Color.White,
                fontSize = 30.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.6).sp,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = status.ifBlank { stringResource(R.string.disconnected) },
                color = Color.White.copy(alpha = 0.5f),
                fontSize = 13.sp,
                lineHeight = 19.sp,
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
                        color = Color.White.copy(alpha = 0.62f),
                        fontSize = 11.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.widthIn(max = 200.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text("·", color = Color.White.copy(alpha = 0.28f), fontSize = 11.sp)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = stringResource(R.string.local_network),
                        color = Color.White.copy(alpha = 0.38f),
                        fontSize = 11.sp,
                    )
                }
            }
        }
    }
}

@Composable
private fun PulsingDot(color: Color, pulse: Boolean) {
    val transition = rememberInfiniteTransition(label = "link")
    val glow by transition.animateFloat(
        initialValue = 0.12f,
        targetValue = 0.4f,
        animationSpec = infiniteRepeatable(tween(1_400), RepeatMode.Reverse),
        label = "glow",
    )
    Box(Modifier.size(18.dp), contentAlignment = Alignment.Center) {
        if (pulse) {
            Box(Modifier.size(18.dp).clip(CircleShape).background(color.copy(alpha = glow)))
        }
        Box(Modifier.size(7.dp).clip(CircleShape).background(color))
    }
}

@Composable
private fun NoticeCard(text: String, onDismiss: () -> Unit) {
    val shape = RoundedCornerShape(18.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Color(0xFF101012))
            .border(1.dp, Hairline, shape)
            .padding(start = 14.dp, top = 12.dp, bottom = 12.dp, end = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = text,
            color = Color.White.copy(alpha = 0.78f),
            fontSize = 13.sp,
            lineHeight = 18.sp,
            modifier = Modifier.weight(1f),
        )
        IconButton(onClick = onDismiss, modifier = Modifier.size(34.dp)) {
            Icon(Icons.Filled.Close, contentDescription = null, tint = Muted, modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
private fun NotificationWarning(onOpenSettings: () -> Unit) {
    val shape = RoundedCornerShape(22.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Amber.copy(alpha = 0.06f))
            .border(1.dp, Amber.copy(alpha = 0.22f), shape)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Warning, contentDescription = null, tint = Amber, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                text = stringResource(R.string.notifications_warning_title),
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
        Spacer(Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.notifications_warning_body),
            color = Color.White.copy(alpha = 0.5f),
            fontSize = 13.sp,
            lineHeight = 19.sp,
        )
        Spacer(Modifier.height(10.dp))
        TextButton(onClick = onOpenSettings, contentPadding = PaddingValues(0.dp)) {
            Text(
                text = stringResource(R.string.open_settings),
                color = Amber,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        color = Color.White.copy(alpha = 0.34f),
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.6.sp,
        modifier = Modifier.padding(start = 4.dp),
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
            color = Color.White,
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = stringResource(R.string.pairing_body),
            color = Color.White.copy(alpha = 0.42f),
            fontSize = 12.sp,
            lineHeight = 18.sp,
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
        BridgeField(
            value = token,
            onValueChange = onToken,
            label = stringResource(R.string.token),
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
                Text(stringResource(R.string.disconnect), fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
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
                Text(stringResource(R.string.connect), fontSize = 15.sp, fontWeight = FontWeight.Bold)
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
                    color = Color.White.copy(alpha = 0.82f),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
        if (connected) {
            Spacer(Modifier.height(4.dp))
            Text(
                text = stringResource(R.string.pairing_locked),
                color = Color.White.copy(alpha = 0.3f),
                fontSize = 12.sp,
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
                Text(stringResource(R.string.paste_line), color = Muted, fontSize = 13.sp)
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
                            color = Mint,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
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
    enabled: Boolean = true,
) {
    val hintText = placeholder
    val hint: (@Composable () -> Unit)? = if (hintText != null) {
        { Text(text = hintText, fontSize = 13.sp, color = Color.White.copy(alpha = 0.32f)) }
    } else {
        null
    }
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier.fillMaxWidth(),
        label = { Text(label, fontSize = 13.sp) },
        placeholder = hint,
        enabled = enabled,
        singleLine = singleLine,
        minLines = minLines,
        maxLines = maxLines,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(16.dp),
        textStyle = LocalTextStyle.current.copy(fontSize = 15.sp, color = Color.White),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Color.White,
            unfocusedTextColor = Color.White.copy(alpha = 0.9f),
            focusedBorderColor = Mint.copy(alpha = 0.7f),
            unfocusedBorderColor = Color.White.copy(alpha = 0.10f),
            focusedLabelColor = Mint,
            unfocusedLabelColor = Color.White.copy(alpha = 0.4f),
            cursorColor = Mint,
            focusedContainerColor = Field,
            unfocusedContainerColor = Field,
            disabledTextColor = Color.White.copy(alpha = 0.55f),
            disabledBorderColor = Color.White.copy(alpha = 0.06f),
            disabledLabelColor = Color.White.copy(alpha = 0.25f),
            disabledContainerColor = Field,
        ),
    )
}

@Composable
private fun GoodToKnow(text: String) {
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
                tint = Color.White.copy(alpha = 0.4f),
                modifier = Modifier.size(15.dp),
            )
            Spacer(Modifier.width(7.dp))
            Text(
                text = stringResource(R.string.good_to_know).uppercase(),
                color = Color.White.copy(alpha = 0.4f),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.4.sp,
            )
        }
        Spacer(Modifier.height(9.dp))
        Text(
            text = text,
            color = Color.White.copy(alpha = 0.38f),
            fontSize = 12.sp,
            lineHeight = 18.sp,
        )
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
        val grants = listOf(access.notifications, access.contacts, access.calls)
        val granted = grants.count { it }
        Column(Modifier.padding(start = 16.dp, top = 15.dp, end = 16.dp, bottom = 14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = stringResource(R.string.access_summary_title),
                    color = Color.White.copy(alpha = 0.62f),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    text = if (granted == 3) {
                        stringResource(R.string.access_all)
                    } else {
                        stringResource(R.string.access_count, granted)
                    },
                    color = if (granted == 3) Mint else Color.White.copy(alpha = 0.38f),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
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
                if (access.notifications) R.string.notifications_on_body else R.string.notifications_off_body,
            ),
            granted = access.notifications,
            onClick = if (access.notifications) null else onNotificationSettings,
        )
        HorizontalDivider(color = Hairline, modifier = Modifier.padding(horizontal = 16.dp))
        AccessRow(
            icon = Icons.Filled.Person,
            title = stringResource(R.string.access_contacts),
            detail = stringResource(
                if (access.contacts) R.string.contacts_on_body else R.string.contacts_off_body,
            ),
            granted = access.contacts,
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
            granted = access.calls,
            onClick = if (access.calls) null else onRequestPermissions,
        )
    }
}

@Composable
private fun AccessRow(
    icon: ImageVector,
    title: String,
    detail: String,
    granted: Boolean,
    onClick: (() -> Unit)?,
) {
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
                .background(if (granted) Mint.copy(alpha = 0.10f) else Color.White.copy(alpha = 0.05f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (granted) Mint else Color.White.copy(alpha = 0.55f),
                modifier = Modifier.size(20.dp),
            )
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(2.dp))
            Text(
                text = detail,
                color = Color.White.copy(alpha = 0.4f),
                fontSize = 12.sp,
                lineHeight = 17.sp,
            )
        }
        Spacer(Modifier.width(10.dp))
        if (granted) {
            Icon(
                imageVector = Icons.Filled.CheckCircle,
                contentDescription = null,
                tint = Mint,
                modifier = Modifier.size(17.dp),
            )
        } else {
            Box(
                modifier = Modifier
                    .clip(CircleShape)
                    .background(Mint.copy(alpha = 0.12f))
                    .padding(horizontal = 12.dp, vertical = 7.dp),
            ) {
                Text(
                    text = stringResource(R.string.grant),
                    color = Mint,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

private fun stateColor(state: LinkState): Color = when (state) {
    LinkState.Live -> Mint
    LinkState.Working -> Amber
    LinkState.Idle -> Color(0xFF8E8E93)
}
