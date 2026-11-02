import type { Catalog } from '../catalog/catalog'
import { isIntegratedTable } from '../catalog/families'
import { structureRules } from '../catalog/structure'
import type { CatalogProduct, ProductVariant } from '../catalog/types'
import type { BayWidth, Face, Millimetres, MountingType } from '../types'
import type { Placement, Plan, PlanItem, PlanSystem, StructureOptions, SystemFinish } from './types'

export function isTwoSided(mountingType: MountingType) {
  return mountingType === 'freestanding' || mountingType === 'floor-to-ceiling'
}

export function isWallMounted(mountingType: MountingType) {
  return mountingType === 'wall' || mountingType === 'semi-wall'
}

export function allowedFaces(plan: Plan): Face[] {
  return isTwoSided(plan.system.mountingType) ? ['front', 'back'] : ['front']
}

/** The face a component can move to on a two-sided system; accessories go with their host. */
export function otherFace(plan: Plan, catalog: Catalog, item: PlanItem): Face | undefined {
  const face = item.face === 'front' ? 'back' : 'front'
  const variant = catalog.variant(item.productId, item.variantId)
  return !item.parentItemId && allowedFaces(plan).includes(face) && variant?.faces.includes(face)
    ? face
    : undefined
}

export function totalCentreWidth(plan: Plan) {
  return plan.system.bays.reduce((sum, bay) => sum + bay.centreWidth, 0)
}

export function sideClearance(mountingType: MountingType) {
  return structureRules[mountingType].sideClearance
}

/** Integrated table legs stand on the floor and fix the installation height. */
export function hasIntegratedTable(plan: Plan) {
  return plan.system.items.some((item) => isIntegratedTable(item.productId))
}

function withSystem(plan: Plan, patch: Partial<PlanSystem>): Plan {
  return { ...plan, system: { ...plan.system, ...patch } }
}

/**
 * A semi-wall system stands off the wall by its wall ties: the post clamp, the bracket at
 * full reach, and any extension bolt. The brackets shorten by up to 10 mm.
 */
export function wallTieDistance(options: StructureOptions) {
  return 23 + (options.wallBracket === 'long' ? 110 : 70) + (options.extensionBolts ? 65 : 0)
}

function withWallDistance(placement: Placement, distance: Millimetres): Placement {
  return { ...placement, distance }
}

export function changeMountingType(plan: Plan, mountingType: MountingType): Plan {
  const { system } = plan
  if (mountingType === system.mountingType) return plan

  const placement =
    mountingType === 'wall'
      ? withWallDistance(system.placement, 0)
      : mountingType === 'semi-wall'
        ? withWallDistance(system.placement, wallTieDistance(system.structureOptions))
        : withWallDistance(system.placement, Math.max(600, system.placement.distance))

  return withSystem(plan, {
    mountingType,
    mountHeight: structureRules[mountingType].normalTrackBaseline,
    placement,
    items: isTwoSided(mountingType)
      ? system.items
      : system.items.map((item) => (item.face === 'front' ? item : { ...item, face: 'front' })),
  })
}

export function setStructureOptions(plan: Plan, patch: Partial<StructureOptions>): Plan {
  const structureOptions = { ...plan.system.structureOptions, ...patch }
  const placement =
    plan.system.mountingType === 'semi-wall'
      ? withWallDistance(plan.system.placement, wallTieDistance(structureOptions))
      : plan.system.placement

  return withSystem(plan, { structureOptions, placement })
}

export function setPlacement(plan: Plan, patch: Partial<Placement>): Plan {
  return withSystem(plan, { placement: { ...plan.system.placement, ...patch } })
}

export function setSystemFinish(plan: Plan, finish: SystemFinish): Plan {
  return withSystem(plan, { finish })
}

/** Moves the track bottom and every component with it, unless table legs fix the height. */
export function setMountHeight(plan: Plan, mountHeight: Millimetres): Plan {
  if (hasIntegratedTable(plan)) return plan

  const delta = mountHeight - plan.system.mountHeight
  return withSystem(plan, {
    mountHeight,
    items: plan.system.items.map((item) => ({ ...item, height: item.height + delta })),
  })
}

export function resetItemFinishes(plan: Plan): Plan {
  return withSystem(plan, {
    items: plan.system.items.map((item) => ({ ...item, finish: 'system', frontFinish: undefined })),
  })
}

export function addBay(plan: Plan, id: string): Plan {
  return withSystem(plan, { bays: [...plan.system.bays, { id, centreWidth: 667 }] })
}

export function removeBay(plan: Plan, index: number): Plan {
  if (plan.system.bays.length === 1) return plan

  return withSystem(plan, {
    bays: plan.system.bays.filter((_, bayIndex) => bayIndex !== index),
    items: plan.system.items
      .filter((item) => item.bayIndex !== index)
      .map((item) => (item.bayIndex > index ? { ...item, bayIndex: item.bayIndex - 1 } : item)),
  })
}

export type BayResizeResult =
  | { ok: true; plan: Plan }
  | { ok: false; message: string; itemIds: string[] }

function replacementVariant(product: CatalogProduct, current: ProductVariant, width: BayWidth) {
  if (!current.bayCentres?.length || current.bayCentres.includes(width)) return current

  const matches = product.variants.filter(
    (variant) =>
      variant.bayCentres?.includes(width) &&
      variant.depth === current.depth &&
      variant.height === current.height,
  )
  return matches.length === 1 ? matches[0] : undefined
}

/** Resizes a bay and swaps every width-specific component in it as one change. */
export function resizeBay(
  plan: Plan,
  catalog: Catalog,
  bayIndex: number,
  centreWidth: BayWidth,
): BayResizeResult {
  const bay = plan.system.bays[bayIndex]
  if (!bay) return { ok: false, message: 'That bay no longer exists.', itemIds: [] }
  if (bay.centreWidth === centreWidth) return { ok: true, plan }

  const replacements = new Map<string, string>()
  const missing: { id: string; name: string }[] = []

  for (const item of plan.system.items) {
    if (item.bayIndex !== bayIndex) continue

    const product = catalog.product(item.productId)
    const variant = catalog.variant(item.productId, item.variantId)
    const replacement = product && variant && replacementVariant(product, variant, centreWidth)
    if (replacement) replacements.set(item.id, replacement.id)
    else missing.push({ id: item.id, name: product?.name ?? 'Component' })
  }

  if (missing.length) {
    const names = [...new Set(missing.map((entry) => entry.name))].join(', ')
    return {
      ok: false,
      message: `${names} ${missing.length === 1 ? 'doesn’t' : 'don’t'} come in a ${centreWidth} mm width.`,
      itemIds: missing.map((entry) => entry.id),
    }
  }

  return {
    ok: true,
    plan: withSystem(plan, {
      bays: plan.system.bays.map((entry, index) =>
        index === bayIndex ? { ...entry, centreWidth } : entry,
      ),
      items: plan.system.items.map((item) => {
        const variantId = replacements.get(item.id)
        return variantId && variantId !== item.variantId ? { ...item, variantId } : item
      }),
    }),
  }
}
