import type { Catalog } from '../catalog/catalog'
import { isAccessory } from '../catalog/catalog'
import { isDecorHost } from '../catalog/families'
import type { CatalogProduct, ProductVariant } from '../catalog/types'
import { decorFitsSurface } from '../decor/decor'
import {
  bandsOverlap,
  decorBand,
  itemsCollide,
  occupiedBands,
  verticalEnvelope,
} from '../placement/envelope'
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
  | 'decor-fit'
  | 'decor-clearance'
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
    issues.push(error('room-boundary', 'The E-tracks extend above the ceiling.'))
  }

  if (tracks.some((track) => track.top > maximumTrackTop(plan))) {
    issues.push(
      error('track-height', 'The required E-track stack is taller than the available room height.'),
    )
  }

  if (tracks.some((track) => track.joins > 0)) {
    issues.push(
      advisory(
        'track-join',
        'Stacked E-tracks omit one hole at a join. A Vitsœ planner must confirm the exact join layout.',
      ),
    )
  }

  if (system.trackMode === 'manual' && system.railHeight === 110) {
    issues.push(
      advisory(
        'track-special',
        'The 110 mm shelf-height profile is restricted to light loads and flush shelf applications.',
      ),
    )
  }
  if (system.trackMode === 'manual' && system.railHeight === 395) {
    issues.push(
      advisory(
        'track-special',
        'The 395 mm cabinet-height profile cannot sit directly below another E-track.',
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
        'Stabilising feet are optional for this structure; a planner should confirm them for the floor and loading.',
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
          `Set the supports ${minimum}–${maximum} mm from the wall to match the selected brackets.`,
        ),
      )
    }
  }

  if (system.mountingType === 'floor-to-ceiling' && room.ceilingHeight > 3500) {
    issues.push(
      advisory(
        'stability',
        'The published guide does not specify the tall H-post cross-rail layout; planner confirmation is required.',
      ),
    )
  }

  if (system.mountingType === 'semi-wall' && (postHeight(plan, tracks) ?? 0) > 3500) {
    issues.push(
      advisory(
        'stability',
        'This semi-wall post height exceeds the supplied German planning-guide table; planner confirmation is required.',
      ),
    )
  }

  if (system.mountingType === 'floor-to-ceiling' && room.ceilingHeight > 5400) {
    issues.push(
      advisory(
        'stability',
        'Compressed structures above 5400 mm exceed the verified catalogue bands; planner confirmation is required.',
      ),
    )
  }

  if (roomBoundaryOverflow(plan, catalog) > 0) {
    issues.push(error('room-boundary', 'The system extends beyond the room boundary.'))
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
          `${product.name} must be attached to a compatible component on the same face.`,
          ids,
        ),
      )
    }
  }

  const envelope = verticalEnvelope(item, variant)
  const pinHeight = carrierHeight(item, plan)

  if (envelope.start < 0 || envelope.start + envelope.size > room.ceilingHeight) {
    issues.push(error('room-boundary', 'This component extends above or below the room.', ids))
  }

  if (
    system.trackMode === 'manual' &&
    (pinHeight < system.mountHeight || pinHeight > system.mountHeight + system.railHeight)
  ) {
    issues.push(
      error('room-boundary', 'This component is outside the available E-track slots.', ids),
    )
  }

  if (
    system.mountingType === 'freestanding' &&
    envelope.start + envelope.size > FREESTANDING_MAX_HEIGHT
  ) {
    issues.push(
      error(
        'freestanding-height',
        `Freestanding components must stay below ${FREESTANDING_MAX_HEIGHT} mm.`,
        ids,
      ),
    )
  }

  if (!allowedFaces(plan).includes(item.face) || !variant.faces.includes(item.face)) {
    issues.push(error('invalid-face', 'This component cannot be fitted on that face.', ids))
  }

  if (variant.mountingTypes && !variant.mountingTypes.includes(system.mountingType)) {
    issues.push(
      error('mounting-incompatible', 'This component is incompatible with the support type.', ids),
    )
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
          'This component cannot use a safe E-track hole at a cut edge or join.',
          ids,
        ),
      )
    }
  }

  if (!variant.finishes.includes(resolveItemFinish(system.finish, item, catalog).finish)) {
    issues.push(
      error('finish-incompatible', 'This finish is unavailable for the selected component.', ids),
    )
  }

  if (item.decor) issues.push(...decorIssues(plan, component))

  return issues
}

function decorIssues(plan: Plan, { item, variant }: PlacedComponent): ValidationIssue[] {
  const ids = [item.id]
  if (!isDecorHost(item)) {
    return [error('decor-fit', 'Display objects need a horizontal shelf or table surface.', ids)]
  }
  if (!decorFitsSurface(item, variant)) {
    return [error('decor-fit', 'These display objects do not fit the selected surface.', ids)]
  }

  const band = decorBand(item, variant)
  if (band && (band.y < 0 || band.y + band.height > plan.room.ceilingHeight)) {
    return [
      error('decor-clearance', 'The display objects extend beyond the available room height.', ids),
    ]
  }
  return []
}

function collisionIssues({ plan }: Context, components: PlacedComponent[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const hosted = components.filter(({ item }) => !item.parentItemId)

  hosted.forEach((a, index) => {
    for (const b of hosted.slice(index + 1)) {
      if (
        a.item.bayIndex === b.item.bayIndex &&
        a.item.face === b.item.face &&
        itemsCollide(a.item, a.variant, b.item, b.variant, plan)
      ) {
        issues.push(
          error('item-collision', 'Two components occupy the same space.', [a.item.id, b.item.id]),
        )
      }
    }
  })

  return issues
}

function decorClearanceIssues({ plan }: Context, components: PlacedComponent[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const host of components) {
    const band = decorBand(host.item, host.variant)
    if (!band || !decorFitsSurface(host.item, host.variant)) continue

    for (const { item, variant } of components) {
      if (
        item.id === host.item.id ||
        item.parentItemId ||
        item.bayIndex !== host.item.bayIndex ||
        item.face !== host.item.face
      ) {
        continue
      }
      if (occupiedBands(item, variant, plan).some((other) => bandsOverlap(band, other))) {
        issues.push(
          error(
            'decor-clearance',
            'The display objects need more clear space above this surface.',
            [host.item.id, item.id],
          ),
        )
      }
    }
  }

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
    ? [advisory('balanced-load', 'Balance freestanding loads across the front and back faces.')]
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
      : [error('bay-fit', 'This component does not fit its selected bay.', [item.id])]
  })

  return [
    ...structureIssues(context),
    ...itemIssues,
    ...collisionIssues(context, components),
    ...decorClearanceIssues(context, components),
    ...loadBalanceIssues(context),
  ]
}
