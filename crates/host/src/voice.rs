//! The cabin's voice assistant: Windows' own on-device speech recognition, driven by the cabin page.
//!
//! The page sends the names it knows (contacts, places, apps), so recognition is a list constraint over the
//! commands CabinPlay can actually carry out. Speech never leaves the PC. The microphone is open for one
//! utterance after the player asks for it, or, opt-in, for the background wake phrase that asks for one.
//!
//! Recognition runs on a thread of its own: `RecognizeAsync` blocks until the player stops speaking, and the
//! host's thread must keep drawing the cabin while that happens.

use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};

use base64::Engine as _;
use windows::Foundation::TypedEventHandler;
use windows::Globalization::Language;
use windows::Media::SpeechRecognition::{
    SpeechContinuousRecognitionResultGeneratedEventArgs, SpeechContinuousRecognitionSession,
    SpeechRecognitionListConstraint, SpeechRecognitionResultStatus, SpeechRecognizer,
};
use windows::Media::SpeechSynthesis::{SpeechSynthesizer, VoiceInformation};
use windows::Storage::Streams::{DataReader, IRandomAccessStream};
use windows::Win32::System::Com::{COINIT_MULTITHREADED, CoInitializeEx};
use windows::core::{HSTRING, Interface};

/// What the page knows when it asks for one utterance.
#[derive(Clone, Debug, Default)]
pub struct Vocabulary {
    pub contacts: Vec<String>,
    pub places: Vec<String>,
    pub apps: Vec<String>,
    /// The cabin's language (`en`, `tr` or `es`), so the recogniser listens in it when Windows has its pack.
    pub language: String,
}

/// A change the host should pass to the cabin page.
#[derive(Clone, Debug)]
pub enum Event {
    /// `listening` or `processing`.
    State(&'static str),
    /// What was heard.
    Result(String),
    /// A code the page translates: `unavailable`, `no-speech`, or `failed`.
    Error(&'static str),
    /// The wake phrase was heard: the page opens the assistant as it does for the chord.
    Wake,
    /// A short confirmation as base64 WAV, for the cab's own speakers.
    Audio(String),
}

enum Command {
    Listen(Vocabulary),
    Wake { on: bool },
    WakePhrase { brand: String, language: String },
    Speak { text: String, language: String },
}

/// The voice worker, and the events it has for the host.
pub struct Voice {
    commands: Sender<Command>,
    events: Receiver<Event>,
    /// The recogniser waiting for speech, so a cancel can stop it from outside the worker.
    active: Arc<Mutex<Option<SpeechRecognizer>>>,
}

impl Voice {
    /// Starts the worker. It waits for the page to ask for an utterance.
    pub fn start() -> Self {
        let (commands, inbox) = mpsc::channel();
        let (outbox, events) = mpsc::channel();
        let active = Arc::new(Mutex::new(None));
        let worker_active = Arc::clone(&active);
        let _ = std::thread::Builder::new().name("westplay-voice".into()).spawn(move || {
            // SAFETY: COM on this worker's own thread, once, before the WinRT speech objects are made.
            let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
            // The wake listener is stopped while a command is heard, so it cannot hear the command itself.
            let command_active = Arc::new(AtomicBool::new(false));
            let mut wake_wanted = false;
            let mut wake: Option<Wake> = None;
            let mut wake_brand = String::new();
            let mut wake_language = "en".to_owned();
            while let Ok(command) = inbox.recv() {
                match command {
                    Command::Wake { on } => {
                        wake_wanted = on;
                        if on {
                            if wake.is_none() {
                                wake = Wake::start(
                                    outbox.clone(),
                                    Arc::clone(&command_active),
                                    &wake_brand,
                                    &wake_language,
                                );
                            }
                        } else if let Some(started) = wake.take() {
                            started.stop();
                        }
                    }
                    Command::WakePhrase { brand, language } => {
                        if wake_brand != brand || wake_language != language {
                            wake_brand = brand;
                            wake_language = language;
                            if wake.is_some() {
                                if let Some(started) = wake.take() {
                                    started.stop();
                                }
                                if wake_wanted {
                                    wake = Wake::start(
                                        outbox.clone(),
                                        Arc::clone(&command_active),
                                        &wake_brand,
                                        &wake_language,
                                    );
                                }
                            }
                        }
                    }
                    Command::Listen(vocabulary) => {
                        command_active.store(true, Ordering::Release);
                        if let Some(started) = wake.take() {
                            started.stop();
                        }
                        let _ = outbox.send(Event::State("listening"));
                        let heard = listen(&vocabulary, &worker_active);
                        let _ = outbox.send(Event::State("processing"));
                        let _ = outbox.send(match heard {
                            Ok(text) => Event::Result(text),
                            Err(Failure::NoSpeech) => Event::Error("no-speech"),
                            Err(Failure::Unavailable) => Event::Error("unavailable"),
                        });
                        if wake_wanted {
                            wake =
                                Wake::start(outbox.clone(), Arc::clone(&command_active), &wake_brand, &wake_language);
                        }
                        command_active.store(false, Ordering::Release);
                    }
                    Command::Speak { text, language } => {
                        if let Ok(audio) = synthesize(&text, &language) {
                            let _ = outbox.send(Event::Audio(audio));
                        }
                    }
                }
            }
        });
        Self { commands, events, active }
    }

    /// Asks the worker for one utterance. `false` if it has gone (the host is closing).
    pub fn listen(&self, vocabulary: Vocabulary) -> bool {
        self.commands.send(Command::Listen(vocabulary)).is_ok()
    }

    /// Asks the worker for a short spoken confirmation, returned as a base64 WAV (`Event::Audio`).
    pub fn speak(&self, text: String, language: String) -> bool {
        self.commands.send(Command::Speak { text, language }).is_ok()
    }

    /// Starts or stops the opt-in background wake-phrase listener.
    pub fn set_wake(&self, on: bool) -> bool {
        self.commands.send(Command::Wake { on }).is_ok()
    }

    /// The truck and language the wake phrase follows (the page's, as they change).
    pub fn set_wake_phrase(&self, brand: String, language: String) -> bool {
        self.commands.send(Command::WakePhrase { brand, language }).is_ok()
    }

    /// Stops the recogniser waiting for speech, if one is.
    pub fn cancel(&self) {
        let active = self.active.lock().ok().and_then(|slot| slot.clone());
        if let Some(recognizer) = active {
            let _ = recognizer.StopRecognitionAsync();
        }
    }

    /// The next change, if any: the host passes it to the page.
    pub fn poll(&self) -> Option<Event> {
        self.events.try_recv().ok()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Failure {
    NoSpeech,
    Unavailable,
}

/// The phrases the assistant answers to without the chord: its truck's name, as the cabin's language says it,
/// and the generic cabin fallback. The page sends the truck's name as the game gives it ("Scania").
fn wake_phrases(brand: &str, language: &str) -> Vec<String> {
    let brand: String =
        brand.chars().take(120).map(|character| if character.is_alphanumeric() { character } else { ' ' }).collect();
    let brand = brand.split_whitespace().take(4).collect::<Vec<_>>().join(" ").to_lowercase();
    let prefixes: &[&str] = match language {
        "tr" => &["selam", "merhaba", "hey"],
        "es" => &["hola", "oye", "hey"],
        _ => &["hey", "hi"],
    };
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    if brand.is_empty() {
        for prefix in prefixes {
            add_phrase(&mut out, &mut seen, format!("{prefix} cabin"));
        }
    } else {
        for prefix in prefixes {
            add_phrase(&mut out, &mut seen, format!("{prefix} {brand}"));
        }
    }
    // The assistant is still Cabin Play's: the generic name works with any truck.
    for prefix in ["hey", "hi"] {
        add_phrase(&mut out, &mut seen, format!("{prefix} cabin"));
    }
    out
}

/// The background listener: one recogniser, hearing only the wake phrase, until it is stopped for a command.
struct Wake {
    /// Kept with its session: the session's event belongs to the recogniser.
    _recognizer: SpeechRecognizer,
    session: SpeechContinuousRecognitionSession,
    _result: i64,
    /// False once stopped: a result already on its way from the old session is late news.
    live: Arc<AtomicBool>,
}

impl Wake {
    fn start(outbox: Sender<Event>, active: Arc<AtomicBool>, brand: &str, language: &str) -> Option<Self> {
        let phrases: Vec<HSTRING> = wake_phrases(brand, language).into_iter().map(HSTRING::from).collect();
        let words = windows_collections::IIterable::from(phrases);
        let constraint =
            SpeechRecognitionListConstraint::CreateWithTag(&words, &HSTRING::from("cabinplay-wake")).ok()?;
        let recognizer = recognizer(&Vocabulary { language: language.to_owned(), ..Default::default() }, true).ok()?;
        recognizer.Constraints().ok()?.Append(&constraint).ok()?;
        let compiled = recognizer.CompileConstraintsAsync().ok()?.join().ok()?;
        if compiled.Status().ok()? != SpeechRecognitionResultStatus::Success {
            return None;
        }
        let session = recognizer.ContinuousRecognitionSession().ok()?;
        let live = Arc::new(AtomicBool::new(true));
        let handler_live = Arc::clone(&live);
        let handler = TypedEventHandler::<
            SpeechContinuousRecognitionSession,
            SpeechContinuousRecognitionResultGeneratedEventArgs,
        >::new(move |_sender, args| {
            if let Ok(args) = args.ok()
                && let Ok(result) = args.Result()
                && result.Status().is_ok_and(|status| status == SpeechRecognitionResultStatus::Success)
                && handler_live.load(Ordering::Acquire)
                && !active.load(Ordering::Acquire)
            {
                let _ = outbox.send(Event::Wake);
            }
            Ok(())
        });
        let _result = session.ResultGenerated(&handler).ok()?;
        session.StartAsync().ok()?.join().ok()?;
        Some(Self { _recognizer: recognizer, session, _result, live })
    }

    /// Stops at once, dropping anything the recogniser had not answered yet.
    fn stop(self) {
        self.live.store(false, Ordering::Release);
        let _ = self.session.CancelAsync().and_then(|cancel| cancel.join());
    }
}

/// One utterance, limited to the commands and names CabinPlay knows.
fn listen(vocabulary: &Vocabulary, active: &Arc<Mutex<Option<SpeechRecognizer>>>) -> Result<String, Failure> {
    match recognize(vocabulary, true, active) {
        // A Windows without the cab's language pack falls back to the PC's own language rather than failing
        // outright. (The grammar still carries the commands in all three cabin languages.)
        Err(Failure::Unavailable) if vocabulary.language != "en" => recognize(vocabulary, false, active),
        other => other,
    }
}

fn recognize(
    vocabulary: &Vocabulary,
    with_language: bool,
    active: &Arc<Mutex<Option<SpeechRecognizer>>>,
) -> Result<String, Failure> {
    let phrases = phrases(vocabulary);
    if phrases.is_empty() {
        return Err(Failure::Unavailable);
    }
    let words: Vec<HSTRING> = phrases.iter().map(HSTRING::from).collect();
    let words = windows_collections::IIterable::from(words);
    let constraint = SpeechRecognitionListConstraint::CreateWithTag(&words, &HSTRING::from("cabinplay"))
        .map_err(|_| Failure::Unavailable)?;
    let recognizer = recognizer(vocabulary, with_language)?;
    recognizer
        .Constraints()
        .map_err(|_| Failure::Unavailable)?
        .Append(&constraint)
        .map_err(|_| Failure::Unavailable)?;
    let compiled = recognizer
        .CompileConstraintsAsync()
        .map_err(|_| Failure::Unavailable)?
        .join()
        .map_err(|_| Failure::Unavailable)?;
    if compiled.Status().map_err(|_| Failure::Unavailable)? != SpeechRecognitionResultStatus::Success {
        return Err(Failure::Unavailable);
    }
    let operation = recognizer.RecognizeAsync().map_err(|_| Failure::Unavailable)?;
    if let Ok(mut slot) = active.lock() {
        *slot = Some(recognizer.clone());
    }
    let joined = operation.join().map_err(|_| Failure::Unavailable);
    if let Ok(mut slot) = active.lock() {
        *slot = None;
    }
    let result = joined?;
    let status = result.Status().map_err(|_| Failure::Unavailable)?;
    if status == SpeechRecognitionResultStatus::Success {
        result.Text().map(|text| text.to_string()).map_err(|_| Failure::NoSpeech)
    } else if status == SpeechRecognitionResultStatus::UserCanceled
        || status == SpeechRecognitionResultStatus::Unknown
        || status == SpeechRecognitionResultStatus::TimeoutExceeded
        || status == SpeechRecognitionResultStatus::AudioQualityFailure
    {
        Err(Failure::NoSpeech)
    } else {
        Err(Failure::Unavailable)
    }
}

/// A short spoken confirmation as a base64 WAV, made by the PC's own installed voice.
fn synthesize(text: &str, language: &str) -> Result<String, Failure> {
    let text = text.trim();
    if text.is_empty() || text.len() > 400 {
        return Err(Failure::Unavailable);
    }
    let synth = SpeechSynthesizer::new().map_err(|_| Failure::Unavailable)?;
    if let Some(voice) = voice_for(language) {
        let _ = synth.SetVoice(&voice);
    }
    let stream = synth
        .SynthesizeTextToStreamAsync(&HSTRING::from(text))
        .map_err(|_| Failure::Unavailable)?
        .join()
        .map_err(|_| Failure::Unavailable)?;
    let size = stream.Size().map_err(|_| Failure::Unavailable)?;
    // A confirmation is a sentence, not a podcast: keep a runaway stream from filling the bridge.
    if size == 0 || size > 2_000_000 {
        return Err(Failure::Unavailable);
    }
    let input: IRandomAccessStream = stream.cast().map_err(|_| Failure::Unavailable)?;
    let reader = DataReader::CreateDataReader(&input).map_err(|_| Failure::Unavailable)?;
    reader.LoadAsync(size as u32).map_err(|_| Failure::Unavailable)?.join().map_err(|_| Failure::Unavailable)?;
    let mut bytes = vec![0u8; size as usize];
    reader.ReadBytes(&mut bytes).map_err(|_| Failure::Unavailable)?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

/// A voice that speaks `language`, when Windows has one installed; otherwise the PC's default.
fn voice_for(language: &str) -> Option<VoiceInformation> {
    let tag = match language {
        "tr" => "tr",
        "es" => "es",
        _ => "en",
    };
    let voices = SpeechSynthesizer::AllVoices().ok()?;
    for index in 0..voices.Size().ok()? {
        let voice = voices.GetAt(index).ok()?;
        if voice.Language().ok().is_some_and(|language| language.to_string().to_lowercase().starts_with(tag)) {
            return Some(voice);
        }
    }
    None
}

/// A recogniser for the cab's language, or the PC's own when Windows has no pack for it.
fn recognizer(vocabulary: &Vocabulary, with_language: bool) -> Result<SpeechRecognizer, Failure> {
    if with_language {
        let tag = match vocabulary.language.as_str() {
            "tr" => "tr-TR",
            "es" => "es-ES",
            "en" => "en-US",
            _ => "",
        };
        if !tag.is_empty()
            && let Ok(language) = Language::CreateLanguage(&HSTRING::from(tag))
            && let Ok(recognizer) = SpeechRecognizer::Create(&language)
        {
            return Ok(recognizer);
        }
    }
    SpeechRecognizer::new().map_err(|_| Failure::Unavailable)
}

const MAX_PHRASES: usize = 800;

/// Adds `phrase` once, unless it is empty or too long, keeping the order commands were added in.
fn add_phrase(out: &mut Vec<String>, seen: &mut HashSet<String>, phrase: String) {
    let phrase = phrase.trim().to_owned();
    if phrase.is_empty() || phrase.len() > 120 || !seen.insert(phrase.clone()) {
        return;
    }
    out.push(phrase);
}

/// The phrases the recogniser may return: a fixed command set, plus the names the page sent.
pub fn phrases(vocabulary: &Vocabulary) -> Vec<String> {
    const FIXED: &[&str] = &[
        "open maps",
        "open map",
        "open music",
        "open phone",
        "open spotify",
        "open youtube",
        "open youtube music",
        "open radio",
        "open weather",
        "open settings",
        "open diagnostics",
        "open driver",
        "open notifications",
        "open whatsapp",
        "go home",
        "home",
        "dashboard",
        "show dashboard",
        "play",
        "pause",
        "resume",
        "next",
        "previous",
        "next track",
        "previous track",
        "volume up",
        "turn it up",
        "volume down",
        "turn it down",
        "answer",
        "answer call",
        "end call",
        "hang up",
        "navigate",
        "navigate to",
        "go to",
        "drive to",
        "add stop",
        "add stop at",
        "stop at",
        "end route",
        "cancel route",
        "stop navigation",
        "cancel",
        // The same commands in the cab's Turkish and Spanish, so the on-device grammar hears them too.
        "haritaları aç",
        "müziği aç",
        "telefonu aç",
        "radyo aç",
        "ayarları aç",
        "eve git",
        "ana ekran",
        "gösterge paneli",
        "oynat",
        "duraklat",
        "devam et",
        "sonraki",
        "önceki",
        "sesi aç",
        "sesi kıs",
        "cevapla",
        "aramayı bitir",
        "rotayı bitir",
        "abre mapas",
        "abre música",
        "abre teléfono",
        "abre radio",
        "abre ajustes",
        "ve a casa",
        "inicio",
        "panel",
        "reproducir",
        "pausa",
        "pausar",
        "siguiente",
        "anterior",
        "subir volumen",
        "bajar volumen",
        "contesta",
        "colgar",
        "terminar ruta",
        "finalizar ruta",
    ];
    // Synonyms for the fixed commands, in all three cabin languages. Names are added dynamically below.
    const ALIASES: &[&str] = &[
        "home screen",
        "main screen",
        "show home",
        "show the home screen",
        "open dashboard",
        "play",
        "resume",
        "start music",
        "play music",
        "continue",
        "pause music",
        "stop music",
        "stop playback",
        "next song",
        "skip",
        "skip song",
        "previous song",
        "back",
        "go back",
        "turn up the volume",
        "louder",
        "increase volume",
        "turn down the volume",
        "quieter",
        "decrease volume",
        "answer phone",
        "answer the phone",
        "pick up",
        "accept call",
        "end the call",
        "drop call",
        "end navigation",
        "cancel navigation",
        "stop route",
        "take me to",
        "add a stop at",
        "make a stop at",
        "stop by",
        "eve dön",
        "ana ekrana git",
        "gösterge panelini aç",
        "paneli göster",
        "müziği durdur",
        "sonraki şarkı",
        "önceki şarkı",
        "sesi yükselt",
        "sesi azalt",
        "cevap ver",
        "aramayı kapat",
        "navigasyonu bitir",
        "rotayı iptal et",
        "pantalla de inicio",
        "ve al inicio",
        "vuelve al inicio",
        "abre el panel",
        "muestra el panel",
        "continuar",
        "detener música",
        "siguiente canción",
        "canción anterior",
        "más volumen",
        "menos volumen",
        "contestar",
        "responde",
        "cuelga",
        "terminar llamada",
        "finaliza llamada",
        "cancelar ruta",
        "detener navegación",
        "navegar a",
        "llévame a",
        "ir a",
        "ruta a",
        "añadir una parada en",
        "para en",
        "haz una parada en",
        "llamar a",
        "marca",
    ];
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for phrase in FIXED.iter().chain(ALIASES) {
        add_phrase(&mut out, &mut seen, (*phrase).to_owned());
    }
    for name in
        vocabulary.apps.iter().map(|value| value.trim()).filter(|value| !value.is_empty() && value.len() <= 80).take(20)
    {
        for prefix in ["open ", "launch ", "start ", "show ", "switch to ", "abre ", "abrir ", "lanza "] {
            add_phrase(&mut out, &mut seen, format!("{prefix}{name}"));
        }
        add_phrase(&mut out, &mut seen, format!("{name} aç"));
        add_phrase(&mut out, &mut seen, format!("aç {name}"));
    }
    for name in vocabulary
        .contacts
        .iter()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty() && value.len() <= 80)
        .take(30)
    {
        for prefix in ["call ", "ara ", "llama a ", "llamar a ", "marca "] {
            add_phrase(&mut out, &mut seen, format!("{prefix}{name}"));
        }
    }
    for name in vocabulary
        .places
        .iter()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty() && value.len() <= 80)
        .take(40)
    {
        for prefix in ["navigate to ", "take me to ", "go to ", "drive to ", "git ", "ve a ", "navega a ", "llévame a "]
        {
            add_phrase(&mut out, &mut seen, format!("{prefix}{name}"));
        }
        for prefix in ["add stop at ", "stop at ", "ekle ", "añade una parada en "] {
            add_phrase(&mut out, &mut seen, format!("{prefix}{name}"));
        }
    }
    // A list constraint is compiled by Windows for every utterance: keep it to a size that stays quick.
    out.truncate(MAX_PHRASES);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn includes_the_names_the_page_hands_over() {
        let phrases = phrases(&Vocabulary {
            contacts: vec!["Ada Lovelace".into()],
            places: vec!["Berlin".into()],
            apps: vec!["Haritalar".into()],
            language: "en".into(),
        });
        assert!(phrases.contains(&"call Ada Lovelace".into()));
        assert!(phrases.contains(&"navigate to Berlin".into()));
        assert!(phrases.contains(&"open Haritalar".into()));
    }

    #[test]
    fn wake_phrases_follow_the_truck_and_language() {
        let english = wake_phrases("Scania", "en");
        assert!(english.contains(&"hey scania".to_string()));
        let spanish = wake_phrases("Scania", "es");
        assert!(spanish.contains(&"hola scania".to_string()));
        let turkish = wake_phrases("Mercedes-Benz", "tr");
        assert!(turkish.contains(&"selam mercedes benz".to_string()));
        let no_truck = wake_phrases("", "es");
        assert!(no_truck.contains(&"hola cabin".to_string()));
    }

    #[test]
    fn keeps_the_grammar_bounded() {
        let places = (0..200).map(|n| format!("Place {n}")).collect();
        let phrases = phrases(&Vocabulary { places, ..Default::default() });
        assert!(phrases.len() <= MAX_PHRASES);
        assert!(phrases.contains(&"navigate to Place 0".into()));
        assert!(phrases.contains(&"git Place 1".into()));
    }

    #[test]
    fn hears_the_new_spanish_and_turkish_commands() {
        let phrases = phrases(&Vocabulary {
            contacts: vec!["Ana".into()],
            places: vec!["Madrid".into()],
            apps: vec!["YouTube".into()],
            language: "es".into(),
        });
        assert!(phrases.contains(&"abre YouTube".into()));
        assert!(phrases.contains(&"start YouTube".into()));
        assert!(phrases.contains(&"llama a Ana".into()));
        assert!(phrases.contains(&"llamar a Ana".into()));
        assert!(phrases.contains(&"marca Ana".into()));
        assert!(phrases.contains(&"llévame a Madrid".into()));
        assert!(phrases.contains(&"drive to Madrid".into()));
        assert!(phrases.contains(&"navega a Madrid".into()));
        assert!(phrases.contains(&"stop at Madrid".into()));
        assert!(phrases.contains(&"ekle Madrid".into()));
        assert!(phrases.contains(&"añade una parada en Madrid".into()));
        assert!(phrases.contains(&"detener música".into()));
        assert!(phrases.contains(&"müziği durdur".into()));
    }
}
