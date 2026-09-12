import * as THREE from 'three'
import type { Face } from '../domain/types'

export function faceTargetScreen(
  start: THREE.Vector2,
  projected: THREE.Vector2,
  viewportLeft: number,
  viewportWidth: number,
) {
  const gesture = projectedFaceGesture(start, projected, start, 'front', 'front')
  if (gesture.enabled) return projected.clone()

  // Only the affordance moves sideways when a frontal camera overlaps the faces.
  const middle = viewportLeft + viewportWidth / 2
  const sign = start.x > middle ? -1 : 1
  return new THREE.Vector2(
    start.x + sign * 80,
    start.y + THREE.MathUtils.clamp(projected.y - start.y, -24, 24),
  )
}

// Only a deliberate pass through the opposite-side target changes face.
// A largely vertical or overlapping projection is ambiguous: use the side buttons.
export function projectedFaceGesture(
  start: THREE.Vector2,
  destination: THREE.Vector2,
  pointer: THREE.Vector2,
  originFace: Face,
  currentFace: Face,
) {
  const direction = destination.clone().sub(start)
  const distance = direction.length()
  const enabled = distance >= 56 && Math.abs(direction.x) >= Math.max(36, distance * 0.4)
  if (!enabled) return { face: currentFace, depthGesture: false, enabled }

  direction.divideScalar(distance)
  const motion = pointer.clone().sub(start)
  const progress = motion.dot(direction) / distance
  const perpendicular = Math.abs(motion.x * direction.y - motion.y * direction.x)
  const depthGesture = perpendicular < 24 && progress > 0.15 && progress < 1.4
  let face = currentFace
  if (pointer.distanceTo(destination) < 24) face = originFace === 'front' ? 'back' : 'front'
  else if (pointer.distanceTo(start) < 14) face = originFace

  return { face, depthGesture, enabled }
}

export function makeDragGhost(assembly: THREE.Group, itemIds: string[], origin: THREE.Object3D) {
  const ghost = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({
    color: '#0076ad',
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    // Destination previews remain legible when crossing behind opaque furniture.
    depthTest: false,
  })
  origin.updateMatrixWorld(true)
  const inverse = origin.matrix.clone().invert()
  for (const object of assembly.children) {
    if (!itemIds.includes(object.userData.itemId as string)) continue
    const copy = object.clone(true)
    copy.matrix.copy(inverse).multiply(object.matrix)
    copy.matrix.decompose(copy.position, copy.quaternion, copy.scale)
    copy.traverse((child) => {
      child.raycast = () => {}
      if (child instanceof THREE.Mesh) {
        child.material = material
        child.renderOrder = 1000
        child.castShadow = false
        child.receiveShadow = false
      }
    })
    ghost.add(copy)
  }
  ghost.position.copy(origin.position)
  ghost.quaternion.copy(origin.quaternion)
  return { ghost, material }
}

// Bounds in the ghost's own axes, so room yaw and the selected face do not
// inflate dimensions. Only the selected component is measured, not accessories.
export function dragPreviewBounds(ghost: THREE.Group, itemId: string) {
  ghost.updateWorldMatrix(true, true)
  const inverse = ghost.matrixWorld.clone().invert()
  const bounds = new THREE.Box3()
  for (const child of ghost.children) {
    if (child.userData.itemId !== itemId) continue
    child.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox()
      if (!object.geometry.boundingBox) return
      const transform = inverse.clone().multiply(object.matrixWorld)
      bounds.union(object.geometry.boundingBox.clone().applyMatrix4(transform))
    })
  }
  return bounds
}
