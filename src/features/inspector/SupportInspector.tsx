import * as stylex from '@stylexjs/stylex'
import { useAtom } from '@xstate/store-react'
import { Button } from 'react-aria-components'
import { hasIntegratedTable, isWallMounted, runsAlongZ } from '../../domain/plan/system'
import type { SupportRunMove } from '../../domain/supports/run'
import { editor, selectors, usePlan } from '../../editor/editor'
import { NumberField, StaticField } from '../../ui/fields'
import { text } from '../../ui/text'
import { colors } from '../../ui/tokens.stylex'
import { footerButton, InspectorPanel } from './InspectorPanel'

const styles = stylex.create({
  tracks: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
  },
  track: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    margin: 0,
    padding: '10px 0',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.divider,
    fontSize: 13,
  },
})

export function SupportInspector({
  supportIndex,
  belowFacePicker,
}: {
  supportIndex: number
  belowFacePicker: boolean
}) {
  const plan = usePlan()
  const tracks = useAtom(selectors.tracks).filter((track) => track.supportIndex === supportIndex)
  const { mountingType, placement, mountHeight } = plan.system
  const wallMounted = isWallMounted(mountingType)
  const alongZ = runsAlongZ(placement)
  const heightFixed = hasIntegratedTable(plan)

  const move = (patch: Partial<SupportRunMove>) =>
    editor.trigger.moveSupports({ move: { x: placement.x, z: placement.z, mountHeight, ...patch } })

  return (
    <InspectorPanel
      label="Selected support"
      eyebrow="Connected support run"
      title={`Support ${supportIndex + 1}`}
      subtitle="Moving this support keeps every bay centre fixed."
      belowFacePicker={belowFacePicker}
      footer={
        <Button
          onPress={() => editor.trigger.clearSelection()}
          {...stylex.props(footerButton.base)}
        >
          Done
        </Button>
      }
    >
      {(!wallMounted || !alongZ) && (
        <NumberField
          label="Run from left"
          value={placement.x}
          min={0}
          max={plan.room.width}
          onChange={(x) => move({ x })}
        />
      )}
      {(!wallMounted || alongZ) && (
        <NumberField
          label="Run from back"
          value={placement.z}
          min={0}
          max={plan.room.depth}
          onChange={(z) => move({ z })}
        />
      )}
      {mountingType === 'wall' && (
        <>
          <NumberField
            label="Track bottom"
            value={mountHeight}
            min={0}
            max={plan.room.ceilingHeight - 110}
            disabled={heightFixed}
            onChange={(height) => move({ mountHeight: height })}
          />
          {heightFixed && (
            <p {...stylex.props(text.hint)}>
              Table legs fix the installation height. Horizontal movement remains available.
            </p>
          )}
        </>
      )}
      {mountingType === 'semi-wall' && <StaticField label="Wall standoff" value="Hardware fixed" />}
      <div {...stylex.props(styles.tracks)}>
        {tracks.map((track) => (
          <p key={track.face} {...stylex.props(styles.track)}>
            <span>{track.face} E-track</span>
            <strong>
              {track.bottom}–{track.top} mm
            </strong>
          </p>
        ))}
      </div>
    </InspectorPanel>
  )
}
