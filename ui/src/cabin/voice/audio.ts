import type { Equalizer, Speaker } from '../../shared/host'
import { lastCabSound } from '../apps/radio/cabSound'

/** The voice confirmations' own AudioContext, made on the mic press so later playback is allowed. */
let context: AudioContext | null = null
let playing: AudioBufferSourceNode | null = null

function contextOf(): AudioContext {
  if (!context) context = new AudioContext()
  return context
}

/** Call from the press that starts listening: browsers wake an AudioContext more readily from one. */
export function prepareVoiceAudio(): void {
  try {
    void contextOf().resume()
  } catch {
    // A browser without Web Audio keeps the visual confirmation; the panel still says what happened.
  }
}

/**
 * Plays a host-synthesized WAV through the same truck speakers, head and tone the radio uses. The graph mirrors
 * cab_sound.js's, but starts from a decoded buffer rather than a media element, so it never takes the radio's
 * element away from its own graph.
 */
export async function playVoiceAudio(encoded: string): Promise<void> {
  try {
    const cab = lastCabSound()
    // The speakers are in the cab: from outside it, the voice is silent like everything else.
    if (cab?.outside) return
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
    const audio = contextOf()
    if (audio.state === 'suspended') await audio.resume()
    const buffer = await audio.decodeAudioData(bytes.buffer as ArrayBuffer)
    playing?.stop()
    const source = audio.createBufferSource()
    source.buffer = buffer
    const nodes: AudioNode[] = []
    const keep = <T extends AudioNode>(node: T): T => {
      nodes.push(node)
      return node
    }
    const eq: Equalizer = cab?.equalizer ?? { bass: 0, mid: 0, treble: 0 }
    const bands = [
      keep(new BiquadFilterNode(audio, { type: 'lowshelf', frequency: 100, gain: eq.bass })),
      keep(new BiquadFilterNode(audio, { type: 'peaking', frequency: 1000, Q: 0.7, gain: eq.mid })),
      keep(new BiquadFilterNode(audio, { type: 'highshelf', frequency: 8000, gain: eq.treble })),
    ]
    const trim = keep(new GainNode(audio, { gain: 10 ** (-Math.max(0, eq.bass, eq.mid, eq.treble) / 20) }))
    bands.reduce((from, to) => (from.connect(to), to)).connect(trim)
    source.connect(bands[0])

    const speakers = cab?.speakers
    const head = cab?.head
    if (!speakers?.length || !head) {
      trim.connect(audio.destination)
    } else {
      const stereo = keep(
        new GainNode(audio, {
          channelCount: 2,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers',
        }),
      )
      const split = keep(audio.createChannelSplitter(2))
      trim.connect(stereo)
      stereo.connect(split)
      const channels: Record<'left' | 'right' | 'both', GainNode> = {
        left: keep(audio.createGain()),
        right: keep(audio.createGain()),
        both: keep(new GainNode(audio, { gain: 0.5 })),
      }
      split.connect(channels.left, 0)
      split.connect(channels.right, 1)
      split.connect(channels.both, 0)
      split.connect(channels.both, 1)

      const near = 0.3
      const fall = (at: Speaker['at'], from: NonNullable<typeof head>) =>
        near / Math.max(near, Math.hypot(at[0] - from.x, at[1] - from.y, at[2] - from.z))
      const seat = Math.sqrt(
        speakers.reduce((sum, speaker) => sum + (fall(speaker.at, head) * 10 ** (speaker.level / 20)) ** 2, 0),
      )
      const out = keep(new GainNode(audio, { gain: Math.min(6, Math.max(1, 10 ** (-2 / 20) / seat)) }))
      const limiter = keep(
        new DynamicsCompressorNode(audio, { threshold: -3, knee: 0, ratio: 20, attack: 0.003, release: 0.1 }),
      )
      out.connect(limiter)
      limiter.connect(audio.destination)

      const listener = audio.listener
      const across = head.heading * 2 * Math.PI
      const up = head.pitch * 2 * Math.PI
      listener.positionX.value = head.x
      listener.positionY.value = head.y
      listener.positionZ.value = head.z
      listener.forwardX.value = -Math.sin(across) * Math.cos(up)
      listener.forwardY.value = Math.sin(up)
      listener.forwardZ.value = -Math.cos(across) * Math.cos(up)
      listener.upX.value = Math.sin(across) * Math.sin(up)
      listener.upY.value = Math.cos(up)
      listener.upZ.value = Math.cos(across) * Math.sin(up)

      for (const speaker of speakers) {
        let node: AudioNode = channels[speaker.channel ?? 'both']
        const [from, to] = speaker.band
        for (const [type, frequency] of [
          ...(from > 0 ? ([['highpass', from]] as const) : []),
          ...(to > 0 ? ([['lowpass', to]] as const) : []),
        ]) {
          for (let pass = 0; pass < 2; pass++) {
            const filter = keep(new BiquadFilterNode(audio, { type, frequency, Q: Math.SQRT1_2 }))
            node.connect(filter)
            node = filter
          }
        }
        const level = keep(new GainNode(audio, { gain: 10 ** (speaker.level / 20) }))
        node.connect(level)
        node = level
        if (speaker.delay > 0) {
          const late = keep(new DelayNode(audio, { delayTime: Math.min(speaker.delay, 50) / 1000, maxDelayTime: 0.05 }))
          node.connect(late)
          node = late
        }
        const panner = keep(
          new PannerNode(audio, {
            panningModel: 'HRTF',
            distanceModel: 'inverse',
            refDistance: near,
            rolloffFactor: 1,
            positionX: speaker.at[0],
            positionY: speaker.at[1],
            positionZ: speaker.at[2],
          }),
        )
        node.connect(panner)
        panner.connect(out)
      }
    }

    playing = source
    source.onended = () => {
      if (playing === source) playing = null
      for (const node of nodes) node.disconnect()
      source.disconnect()
    }
    source.start()
  } catch {
    // The panel's words are the confirmation if the audio path cannot play.
  }
}
