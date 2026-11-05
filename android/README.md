# Cabin Play Bridge (Android)

The phone side of Cabin Play's Phone app: it keeps a WebSocket to the PC's host and sends the phone's
notifications, contacts, battery and call state, so the cab can show and dismiss them and dial a contact.
See `../phone_plan.md` for the whole plan and the protocol.

This is the first slice plus contacts, call state and the call log. It connects, pairs, forwards the phone's
state, and answers `sync`, `dismiss`, `dial`, `answer` and `end`. SMS and call audio are later phases.

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
3. Grant **Notification access** when asked. Android 13+ sideloaded apps may need **Allow restricted
   settings** in App info first.
4. Press **Permissions** to grant contacts, phone state, the call log and call control. The Phone app's
   Contacts, Recents and call banner fill in only after those grants.

If the bridge says **Can’t reach the PC**, check Windows Defender Firewall first: the PC's door is ordinary
traffic on port 47654, and Windows often classes a home Wi-Fi as *public*, where it blocks that port without
asking. Allow Cabin Play (or port 47654) for the network you are on. The phone and the PC also have to be on the
same network, with no guest-network client isolation between them.

The token is kept in the app's private preferences. The PC's host keeps the same token in
`phone-pairing.txt` in Cabin Play's data folder; deleting either one makes a new pairing.

## What it does not do yet

- **No call audio.** Android does not let third-party apps capture or inject cellular call audio. The cab can
  answer, decline and end, but the voice stays on the phone (or a Bluetooth hands-free link).
- No caller ID, SMS, replies or media control yet. Caller ID on the banner needs a `CallScreeningService`
  role or another mechanism; the call log's names are whatever Android has cached for the number.
- Dialing opens the phone's own dialer; recent Android may refuse that from a background service.
- The link is token-gated and private-network-only, not encrypted. Use it on a trusted home network; TLS with
  certificate pinning is a later step.
- Notification text is sensitive. A "hide content while driving" switch belongs beside this app before it
  ships.

## Files

- `app/src/main/java/com/cabinplay/bridge/MainActivity.kt` — pairing and permission screens.
- `.../LinkService.kt` — foreground service, reconnection and the battery updates.
- `.../PhoneLink.kt` — the WebSocket, the JSON protocol and the commands.
- `.../PhoneHub.kt` — what the notification listener collects, and what the link sends.
- `.../NotificationListener.kt` — Android's notification listener.
- `.../Contacts.kt` — the address book snapshot (`READ_CONTACTS`).
- `.../Recents.kt` — the call log snapshot (`READ_CALL_LOG`), the newest 60 calls.
- `.../CallMonitor.kt` — call-state monitoring (`READ_PHONE_STATE`), for the cab's call banner.
