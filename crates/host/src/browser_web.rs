//! The Browser app's page: the web in a WebView of its own, hidden under the cabin page, which shows it where
//! the app says (the CarPlay area cut open there, as YouTube's picture is) and drives it with the mouse and
//! the cabin's keyboard.
//!
//! Its toolbar is the cabin page's (apps/browser): this holds the page, opens the addresses it's given, moves
//! back and forward through its history, passes the app's mouse events in as the page's own (clicks, drags,
//! the wheel), types what the player typed into the page's field, and says what shows — `browser.js` posts
//! each page's address and title as it loads, and whether a field has the page's focus. Only `http` and
//! `https` addresses open: the page stays on the web, away from the player's own files.

use std::cell::Cell;
use std::path::Path;

use webview2_com::Microsoft::Web::WebView2::Win32::{
    COREWEBVIEW2_MOUSE_EVENT_KIND_LEAVE, COREWEBVIEW2_MOUSE_EVENT_KIND_LEFT_BUTTON_DOWN,
    COREWEBVIEW2_MOUSE_EVENT_KIND_LEFT_BUTTON_UP, COREWEBVIEW2_MOUSE_EVENT_KIND_MOVE,
    COREWEBVIEW2_MOUSE_EVENT_KIND_WHEEL, COREWEBVIEW2_MOUSE_EVENT_VIRTUAL_KEYS_LEFT_BUTTON,
    COREWEBVIEW2_MOUSE_EVENT_VIRTUAL_KEYS_NONE,
};
use windows::Win32::Foundation::POINT;

use crate::webview::{self, OffscreenWebView, PageSize, Stage, fitted};
use crate::youtube::within;

/// A command for the Browser's page (`PageMessage::Browser` in lib.rs).
#[derive(Clone, Debug, PartialEq, serde::Deserialize)]
#[serde(tag = "action", rename_all = "camelCase")]
pub enum Command {
    /// Opens `url`: a bare host gets `https://`, and its address and title come back as they load.
    Open {
        url: String,
    },
    Back,
    Forward,
    Reload,
    /// Shows the page where the app's element goes, in the frame's pixels.
    Show {
        x: f32,
        y: f32,
        width: u32,
        height: u32,
    },
    Hide,
    /// A mouse event in the page: `x` and `y` as shares (0 to 1) of the rectangle it shows in, `data` the
    /// wheel's notches (120 a notch, negative for down), `pressed` whether the left button is held.
    Pointer {
        kind: PointerKind,
        x: f32,
        y: f32,
        #[serde(default)]
        pressed: bool,
        #[serde(default)]
        data: i32,
    },
    /// What the player typed into the page's field (the cabin's keyboard), or a key with a meaning of its own.
    Type {
        #[serde(default)]
        text: Option<String>,
        #[serde(default)]
        key: Option<PageKey>,
    },
    /// The app's settings for the page: its zoom (1: as laid out) and whether it says it's a phone.
    Configure {
        zoom: f32,
        #[serde(default)]
        mobile: bool,
    },
    /// Forgets the page's cookies (signing out of the sites opened here) and loads it again.
    Clear,
    /// Takes it down: lib.rs closes it, and the app opens it again for the next address.
    Close,
}

/// A mouse event the app sends the page (`pointer.rs`'s, from the cabin's own pointer).
#[derive(Clone, Copy, Debug, PartialEq, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PointerKind {
    Move,
    Down,
    Up,
    Leave,
    Wheel,
}

/// A key typed into the page, meaning the same there as in a browser's field.
#[derive(Clone, Copy, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PageKey {
    Backspace,
    Enter,
    Tab,
    Escape,
}

/// What the page shows: its address, its title, and whether it's still loading (`browser.js`).
#[derive(Clone, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
pub struct State {
    pub url: String,
    pub title: String,
    #[serde(default)]
    pub loading: bool,
}

/// Something the page said (`browser.js`), for the cabin page.
#[derive(Clone, Debug, PartialEq)]
pub enum Report {
    /// The page it shows (as each loads).
    State(State),
    /// Whether a field of it has the focus (the cabin's keyboard types into it then).
    Focus(bool),
}

/// Where the page showed last, and how much its picture is shrunk there (still in page pixels: what's sent
/// under `Show` after `within`, times `frame / scale`).
#[derive(Clone, Copy, Debug, PartialEq)]
struct Placed {
    width: u32,
    height: u32,
    scale: f32,
}

/// The Browser app's page, in a hidden WebView of the stage.
pub struct Browser {
    view: OffscreenWebView,
    frame: PageSize,
    placed: Cell<Option<Placed>>,
    /// The agent the page sent before the app's settings said otherwise (a desktop browser's, WebView2's own):
    /// what it sends again for the sites' desktop versions.
    desktop_agent: String,
}

impl Browser {
    /// Opens the Browser in a hidden WebView of `stage`'s frame (`width` x `height`), under the cabin page:
    /// nothing loads until the app opens an address (its start page is the cabin page's own).
    pub fn start(stage: &Stage, width: u32, height: u32, user_data: &Path) -> Result<Self, webview::Error> {
        let view = OffscreenWebView::new(stage, width, height, user_data)?;
        view.log_as("browser")?;
        view.show(false)?;
        stage.add(&view, false)?;
        // The truck's speakers first: a page's sound (a video, a radio stream) is the cab's, as the players'.
        view.add_startup_script(concat!(include_str!("cab_sound.js"), "\n", include_str!("browser.js")))?;
        let desktop_agent = view.user_agent().unwrap_or_default();
        Ok(Self { view, frame: stage.page_size(), placed: Cell::new(None), desktop_agent })
    }

    pub fn command(&self, command: &Command) {
        match command {
            Command::Open { url } => {
                let Some(address) = address(url) else { return };
                if let Err(e) = self.view.navigate(&address) {
                    log!("[browser] opening {address} failed: {e}");
                }
            }
            Command::Back | Command::Forward => {
                let script = if *command == Command::Back { "history.back()" } else { "history.forward()" };
                if let Err(e) = self.view.run_script(script, |_| {}) {
                    log!("[browser] {script} failed: {e}");
                }
            }
            Command::Reload => {
                if let Err(e) = self.view.reload() {
                    log!("[browser] reloading failed: {e}");
                }
            }
            Command::Show { x, y, width, height } => {
                // The page laid out large in the element's shape, its picture shrunk into it (as a video's).
                let (x, y, width, height) = within(self.frame.get(), *x, *y, *width, *height);
                let (_, _, scale) = fitted(self.frame.get(), width, height);
                match self.view.fit(self.frame.get(), x, y, width, height).and_then(|()| self.view.show(true)) {
                    Ok(()) => self.placed.set(Some(Placed { width, height, scale })),
                    Err(e) => log!("[browser] showing the page failed: {e}"),
                }
            }
            Command::Hide => {
                self.placed.set(None);
                if let Err(e) = self.view.show(false) {
                    log!("[browser] hiding the page failed: {e}");
                }
            }
            Command::Pointer { kind, x, y, pressed, data } => {
                // Nothing shown yet (or it went): where the page would be isn't known, and nothing to point at.
                let Some(placed) = self.placed.get() else { return };
                let point = pointer_point(&placed, *x, *y);
                let keys = if *pressed {
                    COREWEBVIEW2_MOUSE_EVENT_VIRTUAL_KEYS_LEFT_BUTTON
                } else {
                    COREWEBVIEW2_MOUSE_EVENT_VIRTUAL_KEYS_NONE
                };
                let (event, name) = mouse_event(*kind);
                if let Err(e) = self.view.send_mouse(event, keys, *data as u32, point) {
                    log!("[browser] {} failed: {e}", name);
                }
            }
            Command::Type { text, key } => {
                // Typed in the page's own script (`browser.js`): its fields' editing commands fire the events
                // a site listens for, as a browser's typing does.
                let said = serde_json::json!({ "browserType": { "text": text, "key": key } });
                if let Err(e) = self.view.post_json(&said.to_string()) {
                    log!("[browser] typing failed: {e}");
                }
            }
            Command::Configure { zoom, mobile } => {
                if let Err(e) = self.view.set_zoom(*zoom) {
                    log!("[browser] setting the zoom failed: {e}");
                }
                let agent = if *mobile { MOBILE_AGENT } else { self.desktop_agent.as_str() };
                if !agent.is_empty()
                    && let Err(e) = self.view.set_user_agent(agent)
                {
                    log!("[browser] setting the agent failed: {e}");
                }
            }
            Command::Clear => {
                // Its profile is its own (webview2-browser): this signs out of nothing else.
                if let Err(e) = self.view.delete_cookies() {
                    log!("[browser] clearing its cookies failed: {e}");
                }
                if let Err(e) = self.view.reload() {
                    log!("[browser] reloading after clearing failed: {e}");
                }
            }
            Command::Close => {}
        }
    }

    /// What the page said about itself since the last call (`browser.js`), oldest first.
    pub fn take_reports(&self) -> Vec<Report> {
        self.view.take_page_messages().iter().filter_map(|message| read_report(message)).collect()
    }

    /// Whether the WebView failed since the last call (it's then closed and started again when needed).
    pub fn failed(&self) -> bool {
        self.view.take_failure().is_some()
    }

    /// Takes the WebView off the frame; it closes as it's dropped.
    pub fn close(self, stage: &Stage) {
        let _ = stage.remove(&self.view);
    }
}

/// What the page says it is when the app's settings ask for sites' phone versions: a phone's browser.
const MOBILE_AGENT: &str = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) \
     Chrome/124.0.0.0 Mobile Safari/537.36";

/// The page's mouse event for the app's, and its name in the log.
fn mouse_event(
    kind: PointerKind,
) -> (webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_MOUSE_EVENT_KIND, &'static str) {
    match kind {
        PointerKind::Move => (COREWEBVIEW2_MOUSE_EVENT_KIND_MOVE, "move"),
        PointerKind::Down => (COREWEBVIEW2_MOUSE_EVENT_KIND_LEFT_BUTTON_DOWN, "left button down"),
        PointerKind::Up => (COREWEBVIEW2_MOUSE_EVENT_KIND_LEFT_BUTTON_UP, "left button up"),
        PointerKind::Leave => (COREWEBVIEW2_MOUSE_EVENT_KIND_LEAVE, "leave"),
        PointerKind::Wheel => (COREWEBVIEW2_MOUSE_EVENT_KIND_WHEEL, "wheel"),
    }
}

/// Where on the page the app's pointer is: `x` and `y` are shares of the rectangle the page shows in, and
/// the page's own pixels are that rectangle's times `frame / scale` (it's laid out larger than it shows).
fn pointer_point(placed: &Placed, x: f32, y: f32) -> POINT {
    let (page_width, page_height) = (placed.width as f32 / placed.scale, placed.height as f32 / placed.scale);
    POINT {
        x: (x.clamp(0.0, 1.0) * page_width).clamp(0.0, page_width - 1.0) as i32,
        y: (y.clamp(0.0, 1.0) * page_height).clamp(0.0, page_height - 1.0) as i32,
    }
}

/// `{"type":"browser","state":{…}}`: what the Browser's page shows (`null`: no page open).
pub fn state_message(state: Option<&State>) -> String {
    serde_json::json!({ "type": "browser", "state": state }).to_string()
}

/// `{"type":"browserFocus","editable":…}`: whether the page has a field to type into.
pub fn focus_message(editable: bool) -> String {
    serde_json::json!({ "type": "browserFocus", "editable": editable }).to_string()
}

/// What the page posted: `{"browser":{…}}` or `{"browserFocus":{…}}` (`browser.js`); `None` for the other
/// messages a page posts (`cab_sound.js`'s). The page posts a string of JSON (`say`), which WebView2 hands over
/// as that string's JSON (`WebMessageAsJson`): both shapes are read, as the players' pages do.
fn read_report(message: &str) -> Option<Report> {
    #[derive(serde::Deserialize)]
    struct Focus {
        editable: bool,
    }
    #[derive(serde::Deserialize)]
    struct Posted {
        #[serde(default)]
        browser: Option<State>,
        #[serde(default, rename = "browserFocus")]
        browser_focus: Option<Focus>,
    }
    let posted: Posted = match serde_json::from_str::<String>(message) {
        Ok(said) => serde_json::from_str(&said).ok()?,
        Err(_) => serde_json::from_str(message).ok()?,
    };
    if let Some(state) = posted.browser {
        return Some(Report::State(state));
    }
    posted.browser_focus.map(|focus| Report::Focus(focus.editable))
}

/// `text` as a web address: a bare host gets `https://`, and only `http` and `https` open. `None` for anything
/// else (nothing typed, spaces in it, a scheme that isn't the web's, no host) — the app says why.
fn address(text: &str) -> Option<String> {
    let trimmed = text.trim();
    if trimmed.is_empty() || trimmed.len() > 2048 || trimmed.split_whitespace().count() != 1 {
        return None;
    }
    let address = if trimmed.contains("://") { trimmed.to_owned() } else { format!("https://{trimmed}") };
    let (scheme, rest) = address.split_once("://")?;
    if !matches!(scheme.to_ascii_lowercase().as_str(), "http" | "https") {
        return None;
    }
    // Its host: up to the first `/`, `?` or `#`, without a sign-in and a port.
    let host = rest.split(['/', '?', '#']).next().unwrap_or("");
    let host = host.rsplit_once('@').map_or(host, |(_, after)| after);
    let host = host.split_once(':').map_or(host, |(before, port)| {
        // A port after the host (an address without one keeps all of it; IPv6's brackets have their own colons).
        if port.chars().all(|c| c.is_ascii_digit()) { before } else { host }
    });
    let host_chars_ok =
        host.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | '[' | ']' | ':'));
    let named = host.contains('.') || host.eq_ignore_ascii_case("localhost") || host.starts_with('[');
    if host.is_empty() || !host_chars_ok || !named {
        return None;
    }
    Some(address)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_bare_host_opens_on_the_web() {
        assert_eq!(address("example.com"), Some("https://example.com".to_owned()));
        assert_eq!(address("  example.com/radio  "), Some("https://example.com/radio".to_owned()));
        assert_eq!(address("localhost:8080"), Some("https://localhost:8080".to_owned()));
        assert_eq!(address("https://example.com/a?b=c#d"), Some("https://example.com/a?b=c#d".to_owned()));
    }

    #[test]
    fn only_web_addresses_open() {
        assert_eq!(address(""), None);
        assert_eq!(address("   "), None);
        assert_eq!(address("two words"), None);
        assert_eq!(address("file:///C:/Windows/win.ini"), None);
        assert_eq!(address("https://"), None);
        assert_eq!(address("javascript:alert(1)"), None);
        assert_eq!(address("example"), None);
        assert_eq!(address("http://exa mple.com"), None);
    }

    #[test]
    fn the_mouse_reaches_the_page_where_it_shows() {
        // A page laid out at 1000 x 800, shown at half size in 500 x 400: its own pixels are twice the share.
        let placed = Placed { width: 500, height: 400, scale: 0.5 };
        assert_eq!(pointer_point(&placed, 0.5, 0.5), POINT { x: 500, y: 400 });
        assert_eq!(pointer_point(&placed, 0.0, 0.0), POINT { x: 0, y: 0 });
        // Its edges stay inside the page.
        assert_eq!(pointer_point(&placed, 1.0, 1.0), POINT { x: 999, y: 799 });
        assert_eq!(pointer_point(&placed, 2.0, -1.0), POINT { x: 999, y: 0 });
    }

    /// The real thing: an address opens, and the page says where it is (its own address and title), which is
    /// what the app shows it by; and what the cabin's keyboard types reaches the page's own field. Needs
    /// WebView2 and the network: `cargo test -p westplay-host -- --ignored says_where_it_goes`.
    #[test]
    #[ignore = "opens example.com"]
    fn says_where_it_goes() {
        use windows::Win32::System::Com::{COINIT_APARTMENTTHREADED, CoInitializeEx};
        // SAFETY: COM on this test's own thread, once, before anything uses it.
        unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok().unwrap() };
        let user_data = std::env::temp_dir().join(format!("westplay-browser-test-{}", std::process::id()));
        let stage = Stage::new(1280, 720).unwrap();
        let browser = Browser::start(&stage, 1280, 720, &user_data).unwrap();
        browser.command(&Command::Open { url: "example.com".into() });
        let started = std::time::Instant::now();
        let mut said: Vec<String> = Vec::new();
        let mut loaded = false;
        while started.elapsed() < std::time::Duration::from_secs(40) {
            crate::pump_messages();
            std::thread::sleep(std::time::Duration::from_millis(50));
            for report in browser.take_reports() {
                if let Report::State(state) = report {
                    println!("said: {} ({:?})", state.url, state.title);
                    loaded |= state.url.contains("example.com") && !state.title.is_empty();
                    said.push(state.url);
                }
            }
            if loaded {
                break;
            }
        }
        assert!(loaded, "no page for example.com (said: {said:?})");
        // The cabin's keyboard's typing reaches the field the page has focused.
        let run = |script: &str| -> String {
            let seen = std::rc::Rc::new(std::cell::RefCell::new(None));
            let into = seen.clone();
            browser.view.run_script(script, move |json| *into.borrow_mut() = Some(json)).unwrap();
            while seen.borrow().is_none() {
                crate::pump_messages();
                std::thread::sleep(std::time::Duration::from_millis(20));
            }
            seen.borrow_mut().take().unwrap_or_default()
        };
        run(
            "document.body.insertAdjacentHTML('afterbegin', '<input id=\"probe\">'); document.querySelector('#probe').focus(); document.activeElement.id",
        );
        browser.command(&Command::Type { text: Some("ets2".into()), key: None });
        let typed = std::time::Instant::now();
        let mut value = String::new();
        while typed.elapsed() < std::time::Duration::from_secs(5) {
            crate::pump_messages();
            std::thread::sleep(std::time::Duration::from_millis(50));
            value = run("document.querySelector('#probe').value");
            if value.contains("ets2") {
                break;
            }
        }
        println!("typed: {value}");
        let _ = std::fs::remove_dir_all(&user_data);
        browser.close(&stage);
        assert!(value.contains("ets2"), "the page's field has {value:?}");
    }

    #[test]
    fn a_page_says_where_it_is() {
        let said = read_report(r#"{"browser":{"url":"https://example.com/","title":"Example","loading":false}}"#);
        assert_eq!(
            said,
            Some(Report::State(State {
                url: "https://example.com/".to_owned(),
                title: "Example".to_owned(),
                loading: false
            }))
        );
        assert_eq!(read_report(r#"{"browserFocus":{"editable":true}}"#), Some(Report::Focus(true)));
        // As the page posts it: a string of JSON, which WebView2 hands over as that string's JSON.
        assert_eq!(
            read_report(
                r#""{\"browser\":{\"url\":\"https://example.com/\",\"title\":\"Example\",\"loading\":false}}""#
            ),
            Some(Report::State(State {
                url: "https://example.com/".to_owned(),
                title: "Example".to_owned(),
                loading: false
            }))
        );
        assert_eq!(read_report(r#""{\"browserFocus\":{\"editable\":true}}""#), Some(Report::Focus(true)));
        assert_eq!(read_report(r#"{"cabSound":{"outside":false}}"#), None);
        assert_eq!(read_report("not json"), None);
    }
}
