import * as v from 'valibot'
import type { Catalog } from '../catalog/catalog'
import { isAccessory } from '../catalog/catalog'
import { orientationsFor } from '../catalog/families'
import type { Plan } from './types'

const whole = (minimum: number, maximum: number) =>
  v.pipe(v.number(), v.integer(), v.minValue(minimum), v.maxValue(maximum))

const colour = v.picklist(['off-white', 'black', 'silver'])

const item = v.object({
  id: v.string(),
  productId: v.string(),
  variantId: v.string(),
  bayIndex: whole(0, 19),
  height: whole(0, 6000),
  face: v.picklist(['front', 'back']),
  finish: v.picklist(['off-white', 'black', 'silver', 'beech', 'system']),
  frontFinish: v.optional(colour),
  orientation: v.optional(v.picklist(['standard', 'inverted', 'vertical'])),
  parentItemId: v.optional(v.string()),
  offset: v.optional(whole(-1000, 1000)),
  open: v.optional(v.boolean()),
})

const planSchema = v.object({
  version: v.literal(2),
  name: v.pipe(v.string(), v.maxLength(200)),
  room: v.object({
    width: whole(1000, 20000),
    depth: whole(1000, 20000),
    ceilingHeight: whole(1800, 6000),
  }),
  system: v.object({
    mountingType: v.picklist(['wall', 'semi-wall', 'floor-to-ceiling', 'freestanding']),
    bays: v.pipe(
      v.array(v.object({ id: v.string(), centreWidth: v.picklist([667, 912]) })),
      v.minLength(1),
      v.maxLength(20),
    ),
    items: v.pipe(v.array(item), v.maxLength(500)),
    placement: v.object({
      wall: v.picklist(['back', 'left', 'right', 'front']),
      offset: whole(0, 20000),
      distance: whole(0, 20000),
    }),
    trackMode: v.picklist(['automatic', 'manual']),
    railHeight: whole(110, 10000),
    mountHeight: whole(0, 6000),
    finish: v.object({ colour, wood: v.picklist(['laminate', 'beech']) }),
    structureOptions: v.object({
      wallBracket: v.picklist(['short', 'long']),
      extensionBolts: v.boolean(),
      cableChannels: v.boolean(),
      stabilisingFeet: v.boolean(),
    }),
  }),
})

/** Catalogue references and links between components that the document shape cannot express. */
function hasValidReferences(plan: Plan, catalog: Catalog) {
  const { bays, items } = plan.system
  const itemsById = new Map(items.map((entry) => [entry.id, entry]))
  if (new Set(bays.map((bay) => bay.id)).size !== bays.length) return false
  if (itemsById.size !== items.length) return false

  return items.every((entry) => {
    const product = catalog.product(entry.productId)
    if (!product || !catalog.variant(entry.productId, entry.variantId)) return false
    if (entry.bayIndex >= bays.length) return false
    if (entry.orientation && !orientationsFor(entry.productId).includes(entry.orientation)) {
      return false
    }

    if (entry.parentItemId === undefined) return !isAccessory(product)
    const parent = itemsById.get(entry.parentItemId)
    return (
      parent !== undefined &&
      Boolean(product.compatibleHosts?.includes(parent.productId)) &&
      parent.bayIndex === entry.bayIndex &&
      parent.face === entry.face
    )
  })
}

/** Reads an untrusted plan document, or returns undefined if it is invalid. */
export function parsePlan(source: string, catalog: Catalog): Plan | undefined {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    return undefined
  }

  const result = v.safeParse(planSchema, value)
  if (!result.success) return undefined

  const plan: Plan = result.output
  return hasValidReferences(plan, catalog) ? plan : undefined
}
