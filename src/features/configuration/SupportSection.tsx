import * as stylex from '@stylexjs/stylex'
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import { editor, usePlan } from '../../editor/editor'
import type { MountingType } from '../../domain/types'
import { text } from '../../ui/text'
import { colors } from '../../ui/tokens.stylex'
import { Section } from './Section'

const supports: { value: MountingType; label: string }[] = [
  { value: 'wall', label: 'Wall-mounted' },
  { value: 'semi-wall', label: 'Semi wall-mounted' },
  { value: 'floor-to-ceiling', label: 'Floor-to-ceiling' },
  { value: 'freestanding', label: 'Freestanding' },
]

const styles = stylex.create({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
    marginTop: 20,
  },
  option: {
    display: 'grid',
    gridTemplateRows: '48px minmax(36px, auto)',
    alignItems: 'center',
    justifyItems: 'center',
    minWidth: 0,
    minHeight: 104,
    padding: '10px 8px',
    borderWidth: 0,
    backgroundColor: colors.neutral,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 1.2,
    textAlign: 'center',
    overflowWrap: 'anywhere',
    outline: 'none',
  },
  selected: {
    backgroundColor: '#dededb',
    color: '#111',
    boxShadow: `inset 0 -3px ${colors.blue}`,
  },
  focused: {
    outline: `2px solid ${colors.blue}`,
    outlineOffset: 2,
  },
  icon: {
    alignSelf: 'end',
  },
})

/** Posts with two shelves, drawn after Vitsœ's support type pictograms. */
function SupportIcon({ type }: { type: MountingType }) {
  const height = type === 'floor-to-ceiling' ? 40 : 34

  return (
    <svg
      aria-hidden="true"
      width="44"
      height={height + 2}
      viewBox={`0 0 44 ${height + 2}`}
      fill="currentColor"
      {...stylex.props(styles.icon)}
    >
      <rect x="9" width="2" height={height} />
      <rect x="33" width="2" height={height} />
      {type === 'floor-to-ceiling' ? (
        <>
          <rect x="12" y="0" width="20" height="1" />
          <rect x="12" y={height - 1} width="20" height="1" />
        </>
      ) : (
        <rect x="12" y="10" width="20" height="1" />
      )}
      {type === 'wall' && <rect x="12" y="23" width="20" height="1" />}
      {type === 'semi-wall' && <rect x="6" y={height + 1} width="32" height="1" />}
      {type === 'freestanding' && <rect x="2" y={height - 2} width="40" height="2" />}
    </svg>
  )
}

export function SupportSection() {
  const { mountingType } = usePlan().system

  return (
    <Section title="Support">
      <ToggleButtonGroup
        aria-label="Support"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[mountingType]}
        onSelectionChange={(keys) => {
          const support = supports.find((entry) => keys.has(entry.value))
          if (support) editor.trigger.changeMountingType({ mountingType: support.value })
        }}
        {...stylex.props(styles.grid)}
      >
        {supports.map((support) => (
          <ToggleButton
            id={support.value}
            key={support.value}
            className={({ isSelected, isFocusVisible }) =>
              stylex.props(
                styles.option,
                isSelected && styles.selected,
                isFocusVisible && styles.focused,
              ).className ?? ''
            }
          >
            <SupportIcon type={support.value} />
            <span>{support.label}</span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <p {...stylex.props(text.hint)}>
        {supports.find((support) => support.value === mountingType)?.label}
      </p>
    </Section>
  )
}
