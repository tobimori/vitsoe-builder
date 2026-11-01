import * as stylex from '@stylexjs/stylex'
import { resetItemFinishes, setSystemFinish } from '../../domain/plan/system'
import type { Colour } from '../../domain/types'
import { editPlan, usePlan } from '../../editor/editor'
import { ActionButton } from '../../ui/buttons'
import { CheckboxField } from '../../ui/fields'
import { plural } from '../../ui/format'
import { Section } from '../../ui/section'
import { text } from '../../ui/text'
import { TileGroup } from '../../ui/tiles'

const colours: { value: Colour; label: string }[] = [
  { value: 'off-white', label: 'Off-white' },
  { value: 'black', label: 'Black' },
  { value: 'silver', label: 'Silver' },
]

const styles = stylex.create({
  swatch: {
    alignSelf: 'stretch',
    justifySelf: 'stretch',
    margin: 8,
  },
  'off-white': {
    backgroundColor: '#ebeae3',
    boxShadow: 'inset 0 0 0 1px #0000000f',
  },
  black: {
    backgroundColor: '#1f1f1f',
  },
  silver: {
    backgroundImage: 'linear-gradient(135deg, #d4d5d2, #a9aaa6)',
  },
  wood: {
    marginTop: 16,
  },
  reset: {
    marginTop: 8,
  },
})

export function FinishSection() {
  const plan = usePlan()
  const { finish, items } = plan.system
  const overrides = items.filter((item) => item.finish !== 'system').length

  return (
    <Section title="Finish">
      <TileGroup
        label="Colour"
        value={finish.colour}
        columns={4}
        options={colours.map((colour) => ({
          value: colour.value,
          label: colour.label,
          visual: <span {...stylex.props(styles.swatch, styles[colour.value])} />,
        }))}
        onChange={(colour) => {
          if (colour) editPlan((plan) => setSystemFinish(plan, { ...plan.system.finish, colour }))
        }}
      />
      <div {...stylex.props(styles.wood)}>
        <CheckboxField
          label="Beech where available"
          checked={finish.wood === 'beech'}
          onChange={(beech) =>
            editPlan((plan) =>
              setSystemFinish(plan, { ...plan.system.finish, wood: beech ? 'beech' : 'laminate' }),
            )
          }
        />
      </div>
      <p {...stylex.props(text.hint)}>
        Components made in beech use it. Steel and aluminium parts keep the colour.
      </p>
      {overrides > 0 && (
        <ActionButton
          variant="link"
          style={styles.reset}
          onPress={() => editPlan(resetItemFinishes)}
        >
          Use this finish for {plural(overrides, 'other component')}
        </ActionButton>
      )}
    </Section>
  )
}
