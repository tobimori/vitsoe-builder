import type { Catalog } from '../catalog/catalog'
import { effectiveDepth } from '../placement/envelope'
import { allowedFaces, sideClearance, totalCentreWidth } from '../plan/system'
import type { Plan } from '../plan/types'
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
    const bracketDepth = structureOptions.wallBracket === 'long' ? 110 : 70
    const extension = structureOptions.extensionBolts ? 65 : 0
    const wallTieRear = -24 - bracketDepth - extension + 1.5
    return {
      min: Math.min(-89, wallTieRear),
      max: structureOptions.stabilisingFeet ? 376 : 41,
    }
  }

  const tallPosts = room.ceilingHeight > 3500
  if (structureOptions.stabilisingFeet) {
    return tallPosts ? { min: -459, max: 391 } : { min: -449, max: 401 }
  }
  return tallPosts ? { min: -99, max: 31 } : { min: -89, max: 41 }
}

/** How far, in millimetres, the system's footprint extends beyond the room walls. */
export function roomBoundaryOverflow(plan: Plan, catalog: Catalog) {
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

  const frontDepth = Math.max(supportDepth.max, ...itemDepths('front', 11))
  const backDepth = allowedFaces(plan).includes('back')
    ? Math.max(-supportDepth.min, ...itemDepths('back', rearAttachmentOffset))
    : Math.max(0, -supportDepth.min)

  const clearance = sideClearance(system.mountingType)
  const span = totalCentreWidth(plan)
  const centreX = system.placement.x + span / 2
  const centreZ = system.placement.z
  const angle = (system.placement.rotation * Math.PI) / 180

  const corners = [
    [-span / 2 - clearance, -backDepth],
    [span / 2 + clearance, -backDepth],
    [-span / 2 - clearance, frontDepth],
    [span / 2 + clearance, frontDepth],
  ].map(([x = 0, z = 0]) => ({
    x: centreX + x * Math.cos(angle) + z * Math.sin(angle),
    z: centreZ - x * Math.sin(angle) + z * Math.cos(angle),
  }))

  return Math.max(
    0,
    ...corners.flatMap((corner) => [
      -corner.x,
      corner.x - room.width,
      -corner.z,
      corner.z - room.depth,
    ]),
  )
}
