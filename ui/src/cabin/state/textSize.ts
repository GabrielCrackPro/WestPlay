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
 * not fit a dash, and the columns keep their width whatever the type does. What it takes is the panel's own room,
 * 0.9 to 1.16 of the size the dash is drawn at, and the dial keeps its size at every step: the speed is a figure,
 * not text, and shrinking it as the labels grow would be the opposite of reading easier (cluster.css spreads the
 * type by these scales and takes the difference back out of the spaces between the blocks). The step WestPlay starts
 * on is the dash as it is drawn now (owner 2026-11-09: "let the cluster follow the Text Size setting instead of one
 * fixed scale").
 */
export const CLUSTER_TEXT_SIZES = [0.9, 0.92, 0.95, 0.97, 1, 1.04, 1.08, 1.12, 1.16] as const

/** How much a step scales the cluster's panel. */
export function clusterTextScale(step: number): number {
  return CLUSTER_TEXT_SIZES[toTextSize(step)]
}
