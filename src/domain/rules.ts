import type {
  BuilderDocument,
  CatalogProduct,
  Face,
  PartsListLine,
  PlacedItem,
  ProductVariant,
  SupportTrackPlan,
  ValidationIssue,
  ConnectedSupportMove,
} from './types'
import { priceForVariant } from '../data/catalog'
import { findStructureVariant, recommendETracks, structureRules } from '../data/structure'
import { decorFitsSurface, decorLayout, decorSurface, isDecorHost } from './decor'
import {
  isAccessory,
  isIntegratedTable,
  isOpenable,
  orientationsFor,
  resolveItemFinish,
  verticalEnvelope,
} from './products'

export const BAY_USABLE_WIDTH = { 667: 655, 912: 900 } as const
export const WALL_SIDE_CLEARANCE = 35
export const POST_DEPTH = 65
export const FREESTANDING_MAX_HEIGHT = 1915
export const TRACK_LENGTHS = [110, 395, 570, 1140, 1710, 2000] as const
export const VERTICAL_PITCH = 70
export const TRACK_EDGE_ALLOWANCE = 10

export function snapItemHeight(height: number, document: BuilderDocument) {
  const origin = document.system.mountHeight
  return origin + Math.round((height - origin) / VERTICAL_PITCH) * VERTICAL_PITCH
}

export function carrierHeight(item: PlacedItem, document: BuilderDocument) {
  if (!isIntegratedTable(item.productId)) return item.height
  const highestCarrier = 740 - 35
  return (
    document.system.mountHeight +
    Math.floor((highestCarrier - document.system.mountHeight) / VERTICAL_PITCH) * VERTICAL_PITCH
  )
}

export function totalCentreWidth(document: BuilderDocument) {
  return document.system.bays.reduce((sum, bay) => sum + bay.centreWidth, 0)
}

export function systemOverallWidth(document: BuilderDocument) {
  const sideClearance = structureRules[document.system.mountingType].sideClearance
  return totalCentreWidth(document) + sideClearance * 2
}

export function variantFor(
  item: PlacedItem,
  catalog: CatalogProduct[],
): ProductVariant | undefined {
  return catalog
    .find((product) => product.id === item.productId)
    ?.variants.find((variant) => variant.id === item.variantId)
}

export function allowedFaces(document: BuilderDocument): Face[] {
  return document.system.mountingType === 'freestanding' ||
    document.system.mountingType === 'floor-to-ceiling'
    ? ['front', 'back']
    : ['front']
}

function overlaps(aStart: number, aSize: number, bStart: number, bSize: number) {
  return aStart < bStart + bSize && bStart < aStart + aSize
}

export function itemVerticalEnvelope(item: PlacedItem, variant: ProductVariant) {
  return verticalEnvelope(item, variant)
}

function occupiedBands(item: PlacedItem, variant: ProductVariant, document: BuilderDocument) {
  if (!isIntegratedTable(item.productId)) {
    const envelope = itemVerticalEnvelope(item, variant)
    return [
      { y: envelope.start, height: envelope.size, z: 0, depth: effectiveItemDepth(item, variant) },
    ]
  }

  const carrier = carrierHeight(item, document)
  // Mirrors the tabletop, rear carriers, side beam and leg envelopes in integratedTable().
  return [
    { y: 722, height: 18, z: 0, depth: variant.depth },
    { y: carrier - 10, height: 722 - carrier + 10, z: -9, depth: 69 },
    { y: 672.5, height: 45, z: 0, depth: Math.min(480, variant.depth * 0.6) },
    { y: 0, height: 722, z: variant.depth - 113, depth: 46 },
  ]
}

function itemsCollide(
  a: PlacedItem,
  aVariant: ProductVariant,
  b: PlacedItem,
  bVariant: ProductVariant,
  document: BuilderDocument,
) {
  return occupiedBands(a, aVariant, document).some((aBand) =>
    occupiedBands(b, bVariant, document).some(
      (bBand) =>
        overlaps(aBand.y, aBand.height, bBand.y, bBand.height) &&
        overlaps(aBand.z, aBand.depth, bBand.z, bBand.depth),
    ),
  )
}

function decorOccupiedBand(item: PlacedItem, variant: ProductVariant) {
  if (!item.decor || !isDecorHost(item)) return undefined
  const surface = decorSurface(item, variant)
  const { bounds } = decorLayout(item.decor, surface.width)

  return {
    y: surface.elevation + bounds.y,
    height: bounds.height,
    z: bounds.z,
    depth: bounds.depth,
  }
}

export function moveConnectedSupportRun(
  document: BuilderDocument,
  move: ConnectedSupportMove,
): BuilderDocument {
  const mode = document.system.mountingType
  const wallRunsAlongZ =
    document.system.placement.rotation === 90 || document.system.placement.rotation === 270
  const hasIntegratedTable = document.system.items.some((item) => isIntegratedTable(item.productId))
  const mountHeight =
    mode === 'wall' && !hasIntegratedTable
      ? Math.max(0, Math.round(move.mountHeight))
      : document.system.mountHeight
  const heightDelta = mountHeight - document.system.mountHeight
  const placement = {
    ...document.system.placement,
    x: Math.max(
      0,
      Math.round(
        (mode === 'wall' || mode === 'semi-wall') && wallRunsAlongZ
          ? document.system.placement.x
          : move.x,
      ),
    ),
    z: Math.max(
      0,
      Math.round(
        (mode === 'wall' || mode === 'semi-wall') && !wallRunsAlongZ
          ? document.system.placement.z
          : move.z,
      ),
    ),
  }
  const items = document.system.items.map((item) =>
    heightDelta && !isIntegratedTable(item.productId)
      ? { ...item, height: item.height + heightDelta }
      : item,
  )

  return {
    ...document,
    system: { ...document.system, placement, mountHeight, items },
  }
}

function effectiveItemDepth(item: PlacedItem, variant: ProductVariant) {
  if (!item.open) return variant.depth
  if (
    item.productId === 'cabinet' ||
    item.productId === 'lockable-drawer-cabinet' ||
    item.productId === 'two-drawer-cabinet' ||
    item.productId === 'three-drawer-cabinet' ||
    item.productId === 'shelf-with-drawer'
  ) {
    return variant.depth + 220
  }
  if (item.productId === 'drop-front-cabinet') {
    return variant.depth + variant.height - 38
  }
  return variant.depth
}

function supportDepthExtent(document: BuilderDocument) {
  const { mountingType, structureOptions } = document.system
  if (mountingType === 'wall') return { min: 0, max: POST_DEPTH }
  if (mountingType === 'freestanding') return { min: -459, max: 391 }

  if (mountingType === 'semi-wall') {
    const bracketDepth = structureOptions?.wallBracket === 'long' ? 110 : 70
    const extension = structureOptions?.extensionBolts ? 65 : 0
    const wallTieRear = -24 - bracketDepth - extension + 1.5
    return {
      min: Math.min(-89, wallTieRear),
      max: structureOptions?.stabilisingFeet ? 376 : 41,
    }
  }

  const hPost = mountingType === 'floor-to-ceiling' && document.room.ceilingHeight > 3500
  if (structureOptions?.stabilisingFeet) {
    return hPost ? { min: -459, max: 391 } : { min: -449, max: 401 }
  }
  return hPost ? { min: -99, max: 31 } : { min: -89, max: 41 }
}

export function roomBoundaryOverflow(document: BuilderDocument, catalog: CatalogProduct[]) {
  const { system, room } = document
  const supportDepth = supportDepthExtent(document)
  const hPost =
    system.mountingType === 'freestanding' ||
    (system.mountingType === 'floor-to-ceiling' && room.ceilingHeight > 3500)
  const rearAttachmentOffset = hPost ? 79 : 59
  const frontDepth = Math.max(
    supportDepth.max,
    ...system.items
      .filter((item) => item.face === 'front')
      .map((item) => {
        const variant = variantFor(item, catalog)
        return variant ? effectiveItemDepth(item, variant) + 11 : 0
      }),
  )
  const backDepth = allowedFaces(document).includes('back')
    ? Math.max(
        -supportDepth.min,
        ...system.items
          .filter((item) => item.face === 'back')
          .map((item) => {
            const variant = variantFor(item, catalog)
            return variant ? effectiveItemDepth(item, variant) + rearAttachmentOffset : 0
          }),
      )
    : Math.max(0, -supportDepth.min)
  const sideClearance = structureRules[system.mountingType].sideClearance
  const span = totalCentreWidth(document)
  const centerX = system.placement.x + span / 2
  const centerZ = system.placement.z
  const angle = (system.placement.rotation * Math.PI) / 180
  const corners = [
    [-span / 2 - sideClearance, -backDepth],
    [span / 2 + sideClearance, -backDepth],
    [-span / 2 - sideClearance, frontDepth],
    [span / 2 + sideClearance, frontDepth],
  ].map(([x, z]) => ({
    x: centerX + x * Math.cos(angle) + z * Math.sin(angle),
    z: centerZ - x * Math.sin(angle) + z * Math.cos(angle),
  }))

  return Math.max(
    0,
    ...corners.flatMap((corner) => [
      -corner.x,
      corner.x - room.width,
      -corner.z,
      corner.z - room.depth,
    ]),
  )
}

export function deriveSupportTrackPlans(
  document: BuilderDocument,
  catalog: CatalogProduct[],
): SupportTrackPlan[] {
  const automatic = document.system.trackMode !== 'manual'
  const normalBottom = document.system.mountHeight

  const faces = allowedFaces(document)
  return Array.from(
    { length: document.system.bays.length + 1 },
    (_, supportIndex) => supportIndex,
  ).flatMap((supportIndex) =>
    faces.map((face) => {
      const items = document.system.items.filter((item) => {
        const product = catalog.find((entry) => entry.id === item.productId)
        return (
          product &&
          !isAccessory(product) &&
          item.face === face &&
          (item.bayIndex === supportIndex || item.bayIndex + 1 === supportIndex)
        )
      })
      const pinHeights = items.map((item) => carrierHeight(item, document))
      const lowestPin = pinHeights.length ? Math.min(...pinHeights) : normalBottom
      const highestPin = pinHeights.length ? Math.max(...pinHeights) : normalBottom + 470
      const carrierBottom = Math.max(0, Math.min(normalBottom, lowestPin))
      const bottom =
        automatic && pinHeights.length > 0 && lowestPin <= normalBottom
          ? Math.max(0, carrierBottom - TRACK_EDGE_ALLOWANCE)
          : automatic
            ? carrierBottom
            : document.system.mountHeight
      const requiredLength = automatic
        ? Math.max(570, highestPin - carrierBottom + 100)
        : document.system.railHeight
      const maximumTop =
        document.system.mountingType === 'freestanding'
          ? FREESTANDING_MAX_HEIGHT
          : document.room.ceilingHeight
      const availableHeight = automatic
        ? maximumTop - bottom
        : Math.min(requiredLength, maximumTop - bottom)
      const specialTrackId =
        !automatic && requiredLength === 110
          ? 'e-track-shelf-height-110'
          : !automatic && requiredLength === 395
            ? 'e-track-cabinet-height-395'
            : undefined
      const recommendation = specialTrackId
        ? {
            stockLengths: [requiredLength],
            finalLengths: [requiredLength],
            totalLength: requiredLength,
            cutAmount: 0,
            needsCut: false,
            estimatedPriceEur:
              findStructureVariant('e-track', specialTrackId)?.estimatedPriceEur ?? 0,
            cuttingChargeEur: undefined,
            fitsAvailableHeight: requiredLength <= availableHeight,
          }
        : recommendETracks(requiredLength, availableHeight)
      const segments = recommendation.stockLengths.map((stockLength, index) => ({
        stockLength,
        installedLength: recommendation.finalLengths[index],
        cut: recommendation.finalLengths[index] !== stockLength,
        estimatedPriceEur:
          findStructureVariant('e-track', specialTrackId ?? `e-track-${stockLength}`)
            ?.estimatedPriceEur ?? 0,
      }))
      return {
        supportIndex,
        face,
        bottom,
        top: bottom + recommendation.totalLength,
        requiredLength,
        segments,
        joins: Math.max(0, segments.length - 1),
        estimatedPriceEur: recommendation.estimatedPriceEur,
        estimatedCuttingChargeEur: recommendation.cuttingChargeEur ?? 0,
      }
    }),
  )
}

export function trackHoleHeights(plan: SupportTrackPlan, gridOrigin: number) {
  const holes: number[] = []
  const first = gridOrigin + Math.ceil((plan.bottom - gridOrigin) / VERTICAL_PITCH) * VERTICAL_PITCH

  for (let height = first; height <= plan.top; height += VERTICAL_PITCH) {
    let segmentBottom = plan.bottom
    const safe = plan.segments.some((segment) => {
      const segmentTop = segmentBottom + segment.installedLength
      const within =
        height >= segmentBottom + TRACK_EDGE_ALLOWANCE &&
        height <= segmentTop - TRACK_EDGE_ALLOWANCE
      segmentBottom = segmentTop
      return within
    })
    if (safe) holes.push(height)
  }

  return holes
}

export function supportTrackAcceptsPin(plan: SupportTrackPlan, height: number, gridOrigin: number) {
  return trackHoleHeights(plan, gridOrigin).includes(height)
}

export function validateDocument(
  document: BuilderDocument,
  catalog: CatalogProduct[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { system, room } = document

  if (
    (system.mountingType === 'wall' || system.mountingType === 'semi-wall') &&
    system.trackMode === 'manual' &&
    system.mountHeight + system.railHeight > room.ceilingHeight
  ) {
    issues.push({
      code: 'room-boundary',
      severity: 'error',
      message: 'The E-tracks extend above the ceiling.',
    })
  }

  const supportTracks = deriveSupportTrackPlans(document, catalog)
  const maximumTrackTop =
    system.mountingType === 'freestanding' ? FREESTANDING_MAX_HEIGHT : room.ceilingHeight
  if (supportTracks.some((track) => track.top > maximumTrackTop)) {
    issues.push({
      code: 'track-height',
      severity: 'error',
      message: 'The required E-track stack is taller than the available room height.',
    })
  }
  if (supportTracks.some((track) => track.joins > 0)) {
    issues.push({
      code: 'track-join',
      severity: 'advisory',
      message:
        'Stacked E-tracks omit one hole at a join. A Vitsœ planner must confirm the exact join layout.',
    })
  }
  if (system.trackMode === 'manual' && (system.railHeight === 110 || system.railHeight === 395)) {
    issues.push({
      code: 'track-special',
      severity: 'advisory',
      message:
        system.railHeight === 110
          ? 'The 110 mm shelf-height profile is restricted to light loads and flush shelf applications.'
          : 'The 395 mm cabinet-height profile cannot sit directly below another E-track.',
    })
  }
  if (
    (system.mountingType === 'semi-wall' || system.mountingType === 'floor-to-ceiling') &&
    !system.structureOptions?.stabilisingFeet
  ) {
    issues.push({
      code: 'stability',
      severity: 'advisory',
      message:
        'Stabilising feet are optional for this structure; a planner should confirm them for the floor and loading.',
    })
  }
  if (system.mountingType === 'semi-wall') {
    const bracket = system.structureOptions?.wallBracket ?? 'short'
    const extension = system.structureOptions?.extensionBolts ? 65 : 0
    const minimumReach = (bracket === 'short' ? 60 : 100) + extension
    const maximumReach = (bracket === 'short' ? 70 : 110) + extension
    const wallRunsAlongZ = system.placement.rotation === 90 || system.placement.rotation === 270
    const actualReach = wallRunsAlongZ ? system.placement.x : system.placement.z
    if (actualReach < minimumReach || actualReach > maximumReach) {
      issues.push({
        code: 'stability',
        severity: 'advisory',
        message: `Set the system ${minimumReach}–${maximumReach} mm from the back wall to match the selected brackets.`,
      })
    }
  }
  if (system.mountingType === 'floor-to-ceiling' && room.ceilingHeight > 3500) {
    issues.push({
      code: 'stability',
      severity: 'advisory',
      message:
        'The published guide does not specify the tall H-post cross-rail layout; planner confirmation is required.',
    })
  }
  if (
    system.mountingType === 'semi-wall' &&
    Math.max(...supportTracks.map((track) => track.top)) + 55 > 3500
  ) {
    issues.push({
      code: 'stability',
      severity: 'advisory',
      message:
        'This semi-wall post height exceeds the supplied German planning-guide table; planner confirmation is required.',
    })
  }
  if (system.mountingType === 'floor-to-ceiling' && room.ceilingHeight > 5400) {
    issues.push({
      code: 'stability',
      severity: 'advisory',
      message:
        'Compressed structures above 5400 mm exceed the verified catalogue bands; planner confirmation is required.',
    })
  }

  if (roomBoundaryOverflow(document, catalog) > 0) {
    issues.push({
      code: 'room-boundary',
      severity: 'error',
      message: 'The system extends beyond the room boundary.',
    })
  }

  for (const item of system.items) {
    const variant = variantFor(item, catalog)
    const bay = system.bays[item.bayIndex]
    const product = catalog.find((entry) => entry.id === item.productId)
    const accessory = product && isAccessory(product)
    const widthFits =
      variant &&
      bay &&
      (accessory
        ? variant.width <= BAY_USABLE_WIDTH[bay.centreWidth]
        : (variant.bayCentres?.includes(bay.centreWidth) ??
          variant.width === BAY_USABLE_WIDTH[bay.centreWidth]))
    if (!variant || !bay || !widthFits) {
      issues.push({
        code: 'bay-fit',
        severity: 'error',
        message: 'This component does not fit its selected bay.',
        itemIds: [item.id],
      })
      continue
    }
    if (product && accessory) {
      const parent = system.items.find((entry) => entry.id === item.parentItemId)
      if (
        !parent ||
        !product.compatibleHosts?.includes(parent.productId) ||
        parent.bayIndex !== item.bayIndex ||
        parent.face !== item.face ||
        (item.productId === 'bookend' && parent.orientation === 'vertical')
      ) {
        issues.push({
          code: 'mounting-incompatible',
          severity: 'error',
          message: `${product.name} must be attached to a compatible component on the same face.`,
          itemIds: [item.id],
        })
      }
    }
    const envelope = itemVerticalEnvelope(item, variant)
    const itemCarrierHeight = carrierHeight(item, document)
    if (envelope.start < 0 || envelope.start + envelope.size > room.ceilingHeight) {
      issues.push({
        code: 'room-boundary',
        severity: 'error',
        message: 'This component extends above or below the room.',
        itemIds: [item.id],
      })
    }
    if (
      system.trackMode === 'manual' &&
      (itemCarrierHeight < system.mountHeight ||
        itemCarrierHeight > system.mountHeight + system.railHeight)
    ) {
      issues.push({
        code: 'room-boundary',
        severity: 'error',
        message: 'This component is outside the available E-track slots.',
        itemIds: [item.id],
      })
    }
    if (
      system.mountingType === 'freestanding' &&
      envelope.start + envelope.size > FREESTANDING_MAX_HEIGHT
    ) {
      issues.push({
        code: 'freestanding-height',
        severity: 'error',
        message: `Freestanding components must stay below ${FREESTANDING_MAX_HEIGHT} mm.`,
        itemIds: [item.id],
      })
    }
    if (!allowedFaces(document).includes(item.face) || !variant.faces.includes(item.face)) {
      issues.push({
        code: 'invalid-face',
        severity: 'error',
        message: 'This component cannot be fitted on that face.',
        itemIds: [item.id],
      })
    }
    if (variant.mountingTypes && !variant.mountingTypes.includes(system.mountingType)) {
      issues.push({
        code: 'mounting-incompatible',
        severity: 'error',
        message: 'This component is incompatible with the support type.',
        itemIds: [item.id],
      })
    }
    if (product && !accessory) {
      const adjacentTracks = supportTracks.filter(
        (track) =>
          track.face === item.face &&
          (track.supportIndex === item.bayIndex || track.supportIndex === item.bayIndex + 1),
      )
      if (
        adjacentTracks.length !== 2 ||
        adjacentTracks.some(
          (track) => !supportTrackAcceptsPin(track, itemCarrierHeight, system.mountHeight),
        )
      ) {
        issues.push({
          code: 'track-slot',
          severity: 'error',
          message: 'This component cannot use a safe E-track hole at a cut edge or join.',
          itemIds: [item.id],
        })
      }
    }
    const resolvedFinish = resolveItemFinish(document, item, catalog)
    if (!variant.finishes.includes(resolvedFinish.finish)) {
      issues.push({
        code: 'finish-incompatible',
        severity: 'error',
        message: 'This finish is unavailable for the selected component.',
        itemIds: [item.id],
      })
    }
    if (item.decor) {
      if (!isDecorHost(item)) {
        issues.push({
          code: 'decor-fit',
          severity: 'error',
          message: 'Display objects need a horizontal shelf or table surface.',
          itemIds: [item.id],
        })
      } else if (!decorFitsSurface(item, variant)) {
        issues.push({
          code: 'decor-fit',
          severity: 'error',
          message: 'These display objects do not fit the selected surface.',
          itemIds: [item.id],
        })
      } else {
        const band = decorOccupiedBand(item, variant)!
        if (band.y < 0 || band.y + band.height > room.ceilingHeight) {
          issues.push({
            code: 'decor-clearance',
            severity: 'error',
            message: 'The display objects extend beyond the available room height.',
            itemIds: [item.id],
          })
        }
      }
    }
  }

  for (let index = 0; index < system.items.length; index += 1) {
    const a = system.items[index]
    const aVariant = variantFor(a, catalog)
    if (!aVariant) continue
    for (const b of system.items.slice(index + 1)) {
      const bVariant = variantFor(b, catalog)
      if (
        bVariant &&
        !a.parentItemId &&
        !b.parentItemId &&
        a.bayIndex === b.bayIndex &&
        a.face === b.face &&
        itemsCollide(a, aVariant, b, bVariant, document)
      ) {
        issues.push({
          code: 'item-collision',
          severity: 'error',
          message: 'Two components occupy the same space.',
          itemIds: [a.id, b.id],
        })
      }
    }
  }

  for (const host of system.items) {
    const hostVariant = variantFor(host, catalog)
    const decorBand = hostVariant && decorOccupiedBand(host, hostVariant)
    if (!hostVariant || !decorBand || !decorFitsSurface(host, hostVariant)) continue

    for (const item of system.items) {
      if (
        item.id === host.id ||
        item.parentItemId ||
        item.bayIndex !== host.bayIndex ||
        item.face !== host.face
      )
        continue
      const variant = variantFor(item, catalog)
      if (!variant) continue
      if (
        occupiedBands(item, variant, document).some(
          (band) =>
            overlaps(decorBand.y, decorBand.height, band.y, band.height) &&
            overlaps(decorBand.z, decorBand.depth, band.z, band.depth),
        )
      ) {
        issues.push({
          code: 'decor-clearance',
          severity: 'error',
          message: 'The display objects need more clear space above this surface.',
          itemIds: [host.id, item.id],
        })
      }
    }
  }

  if (system.mountingType === 'freestanding') {
    const frontLoad = system.items
      .filter((item) => item.face === 'front')
      .reduce((sum, item) => sum + (variantFor(item, catalog)?.depth ?? 0), 0)
    const backLoad = system.items
      .filter((item) => item.face === 'back')
      .reduce((sum, item) => sum + (variantFor(item, catalog)?.depth ?? 0), 0)
    if (
      system.items.length > 0 &&
      (frontLoad === 0 ||
        backLoad === 0 ||
        Math.max(frontLoad, backLoad) > Math.min(frontLoad, backLoad) * 2)
    ) {
      issues.push({
        code: 'balanced-load',
        severity: 'advisory',
        message: 'Balance freestanding loads across the front and back faces.',
      })
    }
  }

  return issues
}

export function canPlaceItem(
  document: BuilderDocument,
  catalog: CatalogProduct[],
  candidate: PlacedItem,
) {
  const withoutCandidate = document.system.items.filter((item) => item.id !== candidate.id)
  const next = {
    ...document,
    system: { ...document.system, items: [...withoutCandidate, candidate] },
  }
  return (
    roomBoundaryOverflow(next, catalog) <= roomBoundaryOverflow(document, catalog) &&
    !validateDocument(next, catalog).some(
      (issue) => issue.severity === 'error' && issue.itemIds?.includes(candidate.id),
    ) &&
    !itemsHaveTrackHeightError(next, catalog, [candidate])
  )
}

export function itemTreeIds(items: PlacedItem[], rootId: string) {
  const ids = new Set([rootId])
  let added = true
  while (added) {
    added = false
    for (const item of items) {
      if (item.parentItemId && ids.has(item.parentItemId) && !ids.has(item.id)) {
        ids.add(item.id)
        added = true
      }
    }
  }
  return ids
}

export function proposeItemMove(
  document: BuilderDocument,
  catalog: CatalogProduct[],
  candidate: PlacedItem,
) {
  const original = document.system.items.find((item) => item.id === candidate.id)
  if (!original) return undefined

  const normalized = {
    ...candidate,
    height: isIntegratedTable(candidate.productId)
      ? 740
      : snapItemHeight(candidate.height, document),
  }
  const bayDelta = normalized.bayIndex - original.bayIndex
  const heightDelta = normalized.height - original.height
  const movedIds = itemTreeIds(document.system.items, normalized.id)
  const items = document.system.items.map((item) => {
    if (item.id === normalized.id) return normalized
    if (!movedIds.has(item.id)) return item
    return {
      ...item,
      bayIndex: item.bayIndex + bayDelta,
      height: item.height + heightDelta,
      face: normalized.face,
    }
  })
  const next = {
    ...document,
    system: {
      ...document.system,
      items,
      activeFace: normalized.face !== original.face ? normalized.face : document.system.activeFace,
    },
  }
  const movedItems = items.filter((item) => movedIds.has(item.id))
  const originalMovedItems = document.system.items.filter((item) => movedIds.has(item.id))
  const affectedIssueKeys = (source: BuilderDocument) =>
    new Set(
      validateDocument(source, catalog)
        .filter(
          (issue) => issue.severity === 'error' && issue.itemIds?.some((id) => movedIds.has(id)),
        )
        .map((issue) => `${issue.code}:${[...(issue.itemIds ?? [])].sort().join(',')}`),
    )
  const previousIssueKeys = affectedIssueKeys(document)
  const introducesIssue = [...affectedIssueKeys(next)].some(
    (issueKey) => !previousIssueKeys.has(issueKey),
  )
  const valid =
    roomBoundaryOverflow(next, catalog) <= roomBoundaryOverflow(document, catalog) &&
    !introducesIssue &&
    (!itemsHaveTrackHeightError(next, catalog, movedItems) ||
      itemsHaveTrackHeightError(document, catalog, originalMovedItems))

  return {
    document: next,
    candidate: normalized,
    movedItemIds: [...movedIds],
    valid,
  }
}

export function proposeItemDuplicate(
  document: BuilderDocument,
  catalog: CatalogProduct[],
  candidate: PlacedItem,
  createId: (sourceId: string) => string = (sourceId) => `copy-${sourceId}`,
) {
  const original = document.system.items.find((item) => item.id === candidate.id)
  if (!original) return undefined

  const normalized = {
    ...candidate,
    height: isIntegratedTable(candidate.productId)
      ? 740
      : snapItemHeight(candidate.height, document),
  }
  const sourceIds = itemTreeIds(document.system.items, original.id)

  const usedIds = new Set(document.system.items.map((item) => item.id))
  const copiedIds = new Map<string, string>()
  for (const sourceId of sourceIds) {
    const requested = createId(sourceId)
    let id = requested
    let suffix = 2
    while (usedIds.has(id)) id = `${requested}-${suffix++}`
    copiedIds.set(sourceId, id)
    usedIds.add(id)
  }

  const bayDelta = normalized.bayIndex - original.bayIndex
  const heightDelta = normalized.height - original.height
  const copies = document.system.items
    .filter((item) => sourceIds.has(item.id))
    .map((item) => {
      const root = item.id === original.id
      return {
        ...(root ? normalized : item),
        id: copiedIds.get(item.id)!,
        bayIndex: root ? normalized.bayIndex : item.bayIndex + bayDelta,
        height: root ? normalized.height : item.height + heightDelta,
        face: normalized.face,
        parentItemId: item.parentItemId
          ? (copiedIds.get(item.parentItemId) ?? item.parentItemId)
          : undefined,
      }
    })
  const copiedItemIds = new Set(copies.map((item) => item.id))
  const next = {
    ...document,
    system: {
      ...document.system,
      items: [...document.system.items, ...copies],
      activeFace: normalized.face,
    },
  }
  const introducesIssue = validateDocument(next, catalog).some(
    (issue) => issue.severity === 'error' && issue.itemIds?.some((id) => copiedItemIds.has(id)),
  )
  const valid =
    roomBoundaryOverflow(next, catalog) <= roomBoundaryOverflow(document, catalog) &&
    !introducesIssue &&
    !itemsHaveTrackHeightError(next, catalog, copies)

  return {
    document: next,
    candidate: copies.find((item) => item.id === copiedIds.get(original.id))!,
    movedItemIds: [...copiedItemIds],
    valid,
  }
}

export function itemsHaveTrackHeightError(
  document: BuilderDocument,
  catalog: CatalogProduct[],
  items: PlacedItem[],
) {
  const affected = new Set<string>()
  for (const item of items) {
    affected.add(`${item.face}:${item.bayIndex}`)
    affected.add(`${item.face}:${item.bayIndex + 1}`)
  }
  const maximumTop =
    document.system.mountingType === 'freestanding'
      ? FREESTANDING_MAX_HEIGHT
      : document.room.ceilingHeight
  return deriveSupportTrackPlans(document, catalog).some(
    (track) => affected.has(`${track.face}:${track.supportIndex}`) && track.top > maximumTop,
  )
}

export function findAvailablePlacement(
  document: BuilderDocument,
  catalog: CatalogProduct[],
  productId: string,
  variantId: string,
  face: Face,
  preferredBayIndex = 0,
  parentItemId?: string,
  id = 'placement-candidate',
) {
  const product = catalog.find((entry) => entry.id === productId)
  const variant = product?.variants.find((entry) => entry.id === variantId)
  if (!product || !variant) return undefined
  const accessory = isAccessory(product)
  const parent = parentItemId
    ? document.system.items.find((item) => item.id === parentItemId)
    : undefined
  if (accessory && (!parent || !product.compatibleHosts?.includes(parent.productId))) {
    return undefined
  }
  const inheritedFinish = resolveItemFinish(
    document,
    { productId, variantId, finishOverride: 'system' },
    catalog,
  )
  const compatibleBays =
    accessory && parent
      ? [parent.bayIndex]
      : document.system.bays
          .map((_, index) => index)
          .sort((a, b) => Number(a !== preferredBayIndex) - Number(b !== preferredBayIndex))
          .filter((index) => variant.bayCentres?.includes(document.system.bays[index].centreWidth))

  for (const bayIndex of compatibleBays) {
    const bay = document.system.bays[bayIndex]
    if (variant.bayCentres?.length && !variant.bayCentres.includes(bay.centreWidth)) continue
    const heights =
      accessory && parent
        ? [parent.height]
        : isIntegratedTable(productId)
          ? [740]
          : Array.from(
              {
                length: Math.max(
                  0,
                  Math.floor(
                    (document.room.ceilingHeight - document.system.mountHeight) / VERTICAL_PITCH,
                  ),
                ),
              },
              (_, index) =>
                document.system.mountHeight + VERTICAL_PITCH * 2 + index * VERTICAL_PITCH,
            ).filter((height) => height <= document.room.ceilingHeight)

    for (const height of heights) {
      const candidate: PlacedItem = {
        id,
        productId,
        variantId,
        bayIndex,
        height,
        face: accessory && parent ? parent.face : face,
        finish: inheritedFinish.finish,
        finishOverride: 'system',
        frontFinish: inheritedFinish.frontFinish,
        parentItemId: accessory ? parent?.id : undefined,
        orientation: orientationsFor(productId)[0],
        open: isOpenable(productId) ? false : undefined,
      }
      if (canPlaceItem(document, catalog, candidate)) return candidate
    }
  }
  return undefined
}

export function buildPartsList(
  document: BuilderDocument,
  catalog: CatalogProduct[],
): PartsListLine[] {
  const supportCount = document.system.bays.length + 1
  const lines: PartsListLine[] = []
  const mounting = document.system.mountingType

  const tracks = deriveSupportTrackPlans(document, catalog)
  const postHeight =
    mounting === 'semi-wall'
      ? Math.max(...tracks.map((track) => track.top)) + 55
      : mounting === 'freestanding'
        ? FREESTANDING_MAX_HEIGHT
        : document.room.ceilingHeight
  const trackGroups = new Map<number, number>()
  let cuts = 0
  for (const track of tracks) {
    for (const segment of track.segments) {
      trackGroups.set(segment.stockLength, (trackGroups.get(segment.stockLength) ?? 0) + 1)
      if (segment.cut) cuts += 1
    }
  }
  for (const [length, quantity] of trackGroups) {
    const trackVariantId =
      length === 110
        ? 'e-track-shelf-height-110'
        : length === 395
          ? 'e-track-cabinet-height-395'
          : `e-track-${length}`
    lines.push({
      id: trackVariantId,
      label: `${length} mm E-track`,
      quantity,
      unitPriceEur: findStructureVariant('e-track', trackVariantId)?.estimatedPriceEur,
    })
  }
  if (cuts > 0) {
    lines.push({
      id: 'track-cuts',
      label: 'E-track cutting charge',
      quantity: cuts,
      unitPriceEur: findStructureVariant('track-cutting', 'track-cutting-charge')
        ?.estimatedPriceEur,
      note: 'Estimate per cut; the published price does not state its charging unit.',
    })
  }

  function structureLine(partId: string, variantId: string, label: string, quantity: number) {
    lines.push({
      id: variantId,
      label,
      quantity,
      unitPriceEur: findStructureVariant(partId, variantId)?.estimatedPriceEur,
    })
  }

  if (mounting === 'semi-wall' || mounting === 'floor-to-ceiling') {
    const postFamily = postHeight > 3500 ? 'h-post' : 'x-post'
    const postIds =
      postFamily === 'x-post'
        ? [
            'x-post-up-to-2300',
            'x-post-2310-2600',
            'x-post-2610-2900',
            'x-post-2910-3200',
            'x-post-3210-3500',
          ]
        : [
            'h-post-3510-3800',
            'h-post-3810-4100',
            'h-post-4110-4400',
            'h-post-4410-4700',
            'h-post-4710-5000',
            'h-post-5010-5400',
          ]
    const post = postIds
      .map((id) => findStructureVariant(postFamily, id))
      .find(
        (variant) =>
          variant &&
          postHeight >= (variant.minimumSystemHeight ?? 0) &&
          postHeight <= (variant.maximumSystemHeight ?? Infinity),
      )
    lines.push({
      id: post?.id ?? `${postFamily}-unpriced`,
      label: `${postFamily === 'x-post' ? 'X-post' : 'H-post'} · ${postHeight} mm`,
      quantity: supportCount,
      unitPriceEur: post?.estimatedPriceEur,
    })
    if (document.system.structureOptions?.stabilisingFeet) {
      structureLine(
        'stabilising-foot',
        mounting === 'floor-to-ceiling' ? 'stabilising-foot-pair' : 'stabilising-foot-single',
        mounting === 'floor-to-ceiling' ? 'Pair of stabilising feet' : 'Stabilising foot',
        supportCount,
      )
    }
    if (mounting === 'semi-wall') {
      const bracketCount = postHeight >= 3000 ? 3 : 2
      const bracketVariant =
        document.system.structureOptions?.wallBracket === 'long'
          ? 'wall-bracket-long'
          : 'wall-bracket-short'
      structureLine(
        'wall-bracket',
        bracketVariant,
        document.system.structureOptions?.wallBracket === 'long'
          ? 'Long wall bracket'
          : 'Short wall bracket',
        supportCount * bracketCount,
      )
      if (document.system.structureOptions?.extensionBolts) {
        structureLine(
          'extension-bolt',
          'extension-bolt-65',
          '65 mm extension bolt',
          supportCount * bracketCount,
        )
      }
    }
  }
  if (mounting === 'freestanding') {
    lines.push({
      id: 'h-post-up-to-1870',
      label: 'H-post · up to 1870 mm',
      quantity: supportCount,
      note: 'The published price bands start at 1910 mm, above the freestanding limit; planner pricing required.',
    })
    structureLine(
      'stabilising-foot',
      'stabilising-foot-pair',
      'Pair of stabilising feet',
      supportCount,
    )
  }
  if (mounting !== 'wall') {
    for (const width of [667, 912] as const) {
      const bayCount = document.system.bays.filter((bay) => bay.centreWidth === width).length
      if (bayCount) {
        const tall = postHeight >= 3000
        const useWideMiddleRail = mounting === 'floor-to-ceiling' && postHeight <= 3500 && tall
        const narrowRailCount = tall && !useWideMiddleRail ? 3 : 2
        structureLine(
          'cross-rail',
          `cross-rail-${width}-50`,
          `${width === 667 ? 622 : 867} mm × 50 cross rail`,
          bayCount * narrowRailCount,
        )
        if (useWideMiddleRail)
          structureLine(
            'cross-rail',
            `cross-rail-${width}-175`,
            `${width === 667 ? 622 : 867} mm × 175 cross rail`,
            bayCount,
          )
        if (document.system.structureOptions?.cableChannels) {
          const channelLength = width === 667 ? 570 : 815
          structureLine(
            'cable-channel',
            `cable-channel-${channelLength}`,
            `${channelLength} mm cable channel`,
            bayCount,
          )
        }
      }
    }
  }

  const grouped = new Map<string, PartsListLine>()
  for (const item of document.system.items) {
    const product = catalog.find((entry) => entry.id === item.productId)
    const variant = variantFor(item, catalog)
    if (!product || !variant) continue
    const resolvedFinish = resolveItemFinish(document, item, catalog)
    const key = `${item.productId}/${item.variantId}/${resolvedFinish.finish}/${resolvedFinish.frontFinish ?? ''}`
    const found = grouped.get(key)
    if (found) found.quantity += 1
    else
      grouped.set(key, {
        id: key,
        label: `${product.name}, ${variant.name} · ${resolvedFinish.materialLabel ?? (resolvedFinish.finish === 'beech' ? `beech / ${resolvedFinish.frontFinish ?? 'off-white'} front` : resolvedFinish.finish)}`,
        quantity: 1,
        unitPriceEur: priceForVariant(variant, resolvedFinish.finish),
      })
  }
  return [...lines, ...grouped.values()]
}
