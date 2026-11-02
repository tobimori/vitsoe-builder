import type { Catalog } from '../catalog/catalog'
import { isAccessory } from '../catalog/catalog'
import { hasFront, isIntegratedTable, orientationsFor } from '../catalog/families'
import type { Plan, PlanItem } from '../plan/types'
import { roomBoundaryOverflow } from '../supports/footprint'
import { itemsHaveTrackHeightError } from '../supports/tracks'
import type { Face } from '../types'
import { validatePlan } from '../validation/validate'
import { snapPinHeight, TABLETOP_HEIGHT, VERTICAL_PITCH } from './grid'

export interface Proposal {
  plan: Plan
  /** The proposed component, with its height snapped to the track grid. */
  candidate: PlanItem
  /** The component and the accessories that travel with it. */
  movedItemIds: string[]
  valid: boolean
}

/** A component and every accessory attached to it, directly or through another accessory. */
export function itemTreeIds(items: readonly PlanItem[], rootId: string) {
  const ids = new Set([rootId])
  let added = true
  while (added) {
    added = false
    for (const item of items) {
      if (item.parentItemId && ids.has(item.parentItemId) && !ids.has(item.id)) {
        ids.add(item.id)
        added = true
      }
    }
  }
  return ids
}

function snapped(candidate: PlanItem, plan: Plan): PlanItem {
  return {
    ...candidate,
    height: isIntegratedTable(candidate.productId)
      ? TABLETOP_HEIGHT
      : snapPinHeight(candidate.height, plan),
  }
}

function withItems(plan: Plan, items: readonly PlanItem[]): Plan {
  return { ...plan, system: { ...plan.system, items } }
}

function errorKeys(plan: Plan, catalog: Catalog, ids: Set<string>) {
  return new Set(
    validatePlan(plan, catalog)
      .filter((issue) => issue.severity === 'error' && issue.itemIds?.some((id) => ids.has(id)))
      .map((issue) => `${issue.code}:${[...(issue.itemIds ?? [])].sort().join(',')}`),
  )
}

/**
 * Moves a component, with its accessories, to a new bay, height or face.
 * A move is valid when it creates no new error for the moved components.
 */
export function proposeItemMove(
  plan: Plan,
  catalog: Catalog,
  candidate: PlanItem,
): Proposal | undefined {
  const original = plan.system.items.find((item) => item.id === candidate.id)
  if (!original) return undefined

  const moved = snapped(candidate, plan)
  const bayDelta = moved.bayIndex - original.bayIndex
  const heightDelta = moved.height - original.height
  const movedIds = itemTreeIds(plan.system.items, moved.id)

  const items = plan.system.items.map((item) => {
    if (item.id === moved.id) return moved
    if (!movedIds.has(item.id)) return item
    return {
      ...item,
      bayIndex: item.bayIndex + bayDelta,
      height: item.height + heightDelta,
      face: moved.face,
    }
  })
  const next = withItems(plan, items)

  const previousErrors = errorKeys(plan, catalog, movedIds)
  const introducesError = [...errorKeys(next, catalog, movedIds)].some(
    (key) => !previousErrors.has(key),
  )
  const raisesTracksTooHigh =
    itemsHaveTrackHeightError(
      next,
      catalog,
      items.filter((item) => movedIds.has(item.id)),
    ) &&
    !itemsHaveTrackHeightError(
      plan,
      catalog,
      plan.system.items.filter((item) => movedIds.has(item.id)),
    )

  return {
    plan: next,
    candidate: moved,
    movedItemIds: [...movedIds],
    valid:
      roomBoundaryOverflow(next, catalog) <= roomBoundaryOverflow(plan, catalog) &&
      !introducesError &&
      !raisesTracksTooHigh,
  }
}

/** Copies a component, with its accessories, to the candidate position. */
export function proposeItemDuplicate(
  plan: Plan,
  catalog: Catalog,
  candidate: PlanItem,
  createId: (sourceId: string) => string = (sourceId) => `copy-${sourceId}`,
): Proposal | undefined {
  const original = plan.system.items.find((item) => item.id === candidate.id)
  if (!original) return undefined

  const target = snapped(candidate, plan)
  const sourceIds = itemTreeIds(plan.system.items, original.id)

  const usedIds = new Set(plan.system.items.map((item) => item.id))
  const copyIds = new Map<string, string>()
  for (const sourceId of sourceIds) {
    const requested = createId(sourceId)
    let id = requested
    let suffix = 2
    while (usedIds.has(id)) id = `${requested}-${suffix++}`
    copyIds.set(sourceId, id)
    usedIds.add(id)
  }

  const bayDelta = target.bayIndex - original.bayIndex
  const heightDelta = target.height - original.height
  const copies = plan.system.items
    .filter((item) => sourceIds.has(item.id))
    .map((item): PlanItem => {
      const root = item.id === original.id
      return {
        ...(root ? target : item),
        id: copyIds.get(item.id) ?? item.id,
        bayIndex: root ? target.bayIndex : item.bayIndex + bayDelta,
        height: root ? target.height : item.height + heightDelta,
        face: target.face,
        parentItemId: root
          ? target.parentItemId
          : item.parentItemId
            ? (copyIds.get(item.parentItemId) ?? item.parentItemId)
            : undefined,
      }
    })

  const copiedIds = new Set(copies.map((item) => item.id))
  const next = withItems(plan, [...plan.system.items, ...copies])
  const introducesError = validatePlan(next, catalog).some(
    (issue) => issue.severity === 'error' && issue.itemIds?.some((id) => copiedIds.has(id)),
  )
  const copy = copies.find((item) => item.id === copyIds.get(original.id)) ?? target

  return {
    plan: next,
    candidate: copy,
    movedItemIds: [...copiedIds],
    valid:
      roomBoundaryOverflow(next, catalog) <= roomBoundaryOverflow(plan, catalog) &&
      !introducesError &&
      !itemsHaveTrackHeightError(next, catalog, copies),
  }
}

/** Whether a new component can stand at the candidate position without errors. */
export function canPlaceItem(plan: Plan, catalog: Catalog, candidate: PlanItem) {
  const next = withItems(plan, [
    ...plan.system.items.filter((item) => item.id !== candidate.id),
    candidate,
  ])

  return (
    roomBoundaryOverflow(next, catalog) <= roomBoundaryOverflow(plan, catalog) &&
    !validatePlan(next, catalog).some(
      (issue) => issue.severity === 'error' && issue.itemIds?.includes(candidate.id),
    ) &&
    !itemsHaveTrackHeightError(next, catalog, [candidate])
  )
}

export interface PlacementRequest {
  id: string
  productId: string
  variantId: string
  face: Face
  /** Bays are tried from this one onwards. */
  preferredBayIndex?: number
  /** Required for accessories. */
  host?: PlanItem
}

/** The first clear position for a new component, from the lowest usable hole upwards. */
export function findAvailablePlacement(
  plan: Plan,
  catalog: Catalog,
  request: PlacementRequest,
): PlanItem | undefined {
  const { id, productId, variantId, face, preferredBayIndex = 0, host } = request
  const product = catalog.product(productId)
  const variant = catalog.variant(productId, variantId)
  if (!product || !variant) return undefined

  const accessory = isAccessory(product)
  if (accessory && (!host || !product.compatibleHosts?.includes(host.productId))) return undefined

  const { bays, mountHeight } = plan.system
  const { ceilingHeight } = plan.room

  const fitsBay = (index: number) => {
    const width = bays[index]?.centreWidth
    if (width === undefined) return false
    return accessory
      ? !variant.bayCentres?.length || variant.bayCentres.includes(width)
      : Boolean(variant.bayCentres?.includes(width))
  }

  const bayIndices = (
    accessory && host
      ? [host.bayIndex]
      : bays
          .map((_, index) => index)
          .sort((a, b) => Number(a !== preferredBayIndex) - Number(b !== preferredBayIndex))
  ).filter(fitsBay)

  const heights =
    accessory && host
      ? [host.height]
      : isIntegratedTable(productId)
        ? [TABLETOP_HEIGHT]
        : Array.from(
            { length: Math.max(0, Math.floor((ceilingHeight - mountHeight) / VERTICAL_PITCH)) },
            (_, index) => mountHeight + VERTICAL_PITCH * (2 + index),
          ).filter((height) => height <= ceilingHeight)

  for (const bayIndex of bayIndices) {
    for (const height of heights) {
      const candidate: PlanItem = {
        id,
        productId,
        variantId,
        bayIndex,
        height,
        face: accessory && host ? host.face : face,
        finish: 'system',
        orientation: orientationsFor(productId)[0],
        parentItemId: accessory ? host?.id : undefined,
        open: hasFront(productId) ? false : undefined,
      }
      if (canPlaceItem(plan, catalog, candidate)) return candidate
    }
  }

  return undefined
}

export type PlaceComponentResult = { ok: true; item: PlanItem } | { ok: false; message: string }

/** Places a new component from the catalogue, with a message that explains a failure. */
export function placeComponent(
  plan: Plan,
  catalog: Catalog,
  request: PlacementRequest,
): PlaceComponentResult {
  const product = catalog.product(request.productId)
  if (!product) return { ok: false, message: 'That component isn’t in the catalogue.' }

  const accessory = isAccessory(product)
  if (accessory && !(request.host && product.compatibleHosts?.includes(request.host.productId))) {
    return {
      ok: false,
      message: `Select a component to add the ${product.name.toLowerCase()} to.`,
    }
  }

  const item = findAvailablePlacement(plan, catalog, request)
  if (item) return { ok: true, item }

  return {
    ok: false,
    message: accessory
      ? 'That doesn’t fit the selected component.'
      : isIntegratedTable(product.id)
        ? 'No bay is clear at table height. Make room around 740 mm, or try the other width.'
        : 'There’s no free space for this component.',
  }
}
