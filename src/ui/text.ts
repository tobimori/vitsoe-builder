import * as stylex from '@stylexjs/stylex'
import { colors } from './tokens.stylex'

export const text = stylex.create({
  eyebrow: {
    margin: '0 0 5px',
    color: '#676662',
    fontSize: 10,
    lineHeight: 1.2,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  heading: {
    margin: 0,
    fontSize: 21,
    fontWeight: 500,
    letterSpacing: '-0.015em',
  },
  display: {
    margin: 0,
    fontSize: 32,
    fontWeight: 400,
    letterSpacing: '-0.015em',
  },
  hint: {
    margin: '8px 0 0',
    color: colors.muted,
    fontSize: 14,
    lineHeight: 1.45,
  },
  error: {
    margin: '10px 0 0',
    color: colors.red,
    fontSize: 12,
    lineHeight: 1.4,
  },
})
