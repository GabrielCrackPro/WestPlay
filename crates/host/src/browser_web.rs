//! The Browser app's page: the web in a WebView of its own, hidden under the cabin page, which shows it where
//! the app says (the CarPlay area cut open there, as YouTube's picture is).
//!
//! Its toolbar is the cabin page's (apps/browser): this holds the page, opens the addresses it's given, moves
//! back and forward through its history, and says what shows — `browser.js` posts each page's address and
//! title as it loads, and as a site changes them in place. Only `http` and `https` addresses open: the page
//! stays on the web, away from the player's own files.

use std::path::Path;

use crate::webview::{self, OffscreenWebView, PageSize, Stage};
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
    /// Takes it down: lib.rs closes it, and the app opens it again for the next address.
    Close,
}

/// What the page shows: its address, its title, and whether it's still loading (`browser.js`).
#[derive(Clone, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
pub struct State {
    pub url: String,
    pub title: String,
    #[serde(default)]
    pub loading: bool,
}

/// The Browser app's page, in a hidden WebView of the stage.
pub struct Browser {
    view: OffscreenWebView,
    frame: PageSize,
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
        Ok(Self { view, frame: stage.page_size() })
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
                let shown = self.view.fit(self.frame.get(), x, y, width, height).and_then(|()| self.view.show(true));
                if let Err(e) = shown {
                    log!("[browser] showing the page failed: {e}");
                }
            }
            Command::Hide => {
                if let Err(e) = self.view.show(false) {
                    log!("[browser] hiding the page failed: {e}");
                }
            }
            Command::Close => {}
        }
    }

    /// The latest thing the page said about itself since the last call (`browser.js`), or `None` if it said
    /// nothing (it's read every pass: the last page's state is the one that shows).
    pub fn take_state(&self) -> Option<State> {
        self.view.take_page_messages().iter().rev().find_map(|message| read_report(message))
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

/// `{"type":"browser","state":{…}}`: what the Browser's page shows (`null`: no page open).
pub fn state_message(state: Option<&State>) -> String {
    serde_json::json!({ "type": "browser", "state": state }).to_string()
}

/// What the page posted: `{"browser":{"url":…,"title":…,"loading":…}}` (`browser.js`); `None` for the other
/// messages a page posts (`cab_sound.js`'s).
fn read_report(message: &str) -> Option<State> {
    #[derive(serde::Deserialize)]
    struct Posted {
        browser: Option<State>,
    }
    serde_json::from_str::<Posted>(message).ok()?.browser
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
        assert_eq!(address("https://"), None);
        assert_eq!(address("javascript:alert(1)"), None);
        assert_eq!(address("example"), None);
        assert_eq!(address("http://exa mple.com"), None);
    }

    #[test]
    fn a_page_says_where_it_is() {
        let said = read_report(r#"{"browser":{"url":"https://example.com/","title":"Example","loading":false}}"#);
        assert_eq!(
            said,
            Some(State { url: "https://example.com/".to_owned(), title: "Example".to_owned(), loading: false })
        );
        assert_eq!(
            read_report(r#"{"browser":{"url":"https://a.com/","title":""}}"#).map(|state| state.loading),
            Some(false)
        );
        assert_eq!(read_report(r#"{"cabSound":{"outside":false}}"#), None);
        assert_eq!(read_report("not json"), None);
    }
}
