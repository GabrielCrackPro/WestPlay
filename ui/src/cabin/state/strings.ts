import type { Sky } from '../../shared/host'
import type { ReturnKind } from '../keyboard/layouts'
import type { TurnKind } from '../maps/guidance'
import type { DestinationKind } from '../maps/places'
import type { AppId } from './apps'

/**
 * The cabin's own words, in English and Turkish, with Spanish translations where available. Place names on
 * the map come from the game's own text in its language (crates/mapdata locale.rs), not from here.
 */

export type Language = 'en' | 'tr' | 'es'

export interface Strings {
  /** The decimal separator: "9.4 km", "9,4 km". */
  decimal: string
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
  /** Destinations (Maps' search): its sections, what places are (one, and the nearby lists'), the place
   * card's buttons, and how the game answered. */
  destinations: {
    favourites: string
    headquarters: string
    yourGarage: string
    findNearby: string
    /** "Find nearby" on a route: the places offered are along it. */
    alongRoute: string
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
    mapNightFrom: string
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
    /** Home Screen: which apps show there, and their order. */
    homeScreen: string
    homeScreenFooter: string
    showOnHome: string
    homeOrder: string
    resetHomeScreen: string
    /** The sidebar's clock: the player's own time, or the game's. */
    realClock: string
    clockFooter: string
    showAlbumArt: string
    /** Sound, and in it the Equalizer: the speakers as tuned (Recommended) or the player's own tone (Custom), what
     * it does, its three bands under the graph, and the curve set back. */
    sound: string
    /** The cabin's own sounds (presses, notes, the volume): what they do, in a line. */
    uiSounds: string
    uiSoundVolume: string
    uiSoundsFooter: string
    equalizer: string
    recommended: string
    custom: string
    equalizerFooter: string
    low: string
    mid: string
    high: string
    resetEqualizer: string
    back: string
  }
  /** Apps. */
  /** The Diagnostics app: the truck's engine, tires and brakes, and what each reading says. */
  diagnostics: {
    engine: string
    tires: string
    brakes: string
    coolant: string
    oil: string
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
    reset: string
    noTelemetry: string
    overview: string
    driverHours: string
    restStop: string
    mandatoryBreak: string
    noRest: string
    controls: string
    cruiseControl: string
    lights: string
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
  /** Career totals from the game's latest profile save. */
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
    history: string
    historyUnavailable: string
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
    clear: string
    /** Above the list: how many the list holds (it's kept on this PC, so past drives are in it too). */
    summary: (count: number) => string
    /** A note's action: open Maps (a fuel or rest stop) or Diagnostics. */
    openMaps: string
    openDiagnostics: string
  }
  apps: Record<AppId, string>
  notBuiltYet: string
}

const ENGLISH_ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth']

const ENGLISH_STRINGS: Strings = {
  decimal: '.',
  number: (value) => new Intl.NumberFormat('en-US').format(value),
  arrival: 'arrival',
  minutes: (minutes) => `${minutes} min`,
  hours: (hours, minutes) => `${hours}:${minutes} hrs`,
  speedLimit: (limit) => `Speed limit ${limit}`,
  now: 'Now',
  then: 'Then',
  arrive: 'Arrive at destination',
  turns: {
    'slight-left': 'Bear left',
    left: 'Turn left',
    'sharp-left': 'Turn sharp left',
    'slight-right': 'Bear right',
    right: 'Turn right',
    'sharp-right': 'Turn sharp right',
    'u-turn': 'Make a U-turn',
    'keep-left': 'Keep left',
    'keep-right': 'Keep right',
    'exit-left': 'Take the exit on the left',
    'exit-right': 'Take the exit on the right',
  },
  roundabout: (exit) => `At the roundabout, take the ${ENGLISH_ORDINALS[exit - 1] ?? `${exit}th`} exit`,
  recentre: 'Recentre',
  northUp: 'North up',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  search: 'Search',
  searchPlaces: 'Search places and cities',
  close: 'Close',
  destinations: {
    favourites: 'Favourites',
    headquarters: 'Headquarters',
    yourGarage: 'Your garage',
    findNearby: 'Find nearby',
    alongRoute: 'Along the route',
    recents: 'Recents',
    wholeRoute: 'Whole route',
    mapDetail: 'Detail',
    mapBalanced: 'Balanced',
    mapNight: 'Dim at Night',
    mapJunction: 'Zoom Out at Junctions',
    mapTrucks: 'Other Drivers',
    mapTraffic: 'Traffic',
    mapRecentre: 'Return to the Truck',
    mapNever: 'Never',
    routeColour: 'Route Colour',
    routeBlue: 'Blue',
    routeTeal: 'Teal',
    routePurple: 'Purple',
    routeAmber: 'Amber',
    routeWeight: 'Route Line',
    weightThin: 'Thin',
    weightStandard: 'Standard',
    weightBold: 'Bold',
    marker: 'Vehicle Marker',
    markerArrow: 'Arrow',
    markerDot: 'Dot',
    markerTruck: 'Truck',
    markerSize: 'Marker Size',
    sizeSmall: 'Small',
    sizeMedium: 'Medium',
    sizeLarge: 'Large',
    mapNorth: 'North Up',
    mapLimit: 'Speed Limit Sign',
    mapOver: 'Warn When Over',
    mapCompass: 'Compass',
    mapScale: 'Scale Bar',
    mapNightFrom: 'Dim From',
    pinStyle: 'Map Pins',
    pinFilled: 'Filled',
    pinOutlined: 'Outlined',
    pinsFuel: 'Fuel Stations',
    pinsParking: 'Rest Places',
    pinsService: 'Service & Repairs',
    stopNumber: (number) => `Stop ${number}`,
    clearRecents: 'Clear',
    routeChanged: 'Route changed',
    arrived: 'You have arrived',
    kinds: {
      fuel: 'Fuel',
      service: 'Service',
      garage: 'Garage',
      dealer: 'Truck dealer',
      company: 'Company',
      parking: 'Rest area',
      hotel: 'Hotel',
      recruitment: 'Recruitment agency',
      weigh: 'Weigh station',
      ferry: 'Ferry',
      train: 'Train',
      city: 'City',
    },
    nearby: {
      fuel: 'Fuel',
      parking: 'Rest areas',
      service: 'Service',
      hotel: 'Hotels',
      company: 'Companies',
      dealer: 'Dealers',
      ferry: 'Ferries',
      city: 'Cities',
    },
    straightLine: (distance) => `${distance} away`,
    alongTheRoute: (distance) => `${distance} along the route`,
    stopAdds: (distance, time) => `Stop added · adds ${distance} and ${time}`,
    notOnRoute: 'Stop added, but the game’s route doesn’t pass it',
    plans: { fastest: 'Fastest', shortest: 'Shortest', smallRoads: 'Small roads', other: 'Another way' },
    finding: 'Finding routes',
    ownWay: 'Route set: the game takes its own way there',
    go: 'Go',
    addStop: 'Add stop',
    endRoute: 'End route',
    back: 'Back',
    noResults: 'No results',
    loading: 'Loading places',
    noPlaces: 'No places on this map yet',
    done: { go: 'Route set', addStop: 'Stop added', end: 'Route ended' },
    alreadyThere: 'Already a stop on the route',
    full: 'The route has 10 stops, the most the game allows',
    onJob: 'On a job, the destination is the job’s',
    noAnswer: 'The game didn’t answer',
    elevated: 'The game is running as administrator, so Cabin Play can’t see its route. Start it normally',
    unsupported: 'This version of the game isn’t supported yet',
    failed: 'The game couldn’t route there',
  },
  keyboard: {
    space: 'space',
    returnKey: { search: 'Search', go: 'Go', done: 'Done' },
    shift: 'Shift',
    capsLock: 'Caps lock',
    delete: 'Delete',
    nextKeyboard: 'Next keyboard',
    hide: 'Hide keyboard',
    clear: 'Clear text',
    typingWithKeyboard: 'Typing with your keyboard',
    pausedWhileDriving: 'Keyboard paused while driving',
    selectToType: 'Select the field to type with your keyboard',
  },
  nowPlaying: 'Now Playing',
  sources: 'Sources',
  previous: 'Previous',
  play: 'Play',
  pause: 'Pause',
  next: 'Next',
  shuffle: 'Shuffle',
  repeat: 'Repeat',
  notPlaying: 'Not Playing',
  openMusicApp: 'Open Apple Music, Spotify or YouTube Music on your PC.',
  nothingLoaded: 'Nothing loaded',
  playing: 'Playing',
  fuel: 'Fuel',
  income: 'Income',
  range: (distance) => `${distance} range`,
  delivery: 'Delivery',
  pickup: 'Pickup',
  destination: 'Destination',
  mapPoint: 'Map point',
  arriveBy: (time) => `Arrive by ${time}`,
  late: 'Late',
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  weather: { clear: 'Clear', rain: 'Rain' },
  weatherTurning: { clear: 'Clearing up', rain: 'Rain starting' },
  youtube: {
    search: 'Search YouTube',
    continueWatching: 'Continue watching',
    recentSearches: 'Recent searches',
    chips: [
      { label: 'Trucking', query: 'trucking' },
      { label: 'Music', query: 'music' },
      { label: 'Podcasts', query: 'podcast' },
      { label: 'Gaming', query: 'gaming' },
      { label: 'Live', query: 'live' },
    ],
    start: 'What would you like to watch? Search, or pick one above.',
    noResults: 'No results',
    failed: "YouTube didn't answer.",
    tryAgain: 'Try again',
    live: 'LIVE',
    upNext: 'Up next',
    nowPlaying: 'Now playing',
    back: 'Back',
    volume: 'Volume',
    forget: 'Remove',
    fill: 'Put in the box',
    clear: 'Clear',
    fullScreen: 'Full screen',
    signIn: 'Sign in',
    signOut: 'Sign out',
    all: 'All',
    channels: 'Channels',
    subscribe: 'Subscribe',
    subscribed: 'Subscribed',
    playlists: 'Playlists',
    playlist: 'Playlist',
    playAll: 'Play all',
    captions: 'Captions',
    off: 'Off',
    quality: 'Quality',
    auto: 'Auto',
    settings: 'Settings',
    playbackSpeed: 'Playback speed',
    normal: 'Normal',
    audioTrack: 'Audio track',
    stableVolume: 'Stable volume',
    voiceBoost: 'Voice boost',
    home: 'Home',
    subscriptions: 'Subscriptions',
    finishOnPc: 'Finish signing in on your PC: Google’s sign-in is open in a window on your desktop.',
    seconds: (seconds) => `${seconds} seconds`,
  },
  spotify: {
    finishOnPc: 'Finish signing in on your PC: Spotify’s sign-in is open in a window on your desktop.',
    whatToPlay: 'What do you want to play?',
    home: 'Home',
    library: 'Your Library',
    browse: 'Browse',
    back: 'Back',
    filters: { all: 'All', music: 'Music', podcasts: 'Podcasts' },
    showAll: 'Show all',
    browseAll: 'Browse all',
    recentSearches: 'Recent searches',
    clearRecent: 'Clear recent searches',
    forget: 'Remove',
    noResults: (query) => `No results found for “${query}”`,
    noResultsHint: 'Check the spelling, or try fewer or different words.',
    topResult: 'Top result',
    songs: 'Songs',
    artists: 'Artists',
    playlists: 'Playlists',
    albums: 'Albums',
    podcasts: 'Podcasts & Shows',
    kinds: {
      playlist: 'Playlist',
      album: 'Album',
      artist: 'Artist',
      show: 'Podcast',
      liked: 'Playlist',
      song: 'Song',
    },
    songCount: (count) => (count === 1 ? '1 song' : `${count} songs`),
    length: (seconds) => {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min ${Math.floor(seconds % 60)} sec`
    },
    recents: 'Recents',
    gridView: 'Grid view',
    listView: 'List view',
    verified: 'Verified Artist',
    follow: 'Follow',
    following: 'Following',
    monthlyListeners: (count) => `${count} monthly listeners`,
    popular: 'Popular',
    discography: 'Discography',
    playingFrom: {
      playlist: 'Playing from playlist',
      album: 'Playing from album',
      artist: 'Playing from artist',
      show: 'Playing from podcast',
      liked: 'Playing from your library',
    },
    nowPlaying: 'Now playing',
    queue: 'Queue',
    nextFrom: (name) => `Next from: ${name}`,
    nextUp: 'Next up',
    lyrics: 'Lyrics',
    noLyrics: 'Looks like we don’t have the lyrics for this song.',
    notSynced: 'These lyrics aren’t synced to the song yet.',
    lyricsFrom: (provider) => `Lyrics provided by ${provider}`,
    volume: 'Volume',
    mute: 'Mute',
    unmute: 'Unmute',
    cantPlay: 'Spotify can’t play this right now.',
    failed: 'Something went wrong',
    tryAgain: 'Try again',
    next: 'Next',
    previous: 'Previous',
    shuffle: 'Shuffle',
    repeat: 'Repeat',
    close: 'Close',
    more: 'More options',
    download: 'Download',
    addToLiked: 'Add to Liked Songs',
    addToLibrary: 'Add to Your Library',
    added: 'Added to Liked Songs.',
    removed: 'Removed from Liked Songs.',
    addedToLibrary: 'Added to Your Library.',
    removedFromLibrary: 'Removed from Your Library.',
    logIn: 'Log in',
    signUp: 'Sign up',
    logOut: 'Log out',
    account: 'Account',
    previewTitle: 'Preview of Spotify',
    previewText: 'Sign up to get unlimited songs and podcasts with occasional ads. No credit card needed.',
    signUpFree: 'Sign up free',
    prompts: {
      play: { title: 'Start listening with a free Spotify account', text: '' },
      save: { title: 'Save to Your Library', text: 'Log in to save songs, albums, playlists and artists.' },
      playlist: { title: 'Create a playlist', text: 'Log in to create and share playlists.' },
    },
    haveAccount: 'Already have an account?',
    notNow: 'Not now',
    firstPlaylist: {
      title: 'Create your first playlist',
      text: 'It’s easy, we’ll help you',
      button: 'Create playlist',
    },
    firstPodcasts: {
      title: 'Let’s find some podcasts to follow',
      text: 'We’ll keep you updated on new episodes',
      button: 'Browse podcasts',
    },
    explicit: 'E',
  },
  appleMusic: {
    tabs: { home: 'Home', new: 'New', radio: 'Radio', library: 'Library', search: 'Search' },
    searchHint: 'Artists, Songs, Albums and More',
    browseCategories: 'Browse Categories',
    recentlySearched: 'Recently Searched',
    clear: 'Clear',
    topResults: 'Top Results',
    songs: 'Songs',
    artists: 'Artists',
    albums: 'Albums',
    playlists: 'Playlists',
    stations: 'Stations',
    noResults: 'No Results',
    noResultsHint: 'Try a new search.',
    seeAll: 'See All',
    recentlyPlayed: 'Recently Played',
    recentlyAdded: 'Recently Added',
    kinds: {
      album: 'Album',
      playlist: 'Playlist',
      artist: 'Artist',
      station: 'Station',
      song: 'Song',
      curator: 'Category',
      folder: 'Folder',
    },
    length: (songs, seconds) => {
      const minutes = Math.round(seconds / 60)
      const count = songs === 1 ? '1 song' : `${songs} songs`
      if (minutes < 60) return `${count}, ${minutes === 1 ? '1 minute' : `${minutes} minutes`}`
      const hours = Math.floor(minutes / 60)
      const rest = minutes % 60
      return `${count}, ${hours === 1 ? '1 hour' : `${hours} hours`}${rest ? ` ${rest} minutes` : ''}`
    },
    topSongs: 'Top Songs',
    play: 'Play',
    shuffle: 'Shuffle',
    live: 'LIVE',
    explicit: 'Explicit',
    preview: 'Preview',
    upNext: 'Up Next',
    lyrics: 'Lyrics',
    noLyrics: 'Lyrics aren’t available for this song.',
    writtenBy: (names) => `Written By: ${names}`,
    from: (name) => `From ${name}`,
    favorite: 'Favourite',
    favorited: 'Added to Favourites',
    unfavorited: 'Removed from Favourites',
    addToLibrary: 'Add to Library',
    added: 'Added to Library',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    account: 'Account',
    filter: 'Filter',
    more: 'More',
    all: { playlists: 'All Playlists', albums: 'All Albums', songs: 'All Songs' },
    favorites: 'Favourites',
    grid: 'Grid',
    list: 'List',
    find: 'Search',
    sorts: {
      name: 'Title',
      '-dateAdded': 'Date Added',
      '-lastPlayed': 'Last Played Date',
      '-updated': 'Updated Date',
      type: 'Playlist Type',
    },
    finishOnPc: 'Finish signing in on your PC: Apple Music’s sign-in is open in a window on your desktop.',
    homePitch: {
      title: 'Get more from Apple Music',
      text: 'Sign in for picks made for you, what you played lately and your Library.',
    },
    libraryPitch: { title: 'Your Library', text: 'Sign in to see the music you’ve added.' },
    promptTitle: 'Sign in to Apple Music',
    promptFor: {
      library: 'Sign in to add music to your Library.',
      favorite: 'Sign in to favourite songs.',
    },
    notNow: 'Not Now',
    previewBanner: { title: 'Listen to full songs', text: 'Sign in to play every song in full, not its preview.' },
    empty: 'Nothing here yet.',
    cantPlay: 'Apple Music can’t play this right now.',
    failed: 'Couldn’t load this.',
    tryAgain: 'Try Again',
    back: 'Back',
    close: 'Close',
    nowPlaying: 'Now Playing',
    next: 'Next',
    previous: 'Previous',
    repeat: 'Repeat',
    volume: 'Volume',
    mute: 'Mute',
    unmute: 'Unmute',
  },
  youtubeMusic: {
    tabs: { home: 'Home', explore: 'Explore', library: 'Library', search: 'Search' },
    searchHint: 'Search songs, artists, podcasts',
    remove: 'Remove',
    more: 'More',
    play: 'Play',
    shuffle: 'Shuffle',
    radio: 'Radio',
    save: 'Save to library',
    saved: 'Saved to library',
    removed: 'Removed from library',
    inLibrary: 'Saved',
    like: 'Like',
    dislike: 'Dislike',
    song: 'Song',
    video: 'Video',
    upNext: 'Up next',
    lyrics: 'Lyrics',
    related: 'Related',
    playingFrom: 'Playing from',
    noLyrics: 'Lyrics aren’t available for this song.',
    shelves: {
      playlists: 'Playlists',
      songs: 'Songs',
      albums: 'Albums',
      artists: 'Artists',
      subscriptions: 'Subscriptions',
      history: 'History',
    },
    topResult: 'Top result',
    subscribers: (count) => `${count} subscribers`,
    signIn: 'Sign in',
    signOut: 'Sign out',
    account: 'Account',
    finishOnPc: 'Finish signing in on your PC.',
    libraryPitch: {
      title: 'Enjoy your favourite music',
      text: 'Sign in to see your playlists, liked songs and albums. Your YouTube sign-in works here too.',
    },
    promptTitle: 'Sign in to YouTube Music',
    promptFor: {
      library: 'Your playlists, songs and albums are in your library.',
      like: 'Songs you like go to your Liked music.',
      save: 'Albums and playlists you save go to your library.',
    },
    notNow: 'Not now',
    empty: 'Nothing here yet.',
    noResults: 'No results',
    cantPlay: 'YouTube Music can’t play this right now.',
    failed: 'Couldn’t load this.',
    tryAgain: 'Try again',
    back: 'Back',
    close: 'Close',
    nowPlaying: 'Now playing',
    pause: 'Pause',
    next: 'Next',
    previous: 'Previous',
    repeat: 'Repeat',
    ad: 'Ad',
    moreActions: 'More actions',
    startRadio: 'Start radio',
    playNext: 'Play next',
    addToQueue: 'Add to queue',
    goToAlbum: 'Go to album',
    goToArtist: 'Go to artist',
    willPlayNext: 'Song will play next',
    addedToQueue: 'Song added to queue',
    volume: 'Volume',
  },
  weatherApp: {
    myLocation: 'My Location',
    nextChange: 'Next change',
    inAbout: (time) => `In about ${time}`,
    roads: 'Roads',
    roadStates: { dry: 'Dry', damp: 'Damp', wet: 'Wet' },
    roadTrends: { drying: 'Drying', gettingWet: 'Getting wetter' },
    unavailable: 'The weather shows while the game runs.',
  },
  settings: {
    appearance: 'Appearance',
    light: 'Light',
    dark: 'Dark',
    automatic: 'Automatic',
    automaticFooter: 'Dark at night and whenever the headlights are on, the way the truck’s light sensor does it.',
    vehicleBar: 'Vehicle Bar',
    vehicleBarFooter: 'The truck’s information bar beside Cabin Play. Turned off, Cabin Play fills the whole screen.',
    textSize: 'Text Size',
    textSizeAbout: 'Cabin Play’s apps will adjust to your preferred reading size below.',
    wallpaper: 'Wallpaper',
    icons: 'App Icons',
    iconStyle: 'Icon Look',
    reduceMotion: 'Reduce Motion',
    reduceMotionFooter: 'Cabin Play changes screens in place, without the slides and zooms, and its apps open at once.',
    autoOrder: 'Auto Order',
    autoOrderFooter:
      'The column puts what the drive needs first: a warning, then a delivery deadline closing in. Turned off, it keeps your order.',
    moveUp: 'Move up',
    moveDown: 'Move down',
    dashboard: 'Dashboard',
    widgets: 'Widgets',
    homeScreen: 'Home Screen',
    homeScreenFooter:
      'Choose which apps appear on Home and the order they appear in. Hiding an app keeps it in Settings and the sidebar’s recents.',
    showOnHome: 'Show on Home',
    homeOrder: 'Order',
    resetHomeScreen: 'Reset Home Screen',
    realClock: 'Real Time',
    clockFooter: 'The sidebar’s clock: your own time, or the game’s.',
    showAlbumArt: 'Show Album Art',
    sound: 'Sound',
    uiSounds: 'Interface Sounds',
    uiSoundVolume: 'Interface Sound Volume',
    uiSoundsFooter: 'Set the cabin’s clicks and alerts independently. This does not change music or game volume.',
    equalizer: 'Equalizer',
    recommended: 'Recommended',
    custom: 'Custom',
    equalizerFooter:
      'Cabin Play plays your music through each truck’s own speakers, tuned for its cab. If you prefer a different sound, you can customise how every music app sounds, in every truck.',
    low: 'Low',
    mid: 'Mid',
    high: 'High',
    resetEqualizer: 'Reset',
    back: 'Back',
  },
  diagnostics: {
    engine: 'Engine',
    tires: 'Tires',
    brakes: 'Brakes',
    coolant: 'Coolant',
    oil: 'Oil',
    wear: 'Wear',
    rpm: 'RPM',
    airPressure: 'Air pressure',
    brakeTemperature: 'Brake temperature',
    parkingBrake: 'Parking brake',
    applied: 'Applied',
    released: 'Released',
    normal: 'Normal',
    warm: 'Warm',
    high: 'High',
    low: 'Low',
    worn: 'Worn',
    stopped: 'Stopped',
    celsius: '°C',
    psi: 'psi',
    kmh: 'km/h',
    km: 'km',
    litres: 'l',
    volts: 'V',
    lPer100: 'l/100 km',
    battery: 'Battery',
    oilPressure: 'Oil pressure',
    brakeAir: 'Brake air',
    adblue: 'AdBlue',
    sinceStart: 'Since Engine Start',
    warnings: 'Warnings',
    consumption: 'Consumption',
    odometer: 'Odometer',
    retarder: 'Retarder',
    gear: 'Gear',
    trailer: 'Trailer',
    hitched: 'Hitched',
    unhitched: 'No trailer',
    wearEngine: 'Engine',
    wearTransmission: 'Transmission',
    wearCabin: 'Cab',
    wearChassis: 'Chassis',
    wearTrailer: 'Trailer tires',
    running: 'Running',
    engineOff: 'Engine off',
    check: 'Check',
    service: 'Service',
    fuel: 'Fuel',
    range: 'Range',
    chassis: 'Chassis',
    off: 'Off',
    trip: 'Trip',
    distance: 'Distance',
    used: 'Used',
    average: 'Average',
    time: 'Time',
    reset: 'Reset',
    noTelemetry: 'Start the game for readings',
    overview: 'Overview',
    driverHours: 'Driver hours',
    restStop: 'Next rest stop',
    mandatoryBreak: 'Mandatory break',
    noRest: 'Off in this profile',
    controls: 'Controls',
    cruiseControl: 'Cruise control',
    lights: 'Lights',
    wipers: 'Wipers',
    hours: 'h',
    minutes: 'min',
    parkingLight: 'Parking lights',
    lowBeam: 'Low beam',
    highBeam: 'High beam',
    indicatorLeft: 'Left indicator',
    indicatorRight: 'Right indicator',
    on: 'On',
    trailerType: 'Type',
    plate: 'Plate',
    body: 'Body',
  },
  driver: {
    profile: 'Career profile',
    noProfile: 'No game profile loaded',
    savedCareer: 'Lifetime totals across all game modes',
    experience: 'Experience',
    totalDistance: 'Real distance',
    gameTime: 'Game time',
    realTime: 'Real time',
    fuelUsed: 'Fuel consumed',
    citiesVisited: 'Cities discovered',
    cancelledJobs: 'Cancelled jobs',
    history: 'Career history',
    historyUnavailable:
      'This save provides lifetime totals, but not a delivery-by-delivery history. The statistics above come directly from the game.',
    saveUnavailable: 'Load a game profile to see career statistics.',
  },
  notificationsApp: {
    empty: 'No notifications yet',
    hint: 'The truck’s own warnings — battery, oil pressure, brake air, fuel and AdBlue — and the rest clocks show here as they come on: on the screen for six seconds, then in this list. A warning that stays on is one note, not one a second. The list is kept on this PC, so it’s still here after a restart.',
    alerts: 'Alerts',
    warnings: 'Warnings',
    alert: 'Alert',
    warning: 'Warning',
    clear: 'Clear',
    summary: (count) => (count === 1 ? '1 notification' : `${count} notifications`),
    openMaps: 'Open Maps',
    openDiagnostics: 'Open Diagnostics',
  },
  apps: {
    maps: 'Maps',
    music: 'Music',
    spotify: 'Spotify',
    youtube: 'YouTube',
    youtubeMusic: 'YouTube Music',
    podcasts: 'Podcasts',
    phone: 'Phone',
    messages: 'Messages',
    weather: 'Weather',
    settings: 'Settings',
    diagnostics: 'Diagnostics',
    driver: 'Career',
    notifications: 'Notifications',
  },
  notBuiltYet: 'Not built yet',
}

const TURKISH_STRINGS: Strings = {
  decimal: ',',
  number: (value) => new Intl.NumberFormat('tr-TR').format(value),
  arrival: 'varış',
  minutes: (minutes) => `${minutes} dk`,
  hours: (hours, minutes) => `${hours}:${minutes} sa`,
  speedLimit: (limit) => `Hız sınırı ${limit}`,
  now: 'Şimdi',
  then: 'Sonra',
  arrive: 'Varış noktasına ulaşın',
  turns: {
    'slight-left': 'Hafif sola dönün',
    left: 'Sola dönün',
    'sharp-left': 'Keskin sola dönün',
    'slight-right': 'Hafif sağa dönün',
    right: 'Sağa dönün',
    'sharp-right': 'Keskin sağa dönün',
    'u-turn': 'U dönüşü yapın',
    'keep-left': 'Soldan devam edin',
    'keep-right': 'Sağdan devam edin',
    'exit-left': 'Soldaki çıkışa girin',
    'exit-right': 'Sağdaki çıkışa girin',
  },
  roundabout: (exit) => `Dönel kavşakta ${exit}. çıkıştan çıkın`,
  recentre: 'Ortala',
  northUp: 'Kuzey yukarı',
  zoomIn: 'Yakınlaştır',
  zoomOut: 'Uzaklaştır',
  search: 'Ara',
  searchPlaces: 'Yer ve şehir arayın',
  close: 'Kapat',
  destinations: {
    favourites: 'Favoriler',
    headquarters: 'Merkez',
    yourGarage: 'Garajınız',
    findNearby: 'Yakındakiler',
    alongRoute: 'Rota üzerinde',
    recents: 'Son kullanılanlar',
    wholeRoute: 'Tüm rota',
    mapDetail: 'Detay',
    mapBalanced: 'Dengeli',
    mapNight: 'Gece Karart',
    mapJunction: 'Kavşaklarda Uzaklaş',
    mapTrucks: 'Diğer Sürücüler',
    mapTraffic: 'Trafik',
    mapRecentre: 'Kamyona Dön',
    mapNever: 'Asla',
    routeColour: 'Güzergâh Rengi',
    routeBlue: 'Mavi',
    routeTeal: 'Turkuaz',
    routePurple: 'Mor',
    routeAmber: 'Amber',
    routeWeight: 'Güzergâh Çizgisi',
    weightThin: 'İnce',
    weightStandard: 'Standart',
    weightBold: 'Kalın',
    marker: 'Araç İşareti',
    markerArrow: 'Ok',
    markerDot: 'Nokta',
    markerTruck: 'Kamyon',
    markerSize: 'İşaret Boyutu',
    sizeSmall: 'Küçük',
    sizeMedium: 'Orta',
    sizeLarge: 'Büyük',
    mapNorth: 'Kuzey Yukarı',
    mapLimit: 'Hız Limiti Levhası',
    mapOver: 'Aşınca Uyar',
    mapCompass: 'Pusula',
    mapScale: 'Ölçek Çubuğu',
    mapNightFrom: 'Karartma Saati',
    pinStyle: 'Harita İğneleri',
    pinFilled: 'Dolgulu',
    pinOutlined: 'Kenarlı',
    pinsFuel: 'Yakıt İstasyonları',
    pinsParking: 'Dinlenme Yerleri',
    pinsService: 'Servis ve Onarım',
    stopNumber: (number) => `${number}. durak`,
    clearRecents: 'Temizle',
    routeChanged: 'Rota değişti',
    arrived: 'Vardınız',
    kinds: {
      fuel: 'Akaryakıt',
      service: 'Servis',
      garage: 'Garaj',
      dealer: 'Tır bayisi',
      company: 'Şirket',
      parking: 'Mola yeri',
      hotel: 'Otel',
      recruitment: 'İş kurumu',
      weigh: 'Denetim istasyonu',
      ferry: 'Feribot',
      train: 'Tren',
      city: 'Şehir',
    },
    nearby: {
      fuel: 'Akaryakıt',
      parking: 'Mola yerleri',
      service: 'Servis',
      hotel: 'Oteller',
      company: 'Şirketler',
      dealer: 'Bayiler',
      ferry: 'Feribotlar',
      city: 'Şehirler',
    },
    straightLine: (distance) => `${distance} uzaklıkta`,
    alongTheRoute: (distance) => `Rotada ${distance} ileride`,
    stopAdds: (distance, time) => `Durak eklendi · ${distance} ve ${time} ekliyor`,
    notOnRoute: 'Durak eklendi, ama oyunun rotası oradan geçmiyor',
    plans: { fastest: 'En hızlı', shortest: 'En kısa', smallRoads: 'Küçük yollar', other: 'Başka bir yol' },
    finding: 'Rotalar bulunuyor',
    ownWay: 'Rota ayarlandı: oyun oraya kendi yolundan gidiyor',
    go: 'Git',
    addStop: 'Durak ekle',
    endRoute: 'Rotayı bitir',
    back: 'Geri',
    noResults: 'Sonuç yok',
    loading: 'Yerler yükleniyor',
    noPlaces: 'Bu haritada henüz yer yok',
    done: { go: 'Rota ayarlandı', addStop: 'Durak eklendi', end: 'Rota bitirildi' },
    alreadyThere: 'Zaten rotada bir durak',
    full: 'Rotada 10 durak var, oyunun izin verdiği en fazla',
    onJob: 'İşteyken varış noktası işin',
    noAnswer: 'Oyun yanıt vermedi',
    elevated: 'Oyun yönetici olarak çalışıyor, Cabin Play’in rotasını göremiyor. Oyunu normal başlatın',
    unsupported: 'Oyunun bu sürümü henüz desteklenmiyor',
    failed: 'Oyun oraya rota çizemedi',
  },
  keyboard: {
    space: 'boşluk',
    returnKey: { search: 'Ara', go: 'Git', done: 'Bitti' },
    shift: 'Büyük harf',
    capsLock: 'Büyük harf kilidi',
    delete: 'Sil',
    nextKeyboard: 'Sonraki klavye',
    hide: 'Klavyeyi gizle',
    clear: 'Metni temizle',
    typingWithKeyboard: 'Klavyenizle yazıyorsunuz',
    pausedWhileDriving: 'Sürüş sırasında klavye duraklatıldı',
    selectToType: 'Klavyenizle yazmak için alanı seçin',
  },
  nowPlaying: 'Şimdi Çalıyor',
  sources: 'Kaynaklar',
  previous: 'Önceki',
  play: 'Oynat',
  pause: 'Duraklat',
  next: 'Sonraki',
  shuffle: 'Karıştır',
  repeat: 'Tekrarla',
  notPlaying: 'Çalmıyor',
  openMusicApp: 'Bilgisayarınızda Apple Music, Spotify veya YouTube Music’i açın.',
  nothingLoaded: 'Hiçbir şey yüklenmedi',
  playing: 'Çalıyor',
  fuel: 'Yakıt',
  income: 'Kazanç',
  range: (distance) => `${distance} menzil`,
  delivery: 'Teslimat',
  pickup: 'Yükleme',
  destination: 'Hedef',
  mapPoint: 'Harita noktası',
  arriveBy: (time) => `Son varış ${time}`,
  late: 'Gecikti',
  days: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
  weather: { clear: 'Açık', rain: 'Yağmur' },
  weatherTurning: { clear: 'Açılıyor', rain: 'Yağmur başlıyor' },
  youtube: {
    search: 'YouTube’da ara',
    continueWatching: 'İzlemeye devam et',
    recentSearches: 'Son aramalar',
    chips: [
      { label: 'Tır', query: 'tır yolculuğu' },
      { label: 'Müzik', query: 'müzik' },
      { label: 'Podcast', query: 'podcast' },
      { label: 'Oyun', query: 'oyun' },
      { label: 'Canlı', query: 'canlı yayın' },
    ],
    start: 'Ne izlemek istersiniz? Arayın ya da yukarıdan seçin.',
    noResults: 'Sonuç yok',
    failed: 'YouTube yanıt vermedi.',
    tryAgain: 'Tekrar dene',
    live: 'CANLI',
    upNext: 'Sıradaki',
    nowPlaying: 'Şimdi oynatılıyor',
    back: 'Geri',
    volume: 'Ses',
    forget: 'Kaldır',
    fill: 'Kutuya koy',
    clear: 'Temizle',
    fullScreen: 'Tam ekran',
    signIn: 'Oturum aç',
    signOut: 'Oturumu kapat',
    all: 'Tümü',
    channels: 'Kanallar',
    subscribe: 'Abone ol',
    subscribed: 'Abone olundu',
    playlists: 'Oynatma listeleri',
    playlist: 'Oynatma listesi',
    playAll: 'Tümünü oynat',
    captions: 'Altyazılar',
    off: 'Kapalı',
    quality: 'Kalite',
    auto: 'Otomatik',
    settings: 'Ayarlar',
    playbackSpeed: 'Oynatma hızı',
    normal: 'Normal',
    audioTrack: 'Ses parçası',
    stableVolume: 'Sabit ses seviyesi',
    voiceBoost: 'Ses güçlendirme',
    home: 'Ana Sayfa',
    subscriptions: 'Abonelikler',
    finishOnPc: 'Oturum açmayı bilgisayarınızda tamamlayın: Google’ın oturum açma penceresi masaüstünüzde açık.',
    seconds: (seconds) => `${seconds} saniye`,
  },
  spotify: {
    finishOnPc: 'Oturum açmayı bilgisayarınızda tamamlayın: Spotify’ın oturum açma penceresi masaüstünüzde açık.',
    whatToPlay: 'Ne çalmak istiyorsun?',
    home: 'Ana sayfa',
    library: 'Kitaplığın',
    browse: 'Göz at',
    back: 'Geri',
    filters: { all: 'Tümü', music: 'Müzik', podcasts: 'Podcast’ler' },
    showAll: 'Tümünü göster',
    browseAll: 'Hepsine göz at',
    recentSearches: 'Son aramalar',
    clearRecent: 'Son aramaları temizle',
    forget: 'Kaldır',
    noResults: (query) => `“${query}” için sonuç bulunamadı`,
    noResultsHint: 'Yazımı kontrol et ya da daha az veya farklı kelimeler dene.',
    topResult: 'En iyi sonuç',
    songs: 'Şarkılar',
    artists: 'Sanatçılar',
    playlists: 'Çalma listeleri',
    albums: 'Albümler',
    podcasts: 'Podcast’ler ve Programlar',
    kinds: {
      playlist: 'Çalma listesi',
      album: 'Albüm',
      artist: 'Sanatçı',
      show: 'Podcast',
      liked: 'Çalma listesi',
      song: 'Şarkı',
    },
    songCount: (count) => `${count} şarkı`,
    length: (seconds) => {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return hours > 0 ? `${hours} sa. ${minutes} dk.` : `${minutes} dk. ${Math.floor(seconds % 60)} sn.`
    },
    recents: 'En son',
    gridView: 'Izgara görünümü',
    listView: 'Liste görünümü',
    verified: 'Onaylanmış Sanatçı',
    follow: 'Takip et',
    following: 'Takip ediliyor',
    monthlyListeners: (count) => `${count} aylık dinleyici`,
    popular: 'Popüler',
    discography: 'Diskografi',
    playingFrom: {
      playlist: 'Çalma listesinden çalınıyor',
      album: 'Albümden çalınıyor',
      artist: 'Sanatçıdan çalınıyor',
      show: 'Podcast’ten çalınıyor',
      liked: 'Kitaplığından çalınıyor',
    },
    nowPlaying: 'Şu anda çalan',
    queue: 'Sıra',
    nextFrom: (name) => `Sıradaki: ${name}`,
    nextUp: 'Sıradakiler',
    lyrics: 'Şarkı sözleri',
    noLyrics: 'Görünüşe göre bu şarkının sözleri bizde yok.',
    notSynced: 'Bu sözler henüz şarkıyla eşzamanlı değil.',
    lyricsFrom: (provider) => `Şarkı sözlerini sağlayan: ${provider}`,
    volume: 'Ses düzeyi',
    mute: 'Sesi kapat',
    unmute: 'Sesi aç',
    cantPlay: 'Spotify bunu şu anda çalamıyor.',
    failed: 'Bir şeyler ters gitti',
    tryAgain: 'Tekrar dene',
    next: 'Sonraki',
    previous: 'Önceki',
    shuffle: 'Karıştır',
    repeat: 'Tekrarla',
    close: 'Kapat',
    more: 'Diğer seçenekler',
    download: 'İndir',
    addToLiked: 'Beğenilen Şarkılar’a ekle',
    addToLibrary: 'Kitaplığına ekle',
    added: 'Beğenilen Şarkılar’a eklendi.',
    removed: 'Beğenilen Şarkılar’dan kaldırıldı.',
    addedToLibrary: 'Kitaplığına eklendi.',
    removedFromLibrary: 'Kitaplığından kaldırıldı.',
    logIn: 'Oturum aç',
    signUp: 'Kaydol',
    logOut: 'Oturumu kapat',
    account: 'Hesap',
    previewTitle: 'Spotify önizlemesi',
    previewText: 'Ara sıra reklamlarla sınırsız şarkı ve podcast dinlemek için kaydol. Kredi kartı gerekmez.',
    signUpFree: 'Ücretsiz kaydol',
    prompts: {
      play: { title: 'Ücretsiz bir Spotify hesabıyla dinlemeye başla', text: '' },
      save: {
        title: 'Kitaplığına kaydet',
        text: 'Şarkıları, albümleri, çalma listelerini ve sanatçıları kaydetmek için oturum aç.',
      },
      playlist: { title: 'Çalma listesi oluştur', text: 'Çalma listesi oluşturmak ve paylaşmak için oturum aç.' },
    },
    haveAccount: 'Zaten bir hesabın var mı?',
    notNow: 'Şimdi değil',
    firstPlaylist: {
      title: 'İlk çalma listeni oluştur',
      text: 'Çok kolay, sana yardım edeceğiz',
      button: 'Çalma listesi oluştur',
    },
    firstPodcasts: {
      title: 'Takip edeceğin podcast’leri bulalım',
      text: 'Yeni bölümlerden seni haberdar edeceğiz',
      button: 'Podcast’lere göz at',
    },
    explicit: 'E',
  },
  appleMusic: {
    tabs: { home: 'Ana Sayfa', new: 'Yeni', radio: 'Radyo', library: 'Kütüphane', search: 'Ara' },
    searchHint: 'Sanatçılar, Şarkılar, Albümler ve Daha Fazlası',
    browseCategories: 'Kategorilere Göz At',
    recentlySearched: 'Son Aramalar',
    clear: 'Temizle',
    topResults: 'En İyi Sonuçlar',
    songs: 'Şarkılar',
    artists: 'Sanatçılar',
    albums: 'Albümler',
    playlists: 'Çalma Listeleri',
    stations: 'İstasyonlar',
    noResults: 'Sonuç Yok',
    noResultsHint: 'Yeni bir arama deneyin.',
    seeAll: 'Tümünü Gör',
    recentlyPlayed: 'Son Çalınanlar',
    recentlyAdded: 'Son Eklenenler',
    kinds: {
      album: 'Albüm',
      playlist: 'Çalma Listesi',
      artist: 'Sanatçı',
      station: 'İstasyon',
      song: 'Şarkı',
      curator: 'Kategori',
      folder: 'Klasör',
    },
    length: (songs, seconds) => {
      const minutes = Math.round(seconds / 60)
      if (minutes < 60) return `${songs} şarkı, ${minutes} dakika`
      const rest = minutes % 60
      return `${songs} şarkı, ${Math.floor(minutes / 60)} saat${rest ? ` ${rest} dakika` : ''}`
    },
    topSongs: 'Popüler Şarkılar',
    play: 'Çal',
    shuffle: 'Karıştır',
    live: 'CANLI',
    explicit: 'Müstehcen',
    preview: 'Önizleme',
    upNext: 'Sıradakiler',
    lyrics: 'Sözler',
    noLyrics: 'Bu şarkının sözleri yok.',
    writtenBy: (names) => `Yazanlar: ${names}`,
    from: (name) => `Kaynak: ${name}`,
    favorite: 'Favori',
    favorited: 'Favorilere Eklendi',
    unfavorited: 'Favorilerden Kaldırıldı',
    addToLibrary: 'Kütüphaneye Ekle',
    added: 'Kütüphaneye Eklendi',
    signIn: 'Giriş Yap',
    signOut: 'Çıkış Yap',
    account: 'Hesap',
    filter: 'Filtre',
    more: 'Diğer',
    all: { playlists: 'Tüm Çalma Listeleri', albums: 'Tüm Albümler', songs: 'Tüm Şarkılar' },
    favorites: 'Favoriler',
    grid: 'Izgara',
    list: 'Liste',
    find: 'Ara',
    sorts: {
      name: 'Başlık',
      '-dateAdded': 'Eklenme Tarihi',
      '-lastPlayed': 'Son Çalınma Tarihi',
      '-updated': 'Güncellenme Tarihi',
      type: 'Çalma Listesi Türü',
    },
    finishOnPc: 'Girişi bilgisayarınızda tamamlayın: Apple Music’in giriş penceresi masaüstünüzde açık.',
    homePitch: {
      title: 'Apple Music’ten daha fazlası',
      text: 'Size özel seçimler, son dinledikleriniz ve Kütüphaneniz için giriş yapın.',
    },
    libraryPitch: { title: 'Kütüphaneniz', text: 'Eklediğiniz müziği görmek için giriş yapın.' },
    promptTitle: 'Apple Music’e Giriş Yapın',
    promptFor: {
      library: 'Kütüphanenize müzik eklemek için giriş yapın.',
      favorite: 'Şarkıları favorilere eklemek için giriş yapın.',
    },
    notNow: 'Şimdi Değil',
    previewBanner: {
      title: 'Şarkıların tamamını dinleyin',
      text: 'Her şarkıyı önizlemesi yerine tamamen çalmak için giriş yapın.',
    },
    empty: 'Burada henüz bir şey yok.',
    cantPlay: 'Apple Music bunu şu anda çalamıyor.',
    failed: 'Yüklenemedi.',
    tryAgain: 'Yeniden Dene',
    back: 'Geri',
    close: 'Kapat',
    nowPlaying: 'Şimdi Çalıyor',
    next: 'Sonraki',
    previous: 'Önceki',
    repeat: 'Tekrarla',
    volume: 'Ses',
    mute: 'Sesi Kapat',
    unmute: 'Sesi Aç',
  },
  youtubeMusic: {
    tabs: { home: 'Ana Sayfa', explore: 'Keşfet', library: 'Kitaplık', search: 'Ara' },
    searchHint: 'Şarkı, sanatçı, podcast ara',
    remove: 'Kaldır',
    more: 'Daha fazla',
    play: 'Oynat',
    shuffle: 'Karıştır',
    radio: 'Radyo',
    save: 'Kitaplığa kaydet',
    saved: 'Kitaplığa kaydedildi',
    removed: 'Kitaplıktan kaldırıldı',
    inLibrary: 'Kaydedildi',
    like: 'Beğen',
    dislike: 'Beğenme',
    song: 'Şarkı',
    video: 'Video',
    upNext: 'Sıradaki',
    lyrics: 'Şarkı sözleri',
    related: 'İlgili',
    playingFrom: 'Şuradan çalınıyor',
    noLyrics: 'Bu şarkının sözleri yok.',
    shelves: {
      playlists: 'Çalma listeleri',
      songs: 'Şarkılar',
      albums: 'Albümler',
      artists: 'Sanatçılar',
      subscriptions: 'Abonelikler',
      history: 'Geçmiş',
    },
    topResult: 'En iyi sonuç',
    subscribers: (count) => `${count} abone`,
    signIn: 'Oturum aç',
    signOut: 'Oturumu kapat',
    account: 'Hesap',
    finishOnPc: 'Oturum açmayı bilgisayarınızda tamamlayın.',
    libraryPitch: {
      title: 'Sevdiğiniz müziğin keyfini çıkarın',
      text: 'Çalma listelerinizi, beğendiğiniz şarkıları ve albümlerinizi görmek için oturum açın. YouTube oturumunuz burada da geçerli.',
    },
    promptTitle: 'YouTube Music’te oturum açın',
    promptFor: {
      library: 'Çalma listeleriniz, şarkılarınız ve albümleriniz kitaplığınızda.',
      like: 'Beğendiğiniz şarkılar Beğenilen müzikler listenize eklenir.',
      save: 'Kaydettiğiniz albümler ve çalma listeleri kitaplığınıza eklenir.',
    },
    notNow: 'Şimdi değil',
    empty: 'Burada henüz bir şey yok.',
    noResults: 'Sonuç yok',
    cantPlay: 'YouTube Music bunu şu anda çalamıyor.',
    failed: 'Yüklenemedi.',
    tryAgain: 'Tekrar dene',
    back: 'Geri',
    close: 'Kapat',
    nowPlaying: 'Şimdi çalıyor',
    pause: 'Duraklat',
    next: 'Sonraki',
    previous: 'Önceki',
    repeat: 'Tekrarla',
    ad: 'Reklam',
    moreActions: 'Diğer işlemler',
    startRadio: 'Radyoyu başlat',
    playNext: 'Sıradaki olarak çal',
    addToQueue: 'Sıraya ekle',
    goToAlbum: 'Albüme git',
    goToArtist: 'Sanatçıya git',
    willPlayNext: 'Şarkı sıradaki olarak çalınacak',
    addedToQueue: 'Şarkı sıraya eklendi',
    volume: 'Ses',
  },
  weatherApp: {
    myLocation: 'Konumum',
    nextChange: 'Sonraki değişim',
    inAbout: (time) => `Yaklaşık ${time} sonra`,
    roads: 'Yollar',
    roadStates: { dry: 'Kuru', damp: 'Nemli', wet: 'Islak' },
    roadTrends: { drying: 'Kuruyor', gettingWet: 'Islanıyor' },
    unavailable: 'Hava durumu oyun açıkken görünür.',
  },
  settings: {
    appearance: 'Görünüm',
    light: 'Açık',
    dark: 'Koyu',
    automatic: 'Otomatik',
    automaticFooter: 'Geceleri ve farlar her yandığında koyu; tıpkı kamyonun ışık sensörü gibi.',
    vehicleBar: 'Araç Çubuğu',
    vehicleBarFooter: 'Cabin Play’in yanındaki kamyon bilgi çubuğu. Kapatırsan Cabin Play tüm ekranı kaplar.',
    textSize: 'Metin Boyutu',
    textSizeAbout: 'Cabin Play’in uygulamaları aşağıda seçtiğin okuma boyutuna göre ayarlanır.',
    wallpaper: 'Duvar Kâğıdı',
    icons: 'Uygulama Simgeleri',
    iconStyle: 'Simge Görünümü',
    reduceMotion: 'Hareketi Azalt',
    reduceMotionFooter:
      'Cabin Play ekranları kaydırma ve yakınlaştırma olmadan, yerinde değiştirir; uygulamalar anında açılır.',
    autoOrder: 'Otomatik Sıralama',
    autoOrderFooter:
      'Sütun, sürüşün neye ihtiyacı varsa onu öne alır: önce bir uyarı, sonra yaklaşan teslim saati. Kapatınca senin sıran korunur.',
    moveUp: 'Yukarı taşı',
    moveDown: 'Aşağı taşı',
    dashboard: 'Gösterge Paneli',
    widgets: 'Widget’lar',
    homeScreen: 'Ana Ekran',
    homeScreenFooter:
      'Ana Ekran’da hangi uygulamaların görüneceğini ve sırasını seçin. Gizlenen uygulama Ayarlar’da ve kenar çubuğunun son kullanılanlarında kalır.',
    showOnHome: 'Ana Ekran’da Göster',
    homeOrder: 'Sıra',
    resetHomeScreen: 'Ana Ekranı Sıfırla',
    realClock: 'Gerçek Saat',
    clockFooter: 'Kenar çubuğundaki saat: kendi saatiniz ya da oyunun saati.',
    showAlbumArt: 'Albüm Kapağını Göster',
    sound: 'Ses',
    uiSounds: 'Arayüz Sesleri',
    uiSoundVolume: 'Arayüz Sesi Seviyesi',
    uiSoundsFooter: 'Kabin tıklarını ve uyarılarını ayrı ayarla. Müzik veya oyun ses seviyesini değiştirmez.',
    equalizer: 'Ekolayzır',
    recommended: 'Önerilen',
    custom: 'Özel',
    equalizerFooter:
      'Cabin Play müziğini her kamyonun kendi hoparlörlerinden, kabinine göre ayarlanmış olarak çalar. Farklı bir ses istersen, her müzik uygulamasının her kamyonda nasıl çalacağını özelleştirebilirsin.',
    low: 'Düşük',
    mid: 'Orta',
    high: 'Yüksek',
    resetEqualizer: 'Sıfırla',
    back: 'Geri',
  },
  diagnostics: {
    engine: 'Motor',
    tires: 'Lastikler',
    brakes: 'Frenler',
    coolant: 'Soğutma suyu',
    oil: 'Yağ',
    wear: 'Aşınma',
    rpm: 'Devir',
    airPressure: 'Hava basıncı',
    brakeTemperature: 'Fren sıcaklığı',
    parkingBrake: 'El freni',
    applied: 'Çekili',
    released: 'Bırakılmış',
    normal: 'Normal',
    warm: 'Ilık',
    high: 'Yüksek',
    low: 'Düşük',
    worn: 'Aşınmış',
    stopped: 'Durmuş',
    celsius: '°C',
    psi: 'psi',
    kmh: 'km/sa',
    km: 'km',
    litres: 'l',
    volts: 'V',
    lPer100: 'l/100 km',
    battery: 'Akü',
    oilPressure: 'Yağ basıncı',
    brakeAir: 'Fren havası',
    adblue: 'AdBlue',
    sinceStart: 'Motor Çalıştığından Beri',
    warnings: 'Uyarılar',
    consumption: 'Tüketim',
    odometer: 'Kilometre sayacı',
    retarder: 'Retarder',
    gear: 'Vites',
    trailer: 'Dorse',
    hitched: 'Bağlı',
    unhitched: 'Dorse yok',
    wearEngine: 'Motor',
    wearTransmission: 'Şanzıman',
    wearCabin: 'Kabin',
    wearChassis: 'Şasi',
    wearTrailer: 'Dorse lastikleri',
    running: 'Çalışıyor',
    engineOff: 'Motor kapalı',
    check: 'Kontrol et',
    service: 'Servis',
    fuel: 'Yakıt',
    range: 'Menzil',
    chassis: 'Şasi',
    off: 'Kapalı',
    trip: 'Yolculuk',
    distance: 'Mesafe',
    used: 'Tüketilen',
    average: 'Ortalama',
    time: 'Süre',
    reset: 'Sıfırla',
    noTelemetry: 'Değerler için oyunu başlat',
    overview: 'Genel bakış',
    driverHours: 'Sürüş saatleri',
    restStop: 'Sonraki mola',
    mandatoryBreak: 'Zorunlu mola',
    noRest: 'Bu profilde kapalı',
    controls: 'Kontroller',
    cruiseControl: 'Hız sabitleyici',
    lights: 'Işıklar',
    wipers: 'Silecekler',
    hours: 'sa',
    minutes: 'dk',
    parkingLight: 'Park lambaları',
    lowBeam: 'Kısa far',
    highBeam: 'Uzun far',
    indicatorLeft: 'Sol sinyal',
    indicatorRight: 'Sağ sinyal',
    on: 'Açık',
    trailerType: 'Tip',
    plate: 'Plaka',
    body: 'Kasa',
  },
  driver: {
    profile: 'Kariyer profili',
    noProfile: 'Oyun profili yüklenmedi',
    savedCareer: 'Tüm oyun modlarında kariyer toplamları',
    experience: 'Deneyim',
    totalDistance: 'Gerçek mesafe',
    gameTime: 'Oyun süresi',
    realTime: 'Gerçek süre',
    fuelUsed: 'Harcanan yakıt',
    citiesVisited: 'Keşfedilen şehirler',
    cancelledJobs: 'İptal edilen işler',
    history: 'Kariyer geçmişi',
    historyUnavailable:
      'Bu kayıt toplam istatistikleri içeriyor, ancak teslimat geçmişini içermiyor. Yukarıdaki istatistikler doğrudan oyundan alınır.',
    saveUnavailable: 'Kariyer istatistiklerini görmek için bir oyun profili yükleyin.',
  },
  notificationsApp: {
    empty: 'Henüz bildirim yok',
    hint: 'Aracın kendi uyarıları — akü, yağ basıncı, fren havası, yakıt ve AdBlue — ile mola saatleri geldikçe burada görünür: ekranda altı saniye, sonra bu listede. Yanmaya devam eden bir uyarı tek bildirimdir, saniyede bir yeni bildirim değil. Liste bu bilgisayarda saklanır, yeniden başlatınca da burada kalır.',
    alerts: 'Alarmlar',
    warnings: 'Uyarılar',
    alert: 'Alarm',
    warning: 'Uyarı',
    clear: 'Temizle',
    summary: (count) => `${count} bildirim`,
    openMaps: 'Haritalar’ı Aç',
    openDiagnostics: 'Tanılamayı Aç',
  },
  apps: {
    maps: 'Haritalar',
    music: 'Müzik',
    spotify: 'Spotify',
    youtube: 'YouTube',
    youtubeMusic: 'YouTube Music',
    podcasts: 'Podcast’ler',
    phone: 'Telefon',
    messages: 'Mesajlar',
    weather: 'Hava Durumu',
    settings: 'Ayarlar',
    diagnostics: 'Tanılama',
    driver: 'Kariyer',
    notifications: 'Bildirimler',
  },
  notBuiltYet: 'Henüz hazır değil',
}

/**
 * Spanish, written whole (never by falling back to English): every label the cabin shows, word for word, so a
 * player whose game is in Spanish sees nothing in English.
 */
const SPANISH_STRINGS: Strings = {
  decimal: ',',
  number: (value) => new Intl.NumberFormat('es-ES').format(value),
  arrival: 'llegada',
  minutes: (minutes) => `${minutes} min`,
  hours: (hours, minutes) => `${hours}:${minutes} h`,
  speedLimit: (limit) => `Límite ${limit}`,
  now: 'Ahora',
  then: 'Después',
  arrive: 'Llegar al destino',
  turns: {
    'slight-left': 'Gira levemente a la izquierda',
    left: 'Gira a la izquierda',
    'sharp-left': 'Gira bruscamente a la izquierda',
    'slight-right': 'Gira levemente a la derecha',
    right: 'Gira a la derecha',
    'sharp-right': 'Gira bruscamente a la derecha',
    'u-turn': 'Da un cambio de sentido',
    'keep-left': 'Mantente a la izquierda',
    'keep-right': 'Mantente a la derecha',
    'exit-left': 'Toma la salida de la izquierda',
    'exit-right': 'Toma la salida de la derecha',
  },
  roundabout: (exit) => `En la rotonda, toma la ${exit}.ª salida`,
  recentre: 'Centrar',
  northUp: 'Norte arriba',
  zoomIn: 'Acercar',
  zoomOut: 'Alejar',
  search: 'Buscar',
  searchPlaces: 'Busca lugares y ciudades',
  close: 'Cerrar',
  destinations: {
    favourites: 'Favoritos',
    headquarters: 'Sede',
    yourGarage: 'Tu garaje',
    findNearby: 'Buscar cerca',
    alongRoute: 'En la ruta',
    recents: 'Recientes',
    wholeRoute: 'Ruta completa',
    mapDetail: 'Detalle',
    mapBalanced: 'Equilibrado',
    mapNight: 'Atenuar de Noche',
    mapJunction: 'Alejar en los Cruces',
    mapTrucks: 'Otros Conductores',
    mapTraffic: 'Tráfico',
    mapRecentre: 'Volver al Camión',
    mapNever: 'Nunca',
    routeColour: 'Color de la Ruta',
    routeBlue: 'Azul',
    routeTeal: 'Turquesa',
    routePurple: 'Morado',
    routeAmber: 'Ámbar',
    routeWeight: 'Grosor de la Ruta',
    weightThin: 'Fino',
    weightStandard: 'Estándar',
    weightBold: 'Grueso',
    marker: 'Marcador del Vehículo',
    markerArrow: 'Flecha',
    markerDot: 'Punto',
    markerTruck: 'Camión',
    markerSize: 'Tamaño del Marcador',
    sizeSmall: 'Pequeño',
    sizeMedium: 'Mediano',
    sizeLarge: 'Grande',
    mapNorth: 'Norte Arriba',
    mapLimit: 'Señal de Límite',
    mapOver: 'Avisar al Superar',
    mapCompass: 'Brújula',
    mapScale: 'Barra de Escala',
    mapNightFrom: 'Atenuar Desde',
    pinStyle: 'Marcadores del Mapa',
    pinFilled: 'Rellenos',
    pinOutlined: 'Contorno',
    pinsFuel: 'Gasolineras',
    pinsParking: 'Áreas de Descanso',
    pinsService: 'Talleres',
    stopNumber: (number) => `Parada ${number}`,
    clearRecents: 'Borrar',
    routeChanged: 'Ruta cambiada',
    arrived: 'Has llegado',
    kinds: {
      fuel: 'Gasolinera',
      service: 'Taller',
      garage: 'Garaje',
      dealer: 'Concesionario de camiones',
      company: 'Empresa',
      parking: 'Área de descanso',
      hotel: 'Hotel',
      recruitment: 'Agencia de empleo',
      weigh: 'Báscula de pesaje',
      ferry: 'Ferri',
      train: 'Tren',
      city: 'Ciudad',
    },
    nearby: {
      fuel: 'Gasolineras',
      parking: 'Áreas de descanso',
      service: 'Talleres',
      hotel: 'Hoteles',
      company: 'Empresas',
      dealer: 'Concesionarios',
      ferry: 'Ferris',
      city: 'Ciudades',
    },
    straightLine: (distance) => `${distance} de distancia`,
    alongTheRoute: (distance) => `${distance} por la ruta`,
    stopAdds: (distance, time) => `Parada añadida · suma ${distance} y ${time}`,
    notOnRoute: 'Parada añadida, pero la ruta del juego no pasa por ella',
    plans: { fastest: 'Más rápida', shortest: 'Más corta', smallRoads: 'Carreteras secundarias', other: 'Otra ruta' },
    finding: 'Buscando rutas',
    ownWay: 'Ruta creada: el juego irá por su cuenta',
    go: 'Ir',
    addStop: 'Añadir parada',
    endRoute: 'Terminar ruta',
    back: 'Atrás',
    noResults: 'Sin resultados',
    loading: 'Cargando lugares',
    noPlaces: 'Aún no hay lugares en este mapa',
    done: { go: 'Ruta creada', addStop: 'Parada añadida', end: 'Ruta terminada' },
    alreadyThere: 'Ya es una parada de la ruta',
    full: 'La ruta tiene 10 paradas, el máximo del juego',
    onJob: 'En un trabajo, el destino es el del trabajo',
    noAnswer: 'El juego no respondió',
    elevated: 'El juego se ejecuta como administrador, así que Cabin Play no ve su ruta. Inícialo con normalidad',
    unsupported: 'Esta versión del juego aún no es compatible',
    failed: 'El juego no pudo trazar la ruta',
  },
  keyboard: {
    space: 'espacio',
    returnKey: { search: 'Buscar', go: 'Ir', done: 'Listo' },
    shift: 'Mayús',
    capsLock: 'Bloq Mayús',
    delete: 'Suprimir',
    nextKeyboard: 'Siguiente teclado',
    hide: 'Ocultar teclado',
    clear: 'Borrar texto',
    typingWithKeyboard: 'Escribiendo con tu teclado',
    pausedWhileDriving: 'Teclado en pausa mientras conduces',
    selectToType: 'Selecciona el campo para escribir con tu teclado',
  },
  nowPlaying: 'Reproduciendo',
  sources: 'Fuentes',
  previous: 'Anterior',
  play: 'Reproducir',
  pause: 'Pausar',
  next: 'Siguiente',
  shuffle: 'Aleatorio',
  repeat: 'Repetir',
  notPlaying: 'Sin reproducción',
  openMusicApp: 'Abre Apple Music, Spotify o YouTube Music en tu PC.',
  nothingLoaded: 'Nada cargado',
  playing: 'Sonando',
  fuel: 'Combustible',
  income: 'Ingresos',
  range: (distance) => `${distance} de autonomía`,
  delivery: 'Entrega',
  pickup: 'Recogida',
  destination: 'Destino',
  mapPoint: 'Punto del mapa',
  arriveBy: (time) => `Llega antes de ${time}`,
  late: 'Tarde',
  days: ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'],
  weather: { clear: 'Despejado', rain: 'Lluvia' },
  weatherTurning: { clear: 'Despejándose', rain: 'Empieza a llover' },
  youtube: {
    search: 'Buscar en YouTube',
    continueWatching: 'Seguir viendo',
    recentSearches: 'Búsquedas recientes',
    chips: [
      { label: 'Camiones', query: 'trucking' },
      { label: 'Música', query: 'music' },
      { label: 'Pódcasts', query: 'podcast' },
      { label: 'Videojuegos', query: 'gaming' },
      { label: 'En directo', query: 'live' },
    ],
    start: '¿Qué quieres ver? Busca o elige una opción de arriba.',
    noResults: 'Sin resultados',
    failed: 'YouTube no respondió.',
    tryAgain: 'Reintentar',
    live: 'EN DIRECTO',
    upNext: 'A continuación',
    nowPlaying: 'Reproduciendo',
    back: 'Atrás',
    volume: 'Volumen',
    forget: 'Quitar',
    fill: 'Poner en el cuadro',
    clear: 'Borrar',
    fullScreen: 'Pantalla completa',
    signIn: 'Iniciar sesión',
    signOut: 'Cerrar sesión',
    all: 'Todo',
    channels: 'Canales',
    subscribe: 'Suscribirse',
    subscribed: 'Suscrito',
    playlists: 'Listas',
    playlist: 'Lista',
    playAll: 'Reproducir todo',
    captions: 'Subtítulos',
    off: 'Desactivado',
    quality: 'Calidad',
    auto: 'Automática',
    settings: 'Ajustes',
    playbackSpeed: 'Velocidad de reproducción',
    normal: 'Normal',
    audioTrack: 'Pista de audio',
    stableVolume: 'Volumen estable',
    voiceBoost: 'Realce de voz',
    home: 'Inicio',
    subscriptions: 'Suscripciones',
    finishOnPc:
      'Termina de iniciar sesión en tu PC: el inicio de sesión de Google está abierto en una ventana de tu escritorio.',
    seconds: (seconds) => `${seconds} segundos`,
  },
  spotify: {
    finishOnPc:
      'Termina de iniciar sesión en tu PC: el inicio de sesión de Spotify está abierto en una ventana de tu escritorio.',
    whatToPlay: '¿Qué quieres reproducir?',
    home: 'Inicio',
    library: 'Tu biblioteca',
    browse: 'Explorar',
    back: 'Atrás',
    filters: { all: 'Todo', music: 'Música', podcasts: 'Pódcasts' },
    showAll: 'Mostrar todo',
    browseAll: 'Explorar todo',
    recentSearches: 'Búsquedas recientes',
    clearRecent: 'Borrar búsquedas recientes',
    forget: 'Quitar',
    noResults: (query) => `No hay resultados para «${query}»`,
    noResultsHint: 'Revisa la ortografía o prueba con menos palabras o con otras.',
    topResult: 'Resultado principal',
    songs: 'Canciones',
    artists: 'Artistas',
    playlists: 'Listas',
    albums: 'Álbumes',
    podcasts: 'Pódcasts y programas',
    kinds: {
      playlist: 'Lista',
      album: 'Álbum',
      artist: 'Artista',
      show: 'Pódcast',
      liked: 'Lista',
      song: 'Canción',
    },
    songCount: (count) => (count === 1 ? '1 canción' : `${count} canciones`),
    length: (seconds) => {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min ${Math.floor(seconds % 60)} s`
    },
    recents: 'Recientes',
    gridView: 'Vista de cuadrícula',
    listView: 'Vista de lista',
    verified: 'Artista verificado',
    follow: 'Seguir',
    following: 'Siguiendo',
    monthlyListeners: (count) => `${count} oyentes mensuales`,
    popular: 'Popular',
    discography: 'Discografía',
    playingFrom: {
      playlist: 'Reproduciendo una lista',
      album: 'Reproduciendo un álbum',
      artist: 'Reproduciendo un artista',
      show: 'Reproduciendo un pódcast',
      liked: 'Reproduciendo tu biblioteca',
    },
    nowPlaying: 'Reproduciendo',
    queue: 'Cola',
    nextFrom: (name) => `A continuación de: ${name}`,
    nextUp: 'A continuación',
    lyrics: 'Letra',
    noLyrics: 'Parece que no tenemos la letra de esta canción.',
    notSynced: 'Esta letra aún no está sincronizada con la canción.',
    lyricsFrom: (provider) => `Letra de ${provider}`,
    volume: 'Volumen',
    mute: 'Silenciar',
    unmute: 'Activar sonido',
    cantPlay: 'Spotify no puede reproducir esto ahora mismo.',
    failed: 'Algo salió mal',
    tryAgain: 'Reintentar',
    next: 'Siguiente',
    previous: 'Anterior',
    shuffle: 'Aleatorio',
    repeat: 'Repetir',
    close: 'Cerrar',
    more: 'Más opciones',
    download: 'Descargar',
    addToLiked: 'Añadir a Canciones que te gustan',
    addToLibrary: 'Añadir a Tu biblioteca',
    added: 'Añadido a Canciones que te gustan.',
    removed: 'Quitado de Canciones que te gustan.',
    addedToLibrary: 'Añadido a Tu biblioteca.',
    removedFromLibrary: 'Quitado de Tu biblioteca.',
    logIn: 'Iniciar sesión',
    signUp: 'Registrarse',
    logOut: 'Cerrar sesión',
    account: 'Cuenta',
    previewTitle: 'Vista previa de Spotify',
    previewText: 'Regístrate para tener canciones y pódcasts sin límite con algún anuncio. No necesitas tarjeta.',
    signUpFree: 'Regístrate gratis',
    prompts: {
      play: { title: 'Empieza a escuchar con una cuenta de Spotify gratis', text: '' },
      save: {
        title: 'Guardar en Tu biblioteca',
        text: 'Inicia sesión para guardar canciones, álbumes, listas y artistas.',
      },
      playlist: { title: 'Crea una lista', text: 'Inicia sesión para crear y compartir listas.' },
    },
    haveAccount: '¿Ya tienes cuenta?',
    notNow: 'Ahora no',
    firstPlaylist: {
      title: 'Crea tu primera lista',
      text: 'Es fácil, te ayudamos',
      button: 'Crear lista',
    },
    firstPodcasts: {
      title: 'Busquemos pódcasts que seguir',
      text: 'Te avisaremos de los episodios nuevos',
      button: 'Explorar pódcasts',
    },
    explicit: 'E',
  },
  appleMusic: {
    tabs: { home: 'Inicio', new: 'Novedades', radio: 'Radio', library: 'Biblioteca', search: 'Buscar' },
    searchHint: 'Artistas, canciones, álbumes y más',
    browseCategories: 'Explorar categorías',
    recentlySearched: 'Búsquedas recientes',
    clear: 'Borrar',
    topResults: 'Mejores resultados',
    songs: 'Canciones',
    artists: 'Artistas',
    albums: 'Álbumes',
    playlists: 'Listas',
    stations: 'Emisoras',
    noResults: 'Sin resultados',
    noResultsHint: 'Prueba otra búsqueda.',
    seeAll: 'Ver todo',
    recentlyPlayed: 'Reproducido hace poco',
    recentlyAdded: 'Añadido hace poco',
    kinds: {
      album: 'Álbum',
      playlist: 'Lista',
      artist: 'Artista',
      station: 'Emisora',
      song: 'Canción',
      curator: 'Categoría',
      folder: 'Carpeta',
    },
    length: (songs, seconds) => {
      const minutes = Math.round(seconds / 60)
      const count = songs === 1 ? '1 canción' : `${songs} canciones`
      if (minutes < 60) return `${count}, ${minutes === 1 ? '1 minuto' : `${minutes} minutos`}`
      const hours = Math.floor(minutes / 60)
      const rest = minutes % 60
      return `${count}, ${hours === 1 ? '1 hora' : `${hours} horas`}${rest ? ` ${rest} minutos` : ''}`
    },
    topSongs: 'Canciones más escuchadas',
    play: 'Reproducir',
    shuffle: 'Aleatorio',
    live: 'EN DIRECTO',
    explicit: 'Explícito',
    preview: 'Vista previa',
    upNext: 'A continuación',
    lyrics: 'Letra',
    noLyrics: 'La letra no está disponible para esta canción.',
    writtenBy: (names) => `Escrita por: ${names}`,
    from: (name) => `De ${name}`,
    favorite: 'Favorito',
    favorited: 'Añadido a Favoritos',
    unfavorited: 'Quitado de Favoritos',
    addToLibrary: 'Añadir a la biblioteca',
    added: 'Añadido a la biblioteca',
    signIn: 'Iniciar sesión',
    signOut: 'Cerrar sesión',
    account: 'Cuenta',
    filter: 'Filtrar',
    more: 'Más',
    all: { playlists: 'Todas las listas', albums: 'Todos los álbumes', songs: 'Todas las canciones' },
    favorites: 'Favoritos',
    grid: 'Cuadrícula',
    list: 'Lista',
    find: 'Buscar',
    sorts: {
      name: 'Título',
      '-dateAdded': 'Fecha de añadido',
      '-lastPlayed': 'Última reproducción',
      '-updated': 'Fecha de actualización',
      type: 'Tipo de lista',
    },
    finishOnPc:
      'Termina de iniciar sesión en tu PC: el inicio de sesión de Apple Music está abierto en una ventana de tu escritorio.',
    homePitch: {
      title: 'Saca más partido a Apple Music',
      text: 'Inicia sesión para ver recomendaciones para ti, lo que has escuchado últimamente y tu biblioteca.',
    },
    libraryPitch: { title: 'Tu biblioteca', text: 'Inicia sesión para ver la música que has añadido.' },
    promptTitle: 'Inicia sesión en Apple Music',
    promptFor: {
      library: 'Inicia sesión para añadir música a tu biblioteca.',
      favorite: 'Inicia sesión para marcar canciones como favoritas.',
    },
    notNow: 'Ahora no',
    previewBanner: {
      title: 'Escucha las canciones completas',
      text: 'Inicia sesión para reproducir cada canción entera, no su vista previa.',
    },
    empty: 'Aquí aún no hay nada.',
    cantPlay: 'Apple Music no puede reproducir esto ahora mismo.',
    failed: 'No se pudo cargar.',
    tryAgain: 'Reintentar',
    back: 'Atrás',
    close: 'Cerrar',
    nowPlaying: 'Reproduciendo',
    next: 'Siguiente',
    previous: 'Anterior',
    repeat: 'Repetir',
    volume: 'Volumen',
    mute: 'Silenciar',
    unmute: 'Activar sonido',
  },
  youtubeMusic: {
    tabs: { home: 'Inicio', explore: 'Explorar', library: 'Biblioteca', search: 'Buscar' },
    searchHint: 'Busca canciones, artistas y pódcasts',
    remove: 'Quitar',
    more: 'Más',
    play: 'Reproducir',
    shuffle: 'Aleatorio',
    radio: 'Radio',
    save: 'Guardar en la biblioteca',
    saved: 'Guardado en la biblioteca',
    removed: 'Quitado de la biblioteca',
    inLibrary: 'Guardado',
    like: 'Me gusta',
    dislike: 'No me gusta',
    song: 'Canción',
    video: 'Vídeo',
    upNext: 'A continuación',
    lyrics: 'Letra',
    related: 'Relacionado',
    playingFrom: 'Reproduciendo desde',
    noLyrics: 'La letra no está disponible para esta canción.',
    shelves: {
      playlists: 'Listas',
      songs: 'Canciones',
      albums: 'Álbumes',
      artists: 'Artistas',
      subscriptions: 'Suscripciones',
      history: 'Historial',
    },
    topResult: 'Resultado principal',
    subscribers: (count) => `${count} suscriptores`,
    signIn: 'Iniciar sesión',
    signOut: 'Cerrar sesión',
    account: 'Cuenta',
    finishOnPc: 'Termina de iniciar sesión en tu PC.',
    libraryPitch: {
      title: 'Disfruta de tu música favorita',
      text: 'Inicia sesión para ver tus listas, canciones que te gustan y álbumes. Tu sesión de YouTube también sirve aquí.',
    },
    promptTitle: 'Inicia sesión en YouTube Music',
    promptFor: {
      library: 'Tus listas, canciones y álbumes están en tu biblioteca.',
      like: 'Las canciones que te gustan van a tu música que te gusta.',
      save: 'Los álbumes y listas que guardes van a tu biblioteca.',
    },
    notNow: 'Ahora no',
    empty: 'Aquí aún no hay nada.',
    noResults: 'Sin resultados',
    cantPlay: 'YouTube Music no puede reproducir esto ahora mismo.',
    failed: 'No se pudo cargar.',
    tryAgain: 'Reintentar',
    back: 'Atrás',
    close: 'Cerrar',
    nowPlaying: 'Reproduciendo',
    pause: 'Pausar',
    next: 'Siguiente',
    previous: 'Anterior',
    repeat: 'Repetir',
    ad: 'Anuncio',
    moreActions: 'Más acciones',
    startRadio: 'Iniciar radio',
    playNext: 'Reproducir a continuación',
    addToQueue: 'Añadir a la cola',
    goToAlbum: 'Ir al álbum',
    goToArtist: 'Ir al artista',
    willPlayNext: 'La canción se reproducirá a continuación',
    addedToQueue: 'Canción añadida a la cola',
    volume: 'Volumen',
  },
  weatherApp: {
    myLocation: 'Mi ubicación',
    nextChange: 'Próximo cambio',
    inAbout: (time) => `Dentro de ${time}`,
    roads: 'Carreteras',
    roadStates: { dry: 'Seca', damp: 'Húmeda', wet: 'Mojada' },
    roadTrends: { drying: 'Secándose', gettingWet: 'Mojándose' },
    unavailable: 'El tiempo se muestra mientras el juego está en marcha.',
  },
  settings: {
    appearance: 'Apariencia',
    light: 'Claro',
    dark: 'Oscuro',
    automatic: 'Automático',
    automaticFooter:
      'Oscuro de noche y cada vez que las luces están encendidas, como lo hace el sensor de luz del camión.',
    vehicleBar: 'Barra del vehículo',
    vehicleBarFooter:
      'La barra de información del camión junto a Cabin Play. Desactivada, Cabin Play ocupa toda la pantalla.',
    textSize: 'Tamaño del texto',
    textSizeAbout: 'Las apps de Cabin Play se ajustarán al tamaño de lectura que elijas abajo.',
    wallpaper: 'Fondo de pantalla',
    icons: 'Iconos de apps',
    iconStyle: 'Aspecto de iconos',
    reduceMotion: 'Reducir movimiento',
    reduceMotionFooter:
      'Cabin Play cambia de pantalla en el sitio, sin deslizamientos ni zooms, y sus apps se abren al instante.',
    autoOrder: 'Orden automático',
    autoOrderFooter:
      'La columna pone delante lo que pide la conducción: primero un aviso, luego una entrega que se acerca. Desactivado, mantiene tu orden.',
    moveUp: 'Subir',
    moveDown: 'Bajar',
    dashboard: 'Panel',
    widgets: 'Widgets',
    homeScreen: 'Pantalla de inicio',
    homeScreenFooter:
      'Elige qué apps aparecen en Inicio y en qué orden. Una app oculta sigue en Ajustes y en los recientes de la barra lateral.',
    showOnHome: 'Mostrar en Inicio',
    homeOrder: 'Orden',
    resetHomeScreen: 'Restablecer pantalla de inicio',
    realClock: 'Hora real',
    clockFooter: 'El reloj de la barra lateral: tu hora o la del juego.',
    showAlbumArt: 'Mostrar carátula del álbum',
    sound: 'Sonido',
    uiSounds: 'Sonidos de la Interfaz',
    uiSoundVolume: 'Volumen de sonidos de la interfaz',
    uiSoundsFooter:
      'Ajusta por separado los clics y avisos de la cabina. No cambia el volumen de la música ni del juego.',
    equalizer: 'Ecualizador',
    recommended: 'Recomendado',
    custom: 'Personalizado',
    equalizerFooter:
      'Cabin Play reproduce tu música por los altavoces de cada camión, ajustados a su cabina. Si prefieres otro sonido, puedes personalizar cómo suena cada app de música, en cada camión.',
    low: 'Graves',
    mid: 'Medios',
    high: 'Agudos',
    resetEqualizer: 'Restablecer',
    back: 'Atrás',
  },
  diagnostics: {
    engine: 'Motor',
    tires: 'Neumáticos',
    brakes: 'Frenos',
    coolant: 'Refrigerante',
    oil: 'Aceite',
    wear: 'Desgaste',
    rpm: 'Revoluciones',
    airPressure: 'Presión de aire',
    brakeTemperature: 'Temperatura de frenos',
    parkingBrake: 'Freno de mano',
    applied: 'Puesto',
    released: 'Suelto',
    normal: 'Normal',
    warm: 'Templado',
    high: 'Alto',
    low: 'Bajo',
    worn: 'Desgastado',
    stopped: 'Parado',
    celsius: '°C',
    psi: 'psi',
    kmh: 'km/h',
    km: 'km',
    litres: 'l',
    volts: 'V',
    lPer100: 'l/100 km',
    battery: 'Batería',
    oilPressure: 'Presión de aceite',
    brakeAir: 'Aire de frenos',
    adblue: 'AdBlue',
    sinceStart: 'Desde que arrancó el motor',
    warnings: 'Avisos',
    consumption: 'Consumo',
    odometer: 'Odómetro',
    retarder: 'Ralentizador',
    gear: 'Marcha',
    trailer: 'Remolque',
    hitched: 'Enganchado',
    unhitched: 'Sin remolque',
    wearEngine: 'Motor',
    wearTransmission: 'Transmisión',
    wearCabin: 'Cabina',
    wearChassis: 'Chasis',
    wearTrailer: 'Neumáticos del remolque',
    running: 'En marcha',
    engineOff: 'Motor apagado',
    check: 'Revisar',
    service: 'Al taller',
    fuel: 'Combustible',
    range: 'Autonomía',
    chassis: 'Chasis',
    off: 'Apagado',
    trip: 'Viaje',
    distance: 'Distancia',
    used: 'Consumido',
    average: 'Media',
    time: 'Tiempo',
    reset: 'Reiniciar',
    noTelemetry: 'Inicia el juego para ver valores',
    overview: 'Resumen',
    driverHours: 'Horas de conducción',
    restStop: 'Próximo descanso',
    mandatoryBreak: 'Descanso obligatorio',
    noRest: 'Desactivado en este perfil',
    controls: 'Controles',
    cruiseControl: 'Control de crucero',
    lights: 'Luces',
    wipers: 'Limpiaparabrisas',
    hours: 'h',
    minutes: 'min',
    parkingLight: 'Luces de posición',
    lowBeam: 'Cortas',
    highBeam: 'Largas',
    indicatorLeft: 'Intermitente izquierdo',
    indicatorRight: 'Intermitente derecho',
    on: 'Encendido',
    trailerType: 'Tipo',
    plate: 'Matrícula',
    body: 'Carrocería',
  },
  driver: {
    profile: 'Perfil de carrera',
    noProfile: 'No hay ningún perfil de juego cargado',
    savedCareer: 'Totales de carrera en todos los modos',
    experience: 'Experiencia',
    totalDistance: 'Distancia real',
    gameTime: 'Tiempo de juego',
    realTime: 'Tiempo real',
    fuelUsed: 'Combustible consumido',
    citiesVisited: 'Ciudades descubiertas',
    cancelledJobs: 'Trabajos cancelados',
    history: 'Historial de carrera',
    historyUnavailable:
      'Este guardado contiene totales, pero no un historial de entregas. Las estadísticas anteriores provienen directamente del juego.',
    saveUnavailable: 'Carga un perfil del juego para ver las estadísticas de carrera.',
  },
  notificationsApp: {
    empty: 'Aún no hay notificaciones',
    hint: 'Los avisos del propio camión —batería, presión de aceite, aire de frenos, combustible y AdBlue— y los relojes de descanso aparecen aquí al activarse: seis segundos en pantalla y luego en esta lista. Un aviso que sigue activo es una sola notificación, no una por segundo. La lista se guarda en este PC, así que sigue aquí tras reiniciar.',
    alerts: 'Alertas',
    warnings: 'Avisos',
    alert: 'Alerta',
    warning: 'Aviso',
    clear: 'Borrar',
    summary: (count) => (count === 1 ? '1 notificación' : `${count} notificaciones`),
    openMaps: 'Abrir Mapas',
    openDiagnostics: 'Abrir Diagnóstico',
  },
  apps: {
    maps: 'Mapas',
    music: 'Música',
    spotify: 'Spotify',
    youtube: 'YouTube',
    youtubeMusic: 'YouTube Music',
    podcasts: 'Pódcasts',
    phone: 'Teléfono',
    messages: 'Mensajes',
    weather: 'Tiempo',
    settings: 'Ajustes',
    diagnostics: 'Diagnóstico',
    driver: 'Carrera',
    notifications: 'Notificaciones',
  },
  notBuiltYet: 'Aún no disponible',
}

export const STRINGS: Record<Language, Strings> = {
  en: ENGLISH_STRINGS,
  tr: TURKISH_STRINGS,
  es: SPANISH_STRINGS,
}

/** The cabin's language for the game's (its `g_lang_init`, e.g. `tr_tr`; `null` until known). */
export function languageOf(gameLanguage: string | null): Language {
  const language = gameLanguage?.toLowerCase().slice(0, 2)
  return language === 'tr' || language === 'es' ? language : 'en'
}
