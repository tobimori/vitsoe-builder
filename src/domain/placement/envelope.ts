import { hasFront, isCabinet, isIntegratedTable, isShelfFamily } from '../catalog/families'
import type { ProductVariant } from '../catalog/types'
import type { Plan, PlanItem } from '../plan/types'
import type { Millimetres } from '../types'
import { carrierHeight, TABLETOP_HEIGHT } from './grid'

/**
 * The metal shelf, from the planning guide's 1:5 and 1:10 drawings (pp4, 9): its sides end
 * 7 mm above the pin and 7.5 mm behind it, and its rolled lip ends 120 mm below the pin
 * and 20.5 mm beyond the catalogue depth. Turned over, it hangs from its second hole,
 * 90.8 mm below the first.
 * https://www.vitsoe.com/site/download/3563/606_Universal_Shelving_System_planning_guide_UK_EU_RW.pdf
 */
export const METAL_SHELF = { top: 7, back: 7.5, lip: 120, front: 20.5, secondHole: 90.8 }

/** A vertical band and its depth from the pin line, in millimetres. */
interface Band {
  y: Millimetres
  height: Millimetres
  z: Millimetres
  depth: Millimetres
}

export function overlaps(aStart: number, aSize: number, bStart: number, bSize: number) {
  return aStart < bStart + bSize && bStart < aStart + aSize
}

function bandsOverlap(a: Band, b: Band) {
  return overlaps(a.y, a.height, b.y, b.height) && overlaps(a.z, a.depth, b.z, b.depth)
}

/** The height range a component occupies on its bay. */
export function verticalEnvelope(item: PlanItem, variant: ProductVariant) {
  if (isIntegratedTable(item.productId)) return { start: 0, size: TABLETOP_HEIGHT }

  if (item.productId === 'shelf') {
    const { top, back, lip, front, secondHole } = METAL_SHELF
    if (item.orientation === 'inverted') {
      return { start: item.height - top - secondHole, size: top + lip }
    }
    if (item.orientation === 'vertical') {
      return { start: item.height - variant.depth - front, size: variant.depth + front + back }
    }
    return { start: item.height - lip, size: lip + top }
  }

  if (isShelfFamily(item.productId)) {
    if (item.orientation === 'inverted') return { start: item.height - 10, size: 110 }
    return { start: item.height - 100, size: 110 }
  }

  if (isCabinet(item.productId)) {
    return { start: item.height - variant.height + 10, size: variant.height }
  }

  return { start: item.height - Math.max(0, variant.height - 10), size: variant.height }
}

/** Open drawers and drop fronts reach further forward than the closed component. */
export function effectiveDepth(item: PlanItem, variant: ProductVariant) {
  if (item.productId === 'shelf') {
    return item.orientation === 'vertical' ? METAL_SHELF.lip : variant.depth + METAL_SHELF.front
  }
  if (!item.open) return variant.depth
  if (item.productId === 'drop-front-cabinet') return variant.depth + variant.height - 38
  // A retractable flap slides back into the cabinet
  if (item.productId === 'retractable-flap-cabinet') return variant.depth
  return hasFront(item.productId) ? variant.depth + 220 : variant.depth
}

function occupiedBands(item: PlanItem, variant: ProductVariant, plan: Plan): Band[] {
  if (!isIntegratedTable(item.productId)) {
    const envelope = verticalEnvelope(item, variant)
    return [
      { y: envelope.start, height: envelope.size, z: 0, depth: effectiveDepth(item, variant) },
    ]
  }

  // Mirrors the tabletop, rear carriers, side beam and leg envelopes of the table model
  const carrier = carrierHeight(item, plan)
  return [
    { y: 722, height: 18, z: 0, depth: variant.depth },
    { y: carrier - 10, height: 722 - carrier + 10, z: -9, depth: 69 },
    { y: 672.5, height: 45, z: 0, depth: Math.min(480, variant.depth * 0.6) },
    { y: 0, height: 722, z: variant.depth - 113, depth: 46 },
  ]
}

export function itemsCollide(
  a: PlanItem,
  aVariant: ProductVariant,
  b: PlanItem,
  bVariant: ProductVariant,
  plan: Plan,
) {
  const bBands = occupiedBands(b, bVariant, plan)
  return occupiedBands(a, aVariant, plan).some((aBand) =>
    bBands.some((bBand) => bandsOverlap(aBand, bBand)),
  )
}
