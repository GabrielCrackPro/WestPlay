import { describe, expect, it } from 'vitest'
import { CLUSTER_TEXT_SIZES, DEFAULT_TEXT_SIZE, TEXT_SIZES, clusterTextScale, textScale, toTextSize } from './textSize'

describe('text size', () => {
  it('goes from a little smaller than the apps’ text as designed to twice it, starting a quarter larger', () => {
    expect(TEXT_SIZES[0]).toBe(0.8)
    expect(TEXT_SIZES[TEXT_SIZES.length - 1]).toBe(2)
    expect(textScale(DEFAULT_TEXT_SIZE)).toBe(1.24)
    expect(TEXT_SIZES.every((scale, index) => index === 0 || scale > TEXT_SIZES[index - 1])).toBe(true)
  })

  it('gives the cluster the same choice, in the room its 1280 x 480 panel has', () => {
    // Every step moves it, the one WestPlay starts on draws the dash as designed, and nothing asks for more type
    // than the 408 px columns have (0.9 to 1.16 of the sizes the dash is drawn at).
    expect(clusterTextScale(DEFAULT_TEXT_SIZE)).toBe(1)
    expect(CLUSTER_TEXT_SIZES[0]).toBe(0.9)
    expect(CLUSTER_TEXT_SIZES[CLUSTER_TEXT_SIZES.length - 1]).toBe(1.16)
    expect(CLUSTER_TEXT_SIZES.every((scale, index) => index === 0 || scale > CLUSTER_TEXT_SIZES[index - 1])).toBe(true)
    expect(clusterTextScale(0)).toBe(0.9)
    expect(clusterTextScale(8)).toBe(1.16)
    expect(clusterTextScale(99)).toBe(clusterTextScale(DEFAULT_TEXT_SIZE))
  })

  it('keeps only a step there is', () => {
    expect(toTextSize(8)).toBe(8)
    expect(toTextSize(0)).toBe(0)
    for (const wrong of [-1, 9, 2.5, '4', null, undefined]) expect(toTextSize(wrong)).toBe(DEFAULT_TEXT_SIZE)
  })
})
