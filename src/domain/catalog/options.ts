import type { BayWidth } from '../types'
import type { CatalogProduct, ProductVariant } from './types'

/** Variants that differ only in width. The bay a component goes into decides the width. */
export interface ProductOption {
  key: string
  /** Empty when the product has no choice besides its width. */
  label: string
  variants: ProductVariant[]
}

/** A variant's name without its width, which follows the bay. */
export function sizeLabel(variant: ProductVariant) {
  return variant.name
    .split(' · ')
    .filter((part) => !part.endsWith(' wide'))
    .join(' · ')
}

export function productOptions(product: CatalogProduct): ProductOption[] {
  const options = new Map<string, ProductOption>()
  for (const variant of product.variants) {
    const key = `${variant.depth}x${variant.height}`
    const label = sizeLabel(variant)
    const option = options.get(key) ?? { key, label, variants: [] }
    option.variants.push(variant)
    options.set(key, option)
  }
  return [...options.values()]
}

export function productOption(product: CatalogProduct, key: string) {
  return productOptions(product).find((option) => option.key === key)
}

/** The first option at least 300 mm deep, the depth most shelves and tables are bought in. */
export function defaultOption(product: CatalogProduct) {
  const options = productOptions(product)
  return options.find((option) => (option.variants[0]?.depth ?? 0) >= 300) ?? options[0]
}

export function variantForBay(option: ProductOption, bayWidth: BayWidth) {
  return option.variants.find((variant) => variant.bayCentres?.includes(bayWidth))
}

/** A component moved to another bay takes the width of that bay, when its product has it. */
export function sizedForBay<T extends { productId: string; variantId: string; bayIndex: number }>(
  item: T,
  bays: readonly { centreWidth: BayWidth }[],
  products: { product: (id: string) => CatalogProduct | undefined },
): T {
  const width = bays[item.bayIndex]?.centreWidth
  const product = products.product(item.productId)
  const option = product
    ? productOptions(product).find((entry) =>
        entry.variants.some((variant) => variant.id === item.variantId),
      )
    : undefined
  const variant = option && width !== undefined ? variantForBay(option, width) : undefined
  return variant ? { ...item, variantId: variant.id } : item
}
