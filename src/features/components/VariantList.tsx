import * as stylex from '@stylexjs/stylex'
import { catalog, isAccessory, priceForVariant } from '../../domain/catalog/catalog'
import type { CatalogProduct, ProductVariant } from '../../domain/catalog/types'
import { BAY_USABLE_WIDTH } from '../../domain/placement/grid'
import { resolveItemFinish } from '../../domain/plan/finish'
import type { Plan, PlanItem } from '../../domain/plan/types'
import { editor, usePlan } from '../../editor/editor'
import { ActionButton } from '../../ui/buttons'
import { formatPrice } from '../../ui/format'
import { Rows } from '../../ui/fields'
import { text } from '../../ui/text'
import { colors } from '../../ui/tokens.stylex'

const styles = stylex.create({
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
    alignItems: 'center',
    gap: 12,
    minHeight: 40,
    padding: '6px 0',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  name: {
    display: 'block',
    fontSize: 14,
    lineHeight: '20px',
  },
  price: {
    fontSize: 14,
  },
  unavailable: {
    color: colors.faint,
  },
  add: {
    height: 32,
    padding: '0 12px',
  },
})

/** Whether a variant can go into the current system, and why not. */
export function variantFit(
  plan: Plan,
  product: CatalogProduct,
  variant: ProductVariant,
  host?: PlanItem,
): string | null {
  const { bays } = plan.system
  if (isAccessory(product)) {
    if (!host || !product.compatibleHosts?.includes(host.productId))
      return 'Select what it fits onto first'
    const hostWidth = bays[host.bayIndex]?.centreWidth ?? 667
    return variant.width <= BAY_USABLE_WIDTH[hostWidth] ? null : 'Too wide for this bay'
  }
  const widths = variant.bayCentres ?? []
  return bays.some((bay) => widths.includes(bay.centreWidth))
    ? null
    : `Needs a ${widths.join(' or ')} mm bay`
}

export function variantPrice(plan: Plan, product: CatalogProduct, variant: ProductVariant) {
  const { finish } = resolveItemFinish(
    plan.system.finish,
    { productId: product.id, variantId: variant.id, finish: 'system' },
    catalog,
  )
  return priceForVariant(variant, finish)
}

/** Every size of a product, each with its price and a button to add it. */
export function VariantList({ product, host }: { product: CatalogProduct; host?: PlanItem }) {
  const plan = usePlan()

  return (
    <Rows>
      {product.variants.map((variant) => {
        const problem = variantFit(plan, product, variant, host)

        return (
          <div key={variant.id} {...stylex.props(styles.row)}>
            <div>
              <span {...stylex.props(styles.name, problem !== null && styles.unavailable)}>
                {variant.name}
              </span>
              {problem && <span {...stylex.props(text.small)}>{problem}</span>}
            </div>
            <span {...stylex.props(styles.price, text.numeric)}>
              {formatPrice(variantPrice(plan, product, variant))}
            </span>
            <ActionButton
              variant="secondary"
              style={styles.add}
              aria-label={`Add ${product.name}, ${variant.name}`}
              isDisabled={problem !== null}
              onPress={() =>
                editor.trigger.addComponent({ productId: product.id, variantId: variant.id })
              }
            >
              Add
            </ActionButton>
          </div>
        )
      })}
    </Rows>
  )
}
