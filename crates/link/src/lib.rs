//! Cabin Play's local link to the phone companion.
//!
//! The PC is the server: [`Server::open`] binds a port on the local network, makes a pairing token and
//! accepts one phone's WebSocket. The protocol is small ([`ClientMessage`], [`Command`]): the
//! phone sends notifications, contacts, calls and battery; the cab sends commands back.
//!
//! The cabin page never opens this socket itself. The host (`crates/host/src/phone.rs`) owns the server,
//! drains [`Update`]s into the page and passes the page's [`Command`]s back. The page is served from
//! `https://westplay.cabin/`, so a direct connection from it would be blocked as mixed content anyway.
//!
//! Scope of this first slice: the transport is token-gated and only accepts private-network peers, but it is
//! not encrypted yet. Keep it on a trusted home network until TLS with a pinned certificate lands
//! (`phone_plan.md`).

use std::io::ErrorKind;
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpListener, TcpStream, UdpSocket};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use base64::Engine as _;
use serde::{Deserialize, Serialize};
use tungstenite::Message;

/// The protocol version. A phone of another version is told so and disconnected.
pub const PROTOCOL: u32 = 1;

/// The port the phone connects to, unless it is taken.
pub const PORT: u16 = 47654;

/// The longest message accepted from a phone (a notification snapshot, or a big contact list). An address book of
/// the size the phone sends (2000 contacts) fits well inside it; a bigger frame than this is dropped on its own
/// rather than cutting the link.
const MOST_BYTES: usize = 2 * 1024 * 1024;

/// How long a new connection has to say hello.
const HELLO_TIMEOUT: Duration = Duration::from_secs(10);

/// How often a connected phone is asked whether it is still there, and how long it may say nothing before it is
/// taken to be gone. A phone whose Wi-Fi dropped, or that died, leaves its socket open: only its silence gives
/// it away, and without it the cab would keep claiming the phone is there (a sleeping phone may never close
/// the socket at all).
const PING_EVERY: Duration = Duration::from_secs(10);
const SILENCE: Duration = Duration::from_secs(30);

/// The heartbeat a connection is held to (`tests` use a faster one).
#[derive(Clone, Copy)]
struct Heartbeat {
    ping: Duration,
    silence: Duration,
}

const HEARTBEAT: Heartbeat = Heartbeat { ping: PING_EVERY, silence: SILENCE };

/// A paired phone.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub battery: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub charging: Option<bool>,
}

/// One notification, as Android's listener gives it.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Notification {
    /// Stable for the phone's notification: the package, its id and its post time.
    pub id: String,
    pub package: String,
    /// The app's own name, as the phone shows it.
    pub app: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    /// When it was posted (Unix seconds).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub time: Option<u64>,
    #[serde(default)]
    pub ongoing: bool,
    /// The notification's action labels ("Reply", "Mark as read", …).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub actions: Vec<String>,
}

/// One contact, as the phone's address book gives it.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Contact {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub numbers: Vec<String>,
    /// A `data:` URL of the contact's photo, when it has one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub photo: Option<String>,
}

/// A phone call, as the phone's telephony state gives it.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Call {
    pub id: String,
    pub state: CallState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// When it began ringing or was answered (Unix seconds).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at: Option<u64>,
}

/// One call in the phone's log, as Android's `CallLog` gives it.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recent {
    pub id: String,
    pub number: String,
    /// The name the phone has for that number, when it has one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default)]
    pub kind: RecentKind,
    /// When it came or was made (Unix seconds).
    #[serde(default)]
    pub time: u64,
    /// How long it lasted, in seconds (0 for one that never connected).
    #[serde(default)]
    pub duration: u64,
}

/// What the call was: one the phone took, one it made, one it missed, or one Android doesn't name.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecentKind {
    Incoming,
    Outgoing,
    Missed,
    #[default]
    Other,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CallState {
    #[default]
    Idle,
    Ringing,
    OffHook,
}

/// How the phone finds and trusts this PC.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pairing {
    pub host: String,
    pub port: u16,
    pub token: String,
    /// `cabinplay://pair?host=…&port=…&token=…`, for a QR code or a share sheet.
    pub uri: String,
}

impl Pairing {
    /// The WebSocket URL the phone connects to.
    pub fn url(&self) -> String {
        format!("ws://{}:{}/phone?token={}", self.host, self.port, self.token)
    }
}

/// What a phone says to the PC.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ClientMessage {
    Hello {
        protocol: u32,
        token: String,
        device: Device,
    },
    /// The full list, replacing what the PC had (sent on connect and on `sync`).
    Notifications {
        notifications: Vec<Notification>,
    },
    Notification {
        notification: Notification,
    },
    NotificationRemoved {
        id: String,
    },
    Contacts {
        contacts: Vec<Contact>,
    },
    /// The phone's call log, newest first.
    Recents {
        recents: Vec<Recent>,
    },
    Call {
        call: Call,
    },
    Battery {
        level: u8,
        charging: bool,
    },
    Ack {
        id: u64,
        ok: bool,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
}

/// What the cab asks of the phone.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "camelCase")]
pub enum Command {
    /// Send the current notifications and contacts again (the Phone app opened, or refreshed).
    Sync,
    Dismiss {
        id: String,
    },
    Dial {
        number: String,
    },
    Answer,
    End,
    Sms {
        number: String,
        body: String,
    },
    Reply {
        id: String,
        text: String,
    },
}

/// A change the host passes on to the cabin page.
#[derive(Clone, Debug, PartialEq)]
pub enum Update {
    Connected { device: Device, peer: String },
    Disconnected { peer: String },
    Notifications { notifications: Vec<Notification> },
    Notification { notification: Notification },
    NotificationRemoved { id: String },
    Contacts { contacts: Vec<Contact> },
    Recents { recents: Vec<Recent> },
    Call { call: Call },
    Battery { level: u8, charging: bool },
    /// The phone's answer to one of the cab's commands: whether it did it, and why not.
    Ack { id: u64, ok: bool, error: Option<String> },
}

/// The current connection: its id, its address, and the writer commands go through.
type Writer = (u64, String, Sender<String>);

/// The LAN door: open while Cabin Play runs.
pub struct Server {
    pairing: Pairing,
    /// The token a phone pairs with: each new connection is checked against it, and unpairing replaces it.
    token: Arc<Mutex<String>>,
    /// Where that token is kept, so the next launch takes it as it is.
    token_file: PathBuf,
    updates: Receiver<Update>,
    /// The same channel's sending end: unpairing tells the host that the phone it dropped is gone.
    reports: Sender<Update>,
    /// The current connection's writer: commands go to the phone through it, and nowhere without one.
    commands: Arc<Mutex<Option<Writer>>>,
    next_command: AtomicU64,
    stop: Arc<AtomicBool>,
}

impl Server {
    /// Opens the door on [`PORT`], or a port of this PC's choosing if that one is taken. The token lives in
    /// `token_file` when it can, so the phone is paired once rather than every launch.
    pub fn open(token_file: &Path) -> Option<Server> {
        let token = token_from(token_file);
        let listener = TcpListener::bind(("0.0.0.0", PORT)).or_else(|_| TcpListener::bind(("0.0.0.0", 0))).ok()?;
        listener.set_nonblocking(true).ok()?;
        let port = listener.local_addr().ok()?.port();
        let host = local_ipv4().map_or_else(|| "127.0.0.1".to_owned(), |ip| ip.to_string());
        let uri = format!("cabinplay://pair?host={host}&port={port}&token={token}");
        let pairing = Pairing { host, port, token, uri };
        let (tx, updates) = mpsc::channel();
        let commands = Arc::new(Mutex::new(None));
        let stop = Arc::new(AtomicBool::new(false));
        let connections = Arc::new(AtomicU64::new(0));
        let token = Arc::new(Mutex::new(pairing.token.clone()));
        let accept = Accept {
            listener,
            token: token.clone(),
            updates: tx.clone(),
            commands: commands.clone(),
            stop: stop.clone(),
            connections,
        };
        thread::spawn(move || accept.run());
        Some(Server {
            pairing,
            token,
            token_file: token_file.to_path_buf(),
            updates,
            reports: tx,
            commands,
            next_command: AtomicU64::new(0),
            stop,
        })
    }

    pub fn pairing(&self) -> &Pairing {
        &self.pairing
    }

    /// Forgets the phone: a new token replaces the old one (and is kept in the token file), so the phone that
    /// paired has to pair again; a phone connected now is dropped with it.
    pub fn unpair(&mut self) {
        let token = new_token();
        let _ = std::fs::write(&self.token_file, &token);
        self.pairing.token.clone_from(&token);
        self.pairing.uri =
            format!("cabinplay://pair?host={}&port={}&token={token}", self.pairing.host, self.pairing.port);
        *self.token.lock().unwrap_or_else(|e| e.into_inner()) = token;
        // The phone connected now: its token no longer opens the door, and its own thread lets the socket go once
        // it sees the door is another's.
        let dropped = self.commands.lock().unwrap_or_else(|e| e.into_inner()).take();
        if let Some((_, peer, _)) = dropped {
            let _ = self.reports.send(Update::Disconnected { peer });
        }
    }

    /// The next change from the phone, if any (the host calls this every turn).
    pub fn try_next(&self) -> Option<Update> {
        self.updates.try_recv().ok()
    }

    /// Sends a command to the phone. Returns whether a phone is connected to take it.
    pub fn command(&self, command: &Command) -> bool {
        let id = self.next_command.fetch_add(1, Ordering::Relaxed) + 1;
        let message = serde_json::json!({ "type": "command", "id": id, "command": command }).to_string();
        let sender = self.commands.lock().unwrap_or_else(|e| e.into_inner()).as_ref().map(|(_, _, tx)| tx.clone());
        sender.is_some_and(|tx| tx.send(message).is_ok())
    }

    /// Whether a phone is connected right now.
    pub fn connected(&self) -> bool {
        self.commands.lock().unwrap_or_else(|e| e.into_inner()).is_some()
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
    }
}

/// The token kept in `token_file`, or a new one written there. A file that can't be read or written still
/// leaves a token for this run.
fn token_from(token_file: &Path) -> String {
    if let Ok(saved) = std::fs::read_to_string(token_file) {
        let saved = saved.trim();
        if (8..=128).contains(&saved.len()) && saved.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        {
            return saved.to_owned();
        }
    }
    let token = new_token();
    let _ = std::fs::write(token_file, &token);
    token
}

fn new_token() -> String {
    let mut bytes = [0u8; 12];
    let _ = getrandom::fill(&mut bytes);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

/// The accept loop, on a thread of its own: one phone at a time, each connection to its own handler.
struct Accept {
    listener: TcpListener,
    /// The door's token as it is now: unpairing the phone replaces it while this loop runs.
    token: Arc<Mutex<String>>,
    updates: Sender<Update>,
    commands: Arc<Mutex<Option<Writer>>>,
    stop: Arc<AtomicBool>,
    connections: Arc<AtomicU64>,
}

impl Accept {
    fn run(self) {
        while !self.stop.load(Ordering::Acquire) {
            match self.listener.accept() {
                Ok((stream, peer)) => {
                    if !allowed(peer) {
                        let _ = stream.set_nonblocking(false);
                        drop(stream);
                        continue;
                    }
                    let id = self.connections.fetch_add(1, Ordering::Relaxed) + 1;
                    let token = self.token.clone();
                    let updates = self.updates.clone();
                    let commands = self.commands.clone();
                    let stop = self.stop.clone();
                    thread::spawn(move || {
                        let _ = stream.set_nonblocking(false);
                        let _ = stream.set_nodelay(true);
                        handle(stream, peer, id, &token, &updates, &commands, &stop, HEARTBEAT);
                    });
                }
                Err(e) if e.kind() == ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(100)),
                Err(_) => break,
            }
        }
    }
}

/// Handles one phone: its handshake, then its messages until it goes.
fn handle(
    stream: TcpStream,
    peer: SocketAddr,
    id: u64,
    token: &Mutex<String>,
    updates: &Sender<Update>,
    commands: &Mutex<Option<Writer>>,
    stop: &AtomicBool,
    heartbeat: Heartbeat,
) {
    let _ = stream.set_read_timeout(Some(HELLO_TIMEOUT));
    let _ = stream.set_write_timeout(Some(HELLO_TIMEOUT));
    let mut socket = match tungstenite::accept(stream) {
        Ok(socket) => socket,
        Err(_) => return,
    };
    // The token as it is as this phone says hello (the lock isn't held through the read: unpairing mustn't wait).
    let expected = token.lock().unwrap_or_else(|e| e.into_inner()).clone();
    let device = match hello(&mut socket, &expected) {
        Some(device) => device,
        None => {
            let _ = socket.close(None);
            return;
        }
    };
    let _ = socket.send(Message::text(format!("{{\"type\":\"welcome\",\"protocol\":{PROTOCOL}}}")));
    let (tx, rx) = mpsc::channel::<String>();
    *commands.lock().unwrap_or_else(|e| e.into_inner()) = Some((id, peer.to_string(), tx));
    let _ = updates.send(Update::Connected { device, peer: peer.to_string() });
    let _ = socket.get_ref().set_read_timeout(Some(Duration::from_millis(100)));
    // When the phone was last heard from, and when it was last asked whether it is still there.
    let mut heard = Instant::now();
    let mut pinged = Instant::now();

    while !stop.load(Ordering::Acquire) {
        // Another phone took the door, or the player unpaired: this connection has nothing more to say.
        let ours = commands.lock().unwrap_or_else(|e| e.into_inner()).as_ref().is_some_and(|(each, _, _)| *each == id);
        if !ours {
            break;
        }
        // Nothing of the phone for too long: its Wi-Fi went and the socket never said so. Let it go, so the
        // cab's Phone app stops saying it is there within seconds of the phone leaving.
        if heard.elapsed() >= heartbeat.silence {
            break;
        }
        while let Ok(message) = rx.try_recv() {
            if socket.send(Message::text(message)).is_err() {
                break;
            }
        }
        // Ask it whether it is still there: a phone that can't answer is gone, and its socket is never read
        // again before its silence runs out.
        if pinged.elapsed() >= heartbeat.ping {
            pinged = Instant::now();
            if socket.send(Message::Ping(Vec::<u8>::new().into())).is_err() {
                break;
            }
        }
        let read = socket.read();
        // Anything at all of the phone, a pong to that ping included, is the phone saying it is still there.
        if read.is_ok() {
            heard = Instant::now();
        }
        match read {
            Ok(Message::Text(text)) => {
                if text.len() > MOST_BYTES {
                    // Nobody's message is this big: it is dropped, and the link stays up (a phone that sent one
                    // shouldn't lose its whole connection over it).
                    continue;
                }
                match serde_json::from_str::<ClientMessage>(&text) {
                    Ok(ClientMessage::Hello { .. }) => {}
                    Ok(message) => {
                        if let Some(update) = update_of(message) {
                            let _ = updates.send(update);
                        }
                    }
                    Err(_) => {}
                }
            }
            Ok(Message::Ping(payload)) => {
                let _ = socket.send(Message::Pong(payload));
            }
            Ok(Message::Close(_)) | Err(tungstenite::Error::ConnectionClosed) => break,
            Ok(_) => {}
            Err(tungstenite::Error::Io(e)) if matches!(e.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut) => {}
            Err(_) => break,
        }
    }

    let mut current = commands.lock().unwrap_or_else(|e| e.into_inner());
    if current.as_ref().is_some_and(|(each, _, _)| *each == id) {
        *current = None;
        drop(current);
        let _ = updates.send(Update::Disconnected { peer: peer.to_string() });
    }
    let _ = socket.close(None);
}

/// Reads the phone's hello and checks its protocol and token.
fn hello(socket: &mut tungstenite::WebSocket<TcpStream>, token: &str) -> Option<Device> {
    match socket.read().ok()? {
        Message::Text(text) => match serde_json::from_str::<ClientMessage>(&text) {
            Ok(ClientMessage::Hello { protocol, token: said, device }) if protocol == PROTOCOL && said == token => {
                Some(device)
            }
            _ => None,
        },
        _ => None,
    }
}

/// The host update a phone message means (`Hello` and `Ack` are handled elsewhere).
fn update_of(message: ClientMessage) -> Option<Update> {
    match message {
        ClientMessage::Notifications { notifications } => Some(Update::Notifications { notifications }),
        ClientMessage::Notification { notification } => Some(Update::Notification { notification }),
        ClientMessage::NotificationRemoved { id } => Some(Update::NotificationRemoved { id }),
        ClientMessage::Contacts { contacts } => Some(Update::Contacts { contacts }),
        ClientMessage::Recents { recents } => Some(Update::Recents { recents }),
        ClientMessage::Call { call } => Some(Update::Call { call }),
        ClientMessage::Battery { level, charging } => Some(Update::Battery { level, charging }),
        ClientMessage::Ack { id, ok, error } => Some(Update::Ack { id, ok, error }),
        ClientMessage::Hello { .. } => None,
    }
}

/// Whether a peer may connect: this PC, or a private/local network address.
fn allowed(peer: SocketAddr) -> bool {
    match peer.ip() {
        IpAddr::V4(ip) => ip.is_loopback() || ip.is_private() || ip.is_link_local(),
        // Android usually reaches the PC over IPv4; IPv6 local ranges are a later addition.
        IpAddr::V6(ip) => ip.is_loopback(),
    }
}

/// This PC's IPv4 address on the network its default route uses, if any.
fn local_ipv4() -> Option<Ipv4Addr> {
    let socket = UdpSocket::bind(("0.0.0.0", 0)).ok()?;
    // Connecting a UDP socket sends nothing: it asks Windows which interface the route uses.
    socket.connect(("8.8.8.8", 80)).ok()?;
    match socket.local_addr().ok()?.ip() {
        IpAddr::V4(ip) => Some(ip),
        IpAddr::V6(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        Call, CallState, ClientMessage, Command, Device, Notification, Pairing, Recent, RecentKind, Server, Update,
        allowed, new_token, update_of,
    };
    use std::net::SocketAddr;
    use std::time::{Duration, Instant};

    use tungstenite::{Message, stream::MaybeTlsStream};

    #[test]
    fn tokens_are_random_and_url_safe() {
        let one = new_token();
        let two = new_token();
        assert_eq!(one.len(), 16);
        assert_ne!(one, two);
        assert!(one.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
    }

    #[test]
    fn pairing_urls_carry_the_token() {
        let pairing = Pairing {
            host: "192.168.1.20".into(),
            port: 47654,
            token: "abc_DEF-12345678".into(),
            uri: "cabinplay://pair?host=192.168.1.20&port=47654&token=abc_DEF-12345678".into(),
        };
        assert_eq!(pairing.url(), "ws://192.168.1.20:47654/phone?token=abc_DEF-12345678");
    }

    #[test]
    fn commands_keep_their_action_for_the_phone() {
        let dismiss = Command::Dismiss { id: "app|1|2".into() };
        assert_eq!(serde_json::to_string(&dismiss).unwrap(), r#"{"action":"dismiss","id":"app|1|2"}"#);
        assert_eq!(serde_json::to_string(&Command::Answer).unwrap(), r#"{"action":"answer"}"#);
        assert_eq!(
            serde_json::from_str::<Command>(r#"{"action":"dial","number":"+441234567890"}"#).unwrap(),
            Command::Dial { number: "+441234567890".into() }
        );
    }

    #[test]
    fn messages_from_the_phone_are_read_as_the_host_wants_them() {
        let text = r#"{"type":"notification","notification":{"id":"a|1|2","package":"com.app","app":"App","title":"Hi","text":"There","ongoing":false,"actions":["Reply"]}}"#;
        let message: ClientMessage = serde_json::from_str(text).unwrap();
        let update = update_of(message).unwrap();
        assert!(
            matches!(update, super::Update::Notification { notification } if notification.title.as_deref() == Some("Hi"))
        );

        let text =
            r#"{"type":"call","call":{"id":"1","state":"ringing","number":"+441234567890","startedAt":1700000000}}"#;
        let message: ClientMessage = serde_json::from_str(text).unwrap();
        assert_eq!(
            update_of(message),
            Some(super::Update::Call {
                call: Call {
                    id: "1".into(),
                    state: CallState::Ringing,
                    number: Some("+441234567890".into()),
                    name: None,
                    started_at: Some(1_700_000_000),
                }
            })
        );
    }

    #[test]
    fn the_call_log_is_read_with_its_kinds() {
        let text = r#"{"type":"recents","recents":[{"id":"7","number":"+441234567890","name":"Ada","kind":"missed","time":1700000000,"duration":0},{"id":"8","number":"555","kind":"outgoing","time":1700000100,"duration":42}]}"#;
        let message: ClientMessage = serde_json::from_str(text).unwrap();
        assert_eq!(
            update_of(message),
            Some(super::Update::Recents {
                recents: vec![
                    Recent {
                        id: "7".into(),
                        number: "+441234567890".into(),
                        name: Some("Ada".into()),
                        kind: RecentKind::Missed,
                        time: 1_700_000_000,
                        duration: 0,
                    },
                    Recent {
                        id: "8".into(),
                        number: "555".into(),
                        name: None,
                        kind: RecentKind::Outgoing,
                        time: 1_700_000_100,
                        duration: 42,
                    },
                ]
            })
        );
    }

    #[test]
    fn a_hello_carries_the_device() {
        let text =
            r#"{"type":"hello","protocol":1,"token":"t","device":{"name":"Pixel 8","battery":87,"charging":true}}"#;
        let message: ClientMessage = serde_json::from_str(text).unwrap();
        assert_eq!(
            message,
            ClientMessage::Hello {
                protocol: 1,
                token: "t".into(),
                device: Device { name: "Pixel 8".into(), model: None, battery: Some(87), charging: Some(true) }
            }
        );
        assert!(update_of(message).is_none());
    }

    /// A command the phone couldn't do comes back as its own update, so the cab can say so.
    #[test]
    fn a_command_the_phone_could_not_do_is_heard() {
        let text = r#"{"type":"ack","id":7,"ok":false,"error":"The dialer couldn’t be opened"}"#;
        let message: ClientMessage = serde_json::from_str(text).unwrap();
        assert_eq!(
            update_of(message),
            Some(super::Update::Ack {
                id: 7,
                ok: false,
                error: Some("The dialer couldn’t be opened".into()),
            })
        );

        let text = r#"{"type":"ack","id":8,"ok":true}"#;
        let message: ClientMessage = serde_json::from_str(text).unwrap();
        assert_eq!(update_of(message), Some(super::Update::Ack { id: 8, ok: true, error: None }));
    }

    #[test]
    fn notifications_and_contacts_are_optional_where_android_is() {
        let notification: Notification = serde_json::from_str(r#"{"id":"1","package":"p","app":"A"}"#).unwrap();
        assert_eq!(notification.title, None);
        assert!(!notification.ongoing);
        assert!(notification.actions.is_empty());
    }

    #[test]
    fn only_this_pc_and_the_local_network_may_connect() {
        let at = |address: &str| address.parse::<SocketAddr>().unwrap();
        assert!(allowed(at("127.0.0.1:5000")));
        assert!(allowed(at("192.168.1.44:5000")));
        assert!(allowed(at("10.0.0.7:5000")));
        assert!(allowed(at("172.16.4.2:5000")));
        assert!(!allowed(at("8.8.8.8:5000")));
        assert!(!allowed(at("[2001:4860:4860::8888]:5000")));
    }

    /// A paired phone connects, says what it has, and gets the cab's command back.
    #[test]
    fn a_paired_phone_talks_to_the_host() {
        let token_file = std::env::temp_dir().join(format!("westplay-link-{}.txt", new_token()));
        let server = Server::open(&token_file).expect("the door opens");
        let pairing = server.pairing().clone();
        let (mut socket, _) =
            tungstenite::connect(format!("ws://127.0.0.1:{}/phone?token={}", pairing.port, pairing.token))
                .expect("the phone connects");
        if let MaybeTlsStream::Plain(stream) = socket.get_ref() {
            stream.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        }

        socket
            .send(Message::text(
                serde_json::json!({
                    "type": "hello",
                    "protocol": super::PROTOCOL,
                    "token": pairing.token,
                    "device": {"name": "Pixel 8", "battery": 87, "charging": true},
                })
                .to_string(),
            ))
            .unwrap();
        let welcome = socket.read().expect("the hello is answered");
        assert!(welcome.to_text().unwrap().contains("welcome"));

        assert!(matches!(
            next(&server),
            Some(Update::Connected { device, .. }) if device.name == "Pixel 8" && device.battery == Some(87)
        ));

        socket
            .send(Message::text(
                serde_json::json!({
                    "type": "notification",
                    "notification": {"id": "app|1|2", "package": "com.app", "app": "App", "title": "Hi"},
                })
                .to_string(),
            ))
            .unwrap();
        assert!(matches!(
            next(&server),
            Some(Update::Notification { notification }) if notification.id == "app|1|2"
        ));

        assert!(server.command(&Command::Dismiss { id: "app|1|2".into() }));
        let command = socket.read().expect("the phone is told");
        let command: serde_json::Value = serde_json::from_str(command.to_text().unwrap()).unwrap();
        assert_eq!(command["type"], "command");
        assert_eq!(command["id"], 1);
        assert_eq!(command["command"]["action"], "dismiss");
        assert_eq!(command["command"]["id"], "app|1|2");

        socket.close(None).unwrap();
        drop(server);
        let _ = std::fs::remove_file(token_file);
    }

    /// A phone with the wrong token is disconnected before it can say anything.
    #[test]
    fn an_unpaired_phone_is_turned_away() {
        let token_file = std::env::temp_dir().join(format!("westplay-link-{}.txt", new_token()));
        let server = Server::open(&token_file).expect("the door opens");
        let pairing = server.pairing().clone();
        let (mut socket, _) = tungstenite::connect(format!("ws://127.0.0.1:{}/phone?token=wrong", pairing.port))
            .expect("the socket opens");
        if let MaybeTlsStream::Plain(stream) = socket.get_ref() {
            stream.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        }
        socket
            .send(Message::text(
                serde_json::json!({
                    "type": "hello",
                    "protocol": super::PROTOCOL,
                    "token": "wrong",
                    "device": {"name": "Not the phone"},
                })
                .to_string(),
            ))
            .unwrap();
        match socket.read() {
            Ok(Message::Close(_)) | Err(_) => {}
            Ok(other) => panic!("expected the socket to close, got {other:?}"),
        }
        std::thread::sleep(Duration::from_millis(300));
        assert!(server.try_next().is_none(), "the wrong token never counts as a phone");

        drop(server);
        let _ = std::fs::remove_file(token_file);
    }

    /// The Setup's unpair: a new token, kept for the next launch, so the phone that paired is turned away.
    #[test]
    fn unpairing_replaces_the_token_and_the_phone_with_it() {
        let token_file = std::env::temp_dir().join(format!("westplay-link-{}.txt", new_token()));
        let mut server = Server::open(&token_file).expect("the door opens");
        let before = server.pairing().clone();
        server.unpair();
        let after = server.pairing().clone();
        assert_ne!(after.token, before.token, "the old token no longer opens the door");
        assert_eq!((after.host.clone(), after.port), (before.host, before.port), "the same door, with a new key");
        assert!(after.uri.ends_with(&after.token));
        assert_eq!(
            std::fs::read_to_string(&token_file).expect("the token is kept").trim(),
            after.token,
            "a new launch pairs with it"
        );
        assert!(!server.connected(), "nothing is connected to be dropped");
        drop(server);
        let _ = std::fs::remove_file(token_file);
    }

    /// A phone whose Wi-Fi goes says nothing more and answers no ping: its silence is what lets it go, so the
    /// cab and the Setup stop saying it is connected.
    #[test]
    fn a_silent_phone_is_let_go() {
        use std::net::TcpListener;
        use std::sync::atomic::AtomicBool;
        use std::sync::{mpsc, Arc, Mutex};

        let listener = TcpListener::bind(("127.0.0.1", 0)).expect("a door for the test");
        let at = listener.local_addr().unwrap();
        let heartbeat = super::Heartbeat {
            ping: Duration::from_millis(40),
            silence: Duration::from_millis(300),
        };

        let phone = std::thread::spawn(move || {
            let (mut socket, _) =
                tungstenite::connect(format!("ws://{at}/phone?token=t")).expect("the phone connects");
            socket
                .send(Message::text(
                    serde_json::json!({
                        "type": "hello",
                        "protocol": super::PROTOCOL,
                        "token": "t",
                        "device": {"name": "Pixel 8"},
                    })
                    .to_string(),
                ))
                .unwrap();
            let welcome = socket.read().expect("the hello is answered");
            assert!(welcome.to_text().unwrap().contains("welcome"));
            // Then nothing: it reads no ping, so it sends no pong, and its socket stays open as a phone that
            // lost its Wi-Fi's does.
            std::thread::sleep(Duration::from_millis(900));
            drop(socket);
        });

        let (stream, peer) = listener.accept().expect("the phone is at the door");
        let (updates, heard) = mpsc::channel();
        let commands: Arc<Mutex<Option<super::Writer>>> = Arc::new(Mutex::new(None));
        let stop = AtomicBool::new(false);
        super::handle(stream, peer, 1, &Mutex::new("t".to_owned()), &updates, &commands, &stop, heartbeat);

        let seen: Vec<_> = heard.try_iter().collect();
        assert!(
            matches!(seen.as_slice(), [Update::Connected { .. }, Update::Disconnected { .. }]),
            "the phone connects, then its silence lets it go: {seen:?}"
        );
        phone.join().unwrap();
    }

    /// The host polls; the phone's thread answers a moment later.
    fn next(server: &Server) -> Option<Update> {
        let start = Instant::now();
        while start.elapsed() < Duration::from_secs(5) {
            if let Some(update) = server.try_next() {
                return Some(update);
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        None
    }
}
