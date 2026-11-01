import type { Catalog } from '../catalog/catalog'
import { hasIntegratedTable, isWallMounted, setMountHeight } from '../plan/system'
import type { Plan } from '../plan/types'
import type { Millimetres } from '../types'
import { roomBoundaryOverflow } from './footprint'
import { itemsHaveTrackHeightError } from './tracks'

/** A run position along its wall, from the wall, and above the floor. */
export interface SupportRunMove {
  offset: Millimetres
  distance: Millimetres
  mountHeight: Millimetres
}

/**
 * Moves the connected support run as one piece, so bay centres and shared supports stay fixed.
 * Wall-bound runs stay on their wall; only wall-mounted runs without table legs move vertically.
 */
export function moveSupportRun(plan: Plan, move: SupportRunMove): Plan {
  const { placement, mountingType } = plan.system

  const moved: Plan = {
    ...plan,
    system: {
      ...plan.system,
      placement: {
        ...placement,
        offset: Math.max(0, Math.round(move.offset)),
        distance: isWallMounted(mountingType)
          ? placement.distance
          : Math.max(0, Math.round(move.distance)),
      },
    },
  }

  return mountingType === 'wall' && !hasIntegratedTable(plan)
    ? setMountHeight(moved, Math.max(0, Math.round(move.mountHeight)))
    : moved
}

/** A run move must not push the system further out of the room or the tracks above it. */
export function proposeSupportRunMove(plan: Plan, catalog: Catalog, move: SupportRunMove) {
  const next = moveSupportRun(plan, move)
  const heightChanged = next.system.mountHeight !== plan.system.mountHeight
  const raisesTracksTooHigh =
    heightChanged &&
    itemsHaveTrackHeightError(next, catalog, next.system.items) &&
    !itemsHaveTrackHeightError(plan, catalog, plan.system.items)

  return {
    plan: next,
    valid:
      roomBoundaryOverflow(next, catalog) <= roomBoundaryOverflow(plan, catalog) &&
      !raisesTracksTooHigh,
  }
}
