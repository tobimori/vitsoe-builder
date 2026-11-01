import type { Catalog } from '../catalog/catalog'
import { fixedMaterialLabel } from '../catalog/families'
import type { Colour, Finish } from '../types'
import type { PlanItem, SystemFinish } from './types'

export type FinishTarget = Pick<PlanItem, 'productId' | 'variantId' | 'finish' | 'frontFinish'>

export interface ResolvedFinish {
  finish: Finish
  /** The front colour of a beech component. */
  frontFinish?: Colour
  /** Set when the component has one fixed material instead of a finish. */
  materialLabel?: string
  inherited: boolean
}

/** The appearance of one component, shared by the scene, previews, prices and AR export. */
export function resolveItemFinish(
  system: SystemFinish,
  item: FinishTarget,
  catalog: Catalog,
): ResolvedFinish {
  const variant = catalog.variant(item.productId, item.variantId)
  const available = variant?.finishes ?? []
  const inherited = item.finish === 'system'
  const requested =
    item.finish !== 'system'
      ? item.finish
      : system.wood === 'beech' && available.includes('beech')
        ? 'beech'
        : system.colour

  const finish = available.includes(requested)
    ? requested
    : available.includes(system.colour)
      ? system.colour
      : (available[0] ?? 'off-white')

  return {
    finish,
    frontFinish:
      finish === 'beech'
        ? inherited
          ? system.colour
          : (item.frontFinish ?? system.colour)
        : undefined,
    materialLabel: fixedMaterialLabel(item.productId),
    inherited,
  }
}

export function finishLabel(finish: Finish) {
  return finish === 'off-white' ? 'Off-white' : finish.charAt(0).toUpperCase() + finish.slice(1)
}
