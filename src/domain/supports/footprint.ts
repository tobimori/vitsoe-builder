import type { Catalog } from '../catalog/catalog'
import { effectiveDepth } from '../placement/envelope'
import {
  allowedFaces,
  isWallMounted,
  setPlacement,
  sideClearance,
  totalCentreWidth,
  wallTieDistance,
} from '../plan/system'
import type { Plan } from '../plan/types'
import { acrossRoom, runFrame, wallLength } from '../plan/walls'
import type { Face } from '../types'

/** Depth of a wall-mounted E-track system from the wall. */
const WALL_TRACK_DEPTH = 65

/** Front (positive) and rear (negative) reach of the supports from the pin line. */
function supportDepthExtent(plan: Plan) {
  const { system, room } = plan
  const { mountingType, structureOptions } = system

  if (mountingType === 'wall') return { min: 0, max: WALL_TRACK_DEPTH }
  if (mountingType === 'freestanding') return { min: -459, max: 391 }

  if (mountingType === 'semi-wall') {
    return {
      min: Math.min(-89, -wallTieDistance(structureOptions)),
      max: structureOptions.stabilisingFeet ? 376 : 41,
    }
  }

  const tallPosts = room.ceilingHeight > 3500
  if (structureOptions.stabilisingFeet) {
    return tallPosts ? { min: -459, max: 391 } : { min: -449, max: 401 }
  }
  return tallPosts ? { min: -99, max: 31 } : { min: -89, max: 41 }
}

/** How far the system reaches beyond its outer supports, and in front of and behind them. */
function footprintExtent(plan: Plan, catalog: Catalog) {
  const { system, room } = plan
  const supportDepth = supportDepthExtent(plan)
  const hPosts =
    system.mountingType === 'freestanding' ||
    (system.mountingType === 'floor-to-ceiling' && room.ceilingHeight > 3500)
  const rearAttachmentOffset = hPosts ? 79 : 59

  const itemDepths = (face: Face, offset: number) =>
    system.items
      .filter((item) => item.face === face)
      .map((item) => {
        const variant = catalog.variant(item.productId, item.variantId)
        return variant ? effectiveDepth(item, variant) + offset : 0
      })

  return {
    side: sideClearance(system.mountingType),
    front: Math.max(supportDepth.max, ...itemDepths('front', 11)),
    back: allowedFaces(plan).includes('back')
      ? Math.max(-supportDepth.min, ...itemDepths('back', rearAttachmentOffset))
      : Math.max(0, -supportDepth.min),
  }
}

/** The corners of the system's footprint in the room, in millimetres. */
export function footprintCorners(plan: Plan, catalog: Catalog) {
  const { side, front, back } = footprintExtent(plan, catalog)
  const span = totalCentreWidth(plan)
  const { x, z, cos, sin } = runFrame(plan)

  return [
    [-span / 2 - side, -back],
    [span / 2 + side, -back],
    [span / 2 + side, front],
    [-span / 2 - side, front],
  ].map(([along = 0, out = 0]) => ({
    x: x + along * cos + out * sin,
    z: z - along * sin + out * cos,
  }))
}

/** How far, in millimetres, the system's footprint extends beyond the room walls. */
export function roomBoundaryOverflow(plan: Plan, catalog: Catalog) {
  const { width, depth } = plan.room
  return Math.max(
    0,
    ...footprintCorners(plan, catalog).flatMap((corner) => [
      -corner.x,
      corner.x - width,
      -corner.z,
      corner.z - depth,
    ]),
  )
}

/** A run within this distance of its wall's centre is held there. */
const CENTRE_SNAP = 40

/**
 * Moves the run to the nearest position on its wall that keeps it inside the room, and holds
 * it at the wall's centre when it is close. Wall-mounted runs keep their distance from the wall.
 */
export function fitPlacement(plan: Plan, catalog: Catalog): Plan {
  const { side, front, back } = footprintExtent(plan, catalog)
  const { offset, distance } = plan.system.placement
  const free = wallLength(plan) - totalCentreWidth(plan)
  const centred = Math.round(free / 2)
  const clamp = (value: number, min: number, max: number) =>
    Math.round(Math.min(Math.max(value, min), Math.max(min, max)))

  return setPlacement(plan, {
    offset: Math.abs(offset - centred) < CENTRE_SNAP ? centred : clamp(offset, side, free - side),
    distance: isWallMounted(plan.system.mountingType)
      ? distance
      : clamp(distance, back, acrossRoom(plan) - front),
  })
}
