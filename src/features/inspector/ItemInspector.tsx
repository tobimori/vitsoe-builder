import * as stylex from '@stylexjs/stylex'
import { catalog, priceForVariant } from '../../domain/catalog/catalog'
import { hasFront, isIntegratedTable, orientationsFor } from '../../domain/catalog/families'
import {
  BOOKEND_CLEARANCE,
  BOOKEND_STEP,
  bookendPosition,
  slidesOnHost,
} from '../../domain/placement/bookends'
import { holeOrigin, VERTICAL_PITCH } from '../../domain/placement/grid'
import { finishLabel, resolveItemFinish } from '../../domain/plan/finish'
import { allowedFaces, otherFace } from '../../domain/plan/system'
import type { PlanItem } from '../../domain/plan/types'
import type { Colour, Finish, ItemOrientation } from '../../domain/types'
import { editor, usePlan } from '../../editor/editor'
import { ActionButton } from '../../ui/buttons'
import {
  CheckboxField,
  FieldRow,
  NumberField,
  Rows,
  Segmented,
  SelectField,
  StaticField,
} from '../../ui/fields'
import { formatPrice } from '../../ui/format'
import { Section } from '../../ui/section'
import { text } from '../../ui/text'
import { touchScreen } from '../../ui/touch'
import { weights } from '../../ui/tokens.stylex'
import { VariantList } from '../components/VariantList'
import { InspectorHeader } from './InspectorHeader'

const orientationLabels: Record<ItemOrientation, string> = {
  standard: 'Upright',
  inverted: 'Inverted',
  vertical: 'Vertical pinboard',
}

const faces = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
] as const

const colourOptions = (['off-white', 'black', 'silver'] as const).map((colour) => ({
  value: colour,
  label: finishLabel(colour),
}))

const styles = stylex.create({
  accessory: {
    marginTop: 20,
    marginBottom: 4,
    fontSize: 14,
    fontWeight: weights.bold,
  },
  firstAccessory: {
    marginTop: 0,
  },
})

export function ItemInspector({ item }: { item: PlanItem }) {
  const plan = usePlan()
  const product = catalog.product(item.productId)
  const variant = catalog.variant(item.productId, item.variantId)
  if (!product || !variant) return null

  const resolved = resolveItemFinish(plan.system.finish, item, catalog)
  const systemFinish = resolveItemFinish(plan.system.finish, { ...item, finish: 'system' }, catalog)
  const orientations = orientationsFor(item.productId)
  const accessories = catalog.products.filter((entry) =>
    entry.compatibleHosts?.includes(item.productId),
  )
  const update = (next: PlanItem) => editor.trigger.updateItem({ item: next })
  const turnTo = otherFace(plan, catalog, item)
  const bookend = slidesOnHost(item.productId) && bookendPosition(plan.system.items, catalog, item)

  const setFinish = (finish: Finish | 'system') => {
    const { frontFinish: _, ...rest } = item
    if (finish === 'system') {
      update({ ...rest, finish })
      return
    }
    const frontFinish = resolveItemFinish(
      plan.system.finish,
      { ...rest, finish },
      catalog,
    ).frontFinish
    update(frontFinish ? { ...rest, finish, frontFinish } : { ...rest, finish })
  }

  return (
    <>
      <InspectorHeader
        title={product.name}
        subtitle={variant.name}
        aside={formatPrice(priceForVariant(variant, resolved.finish))}
        actions={
          <>
            {turnTo && (
              <ActionButton variant="link" onPress={() => update({ ...item, face: turnTo })}>
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

      {bookend && (
        <Section title="Position">
          <Rows>
            <NumberField
              label="From the left"
              value={bookend.offset + bookend.limit + BOOKEND_CLEARANCE}
              // From 0, so typed values snap to round steps; the offset stays on the shelf
              min={0}
              max={bookend.limit * 2 + BOOKEND_CLEARANCE}
              step={BOOKEND_STEP}
              stepper
              onChange={(distance) =>
                update({
                  ...item,
                  offset: Math.max(
                    -bookend.limit,
                    Math.round(distance) - bookend.limit - BOOKEND_CLEARANCE,
                  ),
                })
              }
            />
          </Rows>
          <p {...stylex.props(text.hint)}>
            {touchScreen
              ? 'Drag it along the shelf or onto another one.'
              : 'Drag it along the shelf or onto another one, or use the arrow keys. Hold Alt as you drag to copy it.'}
          </p>
        </Section>
      )}

      {!item.parentItemId && (
        <Section title="Position">
          <Rows>
            {allowedFaces(plan).length > 1 && variant.faces.length > 1 && (
              <FieldRow label="Face">
                <Segmented
                  label="Face"
                  value={item.face}
                  options={faces}
                  onChange={(face) => update({ ...item, face })}
                />
              </FieldRow>
            )}
            <SelectField
              label="Bay"
              value={item.bayIndex}
              options={plan.system.bays.map((bay, index) => ({
                value: index,
                label: `${index + 1} · ${bay.centreWidth} mm`,
              }))}
              onChange={(bayIndex) => update({ ...item, bayIndex })}
            />
            {isIntegratedTable(item.productId) ? (
              <StaticField label="Tabletop height" value="740 mm" />
            ) : (
              <NumberField
                label="Height"
                value={item.height}
                min={holeOrigin(plan) % VERTICAL_PITCH}
                max={plan.room.ceilingHeight}
                step={VERTICAL_PITCH}
                stepper
                onChange={(height) => update({ ...item, height })}
              />
            )}
          </Rows>
          <p {...stylex.props(text.hint)}>
            {touchScreen
              ? 'Drag it in the view, or choose a bay and height here.'
              : 'Drag it in the view or use the arrow keys. Hold Alt as you drag to copy it.'}
          </p>
        </Section>
      )}

      <Section title="Options">
        <Rows>
          {resolved.materialLabel ? (
            <StaticField label="Material" value={resolved.materialLabel} />
          ) : (
            <SelectField
              label="Finish"
              value={item.finish}
              options={[
                { value: 'system', label: `System (${finishLabel(systemFinish.finish)})` },
                ...variant.finishes.map((finish) => ({
                  value: finish,
                  label: finishLabel(finish),
                })),
              ]}
              onChange={setFinish}
            />
          )}
          {hasFront(item.productId) &&
            resolved.finish === 'beech' &&
            (item.finish === 'system' ? (
              <StaticField
                label="Front"
                value={resolved.frontFinish && finishLabel(resolved.frontFinish)}
              />
            ) : (
              <SelectField
                label="Front"
                value={resolved.frontFinish ?? 'off-white'}
                options={colourOptions}
                onChange={(frontFinish: Colour) => update({ ...item, frontFinish })}
              />
            ))}
          {product.id === 'sloping-shelf' && (
            <SelectField
              label="Slope"
              value={item.variantId}
              options={product.variants
                .filter((option) => option.width === variant.width)
                .map((option) => ({
                  value: option.id,
                  label: option.name.split(' · ')[0] ?? option.name,
                }))}
              onChange={(variantId) => update({ ...item, variantId })}
            />
          )}
          {orientations.length > 1 && (
            <SelectField
              label="Orientation"
              value={item.orientation ?? 'standard'}
              options={orientations.map((orientation) => ({
                value: orientation,
                label: orientationLabels[orientation],
              }))}
              onChange={(orientation) => update({ ...item, orientation })}
            />
          )}
          {hasFront(item.productId) && (
            <CheckboxField
              row
              label="Show open"
              checked={item.open ?? false}
              onChange={(open) => update({ ...item, open })}
            />
          )}
        </Rows>
      </Section>

      {accessories.length > 0 && (
        <Section title="Accessories">
          {accessories.map((accessory, index) => (
            <div key={accessory.id}>
              <h3 {...stylex.props(styles.accessory, index === 0 && styles.firstAccessory)}>
                {accessory.name}
              </h3>
              <VariantList product={accessory} host={item} />
            </div>
          ))}
        </Section>
      )}
    </>
  )
}
