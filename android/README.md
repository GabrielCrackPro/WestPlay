# Cabin Play Bridge (Android)

The phone side of Cabin Play's Phone app: it keeps a WebSocket to the PC's host and sends the phone's
notifications, contacts, battery and call state, so the cab can show and dismiss them and dial a contact.
See `../phone_plan.md` for the whole plan and the protocol.

It connects, pairs, forwards the phone's state, and answers `sync`, `dismiss`, `action`, `dial`, `answer`,
`end` and `reply`. The cabin side matches a ringing call to the dialer's own notification for the caller's
name, and can press a notification's buttons or type a reply. SMS and call audio are later phases.

## Build

Requires JDK 17 and the Android SDK (platform 35, build tools 35). The Gradle wrapper is checked in, so a
local Gradle install is not needed.

```sh
cd android
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

On Windows use `gradlew.bat`. The debug APK has been built with the wrapper (Gradle 8.11.1, AGP 8.7.3,
Kotlin 2.0.21).

## Pair

1. In the Cabin Play window on the PC, open **Setup › Phone**. While no phone is connected it shows an
   address (`192.168.x.x:47654`), a code, and the same line as a QR code.
2. In Cabin Play Bridge, scan the code or enter the address and code (or paste the `cabinplay://pair?...`
   line) and press **Connect**. The foreground service keeps the link while the phone sleeps. To forget the
   phone again, press **Unpair Phone** in that same Setup group.
3. Grant **Notification access** when asked; the app opens that screen directly (on HyperOS it is
   Settings › Privacy protection › Special permissions › Notification access, and on Android 11+ the app
   asks for its own page first). Android 13+ sideloaded apps may need **Allow restricted settings** before
   the toggle works — App info › ⋮ › Allow restricted settings on stock Android, or App info › Advanced
   settings on HyperOS — because a sideloaded app's notification toggle is greyed out until then.
4. Press **Permissions** to grant contacts, phone state, the call log and call control. The Phone app's
   Contacts, Recents and call banner fill in only after those grants.

If the screen says **Notifications aren’t arriving**, the access is granted but Android has dropped the listener
(it also does this on an app update, after a force-stop, and in some OEMs’ background clean-up). Bridge asks for the
binding again whenever the screen opens and every minute the link is up, so reopening the app is enough in most
cases; if the warning stays, switch the app off and on again in **Notification access**.

If the bridge says **Can’t reach the PC**, check Windows Defender Firewall first: the PC's door is ordinary
traffic on port 47654, and Windows often classes a home Wi-Fi as *public*, where it blocks that port without
asking. Allow Cabin Play (or port 47654) for the network you are on. The phone and the PC also have to be on the
same network, with no guest-network client isolation between them.

The token is kept in the app's private preferences. The PC's host keeps the same token in
`phone-pairing.txt` in Cabin Play's data folder; deleting either one makes a new pairing.

## What it does not do yet

- **No call audio.** Android does not let third-party apps capture or inject cellular call audio. The cab can
  answer, decline and end, but the voice stays on the phone (or a Bluetooth hands-free link).
- No SMS, media control or Bluetooth audio from the cab. Notification replies are supported.
- **Caller ID depends on the dialer's notification.** The banner takes the name and number from it, matched to
  the address book, because the link's own call message carries neither on Android 12+. Without that
  notification there is no name to show, and the call log's names are whatever Android has cached.
- Dialing opens the phone's own dialer; recent Android may refuse that from a background service.
- The link is token-gated and private-network-only, not encrypted. Use it on a trusted home network; TLS with
  certificate pinning is a later step. If the phone can't reach the PC, allow Cabin Play through **Windows
  Firewall** on **private** networks and check both are on the same Wi-Fi (a VPN or guest network can isolate
  clients).
- Notification text is sensitive. **Hide notification content** keeps titles and text on the phone, so the cab
  sees only the app name and the notification's buttons — and loses the dialer's name for a caller too.
- The keep-alive notification in the status bar shows the link's state and carries **Reconnect** and
  **Disconnect**; it stays silent. The Quick Settings tile connects or disconnects in one tap, and a paired
  phone reconnects by itself after a reboot or a network change.
- The link reads the call log but never writes to it.

## Files

- `app/src/main/java/com/cabinplay/bridge/MainActivity.kt` — hosts the screen and owns pairing/permission state.
- `.../BridgeScreen.kt` — the Compose screen: AMOLED theme, status hero, pairing and access cards.
- `.../QrScanActivity.kt` — the pairing card's QR scanner (the barcode library's capture screen).
- `.../LinkService.kt` — foreground service, reconnection and the battery updates.
- `.../BootReceiver.kt` — starts a paired link again after a reboot.
- `.../LinkTileService.kt` — the Quick Settings tile that connects or disconnects the link.
- `.../PhoneLink.kt` — the WebSocket, the JSON protocol and the commands.
- `.../PhoneHub.kt` — what the notification listener collects, and what the link sends.
- `.../NotificationListener.kt` — Android's notification listener.
- `.../Contacts.kt` — the address book snapshot (`READ_CONTACTS`).
- `.../Recents.kt` — the call log snapshot (`READ_CALL_LOG`), the newest 60 calls.
- `.../CallMonitor.kt` — call-state monitoring (`READ_PHONE_STATE`), for the cab's call banner.
