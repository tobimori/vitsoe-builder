import * as THREE from 'three'
import type { PlacedItem, ProductVariant } from '../domain/types'
import { decorLayout, decorSurface, isDecorHost } from '../domain/decor'
import { mm } from './primitives'

const colours = ['#ded7c6', '#313d48', '#a34536', '#bebdb0', '#425950', '#bf9f54']
const materials = new Map<string, THREE.MeshStandardMaterial>()
const bookTitles = ['BAUHAUS', 'EAMES', 'KANDINSKY']
const bookCovers = ['bauhaus', 'eames', 'kandinsky']
const textureLoads: Promise<void>[] = []
const textureListeners = new Set<() => void>()

export function onDecorTexturesLoaded(listener: () => void) {
  textureListeners.add(listener)
  return () => {
    textureListeners.delete(listener)
  }
}

export async function decorTexturesReady() {
  await Promise.all(textureLoads)
}

function bookCover(index: number) {
  const title = bookCovers[index % bookCovers.length]
  const key = `Decor · TASCHEN ${title} cover`
  const cached = materials.get(key)
  if (cached) return cached
  const material = new THREE.MeshStandardMaterial({ color: '#efefeb', roughness: 0.64 })
  materials.set(key, material)
  if (typeof window === 'undefined') return material

  textureLoads.push(
    new Promise<void>((resolve) => {
      let settled = false
      const finish = () => {
        settled = true
        clearTimeout(timeout)
        resolve()
      }
      const timeout = setTimeout(finish, 10_000)
      new THREE.TextureLoader().load(
        `/decor/${title}.webp`,
        (texture) => {
          if (settled) {
            texture.dispose()
            return
          }
          texture.colorSpace = THREE.SRGBColorSpace
          texture.anisotropy = 8
          texture.name = key
          // Publisher view is nearly frontal. Exclude its photographed spine and shadow.
          texture.offset.set(0.028, 0.044)
          texture.repeat.set(0.916, 0.955)
          material.map = texture
          material.color.set('#ffffff')
          material.needsUpdate = true
          textureListeners.forEach((listener) => listener())
          finish()
        },
        undefined,
        finish,
      )
    }),
  )
  return material
}

const bookBoard = new THREE.MeshStandardMaterial({ color: '#eae9e3', roughness: 0.7 })

function printedMaterial(
  key: string,
  draw: (context: CanvasRenderingContext2D) => void,
  width = 512,
  height = 512,
) {
  const cached = materials.get(key)
  if (cached) return cached

  let map: THREE.CanvasTexture | null = null
  if (typeof window !== 'undefined') {
    const canvas = window.document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (context) {
      draw(context)
      map = new THREE.CanvasTexture(canvas)
      map.colorSpace = THREE.SRGBColorSpace
      map.anisotropy = 8
      map.name = key
    }
  }

  const material = new THREE.MeshStandardMaterial({
    color: map ? '#ffffff' : '#c9c3b4',
    map,
    roughness: 0.73,
  })
  materials.set(key, material)
  return material
}

function paperMaterial() {
  return printedMaterial('Decor · fine paper edges', (context) => {
    context.fillStyle = '#dedace'
    context.fillRect(0, 0, 512, 512)
    // Subpixel page lines mipmap away in the full room view.
    for (let x = 0; x < 512; x += 3) {
      context.fillStyle = x % 9 === 0 ? '#ccc7b9' : '#d6d1c4'
      context.fillRect(x, 0, 1, 512)
    }
  })
}

function spineMaterial(index: number, vinyl: boolean, title: string) {
  const width = vinyl ? 32 : 64
  return printedMaterial(
    `Decor · ${vinyl ? 'record' : 'book'} spine ${index}`,
    (context) => {
      context.fillStyle = vinyl ? colours[index % colours.length] : '#eeeee9'
      context.fillRect(0, 0, width, 1024)
      context.fillStyle =
        vinyl && (index % colours.length === 1 || index % colours.length === 4)
          ? '#e7e4dc'
          : '#252624'
      context.save()
      context.translate(width / 2, 130)
      context.rotate(Math.PI / 2)
      context.font = `500 ${vinyl ? 13 : 26}px Arial`
      context.fillText(title, 0, 0, 650)
      context.restore()
      context.save()
      context.translate(width / 2, 865)
      context.rotate(Math.PI / 2)
      context.font = `bold ${vinyl ? 11 : 18}px Arial`
      context.fillText(vinyl ? 'LP 33⅓' : 'TASCHEN', 0, 0, 130)
      context.restore()
    },
    width,
    1024,
  )
}

function sleeveMaterial(index: number) {
  return printedMaterial(`Decor · record sleeve ${index}`, (context) => {
    context.fillStyle = colours[index % colours.length]
    context.fillRect(0, 0, 512, 512)
    // Original restrained sleeve artwork, rather than a copied album cover.
    context.fillStyle = colours[(index + 2) % colours.length]
    context.beginPath()
    context.arc(290, 265, 172, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#ded8c8'
    context.fillRect(56, 78, 152, 302)
    context.fillStyle = '#303330'
    context.font = '24px Arial'
    context.fillText(['STUDIES', 'SESSIONS', 'NOCTURNES', 'FORMS'][index % 4], 35, 455)
    context.font = '12px Arial'
    context.fillText(`STEREO     33⅓ RPM     ${String(index + 1).padStart(2, '0')}`, 35, 480)
  })
}

function part(
  group: THREE.Group,
  width: number,
  height: number,
  depth: number,
  material: THREE.Material | THREE.Material[],
  x = 0,
  y = 0,
  z = 0,
) {
  const geometry = new THREE.BoxGeometry(width, height, depth)
  const object = new THREE.Group()
  object.position.set(x, y, z)

  if (Array.isArray(material)) {
    // The tracer merges one material per mesh. Partition the existing box
    // triangles by their finish, without adding coplanar printed overlays.
    for (const finish of new Set(material)) {
      const vertices: number[] = []
      for (const face of geometry.groups) {
        if (material[face.materialIndex!] !== finish) continue
        for (let i = face.start; i < face.start + face.count; i++) {
          vertices.push(geometry.index!.getX(i))
        }
      }
      const surface = new THREE.BufferGeometry()
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        const values = new Float32Array(vertices.length * attribute.itemSize)
        vertices.forEach((vertex, index) => {
          for (let component = 0; component < attribute.itemSize; component++) {
            values[index * attribute.itemSize + component] =
              attribute.array[vertex * attribute.itemSize + component]
          }
        })
        surface.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize))
      }
      object.add(new THREE.Mesh(surface, finish))
    }
    geometry.dispose()
  } else object.add(new THREE.Mesh(geometry, material))

  object.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = child.receiveShadow = true
  })
  group.add(object)
  return object
}

/** Centred upright volume: thickness across X, spine facing the shelf front (+Z). */
export function decorVolume(
  kind: 'vinyl' | 'art-books',
  index: number,
  dimensions: { thickness: number; height: number; width: number },
  title: string,
  cover?: THREE.Material,
) {
  index %= colours.length
  const group = new THREE.Group()
  const thickness = mm(dimensions.thickness)
  const height = mm(dimensions.height)
  const depth = mm(dimensions.width)
  const vinyl = kind === 'vinyl'
  const board = vinyl ? 0.00045 : 0.0018
  const page = vinyl ? bookBoard : paperMaterial()
  const artwork = cover ?? (vinyl ? sleeveMaterial(index) : bookCover(index))
  const spine = spineMaterial(index, vinyl, title)
  const edge = vinyl ? 0.0007 : 0.003

  for (const sign of [-1, 1]) {
    const boardMaterial = vinyl
      ? artwork
      : sign === 1
        ? [artwork, bookBoard, bookBoard, bookBoard, bookBoard, bookBoard]
        : bookBoard
    const panel = part(group, board, height, depth, boardMaterial, (sign * (thickness - board)) / 2)
    panel.name = vinyl ? 'Printed record sleeve' : 'Printed hardcover board'
  }
  const block = part(
    group,
    thickness - board * 2,
    height - edge * 2,
    depth - edge * 2,
    page,
    0,
    0,
    -edge / 2,
  )
  block.name = vinyl ? 'Recessed inner record sleeve' : 'Recessed page block'
  const binding = part(
    group,
    thickness - board * 2,
    height,
    board,
    [
      vinyl ? artwork : bookBoard,
      vinyl ? artwork : bookBoard,
      bookBoard,
      bookBoard,
      spine,
      bookBoard,
    ],
    0,
    0,
    (depth - board) / 2,
  )
  binding.name = vinyl ? 'Printed sleeve spine' : 'Bound book spine'
  return group
}

/** Decor uses the same shared footprint as collision validation and the inspector. */
export function makeShelfDecor(item: PlacedItem, variant: ProductVariant, host: THREE.Group) {
  if (!item.decor || !isDecorHost(item)) return null
  const surface = decorSurface(item, variant)
  const layout = decorLayout(item.decor, surface.width)
  const group = new THREE.Group()
  group.name = 'Shelf decor'
  group.userData.decor = true

  host.updateWorldMatrix(true, true)
  const surfaces: THREE.Object3D[] = []
  host.traverse((object) => {
    if (object.userData.accessorySurface) surfaces.push(object)
  })
  const centre = new THREE.Vector3(
    mm(layout.bounds.x + layout.bounds.width / 2),
    2,
    mm(layout.bounds.z + layout.bounds.depth / 2),
  )
  const origin = host.localToWorld(centre)
  const hits = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0)).intersectObjects(
    surfaces,
    false,
  )
  if (!hits[0]) return null
  group.position.y = host.worldToLocal(hits[0].point.clone()).y

  layout.objects.forEach((object, index) => {
    const stacked = item.decor!.arrangement === 'stacked'
    const dimensions = {
      thickness: stacked ? object.height : object.width,
      height: stacked ? object.width : object.height,
      width: object.depth,
    }
    const volume = decorVolume(
      item.decor!.kind,
      index,
      dimensions,
      item.decor!.kind === 'vinyl' ? 'COLLECTED RECORDINGS' : bookTitles[index % bookTitles.length],
    )
    if (stacked) volume.rotation.z = Math.PI / 2
    volume.position.set(mm(object.x), mm(object.y), mm(object.z))
    group.add(volume)
  })
  return group
}
