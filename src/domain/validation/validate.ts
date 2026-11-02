import type { Catalog } from '../catalog/catalog'
import { isAccessory } from '../catalog/catalog'
import type { CatalogProduct, ProductVariant } from '../catalog/types'
import { itemsCollide, verticalEnvelope } from '../placement/envelope'
import { bookendPosition, slidesOnHost } from '../placement/bookends'
import { BAY_USABLE_WIDTH, carrierHeight } from '../placement/grid'
import { resolveItemFinish } from '../plan/finish'
import { allowedFaces, isWallMounted, wallTieDistance } from '../plan/system'
import type { Plan, PlanItem } from '../plan/types'
import { roomBoundaryOverflow } from '../supports/footprint'
import {
  deriveSupportTrackPlans,
  FREESTANDING_MAX_HEIGHT,
  maximumTrackTop,
  postHeight,
  supportTrackAcceptsPin,
  type SupportTrackPlan,
} from '../supports/tracks'

export type ValidationCode =
  | 'room-boundary'
  | 'bay-fit'
  | 'item-collision'
  | 'invalid-face'
  | 'mounting-incompatible'
  | 'finish-incompatible'
  | 'freestanding-height'
  | 'track-height'
  | 'track-slot'
  | 'track-join'
  | 'track-special'
  | 'stability'
  | 'balanced-load'

export interface ValidationIssue {
  code: ValidationCode
  severity: 'error' | 'advisory'
  message: string
  itemIds?: string[]
}

interface Context {
  plan: Plan
  catalog: Catalog
  tracks: SupportTrackPlan[]
}

interface PlacedComponent {
  item: PlanItem
  product: CatalogProduct
  variant: ProductVariant
}

const error = (code: ValidationCode, message: string, itemIds?: string[]): ValidationIssue => ({
  code,
  severity: 'error',
  message,
  itemIds,
})

const advisory = (code: ValidationCode, message: string): ValidationIssue => ({
  code,
  severity: 'advisory',
  message,
})

function structureIssues({ plan, catalog, tracks }: Context): ValidationIssue[] {
  const { system, room } = plan
  const issues: ValidationIssue[] = []

  if (
    isWallMounted(system.mountingType) &&
    system.trackMode === 'manual' &&
    system.mountHeight + system.railHeight > room.ceilingHeight
  ) {
    issues.push(error('room-boundary', 'The E-tracks go above the ceiling.'))
  }

  if (tracks.some((track) => track.top > maximumTrackTop(plan))) {
    issues.push(error('track-height', 'The E-tracks this needs are taller than the room.'))
  }

  if (tracks.some((track) => track.joins > 0)) {
    issues.push(
      advisory(
        'track-join',
        'One hole is lost where two E-tracks meet. Vitsœ will check where the joins go.',
      ),
    )
  }

  if (system.trackMode === 'manual' && system.railHeight === 110) {
    issues.push(
      advisory('track-special', 'The 110 mm shelf-height E-track is for light loads only.'),
    )
  }
  if (system.trackMode === 'manual' && system.railHeight === 395) {
    issues.push(
      advisory(
        'track-special',
        'The 395 mm cabinet-height E-track can’t go directly below another E-track.',
      ),
    )
  }

  if (
    (system.mountingType === 'semi-wall' || system.mountingType === 'floor-to-ceiling') &&
    !system.structureOptions.stabilisingFeet
  ) {
    issues.push(
      advisory(
        'stability',
        'Without stabilising feet, ask Vitsœ whether your floor and load need them.',
      ),
    )
  }

  if (system.mountingType === 'semi-wall') {
    const maximum = wallTieDistance(system.structureOptions)
    const minimum = maximum - 10
    const { distance } = system.placement
    if (distance < minimum || distance > maximum) {
      issues.push(
        advisory(
          'stability',
          `These brackets need the posts ${minimum}–${maximum} mm from the wall.`,
        ),
      )
    }
  }

  if (system.mountingType === 'floor-to-ceiling' && room.ceilingHeight > 3500) {
    issues.push(advisory('stability', 'Posts this tall need a cross-rail layout from Vitsœ.'))
  }

  if (system.mountingType === 'semi-wall' && (postHeight(plan, tracks) ?? 0) > 3500) {
    issues.push(
      advisory(
        'stability',
        'Posts this tall go beyond Vitsœ’s planning guide. Ask Vitsœ to check them.',
      ),
    )
  }

  if (system.mountingType === 'floor-to-ceiling' && room.ceilingHeight > 5400) {
    issues.push(
      advisory('stability', 'Floor-to-ceiling systems over 5400 mm need checking by Vitsœ.'),
    )
  }

  if (roomBoundaryOverflow(plan, catalog) > 0) {
    issues.push(error('room-boundary', 'The system doesn’t fit in the room.'))
  }

  return issues
}

function fitsBay({ plan }: Context, { item, product, variant }: PlacedComponent) {
  const bay = plan.system.bays[item.bayIndex]
  if (!bay) return false
  if (isAccessory(product)) return variant.width <= BAY_USABLE_WIDTH[bay.centreWidth]
  return (
    variant.bayCentres?.includes(bay.centreWidth) ??
    variant.width === BAY_USABLE_WIDTH[bay.centreWidth]
  )
}

function componentIssues(context: Context, component: PlacedComponent): ValidationIssue[] {
  const { plan, catalog, tracks } = context
  const { system, room } = plan
  const { item, product, variant } = component
  const ids = [item.id]
  const issues: ValidationIssue[] = []

  if (isAccessory(product)) {
    const parent = system.items.find((entry) => entry.id === item.parentItemId)
    if (
      !parent ||
      !product.compatibleHosts?.includes(parent.productId) ||
      parent.bayIndex !== item.bayIndex ||
      parent.face !== item.face ||
      (item.productId === 'bookend' && parent.orientation === 'vertical')
    ) {
      issues.push(
        error(
          'mounting-incompatible',
          `${product.name} has nothing to fit onto on this side.`,
          ids,
        ),
      )
    }
  }

  const envelope = verticalEnvelope(item, variant)
  const pinHeight = carrierHeight(item, plan)

  if (envelope.start < 0 || envelope.start + envelope.size > room.ceilingHeight) {
    issues.push(error('room-boundary', 'This component goes through the floor or ceiling.', ids))
  }

  if (
    system.trackMode === 'manual' &&
    (pinHeight < system.mountHeight || pinHeight > system.mountHeight + system.railHeight)
  ) {
    issues.push(error('room-boundary', 'This component is beyond the end of the E-tracks.', ids))
  }

  if (
    system.mountingType === 'freestanding' &&
    envelope.start + envelope.size > FREESTANDING_MAX_HEIGHT
  ) {
    issues.push(
      error(
        'freestanding-height',
        `Freestanding systems end at ${FREESTANDING_MAX_HEIGHT} mm. Move this component lower.`,
        ids,
      ),
    )
  }

  if (!allowedFaces(plan).includes(item.face) || !variant.faces.includes(item.face)) {
    issues.push(error('invalid-face', 'This component can’t go on this side.', ids))
  }

  if (variant.mountingTypes && !variant.mountingTypes.includes(system.mountingType)) {
    issues.push(error('mounting-incompatible', 'This component isn’t made for this mounting.', ids))
  }

  if (!isAccessory(product)) {
    const adjacent = tracks.filter(
      (track) =>
        track.face === item.face &&
        (track.supportIndex === item.bayIndex || track.supportIndex === item.bayIndex + 1),
    )
    if (
      adjacent.length !== 2 ||
      adjacent.some((track) => !supportTrackAcceptsPin(track, pinHeight, system.mountHeight))
    ) {
      issues.push(
        error(
          'track-slot',
          'This component is too close to a cut or join in the E-track. Move it up or down.',
          ids,
        ),
      )
    }
  }

  if (!variant.finishes.includes(resolveItemFinish(system.finish, item, catalog).finish)) {
    issues.push(error('finish-incompatible', 'This component doesn’t come in that finish.', ids))
  }

  return issues
}

function collisionIssues(
  { plan, catalog }: Context,
  components: PlacedComponent[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const hosted = components.filter(({ item }) => !item.parentItemId)
  const bookends = components.flatMap(({ item, variant }) => {
    const position = slidesOnHost(item.productId)
      ? bookendPosition(plan.system.items, catalog, item)
      : undefined
    return position ? [{ item, width: variant.width, offset: position.offset }] : []
  })

  bookends.forEach((a, index) => {
    for (const b of bookends.slice(index + 1)) {
      if (
        a.item.parentItemId === b.item.parentItemId &&
        Math.abs(a.offset - b.offset) < (a.width + b.width) / 2
      ) {
        issues.push(
          error('item-collision', 'Two bookends are in the same place.', [a.item.id, b.item.id]),
        )
      }
    }
  })

  hosted.forEach((a, index) => {
    for (const b of hosted.slice(index + 1)) {
      if (
        a.item.bayIndex === b.item.bayIndex &&
        a.item.face === b.item.face &&
        itemsCollide(a.item, a.variant, b.item, b.variant, plan)
      ) {
        issues.push(error('item-collision', 'Two components overlap.', [a.item.id, b.item.id]))
      }
    }
  })

  return issues
}

function loadBalanceIssues({ plan, catalog }: Context): ValidationIssue[] {
  const { system } = plan
  if (system.mountingType !== 'freestanding' || system.items.length === 0) return []

  const load = (face: 'front' | 'back') =>
    system.items
      .filter((item) => item.face === face)
      .reduce((sum, item) => sum + (catalog.variant(item.productId, item.variantId)?.depth ?? 0), 0)
  const front = load('front')
  const back = load('back')

  return front === 0 || back === 0 || Math.max(front, back) > Math.min(front, back) * 2
    ? [advisory('balanced-load', 'Put a similar load on both sides so the system stays steady.')]
    : []
}

export function validatePlan(plan: Plan, catalog: Catalog): ValidationIssue[] {
  const context: Context = { plan, catalog, tracks: deriveSupportTrackPlans(plan, catalog) }

  const components: PlacedComponent[] = plan.system.items.flatMap((item) => {
    const product = catalog.product(item.productId)
    const variant = catalog.variant(item.productId, item.variantId)
    return product && variant ? [{ item, product, variant }] : []
  })

  const itemIssues = plan.system.items.flatMap((item) => {
    const component = components.find((entry) => entry.item === item)
    return component && fitsBay(context, component)
      ? componentIssues(context, component)
      : [error('bay-fit', 'This component doesn’t fit its bay.', [item.id])]
  })

  return [
    ...structureIssues(context),
    ...itemIssues,
    ...collisionIssues(context, components),
    ...loadBalanceIssues(context),
  ]
}
