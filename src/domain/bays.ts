import type { BuilderDocument, CatalogProduct, ProductVariant } from './types'

export type BayResizeResult =
  | { ok: true; document: BuilderDocument }
  | { ok: false; message: string; itemIds: string[] }

function replacementVariant(
  product: CatalogProduct,
  current: ProductVariant,
  centreWidth: 667 | 912,
) {
  if (!current.bayCentres?.length || current.bayCentres.includes(centreWidth)) return current

  const matches = product.variants.filter(
    (variant) =>
      variant.bayCentres?.includes(centreWidth) &&
      variant.depth === current.depth &&
      variant.height === current.height,
  )
  return matches.length === 1 ? matches[0] : undefined
}

/** Resize a bay and all width-specific components in it as one document change. */
export function resizeBay(
  document: BuilderDocument,
  catalog: CatalogProduct[],
  bayIndex: number,
  centreWidth: 667 | 912,
): BayResizeResult {
  const bay = document.system.bays[bayIndex]
  if (!bay) return { ok: false, message: 'That bay no longer exists.', itemIds: [] }
  if (bay.centreWidth === centreWidth) return { ok: true, document }

  const replacements = new Map<string, string>()
  const missing: { id: string; name: string }[] = []

  for (const item of document.system.items) {
    if (item.bayIndex !== bayIndex) continue
    const product = catalog.find((entry) => entry.id === item.productId)
    const variant = product?.variants.find((entry) => entry.id === item.variantId)
    const replacement = product && variant && replacementVariant(product, variant, centreWidth)
    if (!product || !replacement) {
      missing.push({ id: item.id, name: product?.name ?? 'Component' })
      continue
    }
    replacements.set(item.id, replacement.id)
  }

  if (missing.length) {
    const names = [...new Set(missing.map((entry) => entry.name))].join(', ')
    return {
      ok: false,
      message: `${names} ${missing.length === 1 ? 'has' : 'have'} no matching ${centreWidth} mm version.`,
      itemIds: missing.map((entry) => entry.id),
    }
  }

  return {
    ok: true,
    document: {
      ...document,
      system: {
        ...document.system,
        bays: document.system.bays.map((entry, index) =>
          index === bayIndex ? { ...entry, centreWidth } : entry,
        ),
        items: document.system.items.map((item) => {
          const variantId = replacements.get(item.id)
          return variantId && variantId !== item.variantId ? { ...item, variantId } : item
        }),
      },
    },
  }
}
