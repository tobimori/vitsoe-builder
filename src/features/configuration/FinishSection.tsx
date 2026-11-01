import * as stylex from '@stylexjs/stylex'
import { Button } from 'react-aria-components'
import { editor, usePlan } from '../../editor/editor'
import { resetItemFinishes, setSystemFinish } from '../../domain/plan/system'
import type { SystemFinish } from '../../domain/plan/types'
import type { Colour } from '../../domain/types'
import { SelectField } from '../../ui/fields'
import { text } from '../../ui/text'
import { colors } from '../../ui/tokens.stylex'
import { Section } from './Section'

const finishes = [
  { value: 'off-white', label: 'Off-white' },
  { value: 'black', label: 'Black' },
  { value: 'silver', label: 'Silver' },
  { value: 'beech-off-white', label: 'Beech with off-white' },
  { value: 'beech-black', label: 'Beech with black' },
  { value: 'beech-silver', label: 'Beech with silver' },
] as const

type FinishOption = (typeof finishes)[number]['value']

const styles = stylex.create({
  row: {
    display: 'grid',
    gridTemplateColumns: '38px 1fr',
    gap: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  swatch: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#aaa',
    backgroundColor: 'currentColor',
  },
  'off-white': {
    color: '#ecebe4',
  },
  black: {
    color: '#202020',
  },
  silver: {
    color: '#b8b9b6',
  },
  beech: {
    backgroundImage: 'linear-gradient(90deg, #c7a071 0 62%, currentColor 62%)',
  },
  action: {
    marginTop: 13,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: colors.blue,
    fontSize: 14,
    textAlign: 'left',
  },
})

function toOption(finish: SystemFinish): FinishOption {
  return finish.wood === 'beech' ? `beech-${finish.colour}` : finish.colour
}

function fromOption(option: FinishOption): SystemFinish {
  return option.startsWith('beech-')
    ? { colour: option.slice('beech-'.length) as Colour, wood: 'beech' }
    : { colour: option as Colour, wood: 'laminate' }
}

export function FinishSection() {
  const plan = usePlan()
  const { finish, items } = plan.system
  const overrides = items.filter((item) => item.finish !== 'system').length

  return (
    <Section title="System finish">
      <div {...stylex.props(styles.row)}>
        <span
          aria-hidden="true"
          {...stylex.props(
            styles.swatch,
            styles[finish.colour],
            finish.wood === 'beech' && styles.beech,
          )}
        />
        <SelectField
          wide
          label="System finish"
          value={toOption(finish)}
          options={finishes}
          onChange={(option) =>
            editor.trigger.edit({ plan: setSystemFinish(plan, fromOption(option)) })
          }
        />
      </div>
      <p {...stylex.props(text.hint)}>
        Beech applies to supported wood components; metal parts use the selected colour.
      </p>
      {overrides > 0 && (
        <Button
          onPress={() => editor.trigger.edit({ plan: resetItemFinishes(plan) })}
          {...stylex.props(styles.action)}
        >
          Use system finish for all · {overrides} override{overrides === 1 ? '' : 's'}
        </Button>
      )}
    </Section>
  )
}
