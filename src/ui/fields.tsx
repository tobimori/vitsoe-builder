import * as stylex from '@stylexjs/stylex'
import { useState, type ReactNode } from 'react'
import {
  Button,
  Checkbox,
  Group,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  NumberField as AriaNumberField,
  Popover,
  Select,
  SelectValue,
  ToggleButton,
  ToggleButtonGroup,
  type Key,
} from 'react-aria-components'
import { Icon } from './icons'
import { colors, media, weights } from './tokens.stylex'

const styles = stylex.create({
  rows: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    minHeight: 40,
    fontSize: 14,
    lineHeight: '20px',
  },
  label: {
    minWidth: 0,
  },
  box: {
    display: 'flex',
    flex: 'none',
    alignItems: 'stretch',
    height: {
      default: 32,
      [media.touch]: 40,
    },
    backgroundColor: {
      default: colors.band,
      ':hover': colors.bandHover,
    },
    transitionProperty: 'background-color',
    transitionDuration: '0.12s',
  },
  boxFocus: {
    backgroundColor: {
      default: colors.surface,
      ':hover': colors.surface,
    },
    boxShadow: `inset 0 0 0 1px ${colors.ink}`,
  },
  boxDisabled: {
    backgroundColor: {
      default: colors.band,
      ':hover': colors.band,
    },
    color: colors.faint,
  },
  input: {
    width: 64,
    minWidth: 0,
    padding: '0 4px 0 10px',
    borderWidth: 0,
    outline: 'none',
    backgroundColor: 'transparent',
    color: 'inherit',
    fontSize: {
      default: 14,
      [media.touch]: 16,
    },
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  inputUnitless: {
    width: 44,
    padding: 0,
    textAlign: 'center',
  },
  unit: {
    alignSelf: 'center',
    paddingRight: 10,
    color: colors.muted,
    fontSize: 13,
  },
  step: {
    display: 'grid',
    placeItems: 'center',
    width: {
      default: 30,
      [media.touch]: 40,
    },
    padding: 0,
    borderWidth: 0,
    backgroundColor: {
      default: 'transparent',
      ':hover': 'rgb(0 0 0 / 0.06)',
    },
    color: {
      default: colors.ink,
      ':disabled': colors.faint,
    },
    outline: 'none',
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    width: 184,
    color: colors.ink,
    minWidth: 0,
    flexShrink: 1,
    height: {
      default: 32,
      [media.touch]: 40,
    },
    padding: '0 10px 0 12px',
    borderWidth: 0,
    backgroundColor: {
      default: colors.band,
      ':hover': colors.bandHover,
    },
    fontSize: 14,
    textAlign: 'left',
    outline: 'none',
    transitionProperty: 'background-color',
    transitionDuration: '0.12s',
  },
  triggerOpen: {
    backgroundColor: {
      default: colors.surface,
      ':hover': colors.surface,
    },
    boxShadow: `inset 0 0 0 1px ${colors.ink}`,
  },
  chevron: {
    display: 'flex',
    color: colors.muted,
    transitionProperty: 'transform',
    transitionDuration: '0.15s',
  },
  chevronOpen: {
    transform: 'rotate(180deg)',
  },
  value: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  focusRing: {
    outline: `2px solid ${colors.blue}`,
    outlineOffset: 2,
  },
  popover: {
    minWidth: 'var(--trigger-width)',
    maxHeight: 320,
    overflowY: 'auto',
    padding: 4,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.surface,
    outline: 'none',
  },
  listBox: {
    outline: 'none',
  },
  option: {
    display: 'grid',
    gridTemplateColumns: '16px minmax(0, 1fr)',
    alignItems: 'center',
    gap: 8,
    minHeight: {
      default: 34,
      [media.touch]: 44,
    },
    padding: '0 12px 0 8px',
    fontSize: 14,
    whiteSpace: 'nowrap',
    cursor: 'default',
    outline: 'none',
  },
  optionFocused: {
    backgroundColor: colors.band,
  },
  optionSelected: {
    fontWeight: weights.bold,
  },
  check: {
    display: 'flex',
    color: colors.blue,
  },
  optionDisabled: {
    color: colors.faint,
  },
  checkbox: {
    // Contains React Aria's hidden input; otherwise focusing it scrolls the whole page
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: {
      default: 32,
      [media.touch]: 44,
    },
    fontSize: 14,
    cursor: 'pointer',
  },
  checkboxRow: {
    justifyContent: 'space-between',
    minHeight: 40,
  },
  square: {
    display: 'grid',
    flex: 'none',
    placeItems: 'center',
    width: 18,
    height: 18,
    boxShadow: `inset 0 0 0 1.5px ${colors.faint}`,
    backgroundColor: colors.surface,
    color: '#fff',
    transitionProperty: 'background-color, box-shadow',
    transitionDuration: '0.12s',
  },
  squareChecked: {
    boxShadow: 'none',
    backgroundColor: colors.ink,
  },
  /** A grey track; the chosen option is a white segment on it. */
  segmented: {
    display: 'inline-grid',
    flex: 'none',
    gridAutoColumns: 'minmax(min-content, 1fr)',
    gridAutoFlow: 'column',
    gap: 2,
    padding: 2,
    backgroundColor: colors.band,
  },
  segment: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    height: {
      default: 28,
      [media.touch]: 36,
    },
    padding: '0 10px',
    borderWidth: 0,
    backgroundColor: {
      default: 'transparent',
      ':hover': colors.bandHover,
    },
    color: {
      default: colors.muted,
      ':hover': colors.ink,
    },
    fontSize: 13,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    outline: 'none',
    transitionProperty: 'background-color, color, box-shadow',
    transitionDuration: '0.12s',
    // Reserves the bold width, so choosing an option does not shift the others
    '::after': {
      content: 'attr(data-label)',
      height: 0,
      overflow: 'hidden',
      visibility: 'hidden',
      fontWeight: weights.bold,
    },
  },
  segmentSelected: {
    backgroundColor: {
      default: colors.surface,
      ':hover': colors.surface,
    },
    color: {
      default: colors.ink,
      ':hover': colors.ink,
    },
    fontWeight: weights.bold,
    boxShadow: `0 0 0 1px ${colors.line}`,
  },
  segmentDisabled: {
    backgroundColor: {
      default: 'transparent',
      ':hover': 'transparent',
    },
    color: {
      default: colors.faint,
      ':hover': colors.faint,
    },
    cursor: 'default',
  },
  staticValue: {
    color: colors.muted,
    textAlign: 'right',
  },
})

export function Rows({ children, style }: { children: ReactNode; style?: stylex.StyleXStyles }) {
  return <div {...stylex.props(styles.rows, style)}>{children}</div>
}

/** A labelled row whose control sits on the right. */
export function FieldRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div {...stylex.props(styles.row)}>
      <span {...stylex.props(styles.label)}>{label}</span>
      {children}
    </div>
  )
}

export function StaticField({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <FieldRow label={label}>
      <span {...stylex.props(styles.staticValue)}>{value}</span>
    </FieldRow>
  )
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  unit = 'mm',
  stepper = false,
  disabled = false,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  /** Committed values snap to multiples of this step from `min`. */
  step?: number
  unit?: string
  /** Shows buttons that change the value by one step. */
  stepper?: boolean
  disabled?: boolean
  onChange: (value: number) => void
}) {
  // Remounting discards the draft text, so Escape and empty input restore the value
  const [revision, setRevision] = useState(0)
  const restore = () => setRevision((current) => current + 1)

  return (
    <AriaNumberField
      key={revision}
      value={value}
      minValue={min}
      maxValue={max}
      step={step}
      isDisabled={disabled}
      formatOptions={{ useGrouping: false, maximumFractionDigits: 0 }}
      onChange={(next) => {
        if (!Number.isFinite(next)) restore()
        else if (next !== value) onChange(next)
      }}
      {...stylex.props(styles.row)}
    >
      <Label {...stylex.props(styles.label)}>{label}</Label>
      <Group
        className={({ isFocusWithin, isDisabled }) =>
          stylex.props(
            styles.box,
            isFocusWithin && styles.boxFocus,
            isDisabled && styles.boxDisabled,
          ).className ?? ''
        }
      >
        {stepper && (
          <Button slot="decrement" {...stylex.props(styles.step)}>
            <Icon name="minus" size={12} />
          </Button>
        )}
        <Input
          {...stylex.props(styles.input, !unit && styles.inputUnitless)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            restore()
          }}
        />
        {unit && <span {...stylex.props(styles.unit)}>{unit}</span>}
        {stepper && (
          <Button slot="increment" {...stylex.props(styles.step)}>
            <Icon name="plus" size={12} />
          </Button>
        )}
      </Group>
    </AriaNumberField>
  )
}

export interface Option<T extends Key> {
  value: T
  label: string
  disabled?: boolean
}

export function SelectField<T extends Key>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
}) {
  return (
    <Select<Option<T>>
      value={value}
      disabledKeys={options.filter((option) => option.disabled).map((option) => option.value)}
      onChange={(next) => {
        const option = options.find((entry) => entry.value === next)
        if (option && option.value !== value) onChange(option.value)
      }}
      {...stylex.props(styles.row)}
    >
      {({ isOpen }) => (
        <>
          <Label {...stylex.props(styles.label)}>{label}</Label>
          <Button
            className={({ isFocusVisible }) =>
              stylex.props(
                styles.trigger,
                isOpen && styles.triggerOpen,
                isFocusVisible && styles.focusRing,
              ).className ?? ''
            }
          >
            <SelectValue {...stylex.props(styles.value)} />
            <span {...stylex.props(styles.chevron, isOpen && styles.chevronOpen)}>
              <Icon name="chevronDown" size={14} />
            </span>
          </Button>
          <Popover placement="bottom end" offset={4} {...stylex.props(styles.popover)}>
            <ListBox items={options} {...stylex.props(styles.listBox)}>
              {(option) => (
                <ListBoxItem
                  id={option.value}
                  textValue={option.label}
                  className={({ isFocused, isSelected, isDisabled }) =>
                    stylex.props(
                      styles.option,
                      isFocused && styles.optionFocused,
                      isSelected && styles.optionSelected,
                      isDisabled && styles.optionDisabled,
                    ).className ?? ''
                  }
                >
                  {({ isSelected }) => (
                    <>
                      <span {...stylex.props(styles.check)}>
                        {isSelected && <Icon name="check" size={14} />}
                      </span>
                      {option.label}
                    </>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </>
      )}
    </Select>
  )
}

export function CheckboxField({
  label,
  checked,
  row = false,
  onChange,
}: {
  label: ReactNode
  checked: boolean
  /** Places the box on the right of the row, like the other fields. */
  row?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Checkbox
      isSelected={checked}
      onChange={onChange}
      className={stylex.props(styles.checkbox, row && styles.checkboxRow).className ?? ''}
    >
      {({ isSelected, isFocusVisible }) => (
        <>
          {row && <span>{label}</span>}
          <span
            {...stylex.props(
              styles.square,
              isSelected && styles.squareChecked,
              isFocusVisible && styles.focusRing,
            )}
          >
            {isSelected && <Icon name="check" size={12} />}
          </span>
          {!row && <span>{label}</span>}
        </>
      )}
    </Checkbox>
  )
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  style,
  onChange,
}: {
  label: string
  value: T | null
  options: readonly Option<T>[]
  style?: stylex.StyleXStyles
  onChange: (value: T) => void
}) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={value === null ? [] : [value]}
      onSelectionChange={(keys) => {
        const option = options.find((entry) => keys.has(entry.value))
        if (option && option.value !== value) onChange(option.value)
      }}
      {...stylex.props(styles.segmented, style)}
    >
      {options.map((option) => (
        <ToggleButton
          id={option.value}
          key={option.value}
          data-label={option.label}
          isDisabled={option.disabled}
          className={({ isSelected, isFocusVisible, isDisabled }) =>
            stylex.props(
              styles.segment,
              isSelected && styles.segmentSelected,
              isDisabled && styles.segmentDisabled,
              isFocusVisible && styles.focusRing,
            ).className ?? ''
          }
        >
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
