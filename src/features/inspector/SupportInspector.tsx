import * as stylex from '@stylexjs/stylex'
import { useAtom } from '@xstate/store-react'
import { hasIntegratedTable, isTwoSided } from '../../domain/plan/system'
import type { SupportRunMove } from '../../domain/supports/run'
import { editor, selectors, usePlan } from '../../editor/editor'
import { NumberField, Rows, StaticField } from '../../ui/fields'
import { Section } from '../../ui/section'
import { text } from '../../ui/text'
import { PositionFields } from '../room/PositionFields'
import { InspectorHeader } from './InspectorHeader'

export function SupportInspector({ supportIndex }: { supportIndex: number }) {
  const plan = usePlan()
  const tracks = useAtom(selectors.tracks).filter((track) => track.supportIndex === supportIndex)
  const { mountingType, placement, mountHeight } = plan.system
  const heightFixed = hasIntegratedTable(plan)

  const move = (patch: Partial<SupportRunMove>) =>
    editor.trigger.moveSupports({
      move: { offset: placement.offset, distance: placement.distance, mountHeight, ...patch },
    })

  return (
    <>
      <InspectorHeader
        title={`Support ${supportIndex + 1}`}
        subtitle="All supports move together, so the bays keep their widths."
      />
      <Section title="Position">
        <Rows>
          <PositionFields />
          {mountingType === 'wall' && (
            <NumberField
              label="Bottom above floor"
              value={mountHeight}
              min={0}
              max={plan.room.ceilingHeight - 110}
              disabled={heightFixed}
              onChange={(height) => move({ mountHeight: height })}
            />
          )}
        </Rows>
        <p {...stylex.props(text.hint)}>
          {mountingType === 'wall' && heightFixed
            ? 'The table legs set the height. You can still move the system along the wall.'
            : 'You can also drag the support in the view.'}
        </p>
      </Section>
      <Section title="E-tracks">
        <Rows>
          {tracks.map((track) => (
            <StaticField
              key={track.face}
              label={
                isTwoSided(mountingType) ? `${track.face === 'front' ? 'Front' : 'Back'}` : 'Height'
              }
              value={`${track.bottom}–${track.top} mm`}
            />
          ))}
        </Rows>
      </Section>
    </>
  )
}
