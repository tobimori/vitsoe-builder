import { expect, it } from 'vite-plus/test'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { dragPreviewBounds, makeDragGhost, showFit } from './drag'

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
  const ghost = makeDragGhost(assembly, ['host', 'accessory'], host)
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
  expect(ghost.children[1]!.position.x).toBeCloseTo(-0.1)
  expect(ghost.children[1]!.position.y).toBeCloseTo(0.2)
  expect((ghost.children[0] as Mesh).geometry).toBe(host.geometry)
  expect((ghost.children[0] as Mesh).material).toBe(material)
  showFit(ghost, false)
  expect((ghost.children[0] as Mesh).material).not.toBe(material)
  showFit(ghost, true)
  expect((ghost.children[0] as Mesh).material).toBe(material)
  expect(host.material).toBe(material)
  expect(host.position.toArray()).toEqual([1, 1, -0.059])
  expect(host.rotation.y).toBe(Math.PI)
  expect(accessory.position.toArray()).toEqual([1.1, 1.2, -0.2])
  expect(accessory.rotation.y).toBe(Math.PI)
  host.geometry.dispose()
  accessory.geometry.dispose()
  material.dispose()
})
