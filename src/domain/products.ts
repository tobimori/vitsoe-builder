import type {
  BuilderDocument,
  CatalogProduct,
  FinishId,
  FrontFinish,
  ItemOrientation,
  PlacedItem,
  ProductVariant,
} from './types'

const shelfEnvelopeFamilies = new Set([
  'shelf',
  'shelf-with-clothes-rail',
  'wood-shelf',
  'double-shelf',
  'desk-shelf',
  'shelf-with-drawer',
])

const cabinetFamilies = new Set([
  'cabinet',
  'lockable-drawer-cabinet',
  'two-drawer-cabinet',
  'three-drawer-cabinet',
  'retractable-flap-cabinet',
  'drop-front-cabinet',
])

const openableFamilies = new Set(['shelf-with-drawer', ...cabinetFamilies])

export function isIntegratedTable(productId: string) {
  return productId === 'table'
}

export function isAccessory(product: CatalogProduct) {
  return Boolean(product.compatibleHosts?.length)
}

export function isOpenable(productId: string) {
  return openableFamilies.has(productId)
}

export function orientationsFor(productId: string): ItemOrientation[] {
  if (productId === 'shelf') return ['standard', 'inverted', 'vertical']
  if (productId === 'wood-shelf' || productId === 'double-shelf' || productId === 'desk-shelf')
    return ['standard', 'inverted']
  return ['standard']
}

export function fixedMaterialLabel(productId: string) {
  if (productId === 'drawer-liner') return 'Grey wool felt'
  if (productId === 'aluminium-tray' || productId === 'pen-tray') {
    return 'Natural anodised aluminium'
  }
  return undefined
}

export interface FinishTarget {
  productId: string
  variantId: string
  finish?: FinishId
  finishOverride?: FinishId | 'system'
  frontFinish?: FrontFinish
}

export function resolveItemFinish(
  document: BuilderDocument,
  item: FinishTarget,
  catalog: CatalogProduct[],
) {
  const product = catalog.find((entry) => entry.id === item.productId)
  const variant = product?.variants.find((entry) => entry.id === item.variantId)
  const systemFinish = document.system.finish ?? {
    colour: 'off-white' as const,
    wood: 'laminate' as const,
  }
  const inherited = item.finishOverride === 'system'
  const requested =
    item.finishOverride === undefined
      ? item.finish
      : item.finishOverride === 'system'
        ? systemFinish.wood === 'beech' && variant?.finishes.includes('beech')
          ? 'beech'
          : systemFinish.colour
        : item.finishOverride
  const finish = variant?.finishes.includes(requested as FinishId)
    ? (requested as FinishId)
    : variant?.finishes.includes(systemFinish.colour)
      ? systemFinish.colour
      : (variant?.finishes[0] ?? 'off-white')
  const frontFinish =
    finish === 'beech'
      ? inherited
        ? systemFinish.colour
        : (item.frontFinish ?? systemFinish.colour)
      : undefined

  return {
    finish,
    frontFinish,
    materialLabel: fixedMaterialLabel(item.productId),
    inherited,
  }
}

export function verticalEnvelope(item: PlacedItem, variant: ProductVariant) {
  if (isIntegratedTable(item.productId)) return { start: 0, size: 740 }

  if (shelfEnvelopeFamilies.has(item.productId)) {
    if (item.orientation === 'inverted') {
      return { start: item.height - 10, size: 110 }
    }
    if (item.productId === 'shelf' && item.orientation === 'vertical') {
      return { start: item.height - variant.depth, size: variant.depth + 10 }
    }
    return { start: item.height - 100, size: 110 }
  }

  if (cabinetFamilies.has(item.productId)) {
    return { start: item.height - variant.height + 20, size: variant.height }
  }

  return { start: item.height - Math.max(0, variant.height - 10), size: variant.height }
}
