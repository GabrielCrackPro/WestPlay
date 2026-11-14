import { describe, expect, it } from 'vitest'
import { STRINGS } from '../state/strings'
import { appFrom, mediaAction, normalizeSaid } from './commands'

describe('voice intents', () => {
  it('reads media commands in every cabin language', () => {
    expect(mediaAction('play')).toBe('play')
    expect(mediaAction('resume')).toBe('play')
    expect(mediaAction('pause')).toBe('pause')
    expect(mediaAction('stop music')).toBe('pause')
    expect(mediaAction('oynat')).toBe('play')
    expect(mediaAction('duraklat')).toBe('pause')
    expect(mediaAction('reproducir')).toBe('play')
    expect(mediaAction('detener música')).toBe('pause')
    expect(mediaAction('next track')).toBe('next')
    expect(mediaAction('skip')).toBe('next')
    expect(mediaAction('sonraki')).toBe('next')
    expect(mediaAction('anterior')).toBe('previous')
    expect(mediaAction('louder')).toBe('volumeUp')
    expect(mediaAction('sesi aç')).toBe('volumeUp')
    expect(mediaAction('bajar volumen')).toBe('volumeDown')
  })

  it('strips the polite lead-in and trailing words', () => {
    expect(normalizeSaid('Hey cabin, can you please open Maps?')).toBe('open maps')
    expect(normalizeSaid('abre mapas por favor')).toBe('abre mapas')
    expect(normalizeSaid('Lütfen müziği aç!')).toBe('muzigi ac')
  })

  it('finds apps by localized names and natural launch words', () => {
    expect(appFrom('open maps', STRINGS.en)).toBe('maps')
    expect(appFrom('launch spotify', STRINGS.en)).toBe('spotify')
    expect(appFrom('switch to apple music', STRINGS.en)).toBe('music')
    expect(appFrom('haritaları aç', STRINGS.tr)).toBe('maps')
    expect(appFrom('aç müziği', STRINGS.tr)).toBe('music')
    expect(appFrom('abre música', STRINGS.es)).toBe('music')
    expect(appFrom('abre youtube', STRINGS.es)).toBe('youtube')
    expect(appFrom('open youtube music', STRINGS.en)).toBe('youtubeMusic')
    expect(appFrom('open weather', STRINGS.en)).toBe('weather')
    expect(appFrom('abre el tiempo', STRINGS.es)).toBe('weather')
  })
})
