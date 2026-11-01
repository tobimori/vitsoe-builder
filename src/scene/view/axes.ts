import * as THREE from 'three'
import type { Plan } from '../../domain/plan/types'
import { runFrame } from '../../domain/plan/walls'
import type { Face } from '../../domain/types'
import { mm } from '../models/primitives'

export const up = new THREE.Vector3(0, 1, 0)

/** The run's centre on the floor and the direction its front face looks. */
export function runAxes(plan: Plan) {
  const frame = runFrame(plan)
  const rotation = THREE.MathUtils.degToRad(frame.angle)
  return {
    centre: new THREE.Vector3(mm(frame.x), 0, mm(frame.z)),
    front: new THREE.Vector3(0, 0, 1).applyAxisAngle(up, rotation),
    rotation,
  }
}

/** The direction a face of the run looks, towards the viewer of that face. */
export function faceDirection(plan: Plan, face: Face) {
  const { front } = runAxes(plan)
  return face === 'back' ? front.negate() : front
}
