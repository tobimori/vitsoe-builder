// Matches `media.touch` in tokens.stylex.ts

/** A phone or tablet used with a finger: nothing to hover, and no Alt key to hold. */
export const touchScreen = window.matchMedia('(pointer: coarse)').matches
