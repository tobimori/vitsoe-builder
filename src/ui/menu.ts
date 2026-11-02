import * as stylex from '@stylexjs/stylex'
import { colors, media } from './tokens.stylex'

/** A plain list of actions in a hairline box, as used by every menu. */
export const menu = stylex.create({
  popover: {
    minWidth: 180,
    padding: '4px 0',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.surface,
    outline: 'none',
  },
  list: {
    outline: 'none',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    height: {
      default: 36,
      [media.touch]: 44,
    },
    padding: '0 12px',
    fontSize: 14,
    cursor: 'default',
    outline: 'none',
  },
  itemFocused: {
    backgroundColor: colors.band,
  },
  danger: {
    color: colors.red,
  },
  separator: {
    height: 1,
    margin: '4px 0',
    backgroundColor: colors.line,
  },
  shortcut: {
    color: colors.muted,
    fontFamily: 'inherit',
    fontSize: 13,
  },
})
