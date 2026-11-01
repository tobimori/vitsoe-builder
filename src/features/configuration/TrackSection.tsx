import * as stylex from '@stylexjs/stylex'
import { useAtom } from '@xstate/store-react'
import { Button } from 'react-aria-components'
import { hasIntegratedTable, setMountHeight } from '../../domain/plan/system'
import { editor, selectors, useEditor, usePlan } from '../../editor/editor'
import { NumberField, SegmentedControl } from '../../ui/fields'
import { text } from '../../ui/text'
import { colors } from '../../ui/tokens.stylex'
import { Section } from './Section'

const modes = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'manual', label: 'Manual' },
] as const

const styles = stylex.create({
  modes: {
    marginTop: 14,
  },
  summary: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.rule,
  },
  track: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 12,
    width: '100%',
    padding: '11px 6px',
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.rule,
    backgroundColor: {
      default: 'transparent',
      ':hover': colors.neutral,
    },
    textAlign: 'left',
    fontSize: 13,
  },
  selected: {
    backgroundColor: colors.neutral,
  },
  lengths: {
    fontWeight: 500,
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  footnote: {
    display: 'block',
    marginTop: 8,
    color: colors.muted,
    fontSize: 11,
  },
})

export function TrackSection() {
  const plan = usePlan()
  const tracks = useAtom(selectors.tracks)
  const selection = useEditor((context) => context.selection)
  const { trackMode, railHeight, mountHeight } = plan.system
  const tableFixed = hasIntegratedTable(plan)

  return (
    <Section title="E-tracks" aside={trackMode === 'manual' ? 'Manual' : 'Automatic'}>
      <SegmentedControl
        label="E-track sizing"
        value={trackMode}
        options={modes}
        style={styles.modes}
        onChange={(mode) =>
          editor.trigger.edit({ plan: { ...plan, system: { ...plan.system, trackMode: mode } } })
        }
      />
      {trackMode === 'manual' ? (
        <>
          <NumberField
            label="Installed length"
            value={railHeight}
            min={110}
            max={plan.room.ceilingHeight}
            onChange={(length) =>
              editor.trigger.edit({
                plan: { ...plan, system: { ...plan.system, railHeight: length } },
              })
            }
          />
          <NumberField
            label="Track bottom"
            value={mountHeight}
            min={0}
            max={plan.room.ceilingHeight - 110}
            disabled={tableFixed}
            onChange={(height) => editor.trigger.edit({ plan: setMountHeight(plan, height) })}
          />
          {tableFixed && (
            <p {...stylex.props(text.hint)}>Table legs fix the installation height.</p>
          )}
        </>
      ) : (
        <div {...stylex.props(styles.summary)}>
          {tracks.map((track) => (
            <Button
              key={`${track.supportIndex}-${track.face}`}
              onPress={() => editor.trigger.selectSupport({ index: track.supportIndex })}
              {...stylex.props(
                styles.track,
                selection?.type === 'support' &&
                  selection.index === track.supportIndex &&
                  styles.selected,
              )}
            >
              <span>
                Support {track.supportIndex + 1} · {track.face}
              </span>
              <strong {...stylex.props(styles.lengths)}>
                {track.segments
                  .map((segment) => `${segment.installedLength}${segment.cut ? '*' : ''}`)
                  .join(' + ')}{' '}
                mm
              </strong>
            </Button>
          ))}
          <small {...stylex.props(styles.footnote)}>
            * cut to fit. Joins require planner confirmation.
          </small>
        </div>
      )}
    </Section>
  )
}
