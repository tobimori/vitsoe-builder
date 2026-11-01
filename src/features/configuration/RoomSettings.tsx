import * as stylex from '@stylexjs/stylex'
import type { Room } from '../../domain/plan/types'
import { editor, useEditor, usePlan } from '../../editor/editor'
import { NumberField, SwitchField } from '../../ui/fields'
import { text } from '../../ui/text'
import { Section } from './Section'

export function RoomSettings() {
  const plan = usePlan()
  const showDimensions = useEditor((context) => context.showDimensions)

  const resize = (patch: Partial<Room>) =>
    editor.trigger.edit({ plan: { ...plan, room: { ...plan.room, ...patch } } })

  return (
    <>
      <Section title="Room dimensions">
        <p {...stylex.props(text.hint)}>A simple rectangular room.</p>
        <NumberField
          label="Width"
          value={plan.room.width}
          min={1000}
          max={20000}
          onChange={(width) => resize({ width })}
        />
        <NumberField
          label="Depth"
          value={plan.room.depth}
          min={1000}
          max={20000}
          onChange={(depth) => resize({ depth })}
        />
        <NumberField
          label="Ceiling"
          value={plan.room.ceilingHeight}
          min={1800}
          max={6000}
          onChange={(ceilingHeight) => resize({ ceilingHeight })}
        />
      </Section>
      <Section>
        <SwitchField
          label="Show dimensions"
          checked={showDimensions}
          onChange={() => editor.trigger.toggleDimensions()}
        />
      </Section>
    </>
  )
}
