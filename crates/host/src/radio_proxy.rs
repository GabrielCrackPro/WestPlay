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

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream, ToSocketAddrs};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use base64::Engine as _;

/// How many stations play at once: a cab plays one, and a page left open in the wild plays none more.
const MOST_AT_ONCE: usize = 6;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(8);
/// Long enough for a station to find a song, short enough that a dead one isn't waited on forever.
const READ_TIMEOUT: Duration = Duration::from_secs(20);
const MOST_REDIRECTS: usize = 5;
const HEAD_MOST: usize = 16 * 1024;

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
                std::thread::spawn(move || {
                    let _ = serve(stream, &tls);
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

/// One connection from the page: its request says the station, and the station's bytes go back through it.
fn serve(mut client: TcpStream, tls: &native_tls::TlsConnector) -> std::io::Result<()> {
    let _ = client.set_read_timeout(Some(CONNECT_TIMEOUT));
    let asked = read_head(&mut client);
    let _ = client.set_read_timeout(None);
    let _ = client.set_write_timeout(Some(READ_TIMEOUT));
    let url = match asked {
        Ok(head) => stream_of(&head),
        Err(why) => Err(why),
    };
    let Ok(url) = url else { return refuse(client, &url.unwrap_err()) };
    match fetch(&url, tls) {
        Ok((mut station, kind)) => {
            client.write_all(response_head(&kind).as_bytes())?;
            // Until the station's stream ends, or the page turns to another (and hangs up).
            let _ = std::io::copy(&mut station, &mut client);
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

/// The station a request asks for: `GET /s/<its url, base64url> HTTP/1.1`.
fn stream_of(head: &str) -> Result<String, String> {
    let line = head.lines().next().ok_or("no request")?;
    let target = line.split_whitespace().nth(1).ok_or("no request")?;
    let asked = target.strip_prefix("/s/").ok_or("not a station")?;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(asked).map_err(|_| "not a station")?;
    let url = String::from_utf8(bytes).map_err(|_| "not a station")?;
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("not an http stream".into());
    }
    Ok(url)
}

/// A station's stream, opened on its server (through its redirects), and what it says it is.
fn fetch(url: &str, tls: &native_tls::TlsConnector) -> Result<(Link, String), String> {
    let mut url = url.to_owned();
    for _ in 0..=MOST_REDIRECTS {
        let address = address_of(&url)?;
        let mut link = address.open(tls)?;
        let ask = format!(
            "GET {} HTTP/1.0\r\nHost: {}\r\nUser-Agent: WestPlay\r\nAccept: */*\r\nConnection: close\r\n\r\n",
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
        let kind = header_of(&head, "content-type")
            .map(|said| said.trim().to_owned())
            .filter(|said| said.starts_with("audio/") || said.starts_with("application/ogg"))
            .unwrap_or_else(|| "audio/mpeg".to_owned());
        return Ok((link, kind));
    }
    Err("the station went round too many redirects".into())
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

    /// The server, connected to (and its certificate checked) when the station is a secure one.
    fn open(&self, tls: &native_tls::TlsConnector) -> Result<Link, String> {
        let socket = (self.host.as_str(), self.port)
            .to_socket_addrs()
            .map_err(|why| format!("the station isn't found: {why}"))?
            .next()
            .ok_or("the station isn't found")?;
        let tcp = TcpStream::connect_timeout(&socket, CONNECT_TIMEOUT)
            .map_err(|why| format!("the station didn't answer: {why}"))?;
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
    String::from_utf8(head).map_err(|_| "the station said nothing of use".to_owned())
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
    fn reads_the_station_a_request_asks_for() {
        let encoded = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b"https://radio.example/one?x=1");
        let head = format!("GET /s/{encoded} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n");
        assert_eq!(stream_of(&head).unwrap(), "https://radio.example/one?x=1");
        assert!(stream_of("GET /two HTTP/1.1\r\n\r\n").is_err());
        let file = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b"file:///music.mp3");
        assert!(stream_of(&format!("GET /s/{file} HTTP/1.1\r\n\r\n")).is_err());
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
