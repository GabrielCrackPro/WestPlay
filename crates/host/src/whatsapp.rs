//! WhatsApp: its web app (web.whatsapp.com), in a WebView of its own, under the cabin page.
//!
//! Unlike the music apps, the app the player sees is WhatsApp's own page, not WestPlay's: the cabin's WhatsApp
//! window is cut open over the WebView (the same hole YouTube Music's video shows through), so the page is read
//! and typed into as it is in a browser, with WhatsApp's own QR sign-in. The link lives in the profile this
//! WebView runs on (`webview2-whatsapp`): it survives the game and WestPlay, and signing out forgets it.
//!
//! Nothing of the driver's messages passes through WestPlay: no page script reads them, nothing is kept, and
//! nothing is logged (the page's own storage in its profile is WhatsApp's, as a browser's would be).
//!
//! The mouse and keyboard come from the game's own input (the bridge's pointer and typing blocks): the pointer
//! over the window is the page's (pointer.rs), and keys typed while it's open are the page's too (typing.rs),
//! so a conversation is opened and a message written without the mouse ever leaving the cab.

use std::cell::Cell;
use std::path::Path;

use windows::Win32::Foundation::POINT;

use crate::webview::{Error, OffscreenWebView, Stage};

/// WhatsApp's web app.
pub const HOME: &str = "https://web.whatsapp.com/";

/// What the cabin page asks of WhatsApp (`whatsapp` in ui/src/shared/host.ts).
#[derive(Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(tag = "action", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Command {
    /// Run it (hidden): the app is open.
    Start,
    /// Show the page at this rectangle of the frame (pixels), under the app's window: what the app cuts open.
    Show { x: f32, y: f32, width: u32, height: u32 },
    /// Show nothing (the app closed, or the screen handed to the truck): the page runs on.
    Hide,
    /// Load the page again (a sign-in that didn't come up, a QR gone stale).
    Reload,
    /// Forget the link (the profile's cookies and storage) and load the page again: a QR to scan.
    SignOut,
}

/// Where the page shows on the frame, in frame pixels.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub width: u32,
    pub height: u32,
}

impl Rect {
    /// Whether `point` (frame pixels) is over the page.
    pub fn holds(&self, point: (f32, f32)) -> bool {
        point.0 >= self.x
            && point.0 < self.x + self.width as f32
            && point.1 >= self.y
            && point.1 < self.y + self.height as f32
    }

    /// `point` (frame pixels) as the page reads it (its own pixels: it's placed at this rectangle, 1:1).
    pub fn local(&self, point: (f32, f32)) -> POINT {
        POINT { x: (point.0 - self.x) as i32, y: (point.1 - self.y) as i32 }
    }
}

/// WhatsApp's web app, and where it shows (nothing of what it shows).
pub struct WhatsApp {
    view: OffscreenWebView,
    /// Where it shows, while the app has it open (its `show`, its `hide`).
    shown: Cell<Option<Rect>>,
}

impl WhatsApp {
    /// WhatsApp's page, on `user_data`'s profile (its own), hidden until the app shows it.
    pub fn start(stage: &Stage, width: u32, height: u32, user_data: &Path) -> Result<Self, Error> {
        let view = OffscreenWebView::new(stage, width, height, user_data)?;
        stage.add(&view, false)?;
        view.show(false)?;
        view.navigate(HOME)?;
        Ok(Self { view, shown: Cell::new(None) })
    }

    pub fn command(&self, command: &Command) -> Result<(), Error> {
        match command {
            Command::Start => {}
            Command::Show { x, y, width, height } => {
                let rect = Rect { x: *x, y: *y, width: *width, height: *height };
                self.view.place(rect.x, rect.y, rect.width.max(1), rect.height.max(1))?;
                self.view.show(true)?;
                self.shown.set(Some(rect));
            }
            Command::Hide => {
                self.view.show(false)?;
                self.shown.set(None);
            }
            Command::Reload => self.view.reload()?,
            Command::SignOut => {
                self.sign_out()?;
            }
        }
        Ok(())
    }

    /// Its WebView2 environment: the profile its processes run on (`performance`), and its links.
    pub fn view(&self) -> &OffscreenWebView {
        &self.view
    }

    /// Takes the page off the frame (the game closed).
    pub fn close(self, stage: &Stage) {
        let _ = stage.remove(&self.view);
    }

    /// Where the page is, while it's shown: the pointer and typing go to it there.
    pub fn target(&self) -> Option<(&OffscreenWebView, Rect)> {
        self.shown.get().map(|rect| (&self.view, rect))
    }

    /// What the driver typed, as the page's own input: text inserted where its cursor is (the message box),
    /// and the keys it knows — Enter sends, Backspace deletes.
    pub fn type_message(&self, message: &str) -> Result<(), Error> {
        #[derive(serde::Deserialize)]
        struct Typed {
            events: Vec<Event>,
        }
        #[derive(serde::Deserialize)]
        #[serde(untagged)]
        enum Event {
            Text { text: String },
            Key { key: String },
        }
        let Ok(typed) = serde_json::from_str::<Typed>(message) else { return Ok(()) };
        for event in typed.events {
            match event {
                Event::Text { text } => {
                    let params = serde_json::json!({ "text": text });
                    self.devtools("Input.insertText", &params)?;
                }
                Event::Key { key } => {
                    // The keys the typing block names (westplay_shared::TypedKey), as a browser's own: Ctrl+Backspace
                    // deletes a word (modifiers 2 is CDP's Ctrl).
                    let (name, virtual_key, modifiers) = match key.as_str() {
                        "backspace" => ("Backspace", 8, 0),
                        "wordBackspace" => ("Backspace", 8, 2),
                        "enter" => ("Enter", 13, 0),
                        "escape" => ("Escape", 27, 0),
                        _ => continue,
                    };
                    for kind in ["keyDown", "keyUp"] {
                        let params = serde_json::json!({
                            "type": kind,
                            "key": name,
                            "code": name,
                            "windowsVirtualKeyCode": virtual_key,
                            "nativeVirtualKeyCode": virtual_key,
                            "modifiers": modifiers,
                        });
                        self.devtools("Input.dispatchKeyEvent", &params)?;
                    }
                }
            }
        }
        Ok(())
    }

    fn devtools(&self, method: &str, params: &serde_json::Value) -> Result<(), Error> {
        self.view.call_devtools(method, params)
    }

    /// Forgets the link: the profile's cookies and the page's own storage, then the page again.
    fn sign_out(&self) -> Result<(), Error> {
        self.view.delete_cookies()?;
        self.view.run_script(
            "localStorage.clear();
             if (indexedDB.databases) { indexedDB.databases().then((all) => all.forEach((db) => db.name && indexedDB.deleteDatabase(db.name))); }",
            |_| {},
        )?;
        self.view.reload()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_point_over_the_page_is_the_pages_own() {
        let rect = Rect { x: 40.0, y: 100.0, width: 600, height: 400 };
        assert!(rect.holds((40.0, 100.0)) && rect.holds((639.9, 499.9)));
        assert!(!rect.holds((39.9, 100.0)) && !rect.holds((40.0, 500.0)));
        let point = rect.local((140.0, 200.0));
        assert_eq!((point.x, point.y), (100, 100));
    }

    #[test]
    fn the_commands_the_page_sends_read_as_written() {
        let command: Command =
            serde_json::from_str(r#"{"action":"show","x":10.0,"y":20.0,"width":800,"height":600}"#).unwrap();
        assert_eq!(command, Command::Show { x: 10.0, y: 20.0, width: 800, height: 600 });
        assert_eq!(serde_json::from_str::<Command>(r#"{"action":"hide"}"#).unwrap(), Command::Hide);
        assert_eq!(serde_json::from_str::<Command>(r#"{"action":"signOut"}"#).unwrap(), Command::SignOut);
    }

    /// WhatsApp's own page, in the module's WebView: it loads and shows its QR, it's laid out at the rectangle
    /// the app cuts open, and it's hidden and shown again (`WESTPLAY_WHATSAPP_SPIKE`: a profile, kept between
    /// runs, signed in or not).
    #[test]
    #[ignore = "loads web.whatsapp.com"]
    fn whatsapp_web_serves_its_qr() {
        use crate::webview::Stage;
        use std::time::{Duration, Instant};
        use windows::Win32::System::Com::{COINIT_APARTMENTTHREADED, CoInitializeEx};

        // SAFETY: COM on this test's own thread, once, before anything uses it.
        unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok().unwrap() }
        let user_data = std::env::var_os("WESTPLAY_WHATSAPP_SPIKE").map_or_else(
            || std::env::temp_dir().join(format!("westplay-whatsapp-{}", std::process::id())),
            std::path::PathBuf::from,
        );
        let stage = Stage::new(1280, 800).unwrap();
        let app = WhatsApp::start(&stage, 1280, 800, &user_data).unwrap();
        let pump = |seconds: f64| {
            let until = Instant::now() + Duration::from_secs_f64(seconds);
            while Instant::now() < until {
                crate::pump_messages();
                std::thread::sleep(Duration::from_millis(20));
            }
        };
        pump(15.0);
        let state = app
            .view
            .evaluate(
                r#"({ title: document.title, ready: document.readyState, qr: !!document.querySelector('[data-ref]'),
                     canvases: document.querySelectorAll('canvas').length, dpr: devicePixelRatio,
                     text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 80) })"#,
            )
            .unwrap();
        println!("whatsapp: {state}");
        // Where the app's window is cut open, the page lays itself out at (the coordinates the pointer uses).
        app.command(&Command::Show { x: 40.0, y: 80.0, width: 800, height: 600 }).unwrap();
        pump(0.5);
        let placed =
            app.view.evaluate("({ width: innerWidth, height: innerHeight, hidden: document.hidden })").unwrap();
        println!("whatsapp placed: {placed}");
        app.command(&Command::Hide).unwrap();
    }
}
