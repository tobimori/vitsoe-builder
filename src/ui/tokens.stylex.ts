import * as stylex from '@stylexjs/stylex'

export const colors = stylex.defineVars({
  ink: '#151515',
  canvas: '#f3f2ef',
  panel: '#fff',
  muted: '#6d6c69',
  line: '#c2c2c2',
  rule: '#deddda',
  divider: '#ddd',
  neutral: '#eee',
  strong: '#242424',
  blue: '#0073b1',
  red: '#d72000',
})

export const fonts = stylex.defineVars({
  body: 'Univers, Helvetica, Arial, sans-serif',
})

export const media = stylex.defineConsts({
  compact: '@media (max-width: 980px)',
  tablet: '@media (min-width: 721px) and (max-width: 1100px)',
  narrowTablet: '@media (min-width: 721px) and (max-width: 880px)',
  mobile: '@media (max-width: 720px)',
  reducedMotion: '@media (prefers-reduced-motion: reduce)',
})
