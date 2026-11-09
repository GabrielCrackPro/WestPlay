/**
 * The text sizes the player chooses from (Settings › Appearance › Text Size), nine steps, each a scale of the apps'
 * text (their `font-size`s times `--text-scale`). Only the text: icons, artwork, keys and spacing stay as they are
 * (owner 2026-10-22). Larger than iOS's own (its 0.82 to 1.35 about the default): a screen in a cab, seen through the
 * game, needs larger text, and that range was too thin to tell (owner 2026-10-24: "the texts are too small. Move the
 * text size range to larger side overall"): up to twice the apps' text as designed, as iOS's larger accessibility
 * sizes go. And down to 0.8 of it, iOS's own small end, for a screen seen larger or closer than the DAF's (owner
 * 2026-10-24, on the tablet: "Extend the range of text size").
 */
export const TEXT_SIZES = [0.8, 0.9, 1, 1.12, 1.24, 1.35, 1.5, 1.7, 2] as const

/** The step WestPlay starts on: a quarter larger than the apps' text as designed. */
export const DEFAULT_TEXT_SIZE = 4

/** The steps added below the others on 2026-10-24 (0.8 and 0.9): a step kept from before is this many further on. */
export const STEPS_ADDED_BELOW = 2

/** A step kept or sent, as one there is (anything else: the default). */
export function toTextSize(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < TEXT_SIZES.length
    ? value
    : DEFAULT_TEXT_SIZE
}

/** How much a step scales the apps' text. */
export function textScale(step: number): number {
  return TEXT_SIZES[toTextSize(step)]
}

/**
 * The cluster's share of the same choice (Settings › Appearance › Text Size). Its page is a fixed 1280 x 480 panel —
 * a texture the host draws on the truck's own dash — so it can't take the apps' whole range: twice their text would
 * not fit a dash, and the columns keep their width whatever the panel does. What it takes is the panel's own room,
 * 0.98 to 1.16 of the size the dash is drawn at.
 *
 * For the cluster the step is the size of the whole dash, not of its type (cluster.css zooms the panel by it): a
 * gauge that stayed put while its caption grew would read as a text box laid over a diagram, and the owner asked
 * for the opposite — "all of it have to be bigger not just the text" (2026-11-09). What stays put is the speed
 * figure: it is already the size the face gave it, and it is the one number the panel must not make bigger than the
 * dial's own scale (`.cluster-speed strong` holds it at 108 px of the texture at every step).
 *
 * The step WestPlay starts on is a step larger than the dash is drawn at (owner 2026-11-09: "make cluster look
 * bigger, so i can read it all"): the panel is read through the truck's glass from the seat, a little further away
 * than a screen. The whole range moved up with it, so the smallest step is the panel as drawn and the largest is the
 * most its columns hold — the last steps move it little because there is nothing left to give: it is one 1280 x 480
 * panel, and every reading on it is already drawn.
 */
export const CLUSTER_TEXT_SIZES = [0.98, 1.01, 1.04, 1.07, 1.12, 1.13, 1.14, 1.15, 1.16] as const

/** How much a step scales the cluster's panel. */
export function clusterTextScale(step: number): number {
  return CLUSTER_TEXT_SIZES[toTextSize(step)]
}
