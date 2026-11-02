import * as stylex from '@stylexjs/stylex'
import { catalog, priceForVariant } from '../../domain/catalog/catalog'
import { itemTreeIds } from '../../domain/placement/proposals'
import { resolveItemFinish } from '../../domain/plan/finish'
import { otherFace } from '../../domain/plan/system'
import type { Plan, PlanItem } from '../../domain/plan/types'
import { editor, usePlan } from '../../editor/editor'
import { ActionButton } from '../../ui/buttons'
import { formatPrice, plural } from '../../ui/format'
import { Section } from '../../ui/section'
import { text } from '../../ui/text'
import { touchScreen } from '../../ui/touch'
import { InspectorHeader } from './InspectorHeader'

/** Where every selected component can go together on the other side, if it can. */
export function sharedOtherFace(plan: Plan, items: readonly PlanItem[]) {
  const faces = new Set(items.map((item) => otherFace(plan, catalog, item)))
  const [face] = faces
  return faces.size === 1 ? face : undefined
}

function price(plan: Plan, items: readonly PlanItem[]) {
  const ids = new Set(items.flatMap((item) => [...itemTreeIds(plan.system.items, item.id)]))
  return plan.system.items
    .filter((item) => ids.has(item.id))
    .reduce((total, item) => {
      const variant = catalog.variant(item.productId, item.variantId)
      const { finish } = resolveItemFinish(plan.system.finish, item, catalog)
      return total + (variant ? (priceForVariant(variant, finish) ?? 0) : 0)
    }, 0)
}

/** Several components at once: what they are, what they cost, and what can be done with them. */
export function SelectionInspector({ ids }: { ids: string[] }) {
  const plan = usePlan()
  const items = plan.system.items.filter((item) => ids.includes(item.id))
  const turnTo = sharedOtherFace(plan, items)

  const counts = new Map<string, number>()
  for (const item of items) {
    const name = catalog.product(item.productId)?.name ?? item.productId
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  const summary = [...counts].map(([name, count]) => `${count} × ${name}`).join(', ')

  return (
    <>
      <InspectorHeader
        title={plural(items.length, 'component')}
        subtitle={summary}
        aside={formatPrice(price(plan, items))}
        actions={
          <>
            {turnTo && (
              <ActionButton
                variant="link"
                onPress={() =>
                  editor.trigger.moveItems({
                    items: items.map((item) => ({ ...item, face: turnTo })),
                  })
                }
              >
                Move to {turnTo}
              </ActionButton>
            )}
            <ActionButton
              variant="link"
              aria-keyshortcuts="Control+D Meta+D"
              onPress={() => editor.trigger.duplicateSelected()}
            >
              Duplicate
            </ActionButton>
            <ActionButton
              variant="danger"
              aria-keyshortcuts="Delete Backspace"
              onPress={() => editor.trigger.deleteSelected()}
            >
              Remove
            </ActionButton>
          </>
        }
      />
      <Section>
        <p {...stylex.props(text.hint)}>
          {touchScreen
            ? 'Select a component in Layers to work on it alone.'
            : 'Shift-click or Cmd-click a component to add it or take it out. Copy, cut, and paste them with the usual shortcuts.'}
        </p>
      </Section>
    </>
  )
}
