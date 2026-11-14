//! The Radio app's way into the game's stations: a door of this PC's own, on loopback.
//!
//! The cab's page is https (WebView2's virtual host) and the stations are other people's servers: many stream
//! over http alone, some have certificates of their own, and a browser plays silence for a stream it may read but
//! not hear through a Web Audio graph — which is how the truck's speakers are told (cab_sound.js). So a station is
//! fetched here and served to the page from this PC: `http://127.0.0.1:<port>/s/<station, base64url>`. The browser
//! takes loopback as the page's own and the door's `Access-Control-Allow-Origin` as leave to hear it, so the
//! speakers' graph has a stream it can play.
//!
//! Only `http` and `https` are fetched, one stream per connection, and no more at once than a cab can want.
//!
//! Most stations slip the song they play into their stream, a word of it every `icy-metaint` bytes (ICY
//! metadata): those words are taken out of what the page hears — a player fed them would break the sound — and the
//! last one is kept, for the page to ask after beside the stream (`/t/<station>`, the song on the set's face).
//!
//! Some stations answer with a playlist rather than a stream (`.pls`, `.m3u`: where they stream from, and their
//! name): the door reads it and fetches the stream it names, so a station the game's list keeps as a playlist plays
//! as any other. The page is only ever served audio.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use base64::Engine as _;

/// How many stations play at once: a cab plays one, and a page left open in the wild plays none more.
const MOST_AT_ONCE: usize = 6;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(8);
/// Long enough for a station to find a song, short enough that a dead one isn't waited on forever.
const READ_TIMEOUT: Duration = Duration::from_secs(20);
const MOST_REDIRECTS: usize = 5;
/// How many playlists a station may name before its stream (a list of lists is no station).
const MOST_PLAYLISTS: usize = 3;
/// How many of a station's addresses the door tries: its name may answer for each way this PC has to reach it.
const MOST_ADDRESSES: usize = 3;
const HEAD_MOST: usize = 16 * 1024;
/// How much of a station's playlist is read: a list of streams and their words, not a stream itself.
const PLAYLIST_MOST: u64 = 64 * 1024;

/// What each station last said it plays, by the station's url: told while it plays, forgotten after.
type Titles = Arc<Mutex<HashMap<String, String>>>;

/// The door: where the page finds it (`http://127.0.0.1:<port>`), open for this run.
pub struct Stations {
    base: String,
}

impl Stations {
    /// Opens the door on a port of this PC's choosing (`None`: this PC gives it none).
    pub fn open() -> Option<Stations> {
        let listener = TcpListener::bind(("127.0.0.1", 0)).ok()?;
        let port = listener.local_addr().ok()?.port();
        let tls = Arc::new(native_tls::TlsConnector::new().ok()?);
        let at_once = Arc::new(AtomicUsize::new(0));
        let titles: Titles = Arc::new(Mutex::new(HashMap::new()));
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(stream) = stream else { continue };
                // A station already playing keeps its place: another is turned away (and the page says so).
                if at_once.fetch_add(1, Ordering::AcqRel) >= MOST_AT_ONCE {
                    at_once.fetch_sub(1, Ordering::AcqRel);
                    let _ = refuse(stream, "busy");
                    continue;
                }
                let tls = tls.clone();
                let at_once = at_once.clone();
                let titles = titles.clone();
                std::thread::spawn(move || {
                    let _ = serve(stream, &tls, &titles);
                    at_once.fetch_sub(1, Ordering::AcqRel);
                });
            }
        });
        Some(Stations { base: format!("http://127.0.0.1:{port}") })
    }

    /// Where the page asks for a stream (`streamOf`, apps/radio/stations.ts, adds the station).
    pub fn base(&self) -> &str {
        &self.base
    }
}

/// One connection from the page: it asks for a station's stream, or for the song it last played.
fn serve(
    mut client: TcpStream,
    tls: &native_tls::TlsConnector,
    titles: &Mutex<HashMap<String, String>>,
) -> std::io::Result<()> {
    let _ = client.set_read_timeout(Some(CONNECT_TIMEOUT));
    let asked = read_head(&mut client);
    let _ = client.set_read_timeout(None);
    let _ = client.set_write_timeout(Some(READ_TIMEOUT));
    let head = match asked {
        Ok(head) => head,
        Err(why) => return refuse(client, &why),
    };
    if let Some(url) = asked_title(&head) {
        return answer_title(client, titles, &url);
    }
    if let Some(url) = asked_list(&head) {
        return answer_channels(client, tls, &url);
    }
    if let Some(url) = asked_bytes(&head) {
        return answer_bytes(client, tls, &url);
    }
    let (url, channel) = match stream_of(&head) {
        Ok(asked) => asked,
        Err(why) => return refuse(client, &why),
    };
    match fetch(&url, channel, tls) {
        Ok((mut station, kind, between)) => {
            client.write_all(response_head(&kind).as_bytes())?;
            // A station's song, kept as it comes: the face asks for it while the page hears the station.
            let told = |title: &str| {
                if let Ok(mut last) = titles.lock() {
                    last.insert(url.clone(), title.to_owned());
                }
            };
            // Until the station's stream ends, or the page turns to another (and hangs up).
            let _ = relay(&mut station, &mut client, between, told);
            // Whatever it played last, it isn't playing it now.
            if let Ok(mut last) = titles.lock() {
                last.remove(&url);
            }
            Ok(())
        }
        Err(why) => refuse(client, &why),
    }
}

/// What the page's player is told: a stream of no known length, that it may hear, from any page of the cab.
fn response_head(kind: &str) -> String {
    format!(
        "HTTP/1.1 200 OK\r\nContent-Type: {kind}\r\nCache-Control: no-store\r\n\
         Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: *\r\nConnection: close\r\n\r\n"
    )
}

/// The station a request asks for, and which of its streams: `GET /s/<its url, base64url>?n=<k> HTTP/1.1`.
fn stream_of(head: &str) -> Result<(String, usize), String> {
    let line = head.lines().next().ok_or("no request")?;
    let target = line.split_whitespace().nth(1).ok_or("no request")?;
    let (path, query) = target.split_once('?').unwrap_or((target, ""));
    let asked = path.strip_prefix("/s/").ok_or("not a station")?;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(asked).map_err(|_| "not a station")?;
    let url = String::from_utf8(bytes).map_err(|_| "not a station")?;
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("not an http stream".into());
    }
    Ok((url, channel_in(query)))
}

/// Which of a station's streams a request asks for (`n=<k>`, counting from 1): the first when it doesn't say.
fn channel_in(query: &str) -> usize {
    query
        .split('&')
        .find_map(|each| each.strip_prefix("n="))
        .and_then(|number| number.parse().ok())
        .filter(|number| *number > 0)
        .unwrap_or(1)
}

/// The station whose channels a request asks for: `GET /l/<its url, base64url> HTTP/1.1`.
fn asked_list(head: &str) -> Option<String> {
    asked_after(head, "/l/")
}

/// The station whose own bytes a request asks for (`GET /b/<its url, base64url>`): a list or a segment of an HLS
/// stream, which the page plays itself.
fn asked_bytes(head: &str) -> Option<String> {
    asked_after(head, "/b/")
}

/// The station a request's path asks for, under `route` (`/l/<its url, base64url>`), if it asks under that one.
fn asked_after(head: &str, route: &str) -> Option<String> {
    let target = head.lines().next()?.split_whitespace().nth(1)?;
    let asked = target.split_once('?').map_or(target, |(path, _)| path).strip_prefix(route)?;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(asked).ok()?;
    String::from_utf8(bytes).ok()
}

/// A station's stream, opened on its server (through its redirects), and what it says it is: its kind, and how
/// many bytes of audio it plays before a word of its song (`None`: it says nothing of a song). `channel` is which of
/// its streams a playlist names (`1`: the first).
fn fetch(url: &str, channel: usize, tls: &native_tls::TlsConnector) -> Result<(Link, String, Option<usize>), String> {
    let mut url = url.to_owned();
    // A station may answer with a playlist, and that playlist may name another: its stream is a few answers away.
    for _ in 0..=MOST_PLAYLISTS {
        let (mut link, head) = open_request(&url, tls)?;
        let said = header_of(&head, "content-type");
        // A station that answers with a playlist isn't playing yet: the stream it names is the one to play.
        if playlist_of(said.as_deref().unwrap_or_default(), &url) {
            let body = read_playlist(&mut link)?;
            let entries = entries_in(&body);
            // `n` past the playlist's end (one that changed since the page read it) is its first stream.
            let named = entries
                .get(channel.saturating_sub(1))
                .or_else(|| entries.first())
                .ok_or("a playlist that names no stream")?;
            url = resolve(&url, &named.url)?;
            continue;
        }
        let kind = said
            .map(|said| said.trim().to_owned())
            .filter(|said| said.starts_with("audio/") || said.starts_with("application/ogg"))
            .unwrap_or_else(|| "audio/mpeg".to_owned());
        let between = header_of(&head, "icy-metaint")
            .and_then(|each| each.trim().parse::<usize>().ok())
            .filter(|each| *each > 0 && *each <= 1024 * 1024);
        return Ok((link, kind, between));
    }
    Err("the station went round too many playlists".into())
}

/// A station's answer to a request, its redirects followed: the connection it answers on, and what it said.
fn open_request(url: &str, tls: &native_tls::TlsConnector) -> Result<(Link, String), String> {
    let mut url = url.to_owned();
    for _ in 0..=MOST_REDIRECTS {
        let address = address_of(&url)?;
        let mut link = address.open(tls)?;
        let ask = format!(
            "GET {} HTTP/1.0\r\nHost: {}\r\nUser-Agent: WestPlay\r\nAccept: */*\r\n\
             Icy-MetaData: 1\r\nConnection: close\r\n\r\n",
            address.path,
            address.host_header()
        );
        link.write_all(ask.as_bytes()).map_err(|why| format!("the station took no request: {why}"))?;
        let head = read_head(&mut link)?;
        let status = status_of(&head);
        if (300..400).contains(&status) {
            let on = header_of(&head, "location").ok_or("a redirect with nowhere to go")?;
            url = resolve(&url, &on)?;
            continue;
        }
        if status != 200 {
            return Err(format!("the station answered {status}"));
        }
        return Ok((link, head));
    }
    Err("the station went round too many redirects".into())
}

/// The streams a station's playlist offers (its channels), as the page shows them; none at all for a station that is
/// its own stream, which has nothing to choose.
fn channels_of(url: &str, tls: &native_tls::TlsConnector) -> Result<Vec<Channel>, String> {
    let (mut link, head) = open_request(url, tls)?;
    if !playlist_of(header_of(&head, "content-type").as_deref().unwrap_or_default(), url) {
        return Ok(Vec::new());
    }
    let body = read_playlist(&mut link)?;
    let entries = entries_in(&body);
    if entries.is_empty() {
        return Err("a playlist that names no stream".into());
    }
    // Where each stream is, as the playlist says it: beside itself, or on a server of its own.
    Ok(entries
        .into_iter()
        .filter_map(|each| Some(Channel { url: resolve(url, &each.url).ok()?, name: each.name }))
        .collect())
}

/// Whether a station's answer is a playlist rather than its stream: the `.pls` or `.m3u` the game's list names,
/// or a server that says as much (a shoutcast one's `audio/x-scpls`, an Icecast one's `audio/x-mpegurl`) — whatever
/// the name it was asked by.
fn playlist_of(kind: &str, url: &str) -> bool {
    let named = url.split(['?', '#']).next().unwrap_or(url).to_ascii_lowercase();
    // HLS (`.m3u8`) is a list of segments, no stream a page can play: following it would serve the page the
    // station's segments as if they were the station.
    if named.ends_with(".m3u8") {
        return false;
    }
    let said = kind.split(';').next().unwrap_or_default().trim().to_ascii_lowercase();
    const TYPES: [&str; 7] = [
        "audio/x-scpls",
        "audio/scpls",
        "application/pls+xml",
        "audio/x-mpegurl",
        "audio/mpegurl",
        "audio/m3u",
        "audio/x-m3u",
    ];
    TYPES.contains(&said.as_str()) || named.ends_with(".pls") || named.ends_with(".m3u")
}

/// A station's playlist as its server sends it: a small text file, whatever the station calls it.
fn read_playlist(link: &mut Link) -> Result<String, String> {
    let mut body = Vec::new();
    (&mut *link)
        .take(PLAYLIST_MOST)
        .read_to_end(&mut body)
        .map_err(|why| format!("the station's playlist didn't come: {why}"))?;
    Ok(String::from_utf8_lossy(&body).into_owned())
}

/// One of a station's streams: the address its playlist gives it, and the name it gives it (`""`: none).
#[derive(Debug, PartialEq, Eq, serde::Serialize)]
struct Channel {
    url: String,
    name: String,
}

/// The streams a station's playlist names, in its order: a `.pls`'s `File1=`/`Title1=` pairs (or its `File2=`, …), or
/// a `.m3u`'s lines with the `#EXTINF` name before each. An address that is no station (`C:\Music\…` in someone's
/// `.m3u`) is left out.
fn entries_in(body: &str) -> Vec<Channel> {
    // A `.pls` numbers its streams: its files and their titles are told apart by that number.
    let mut files: Vec<(usize, Channel)> = Vec::new();
    let mut titles: HashMap<usize, String> = HashMap::new();
    for line in body.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with(';') || line.starts_with('[') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else { continue };
        let value = value.trim().trim_matches('"');
        let key = key.trim().to_ascii_lowercase();
        let numbered = |each: &str| key.strip_prefix(each).and_then(|number| number.parse::<usize>().ok());
        if let Some(number) = numbered("file") {
            if reachable(value) {
                files.push((number, Channel { url: value.to_owned(), name: String::new() }));
            }
        } else if let Some(number) = numbered("title") {
            titles.insert(number, value.to_owned());
        }
    }
    if !files.is_empty() {
        files.sort_by_key(|(number, _)| *number);
        return files
            .into_iter()
            .map(|(number, mut channel)| {
                if let Some(title) = titles.remove(&number) {
                    channel.name = title;
                }
                channel
            })
            .collect();
    }
    // A `.m3u` names one stream a line, its `#EXTINF:<seconds>,<name>` the stream's name.
    let mut named = Vec::new();
    let mut name = String::new();
    for line in body.lines() {
        let line = line.trim();
        if let Some(note) = line.strip_prefix("#EXTINF:") {
            name = note.split_once(',').map_or(String::new(), |(_, name)| name.trim().to_owned());
            continue;
        }
        if line.is_empty() || line.starts_with('#') || line.starts_with(';') || line.starts_with('[') {
            continue;
        }
        if reachable(line) {
            named.push(Channel { url: line.to_owned(), name: std::mem::take(&mut name) });
        }
    }
    named
}

/// Whether an address a playlist gives is one this PC could ask for: an http stream, or where on the station's own
/// server (beside the playlist).
fn reachable(named: &str) -> bool {
    named.starts_with("http://") || named.starts_with("https://") || named.starts_with('/')
}

/// A station's bytes to the page: its audio alone, the song it sends between them kept for the face.
fn relay(
    station: &mut Link,
    client: &mut TcpStream,
    between: Option<usize>,
    mut titled: impl FnMut(&str),
) -> std::io::Result<()> {
    let Some(each) = between.filter(|each| *each > 0) else {
        std::io::copy(station, client)?;
        return Ok(());
    };
    loop {
        // The audio the page hears: none left, and the station has stopped.
        if copy_audio(station, client, each)? < each {
            return Ok(());
        }
        // A byte counting the song's words in 16s, then the words themselves (`StreamTitle='…';`).
        let mut counted = [0u8; 1];
        if read_into(station, &mut counted)? == 0 {
            return Ok(());
        }
        let words = counted[0] as usize * 16;
        if words == 0 {
            continue;
        }
        let mut word = vec![0u8; words];
        if read_into(station, &mut word)? < words {
            return Ok(());
        }
        if let Some(title) = title_in(&word) {
            titled(&title);
        }
    }
}

/// Up to `count` bytes of a station's audio, on their way to the page: fewer when the stream ends first.
fn copy_audio(station: &mut impl Read, client: &mut impl Write, count: usize) -> std::io::Result<usize> {
    const PIECE: usize = 16 * 1024;
    let mut left = count;
    let mut move_on = [0u8; PIECE];
    while left > 0 {
        let some = station.read(&mut move_on[..left.min(PIECE)])?;
        if some == 0 {
            break;
        }
        client.write_all(&move_on[..some])?;
        left -= some;
    }
    Ok(count - left)
}

/// Reads until what it was given is full, or the station's stream ends first.
fn read_into(station: &mut impl Read, into: &mut [u8]) -> std::io::Result<usize> {
    let mut filled = 0;
    while filled < into.len() {
        match station.read(&mut into[filled..]) {
            Ok(0) => break,
            Ok(some) => filled += some,
            Err(why) => return Err(why),
        }
    }
    Ok(filled)
}

/// The song a station sends between its audio: `StreamTitle='Artist - Song';`, and nothing when it sends none. Its
/// words are taken as the station wrote them (`text_of`).
fn title_in(word: &[u8]) -> Option<String> {
    const ASKS: &[u8] = b"StreamTitle='";
    let from = at(word, ASKS)? + ASKS.len();
    let rest = &word[from..];
    // The words end at the quote that closes the title, with or without the `;` after it.
    let to = at(rest, b"';").or_else(|| at(rest, b"'"))?;
    let title = text_of(&rest[..to]);
    let title = title.trim();
    (!title.is_empty()).then(|| title.to_owned())
}

/// Where `needle` is in `haystack`, if it is at all: its first byte. Both are never empty here.
fn at(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|window| window == needle)
}

/// A station's words as the station wrote them: its own UTF-8 where the bytes are UTF-8 (an Icecast station's),
/// and the broadcaster's Latin-1 where they aren't (a shoutcast station's, windows-1252: Latin-1's letters and
/// that code page's quotes, dashes and signs). A song's title is nobody's ASCII: read lossily, its `ö` came back
/// as `�`.
fn text_of(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(words) => words.to_owned(),
        Err(_) => bytes.iter().copied().map(letter_of).collect(),
    }
}

/// A byte of windows-1252 as its character: Latin-1 everywhere but 0x80–0x9F, which that code page gives its
/// quotes, dashes and signs (0xA0–0xFF is Latin-1's own letters, accents and all).
fn letter_of(byte: u8) -> char {
    const HIGH: [char; 32] = [
        '\u{20AC}', '\u{81}', '\u{201A}', '\u{192}', '\u{201E}', '\u{2026}', '\u{2020}', '\u{2021}', '\u{2C6}',
        '\u{2030}', '\u{160}', '\u{2039}', '\u{152}', '\u{8D}', '\u{17D}', '\u{8F}', '\u{90}', '\u{2018}', '\u{2019}',
        '\u{201C}', '\u{201D}', '\u{2022}', '\u{2013}', '\u{2014}', '\u{2DC}', '\u{2122}', '\u{161}', '\u{203A}',
        '\u{153}', '\u{9D}', '\u{17E}', '\u{178}',
    ];
    match byte {
        0x80..=0x9F => HIGH[usize::from(byte - 0x80)],
        other => char::from(other),
    }
}

/// Where a station is: how to reach its server, and what to ask it for.
struct Address {
    secure: bool,
    host: String,
    port: u16,
    /// The path, with its query.
    path: String,
}

impl Address {
    fn host_header(&self) -> String {
        if (self.secure && self.port == 443) || (!self.secure && self.port == 80) {
            self.host.clone()
        } else {
            format!("{}:{}", self.host, self.port)
        }
    }

    /// The server, connected to (and its certificate checked) when the station is a secure one. A station's name
    /// may resolve to more than one address (one for each way this PC has to reach it): the first that answers is
    /// its server, as a browser tries them in turn rather than losing the station with the first one to fail.
    fn open(&self, tls: &native_tls::TlsConnector) -> Result<Link, String> {
        let mut refused = None;
        let mut reached = None;
        for socket in (self.host.as_str(), self.port)
            .to_socket_addrs()
            .map_err(|why| format!("the station isn't found: {why}"))?
            .take(MOST_ADDRESSES)
        {
            match TcpStream::connect_timeout(&socket, CONNECT_TIMEOUT) {
                Ok(tcp) => {
                    reached = Some(tcp);
                    break;
                }
                Err(why) => refused = Some(why),
            }
        }
        let tcp = reached.ok_or_else(|| match refused {
            Some(why) => format!("the station didn't answer: {why}"),
            None => "the station isn't found".to_owned(),
        })?;
        let _ = tcp.set_read_timeout(Some(READ_TIMEOUT));
        let _ = tcp.set_write_timeout(Some(CONNECT_TIMEOUT));
        if !self.secure {
            return Ok(Link::Plain(tcp));
        }
        tls.connect(&self.host, tcp).map(Link::Secure).map_err(|why| format!("the station isn't trusted: {why}"))
    }
}

/// A station's url as its pieces (`http://radio.example:8000/live.mp3` → port 8000, path `/live.mp3`).
fn address_of(url: &str) -> Result<Address, String> {
    let (secure, rest) = match url {
        _ if url.starts_with("https://") => (true, &url["https://".len()..]),
        _ if url.starts_with("http://") => (false, &url["http://".len()..]),
        _ => return Err("not an http stream".into()),
    };
    let (authority, path) = match rest.find('/') {
        Some(at) => (&rest[..at], &rest[at..]),
        None => (rest, "/"),
    };
    // A station's own sign-in (`user:pass@`) isn't used: the cab has no passwords for other people's streams.
    let authority = authority.rsplit('@').next().unwrap_or(authority);
    let default = if secure { 443 } else { 80 };
    let (host, port) = match authority.rsplit_once(':') {
        Some((host, port)) => (host, port.parse::<u16>().map_err(|_| "a port that isn't one")?),
        None => (authority, default),
    };
    if host.is_empty() {
        return Err("no station to reach".into());
    }
    Ok(Address { secure, host: host.to_owned(), port, path: path.to_owned() })
}

/// A station's answer to a redirect, as a url of its own (`/live` and `live` are on the station's host).
fn resolve(url: &str, location: &str) -> Result<String, String> {
    if location.starts_with("http://") || location.starts_with("https://") {
        return Ok(location.to_owned());
    }
    if location.starts_with("//") {
        let secure = url.starts_with("https://");
        return Ok(format!("{}{location}", if secure { "https:" } else { "http:" }));
    }
    let (scheme, rest) = url.split_once("://").ok_or("not an http stream")?;
    let host = rest.split('/').next().unwrap_or(rest);
    if location.starts_with('/') {
        return Ok(format!("{scheme}://{host}{location}"));
    }
    // A path of the station's own (`live.mp3` from `/streams/one`): beside it.
    let path = rest.find('/').map_or("/", |at| &rest[at..]).rsplit_once('/').map_or("/", |(each, _)| each);
    Ok(format!("{scheme}://{host}{path}/{location}"))
}

/// The code of a station's answer: `HTTP/1.1 200 OK`, and the shoutcast servers' `ICY 200 OK`.
fn status_of(head: &str) -> u16 {
    head.lines().next().and_then(|line| line.split_whitespace().nth(1)).and_then(|code| code.parse().ok()).unwrap_or(0)
}

/// A line of a response's head, whatever its case (`Location`, `location`).
fn header_of(head: &str, name: &str) -> Option<String> {
    head.lines().skip(1).find_map(|line| {
        let (key, value) = line.split_once(':')?;
        key.trim().eq_ignore_ascii_case(name).then(|| value.trim().to_owned())
    })
}

/// Reads a response's (or a request's) head, up to the empty line that ends it.
fn read_head(reader: &mut impl Read) -> Result<String, String> {
    let mut head = Vec::new();
    let mut byte = [0u8; 1];
    while head.len() < HEAD_MOST {
        match reader.read(&mut byte) {
            Ok(0) => break,
            Ok(_) => {
                head.push(byte[0]);
                if head.ends_with(b"\r\n\r\n") {
                    break;
                }
            }
            Err(why) => return Err(format!("the station said nothing: {why}")),
        }
    }
    // The lines are read for the fields the door needs, every one of them ASCII: a name or a genre written in the
    // station's own text (an ICY head is often Latin-1) isn't a reason to lose the station.
    Ok(String::from_utf8_lossy(&head).into_owned())
}

/// Turns a request the page's player made for a station away, saying why.
fn refuse(mut client: TcpStream, why: &str) -> std::io::Result<()> {
    let body = format!("{why}\n");
    let head = format!(
        "HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\n\
         Cache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
        body.len()
    );
    client.write_all(head.as_bytes())?;
    client.write_all(body.as_bytes())
}

/// The station whose song a request asks for: `GET /t/<its url, base64url> HTTP/1.1`.
fn asked_title(head: &str) -> Option<String> {
    let target = head.lines().next()?.split_whitespace().nth(1)?;
    let asked = target.strip_prefix("/t/")?;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(asked).ok()?;
    String::from_utf8(bytes).ok()
}

/// What a station's playlist offers, as the page reads it: `[{"url":"…","name":"…"},…]`, and `[]` for a station
/// that is its own stream, which has nothing to choose.
fn answer_channels(mut client: TcpStream, tls: &native_tls::TlsConnector, url: &str) -> std::io::Result<()> {
    let body = match channels_of(url, tls) {
        Ok(channels) => serde_json::to_string(&channels).unwrap_or_else(|_| "[]".to_owned()),
        Err(why) => return refuse(client, &why),
    };
    let head = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\n\
         Cache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
        body.len()
    );
    client.write_all(head.as_bytes())?;
    client.write_all(body.as_bytes())
}

/// A station's own bytes, as its server sends them: the HLS stream the page plays itself, hls.js asking the door for
/// its list and then for each segment of it (the page and the station's server are strangers: one is http where the
/// page is https, and neither lets the other read it). Its own kind, too: a list and a segment are kinds of their own.
fn answer_bytes(mut client: TcpStream, tls: &native_tls::TlsConnector, url: &str) -> std::io::Result<()> {
    let (mut station, head) = match open_request(url, tls) {
        Ok(opened) => opened,
        Err(why) => return refuse(client, &why),
    };
    let kind = header_of(&head, "content-type").unwrap_or_else(|| "application/octet-stream".to_owned());
    let said = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: {kind}\r\nCache-Control: no-store\r\n\
         Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: *\r\nConnection: close\r\n\r\n"
    );
    client.write_all(said.as_bytes())?;
    std::io::copy(&mut station, &mut client).map(|_| ())
}

/// What the door says a station plays (nothing at all while it plays nothing, or says nothing of a song).
fn answer_title(mut client: TcpStream, titles: &Mutex<HashMap<String, String>>, url: &str) -> std::io::Result<()> {
    let title = titles.lock().ok().and_then(|told| told.get(url).cloned()).unwrap_or_default();
    let head = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\n\
         Cache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\n\
         Connection: close\r\n\r\n",
        title.len()
    );
    client.write_all(head.as_bytes())?;
    client.write_all(title.as_bytes())
}

/// A station's stream: its server's plain socket, or the secure one over it.
enum Link {
    Plain(TcpStream),
    Secure(native_tls::TlsStream<TcpStream>),
}

impl Read for Link {
    fn read(&mut self, into: &mut [u8]) -> std::io::Result<usize> {
        match self {
            Link::Plain(stream) => stream.read(into),
            Link::Secure(stream) => stream.read(into),
        }
    }
}

impl Write for Link {
    fn write(&mut self, from: &[u8]) -> std::io::Result<usize> {
        match self {
            Link::Plain(stream) => stream.write(from),
            Link::Secure(stream) => stream.write(from),
        }
    }

    fn flush(&mut self) -> std::io::Result<()> {
        match self {
            Link::Plain(stream) => stream.flush(),
            Link::Secure(stream) => stream.flush(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_a_stations_address() {
        let address = address_of("https://radio.example/one.mp3").unwrap();
        assert_eq!(
            (address.secure, address.host.as_str(), address.port, address.path.as_str()),
            (true, "radio.example", 443, "/one.mp3")
        );
        assert_eq!(address.host_header(), "radio.example");
        let address = address_of("http://radio.example:8000/live?x=1").unwrap();
        assert_eq!((address.secure, address.port, address.path.as_str()), (false, 8000, "/live?x=1"));
        assert_eq!(address.host_header(), "radio.example:8000");
        // A station asked for without a path is its server's root.
        assert_eq!(address_of("https://radio.example").unwrap().path, "/");
        // Its own sign-in isn't part of where it is.
        assert_eq!(address_of("http://me:secret@radio.example/x").unwrap().host, "radio.example");
        // Anything else isn't an http stream.
        assert!(address_of("file:///music.mp3").is_err());
        assert!(address_of("https://radio.example:notaport/x").is_err());
    }

    #[test]
    fn reads_what_a_station_answers() {
        assert_eq!(status_of("HTTP/1.1 200 OK\r\n\r\n"), 200);
        assert_eq!(status_of("ICY 200 OK\r\n\r\n"), 200);
        assert_eq!(status_of("HTTP/1.0 302 Found\r\n\r\n"), 302);
        assert_eq!(status_of(""), 0);
        let head = "HTTP/1.1 302 Found\r\nLocation: https://radio.example/one\r\nContent-Type: text/html\r\n\r\n";
        assert_eq!(header_of(head, "location").as_deref(), Some("https://radio.example/one"));
        assert_eq!(header_of(head, "content-type").as_deref(), Some("text/html"));
        assert_eq!(header_of(head, "icy-name"), None);
    }

    #[test]
    fn reads_a_head_a_station_wrote_in_its_own_text() {
        // An ICY head is often Latin-1: a station named outside ASCII plays as any other.
        let mut said: &[u8] =
            b"ICY 200 OK\r\nContent-Type: audio/mpeg\r\nicy-name: Radio K\xf6ln\r\nicy-metaint: 8192\r\n\r\n";
        let head = read_head(&mut said).unwrap();
        assert_eq!(status_of(&head), 200);
        assert_eq!(header_of(&head, "content-type").as_deref(), Some("audio/mpeg"));
        assert_eq!(header_of(&head, "icy-metaint").as_deref(), Some("8192"));
    }

    #[test]
    fn reads_the_song_a_station_sends_between_its_audio() {
        assert_eq!(title_in(b"StreamTitle='ABBA - Waterloo';").as_deref(), Some("ABBA - Waterloo"));
        // The words come padded with nothing at all, to a count of 16.
        let mut padded = [0u8; 48];
        let said = b"StreamTitle='Daft Punk - One More Time';";
        padded[..said.len()].copy_from_slice(said);
        assert_eq!(title_in(&padded).as_deref(), Some("Daft Punk - One More Time"));
        // A station that sends no song, one that says it plays nothing, and one that says nothing at all.
        assert_eq!(title_in(b"StreamTitle='';"), None);
        assert_eq!(title_in(b"StreamUrl='http://radio.example';"), None);
        assert_eq!(title_in(&[0u8; 16]), None);
        assert_eq!(title_in(b"StreamTitle="), None);
    }

    #[test]
    fn reads_a_song_a_station_wrote_in_its_own_text() {
        // A shoutcast station writes its song in the broadcaster's Latin-1: its bytes are its letters.
        assert_eq!(title_in(b"StreamTitle='Radio K\xf6ln - M\xe4rchen';").as_deref(), Some("Radio Köln - Märchen"));
        // windows-1252's 0x92 is a right single quote, not Latin-1's control byte: "Don’t Stop Me Now".
        assert_eq!(title_in(b"StreamTitle='Don\x92t Stop Me Now';").as_deref(), Some("Don’t Stop Me Now"));
        // A station writing UTF-8 keeps its UTF-8: `é` is one letter, not the two of `Ã©`.
        assert_eq!(title_in("StreamTitle='Café Tacvba';".as_bytes()).as_deref(), Some("Café Tacvba"));
        // The song's words are the only ones read: the padding after them is no title's text.
        let mut padded = [0u8; 64];
        let said = "StreamTitle='Sigur Rós - Hoppípolla';".as_bytes();
        padded[..said.len()].copy_from_slice(said);
        assert_eq!(title_in(&padded).as_deref(), Some("Sigur Rós - Hoppípolla"));
    }

    #[test]
    fn follows_a_stations_redirect() {
        assert_eq!(
            resolve("https://radio.example/one", "https://other.example/two").unwrap(),
            "https://other.example/two"
        );
        assert_eq!(resolve("http://radio.example:8000/one", "/two").unwrap(), "http://radio.example:8000/two");
        assert_eq!(resolve("https://radio.example/one", "//other.example/two").unwrap(), "https://other.example/two");
        assert_eq!(resolve("https://radio.example/streams/one", "two").unwrap(), "https://radio.example/streams/two");
    }

    #[test]
    fn tells_a_playlist_from_a_station() {
        // The name it was asked by, as the game's list has it.
        assert!(playlist_of("", "http://radio.example/listen.pls"));
        assert!(playlist_of("text/plain", "http://radio.example/stream.m3u?sid=1"));
        // And what its server says, whatever the name.
        assert!(playlist_of("audio/x-scpls", "http://radio.example/;"));
        assert!(playlist_of("audio/x-mpegurl; charset=utf-8", "http://radio.example/one"));
        // A station's stream is no playlist, and HLS isn't one to follow.
        assert!(!playlist_of("audio/mpeg", "http://radio.example/live.mp3"));
        assert!(!playlist_of("audio/x-mpegurl", "http://radio.example/live.m3u8"));
    }

    #[test]
    fn reads_the_streams_a_playlist_names() {
        // A `.pls` of two streams, its files and their titles told apart by number (and told out of order here).
        let pls = "[playlist]\r\nNumberOfEntries=2\r\nFile2=http://radio.example:8000/other\r\n\
                   File1=http://radio.example:8000/live\r\nTitle1=Radio Example\r\nLength1=-1\r\n";
        assert_eq!(
            entries_in(pls),
            [
                Channel { url: "http://radio.example:8000/live".into(), name: "Radio Example".into() },
                Channel { url: "http://radio.example:8000/other".into(), name: String::new() },
            ]
        );
        // A `.m3u`: its notes first, then its stream, and a stream named beside the playlist.
        let m3u = "#EXTM3U\n#EXTINF:-1,Radio Example\nhttps://radio.example/live.mp3\n";
        assert_eq!(
            entries_in(m3u),
            [Channel { url: "https://radio.example/live.mp3".into(), name: "Radio Example".into() }]
        );
        assert_eq!(entries_in("#EXTM3U\r\n/live.mp3\r\n"), [Channel { url: "/live.mp3".into(), name: String::new() }]);
        // A playlist naming no stream, and a name that is no station (a Windows path in someone's `.m3u`).
        assert!(entries_in("[playlist]\nNumberOfEntries=0\n").is_empty());
        assert!(entries_in("C:\\Music\\song.mp3\n").is_empty());
        assert!(entries_in("").is_empty());
    }

    #[test]
    fn reads_the_station_a_request_asks_for() {
        let encoded = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b"https://radio.example/one?x=1");
        let head = format!("GET /s/{encoded} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n");
        assert_eq!(stream_of(&head).unwrap(), ("https://radio.example/one?x=1".to_owned(), 1));
        // Which of its streams the page asks for, and the first when it doesn't say.
        let third = format!("GET /s/{encoded}?n=3 HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n");
        assert_eq!(stream_of(&third).unwrap().1, 3);
        assert_eq!(channel_in("n=2"), 2);
        assert_eq!(channel_in("n=0"), 1);
        assert_eq!(channel_in("n=nonsense"), 1);
        assert_eq!(channel_in(""), 1);
        assert!(stream_of("GET /two HTTP/1.1\r\n\r\n").is_err());
        let file = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b"file:///music.mp3");
        assert!(stream_of(&format!("GET /s/{file} HTTP/1.1\r\n\r\n")).is_err());
        // The channels of a station, asked for by its own url.
        let listed = format!("GET /l/{encoded} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n");
        assert_eq!(asked_list(&listed).as_deref(), Some("https://radio.example/one?x=1"));
        assert_eq!(asked_list(&head), None);
    }

    /// The whole door, against a station of this PC's own: it is asked for a station, it fetches it, and its bytes
    /// come back to the page with the leave to hear them.
    #[test]
    fn serves_a_station_through_the_door() {
        let station = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let said = station.local_addr().unwrap();
        std::thread::spawn(move || {
            if let Ok((mut client, _)) = station.accept() {
                let mut ask = [0u8; 512];
                let _ = client.read(&mut ask);
                let _ = client.write_all(b"ICY 200 OK\r\nContent-Type: audio/mpeg\r\n\r\nsinging");
            }
        });
        let stations = Stations::open().unwrap();
        let mut door = TcpStream::connect(&stations.base()["http://".len()..]).unwrap();
        door.set_read_timeout(Some(Duration::from_secs(20))).unwrap();
        let url = format!("http://{said}/live.mp3");
        let encoded = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(url.as_bytes());
        write!(door, "GET /s/{encoded} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").unwrap();
        let mut answer = Vec::new();
        let _ = door.read_to_end(&mut answer);
        let answer = String::from_utf8_lossy(&answer);
        assert!(answer.starts_with("HTTP/1.1 200 OK"), "{answer}");
        assert!(answer.contains("Content-Type: audio/mpeg"), "{answer}");
        assert!(answer.contains("Access-Control-Allow-Origin: *"), "{answer}");
        assert!(answer.ends_with("singing"), "{answer}");
    }

    /// A station whose address is a playlist (as much of the game's list is) plays as any other: the door reads
    /// the list, fetches the stream it names, and the page is served that stream alone, never the list.
    #[test]
    fn follows_a_stations_playlist() {
        let stream = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let streaming_at = stream.local_addr().unwrap();
        std::thread::spawn(move || {
            if let Ok((mut client, _)) = stream.accept() {
                let mut ask = [0u8; 512];
                let _ = client.read(&mut ask);
                let _ = client.write_all(b"ICY 200 OK\r\nContent-Type: audio/mpeg\r\n\r\nsinging");
            }
        });
        let list = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let listing_at = list.local_addr().unwrap();
        std::thread::spawn(move || {
            if let Ok((mut client, _)) = list.accept() {
                let mut ask = [0u8; 512];
                let _ = client.read(&mut ask);
                let said = format!(
                    "HTTP/1.0 200 OK\r\nContent-Type: audio/x-scpls\r\n\r\n[playlist]\nNumberOfEntries=1\n\
                     File1=http://{streaming_at}/live.mp3\nTitle1=Radio Example\n"
                );
                let _ = client.write_all(said.as_bytes());
            }
        });
        let stations = Stations::open().unwrap();
        let url = format!("http://{listing_at}/listen.pls");
        let encoded = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(url.as_bytes());
        let mut door = TcpStream::connect(&stations.base()["http://".len()..]).unwrap();
        door.set_read_timeout(Some(Duration::from_secs(20))).unwrap();
        write!(door, "GET /s/{encoded} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").unwrap();
        let mut answer = Vec::new();
        let _ = door.read_to_end(&mut answer);
        let answer = String::from_utf8_lossy(&answer);
        assert!(answer.starts_with("HTTP/1.1 200 OK"), "{answer}");
        assert!(answer.contains("Content-Type: audio/mpeg"), "{answer}");
        assert!(answer.ends_with("singing"), "{answer}");
    }

    /// A station's playlist of several streams: the page is told of them all, and plays the one the player picks.
    #[test]
    fn offers_the_streams_a_playlist_names() {
        fn playing(said: &'static str) -> std::net::SocketAddr {
            let stream = TcpListener::bind(("127.0.0.1", 0)).unwrap();
            let at = stream.local_addr().unwrap();
            std::thread::spawn(move || {
                if let Ok((mut client, _)) = stream.accept() {
                    let mut ask = [0u8; 512];
                    let _ = client.read(&mut ask);
                    let said = format!("ICY 200 OK\r\nContent-Type: audio/mpeg\r\n\r\n{said}");
                    let _ = client.write_all(said.as_bytes());
                }
            });
            at
        }
        let one = playing("one");
        let two = playing("two");
        let list = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let listing_at = list.local_addr().unwrap();
        std::thread::spawn(move || {
            // The page asks once for the channels; the door reads the list again for each stream it plays.
            for _ in 0..3 {
                let Ok((mut client, _)) = list.accept() else { return };
                let mut ask = [0u8; 512];
                let _ = client.read(&mut ask);
                let said = format!(
                    "HTTP/1.0 200 OK\r\nContent-Type: audio/x-scpls\r\n\r\n[playlist]\nNumberOfEntries=2\n\
                     File1=http://{one}/live\nTitle1=Radio Example 128\n\
                     File2=http://{two}/live\nTitle2=Radio Example 64\n"
                );
                let _ = client.write_all(said.as_bytes());
            }
        });
        let stations = Stations::open().unwrap();
        let base = stations.base()["http://".len()..].to_owned();
        let encoded = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(format!("http://{listing_at}/listen.pls").as_bytes());

        // What the page offers the player: both streams, in the list's order, by the names it gives them.
        let mut asked = TcpStream::connect(&base).unwrap();
        asked.set_read_timeout(Some(Duration::from_secs(20))).unwrap();
        write!(asked, "GET /l/{encoded} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").unwrap();
        let mut answer = Vec::new();
        let _ = asked.read_to_end(&mut answer);
        let answer = String::from_utf8_lossy(&answer);
        let (_, body) = answer.split_once("\r\n\r\n").expect("a head and a body");
        assert_eq!(body.matches("\"url\":").count(), 2, "{body}");
        assert!(body.contains("\"name\":\"Radio Example 128\""), "{body}");
        assert!(body.contains(&format!("\"url\":\"http://{two}/live\"")), "{body}");

        // The one picked, and the first when the page doesn't say which.
        for (asked_for, heard) in [("?n=2", "two"), ("", "one")] {
            let mut door = TcpStream::connect(&base).unwrap();
            door.set_read_timeout(Some(Duration::from_secs(20))).unwrap();
            write!(door, "GET /s/{encoded}{asked_for} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").unwrap();
            let mut answer = Vec::new();
            let _ = door.read_to_end(&mut answer);
            let answer = String::from_utf8_lossy(&answer);
            assert!(answer.starts_with("HTTP/1.1 200 OK"), "{answer}");
            assert!(answer.ends_with(heard), "{answer}");
        }
    }

    /// An HLS station's own bytes: the page's own player reads its list, so the door hands the list, and each segment
    /// of it, over as the station's server sends them — kinds and all (a segment is no ICY stream to strip).
    #[test]
    fn serves_an_hls_stations_own_bytes() {
        let station = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let at = station.local_addr().unwrap();
        std::thread::spawn(move || {
            for (kind, body) in [
                ("application/vnd.apple.mpegurl", "#EXTM3U\n#EXT-X-TARGETDURATION:10\nseg1.ts\n"),
                ("video/mp2t", "segment-bytes"),
            ] {
                let Ok((mut client, _)) = station.accept() else { return };
                let mut ask = [0u8; 512];
                let _ = client.read(&mut ask);
                let said = format!("HTTP/1.0 200 OK\r\nContent-Type: {kind}\r\n\r\n{body}");
                let _ = client.write_all(said.as_bytes());
            }
        });
        let stations = Stations::open().unwrap();
        let base = stations.base()["http://".len()..].to_owned();
        for (path, kind, body) in [
            ("live.m3u8", "application/vnd.apple.mpegurl", "#EXT-X-TARGETDURATION:10"),
            ("seg1.ts", "video/mp2t", "segment-bytes"),
        ] {
            let encoded =
                base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(format!("http://{at}/{path}").as_bytes());
            let mut door = TcpStream::connect(&base).unwrap();
            door.set_read_timeout(Some(Duration::from_secs(20))).unwrap();
            write!(door, "GET /b/{encoded} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").unwrap();
            let mut answer = Vec::new();
            let _ = door.read_to_end(&mut answer);
            let answer = String::from_utf8_lossy(&answer);
            assert!(answer.starts_with("HTTP/1.1 200 OK"), "{answer}");
            assert!(answer.contains(&format!("Content-Type: {kind}")), "{answer}");
            assert!(answer.contains("Access-Control-Allow-Origin: *"), "{answer}");
            assert!(answer.contains(body), "{answer}");
        }
    }

    /// A station's song is taken out of the stream the page hears, and kept for the face to ask after.
    #[test]
    fn tells_the_song_a_station_plays() {
        let station = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let said = station.local_addr().unwrap();
        std::thread::spawn(move || {
            if let Ok((mut client, _)) = station.accept() {
                let mut ask = [0u8; 512];
                let _ = client.read(&mut ask);
                let _ = client.write_all(b"ICY 200 OK\r\nContent-Type: audio/mpeg\r\nicy-metaint: 8\r\n\r\n");
                let mut sent = Vec::from(*b"aaaaaaaa");
                let song = b"StreamTitle='ABBA - Waterloo';";
                let mut word = [0u8; 32];
                word[..song.len()].copy_from_slice(song);
                sent.push(2);
                sent.extend_from_slice(&word);
                sent.extend_from_slice(b"bbbbbbbb");
                let _ = client.write_all(&sent);
                // The station plays on while the page asks what it is playing.
                std::thread::sleep(Duration::from_secs(3));
            }
        });
        let stations = Stations::open().unwrap();
        let url = format!("http://{said}/live.mp3");
        let encoded = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(url.as_bytes());
        let mut door = TcpStream::connect(&stations.base()["http://".len()..]).unwrap();
        door.set_read_timeout(Some(Duration::from_secs(10))).unwrap();
        write!(door, "GET /s/{encoded} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").unwrap();
        let head = read_head(&mut door).unwrap();
        assert!(head.starts_with("HTTP/1.1 200 OK"), "{head}");
        // The page hears the audio alone: the song's words never reach it.
        let mut heard = [0u8; 16];
        read_into(&mut door, &mut heard).unwrap();
        assert_eq!(&heard, b"aaaaaaaabbbbbbbb");
        let mut asked = TcpStream::connect(&stations.base()["http://".len()..]).unwrap();
        asked.set_read_timeout(Some(Duration::from_secs(10))).unwrap();
        write!(asked, "GET /t/{encoded} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").unwrap();
        let mut answer = Vec::new();
        let _ = asked.read_to_end(&mut answer);
        let answer = String::from_utf8_lossy(&answer);
        assert!(answer.ends_with("ABBA - Waterloo"), "{answer}");
    }

    /// A station nothing answers at is a page that says so, not one left waiting.
    #[test]
    fn says_so_when_a_station_answers_nothing() {
        // A port of this PC's with nothing behind it.
        let gone = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let gone_at = gone.local_addr().unwrap();
        drop(gone);
        let stations = Stations::open().unwrap();
        let mut door = TcpStream::connect(&stations.base()["http://".len()..]).unwrap();
        door.set_read_timeout(Some(Duration::from_secs(20))).unwrap();
        let encoded =
            base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(format!("http://{gone_at}/live").as_bytes());
        write!(door, "GET /s/{encoded} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").unwrap();
        let mut answer = Vec::new();
        let _ = door.read_to_end(&mut answer);
        assert!(String::from_utf8_lossy(&answer).starts_with("HTTP/1.1 502 Bad Gateway"));
    }
}
