import { describe, expect, it } from 'vite-plus/test'
import * as THREE from 'three'
import { catalog } from '../src/data/catalog'
import type { BuilderDocument, PlacedItem } from '../src/domain/types'
import { decorLayout, decorSurface } from '../src/domain/decor'
import { buildAssembly, disposeAssembly } from '../src/scene/geometry'
import { decorVolume } from '../src/scene/decor'

function configuration(item: PlacedItem): BuilderDocument {
  return {
    version: 1,
    name: 'Decor test',
    room: { width: 4200, depth: 3600, ceilingHeight: 2600, showDimensions: false },
    system: {
      mountingType: 'freestanding',
      bays: [{ id: 'bay', centreWidth: 912 }],
      items: [item],
      placement: { x: 700, z: 1200, rotation: 90 },
      railHeight: 2000,
      mountHeight: 345,
    },
  }
}

describe('shelf decor geometry', () => {
  it('models cover overhang and inset pages within the exact shared volume', () => {
    for (const kind of ['vinyl', 'art-books'] as const) {
      const size = { thickness: kind === 'vinyl' ? 4 : 18, width: 210, height: 260 }
      const volume = decorVolume(kind, 0, size, 'Reference title')
      const bounds = new THREE.Box3().setFromObject(volume)
      const extent = bounds.getSize(new THREE.Vector3())
      expect(extent.x).toBeCloseTo(size.thickness / 1000, 6)
      expect(extent.y).toBeCloseTo(size.height / 1000, 6)
      expect(extent.z).toBeCloseTo(size.width / 1000, 6)
      const pages = volume.getObjectByName(
        kind === 'vinyl' ? 'Recessed inner record sleeve' : 'Recessed page block',
      )!
      const pageBounds = new THREE.Box3().setFromObject(pages)
      expect(pageBounds.max.y).toBeLessThan(bounds.max.y)
      expect(pageBounds.min.y).toBeGreaterThan(bounds.min.y)
      expect(pageBounds.min.z).toBeGreaterThan(bounds.min.z)
    }
  })

  it('seats decor on decks rather than side lips on both faces and reversed hosts', () => {
    for (const productId of [
      'shelf',
      'wood-shelf',
      'double-shelf',
      'desk-shelf',
      'shelf-with-drawer',
      'table',
    ]) {
      const product = catalog.find((entry) => entry.id === productId)!
      const variant = product.variants.find((entry) => entry.depth >= 220)!
      for (const face of ['front', 'back'] as const) {
        for (const orientation of productId === 'shelf-with-drawer' || productId === 'table'
          ? (['standard'] as const)
          : (['standard', 'inverted'] as const)) {
          const item: PlacedItem = {
            id: 'decor-host',
            productId,
            variantId: variant.id,
            bayIndex: 0,
            height: productId === 'table' ? 740 : 1255,
            face,
            orientation,
            finish: 'off-white',
            decor: { kind: 'art-books', arrangement: 'upright', count: 3, position: 'left' },
          }
          const assembly = buildAssembly(configuration(item), catalog)
          const host = assembly.children.find((child) => child.userData.itemId === item.id)!
          const decor = host.getObjectByName('Shelf decor')!
          expect(decor, `${productId} ${orientation} ${face}`).toBeDefined()
          const surface = decorSurface(item, variant)
          expect(decor.position.y).toBeCloseTo((surface.elevation - item.height) / 1000, 4)
          const layout = decorLayout(item.decor!, surface.width)
          expect(decor.children).toHaveLength(3)
          const first = decor.children[0]
          expect(first.position.x).toBeCloseTo(layout.objects[0].x / 1000, 6)
          expect(first.position.z).toBeCloseTo(layout.objects[0].z / 1000, 6)
          decor.traverse((object) => expect(object.userData.itemId).toBe(item.id))
          assembly.traverse((object) => {
            if (object instanceof THREE.Mesh) expect(Array.isArray(object.material)).toBe(false)
          })
          disposeAssembly(assembly)
        }
      }
    }
  })
})

it('keeps stacked covers uppermost and their footprint aligned with shared placement', () => {
  const volume = decorVolume('art-books', 1, { thickness: 14, height: 260, width: 210 }, 'EAMES')
  volume.rotation.z = Math.PI / 2
  volume.position.y = 0.007
  volume.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(volume)
  expect(bounds.min.y).toBeCloseTo(0, 6)
  expect(bounds.max.y).toBeCloseTo(0.014, 6)
  const size = bounds.getSize(new THREE.Vector3())
  expect(size.x).toBeCloseTo(0.26, 6)
  expect(size.z).toBeCloseTo(0.21, 6)
  const boards = volume.children.filter((child) => child.name === 'Printed hardcover board')
  const frontCover = boards[1] as THREE.Mesh
  expect(frontCover.getWorldPosition(new THREE.Vector3()).y).toBeGreaterThan(0.007)
  const spine = volume.getObjectByName('Bound book spine')!
  expect(spine.getWorldPosition(new THREE.Vector3()).z).toBeGreaterThan(0.1)
})

it('assigns artwork only to the cover exterior and spine front using single-material triangles', () => {
  const cover = new THREE.MeshStandardMaterial({ name: 'Test cover' })
  const volume = decorVolume(
    'art-books',
    0,
    { thickness: 14, height: 260, width: 210 },
    'BAUHAUS',
    cover,
  )
  const covers: THREE.Mesh[] = []
  let triangleCount = 0
  volume.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    expect(Array.isArray(object.material)).toBe(false)
    triangleCount += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3
    if (object.material === cover) covers.push(object)
  })
  expect(triangleCount).toBe(48) // Four closed boxes; no duplicated surface overlays.
  expect(covers).toHaveLength(1)
  const coverNormals = covers[0].geometry.getAttribute('normal')
  for (let index = 0; index < coverNormals.count; index++) {
    expect(coverNormals.getX(index)).toBe(1)
  }
  const binding = volume.getObjectByName('Bound book spine')!
  const printed = binding.children.find((object) => {
    const mesh = object as THREE.Mesh
    const normals = mesh.geometry.getAttribute('normal')
    return Array.from({ length: normals.count }, (_, i) => normals.getZ(i)).every((z) => z === 1)
  }) as THREE.Mesh
  expect(printed).toBeDefined()
  expect(printed.geometry.getAttribute('position').count).toBe(6)
})
