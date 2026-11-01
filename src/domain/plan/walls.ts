import { totalCentreWidth } from './system'
import type { Plan, Wall } from './types'

/** From the run's wall to the wall opposite. */
export function acrossRoom(plan: Plan) {
  const { wall } = plan.system.placement
  return wall === 'back' || wall === 'front' ? plan.room.depth : plan.room.width
}

/** The angle the front of a run along each wall faces, about the vertical from the back wall. */
const angles: Record<Wall, number> = { back: 0, left: 90, front: 180, right: 270 }

export function wallLength(plan: Plan, wall: Wall = plan.system.placement.wall) {
  return wall === 'back' || wall === 'front' ? plan.room.width : plan.room.depth
}

/**
 * Where the run stands, in room millimetres from the back-left corner with x to the right
 * and z to the front: the middle of its support line, and the angle its front faces.
 * A point at (x, z) in the run's own axes lies at
 * `(centre.x + x·cos + z·sin, centre.z − x·sin + z·cos)` in the room.
 */
export function runFrame(plan: Plan) {
  const { wall, offset, distance } = plan.system.placement
  const { width, depth } = plan.room
  const angle = angles[wall]
  const cos = Math.round(Math.cos((angle * Math.PI) / 180))
  const sin = Math.round(Math.sin((angle * Math.PI) / 180))
  const corner = {
    back: { x: 0, z: 0 },
    left: { x: 0, z: depth },
    front: { x: width, z: depth },
    right: { x: width, z: 0 },
  }[wall]
  const along = offset + totalCentreWidth(plan) / 2

  return {
    x: corner.x + cos * along + sin * distance,
    z: corner.z - sin * along + cos * distance,
    angle,
    cos,
    sin,
  }
}

/** Moves the run to another wall, centred on it, at the same distance from the wall. */
export function placeOnWall(plan: Plan, wall: Wall): Plan {
  const offset = Math.max(0, Math.round((wallLength(plan, wall) - totalCentreWidth(plan)) / 2))
  return {
    ...plan,
    system: { ...plan.system, placement: { ...plan.system.placement, wall, offset } },
  }
}
