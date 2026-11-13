import type { Sky } from '../../../shared/host'
import type { ReturnKind } from '../../keyboard/layouts'
import type { TurnKind } from '../../maps/guidance'
import type { DestinationKind } from '../../maps/places'
import type { AppId } from '../apps'

/**
 * The cabin's own words, in English and Turkish, with Spanish translations where available. Place names on
 * the map come from the game's own text in its language (crates/mapdata locale.rs), not from here.
 */

export type Language = 'en' | 'tr' | 'es'

export interface Strings {
  /** The decimal separator: "9.4 km", "9,4 km". */
  decimal: string
  /** A 12-hour clock's halves of the day: "AM" and "PM" ("ÖÖ"/"ÖS", "a. m."/"p. m."). */
  am: string
  pm: string
  /** A whole number using the language's thousands separator. */
  number: (value: number) => string
  /** The trip pill: "15:40 arrival · 12 min · 9.4 km". */
  arrival: string
  minutes: (minutes: number) => string
  hours: (hours: number, minutes: string) => string
  speedLimit: (limit: number) => string
  /** Turn-by-turn. */
  now: string
  then: string
  arrive: string
  turns: Record<Exclude<TurnKind, 'roundabout'>, string>
  roundabout: (exit: number) => string
  /** Maps. */
  recentre: string
  /** The compass: turns the map north up, seen from above. */
  northUp: string
  zoomIn: string
  zoomOut: string
  /** Maps' search: its button, and the field's hint. */
  search: string
  searchPlaces: string
  close: string
  /** The voice assistant's button and its short notes. */
  voice: {
    unavailable: string
    noSpeech: string
    notUnderstood: string
    done: string
    /** The Settings reference: what the player can say, by what it does. */
    commands: string
    commandsHint: string
    groups: readonly { title: string; phrases: readonly string[] }[]
  }
  /** Destinations (Maps' search): its sections, what places are (one, and the nearby lists'), the place
   * card's buttons, and how the game answered. */
  destinations: {
    favourites: string
    headquarters: string
    yourGarage: string
    findNearby: string
    /** "Find nearby" on a route: the places offered are along it. */
    alongRoute: string
    /** The Dashboard map's strip of the next services along the route. */
    servicesAhead: string
    recents: string
    /** The Maps app's button: the whole route at once, from above. */
    wholeRoute: string
    /** Settings › Maps: how much the map draws, and how it behaves. */
    mapDetail: string
    mapBalanced: string
    mapNight: string
    mapJunction: string
    mapTrucks: string
    mapTraffic: string
    mapRecentre: string
    mapNever: string
    /** The route, the truck's marker and the map's furniture, each as the player likes it. */
    routeColour: string
    routeBlue: string
    routeTeal: string
    routePurple: string
    routeAmber: string
    routeWeight: string
    weightThin: string
    weightStandard: string
    weightBold: string
    marker: string
    markerArrow: string
    markerDot: string
    markerTruck: string
    markerSize: string
    sizeSmall: string
    sizeMedium: string
    sizeLarge: string
    mapNorth: string
    mapLimit: string
    mapOver: string
    mapCompass: string
    mapScale: string
    mapStyle: string
    mapStyleStandard: string
    mapStyleSatellite: string
    mapStyleTerrain: string
    mapNightFrom: string
    /** ETA milestone alerts. */
    etaMinutesAway: (minutes: number) => string
    etaMilesAway: (distance: string) => string
    etaApproaching: string
    unreachableDestination: string
    pinStyle: string
    pinFilled: string
    pinOutlined: string
    pinsFuel: string
    pinsParking: string
    pinsService: string
    /** A stop on the map's strip: which of the player's stops it is. */
    stopNumber: (number: number) => string
    /** Destinations' button that empties the recents. */
    clearRecents: string
    /** The Stops page: its name and list, and the tank against the route left. */
    stops: string
    stopsAhead: string
    toGo: string
    rangeSpare: (distance: string) => string
    rangeTight: (distance: string) => string
    rangeShort: (distance: string) => string
    stopsNoRoute: string
    noStops: string
    /** The cab's note when the game's route changes under the truck. */
    routeChanged: string
    /** The card at the end of a drive. */
    arrived: string
    kinds: Record<DestinationKind, string>
    nearby: Partial<Record<DestinationKind, string>>
    straightLine: (distance: string) => string
    /** How far along the route a place is. */
    alongTheRoute: (distance: string) => string
    /** A stop added: how much longer the route is with it (the game's distance and time). */
    stopAdds: (distance: string, time: string) => string
    /** A stop added, but the game's new route doesn't pass it. */
    notOnRoute: string
    /** The routes offered before Go (Directions), by what each is planned for; while they're found. */
    plans: Record<'fastest' | 'shortest' | 'smallRoads' | 'other', string>
    finding: string
    /** Go: the route is set, but the game takes its own way there, not the one picked. */
    ownWay: string
    go: string
    addStop: string
    endRoute: string
    back: string
    noResults: string
    loading: string
    noPlaces: string
    done: Record<'go' | 'addStop' | 'end', string>
    alreadyThere: string
    full: string
    onJob: string
    noAnswer: string
    /** The game runs as administrator: WestPlay can't see its route. */
    elevated: string
    unsupported: string
    failed: string
  }
  /** The keyboard: its keys (named for screen readers where they show a symbol), and a field's clear button. */
  keyboard: {
    space: string
    returnKey: Record<ReturnKind, string>
    shift: string
    capsLock: string
    delete: string
    nextKeyboard: string
    hide: string
    clear: string
    /** Whether the player's own keyboard types into the field. */
    typingWithKeyboard: string
    pausedWhileDriving: string
    selectToType: string
  }
  /** Music. */
  nowPlaying: string
  sources: string
  previous: string
  play: string
  pause: string
  next: string
  shuffle: string
  repeat: string
  notPlaying: string
  openMusicApp: string
  nothingLoaded: string
  playing: string
  fuel: string
  income: string
  range: (distance: string) => string
  /** The Dashboard's destination widget: the job's pickup or delivery, or where the route ends. */
  delivery: string
  pickup: string
  destination: string
  mapPoint: string
  arriveBy: (time: string) => string
  late: string
  /** Days of the week, short, from Monday (the game's day 0). */
  days: readonly string[]
  /** The Dashboard's weather widget: the weather, and the weather it's turning to. */
  weather: Record<Sky, string>
  weatherTurning: Record<Sky, string>
  /** The YouTube app: the search field's hint, Home's sections and chips (each a search), what a list says
   * when it's empty or YouTube didn't answer, the live badge, and the player's words. */
  youtube: {
    search: string
    continueWatching: string
    recentSearches: string
    chips: readonly { label: string; query: string }[]
    start: string
    noResults: string
    failed: string
    tryAgain: string
    live: string
    upNext: string
    nowPlaying: string
    back: string
    volume: string
    forget: string
    fill: string
    clear: string
    fullScreen: string
    signIn: string
    signOut: string
    /** A search's results: all of them, or channels only. */
    all: string
    channels: string
    subscribe: string
    subscribed: string
    /** Playlists: a search's filter, the word under one found, and its page's button. */
    playlists: string
    playlist: string
    playAll: string
    /** The player's captions and quality, and their choices for none and YouTube's own. */
    captions: string
    off: string
    quality: string
    auto: string
    /** The player's gear: its settings, and in them the speed (and its 1×), the audio track (dubbed ones),
     * YouTube's Stable volume and Voice boost. */
    settings: string
    playbackSpeed: string
    normal: string
    audioTrack: string
    stableVolume: string
    voiceBoost: string
    home: string
    subscriptions: string
    /** While Google's sign-in window is open on the PC. */
    finishOnPc: string
    /** Double-tapping a side of the player: "10 seconds". */
    seconds: (seconds: number) => string
  }
  /** The Spotify app, in Spotify's own words: while its sign-in window is open on the PC; its tabs and the
   * search pill's hint; Home's filters; what things are ("Playlist • Spotify"); the pages' words; Now
   * Playing's; and the toasts of adding to Liked Songs or Your Library. */
  spotify: {
    finishOnPc: string
    whatToPlay: string
    home: string
    library: string
    browse: string
    back: string
    filters: { all: string; music: string; podcasts: string }
    showAll: string
    browseAll: string
    recentSearches: string
    clearRecent: string
    forget: string
    noResults: (query: string) => string
    noResultsHint: string
    topResult: string
    songs: string
    artists: string
    playlists: string
    albums: string
    podcasts: string
    kinds: { playlist: string; album: string; artist: string; show: string; liked: string; song: string }
    songCount: (count: number) => string
    /** A playlist's length: "2 hr 45 min", "38 min 12 sec". */
    length: (seconds: number) => string
    recents: string
    gridView: string
    listView: string
    verified: string
    follow: string
    following: string
    monthlyListeners: (count: string) => string
    popular: string
    discography: string
    playingFrom: { playlist: string; album: string; artist: string; show: string; liked: string }
    nowPlaying: string
    queue: string
    nextFrom: (name: string) => string
    nextUp: string
    /** Now Playing's words for the song (Spotify's Lyrics): none, not timed yet, and where they're from. */
    lyrics: string
    noLyrics: string
    notSynced: string
    lyricsFrom: (provider: string) => string
    /** Now Playing's volume. */
    volume: string
    mute: string
    unmute: string
    /** Spotify didn't play what was asked for. */
    cantPlay: string
    /** Spotify didn't answer. */
    failed: string
    tryAgain: string
    next: string
    previous: string
    shuffle: string
    repeat: string
    close: string
    more: string
    download: string
    addToLiked: string
    addToLibrary: string
    added: string
    removed: string
    addedToLibrary: string
    removedFromLibrary: string
    /** Signing in (Spotify's "Log in"), up and out; the account's button. */
    logIn: string
    signUp: string
    logOut: string
    account: string
    /** Signed out, at the foot: Spotify's banner for its preview. */
    previewTitle: string
    previewText: string
    signUpFree: string
    /** The log-in prompt, by what the player tried: to play, to save, to make a playlist. */
    prompts: {
      play: { title: string; text: string }
      save: { title: string; text: string }
      playlist: { title: string; text: string }
    }
    haveAccount: string
    notNow: string
    /** Your Library, signed out: Spotify's two first steps. */
    firstPlaylist: { title: string; text: string; button: string }
    firstPodcasts: { title: string; text: string; button: string }
    /** The "E" of an explicit song. */
    explicit: string
  }
  /** The Music app (Apple Music), in Apple's own words: its tabs and search field; its pages' and sections'
   * words; what things are ("Album · Tarkan"); its buttons, Now Playing's and Up Next's; its sign-in, and the
   * toasts of favouriting and adding to the Library. */
  appleMusic: {
    tabs: { home: string; new: string; radio: string; library: string; search: string }
    searchHint: string
    browseCategories: string
    recentlySearched: string
    clear: string
    topResults: string
    songs: string
    artists: string
    albums: string
    playlists: string
    stations: string
    noResults: string
    noResultsHint: string
    seeAll: string
    recentlyPlayed: string
    recentlyAdded: string
    kinds: {
      album: string
      playlist: string
      artist: string
      station: string
      song: string
      curator: string
      folder: string
    }
    /** "11 songs, 43 minutes" */
    length: (songs: number, seconds: number) => string
    topSongs: string
    play: string
    shuffle: string
    live: string
    explicit: string
    preview: string
    upNext: string
    /** Now Playing's words for the song (Apple Music's Lyrics), none, and who wrote them. */
    lyrics: string
    noLyrics: string
    writtenBy: (names: string) => string
    /** "From Blue Hour" (Up Next, the songs to come from where it plays). */
    from: (name: string) => string
    favorite: string
    favorited: string
    unfavorited: string
    addToLibrary: string
    added: string
    signIn: string
    signOut: string
    /** The account's button (its picture). */
    account: string
    /** A Library list's controls: the filter and More, their choices, and its search field's hint. */
    filter: string
    more: string
    all: { playlists: string; albums: string; songs: string }
    favorites: string
    grid: string
    list: string
    find: string
    /** The playlists' sorts (the other lists' are Apple Music's own words). */
    sorts: { name: string; '-dateAdded': string; '-lastPlayed': string; '-updated': string; type: string }
    /** While Apple Music's sign-in window is open on the PC. */
    finishOnPc: string
    /** Home, signed out. */
    homePitch: { title: string; text: string }
    /** The Library, signed out. */
    libraryPitch: { title: string; text: string }
    /** The sign-in prompt, and why. */
    promptTitle: string
    promptFor: { library: string; favorite: string }
    notNow: string
    /** The banner while songs play as their previews. */
    previewBanner: { title: string; text: string }
    empty: string
    cantPlay: string
    failed: string
    tryAgain: string
    back: string
    close: string
    nowPlaying: string
    next: string
    previous: string
    repeat: string
    volume: string
    mute: string
    unmute: string
  }
  /** YouTube Music: WestPlay's own app, in the look of YouTube Music's tablet app. */
  youtubeMusic: {
    tabs: { home: string; explore: string; library: string; search: string }
    searchHint: string
    remove: string
    more: string
    play: string
    shuffle: string
    radio: string
    save: string
    saved: string
    removed: string
    inLibrary: string
    like: string
    dislike: string
    /** The Song/Video switch. */
    song: string
    video: string
    upNext: string
    lyrics: string
    related: string
    playingFrom: string
    noLyrics: string
    shelves: {
      playlists: string
      songs: string
      albums: string
      artists: string
      subscriptions: string
      history: string
    }
    topResult: string
    /** "1.2M subscribers" */
    subscribers: (count: string) => string
    signIn: string
    signOut: string
    account: string
    /** While Google's sign-in window is open on the PC. */
    finishOnPc: string
    /** The Library, signed out. */
    libraryPitch: { title: string; text: string }
    /** The sign-in prompt, and why. */
    promptTitle: string
    promptFor: { library: string; like: string; save: string }
    notNow: string
    empty: string
    noResults: string
    cantPlay: string
    failed: string
    tryAgain: string
    back: string
    close: string
    nowPlaying: string
    pause: string
    next: string
    previous: string
    repeat: string
    /** An ad playing (YouTube Music's own, if one ever comes through). */
    ad: string
    /** A song's ⋮ and its choices, and what's said as they're made. */
    moreActions: string
    startRadio: string
    playNext: string
    addToQueue: string
    goToAlbum: string
    goToArtist: string
    willPlayNext: string
    addedToQueue: string
    volume: string
  }
  /** The Weather app: where the truck is, the game's next change of weather and the roads. */
  weatherApp: {
    myLocation: string
    nextChange: string
    /** "In about 1:42 hrs" */
    inAbout: (time: string) => string
    roads: string
    roadStates: { dry: string; damp: string; wet: string }
    roadTrends: { drying: string; gettingWet: string }
    /** No game, or one whose weather WestPlay can't read. */
    unavailable: string
  }
  /** The Settings app: its pages, rows and the words under them. */
  settings: {
    appearance: string
    light: string
    dark: string
    automatic: string
    automaticFooter: string
    /** The truck's information bar beside WestPlay (the DAF's, the Scania Smart Dash's), and what it is. */
    vehicleBar: string
    vehicleBarFooter: string
    /** Units (Settings › Appearance): the driver's choice, and what following the game means. */
    units: string
    unitsFooter: string
    unitsGame: string
    /** The list's sections: how the screen looks, what the cab's own displays show, the navigation (the map and the
     * game's voice over it), and the apps. */
    screenSection: string
    cabSection: string
    navSection: string
    appsSection: string
    /** The page holding the driver's units and the clock, both of which can follow the game. */
    unitsClock: string
    clockFormat: string
    clockFormatFooter: string
    clockFormatGame: string
    clockFormat24: string
    clockFormat12: string
    unitsMetric: string
    unitsUk: string
    unitsUs: string
    textSize: string
    /** Text Size's own text, shown at the size chosen (iOS's). */
    textSizeAbout: string
    wallpaper: string
    /** App Icons: the page's name and the look's; then Reduce Motion, the switch and what it does. */
    icons: string
    iconStyle: string
    reduceMotion: string
    reduceMotionFooter: string
    /** The Dashboard's own order (Auto order, and moving a widget up or down it). */
    autoOrder: string
    autoOrderFooter: string
    moveUp: string
    moveDown: string
    dashboard: string
    widgets: string
    /** The Dashboard layout editor: the live column, dragging a card, and each widget's share of the room. */
    widgetLayout: string
    widgetLayoutFooter: string
    widgetPresets: string
    presetFocus: string
    presetMedia: string
    presetWeather: string
    widgetSize: string
    widgetCompact: string
    widgetStandard: string
    widgetExpanded: string
    /** The Dashboard's Overview screen: turning it on, opening the Dashboard on it, and its cards. */
    overviewScreen: string
    openOverview: string
    overviewCards: string
    overviewCardsFooter: string
    /** The cards taken off the Overview, kept under the picture so a tap can put them back. */
    overviewHidden: string
    /** The Overview page's own reset, back to how a new Dashboard comes. */
    resetOverview: string
    overviewFooter: string
    /** The truck's instrument cluster, replaced by WestPlay on the trucks it is built for. */
    clusterScreen: string
    clusterSwitch: string
    clusterCards: string
    /** The cards taken off the cluster, kept under the picture so a tap can put them back. */
    clusterHidden: string
    clusterFooter: string
    clusterCardTrip: string
    clusterCardFuel: string
    clusterCardEngine: string
    clusterCardHours: string
    clusterCardWarnings: string
    /** The cluster's gauges: a level read as a percentage of what it holds, or as its own units. */
    clusterGauges: string
    clusterGaugePercent: string
    clusterGaugeFooter: string
    /** The engine card's three readings: the slots, what they can show, and the instant consumption's own name. */
    clusterReadings: string
    clusterReadingsFooter: string
    clusterReadingSlot: (slot: number) => string
    clusterReadingInstant: string
    /** The dial's own marks — the tacho's ring and the maker's mark — and the accent its live marks are drawn in. */
    clusterDial: string
    clusterDialFooter: string
    clusterTacho: string
    clusterBrandMark: string
    clusterAccent: string
    clusterAccentFooter: string
    clusterAccentRoute: string
    clusterAccentPlay: string
    clusterAccentNeutral: string
    /** The cluster's layout: its two columns, the ready-made ones, and the sides a card can be on. */
    clusterLayout: string
    clusterLayoutFooter: string
    clusterTestLamps: string
    /** What the right column carries whatever the layout (the tank's companions), as the preview draws it. */
    clusterLayoutFixed: string
    clusterPresets: string
    presetClusterStandard: string
    presetClusterHours: string
    presetClusterTank: string
    clusterSideLeft: string
    clusterSideRight: string
    /** The Instrument Cluster page's own reset, back to how a new dash comes. */
    resetCluster: string
    /** The player's own Dashboard layouts: naming the current one, saving it, and removing it again. */
    saveLayout: string
    layoutName: string
    yourLayouts: string
    save: string
    cancel: string
    deleteLayout: string
    /** Home Screen: which apps show there, and their order. */
    homeScreen: string
    homeScreenFooter: string
    showOnHome: string
    hideFromHome: string
    editHomeScreen: string
    homeOrder: string
    resetHomeScreen: string
    /** Pinning apps to the sidebar: the group's name, what a pinned app does, and taking it out again (the
     * sidebar icon's own menu). */
    pinToSidebar: string
    unpinFromSidebar: string
    pinnedFooter: string
    /** The sidebar's clock: the player's own time, or the game's. */
    realClock: string
    clockFooter: string
    /** The Dashboard's player on one line, and what it leaves out. */
    /** Settings search: its field, and what it says when nothing matches. */
    search: string
    noResults: string
    showAlbumArt: string
    /** Sound, and in it the Equalizer: the speakers as tuned (Recommended) or the player's own tone (Custom), what
     * it does, its three bands under the graph, and the curve set back. */
    sound: string
    /** The cabin's own sounds (presses, notes, the volume): what they do, in a line. */
    uiSounds: string
    uiSoundVolume: string
    uiSoundsFooter: string
    /** The page the game's GPS voice has of its own, and its row under Navigation on the list. */
    gpsVoicePage: string
    /** The music dipping under the game's GPS voice, as the switch reads. */
    gpsDuck: string
    /** What the dip is, and what it leaves alone. */
    gpsDuckFooter: string
    /** How early the dip begins, as the card's heading, and the three choices in it. */
    gpsDuckLead: string
    /** The seconds of road the choices are, and the trade they make. */
    gpsDuckLeadFooter: string
    gpsDuckLeadJust: string
    gpsDuckLeadFew: string
    gpsDuckLeadEarly: string
    /** Whether the cabin marks the voice on screen, at the screens' edges: the switch's label and the note under it. */
    gpsVoice: string
    gpsVoiceFooter: string
    /** The GPS row's word for a dip or sign that is switched off (the list's Navigation section, and its row). */
    gpsVoiceOff: string
    /** The voice assistant's switch, and the push-to-talk chord set in the companion. */
    voiceAssistant: string
    /** `{key}`: the chord. */
    voiceAssistantFooter: string
    voiceHotkey: string
    /** The background phrase that starts the assistant without the chord. */
    voiceWake: string
    /** The short lead-in before the truck's derived phrase (`Say “Hey Scania”`). */
    voiceWakePhrase: string
    voiceWakeFooter: string
    equalizer: string
    recommended: string
    custom: string
    equalizerFooter: string
    low: string
    mid: string
    high: string
    resetEqualizer: string
    /** Maps: its own pages — what it draws, the traffic, the route's line, and the markers and pins. */
    mapsDisplay: string
    /** The card of map controls on the Display page: north up, the limit's sign, the compass and the scale. */
    mapControls: string
    mapsRoute: string
    mapsMarkers: string
    /** The card under turn-by-turn, and when it shows. */
    stopCard: string
    stopCardAlways: string
    stopCardFuel: string
    stopCardRest: string
    stopCardFooter: string
    back: string
    /** General: the app's version, and the controls to reset or back up the player's choices. */
    general: string
    generalSection: string
    version: string
    resetAllSettings: string
    resetAllSettingsFooter: string
    exportSettings: string
    exportSettingsFooter: string
    importSettings: string
    importSettingsFooter: string
    storageManagement: string
    storageUsed: string
    clearCache: string
    clearCacheFooter: string
    /** Theme presets: pre-built combinations of accent color, appearance, and wallpaper. */
    themePresets: string
    themePresetsFooter: string
    themePresetMidnight: string
    themePresetSunrise: string
    themePresetForest: string
    themePresetOcean: string
    themePresetEmber: string
    themePresetDefault: string
    accentColor: string
    accentColorFooter: string
    /** Multi-profile support: driver profiles with their own settings. */
    profiles: string
    profilesSection: string
    profilesFooter: string
    currentProfile: string
    addProfile: string
    addProfileFooter: string
    removeProfile: string
    removeProfileFooter: string
    profileName: string
    profileNamePlaceholder: string
    /** Quick Access Control Center: quick toggles for common settings. */
    controlCenter: string
    quickAccess: string
    doNotDisturb: string
    uiSoundsToggle: string
    voiceAssistantToggle: string
    volume: string
    /** Dashboard widgets: new widget types. */
    widgetJob: string
    widgetFuel: string
    widgetSpeed: string
    widgetJobFooter: string
    widgetFuelFooter: string
    widgetSpeedFooter: string
    /** Cross-app now playing bar. */
    nowPlayingBar: string
    nowPlayingBarFooter: string
    /** Customization section in settings list. */
    customization: string
  }
  /** Apps. */
  /** The Diagnostics app: the truck's engine, tires and brakes, and what each reading says. */
  diagnostics: {
    engine: string
    tires: string
    brakes: string
    coolant: string
    oil: string
    oilTemperature: string
    wear: string
    rpm: string
    airPressure: string
    brakeTemperature: string
    parkingBrake: string
    applied: string
    released: string
    normal: string
    warm: string
    high: string
    low: string
    worn: string
    stopped: string
    celsius: string
    psi: string
    kmh: string
    km: string
    litres: string
    volts: string
    lPer100: string
    battery: string
    oilPressure: string
    brakeAir: string
    adblue: string
    /** The worst readings since the engine came on (the trip's span), and how many ways the game warned. */
    sinceStart: string
    warnings: string
    /** The cluster's strip of telltales: its indicators, lights, states and warnings together. */
    telltales: string
    /** Fuel consumption this moment, beside the trip's average. */
    instant: string
    /** The truck's damage, the worst of its parts (the dash's warning and stop lamps). */
    damage: string
    consumption: string
    odometer: string
    retarder: string
    gear: string
    trailer: string
    hitched: string
    unhitched: string
    wearEngine: string
    wearTransmission: string
    wearCabin: string
    wearChassis: string
    wearTrailer: string
    trailerWear: string
    healthScore: string
    running: string
    engineOff: string
    check: string
    service: string
    fuel: string
    range: string
    chassis: string
    off: string
    trip: string
    distance: string
    used: string
    average: string
    time: string
    /** The clock's own name (the dash's time of day, as against the trip's time): "Time", "Hora", "Saat". */
    clock: string
    reset: string
    noTelemetry: string
    overview: string
    driverHours: string
    restStop: string
    mandatoryBreak: string
    noRest: string
    noJob: string
    controls: string
    cruiseControl: string
    lights: string
    hazardLights: string
    wipers: string
    hours: string
    minutes: string
    parkingLight: string
    lowBeam: string
    highBeam: string
    indicatorLeft: string
    indicatorRight: string
    on: string
    trailerType: string
    plate: string
    body: string
  }
  /** The driver's profile and lifetime totals, from the game's latest save. */
  driver: {
    profile: string
    noProfile: string
    savedCareer: string
    experience: string
    totalDistance: string
    gameTime: string
    realTime: string
    fuelUsed: string
    citiesVisited: string
    cancelledJobs: string
    saveUnavailable: string
  }
  /** The Notifications app: the notes the cab has shown, and what they read. */
  notificationsApp: {
    empty: string
    /** When notes come: the game's warnings and the rest clocks. */
    hint: string
    alerts: string
    warnings: string
    alert: string
    warning: string
    /** The filters above the list: all of it, only the alerts, or only the warnings. */
    all: string
    clear: string
    /** Taking a note off the screen's stack. */
    dismiss: string
    /** A filter with none of its tone in the list. */
    none: string
    /** Above the list: how many the list holds (it's kept on this PC, so past drives are in it too). */
    summary: (count: number) => string
    /** A note's action: open Maps (a fuel or rest stop) or Diagnostics. */
    openMaps: string
    openDiagnostics: string
  }
  /** The Phone app: the paired phone, its contacts, calls and notifications. */
  phoneApp: {
    /** How many notifications the phone has posted (the host keeps the most recent). */
    summary: (count: number) => string
    empty: string
    /** Where the notifications come from, and what to do about them. */
    hint: string
    refresh: string
    connected: string
    disconnected: string
    /** The same, in the sidebar's chip, where a status line has room for a couple of words ("Not connected" is
     * cut to nothing there). */
    noPhone: string
    /** While no phone is connected: keep the bridge running on the phone, and where it's paired (the companion
     * window's Setup, never the cab). */
    pairingHint: string
    /** The Bridge app's own name and its version, under the phone's in the sidebar. */
    bridge: (version: string) => string
    battery: (level: number) => string
    charging: string
    dismiss: string
    /** A ringing call: answer it, or decline it; and one in progress. */
    answer: string
    decline: string
    end: string
    ringing: string
    inCall: string
    unknownCaller: string
    /** The contacts the phone sent, and the search among them. */
    contacts: string
    contactsHint: string
    contactsEmpty: string
    searchContacts: string
    dial: string
    noMatches: string
    /** How many contacts the search shows, out of how many the phone sent. */
    showing: (shown: number, total: number) => string
    /** The phone's notifications, as the Phone app names them (apart from the truck's Alerts app). */
    notifications: string
    /** The reply composer's send button. */
    send: string
    /** The search above the phone's call log. */
    searchRecents: string
    /** A notification's app: hide its future notifications, or show them again. */
    muteApp: string
    unmuteApp: string
    /** The notifications page's take them all down, for the ones the phone lets it dismiss. */
    clearAll: string
    /** An app's card holds its newest notification alone: the one that opens the rest, and the one that closes them. */
    showAll: (count: number) => string
    showFewer: string
    /** A contact's star, unpressed and pressed. */
    addFavourite: string
    removeFavourite: string
    /** The app's first tab: what the phone has waiting — its notifications, its missed calls, its address book. */
    overview: string
    /** The overview's figures, and its sections: the newest notifications and the last calls. */
    missedCalls: string
    latestNotifications: string
    recentCalls: string
    seeAll: string
    /** The overview with nothing from the phone to show. */
    nothingNew: string
    /** The calls the phone made and took, and how many there are. */
    recents: string
    recentCount: (count: number) => string
    recentsEmpty: string
    recentsHint: string
    /** One call's kind, and how long it lasted (`duration`: seconds). */
    incoming: string
    outgoing: string
    missed: string
    otherCall: string
    duration: (seconds: number) => string
    /** A call in the log's button: dial that number again. */
    callBack: string
    /** A dial asked for, before the phone makes it: who it's to (`dialTitle`), the second press's hint, and the
     * press that calls it off. */
    dialTitle: (who: string) => string
    dialHint: string
    cancel: string
    /** While the phone's first snapshot is on its way: an empty list before it is "not here yet". */
    syncing: string
    /** The keypad's 0: a press types it, a long press types + (for an international number). */
    holdPlus: string
    /** A ringing call's Decline, pressed once: the next press is what drops it. */
    declineAgain: string
    /** The Keypad tab: the number being typed, what its field says while it's empty, and its buttons. */
    keypad: string
    keypadHint: string
    call: string
    /** The backspace key: a press deletes a digit, a long press clears the number. */
    delete: string
    deleteHold: string
  }
  /** The WhatsApp app: WhatsApp's own page in the cab's window. */
  whatsappApp: {
    /** In a plain browser, where the page can't show. */
    preview: string
  }
  /** The Radio app: the stations of the game's own radio list, by genre, and what plays. */
  radioApp: {
    /** How many stations the list has. */
    summary: (count: number) => string
    empty: string
    /** Where the stations come from, and what to do about them. */
    hint: string
    /** The genre filter that shows every station. */
    all: string
    /** The stations the game gives no genre to. */
    other: string
    refresh: string
    /** The set's face while nothing plays. */
    idle: string
    /** Its one button: it plays the station, and pauses the one playing. */
    play: string
    pause: string
    /** The buttons either side of it: the station before the one playing, and the one after. */
    previous: string
    next: string
    playingNow: string
    /** Its stream is still opening: it isn't playing yet. */
    tuning: string
    paused: string
    /** A station that didn't play: off the air, or its server refused the cab. */
    unavailable: string
    /** What the preset of a station that didn't play says. */
    unavailableTag: string
    /** The search field: a station by its name, among many. */
    search: string
    /** Nothing in the list has the name typed. */
    noMatches: string
    volume: string
    /** The stations the player picked, above the genres. */
    favourites: string
    /** A station’s star, unpressed, and pressed. */
    addFavourite: string
    removeFavourite: string
    /** The streams a station's playlist offers (a station at more than one bitrate), named as a group. */
    channels: string
    /** A stream the playlist gives no name to, by its place in the list. */
    stream: (number: number) => string
  }
  /** The sidebar icon's options button, named after the app it belongs to. */
  appOptions: (app: string) => string
  apps: Record<AppId, string>
  notBuiltYet: string
}
