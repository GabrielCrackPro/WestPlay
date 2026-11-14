import type { PhoneContact } from '../../shared/host'
import { contactsMatching, sendPhoneCommand } from '../apps/phone/phone'
import { changeRoute } from '../maps/routeChange'
import { type Destination, fold, searchPlaces } from '../maps/places'
import { go, useCabin } from '../state/store'
import type { Strings } from '../state/strings'
import { appFrom, mediaAction, normalizeSaid } from './commands'
import { mediaCommand, type Showing } from './media'

export interface VoiceContext {
  places: readonly Destination[]
  contacts: readonly PhoneContact[]
  text: Strings
}

export interface VoiceOutcome {
  message: string
  spoken: string
}

const CALL_PREFIXES = ['call ', 'dial ', 'phone ', 'ring ', 'ara ', 'llama a ', 'llamar a ', 'marca ', 'telefonea a ']
const NAVIGATE_PREFIXES = [
  'navigate to ',
  'take me to ',
  'give me directions to ',
  'directions to ',
  'route to ',
  'set destination to ',
  'go to ',
  'drive to ',
  'head to ',
  'git ',
  've a ',
  'navega a ',
  'navegar a ',
  'llevame a ',
  'ir a ',
  'ruta a ',
]
const STOP_PREFIXES = [
  'add stop at ',
  'add a stop at ',
  'make a stop at ',
  'stop at ',
  'stop by ',
  'ekle ',
  'durak ekle ',
  'mola ekle ',
  'anade una parada en ',
  'anadir una parada en ',
  'para en ',
  'haz una parada en ',
]
const ANSWER = [
  'answer',
  'answer call',
  'answer phone',
  'answer the phone',
  'pick up',
  'accept call',
  'cevapla',
  'cevap ver',
  'contesta',
  'contestar',
  'responde',
  'acepta llamada',
]
const HANG_UP = [
  'end call',
  'hang up',
  'end the call',
  'drop call',
  'aramayi bitir',
  'aramayi kapat',
  'colgar',
  'cuelga',
  'terminar llamada',
  'finaliza llamada',
]
const END_ROUTE = [
  'end route',
  'cancel route',
  'stop navigation',
  'end navigation',
  'cancel navigation',
  'stop route',
  'rotayi bitir',
  'navigasyonu bitir',
  'rotayi iptal et',
  'terminar ruta',
  'finalizar ruta',
  'cancelar ruta',
  'detener navegacion',
]
const HOME = [
  'go home',
  'home',
  'home screen',
  'main screen',
  'show home',
  'show the home screen',
  'eve git',
  'eve don',
  'ana ekran',
  'ana ekrana git',
  'inicio',
  'pantalla de inicio',
  've a casa',
  've al inicio',
  'vuelve al inicio',
]
const DASHBOARD = [
  'dashboard',
  'show dashboard',
  'open dashboard',
  'gosterge paneli',
  'gosterge panelini ac',
  'paneli goster',
  'panel',
  'abre el panel',
  'muestra el panel',
]
const WEATHER_COMMANDS = [
  'what is the weather',
  'what is the weather like',
  'how is the weather',
  'weather',
  'show weather',
  'open weather',
  'hava nasil',
  'hava durumu',
  'hava durumunu goster',
  'que tiempo hace',
  'como esta el tiempo',
  'mostrar el tiempo',
]
const DIAGNOSTICS_COMMANDS = [
  'how is the truck',
  'how is the truck doing',
  'truck status',
  'truck health',
  'diagnostics',
  'show diagnostics',
  'open diagnostics',
  'camak nasil',
  'kamyon durumu',
  'tanilama',
  'como esta el camión',
  'estado del camión',
  'diagnostico',
]
const DRIVER_COMMANDS = [
  'show me my stats',
  'show my stats',
  'my stats',
  'driver stats',
  'driver profile',
  'show driver',
  'open driver',
  'istatistiklerimi goster',
  'surucu istatistikleri',
  'surucu profili',
  'mostrar mis estadisticas',
  'estadisticas del conductor',
  'perfil del conductor',
]
const NIGHT_MODE_ON = [
  'turn on night mode',
  'enable night mode',
  'night mode on',
  'go to dark mode',
  'switch to dark',
  'gece modunu ac',
  'karanlik moda gec',
  'activar modo noche',
  'activar modo oscuro',
  'cambiar a oscuro',
]
const NIGHT_MODE_OFF = [
  'turn off night mode',
  'disable night mode',
  'night mode off',
  'go to light mode',
  'switch to light',
  'gece modunu kapat',
  'aydinli moda gec',
  'desactivar modo noche',
  'desactivar modo oscuro',
  'cambiar a claro',
]
const DND_TOGGLE = [
  'toggle do not disturb',
  'turn on do not disturb',
  'turn off do not disturb',
  'enable do not disturb',
  'disable do not disturb',
  'do not disturb',
  'rahatsiz etme',
  'rahatsiz etmeyi ac',
  'rahatsiz etmeyi kapat',
  'activar no molestar',
  'desactivar no molestar',
  'no molestar',
]

/** Reads one transcript and carries out the command it names. */
export async function handleVoice(transcript: string, context: VoiceContext, showing: Showing): Promise<VoiceOutcome> {
  const said = normalizeSaid(transcript)
  const done = context.text.voice.done
  if (!said) return { message: context.text.voice.notUnderstood, spoken: context.text.voice.notUnderstood }

  if (ANSWER.includes(said)) {
    sendPhoneCommand({ action: 'answer' })
    return { message: done, spoken: done }
  }
  if (HANG_UP.includes(said)) {
    sendPhoneCommand({ action: 'end' })
    return { message: done, spoken: done }
  }

  for (const prefix of CALL_PREFIXES) {
    if (!said.startsWith(prefix)) continue
    const name = said.slice(prefix.length).trim()
    if (!name) break
    const contact =
      contactsMatching([...context.contacts], name)[0] ??
      [...context.contacts].find((contact) => fold(contact.name).includes(name))
    if (contact) {
      sendPhoneCommand({ action: 'dial', number: contact.numbers[0] ?? name })
      go({ type: 'openApp', app: 'phone' })
      return { message: done, spoken: done }
    }
    if (/\d/.test(name)) {
      sendPhoneCommand({ action: 'dial', number: name })
      go({ type: 'openApp', app: 'phone' })
      return { message: done, spoken: done }
    }
    break
  }

  if (END_ROUTE.includes(said)) {
    await changeRoute('end')
    return { message: done, spoken: done }
  }

  for (const prefix of STOP_PREFIXES) {
    if (!said.startsWith(prefix)) continue
    const query = said.slice(prefix.length).trim()
    const place = findPlace(query, context)
    if (place) {
      go({ type: 'openApp', app: 'maps' })
      await changeRoute('addStop', place.node)
      return { message: done, spoken: done }
    }
  }
  for (const prefix of NAVIGATE_PREFIXES) {
    if (!said.startsWith(prefix)) continue
    const query = said.slice(prefix.length).trim()
    const place = findPlace(query, context)
    if (place) {
      go({ type: 'openApp', app: 'maps' })
      await changeRoute('go', place.node)
      return { message: done, spoken: done }
    }
  }

  const media = mediaAction(said)
  if (media) {
    if (mediaCommand(media, showing)) return { message: done, spoken: done }
  }

  if (HOME.includes(said)) {
    go({ type: 'showHome' })
    return { message: done, spoken: done }
  }
  if (DASHBOARD.includes(said)) {
    go({ type: 'showDashboard' })
    return { message: done, spoken: done }
  }

  // Weather: open the weather app
  if (WEATHER_COMMANDS.includes(said)) {
    go({ type: 'openApp', app: 'weather' })
    return { message: done, spoken: done }
  }

  // Diagnostics: open the diagnostics app
  if (DIAGNOSTICS_COMMANDS.includes(said)) {
    go({ type: 'openApp', app: 'diagnostics' })
    return { message: done, spoken: done }
  }

  // Driver stats: open the driver app
  if (DRIVER_COMMANDS.includes(said)) {
    go({ type: 'openApp', app: 'driver' })
    return { message: done, spoken: done }
  }

  // Night mode: switch appearance to dark or light
  if (NIGHT_MODE_ON.includes(said)) {
    useCabin.getState().setAppearanceMode('dark')
    return { message: done, spoken: done }
  }
  if (NIGHT_MODE_OFF.includes(said)) {
    useCabin.getState().setAppearanceMode('light')
    return { message: done, spoken: done }
  }

  // Do Not Disturb: toggle
  if (DND_TOGGLE.includes(said)) {
    const state = useCabin.getState()
    // DND is controlled by the notifications store; we toggle the dnd flag
    const currentDnd = state.uiSounds === false
    state.setUiSounds(!currentDnd)
    return { message: done, spoken: done }
  }

  const app = appFrom(said, context.text)
  if (app) {
    go({ type: 'openApp', app })
    return { message: done, spoken: done }
  }

  return { message: context.text.voice.notUnderstood, spoken: context.text.voice.notUnderstood }
}

function findPlace(query: string, context: VoiceContext): Destination | null {
  if (!query) return null
  const found = searchPlaces(context.places, query, null, context.text.destinations.kinds)[0]
  if (found) return found
  return (
    context.places.find((place) =>
      [place.name, place.localized, place.city].some((name) => name !== undefined && fold(name).includes(query)),
    ) ?? null
  )
}
