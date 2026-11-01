import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import { Button } from 'react-aria-components'
import { catalog } from '../../domain/catalog/catalog'
import { addBay, removeBay, resizeBay, totalCentreWidth } from '../../domain/plan/system'
import { FREESTANDING_MAX_HEIGHT } from '../../domain/supports/tracks'
import type { BayWidth } from '../../domain/types'
import { editor, usePlan } from '../../editor/editor'
import { makeId } from '../../editor/store'
import { SegmentedControl } from '../../ui/fields'
import { text } from '../../ui/text'
import { colors } from '../../ui/tokens.stylex'
import { Section } from './Section'

const widths = [
  { value: '667', label: '667' },
  { value: '912', label: '912' },
] as const

const styles = stylex.create({
  list: {
    margin: '13px 0 4px',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.rule,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '22px 1fr 24px',
    alignItems: 'center',
    minHeight: 51,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.rule,
  },
  index: {
    color: colors.muted,
    fontSize: 11,
  },
  remove: {
    width: 24,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: '#888',
    fontSize: 18,
  },
  add: {
    marginTop: 13,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: colors.blue,
    fontSize: 14,
  },
  plus: {
    marginRight: 5,
  },
})

export function BaySection() {
  const plan = usePlan()
  const [message, setMessage] = useState<string | null>(null)

  const resize = (index: number, width: BayWidth) => {
    const result = resizeBay(plan, catalog, index, width)
    setMessage(result.ok ? null : result.message)
    if (result.ok) editor.trigger.edit({ plan: result.plan })
  }

  return (
    <Section title="Bays" aside={`${totalCentreWidth(plan)} mm centres`}>
      <div {...stylex.props(styles.list)}>
        {plan.system.bays.map((bay, index) => (
          <div key={bay.id} {...stylex.props(styles.row)}>
            <span {...stylex.props(styles.index)}>{index + 1}</span>
            <SegmentedControl
              label={`Bay ${index + 1} centre width`}
              value={String(bay.centreWidth) as '667' | '912'}
              options={widths}
              onChange={(value) => resize(index, Number(value) as BayWidth)}
            />
            <Button
              aria-label={`Remove bay ${index + 1}`}
              onPress={() => editor.trigger.edit({ plan: removeBay(plan, index) })}
              {...stylex.props(styles.remove)}
            >
              ×
            </Button>
          </div>
        ))}
      </div>
      {message && (
        <p role="alert" {...stylex.props(text.error)}>
          {message}
        </p>
      )}
      <Button
        onPress={() => editor.trigger.edit({ plan: addBay(plan, makeId('bay')) })}
        {...stylex.props(styles.add)}
      >
        <span aria-hidden="true" {...stylex.props(styles.plus)}>
          ＋
        </span>
        Add bay
      </Button>
      {plan.system.mountingType === 'freestanding' && (
        <p {...stylex.props(text.hint)}>
          Maximum freestanding height: {FREESTANDING_MAX_HEIGHT} mm.
        </p>
      )}
    </Section>
  )
}
