import type { Finish } from '../types'
import { products } from './products'
import type { CatalogProduct, ProductVariant } from './types'

export interface Catalog {
  readonly products: readonly CatalogProduct[]
  product(productId: string): CatalogProduct | undefined
  variant(productId: string, variantId: string): ProductVariant | undefined
}

export function createCatalog(source: readonly CatalogProduct[]): Catalog {
  const byId = new Map(source.map((product) => [product.id, product]))

  return {
    products: source,
    product: (productId) => byId.get(productId),
    variant: (productId, variantId) =>
      byId.get(productId)?.variants.find((variant) => variant.id === variantId),
  }
}

export const catalog = createCatalog(products)

export function isAccessory(product: CatalogProduct) {
  return Boolean(product.compatibleHosts?.length)
}

export function priceForVariant(variant: ProductVariant, finish: Finish) {
  return finish === 'beech' ? variant.estimatedBeechPriceEur : variant.estimatedPriceEur
}
