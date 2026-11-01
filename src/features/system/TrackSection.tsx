import * as stylex from '@stylexjs/stylex'
import { useAtom } from '@xstate/store-react'
import { Button } from 'react-aria-components'
import { hasIntegratedTable, isTwoSided, setMountHeight } from '../../domain/plan/system'
import { editor, editPlan, selectors, usePlan } from '../../editor/editor'
import { NumberField, Rows, Segmented } from '../../ui/fields'
import { Section } from '../../ui/section'
import { text } from '../../ui/text'
import { colors } from '../../ui/tokens.stylex'

const modes = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'manual', label: 'Manual' },
] as const

const styles = stylex.create({
  modes: {
    display: 'grid',
    marginBottom: 12,
  },
  list: {
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
  },
  track: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    width: '100%',
    minHeight: 40,
    padding: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    backgroundColor: 'transparent',
    color: {
      default: colors.ink,
      ':hover': colors.blue,
    },
    fontSize: 14,
    textAlign: 'left',
    cursor: 'pointer',
    outline: 'none',
  },
  focused: {
    outline: `2px solid ${colors.blue}`,
    outlineOffset: -2,
  },
  lengths: {
    fontVariantNumeric: 'tabular-nums',
  },
})

export function TrackSection() {
  const plan = usePlan()
  const tracks = useAtom(selectors.tracks)
  const { trackMode, railHeight, mountHeight, mountingType } = plan.system
  const tableFixed = hasIntegratedTable(plan)
  const twoSided = isTwoSided(mountingType)

  return (
    <Section title="E-tracks">
      <Segmented
        label="E-track sizing"
        value={trackMode}
        options={modes}
        style={styles.modes}
        onChange={(mode) =>
          editPlan((plan) => ({ ...plan, system: { ...plan.system, trackMode: mode } }))
        }
      />
      {trackMode === 'manual' ? (
        <Rows>
          <NumberField
            label="Length"
            value={railHeight}
            min={110}
            max={plan.room.ceilingHeight}
            onChange={(length) =>
              editPlan((plan) => ({ ...plan, system: { ...plan.system, railHeight: length } }))
            }
          />
          <NumberField
            label="Bottom above floor"
            value={mountHeight}
            min={0}
            max={plan.room.ceilingHeight - 110}
            disabled={tableFixed}
            onChange={(height) => editPlan((plan) => setMountHeight(plan, height))}
          />
        </Rows>
      ) : (
        <div {...stylex.props(styles.list)}>
          {tracks.map((track) => (
            <Button
              key={`${track.supportIndex}-${track.face}`}
              onPress={() => editor.trigger.selectSupport({ index: track.supportIndex })}
              className={({ isFocusVisible }) =>
                stylex.props(styles.track, isFocusVisible && styles.focused).className ?? ''
              }
            >
              <span>
                Support {track.supportIndex + 1}
                {twoSided && `, ${track.face}`}
              </span>
              <span {...stylex.props(styles.lengths)}>
                {track.segments
                  .map((segment) => `${segment.installedLength}${segment.cut ? '*' : ''}`)
                  .join(' + ')}{' '}
                mm
              </span>
            </Button>
          ))}
        </div>
      )}
      <p {...stylex.props(text.hint)}>
        {trackMode === 'automatic'
          ? 'Lengths follow the components. * Cut to fit. A Vitsœ planner confirms joins.'
          : tableFixed
            ? 'The table legs set the height of the E-tracks.'
            : 'Components must fit within the E-tracks.'}
      </p>
    </Section>
  )
}
