import * as stylex from '@stylexjs/stylex'
import { Button } from 'react-aria-components'
import { catalog, isAccessory, priceForVariant } from '../../domain/catalog/catalog'
import type { CatalogProduct, ProductCategory } from '../../domain/catalog/types'
import { BAY_USABLE_WIDTH } from '../../domain/placement/grid'
import { resolveItemFinish } from '../../domain/plan/finish'
import type { PlanItem } from '../../domain/plan/types'
import { editor, usePlan } from '../../editor/editor'
import { CatalogPreview } from '../../scene/preview/CatalogPreview'
import { text } from '../../ui/text'
import { colors, media } from '../../ui/tokens.stylex'

export const categoryLabels: Record<ProductCategory, string> = {
  shelves: 'Shelves',
  cabinets: 'Cabinets',
  tables: 'Tables',
  accessories: 'Accessories',
}

const styles = stylex.create({
  card: {
    display: 'grid',
    gridTemplateColumns: {
      default: '240px 1fr',
      [media.mobile]: '106px 1fr',
    },
    gap: {
      default: 40,
      [media.mobile]: 16,
    },
    padding: {
      default: '40px 0',
      [media.mobile]: '20px 0',
    },
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  figure: {
    position: 'relative',
    minHeight: {
      default: 190,
      [media.mobile]: 120,
    },
    overflow: 'hidden',
    backgroundColor: colors.neutral,
  },
  name: {
    margin: '2px 0 5px',
    fontSize: 24,
    fontWeight: 500,
  },
  description: {
    margin: '0 0 14px',
    color: colors.muted,
    fontSize: 14,
    lineHeight: 1.45,
  },
  variants: {
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.divider,
  },
  variant: {
    display: {
      default: 'flex',
      [media.mobile]: 'block',
    },
    justifyContent: 'space-between',
    gap: 15,
    width: '100%',
    padding: '13px 0',
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.divider,
    backgroundColor: colors.panel,
    color: {
      default: 'inherit',
      ':hover': colors.blue,
      ':disabled': '#aaa',
    },
    textAlign: 'left',
    fontSize: 14,
  },
  details: {
    display: {
      default: 'inline',
      [media.mobile]: 'block',
    },
    marginTop: {
      default: 0,
      [media.mobile]: 2,
    },
    color: 'inherit',
    whiteSpace: {
      default: 'nowrap',
      [media.mobile]: 'normal',
    },
  },
})

export function ProductCard({ product, host }: { product: CatalogProduct; host?: PlanItem }) {
  const plan = usePlan()
  const { bays, finish } = plan.system
  const bayWidths = new Set(bays.map((bay) => bay.centreWidth))
  const hostWidth = bays[host?.bayIndex ?? 0]?.centreWidth ?? 667
  const accessory = isAccessory(product)
  const hostFits = !accessory || Boolean(host && product.compatibleHosts?.includes(host.productId))

  const appearance = (variantId: string) =>
    resolveItemFinish(finish, { productId: product.id, variantId, finish: 'system' }, catalog)

  const preview =
    product.variants.find((variant) => variant.bayCentres?.some((width) => bayWidths.has(width))) ??
    product.variants[0]
  const previewFinish = preview && appearance(preview.id)

  return (
    <article {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.figure)}>
        {preview && previewFinish && (
          <CatalogPreview
            product={product}
            variant={preview}
            finish={previewFinish.finish}
            frontFinish={previewFinish.frontFinish}
          />
        )}
      </div>
      <div>
        <p {...stylex.props(text.eyebrow)}>{categoryLabels[product.category]}</p>
        <h3 {...stylex.props(styles.name)}>{product.name}</h3>
        <p {...stylex.props(styles.description)}>{product.description}</p>
        <div {...stylex.props(styles.variants)}>
          {product.variants.map((variant) => {
            const fits =
              hostFits &&
              (accessory
                ? variant.width <= BAY_USABLE_WIDTH[hostWidth]
                : Boolean(variant.bayCentres?.some((width) => bayWidths.has(width))))
            const price = priceForVariant(variant, appearance(variant.id).finish)

            return (
              <Button
                key={variant.id}
                isDisabled={!fits}
                onPress={() =>
                  editor.trigger.addComponent({ productId: product.id, variantId: variant.id })
                }
                {...stylex.props(styles.variant)}
              >
                <span>{variant.name}</span>
                <small {...stylex.props(styles.details)}>
                  {variant.width} × {variant.depth} mm ·{' '}
                  {price === undefined ? 'price unavailable' : `${price.toLocaleString('de-DE')} €`}
                  {!hostFits ? ' · select a compatible host' : fits ? '' : ' · does not fit'}
                </small>
              </Button>
            )
          })}
        </div>
      </div>
    </article>
  )
}
