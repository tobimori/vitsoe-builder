import { isIntegratedTable } from '../catalog/families'
import type { Plan, PlanItem } from '../plan/types'
import type { BayWidth } from '../types'

/** E-track holes repeat every 70 mm. */
export const VERTICAL_PITCH = 70

/**
 * The first hole sits 35 mm above the lower end of an E-track. With the tracks at
 * Vitsœ's usual 345 mm, a cabinet's top then meets the 740 mm table height, as the
 * planning guide promises (UK/EU, p14):
 * https://www.vitsoe.com/site/download/3563/606_Universal_Shelving_System_planning_guide_UK_EU_RW.pdf
 */
export const FIRST_HOLE = 35

/** The height of the lowest hole in the system's E-tracks; every pin sits a whole pitch above it. */
export function holeOrigin(plan: Plan) {
  return plan.system.mountHeight + FIRST_HOLE
}

export const BAY_USABLE_WIDTH: Record<BayWidth, number> = { 667: 655, 912: 900 }

/** Integrated tables stand on the floor with a fixed tabletop height. */
export const TABLETOP_HEIGHT = 740

export function snapPinHeight(height: number, plan: Plan) {
  const origin = holeOrigin(plan)
  return origin + Math.round((height - origin) / VERTICAL_PITCH) * VERTICAL_PITCH
}

/**
 * The pin height closest to `height` where `fits` holds, at most `reach` holes from the
 * nearest hole, so a component slides past an occupied spot instead of being refused.
 */
export function nearestFittingHeight(
  height: number,
  plan: Plan,
  fits: (height: number) => boolean,
  reach = 3,
) {
  const nearest = snapPinHeight(height, plan)
  return Array.from(
    { length: reach * 2 + 1 },
    (_, index) => nearest + (index - reach) * VERTICAL_PITCH,
  )
    .sort((a, b) => Math.abs(a - height) - Math.abs(b - height))
    .find(fits)
}

/** The pin height on the tracks; integrated tables hang their rear carriers below the top. */
export function carrierHeight(item: PlanItem, plan: Plan) {
  if (!isIntegratedTable(item.productId)) return item.height

  const highestCarrier = TABLETOP_HEIGHT - 35
  const origin = holeOrigin(plan)
  return origin + Math.floor((highestCarrier - origin) / VERTICAL_PITCH) * VERTICAL_PITCH
}
