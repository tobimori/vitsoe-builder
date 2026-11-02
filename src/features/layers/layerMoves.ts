import { catalog } from '../../domain/catalog/catalog'
import { isIntegratedTable } from '../../domain/catalog/families'
import { sizedForBay } from '../../domain/catalog/options'
import { slidesOnHost } from '../../domain/placement/bookends'
import { nearestFittingHeight, VERTICAL_PITCH } from '../../domain/placement/grid'
import { proposeItemMove } from '../../domain/placement/proposals'
import { allowedFaces } from '../../domain/plan/system'
import type { Plan, PlanItem } from '../../domain/plan/types'
import type { Face } from '../../domain/types'

/** What a layer stands for, where dragged layers can be dropped. */
export type Place =
  | { kind: 'face'; face: Face }
  | { kind: 'bay'; face: Face; bayIndex: number }
  | { kind: 'item'; item: PlanItem }

export type DropPosition = 'on' | 'before' | 'after'

/** How far above or below the last component a drop at the end of a bay aims, in millimetres. */
const END_STEP = VERTICAL_PITCH * 4

function canHost(host: PlanItem, item: PlanItem) {
  const product = catalog.product(item.productId)
  return (
    host.id !== item.id &&
    host.orientation !== 'vertical' &&
    Boolean(product?.compatibleHosts?.includes(host.productId))
  )
}

/** The components in a bay on a face, highest first, as Layers lists them. */
function bayItems(plan: Plan, face: Face, bayIndex: number) {
  return plan.system.items
    .filter((item) => item.face === face && item.bayIndex === bayIndex && !item.parentItemId)
    .sort((a, b) => b.height - a.height)
}

/** The height a drop between two rows aims for: halfway to the neighbour on that side. */
function heightBeside(plan: Plan, row: PlanItem, position: 'before' | 'after') {
  const rows = bayItems(plan, row.face, row.bayIndex)
  const index = rows.findIndex((item) => item.id === row.id)
  const neighbour = rows[position === 'before' ? index - 1 : index + 1]
  if (neighbour) return (row.height + neighbour.height) / 2
  return row.height + (position === 'before' ? END_STEP : -END_STEP)
}

/**
 * Where dragged components would go: onto a side or bay, between two components of a
 * bay, or a bookend onto another shelf. Undefined where they cannot go.
 */
export function plannedMoves(
  plan: Plan,
  dragged: readonly PlanItem[],
  place: Place,
  position: DropPosition,
): PlanItem[] | undefined {
  const accessories = dragged.filter((item) => item.parentItemId)
  const components = dragged.filter((item) => !item.parentItemId)
  if (dragged.length === 0 || (accessories.length > 0 && components.length > 0)) return undefined

  if (accessories.length > 0) {
    if (place.kind !== 'item' || position !== 'on') return undefined
    const host = place.item
    if (!accessories.every((item) => slidesOnHost(item.productId) && canHost(host, item)))
      return undefined
    return accessories.map((item) => ({
      ...item,
      parentItemId: host.id,
      bayIndex: host.bayIndex,
      height: host.height,
      face: host.face,
    }))
  }

  if (place.kind === 'item') {
    const row = place.item
    if (position === 'on' || row.parentItemId || components.length > 1) return undefined
    const [item] = components
    if (!item || item.id === row.id) return undefined
    return [
      {
        ...item,
        bayIndex: row.bayIndex,
        face: row.face,
        height: heightBeside(plan, row, position),
      },
    ]
  }

  if (position !== 'on' || !allowedFaces(plan).includes(place.face)) return undefined
  return components.map((item) => ({
    ...item,
    face: place.face,
    bayIndex: place.kind === 'bay' ? place.bayIndex : item.bayIndex,
  }))
}

/**
 * Moves each component to the nearest free height to where it aims, in the width of its
 * new bay, one after another so they do not take the same place.
 */
export function fitMoves(plan: Plan, moves: readonly PlanItem[]): PlanItem[] {
  let next = plan
  return moves.map((move) => {
    if (move.parentItemId || isIntegratedTable(move.productId)) return move
    const sized = sizedForBay(move, next.system.bays, catalog)
    const fitting = (height: number) => proposeItemMove(next, catalog, { ...sized, height })
    const height = nearestFittingHeight(
      move.height,
      next,
      (candidate) => fitting(candidate)?.valid ?? false,
      12,
    )
    const fitted = { ...sized, height: height ?? Math.round(move.height) }
    if (height !== undefined) next = fitting(height)?.plan ?? next
    return fitted
  })
}
