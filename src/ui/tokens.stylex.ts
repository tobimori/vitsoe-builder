import * as stylex from '@stylexjs/stylex'

export const colors = stylex.defineVars({
  ink: '#111111',
  muted: '#6b6b6b',
  faint: '#a8a8a8',
  line: '#d9d9d9',
  band: '#efefef',
  bandHover: '#e4e4e4',
  surface: '#fff',
  stage: '#e4e4e2',
  blue: '#0073b1',
  blueDark: '#005b8c',
  blueTint: '#e5f0f7',
  red: '#c4161c',
  notice: '#fffecb',
})

export const fonts = stylex.defineVars({
  body: '"Inter Variable", "Helvetica Neue", Helvetica, Arial, sans-serif',
})

export const weights = stylex.defineConsts({
  /** Close to Univers Bold, which Vitsœ uses for headings and the current page. */
  bold: '680',
  /** Univers Light, for large secondary lines. */
  light: '300',
})

// The layouts exclude each other, so no condition depends on the order StyleX writes them in;
// do not combine `narrow` with `single` or `stacked` in one property
export const media = stylex.defineConsts({
  /** A small laptop: both panels, narrower. */
  compact: '@media (max-width: 1100px) and (min-width: 961px) and (min-height: 501px)',
  /** A tablet, or a phone on its side: one panel beside the view. */
  single: '@media (max-width: 960px) and (min-width: 761px), (max-height: 500px)',
  /** A phone held upright: one panel under the view. */
  stacked: '@media (max-width: 760px) and (min-height: 501px)',
  /** A tablet or phone, either way round: `single` and `stacked` together. */
  narrow: '@media (max-width: 960px), (max-height: 500px)',
  /** Larger targets for fingers, and 16 px fields that iOS Safari does not zoom into. */
  touch: '@media (pointer: coarse)',
  reducedMotion: '@media (prefers-reduced-motion: reduce)',
})
