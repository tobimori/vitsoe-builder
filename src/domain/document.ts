import type {
  BuilderDocument,
  CatalogProduct,
  Face,
  FinishId,
  ItemOrientation,
  MountingType,
} from './types'
import { DECOR_COUNT_LIMITS } from './decor'
import { orientationsFor, resolveItemFinish } from './products'

const mountingTypes = new Set<MountingType>([
  'wall',
  'semi-wall',
  'floor-to-ceiling',
  'freestanding',
])
const faces = new Set<Face>(['front', 'back'])
const finishes = new Set<FinishId>(['off-white', 'black', 'silver', 'beech'])
const orientations = new Set<ItemOrientation>(['standard', 'inverted', 'vertical'])

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function bounded(value: unknown, min: number, max: number) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  )
}

export function isBuilderDocument(
  value: unknown,
  catalog: CatalogProduct[],
): value is BuilderDocument {
  if (
    !record(value) ||
    value.version !== 1 ||
    typeof value.name !== 'string' ||
    value.name.length > 200
  )
    return false
  if (
    !record(value.room) ||
    !bounded(value.room.width, 1000, 20000) ||
    !bounded(value.room.depth, 1000, 20000) ||
    !bounded(value.room.ceilingHeight, 1800, 6000) ||
    typeof value.room.showDimensions !== 'boolean'
  )
    return false
  if (!record(value.system) || !mountingTypes.has(value.system.mountingType as MountingType))
    return false
  if (
    !Array.isArray(value.system.bays) ||
    value.system.bays.length < 1 ||
    value.system.bays.length > 20
  )
    return false
  if (!Array.isArray(value.system.items) || value.system.items.length > 500) return false
  if (
    !record(value.system.placement) ||
    !bounded(value.system.placement.x, 0, 20000) ||
    !bounded(value.system.placement.z, 0, 20000) ||
    ![0, 90, 180, 270].includes(value.system.placement.rotation as number)
  )
    return false
  if (!bounded(value.system.railHeight, 110, 10000) || !bounded(value.system.mountHeight, 0, 6000))
    return false
  if (
    value.system.trackMode !== undefined &&
    value.system.trackMode !== 'automatic' &&
    value.system.trackMode !== 'manual'
  )
    return false
  if (value.system.activeFace !== undefined && !faces.has(value.system.activeFace as Face))
    return false
  if (value.system.finish !== undefined) {
    const finish = value.system.finish
    if (
      !record(finish) ||
      !['off-white', 'black', 'silver'].includes(finish.colour as string) ||
      (finish.wood !== 'laminate' && finish.wood !== 'beech')
    )
      return false
  }
  if (
    (value.system.mountingType === 'wall' || value.system.mountingType === 'semi-wall') &&
    value.system.activeFace === 'back'
  )
    return false
  if (value.system.structureOptions !== undefined) {
    const options = value.system.structureOptions
    if (
      !record(options) ||
      (options.wallBracket !== 'short' && options.wallBracket !== 'long') ||
      typeof options.extensionBolts !== 'boolean' ||
      typeof options.cableChannels !== 'boolean' ||
      typeof options.stabilisingFeet !== 'boolean'
    )
      return false
  }

  const bayIds = new Set<string>()
  for (const bay of value.system.bays) {
    if (
      !record(bay) ||
      typeof bay.id !== 'string' ||
      bayIds.has(bay.id) ||
      (bay.centreWidth !== 667 && bay.centreWidth !== 912)
    )
      return false
    bayIds.add(bay.id)
  }

  const itemIds = new Set<string>()
  for (const item of value.system.items) {
    if (!record(item) || typeof item.id !== 'string' || itemIds.has(item.id)) return false
    itemIds.add(item.id)
  }
  for (const item of value.system.items) {
    if (!record(item) || typeof item.productId !== 'string' || typeof item.variantId !== 'string')
      return false
    const product = catalog.find((entry) => entry.id === item.productId)
    const variant = product?.variants.find((entry) => entry.id === item.variantId)
    if (
      !product ||
      !variant ||
      !bounded(item.bayIndex, 0, value.system.bays.length - 1) ||
      !bounded(item.height, 0, 6000)
    )
      return false
    if (!faces.has(item.face as Face) || !finishes.has(item.finish as FinishId)) return false
    if (
      item.finishOverride !== undefined &&
      item.finishOverride !== 'system' &&
      !finishes.has(item.finishOverride as FinishId)
    )
      return false
    if (item.orientation !== undefined && !orientations.has(item.orientation as ItemOrientation))
      return false
    if (
      item.orientation !== undefined &&
      !orientationsFor(item.productId).includes(item.orientation as ItemOrientation)
    )
      return false
    if (
      item.frontFinish !== undefined &&
      !['off-white', 'black', 'silver'].includes(item.frontFinish as string)
    )
      return false
    if (item.parentItemId !== undefined) {
      const parent = value.system.items.find(
        (entry) => record(entry) && entry.id === item.parentItemId,
      )
      if (
        !parent ||
        !product.compatibleHosts?.includes(parent.productId as string) ||
        parent.bayIndex !== item.bayIndex ||
        parent.face !== item.face
      )
        return false
    } else if (product.compatibleHosts?.length) return false
    if (item.open !== undefined && typeof item.open !== 'boolean') return false
    if (item.decor !== undefined) {
      const decor = item.decor
      if (
        !record(decor) ||
        (decor.kind !== 'vinyl' && decor.kind !== 'art-books') ||
        (decor.arrangement !== 'upright' && decor.arrangement !== 'stacked') ||
        (decor.position !== 'left' && decor.position !== 'centre' && decor.position !== 'right') ||
        !bounded(decor.count, 1, DECOR_COUNT_LIMITS[decor.kind])
      )
        return false
    }
  }
  return true
}

export function parseBuilderDocument(source: string, catalog: CatalogProduct[]) {
  try {
    const value: unknown = JSON.parse(source)
    return isBuilderDocument(value, catalog) ? value : undefined
  } catch {
    return undefined
  }
}

export function migrateDocumentFinishes(
  document: BuilderDocument,
  catalog: CatalogProduct[],
): BuilderDocument {
  const colourCounts = new Map<'off-white' | 'black' | 'silver', number>()
  for (const item of document.system.items) {
    const colour = item.finish === 'beech' ? (item.frontFinish ?? 'off-white') : item.finish
    colourCounts.set(colour, (colourCounts.get(colour) ?? 0) + 1)
  }
  const colour = [...colourCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'off-white'
  const finish = document.system.finish ?? {
    colour,
    wood: document.system.items.some((item) => item.finish === 'beech')
      ? ('beech' as const)
      : ('laminate' as const),
  }
  const withSystem = { ...document, system: { ...document.system, finish } }
  const items = document.system.items.map((item) => {
    if (item.finishOverride !== undefined) return item
    const inherited = resolveItemFinish(withSystem, { ...item, finishOverride: 'system' }, catalog)
    const sameAppearance =
      inherited.finish === item.finish &&
      (item.finish !== 'beech' || inherited.frontFinish === (item.frontFinish ?? 'off-white'))
    return { ...item, finishOverride: sameAppearance ? ('system' as const) : item.finish }
  })
  return { ...withSystem, system: { ...withSystem.system, items } }
}
