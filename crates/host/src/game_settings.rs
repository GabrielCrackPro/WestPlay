//! The player's settings in the game: the camera's, for YouTube's sound to turn with the camera as the game turns
//! it ("steering-follow camera rotation", on or off, and its multiplier), the regional units, for every figure
//! Cabin Play shows to be in the driver's own, and the clock, for every time it shows to read as the game's does.
//! The game keeps them in the player's profile, `config_local.cfg` (`uset g_cam_steering "1"`,
//! `uset g_use_miles "1"`, `uset g_clock_24 "1"`); the profile in use is the one written last. Read again now and
//! then: a change in the game's menu applies.

use std::path::PathBuf;
use std::time::{Duration, Instant, SystemTime};

/// How far the game turns the interior camera at full lock, at a multiplier of 100% (degrees). The game
/// doesn't say: as it looked in the game (45 each way).
pub const STEERING_LOOK_DEGREES: f32 = 45.0;

/// How often the settings are read again.
const EVERY: Duration = Duration::from_secs(5);

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CameraSettings {
    /// Whether the camera turns with the steering, and how much (1.0: the game's 100%).
    pub steering: bool,
    pub steering_multiplier: f32,
}

impl Default for CameraSettings {
    /// The game's own defaults.
    fn default() -> Self {
        Self { steering: true, steering_multiplier: 1.0 }
    }
}

/// The player's regional units, from the game's Options › Interface › Regional Settings: one switch, "Use
/// miles". The game a profile belongs to says which miles: American Truck Simulator's come with US gallons and
/// Fahrenheit, Euro Truck Simulator 2's with litres and Celsius (as Britain drives).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct RegionalUnits {
    pub miles: bool,
    pub american: bool,
}

impl Default for RegionalUnits {
    /// The game's own default: kilometres, and Europe's litres and Celsius.
    fn default() -> Self {
        Self { miles: false, american: false }
    }
}

/// The settings Cabin Play reads from a profile.
#[derive(Clone, Copy, Debug, PartialEq)]
struct ProfileSettings {
    camera: CameraSettings,
    units: RegionalUnits,
    /// The player's clock (Options › Gameplay › "24-hour clock notation"): 24 hours, the game's own default, or
    /// 12 with AM and PM.
    clock_24: bool,
}

impl ProfileSettings {
    fn read(text: &str, american: bool) -> Self {
        let mut miles = false;
        let mut clock_24 = true;
        for line in text.lines() {
            let mut words = line.split_whitespace();
            if words.next() != Some("uset") {
                continue;
            }
            match (words.next(), words.next()) {
                (Some("g_use_miles"), Some(value)) => miles = value.trim_matches('"') != "0",
                (Some("g_clock_24"), Some(value)) => clock_24 = value.trim_matches('"') != "0",
                _ => {}
            }
        }
        Self { camera: CameraSettings::read(text), units: RegionalUnits { miles, american }, clock_24 }
    }
}

impl CameraSettings {
    /// How far the camera is turned for this steering (the SDK's: -1 to 1, counterclockwise), in turns
    /// counterclockwise (as the head's heading).
    pub fn steering_turn(&self, steering: f32) -> f32 {
        if !self.steering || !steering.is_finite() {
            return 0.0;
        }
        steering.clamp(-1.0, 1.0) * self.steering_multiplier * STEERING_LOOK_DEGREES / 360.0
    }

    /// The settings in a profile's config (`uset name "value"` lines); the defaults where it doesn't say.
    fn read(text: &str) -> Self {
        let mut settings = Self::default();
        for line in text.lines() {
            let mut words = line.split_whitespace();
            if words.next() != Some("uset") {
                continue;
            }
            let (Some(name), Some(value)) = (words.next(), words.next()) else { continue };
            let value = value.trim_matches('"');
            match name {
                "g_cam_steering" => settings.steering = value != "0",
                "g_cam_steering_value" => {
                    if let Ok(multiplier) = value.parse::<f32>()
                        && multiplier.is_finite()
                    {
                        settings.steering_multiplier = multiplier.clamp(0.0, 4.0);
                    }
                }
                _ => {}
            }
        }
        settings
    }
}

/// The settings, read again every [`EVERY`].
pub struct GameSettings {
    settings: ProfileSettings,
    read_at: Option<Instant>,
}

impl GameSettings {
    pub fn new() -> Self {
        Self {
            settings: ProfileSettings {
                camera: CameraSettings::default(),
                units: RegionalUnits::default(),
                clock_24: true,
            },
            read_at: None,
        }
    }

    /// The settings, read again if they are due.
    fn current(&mut self) -> ProfileSettings {
        if self.read_at.is_none_or(|at| at.elapsed() >= EVERY) {
            self.read_at = Some(Instant::now());
            if let Some((path, american)) = latest_profile_config()
                && let Ok(text) = std::fs::read_to_string(path)
            {
                self.settings = ProfileSettings::read(&text, american);
            }
        }
        self.settings
    }

    pub fn camera(&mut self) -> CameraSettings {
        self.current().camera
    }

    pub fn units(&mut self) -> RegionalUnits {
        self.current().units
    }

    /// The player's clock: `true` for 24 hours, `false` for 12 with AM and PM.
    pub fn clock_24(&mut self) -> bool {
        self.current().clock_24
    }
}

/// The `config_local.cfg` written last, of every profile of either game (ETS2's, ATS's; Steam's and local), and
/// whether it is ATS's (whose miles are the US's).
fn latest_profile_config() -> Option<(PathBuf, bool)> {
    // Wherever Documents is: Windows' and OneDrive's may both hold a game's folder.
    let mut latest: Option<(SystemTime, PathBuf, bool)> = None;
    for documents in westplay_setup::places::documents_folders() {
        for game in ["Euro Truck Simulator 2", "American Truck Simulator"] {
            let american = game == "American Truck Simulator";
            for kind in ["steam_profiles", "profiles"] {
                let Ok(profiles) = std::fs::read_dir(documents.join(game).join(kind)) else { continue };
                for profile in profiles.flatten() {
                    let config = profile.path().join("config_local.cfg");
                    let Ok(written) = std::fs::metadata(&config).and_then(|m| m.modified()) else { continue };
                    if latest.as_ref().is_none_or(|(at, ..)| written > *at) {
                        latest = Some((written, config, american));
                    }
                }
            }
        }
    }
    latest.map(|(_, path, american)| (path, american))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_steering_camera_from_a_profiles_config() {
        let config =
            "uset g_cam_steering_reverse \"1\"\nuset g_cam_steering_value \"0.5\"\nuset g_cam_steering \"1\"\n";
        let settings = CameraSettings::read(config);
        assert_eq!(settings, CameraSettings { steering: true, steering_multiplier: 0.5 });
        // Full left lock (counterclockwise): half the full turn, to the left.
        assert!((settings.steering_turn(1.0) - STEERING_LOOK_DEGREES / 2.0 / 360.0).abs() < 1e-6);
        assert!(settings.steering_turn(-1.0) < 0.0);
        // Off: no turn.
        assert_eq!(CameraSettings::read("uset g_cam_steering \"0\"").steering_turn(1.0), 0.0);
        // Not said: the game's defaults.
        assert_eq!(CameraSettings::read(""), CameraSettings::default());
        assert_eq!(CameraSettings::read("uset g_cam_steering_value \"nan\"").steering_multiplier, 1.0);
    }

    #[test]
    fn reads_the_clock_from_a_profiles_config() {
        // The game's own default is 24 hours, and a profile that says nothing keeps it.
        assert!(ProfileSettings::read("", false).clock_24);
        assert!(ProfileSettings::read("uset g_clock_24 \"1\"", false).clock_24);
        assert!(!ProfileSettings::read("uset g_clock_24 \"0\"", false).clock_24);
    }

    #[test]
    fn reads_the_regional_units_from_a_profiles_config() {
        let settings = ProfileSettings::read("uset g_use_miles \"1\"\n", true);
        assert_eq!(settings.units, RegionalUnits { miles: true, american: true });
        // ETS2's miles, and a profile that says nothing: kilometres.
        assert_eq!(ProfileSettings::read("uset g_use_miles \"1\"", false).units.miles, true);
        assert_eq!(ProfileSettings::read("", false).units, RegionalUnits::default());
        assert_eq!(ProfileSettings::read("uset g_use_miles \"0\"", true).units.miles, false);
    }
}
