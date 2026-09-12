import type { PlacedItem, ProductVariant, ShelfDecor } from './types'

export const DECOR_COUNT_LIMITS = {
  vinyl: 24,
  'art-books': 12,
} as const

export const DECOR_SIDE_MARGIN = 18

const cabinetFamilies = new Set([
  'cabinet',
  'lockable-drawer-cabinet',
  'two-drawer-cabinet',
  'three-drawer-cabinet',
  'retractable-flap-cabinet',
  'drop-front-cabinet',
])

const decorHostFamilies = new Set([
  'shelf',
  'wood-shelf',
  'double-shelf',
  'desk-shelf',
  'table',
  'shelf-with-drawer',
])

interface UprightDimensions {
  thickness: number
  height: number
  width: number
}

export interface DecorObject {
  /** Final axis-aligned dimensions and centre position in host-local millimetres. */
  width: number
  height: number
  depth: number
  x: number
  y: number
  z: number
}

export interface DecorBounds {
  /** Minimum coordinates in host-local millimetres. */
  x: number
  y: number
  z: number
  width: number
  height: number
  depth: number
}

export interface DecorLayout {
  objects: DecorObject[]
  bounds: DecorBounds
}

export interface DecorSurface {
  /** Absolute height above the room floor in millimetres. */
  elevation: number
  width: number
  depth: number
}

function uprightDimensions(kind: ShelfDecor['kind']): UprightDimensions {
  return kind === 'vinyl'
    ? { thickness: 5, height: 315, width: 315 }
    : { thickness: 14, height: 260, width: 210 }
}

export function isDecorHost(item: Pick<PlacedItem, 'productId' | 'orientation'>) {
  return decorHostFamilies.has(item.productId) && item.orientation !== 'vertical'
}

export function decorObjects(decor: ShelfDecor): DecorObject[] {
  const source = uprightDimensions(decor.kind)
  const upright = decor.arrangement === 'upright'
  const gap = upright ? 1 : 0
  const axisSize = source.thickness
  const total = decor.count * axisSize + Math.max(0, decor.count - 1) * gap
  const rearMargin = decor.kind === 'art-books' ? 8 : 12
  let cursor = -total / 2

  return Array.from({ length: decor.count }, () => {
    const width = upright ? source.thickness : source.height
    const height = upright ? source.height : source.thickness
    const depth = source.width
    const object: DecorObject = {
      width,
      height,
      depth,
      x: upright ? cursor + width / 2 : 0,
      y: upright ? height / 2 : cursor + height / 2 + total / 2,
      z: rearMargin + depth / 2,
    }
    cursor += axisSize + gap
    return object
  })
}

function boundsFor(objects: DecorObject[]): DecorBounds {
  const minX = Math.min(...objects.map((object) => object.x - object.width / 2))
  const maxX = Math.max(...objects.map((object) => object.x + object.width / 2))
  const minY = Math.min(...objects.map((object) => object.y - object.height / 2))
  const maxY = Math.max(...objects.map((object) => object.y + object.height / 2))
  const minZ = Math.min(...objects.map((object) => object.z - object.depth / 2))
  const maxZ = Math.max(...objects.map((object) => object.z + object.depth / 2))

  return {
    x: minX,
    y: minY,
    z: minZ,
    width: maxX - minX,
    height: maxY - minY,
    depth: maxZ - minZ,
  }
}

export function decorLayout(decor: ShelfDecor, surfaceWidth: number): DecorLayout {
  const objects = decorObjects(decor)
  const initial = boundsFor(objects)
  const xOffset =
    decor.position === 'left'
      ? -surfaceWidth / 2 + DECOR_SIDE_MARGIN - initial.x
      : decor.position === 'right'
        ? surfaceWidth / 2 - DECOR_SIDE_MARGIN - (initial.x + initial.width)
        : -(initial.x + initial.width / 2)
  const placed = objects.map((object) => ({ ...object, x: object.x + xOffset }))

  return { objects: placed, bounds: boundsFor(placed) }
}

export function decorSurface(item: PlacedItem, variant: ProductVariant): DecorSurface {
  let elevation = item.height - 90

  if (item.productId === 'table') elevation = 740
  else if (cabinetFamilies.has(item.productId) || item.productId === 'shelf-with-drawer') {
    elevation = item.height + 10
  } else if (item.productId === 'wood-shelf') {
    elevation = item.height + (item.orientation === 'inverted' ? 100 : -83)
  } else if (item.productId === 'double-shelf' || item.productId === 'desk-shelf') {
    elevation = item.height + (item.orientation === 'inverted' ? 100 : 10)
  } else if (item.orientation === 'inverted') elevation = item.height + 91.6

  const depth =
    item.productId === 'desk-shelf' && item.orientation === 'inverted' ? 360 : variant.depth

  return { elevation, width: variant.width, depth }
}

export function decorFitsSurface(item: PlacedItem, variant: ProductVariant) {
  if (!item.decor || !isDecorHost(item)) return false
  const surface = decorSurface(item, variant)
  const { bounds } = decorLayout(item.decor, surface.width)

  return (
    bounds.x >= -surface.width / 2 &&
    bounds.x + bounds.width <= surface.width / 2 &&
    bounds.z >= 0 &&
    bounds.z + bounds.depth <= surface.depth
  )
}
