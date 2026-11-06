//! The cab's view of the paired phone: keeps what the phone last said, and hands the page one snapshot.
//!
//! The transport is [`westplay_link`]; this is the host's side of it. A snapshot rather than deltas means a
//! reloaded page (or a page that missed a message while its process was restarting) gets the whole truth in
//! one message, and the Phone app has no state to rebuild.

use std::path::Path;

use westplay_link as link;

/// The most notifications kept: a phone can post hundreds, and the cab only needs the recent ones.
const MOST_NOTIFICATIONS: usize = 100;
/// The most contacts kept in memory (a whole address book is far smaller).
const MOST_CONTACTS: usize = 5000;
/// The most calls kept from the phone's log: the newest ones, as the cab lists them.
const MOST_RECENTS: usize = 60;

/// The link and what it last said.
pub struct Phone {
    server: Option<link::Server>,
    state: State,
    /// What the phone said it couldn't do, until the page has been told (it shows them, then they're gone).
    errors: Vec<String>,
}

/// What the companion window's Setup shows of the link: whether a phone is connected, which one, and how to
/// pair it. Pairing is the companion's: the cabin page's Phone app draws only the phone's content.
#[derive(Clone, Debug, Default, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhoneStatus {
    pub connected: bool,
    pub device: Option<link::Device>,
    pub pairing: Option<link::Pairing>,
}

#[derive(Default)]
struct State {
    connected: bool,
    /// Whether the address book or the call log has arrived since the phone connected: an empty list before then
    /// is "not here yet", not "nothing", and the cab says which.
    ready: bool,
    device: Option<link::Device>,
    notifications: Vec<link::Notification>,
    contacts: Vec<link::Contact>,
    recents: Vec<link::Recent>,
    call: Option<link::Call>,
}

impl Phone {
    /// Opens the LAN door, keeping the pairing token in `token_file` so a phone stays paired across launches.
    pub fn start(token_file: &Path) -> Phone {
        let server = link::Server::open(token_file);
        match &server {
            Some(server) => {
                let pairing = server.pairing();
                log!("[phone] waiting for a phone at {}:{}", pairing.host, pairing.port);
            }
            None => log!("[phone] no local network door: the Phone app can't pair"),
        }

        Phone { server, state: State::default(), errors: Vec::new() }
    }

    /// Applies everything the phone said since last time, and returns the page's new message when anything
    /// changed: the whole snapshot for a change of its own, and only the notifications for theirs (the address book
    /// and the call log are the page's to keep, and re-sending them for every notification would copy them each
    /// time).
    pub fn poll(&mut self) -> Option<String> {
        let mut changed = false;
        let mut whole = false;
        // The phone's whole list (a connect or a sync), not a single post: a backlog, not news.
        let mut snapshot = false;
        while let Some(update) = self.server.as_ref().and_then(link::Server::try_next) {
            changed = true;
            snapshot |= matches!(&update, link::Update::Notifications { .. });
            whole |= !is_notes(&update);
            self.apply(update);
        }
        if !changed {
            return None;
        }
        Some(if whole { self.state_message() } else { self.notes_message(snapshot) })
    }

    /// The phone's notifications alone: what changes far more often than the rest of it. `backlog` marks the whole
    /// list the phone sends as it connects or syncs (not news): the cab fills its list without announcing each.
    pub fn notes_message(&self, backlog: bool) -> String {
        let mut message = serde_json::json!({
            "type": "phoneNotes",
            "notifications": &self.state.notifications,
        });
        if backlog {
            message["backlog"] = serde_json::Value::Bool(true);
        }
        message.to_string()
    }

    /// What the phone said it couldn't do since last asked, and forgets them (the page says them, once each).
    pub fn take_errors(&mut self) -> Vec<String> {
        std::mem::take(&mut self.errors)
    }

    /// The whole phone as the page knows it: sent as the page loads and whenever it changes.
    pub fn state_message(&self) -> String {
        let state = serde_json::json!({
            "connected": self.state.connected,
            "ready": self.state.ready,
            "device": &self.state.device,
            "notifications": &self.state.notifications,
            "contacts": &self.state.contacts,
            "recents": &self.state.recents,
            "call": &self.state.call,
        });
        serde_json::json!({ "type": "phone", "state": state }).to_string()
    }

    /// The link as the companion's Setup shows it.
    pub fn status(&self) -> PhoneStatus {
        PhoneStatus {
            connected: self.state.connected,
            device: self.state.device.clone(),
            pairing: self.server.as_ref().map(|server| server.pairing().clone()),
        }
    }

    /// Forgets the phone (the Setup's unpair): the link takes a new token, and what the old phone sent goes with
    /// it. Returns the page's new snapshot, or `None` when this PC has no door to unpair at.
    pub fn unpair(&mut self) -> Option<String> {
        self.server.as_mut()?.unpair();
        self.state = State::default();
        Some(self.state_message())
    }

    /// Sends a command from the cab to the phone. Returns whether a phone took it.
    pub fn command(&self, command: link::Command) -> bool {
        self.server.as_ref().is_some_and(|server| server.command(&command))
    }

    fn apply(&mut self, update: link::Update) {
        match update {
            link::Update::Connected { device, .. } => {
                self.state.connected = true;
                self.state.ready = false;
                self.state.device = Some(device);
                // The phone sends its snapshots as it connects: what came from an earlier session is stale.
                self.state.notifications.clear();
                self.state.contacts.clear();
                self.state.recents.clear();
                self.state.call = None;
            }
            link::Update::Disconnected { .. } => {
                self.state.connected = false;
                self.state.device = None;
                self.state.call = None;
                // The notifications stay: the driver may still want to read what came before the phone slept.
            }
            link::Update::Notifications { mut notifications } => {
                sort_notifications(&mut notifications);
                notifications.truncate(MOST_NOTIFICATIONS);
                self.state.notifications = notifications;
            }
            link::Update::Notification { notification } => {
                match self.state.notifications.iter_mut().find(|each| each.id == notification.id) {
                    Some(existing) => *existing = notification,
                    None => self.state.notifications.push(notification),
                }
                sort_notifications(&mut self.state.notifications);
                self.state.notifications.truncate(MOST_NOTIFICATIONS);
            }
            link::Update::NotificationRemoved { id } => {
                self.state.notifications.retain(|notification| notification.id != id);
            }
            link::Update::Contacts { contacts } => {
                self.state.ready = true;
                self.state.contacts = contacts;
                self.state.contacts.sort_by_key(|contact| contact.name.to_lowercase());
                self.state.contacts.truncate(MOST_CONTACTS);
            }
            link::Update::Recents { mut recents } => {
                self.state.ready = true;
                // Newest first, as the cab lists them; the phone already sorts, but its clock is its own.
                recents.sort_by(|a, b| b.time.cmp(&a.time).then_with(|| a.id.cmp(&b.id)));
                recents.truncate(MOST_RECENTS);
                self.state.recents = recents;
            }
            link::Update::Call { call } => {
                self.state.call = (call.state != link::CallState::Idle).then_some(call);
            }
            link::Update::Battery { level, charging } => {
                if let Some(device) = &mut self.state.device {
                    device.battery = Some(level);
                    device.charging = Some(charging);
                }
            }
            link::Update::Ack { ok, error, .. } => {
                // Only the refusals: a command that worked needs no words. The phone's own reason when it gave
                // one (the cab's dialer couldn't be opened, the call wouldn't end).
                if !ok {
                    self.errors.push(error.unwrap_or_else(|| "The phone couldn’t do that.".to_owned()));
                }
            }
        }
    }
}

/// Whether a change is only the phone's notifications (the page can take those without the rest of it).
fn is_notes(update: &link::Update) -> bool {
    matches!(
        update,
        link::Update::Notification { .. }
            | link::Update::NotificationRemoved { .. }
            | link::Update::Notifications { .. }
    )
}

/// Newest first; notifications without a time last, by id so the order doesn't wander.
fn sort_notifications(notifications: &mut [link::Notification]) {
    notifications.sort_by(|a, b| b.time.cmp(&a.time).then_with(|| a.id.cmp(&b.id)));
}

#[cfg(test)]
mod tests {
    use super::{is_notes, Phone, State, MOST_NOTIFICATIONS, MOST_RECENTS};
    use westplay_link as link;

    fn phone() -> Phone {
        Phone { server: None, state: State::default(), errors: Vec::new() }
    }

    fn notification(id: &str, time: u64) -> link::Notification {
        link::Notification {
            id: id.into(),
            package: "com.app".into(),
            app: "App".into(),
            icon: None,
            title: Some("Title".into()),
            text: Some("Text".into()),
            time: Some(time),
            ongoing: false,
            clearable: true,
            group: None,
            category: None,
            priority: 0,
            actions: vec![],
        }
    }

    fn contact(id: &str, name: &str) -> link::Contact {
        link::Contact { id: id.into(), name: name.into(), numbers: vec!["555".into()], photo: None }
    }

    fn recent(id: &str, time: u64) -> link::Recent {
        link::Recent {
            id: id.into(),
            number: "555".into(),
            name: None,
            kind: link::RecentKind::Incoming,
            time,
            duration: 0,
        }
    }

    #[test]
    fn the_snapshot_is_a_phone_message_without_the_pairing() {
        let message = phone().state_message();
        let value: serde_json::Value = serde_json::from_str(&message).unwrap();
        assert_eq!(value["type"], "phone");
        assert_eq!(value["state"]["connected"], false);
        assert!(value["state"]["notifications"].as_array().unwrap().is_empty());
        assert!(value["state"]["recents"].as_array().unwrap().is_empty());
        assert!(value["state"].get("pairing").is_none(), "pairing is the companion's, never the cab's");
    }

    /// A pairing file of this test's own, so tests running side by side don't share a token.
    fn pairing_file() -> std::path::PathBuf {
        use std::sync::atomic::{AtomicU64, Ordering};
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let nanos =
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |since| since.subsec_nanos());
        std::env::temp_dir().join(format!(
            "westplay-phone-pairing-{}-{nanos}-{}.txt",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ))
    }

    #[test]
    fn the_companion_gets_the_door_the_phone_connects_to() {
        let server = link::Server::open(&pairing_file()).expect("the door opens");
        let door = server.pairing().clone();
        let phone = Phone { server: Some(server), state: State::default(), errors: Vec::new() };
        let pairing = phone.status().pairing.expect("the Setup pairs the phone");
        assert_eq!(pairing.host, door.host);
        assert_eq!(pairing.port, door.port);
        assert_eq!(pairing.token, door.token);
        assert!(pairing.uri.starts_with("cabinplay://pair?host="), "the card shows the line the phone is given");
        assert!(!phone.state_message().contains(&door.token), "the cabin page is never handed the token");
    }

    #[test]
    fn the_companion_status_carries_the_device_and_the_pairing() {
        let mut phone = phone();
        assert_eq!(phone.status().pairing, None);
        phone.apply(link::Update::Connected { device: link::Device::default(), peer: "127.0.0.1:1".into() });
        let status = phone.status();
        assert!(status.connected);
        assert!(status.device.is_some());
        assert!(status.pairing.is_none(), "no door on this phone: the Setup says so");
    }

    #[test]
    fn unpairing_takes_the_phone_and_what_it_sent_with_it() {
        let mut phone = Phone {
            server: Some(link::Server::open(&pairing_file()).expect("the door opens")),
            state: State::default(),
            errors: Vec::new(),
        };
        let before = phone.status().pairing.expect("the Setup pairs the phone");
        phone.apply(link::Update::Connected { device: link::Device::default(), peer: "127.0.0.1:1".into() });
        phone.apply(link::Update::Contacts { contacts: vec![contact("1", "Ada")] });
        phone.apply(link::Update::Recents { recents: vec![recent("r1", 5)] });
        phone.apply(link::Update::Notifications { notifications: vec![notification("a", 1)] });

        let message = phone.unpair().expect("a door to unpair at");
        let after = phone.status().pairing.expect("still paired, with a new code");
        assert_ne!(after.token, before.token, "the phone that paired can't come back with its old code");
        assert!(!phone.status().connected);
        let value: serde_json::Value = serde_json::from_str(&message).unwrap();
        assert_eq!(value["state"]["connected"], false);
        assert!(value["state"]["contacts"].as_array().unwrap().is_empty(), "the old phone's address book is gone");
        assert!(value["state"]["recents"].as_array().unwrap().is_empty(), "and its call log");
        assert!(value["state"]["notifications"].as_array().unwrap().is_empty());
        assert!(!message.contains(&after.token), "the cab is never handed the code, old or new");
    }

    #[test]
    fn unpairing_needs_a_door() {
        assert!(phone().unpair().is_none(), "with no local network door there's nothing to forget");
    }

    #[test]
    fn the_call_log_is_newest_first_and_bounded() {
        let mut phone = phone();
        phone.apply(link::Update::Recents { recents: vec![recent("a", 10), recent("b", 30), recent("c", 20)] });
        let ids: Vec<_> = phone.state.recents.iter().map(|call| call.id.as_str()).collect();
        assert_eq!(ids, ["b", "c", "a"]);

        let many = (0..MOST_RECENTS + 10).map(|i| recent(&format!("r{i}"), i as u64)).collect::<Vec<_>>();
        phone.apply(link::Update::Recents { recents: many });
        assert_eq!(phone.state.recents.len(), MOST_RECENTS, "the oldest calls make way for the newest");
        assert_eq!(phone.state.recents[0].id, format!("r{}", MOST_RECENTS + 9));
    }

    #[test]
    fn a_new_session_starts_its_call_log_again() {
        let mut phone = phone();
        phone.apply(link::Update::Connected { device: link::Device::default(), peer: "127.0.0.1:1".into() });
        phone.apply(link::Update::Recents { recents: vec![recent("r1", 5)] });
        assert_eq!(phone.state.recents.len(), 1);
        phone.apply(link::Update::Connected { device: link::Device::default(), peer: "127.0.0.1:1".into() });
        assert!(phone.state.recents.is_empty(), "a phone that connects again sends its own log");
    }

    #[test]
    fn a_command_the_phone_could_not_do_is_said_to_the_page() {
        let mut phone = phone();
        phone.apply(link::Update::Ack { id: 1, ok: true, error: None });
        assert!(phone.take_errors().is_empty(), "a command that worked needs no words");

        phone.apply(link::Update::Ack { id: 2, ok: false, error: Some("The dialer couldn’t be opened".into()) });
        phone.apply(link::Update::Ack { id: 3, ok: false, error: None });
        assert_eq!(
            phone.take_errors(),
            ["The dialer couldn’t be opened", "The phone couldn’t do that."],
            "the phone's reason, or the page's own when it gave none"
        );
        assert!(phone.take_errors().is_empty(), "said once");
    }

    #[test]
    fn the_lists_are_known_to_have_arrived() {
        let mut phone = phone();
        phone.apply(link::Update::Connected { device: link::Device::default(), peer: "127.0.0.1:1".into() });
        assert!(!phone.state.ready, "an empty list before the phone's own is not \"nothing\"");
        phone.apply(link::Update::Recents { recents: vec![recent("r1", 5)] });
        assert!(phone.state.ready);
    }

    #[test]
    fn only_the_notifications_travel_alone() {
        assert!(is_notes(&link::Update::Notification { notification: notification("a", 1) }));
        assert!(is_notes(&link::Update::NotificationRemoved { id: "a".into() }));
        assert!(is_notes(&link::Update::Notifications { notifications: vec![] }));
        assert!(!is_notes(&link::Update::Contacts { contacts: vec![] }));
        assert!(!is_notes(&link::Update::Call { call: link::Call::default() }));
        assert!(!is_notes(&link::Update::Connected { device: link::Device::default(), peer: "x".into() }));
    }

    #[test]
    fn a_snapshot_is_marked_as_the_phones_backlog() {
        let mut phone = phone();
        phone.apply(link::Update::Notifications { notifications: vec![notification("a", 1)] });
        let backlog: serde_json::Value = serde_json::from_str(&phone.notes_message(true)).unwrap();
        assert_eq!(backlog["backlog"], true);
        let posted: serde_json::Value = serde_json::from_str(&phone.notes_message(false)).unwrap();
        assert!(posted.get("backlog").is_none(), "a single post is news, and says nothing of a backlog");
    }

    #[test]
    fn notifications_are_newest_first_and_replaced_by_id() {
        let mut phone = phone();
        phone.apply(link::Update::Notifications {
            notifications: vec![notification("a", 10), notification("b", 30), notification("c", 20)],
        });
        let ids: Vec<_> = phone.state.notifications.iter().map(|n| n.id.as_str()).collect();
        assert_eq!(ids, ["b", "c", "a"]);

        phone.apply(link::Update::Notification { notification: notification("a", 40) });
        let ids: Vec<_> = phone.state.notifications.iter().map(|n| n.id.as_str()).collect();
        assert_eq!(ids, ["a", "b", "c"]);

        phone.apply(link::Update::NotificationRemoved { id: "b".into() });
        let ids: Vec<_> = phone.state.notifications.iter().map(|n| n.id.as_str()).collect();
        assert_eq!(ids, ["a", "c"]);
    }

    #[test]
    fn the_list_stays_bounded() {
        let mut phone = phone();
        let many = (0..MOST_NOTIFICATIONS + 20).map(|i| notification(&format!("n{i}"), i as u64)).collect::<Vec<_>>();
        phone.apply(link::Update::Notifications { notifications: many });
        assert_eq!(phone.state.notifications.len(), MOST_NOTIFICATIONS);
        assert_eq!(phone.state.notifications[0].id, format!("n{}", MOST_NOTIFICATIONS + 19));
    }

    #[test]
    fn contacts_are_sorted_by_name_and_survive_a_sleep() {
        let mut phone = phone();
        phone.apply(link::Update::Contacts { contacts: vec![contact("2", "zoe"), contact("1", "Ada")] });
        assert_eq!(
            phone.state.contacts.iter().map(|contact| contact.name.as_str()).collect::<Vec<_>>(),
            ["Ada", "zoe"]
        );

        phone.apply(link::Update::Disconnected { peer: "127.0.0.1:1".into() });
        assert_eq!(phone.state.contacts.len(), 2, "the driver can still read them while the phone sleeps");

        phone.apply(link::Update::Connected { device: link::Device::default(), peer: "127.0.0.1:1".into() });
        assert!(phone.state.contacts.is_empty(), "a new session sends its own address book");
    }

    #[test]
    fn a_disconnect_keeps_the_notifications_but_lets_the_call_go() {
        let mut phone = phone();
        phone.apply(link::Update::Connected { device: link::Device::default(), peer: "127.0.0.1:1".into() });
        phone.apply(link::Update::Notifications { notifications: vec![notification("a", 1)] });
        phone.apply(link::Update::Call {
            call: link::Call { id: "1".into(), state: link::CallState::Ringing, ..Default::default() },
        });
        assert!(phone.state.call.is_some());
        phone.apply(link::Update::Disconnected { peer: "127.0.0.1:1".into() });
        assert!(!phone.state.connected);
        assert_eq!(phone.state.notifications.len(), 1);
        assert!(phone.state.call.is_none());
    }
}
