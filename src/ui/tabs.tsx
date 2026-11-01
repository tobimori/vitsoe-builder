import * as stylex from '@stylexjs/stylex'
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import { colors, media, weights } from './tokens.stylex'

const styles = stylex.create({
  tabs: {
    display: 'flex',
    gap: {
      default: 24,
      [media.stacked]: 20,
    },
    minWidth: 0,
    boxShadow: `inset 0 -1px 0 ${colors.line}`,
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  tab: {
    display: 'inline-flex',
    flex: 'none',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: {
      default: colors.muted,
      ':hover': colors.ink,
    },
    fontSize: 14,
    transitionProperty: 'color, box-shadow',
    transitionDuration: '0.15s',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    outline: 'none',
    // Reserves the bold width, so choosing a tab does not shift the others
    '::after': {
      content: 'attr(data-label)',
      height: 0,
      overflow: 'hidden',
      visibility: 'hidden',
      fontWeight: weights.bold,
    },
  },
  selected: {
    color: {
      default: colors.ink,
      ':hover': colors.ink,
    },
    fontWeight: weights.bold,
    boxShadow: `inset 0 -2px 0 ${colors.ink}`,
  },
  focused: {
    outline: `2px solid ${colors.blue}`,
    outlineOffset: -2,
  },
})

/** Text tabs on a hairline; the current one is set in bold and underlined. */
export function Tabs<T extends string>({
  label,
  value,
  tabs,
  style,
  onChange,
}: {
  label: string
  value: T
  tabs: readonly { value: T; label: string }[]
  style?: stylex.StyleXStyles
  onChange: (value: T) => void
}) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const tab = tabs.find((entry) => keys.has(entry.value))
        if (tab) onChange(tab.value)
      }}
      {...stylex.props(styles.tabs, style)}
    >
      {tabs.map((tab) => (
        <ToggleButton
          key={tab.value}
          id={tab.value}
          data-label={tab.label}
          className={({ isSelected, isFocusVisible }) =>
            stylex.props(
              styles.tab,
              isSelected && styles.selected,
              isFocusVisible && styles.focused,
            ).className ?? ''
          }
        >
          {tab.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
