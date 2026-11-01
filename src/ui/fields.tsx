import * as stylex from '@stylexjs/stylex'
import { useState, type ReactNode } from 'react'
import {
  Button,
  Group,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  NumberField as AriaNumberField,
  Popover,
  Select,
  SelectValue,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  type Key,
} from 'react-aria-components'
import { colors } from './tokens.stylex'

const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 46,
    marginTop: 10,
    fontSize: 15,
  },
  label: {
    minWidth: 0,
  },
  numberInput: {
    display: 'flex',
    flex: 'none',
    alignItems: 'center',
    height: 42,
    minWidth: 110,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  input: {
    width: 78,
    minWidth: 0,
    padding: '0 2px 0 10px',
    borderWidth: 0,
    outline: 'none',
    backgroundColor: 'transparent',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    color: {
      default: 'inherit',
      ':disabled': colors.muted,
    },
  },
  disabledInput: {
    backgroundColor: colors.neutral,
  },
  unit: {
    paddingRight: 9,
    color: colors.muted,
    fontSize: 11,
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    width: 145,
    height: 40,
    padding: '0 10px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.panel,
    textAlign: 'left',
    fontSize: 15,
    outlineColor: colors.blue,
  },
  wideTrigger: {
    width: '100%',
    height: 44,
    fontSize: 16,
  },
  value: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chevron: {
    flex: 'none',
    color: colors.muted,
    fontSize: 10,
  },
  popover: {
    minWidth: 'var(--trigger-width)',
    maxHeight: 320,
    overflowY: 'auto',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.panel,
    boxShadow: '0 7px 25px #00000014',
  },
  listBox: {
    outline: 'none',
    padding: '4px 0',
  },
  option: {
    padding: '8px 12px',
    fontSize: 14,
    cursor: 'default',
    outline: 'none',
  },
  focusedOption: {
    backgroundColor: colors.neutral,
  },
  selectedOption: {
    fontWeight: 600,
  },
  disabledOption: {
    color: '#aaa',
  },
  switchRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    fontSize: 15,
    cursor: 'pointer',
  },
  switchState: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: colors.muted,
    fontSize: 11,
  },
  track: {
    position: 'relative',
    flex: 'none',
    width: 35,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#c8c7c3',
    transition: 'background-color 0.15s',
  },
  trackOn: {
    backgroundColor: colors.strong,
  },
  trackFocus: {
    outline: `2px solid ${colors.blue}`,
    outlineOffset: 2,
  },
  thumb: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 15,
    height: 15,
    borderRadius: '50%',
    backgroundColor: colors.panel,
    transition: 'transform 0.15s',
  },
  thumbOn: {
    transform: 'translateX(16px)',
  },
  staticField: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
    fontSize: 14,
  },
  staticValue: {
    fontWeight: 500,
    textAlign: 'right',
  },
  segmented: {
    display: 'grid',
    gridAutoColumns: '1fr',
    gridAutoFlow: 'column',
    gap: 1,
    minWidth: 0,
    backgroundColor: colors.line,
  },
  segment: {
    padding: 8,
    borderWidth: 0,
    backgroundColor: colors.panel,
    color: colors.muted,
    fontSize: 13,
    outlineColor: colors.blue,
  },
  selectedSegment: {
    backgroundColor: colors.strong,
    color: '#fff',
  },
})

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  disabled = false,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  /** Committed values snap to multiples of this step from `min`. */
  step?: number
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
      <Group {...stylex.props(styles.numberInput, disabled && styles.disabledInput)}>
        <Input
          {...stylex.props(styles.input)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            restore()
          }}
        />
        <span {...stylex.props(styles.unit)}>mm</span>
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
  wide = false,
  onChange,
}: {
  label: string
  value: T
  options: readonly Option<T>[]
  /** Fills the row instead of sitting beside the label. */
  wide?: boolean
  onChange: (value: T) => void
}) {
  return (
    <Select<Option<T>>
      aria-label={wide ? label : undefined}
      value={value}
      disabledKeys={options.filter((option) => option.disabled).map((option) => option.value)}
      onChange={(next) => {
        const option = options.find((entry) => entry.value === next)
        if (option && option.value !== value) onChange(option.value)
      }}
      {...stylex.props(!wide && styles.row)}
    >
      {!wide && <Label {...stylex.props(styles.label)}>{label}</Label>}
      <Button {...stylex.props(styles.trigger, wide && styles.wideTrigger)}>
        <SelectValue {...stylex.props(styles.value)} />
        <span aria-hidden="true" {...stylex.props(styles.chevron)}>
          ▼
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
                  isFocused && styles.focusedOption,
                  isSelected && styles.selectedOption,
                  isDisabled && styles.disabledOption,
                ).className ?? ''
              }
            >
              {option.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  )
}

export function SwitchField({
  label,
  checked,
  style,
  children,
  onChange,
}: {
  label: string
  checked: boolean
  style?: stylex.StyleXStyles
  /** Shown before the switch, such as the current state. */
  children?: ReactNode
  onChange: (checked: boolean) => void
}) {
  return (
    <Switch isSelected={checked} onChange={onChange} {...stylex.props(styles.switchRow, style)}>
      {({ isSelected, isFocusVisible }) => (
        <>
          <span>{label}</span>
          <span {...stylex.props(styles.switchState)}>
            {children}
            <span
              {...stylex.props(
                styles.track,
                isSelected && styles.trackOn,
                isFocusVisible && styles.trackFocus,
              )}
            >
              <span {...stylex.props(styles.thumb, isSelected && styles.thumbOn)} />
            </span>
          </span>
        </>
      )}
    </Switch>
  )
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  style,
  onChange,
}: {
  label: string
  value: T
  options: readonly Option<T>[]
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
        const option = options.find((entry) => keys.has(entry.value))
        if (option && option.value !== value) onChange(option.value)
      }}
      {...stylex.props(styles.segmented, style)}
    >
      {options.map((option) => (
        <ToggleButton
          id={option.value}
          key={option.value}
          className={({ isSelected }) =>
            stylex.props(styles.segment, isSelected && styles.selectedSegment).className ?? ''
          }
        >
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}

export function StaticField({
  label,
  value,
  style,
}: {
  label: string
  value: ReactNode
  style?: stylex.StyleXStyles
}) {
  return (
    <div {...stylex.props(styles.staticField, style)}>
      <span>{label}</span>
      <strong {...stylex.props(styles.staticValue)}>{value}</strong>
    </div>
  )
}
