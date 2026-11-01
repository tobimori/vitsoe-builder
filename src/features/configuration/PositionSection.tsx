import { isWallMounted, runsAlongZ, setPlacement } from '../../domain/plan/system'
import type { Rotation } from '../../domain/plan/types'
import { editor, usePlan } from '../../editor/editor'
import { NumberField, SelectField, StaticField } from '../../ui/fields'
import { Section } from './Section'

const rotations = ([0, 90, 180, 270] as const).map((angle) => ({
  value: angle,
  label: `${angle}°`,
}))

export function PositionSection() {
  const plan = usePlan()
  const { mountingType, placement } = plan.system
  const wallMounted = isWallMounted(mountingType)
  const alongZ = runsAlongZ(placement)

  const place = (patch: { x?: number; z?: number; rotation?: Rotation }) =>
    editor.trigger.edit({ plan: setPlacement(plan, patch) })

  return (
    <Section title="Position in room">
      {(!wallMounted || !alongZ) && (
        <NumberField
          label="Run from left"
          value={placement.x}
          min={0}
          max={plan.room.width}
          onChange={(x) => place({ x })}
        />
      )}
      {(!wallMounted || alongZ) && (
        <NumberField
          label="Run from back"
          value={placement.z}
          min={0}
          max={plan.room.depth}
          onChange={(z) => place({ z })}
        />
      )}
      {mountingType === 'semi-wall' && (
        <StaticField label="Wall standoff" value="Set by hardware" />
      )}
      <SelectField
        label="Rotation"
        value={placement.rotation}
        options={rotations}
        onChange={(rotation) => place({ rotation })}
      />
    </Section>
  )
}
