//! The game's own radio list, for the cab's Radio app: `live_streams.sii` in the game's Documents folder, the
//! stations its radio menu offers. The game writes them as one `live_stream_def` unit, each station a `stream_data`
//! entry of its own: `url|name|genre|language|bitrate|…`. A mod's list may write them as `live_stream` units instead,
//! each station's fields its own attributes. Both are read as the game's other definition files are
//! (`westplay_mapdata::sii`): the file is the player's own text, the game may rewrite it, and a mod may bring its
//! own stations.
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

/// The stations of the list's text, in its order: an http(s) stream each, once. A station the game gave no name
/// is its stream; a stream the app can't play is left out.
pub fn stations_in(text: &str) -> Vec<Station> {
    let mut stations: Vec<Station> = Vec::new();
    for unit in sii::parse(text) {
        for station in stations_of(&unit) {
            if stations.iter().any(|each| each.url == station.url) {
                continue;
            }
            stations.push(station);
            if stations.len() == MOST {
                return stations;
            }
        }
    }
    stations
}

/// A unit's stations: a `live_stream_def`'s `stream_data` entries (the game's own list: `url|name|genre|language|
/// bitrate|…`, and a count of them as the plain `stream_data` before them), or a `live_stream`'s own attributes
/// (a mod's list, and the shape the list had before). A unit of another class is no station.
fn stations_of(unit: &sii::Unit) -> Vec<Station> {
    match unit.class.as_str() {
        "live_stream_def" => unit.all("stream_data").filter_map(station_of_word).collect(),
        "live_stream" => {
            let words = |key: &str| unit.get(key).unwrap_or("");
            let bitrate = unit.number("bitrate").filter(|kbps| *kbps > 0.0).map_or(0, |kbps| kbps.round() as u32);
            station(words("stream_data"), words("name"), words("genre"), words("language"), bitrate)
                .into_iter()
                .collect()
        }
        _ => Vec::new(),
    }
}

/// One station of the game's own list as its `stream_data` entry has it: `url|name|genre|language|bitrate|…`.
/// The fields after the bitrate aren't shown in the cab (the game's own flags for the station).
fn station_of_word(word: &str) -> Option<Station> {
    let mut fields = word.split('|');
    let url = fields.next()?;
    let name = fields.next().unwrap_or("");
    let genre = fields.next().unwrap_or("");
    let language = fields.next().unwrap_or("");
    let bitrate = fields
        .next()
        .and_then(|kbps| kbps.trim().parse::<f32>().ok())
        .filter(|kbps| *kbps > 0.0)
        .map_or(0, |kbps| kbps.round() as u32);
    station(url, name, genre, language, bitrate)
}

/// A station of `url`, its name the stream's when the game gives it none; `None` for a stream the app can't play.
fn station(url: &str, name: &str, genre: &str, language: &str, bitrate: u32) -> Option<Station> {
    let url = url.trim();
    if !is_stream(url) {
        return None;
    }
    let name = name.trim();
    Some(Station {
        name: if name.is_empty() { url.to_owned() } else { name.to_owned() },
        genre: genre.trim().to_owned(),
        language: language.trim().to_owned(),
        bitrate,
        url: url.to_owned(),
    })
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

    /// A player's list, as the game writes it: one `live_stream_def` unit, its stations the `stream_data` entries
    /// after their count (`url|name|genre|language|bitrate|flag`). It has the same stream twice, a station with no
    /// name or bitrate, one that isn't a stream, and a station whose name has escaped bytes.
    const LIST: &str = r#"SiiNunit
{
live_stream_def : _nameless.243.56b4.eef8 {
 stream_data: 6
 stream_data[0]: "https://radio.example/one|Radio One|Pop|ESP|128|1"
 stream_data[1]: "http://radio.example/two|Radio Two|Rock|ENG|160.0|0"
 stream_data[2]: "https://radio.example/one|Radio One again|Pop|ESP|128|0"
 stream_data[3]: "https://radio.example/four||Dance|||0"
 stream_data[4]: "file:///music.mp3|Not a stream|Rock|ENG|128|0"
 stream_data[5]: "https://radio.example/five|FunX (Pa\xc3\xadses Bajos)|Afro|HOL|128|0"
}
}
"#;

    /// A mod's list, as the list had each station before: a `live_stream` unit of its own.
    const UNITS: &str = r#"SiiNunit
{
live_stream : radio.one
{
name: "Radio One"
genre: "Pop"
language: "English"
bitrate: 128.0
stream_data: "https://radio.example/one"
}

live_stream : radio.two
{
name: "Radio Two"
genre: "Rock"
language: "ENG"
stream_data: "http://radio.example/two"
}
}
"#;

    #[test]
    fn reads_the_stations_of_the_games_list() {
        let stations = stations_in(LIST);
        let urls: Vec<&str> = stations.iter().map(|station| station.url.as_str()).collect();
        assert_eq!(
            urls,
            [
                "https://radio.example/one",
                "http://radio.example/two",
                "https://radio.example/four",
                "https://radio.example/five",
            ]
        );
        assert_eq!(
            stations[0],
            Station {
                name: "Radio One".into(),
                genre: "Pop".into(),
                language: "ESP".into(),
                bitrate: 128,
                url: "https://radio.example/one".into(),
            }
        );
        // A bitrate the game wrote as a float is its whole number, and one it left out is none.
        assert_eq!(stations[1].bitrate, 160);
        assert_eq!(stations[2].bitrate, 0);
        // A station with no name of its own is its stream.
        assert_eq!((stations[2].name.as_str(), stations[2].genre.as_str()), ("https://radio.example/four", "Dance"));
        // A name with escaped bytes is its text.
        assert_eq!(stations[3].name, "FunX (Países Bajos)");
    }

    #[test]
    fn reads_a_mods_list_of_stations() {
        let stations = stations_in(UNITS);
        let urls: Vec<&str> = stations.iter().map(|station| station.url.as_str()).collect();
        assert_eq!(urls, ["https://radio.example/one", "http://radio.example/two"]);
        assert_eq!((stations[0].genre.as_str(), stations[0].language.as_str()), ("Pop", "English"));
        // A station that says no bitrate has none.
        assert_eq!((stations[1].language.as_str(), stations[1].bitrate), ("ENG", 0));
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
            r#"{"stations":[{"bitrate":128,"genre":"Pop","language":"ESP","name":"Radio One","url":"https://radio.example/one"}],"type":"radio"}"#
        );
    }
}
