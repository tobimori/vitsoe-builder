import type { ItemOrientation } from '../types'

const cabinets = new Set([
  'cabinet',
  'lockable-drawer-cabinet',
  'two-drawer-cabinet',
  'three-drawer-cabinet',
  'retractable-flap-cabinet',
  'drop-front-cabinet',
])

const shelves = new Set([
  'shelf',
  'shelf-with-clothes-rail',
  'wood-shelf',
  'double-shelf',
  'desk-shelf',
  'shelf-with-drawer',
])

export function isCabinet(productId: string) {
  return cabinets.has(productId)
}

/** Shelves share one 100 mm deck envelope below the pin, or above it when inverted. */
export function isShelfFamily(productId: string) {
  return shelves.has(productId)
}

export function isIntegratedTable(productId: string) {
  return productId === 'table'
}

/** A drawer, flap or door front that opens and can take its own colour on beech. */
export function hasFront(productId: string) {
  return isCabinet(productId) || productId === 'shelf-with-drawer'
}

export function orientationsFor(productId: string): ItemOrientation[] {
  if (productId === 'shelf') return ['standard', 'inverted', 'vertical']
  if (productId === 'wood-shelf' || productId === 'double-shelf' || productId === 'desk-shelf') {
    return ['standard', 'inverted']
  }
  return ['standard']
}

export function fixedMaterialLabel(productId: string) {
  if (productId === 'drawer-liner') return 'Grey wool felt'
  if (productId === 'aluminium-tray' || productId === 'pen-tray') {
    return 'Natural anodised aluminium'
  }
  return undefined
}
