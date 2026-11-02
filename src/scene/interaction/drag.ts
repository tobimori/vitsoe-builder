import * as THREE from 'three'
import { isInkLine } from '../drawing/lines'
import type { Face } from '../../domain/types'

const misfit = new THREE.MeshBasicMaterial({
  color: '#c4161c',
  transparent: true,
  opacity: 0.4,
  depthWrite: false,
})

const ownMaterials = new WeakMap<THREE.Mesh, THREE.Mesh['material']>()

/** Shows a ghost in its own materials, or in translucent red where it does not fit. */
export function showFit(ghost: THREE.Object3D, fits: boolean) {
  ghost.traverse((child) => {
    // The drawing's lines stay as they are and outline the ghost
    if (!(child instanceof THREE.Mesh) || isInkLine(child)) return
    if (!ownMaterials.has(child)) ownMaterials.set(child, child.material)
    child.material = fits ? (ownMaterials.get(child) ?? child.material) : misfit
  })
}

export function setVisible(objects: THREE.Object3D[], visible: boolean) {
  for (const object of objects) object.visible = visible
}

/** A copy of the components that travel with a dragged one, posed relative to `origin`. */
export function makeDragGhost(assembly: THREE.Group, itemIds: string[], origin: THREE.Object3D) {
  const ghost = new THREE.Group()
  ghost.userData.dragPreview = true
  origin.updateMatrixWorld(true)
  const inverse = origin.matrix.clone().invert()
  for (const object of assembly.children) {
    if (!itemIds.includes(object.userData.itemId as string)) continue
    const copy = object.clone(true)
    copy.matrix.copy(inverse).multiply(object.matrix)
    copy.matrix.decompose(copy.position, copy.quaternion, copy.scale)
    copy.traverse((child) => {
      child.raycast = () => {}
    })
    ghost.add(copy)
  }
  ghost.position.copy(origin.position)
  // Copying the quaternion would turn a back face's half turn into (π, 0, π)
  ghost.rotation.copy(origin.rotation)
  return ghost
}

/** Bounds of an object's meshes in the axes of `frame`, so room yaw and the face do not inflate them. */
export function ownBounds(object: THREE.Object3D, frame: THREE.Object3D = object) {
  frame.updateWorldMatrix(true, true)
  object.updateWorldMatrix(true, true)
  const inverse = frame.matrixWorld.clone().invert()
  const bounds = new THREE.Box3()
  const visit = (child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && !isInkLine(child)) {
      if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
      const transform = inverse.clone().multiply(child.matrixWorld)
      if (child.geometry.boundingBox)
        bounds.union(child.geometry.boundingBox.clone().applyMatrix4(transform))
    }
    child.children.forEach(visit)
  }
  visit(object)
  return bounds
}

export function dragPreviewBounds(ghost: THREE.Group, itemId: string) {
  const bounds = new THREE.Box3()
  for (const child of ghost.children)
    if (child.userData.itemId === itemId) bounds.union(ownBounds(child, ghost))
  return bounds
}

/** The face button under the pointer, which overrides the face during a drag. */
export function faceUnderPointer(clientX: number, clientY: number): Face | undefined {
  const face = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-drop-face]')
    ?.dataset.dropFace
  return face === 'front' || face === 'back' ? face : undefined
}
