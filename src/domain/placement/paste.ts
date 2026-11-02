import type { Catalog } from '../catalog/catalog'
import { isIntegratedTable } from '../catalog/families'
import { sizedForBay } from '../catalog/options'
import { allowedFaces } from '../plan/system'
import type { Plan, PlanItem } from '../plan/types'
import type { Face } from '../types'
import { BOOKEND_STEP, bookendPosition, slidesOnHost } from './bookends'
import { nearestFittingHeight, TABLETOP_HEIGHT } from './grid'
import { canPlaceItem, itemTreeIds } from './proposals'

function withItems(plan: Plan, items: readonly PlanItem[]): Plan {
  return { ...plan, system: { ...plan.system, items } }
}

/** A copied component and its accessories, with new ids, at a bay, height and face. */
function copyTree(
  tree: readonly PlanItem[],
  root: PlanItem,
  place: Pick<PlanItem, 'variantId' | 'bayIndex' | 'height' | 'face'>,
  createId: (id: string) => string,
) {
  const ids = new Map(tree.map((item) => [item.id, createId(item.id)]))
  return tree.map((item): PlanItem => {
    const id = ids.get(item.id) ?? item.id
    if (item.id === root.id) return { ...item, ...place, id }
    return {
      ...item,
      id,
      bayIndex: place.bayIndex,
      height: place.height,
      face: place.face,
      parentItemId: item.parentItemId && (ids.get(item.parentItemId) ?? item.parentItemId),
    }
  })
}

/** An accessory copied without its host goes back on the same host, a bookend beside the original. */
function pasteAccessory(plan: Plan, catalog: Catalog, item: PlanItem, id: string) {
  const copy = { ...item, id }
  if (!plan.system.items.some((entry) => entry.id === item.parentItemId)) return undefined
  if (!slidesOnHost(item.productId)) return canPlaceItem(plan, catalog, copy) ? copy : undefined

  const position = bookendPosition(plan.system.items, catalog, item)
  if (!position) return undefined
  const steps = Math.floor((position.limit * 2) / BOOKEND_STEP)
  const offsets = Array.from({ length: steps * 2 + 1 }, (_, index) => {
    const step = Math.ceil(index / 2) * (index % 2 === 0 ? -1 : 1)
    return position.offset + step * BOOKEND_STEP
  }).filter((offset) => Math.abs(offset) <= position.limit)
  return offsets
    .map((offset) => ({ ...copy, offset }))
    .find((candidate) => canPlaceItem(plan, catalog, candidate))
}

/**
 * Copies components, with their accessories, into the nearest free places: the nearest
 * free height in their own bay first, then the nearest other bays. They go to `face` where
 * the system and the component allow it.
 */
export function pasteItems(
  plan: Plan,
  catalog: Catalog,
  items: readonly PlanItem[],
  face: Face,
  createId: (id: string) => string,
) {
  const roots = items.filter(
    (item) => !item.parentItemId || !items.some((entry) => entry.id === item.parentItemId),
  )
  let next = plan
  const pasted: string[] = []

  for (const root of roots) {
    const id = createId(root.id)

    if (root.parentItemId) {
      const copy = pasteAccessory(next, catalog, root, id)
      if (copy) {
        next = withItems(next, [...next.system.items, copy])
        pasted.push(copy.id)
      }
      continue
    }

    const tree = items.filter((item) => itemTreeIds(items, root.id).has(item.id))
    const variant = catalog.variant(root.productId, root.variantId)
    const target =
      allowedFaces(next).includes(face) && variant?.faces.includes(face) ? face : root.face
    const bays = next.system.bays
      .map((_, index) => index)
      .sort((a, b) => Math.abs(a - root.bayIndex) - Math.abs(b - root.bayIndex))

    for (const bayIndex of bays) {
      const sized = sizedForBay({ ...root, id, bayIndex, face: target }, next.system.bays, catalog)
      const fits = (height: number) => canPlaceItem(next, catalog, { ...sized, height })
      const height = isIntegratedTable(root.productId)
        ? fits(TABLETOP_HEIGHT)
          ? TABLETOP_HEIGHT
          : undefined
        : nearestFittingHeight(root.height, next, fits, 40)
      if (height === undefined) continue

      const copies = copyTree(tree, root, { ...sized, height }, (source) =>
        source === root.id ? id : createId(source),
      )
      next = withItems(next, [...next.system.items, ...copies])
      pasted.push(id)
      break
    }
  }

  return { plan: next, ids: pasted, missed: roots.length - pasted.length }
}
