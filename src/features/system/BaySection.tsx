import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import { catalog } from '../../domain/catalog/catalog'
import { addBay, removeBay, resizeBay, totalCentreWidth } from '../../domain/plan/system'
import { FREESTANDING_MAX_HEIGHT } from '../../domain/supports/tracks'
import type { BayWidth } from '../../domain/types'
import { editor, editPlan, selectors, usePlan } from '../../editor/editor'
import { makeId } from '../../editor/store'
import { ActionButton, IconButton } from '../../ui/buttons'
import { FieldRow, Rows, Segmented } from '../../ui/fields'
import { Icon } from '../../ui/icons'
import { Section } from '../../ui/section'
import { text } from '../../ui/text'

const widths = [
  { value: '667', label: '667 mm' },
  { value: '912', label: '912 mm' },
] as const

const styles = stylex.create({
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    marginRight: -6,
  },
})

export function BaySection() {
  const plan = usePlan()
  const { bays, mountingType } = plan.system
  const [message, setMessage] = useState<string | null>(null)

  const resize = (index: number, width: BayWidth) => {
    const result = resizeBay(selectors.plan.get(), catalog, index, width)
    setMessage(result.ok ? null : result.message)
    if (result.ok) editor.trigger.edit({ plan: result.plan })
  }

  return (
    <Section
      title="Bays"
      aside={`${totalCentreWidth(plan)} mm wide`}
      actions={
        <ActionButton
          variant="link"
          onPress={() => editPlan((plan) => addBay(plan, makeId('bay')))}
        >
          Add bay
          <Icon name="plus" size={12} />
        </ActionButton>
      }
    >
      <Rows>
        {bays.map((bay, index) => (
          <FieldRow key={bay.id} label={`Bay ${index + 1}`}>
            <div {...stylex.props(styles.controls)}>
              <Segmented
                label={`Bay ${index + 1} width`}
                value={String(bay.centreWidth) as '667' | '912'}
                options={widths}
                onChange={(value) => resize(index, Number(value) as BayWidth)}
              />
              <IconButton
                label={`Remove bay ${index + 1}`}
                isDisabled={bays.length === 1}
                onPress={() => {
                  setMessage(null)
                  editPlan((plan) => removeBay(plan, index))
                }}
              >
                <Icon name="close" size={14} />
              </IconButton>
            </div>
          </FieldRow>
        ))}
      </Rows>
      {message && (
        <p role="alert" {...stylex.props(text.error)}>
          {message}
        </p>
      )}
      <p {...stylex.props(text.hint)}>
        Widths are measured between support centres.
        {mountingType === 'freestanding' &&
          ` Freestanding systems are at most ${FREESTANDING_MAX_HEIGHT} mm high.`}
      </p>
    </Section>
  )
}
