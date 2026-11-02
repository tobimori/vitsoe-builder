import * as THREE from 'three'
import type { Face } from '../../domain/types'
import type { Point } from '../view/Dimension'
import { ownBounds } from './drag'

/** A measured space between two components, in metres within the run. */
export interface Gap {
  start: Point
  end: Point
  label: string
}

const down = new THREE.Vector3(0, -1, 0)

/** Where things stand on a component: the deck of a shelf, or the top of anything else. */
function standingHeight(object: THREE.Object3D, frame: THREE.Object3D, bounds: THREE.Box3) {
  const surfaces: THREE.Object3D[] = []
  object.traverse((child) => {
    if (child.userData.accessorySurface) surfaces.push(child)
  })
  if (surfaces.length === 0) return bounds.max.y

  // A shelf's raised lips and sides stand above its deck, so the deck is found by a ray
  const centre = bounds.getCenter(new THREE.Vector3())
  const origin = frame.localToWorld(new THREE.Vector3(centre.x, bounds.max.y + 0.1, centre.z))
  const hit = new THREE.Raycaster(origin, down).intersectObjects(surfaces, false)[0]
  return hit ? frame.worldToLocal(hit.point.clone()).y : bounds.max.y
}

const label = (metres: number) => `${Math.round(metres * 1000)} mm`

/**
 * The clear space between two components, as Figma measures between layers: the height
 * between them where one stands above the other, and the gap between their sides where
 * they stand side by side. Lines are drawn in front of the given face.
 */
export function gapsBetween(
  a: THREE.Object3D,
  b: THREE.Object3D,
  frame: THREE.Object3D,
  face: Face,
): Gap[] {
  const boxA = ownBounds(a, frame)
  const boxB = ownBounds(b, frame)
  const [lower, upper] =
    boxA.getCenter(new THREE.Vector3()).y <= boxB.getCenter(new THREE.Vector3()).y
      ? [
          { object: a, box: boxA },
          { object: b, box: boxB },
        ]
      : [
          { object: b, box: boxB },
          { object: a, box: boxA },
        ]
  const [left, right] = boxA.min.x <= boxB.min.x ? [boxA, boxB] : [boxB, boxA]

  const z =
    face === 'front'
      ? Math.max(boxA.max.z, boxB.max.z) + 0.04
      : Math.min(boxA.min.z, boxB.min.z) - 0.04
  const overlapsAcross = left.max.x > right.min.x
  const overlapsUp = lower.box.max.y > upper.box.min.y
  const gaps: Gap[] = []

  const floor = standingHeight(lower.object, frame, lower.box)
  if (upper.box.min.y > floor) {
    const x = overlapsAcross
      ? (Math.max(left.min.x, right.min.x) + Math.min(left.max.x, right.max.x)) / 2
      : (left.max.x + right.min.x) / 2
    gaps.push({
      start: [x, floor, z],
      end: [x, upper.box.min.y, z],
      label: label(upper.box.min.y - floor),
    })
  }

  if (!overlapsAcross) {
    const y = overlapsUp
      ? (Math.max(lower.box.min.y, upper.box.min.y) + Math.min(lower.box.max.y, upper.box.max.y)) /
        2
      : upper.box.min.y
    gaps.push({
      start: [left.max.x, y, z],
      end: [right.min.x, y, z],
      label: label(right.min.x - left.max.x),
    })
  }

  return gaps
}
