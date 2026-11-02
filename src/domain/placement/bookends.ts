import type { Catalog } from '../catalog/catalog'
import type { PlanItem } from '../plan/types'

/** The space a bookend keeps from the end of its shelf, in millimetres. */
export const BOOKEND_CLEARANCE = 15

/** How far the arrow keys and the stepper move a bookend along its shelf, in millimetres. */
export const BOOKEND_STEP = 10

/** Bookends stand on a shelf, so they slide along it and move to other shelves. */
export function slidesOnHost(productId: string) {
  return productId === 'bookend'
}

/**
 * Where a bookend stands from the centre of its shelf, and how far it can go either way,
 * in whole millimetres. Until it is moved, it stands at the end it faces.
 */
export function bookendPosition(items: readonly PlanItem[], catalog: Catalog, item: PlanItem) {
  const host = items.find((entry) => entry.id === item.parentItemId)
  const hostWidth = host && catalog.variant(host.productId, host.variantId)?.width
  const width = catalog.variant(item.productId, item.variantId)?.width
  if (!hostWidth || !width) return undefined

  const limit = Math.max(0, Math.floor(hostWidth / 2 - width / 2 - BOOKEND_CLEARANCE))
  const offset =
    item.offset === undefined
      ? item.variantId.includes('right')
        ? limit
        : -limit
      : Math.min(limit, Math.max(-limit, Math.round(item.offset)))
  return { offset, limit }
}
