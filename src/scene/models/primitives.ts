import * as THREE from 'three'

export const mm = (value: number) => value / 1000

export function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  if (material instanceof THREE.MeshStandardMaterial && material.roughnessMap && !material.map) {
    const position = geometry.getAttribute('position')
    const normal = geometry.getAttribute('normal')
    const uv = new Float32Array(position.count * 2)

    for (let index = 0; index < position.count; index++) {
      const nx = Math.abs(normal.getX(index))
      const ny = Math.abs(normal.getY(index))
      const nz = Math.abs(normal.getZ(index))
      // Planar coordinates in metres keep finish grain the same size on boxes
      // and extrusions. Surfaces with colour maps keep their existing image UVs.
      const side = nx > ny && nx > nz
      const top = ny > nz && !side
      uv[index * 2] = side ? position.getZ(index) : position.getX(index)
      uv[index * 2 + 1] = top ? position.getZ(index) : position.getY(index)
    }

    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  }

  const object = new THREE.Mesh(geometry, material)
  object.position.set(x, y, z)
  object.castShadow = true
  object.receiveShadow = true
  return object
}

export function box(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  return mesh(new THREE.BoxGeometry(width, height, depth), material, x, y, z)
}

export function roundedShape(width: number, height: number, radius: number) {
  const x = -width / 2
  const y = -height / 2
  const r = Math.min(radius, width / 2, height / 2)
  const shape = new THREE.Shape()
  shape.moveTo(x + r, y)
  shape.lineTo(x + width - r, y)
  shape.quadraticCurveTo(x + width, y, x + width, y + r)
  shape.lineTo(x + width, y + height - r)
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  shape.lineTo(x + r, y + height)
  shape.quadraticCurveTo(x, y + height, x, y + height - r)
  shape.lineTo(x, y + r)
  shape.quadraticCurveTo(x, y, x + r, y)
  return shape
}

export function plate(
  shape: THREE.Shape,
  thickness: number,
  material: THREE.Material,
  edgeRadius = 0,
) {
  const radius = Math.min(edgeRadius, thickness / 3)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness - 2 * radius,
    bevelEnabled: radius > 0,
    bevelSize: radius,
    bevelThickness: radius,
    bevelSegments: 2,
    curveSegments: 12,
  })
  geometry.translate(0, 0, -thickness / 2 + radius)

  if (radius > 0) {
    // Extrusion bevels grow outside the outline. Restore its exact envelope,
    // including the rear mounting relief, rather than enlarging the component.
    const outline = new THREE.Box2().setFromPoints(shape.getPoints(12))
    geometry.computeBoundingBox()
    const bounds = geometry.boundingBox!
    const scaleX = (outline.max.x - outline.min.x) / (bounds.max.x - bounds.min.x)
    const scaleY = (outline.max.y - outline.min.y) / (bounds.max.y - bounds.min.y)
    const offsetX = outline.min.x - bounds.min.x * scaleX
    const offsetY = outline.min.y - bounds.min.y * scaleY
    geometry.scale(scaleX, scaleY, 1)
    geometry.translate(offsetX, offsetY, 0)
  }

  return mesh(geometry, material)
}

export function roundedBox(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  radius = 0.003,
) {
  const r = Math.min(radius, width / 3, height / 3, depth / 3)
  const shape = roundedShape(width - 2 * r, height - 2 * r, r)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0001, depth - 2 * r),
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: r,
    bevelThickness: r,
    curveSegments: 8,
  })
  geometry.translate(0, 0, -depth / 2 + r)
  return mesh(geometry, material)
}

export function cylinder(
  radius: number,
  height: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  segments = 24,
) {
  return mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material, x, y, z)
}

export function rodBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
) {
  const rod = cylinder(radius, start.distanceTo(end), material)
  rod.position.copy(start).add(end).multiplyScalar(0.5)
  rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize())
  return rod
}
