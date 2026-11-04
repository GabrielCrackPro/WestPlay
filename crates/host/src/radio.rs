//! The game's own radio list, for the cab's Radio app: `live_streams.sii` in the game's Documents folder, the
//! stations its radio menu offers. Each is a `live_stream` unit of the game's definition files (name, genre,
//! language, bitrate and `stream_data`), read as its other definition files are (`westplay_mapdata::sii`): the
//! file is the player's own text, the game may rewrite it, and a mod may bring its own stations.
//!
//! Read while WestPlay runs, as the page loads and whenever the app asks again (`radioStations`): a station added
//! in the game shows after its Refresh.

use std::path::PathBuf;

use westplay_mapdata::sii;

/// The list's file, in the game's Documents folder.
pub const FILE: &str = "live_streams.sii";

/// How many stations are sent: a mod's list is not a place to freeze the cab.
const MOST: usize = 1000;

/// A station the game's radio menu has.
#[derive(Clone, Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Station {
    pub name: String,
    pub genre: String,
    pub language: String,
    /// kbit/s (0: not said).
    pub bitrate: u32,
    pub url: String,
}

/// The stations of the list's text, in its order: a `live_stream` with an http(s) stream, each once. A station
/// the game gave no name is its stream; a unit of another class, or a stream the app can't play, is left out.
pub fn stations_in(text: &str) -> Vec<Station> {
    let mut stations: Vec<Station> = Vec::new();
    for unit in sii::parse(text) {
        if unit.class != "live_stream" {
            continue;
        }
        let Some(url) = unit.get("stream_data").map(str::trim).filter(|url| is_stream(url)) else { continue };
        if stations.iter().any(|station| station.url == url) {
            continue;
        }
        let words = |key: &str| unit.get(key).unwrap_or("").trim().to_owned();
        let name = words("name");
        stations.push(Station {
            name: if name.is_empty() { url.to_owned() } else { name },
            genre: words("genre"),
            language: words("language"),
            bitrate: unit.number("bitrate").filter(|kbps| *kbps > 0.0).map_or(0, |kbps| kbps.round() as u32),
            url: url.to_owned(),
        });
        if stations.len() == MOST {
            break;
        }
    }
    stations
}

fn is_stream(url: &str) -> bool {
    let url = url.to_ascii_lowercase();
    url.starts_with("http://") || url.starts_with("https://")
}

/// The list's file, in the game's Documents folder (`None`: no Documents folder to look in).
pub fn stations_file() -> Option<PathBuf> {
    Some(westplay_setup::places::game_documents()?.join(FILE))
}

/// The game's stations: the list read now, or none (no file, or one WestPlay can't read).
pub fn game_stations() -> Vec<Station> {
    stations_file().and_then(|file| std::fs::read_to_string(file).ok()).map_or_else(Vec::new, |text| stations_in(&text))
}

/// `{"type":"radio","stations":[{"name":"…","genre":"…","language":"…","bitrate":128,"url":"…"},…]}`: the stations
/// for the cab's Radio app.
pub fn stations_message(stations: &[Station]) -> String {
    serde_json::json!({ "type": "radio", "stations": stations }).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A player's list, as the game writes it: one quoted station, one with a float bitrate, a unit of another
    /// class, the same stream twice, a station with no name and one that isn't a stream at all.
    const LIST: &str = r#"SiiNunit
{
live_stream : radio.one
{
name: "Radio One"
genre: "Pop"
language: "English"
bitrate: 128
stream_data: "https://radio.example/one"
}

live_stream : radio.two
{
name: "Radio Two"
genre: "Rock"
bitrate: 160.0
stream_data: "http://radio.example/two"
}

city_data : city.x
{
name: "Not a station"
stream_data: "https://radio.example/three"
}

live_stream : radio.again
{
name: "Again"
stream_data: "https://radio.example/one"
}

live_stream : radio.noname
{
stream_data: "https://radio.example/four"
}

live_stream : radio.bad
{
name: "Not a stream"
stream_data: "file:///music.mp3"
}
}
"#;

    #[test]
    fn reads_the_stations_of_the_games_list() {
        let stations = stations_in(LIST);
        let urls: Vec<&str> = stations.iter().map(|station| station.url.as_str()).collect();
        assert_eq!(urls, ["https://radio.example/one", "http://radio.example/two", "https://radio.example/four"]);
        assert_eq!(
            stations[0],
            Station {
                name: "Radio One".into(),
                genre: "Pop".into(),
                language: "English".into(),
                bitrate: 128,
                url: "https://radio.example/one".into(),
            }
        );
        // A bitrate the game wrote as a float is its whole number.
        assert_eq!(stations[1].bitrate, 160);
        // A station with no name of its own is its stream, and it has no genre.
        assert_eq!((stations[2].name.as_str(), stations[2].genre.as_str()), ("https://radio.example/four", ""));
    }

    #[test]
    fn a_list_with_nothing_playable_is_no_stations() {
        assert!(stations_in("").is_empty());
        assert!(
            stations_in("SiiNunit\n{\nlive_stream : radio.bad\n{\nstream_data: \"file:///music.mp3\"\n}\n}\n")
                .is_empty()
        );
    }

    #[test]
    fn says_what_the_page_reads() {
        assert_eq!(stations_message(&[]), r#"{"stations":[],"type":"radio"}"#);
        let one = stations_message(&stations_in(LIST)[..1]);
        assert_eq!(
            one,
            r#"{"stations":[{"bitrate":128,"genre":"Pop","language":"English","name":"Radio One","url":"https://radio.example/one"}],"type":"radio"}"#
        );
    }
}
