const FLOOR_DB = -52
const CEILING_DB = -12

/** How loud a block of microphone samples is, 0 (silence) to 1 (the meter's ceiling). */
export function levelOf(samples: ArrayLike<number>): number {
  let energy = 0
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index]
    if (Number.isFinite(sample)) energy += sample * sample
  }
  const rms = samples.length > 0 ? Math.sqrt(energy / samples.length) : 0
  if (rms <= 0) return 0
  const db = 20 * Math.log10(rms)
  return Math.min(1, Math.max(0, (db - FLOOR_DB) / (CEILING_DB - FLOOR_DB)))
}

/**
 * Follows the microphone for one utterance, calling `onLevel` 0 to 1 at about 30 Hz. The stream is opened only
 * for this listener and stopped by the returned function, so the mic is never left on after listening ends.
 *
 * If permission or capture is refused, the listener stays silent rather than making a level up.
 */
export function followMicrophoneLevel(onLevel: (level: number) => void): () => void {
  let stopped = false
  let frame = 0
  let stream: MediaStream | null = null
  let context: AudioContext | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let analyser: AnalyserNode | null = null

  const stop = () => {
    stopped = true
    if (frame) cancelAnimationFrame(frame)
    source?.disconnect()
    stream?.getTracks().forEach((track) => track.stop())
    if (context && context.state !== 'closed') void context.close().catch(() => {})
    onLevel(0)
  }

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return
    let captured: MediaStream | null = null
    try {
      captured = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
    } catch {
      // Some microphones refuse those constraints; the meter can still follow the processed stream.
      try {
        captured = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        return
      }
    }
    if (!captured) return
    if (stopped) {
      captured.getTracks().forEach((track) => track.stop())
      return
    }

    stream = captured
    try {
      context = new AudioContext()
      source = context.createMediaStreamSource(captured)
      analyser = context.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      if (context.state === 'suspended') await context.resume().catch(() => {})
    } catch {
      stop()
      return
    }
    if (stopped || !analyser) return

    const samples = new Float32Array(analyser.fftSize)
    let smoothed = 0
    let last = 0
    const tick = (now: number) => {
      if (stopped || !analyser) return
      if (now - last >= 33) {
        last = now
        analyser.getFloatTimeDomainData(samples)
        const target = levelOf(samples)
        // Quick to follow a voice, slower to fall away, as a meter does.
        smoothed += (target - smoothed) * (target > smoothed ? 0.6 : 0.18)
        onLevel(smoothed)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
  }

  void start()
  return stop
}
