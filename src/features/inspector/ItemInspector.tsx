import * as stylex from '@stylexjs/stylex'
import { Button } from 'react-aria-components'
import { catalog, priceForVariant } from '../../domain/catalog/catalog'
import {
  hasFront,
  isCabinet,
  isIntegratedTable,
  orientationsFor,
} from '../../domain/catalog/families'
import { VERTICAL_PITCH } from '../../domain/placement/grid'
import { finishLabel, resolveItemFinish } from '../../domain/plan/finish'
import { allowedFaces } from '../../domain/plan/system'
import type { PlanItem } from '../../domain/plan/types'
import type { Colour, Finish, ItemOrientation } from '../../domain/types'
import { editor, usePlan } from '../../editor/editor'
import { NumberField, SelectField, StaticField, SwitchField } from '../../ui/fields'
import { colors } from '../../ui/tokens.stylex'
import { DecorEditor } from './DecorEditor'
import { footerButton, InspectorPanel } from './InspectorPanel'

const orientationLabels: Record<ItemOrientation, string> = {
  standard: 'Upright',
  inverted: 'Inverted',
  vertical: 'Vertical pinboard',
}

const colourOptions = (['off-white', 'black', 'silver'] as const).map((colour) => ({
  value: colour,
  label: finishLabel(colour),
}))

const styles = stylex.create({
  toggle: {
    marginTop: 14,
  },
  guidance: {
    margin: '18px 0 0',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.divider,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 1.4,
  },
  price: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.divider,
  },
})

export function ItemInspector({
  item,
  belowFacePicker,
}: {
  item: PlanItem
  belowFacePicker: boolean
}) {
  const plan = usePlan()
  const product = catalog.product(item.productId)
  const variant = catalog.variant(item.productId, item.variantId)
  if (!product || !variant) return null

  const resolved = resolveItemFinish(plan.system.finish, item, catalog)
  const price = priceForVariant(variant, resolved.finish)
  const orientations = orientationsFor(item.productId)
  const update = (next: PlanItem) => editor.trigger.updateItem({ item: next })

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
    <InspectorPanel
      label="Selected component"
      eyebrow="Selected component"
      title={product.name}
      subtitle={variant.name}
      belowFacePicker={belowFacePicker}
      onClose={() => editor.trigger.clearSelection()}
      footer={
        <>
          <Button
            aria-keyshortcuts="Control+D Meta+D"
            onPress={() => editor.trigger.duplicateSelected()}
            {...stylex.props(footerButton.base)}
          >
            Duplicate
          </Button>
          <Button
            onPress={() => editor.trigger.deleteSelected()}
            {...stylex.props(footerButton.base, footerButton.danger)}
          >
            Delete
          </Button>
        </>
      }
    >
      <SelectField
        label="Bay"
        value={item.bayIndex}
        options={plan.system.bays.map((bay, index) => ({
          value: index,
          label: `Bay ${index + 1} · ${bay.centreWidth}`,
        }))}
        onChange={(bayIndex) => update({ ...item, bayIndex })}
      />

      {isIntegratedTable(item.productId) ? (
        <StaticField label="Tabletop height" value="740 mm · fixed" />
      ) : (
        <NumberField
          label="Pin height"
          value={item.height}
          min={plan.system.mountHeight % VERTICAL_PITCH}
          max={plan.room.ceilingHeight}
          step={VERTICAL_PITCH}
          onChange={(height) => update({ ...item, height })}
        />
      )}

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

      {allowedFaces(plan).length > 1 && variant.faces.length > 1 && (
        <SelectField
          label="Face"
          value={item.face}
          options={[
            { value: 'front', label: 'Front' },
            { value: 'back', label: 'Back' },
          ]}
          onChange={(face) => update({ ...item, face })}
        />
      )}

      {resolved.materialLabel ? (
        <StaticField label="Material" value={resolved.materialLabel} />
      ) : (
        <SelectField
          label="Finish"
          value={item.finish}
          options={[
            { value: 'system', label: 'Use system finish' },
            ...variant.finishes.map((finish) => ({ value: finish, label: finishLabel(finish) })),
          ]}
          onChange={setFinish}
        />
      )}

      {hasFront(item.productId) &&
        resolved.finish === 'beech' &&
        (item.finish === 'system' ? (
          <StaticField
            label="Front panel"
            value={resolved.frontFinish && finishLabel(resolved.frontFinish)}
          />
        ) : (
          <SelectField
            label="Front panel"
            value={resolved.frontFinish ?? 'off-white'}
            options={colourOptions}
            onChange={(frontFinish: Colour) => update({ ...item, frontFinish })}
          />
        ))}

      {hasFront(item.productId) && (
        <SwitchField
          label="Drawer / flap"
          checked={item.open ?? false}
          style={styles.toggle}
          onChange={(open) => update({ ...item, open })}
        >
          {item.open ? 'Open' : 'Closed'}
        </SwitchField>
      )}

      <DecorEditor item={item} variant={variant} onChange={update} />

      {isCabinet(item.productId) && (
        <p {...stylex.props(styles.guidance)}>
          Add a shelf above the cabinet for books or records.
        </p>
      )}

      <StaticField
        label="Price incl. VAT"
        value={price === undefined ? 'Unavailable' : `${price.toLocaleString('de-DE')} €`}
        style={styles.price}
      />
    </InspectorPanel>
  )
}
