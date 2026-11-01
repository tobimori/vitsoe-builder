import * as stylex from '@stylexjs/stylex'
import { setStructureOptions } from '../../domain/plan/system'
import type { StructureOptions } from '../../domain/plan/types'
import { editPlan, usePlan } from '../../editor/editor'
import { CheckboxField, Rows, SelectField } from '../../ui/fields'
import { Section } from '../../ui/section'
import { text } from '../../ui/text'

const brackets = [
  { value: 'short', label: '60–70 mm' },
  { value: 'long', label: '100–110 mm' },
] as const

export function StructureSection() {
  const plan = usePlan()
  const { mountingType, structureOptions: options } = plan.system
  if (mountingType === 'wall') return null

  const set = (patch: Partial<StructureOptions>) =>
    editPlan((plan) => setStructureOptions(plan, patch))

  return (
    <Section title="Structure">
      <Rows>
        {mountingType === 'semi-wall' && (
          <>
            <SelectField
              label="Wall brackets"
              value={options.wallBracket}
              options={brackets}
              onChange={(wallBracket) => set({ wallBracket })}
            />
            <CheckboxField
              row
              label="65 mm extensions"
              checked={options.extensionBolts}
              onChange={(extensionBolts) => set({ extensionBolts })}
            />
          </>
        )}
        <CheckboxField
          row
          label="Cable channels"
          checked={options.cableChannels}
          onChange={(cableChannels) => set({ cableChannels })}
        />
        {(mountingType === 'semi-wall' || mountingType === 'floor-to-ceiling') && (
          <CheckboxField
            row
            label="Stabilising feet"
            checked={options.stabilisingFeet}
            onChange={(stabilisingFeet) => set({ stabilisingFeet })}
          />
        )}
      </Rows>
      {mountingType === 'semi-wall' && (
        <p {...stylex.props(text.hint)}>
          Set the distance from the back wall to the bracket reach
          {options.extensionBolts ? ' plus 65 mm' : ''}.
        </p>
      )}
    </Section>
  )
}
