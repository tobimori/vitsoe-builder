import * as stylex from '@stylexjs/stylex'
import type { Room } from '../../domain/plan/types'
import { editPlan, usePlan } from '../../editor/editor'
import { NumberField, Rows } from '../../ui/fields'
import { Section } from '../../ui/section'
import { text } from '../../ui/text'
import { PositionFields } from './PositionFields'
import { RoomPlan } from './RoomPlan'

export function RoomSection() {
  const { room } = usePlan()
  const resize = (patch: Partial<Room>) =>
    editPlan((plan) => ({ ...plan, room: { ...plan.room, ...patch } }))

  return (
    <Section title="Room">
      <Rows>
        <NumberField
          label="Width"
          value={room.width}
          min={1000}
          max={20000}
          onChange={(width) => resize({ width })}
        />
        <NumberField
          label="Depth"
          value={room.depth}
          min={1000}
          max={20000}
          onChange={(depth) => resize({ depth })}
        />
        <NumberField
          label="Ceiling height"
          value={room.ceilingHeight}
          min={1800}
          max={6000}
          onChange={(ceilingHeight) => resize({ ceilingHeight })}
        />
      </Rows>
      <p {...stylex.props(text.hint)}>Measure the ceiling height where the system will stand.</p>
    </Section>
  )
}

export function PositionSection() {
  return (
    <Section title="Position">
      <RoomPlan />
      <Rows>
        <PositionFields />
      </Rows>
      <p {...stylex.props(text.hint)}>
        Choose a wall in the plan, then drag the system along it. Distances are measured to the
        centres of the outer supports.
      </p>
    </Section>
  )
}
