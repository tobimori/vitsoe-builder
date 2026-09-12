import { describe, expect, it } from 'vite-plus/test'
import * as THREE from 'three'
import { presentationScene } from '../src/scene/SceneRenderer'
import { plate, roundedShape } from '../src/scene/primitives'
import { studioEnvironmentTexture } from '../src/scene/environment'

function expectMatrixClose(actual: THREE.Matrix4, expected: THREE.Matrix4) {
  actual.elements.forEach((value, index) => {
    expect(value).toBeCloseTo(expected.elements[index], 6)
  })
}

describe('presentation scene snapshot', () => {
  it('preserves nested mesh world transforms and shares render resources without mutating source', () => {
    const source = new THREE.Scene()
    const outer = new THREE.Group()
    outer.position.set(1.3, 0.4, -2.1)
    outer.rotation.set(0.2, -0.7, 0.1)
    outer.scale.setScalar(1.4)
    const inner = new THREE.Group()
    inner.position.set(-0.3, 1.1, 0.8)
    inner.rotation.set(-0.4, 0.25, 0.15)
    inner.scale.setScalar(0.75)
    const geometry = new THREE.BoxGeometry(0.9, 0.12, 0.36)
    const material = new THREE.MeshStandardMaterial({ color: '#222222' })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(0.45, -0.15, 0.2)
    mesh.rotation.set(0.35, 0.1, -0.2)
    mesh.scale.set(1.2, 0.8, 1.6)
    source.add(outer)
    outer.add(inner)
    inner.add(mesh)
    source.updateMatrixWorld(true)

    const originalWorld = mesh.matrixWorld.clone()
    const originalPosition = mesh.position.clone()
    const originalQuaternion = mesh.quaternion.clone()
    const originalScale = mesh.scale.clone()
    const result = presentationScene(source)
    const copy = result.children.find(
      (object): object is THREE.Mesh => object instanceof THREE.Mesh,
    )

    expect(copy).toBeDefined()
    expect(copy?.geometry).toBe(geometry)
    expect(copy?.material).toBe(material)
    expectMatrixClose(copy!.matrixWorld, originalWorld)
    expect(mesh.parent).toBe(inner)
    expect(mesh.position).toEqual(originalPosition)
    expect(mesh.quaternion.angleTo(originalQuaternion)).toBeLessThan(1e-6)
    expect(mesh.scale).toEqual(originalScale)
    expect(source.children).toEqual([outer])
  })

  it('excludes invisible branches, line guides and transient drag previews', () => {
    const source = new THREE.Scene()
    const visibleGeometry = new THREE.BoxGeometry(1, 1, 1)
    const visible = new THREE.Mesh(visibleGeometry, new THREE.MeshStandardMaterial())
    const hidden = new THREE.Group()
    hidden.visible = false
    hidden.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()))
    const dragPreview = new THREE.Group()
    dragPreview.userData.dragPreview = true
    dragPreview.add(
      new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()),
    )
    const guide = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]),
      new THREE.LineBasicMaterial(),
    )
    source.add(visible, hidden, dragPreview, guide, new THREE.GridHelper())

    const result = presentationScene(source)
    const meshes = result.children.filter((object) => object instanceof THREE.Mesh)

    expect(meshes).toHaveLength(1)
    expect((meshes[0] as THREE.Mesh).geometry).toBe(visibleGeometry)
    expect(result.children.some((object) => object instanceof THREE.Line)).toBe(false)
    expect(result.children.some((object) => object.userData.dragPreview)).toBe(false)
    expect(hidden.children).toHaveLength(1)
    expect(dragPreview.children).toHaveLength(1)
  })

  it('uses the presentation environment and translates visible key lights without helpers', () => {
    const source = new THREE.Scene()
    const background = new THREE.Color('#ecebe5')
    source.background = background
    source.environment = new THREE.Texture()
    source.environmentIntensity = 0.8

    const key = new THREE.DirectionalLight('#fff8ed', 2)
    key.name = 'Studio window key'
    key.position.set(-2, 4, 3)
    key.target.position.set(0.5, 1, -0.25)
    const fill = new THREE.DirectionalLight('#dce6ff', 1)
    fill.position.set(3, 2, -1)
    fill.target.position.set(-0.5, 0.8, 0.2)
    source.add(key, key.target, fill, fill.target, new THREE.AxesHelper())
    source.updateMatrixWorld(true)

    const result = presentationScene(source)
    const lights = result.children.filter(
      (object): object is THREE.RectAreaLight => object instanceof THREE.RectAreaLight,
    )

    expect(result.background).toBe(background)
    expect(result.environment).toBe(studioEnvironmentTexture())
    expect(result.environment).not.toBe(source.environment)
    expect(result.environmentIntensity).toBe(source.environmentIntensity)
    expect(lights).toHaveLength(2)
    expect(lights.map((light) => light.position.toArray())).toEqual([
      key.getWorldPosition(new THREE.Vector3()).toArray(),
      fill.getWorldPosition(new THREE.Vector3()).toArray(),
    ])
    expect(result.children.some((object) => object instanceof THREE.DirectionalLight)).toBe(false)
    expect(result.children.some((object) => object instanceof THREE.AxesHelper)).toBe(false)
  })
})

it('softens board edges without changing the physical envelope or thin steel plates', () => {
  const shape = roundedShape(0.655, 0.36, 0.004)
  const material = new THREE.MeshStandardMaterial()
  const sharp = plate(shape, 0.019, material)
  const softened = plate(shape, 0.019, material, 0.00035)
  sharp.geometry.computeBoundingBox()
  softened.geometry.computeBoundingBox()

  for (const corner of ['min', 'max'] as const) {
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(softened.geometry.boundingBox![corner][axis]).toBeCloseTo(
        sharp.geometry.boundingBox![corner][axis],
        6,
      )
    }
  }
  expect(softened.geometry.getAttribute('position').count).toBeGreaterThan(
    sharp.geometry.getAttribute('position').count,
  )
  const steel = plate(shape, 0.0016, material)
  expect((steel.geometry as THREE.ExtrudeGeometry).parameters.options.bevelEnabled).toBe(false)
})
