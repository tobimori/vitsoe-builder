import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import { colors, weights } from './tokens.stylex'

const styles = stylex.create({
  group: {
    display: 'grid',
    gap: '16px 12px',
  },
  columns: (columns: number) => ({
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
  }),
  tile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 0,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: colors.ink,
    fontSize: 13,
    lineHeight: '17px',
    textAlign: 'left',
    cursor: 'pointer',
    outline: 'none',
  },
  box: {
    display: 'grid',
    placeItems: 'center',
    aspectRatio: '1',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    color: colors.ink,
    // Outlines paint above the tile's image, borders and shadows would not
    outlineWidth: 1,
    outlineStyle: 'solid',
    outlineColor: colors.line,
    outlineOffset: -1,
    transitionProperty: 'background-color, outline-color',
    transitionDuration: '0.15s',
  },
  boxHover: {
    outlineColor: colors.faint,
  },
  boxSelected: {
    outlineWidth: 2,
    outlineColor: colors.ink,
    outlineOffset: -2,
  },
  boxFocus: {
    outlineWidth: 2,
    outlineColor: colors.blue,
    outlineOffset: 2,
  },
  labelSelected: {
    fontWeight: weights.bold,
  },
  disabled: {
    color: colors.faint,
    cursor: 'default',
    opacity: 0.6,
  },
})

export interface TileOption<T extends string> {
  value: T
  label: string
  visual: ReactNode
  disabled?: boolean
}

export function TileGroup<T extends string>({
  label,
  value,
  options,
  columns = 4,
  allowEmpty = false,
  style,
  onChange,
}: {
  label: string
  value: T | null
  options: readonly TileOption<T>[]
  columns?: number
  /** Selecting the current tile again clears the selection. */
  allowEmpty?: boolean
  style?: stylex.StyleXStyles
  onChange: (value: T | null) => void
}) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection={!allowEmpty}
      selectedKeys={value === null ? [] : [value]}
      onSelectionChange={(keys) =>
        onChange(options.find((option) => keys.has(option.value))?.value ?? null)
      }
      {...stylex.props(styles.group, styles.columns(columns), style)}
    >
      {options.map((option) => (
        <ToggleButton
          id={option.value}
          key={option.value}
          isDisabled={option.disabled}
          className={({ isDisabled }) =>
            stylex.props(styles.tile, isDisabled && styles.disabled).className ?? ''
          }
        >
          {({ isSelected, isHovered, isFocusVisible }) => (
            <>
              <span
                {...stylex.props(
                  styles.box,
                  isHovered && styles.boxHover,
                  isSelected && styles.boxSelected,
                  isFocusVisible && styles.boxFocus,
                )}
              >
                {option.visual}
              </span>
              <span {...stylex.props(isSelected && styles.labelSelected)}>{option.label}</span>
            </>
          )}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
