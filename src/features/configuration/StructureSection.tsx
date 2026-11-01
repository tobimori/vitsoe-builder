import * as stylex from '@stylexjs/stylex'
import { setStructureOptions } from '../../domain/plan/system'
import type { StructureOptions } from '../../domain/plan/types'
import { editor, usePlan } from '../../editor/editor'
import { SelectField, SwitchField } from '../../ui/fields'
import { text } from '../../ui/text'
import { Section } from './Section'

const brackets = [
  { value: 'short', label: '60–70 mm' },
  { value: 'long', label: '100–110 mm' },
] as const

export function StructureSection() {
  const plan = usePlan()
  const { mountingType, structureOptions: options } = plan.system
  if (mountingType === 'wall') return null

  const set = (patch: Partial<StructureOptions>) =>
    editor.trigger.edit({ plan: setStructureOptions(plan, patch) })

  return (
    <Section title="Structural options">
      {mountingType === 'semi-wall' && (
        <>
          <SelectField
            label="Wall bracket"
            value={options.wallBracket}
            options={brackets}
            onChange={(wallBracket) => set({ wallBracket })}
          />
          <p {...stylex.props(text.hint)}>
            Match “From back wall” to the selected bracket reach
            {options.extensionBolts ? ' plus 65 mm' : ''}.
          </p>
          <SwitchField
            label="65 mm extensions"
            checked={options.extensionBolts}
            onChange={(extensionBolts) => set({ extensionBolts })}
          />
        </>
      )}
      <SwitchField
        label="Cable channels"
        checked={options.cableChannels}
        onChange={(cableChannels) => set({ cableChannels })}
      />
      {(mountingType === 'semi-wall' || mountingType === 'floor-to-ceiling') && (
        <SwitchField
          label="Stabilising feet"
          checked={options.stabilisingFeet}
          onChange={(stabilisingFeet) => set({ stabilisingFeet })}
        />
      )}
    </Section>
  )
}
