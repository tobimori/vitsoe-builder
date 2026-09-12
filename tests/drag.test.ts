import { describe, expect, it } from 'vite-plus/test'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector2 } from 'three'
import {
  dragPreviewBounds,
  faceTargetScreen,
  makeDragGhost,
  projectedFaceGesture,
} from '../src/scene/drag'

describe('cross-face drag intent', () => {
  const start = new Vector2(100, 100)
  const back = new Vector2(200, 120)

  it('requires entering the opposite target and keeps the chosen face outside it', () => {
    expect(projectedFaceGesture(start, back, new Vector2(145, 109), 'front', 'front').face).toBe(
      'front',
    )
    expect(projectedFaceGesture(start, back, new Vector2(195, 120), 'front', 'front').face).toBe(
      'back',
    )
    expect(projectedFaceGesture(start, back, new Vector2(150, 180), 'front', 'back').face).toBe(
      'back',
    )
    expect(projectedFaceGesture(start, back, new Vector2(108, 101), 'front', 'back').face).toBe(
      'front',
    )
  })

  it('does not interpret vertical motion or nearly overlapping faces as depth', () => {
    const vertical = projectedFaceGesture(
      start,
      new Vector2(108, 200),
      new Vector2(108, 200),
      'front',
      'front',
    )
    expect(vertical).toEqual({ face: 'front', depthGesture: false, enabled: false })
    expect(
      projectedFaceGesture(start, new Vector2(135, 100), new Vector2(135, 100), 'front', 'front')
        .enabled,
    ).toBe(false)
    expect(
      projectedFaceGesture(start, back, new Vector2(100, 240), 'front', 'front').depthGesture,
    ).toBe(false)
  })

  it('exposes an accessible target when the default camera overlaps the faces', () => {
    const target = faceTargetScreen(start, new Vector2(103, 116), 0, 600)
    expect(target.x).toBe(180)
    expect(projectedFaceGesture(start, target, target, 'front', 'front').face).toBe('back')
    const nearRight = new Vector2(575, 100)
    expect(faceTargetScreen(nearRight, new Vector2(576, 102), 0, 600).x).toBe(495)
  })

  it('works symmetrically when dragging from the back', () => {
    expect(projectedFaceGesture(back, start, start, 'back', 'back').face).toBe('front')
  })
})

it('previews a host and accessory together without changing their source geometry or transforms', () => {
  const assembly = new Group()
  const material = new MeshStandardMaterial()
  const host = new Mesh(new BoxGeometry(1, 0.1, 0.3), material)
  host.userData.itemId = 'host'
  host.position.set(1, 1, -0.059)
  host.rotation.y = Math.PI
  const accessory = new Mesh(new BoxGeometry(0.1, 0.2, 0.1), material)
  accessory.userData.itemId = 'accessory'
  accessory.position.set(1.1, 1.2, -0.2)
  accessory.rotation.y = Math.PI
  assembly.add(host, accessory)
  assembly.updateMatrixWorld(true)
  const { ghost, material: ghostMaterial } = makeDragGhost(assembly, ['host', 'accessory'], host)
  ghost.position.set(2, 1.5, 0.011)
  ghost.rotation.y = 0
  ghost.updateMatrixWorld(true)
  const roomPlacement = new Group()
  roomPlacement.rotation.y = 0.73
  roomPlacement.position.set(4, 0, 2)
  roomPlacement.add(ghost)
  const bounds = dragPreviewBounds(ghost, 'host')
  expect(bounds.max.x - bounds.min.x).toBeCloseTo(1, 6)
  expect(bounds.max.y - bounds.min.y).toBeCloseTo(0.1, 6)
  expect(bounds.max.z - bounds.min.z).toBeCloseTo(0.3, 6)
  expect(ghost.children).toHaveLength(2)
  expect(ghost.children[1].position.x).toBeCloseTo(-0.1)
  expect(ghost.children[1].position.y).toBeCloseTo(0.2)
  expect((ghost.children[0] as Mesh).geometry).toBe(host.geometry)
  expect(ghostMaterial.depthTest).toBe(false)
  expect(ghostMaterial.depthWrite).toBe(false)
  for (const child of ghost.children) expect(child.renderOrder).toBe(1000)
  expect(material.depthTest).toBe(true)
  expect(material.depthWrite).toBe(true)
  expect(host.renderOrder).toBe(0)
  expect(accessory.renderOrder).toBe(0)
  expect(host.material).toBe(material)
  expect(host.position.toArray()).toEqual([1, 1, -0.059])
  expect(host.rotation.y).toBe(Math.PI)
  expect(accessory.position.toArray()).toEqual([1.1, 1.2, -0.2])
  expect(accessory.rotation.y).toBe(Math.PI)
  ghostMaterial.dispose()
  host.geometry.dispose()
  accessory.geometry.dispose()
  material.dispose()
})
