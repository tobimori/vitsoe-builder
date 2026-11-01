import * as stylex from '@stylexjs/stylex'
import { colors, weights } from './tokens.stylex'

export const text = stylex.create({
  display: {
    margin: 0,
    fontSize: 22,
    lineHeight: '28px',
    fontWeight: weights.bold,
    letterSpacing: '-0.01em',
  },
  /** The light second line under a bold title, as on Vitsœ's pages. */
  subtitle: {
    margin: 0,
    fontSize: 22,
    lineHeight: '28px',
    fontWeight: weights.light,
    letterSpacing: '-0.01em',
  },
  title: {
    margin: 0,
    fontSize: 17,
    lineHeight: '24px',
    fontWeight: weights.bold,
  },
  heading: {
    margin: 0,
    fontSize: 15,
    lineHeight: '20px',
    fontWeight: weights.bold,
  },
  body: {
    margin: 0,
    fontSize: 14,
    lineHeight: '21px',
  },
  hint: {
    margin: '12px 0 0',
    color: colors.muted,
    fontSize: 13,
    lineHeight: '19px',
  },
  small: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: '18px',
  },
  error: {
    margin: '12px 0 0',
    color: colors.red,
    fontSize: 13,
    lineHeight: '19px',
  },
  numeric: {
    fontVariantNumeric: 'tabular-nums',
  },
})
