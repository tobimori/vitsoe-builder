import type { Catalog } from '../catalog/catalog'
import { isAccessory } from '../catalog/catalog'
import { structurePrice } from '../catalog/structure'
import { carrierHeight, VERTICAL_PITCH } from '../placement/grid'
import { allowedFaces } from '../plan/system'
import type { Plan, PlanItem } from '../plan/types'
import type { Face, Millimetres } from '../types'

/** Pins need this much track beyond a hole, so holes at cut edges and joins are unsafe. */
export const TRACK_EDGE_ALLOWANCE = 10

export const FREESTANDING_MAX_HEIGHT = 1915

const standardTrackLengths = [570, 1140, 1710, 2000] as const

/** Dedicated short profiles are never cut or stacked. */
const specialTracks: Partial<Record<number, string>> = {
  110: 'e-track-shelf-height-110',
  395: 'e-track-cabinet-height-395',
}

export function trackVariantId(length: Millimetres) {
  return specialTracks[length] ?? `e-track-${length}`
}

function trackPrice(length: Millimetres) {
  return structurePrice('e-track', trackVariantId(length)) ?? 0
}

const cuttingCharge = structurePrice('track-cutting', 'track-cutting-charge') ?? 0

export interface TrackRecommendation {
  stockLengths: Millimetres[]
  finalLengths: Millimetres[]
  totalLength: Millimetres
  cutAmount: Millimetres
  needsCut: boolean
  estimatedPriceEur: number
  cuttingChargeEur?: number
  fitsAvailableHeight: boolean
}

/** Selects general-purpose stock by fitted cost, joins, then unused installed length. */
export function recommendETracks(
  requiredLength: Millimetres,
  availableHeight = Number.POSITIVE_INFINITY,
): TrackRecommendation {
  if (!Number.isFinite(requiredLength) || requiredLength <= 0) {
    return {
      stockLengths: [],
      finalLengths: [],
      totalLength: 0,
      cutAmount: 0,
      needsCut: false,
      estimatedPriceEur: 0,
      fitsAvailableHeight: true,
    }
  }

  const sum = (lengths: readonly number[]) => lengths.reduce((total, length) => total + length, 0)
  const price = (lengths: readonly number[]) =>
    lengths.reduce((total, length) => total + trackPrice(length), 0)

  function score(candidate: number[]) {
    const stockTotal = sum(candidate)
    const cut = requiredLength <= availableHeight && stockTotal > availableHeight
    const installedTotal = cut ? availableHeight : stockTotal
    return {
      price: price(candidate) + (cut ? cuttingCharge : 0),
      joins: candidate.length - 1,
      unused: installedTotal - requiredLength,
    }
  }

  function isBetter(candidate: number[], current: number[]) {
    const a = score(candidate)
    const b = score(current)
    if (a.price !== b.price) return a.price < b.price
    if (a.joins !== b.joins) return a.joins < b.joins
    return a.unused < b.unused
  }

  const maximumSegments = Math.ceil(requiredLength / 2000) + 1
  let best: number[] | undefined

  function visit(chosen: number[], total: number, startIndex: number) {
    if (total >= requiredLength) {
      if (!best || isBetter(chosen, best)) best = chosen
      return
    }
    if (chosen.length >= maximumSegments) return

    standardTrackLengths.slice(startIndex).forEach((length, offset) => {
      visit([...chosen, length], total + length, startIndex + offset)
    })
  }

  visit([], 0, 0)

  const stockLengths = best ?? [2000]
  const cutAmount =
    requiredLength <= availableHeight ? Math.max(0, sum(stockLengths) - availableHeight) : 0
  const finalLengths = stockLengths.map((length, index) =>
    index === stockLengths.length - 1 ? length - cutAmount : length,
  )

  return {
    stockLengths,
    finalLengths,
    totalLength: sum(finalLengths),
    cutAmount,
    needsCut: cutAmount > 0,
    estimatedPriceEur: price(stockLengths),
    cuttingChargeEur: cutAmount > 0 ? cuttingCharge : undefined,
    fitsAvailableHeight: requiredLength <= availableHeight,
  }
}

export interface TrackSegmentPlan {
  stockLength: Millimetres
  installedLength: Millimetres
  cut: boolean
  estimatedPriceEur: number
}

export interface SupportTrackPlan {
  supportIndex: number
  face: Face
  bottom: Millimetres
  top: Millimetres
  requiredLength: Millimetres
  segments: TrackSegmentPlan[]
  joins: number
  estimatedPriceEur: number
  estimatedCuttingChargeEur: number
}

export function maximumTrackTop(plan: Plan) {
  return plan.system.mountingType === 'freestanding'
    ? FREESTANDING_MAX_HEIGHT
    : plan.room.ceilingHeight
}

/** One track plan per support and face, sized from the components in both adjacent bays. */
export function deriveSupportTrackPlans(plan: Plan, catalog: Catalog): SupportTrackPlan[] {
  const { system } = plan
  const automatic = system.trackMode === 'automatic'
  const normalBottom = system.mountHeight
  const maximumTop = maximumTrackTop(plan)
  const supportIndices = Array.from({ length: system.bays.length + 1 }, (_, index) => index)

  return supportIndices.flatMap((supportIndex) =>
    allowedFaces(plan).map((face): SupportTrackPlan => {
      const pinHeights = system.items
        .filter((item) => {
          const product = catalog.product(item.productId)
          return (
            product &&
            !isAccessory(product) &&
            item.face === face &&
            (item.bayIndex === supportIndex || item.bayIndex + 1 === supportIndex)
          )
        })
        .map((item) => carrierHeight(item, plan))

      const lowestPin = pinHeights.length ? Math.min(...pinHeights) : normalBottom
      const highestPin = pinHeights.length ? Math.max(...pinHeights) : normalBottom + 470
      const carrierBottom = Math.max(0, Math.min(normalBottom, lowestPin))

      const bottom = !automatic
        ? system.mountHeight
        : pinHeights.length > 0 && lowestPin <= normalBottom
          ? Math.max(0, carrierBottom - TRACK_EDGE_ALLOWANCE)
          : carrierBottom
      const requiredLength = automatic
        ? Math.max(570, highestPin - carrierBottom + 100)
        : system.railHeight
      const availableHeight = automatic
        ? maximumTop - bottom
        : Math.min(requiredLength, maximumTop - bottom)

      const special = !automatic && specialTracks[requiredLength] !== undefined
      const recommendation: TrackRecommendation = special
        ? {
            stockLengths: [requiredLength],
            finalLengths: [requiredLength],
            totalLength: requiredLength,
            cutAmount: 0,
            needsCut: false,
            estimatedPriceEur: trackPrice(requiredLength),
            fitsAvailableHeight: requiredLength <= availableHeight,
          }
        : recommendETracks(requiredLength, availableHeight)

      const segments = recommendation.stockLengths.map((stockLength, index) => {
        const installedLength = recommendation.finalLengths[index] ?? stockLength
        return {
          stockLength,
          installedLength,
          cut: installedLength !== stockLength,
          estimatedPriceEur: trackPrice(stockLength),
        }
      })

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

/** Usable hole heights: holes within the edge allowance of a cut or join are skipped. */
export function trackHoleHeights(plan: SupportTrackPlan, gridOrigin: Millimetres) {
  const holes: Millimetres[] = []
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

export function supportTrackAcceptsPin(
  plan: SupportTrackPlan,
  height: Millimetres,
  gridOrigin: Millimetres,
) {
  return trackHoleHeights(plan, gridOrigin).includes(height)
}

/** Post height for post-based structures; semi-wall posts end 55 mm above the tracks. */
export function postHeight(plan: Plan, tracks: SupportTrackPlan[]) {
  switch (plan.system.mountingType) {
    case 'wall':
      return undefined
    case 'semi-wall':
      return Math.max(...tracks.map((track) => track.top)) + 55
    case 'freestanding':
      return FREESTANDING_MAX_HEIGHT
    case 'floor-to-ceiling':
      return plan.room.ceilingHeight
  }
}

/** H-posts carry freestanding systems and every structure taller than 3500 mm. */
export function usesHPosts(plan: Plan, tracks: SupportTrackPlan[]) {
  return plan.system.mountingType === 'freestanding' || (postHeight(plan, tracks) ?? 0) > 3500
}

/** Whether a track next to one of these components grows taller than the room allows. */
export function itemsHaveTrackHeightError(
  plan: Plan,
  catalog: Catalog,
  items: readonly PlanItem[],
) {
  const affected = new Set(
    items.flatMap((item) => [`${item.face}:${item.bayIndex}`, `${item.face}:${item.bayIndex + 1}`]),
  )
  const maximumTop = maximumTrackTop(plan)

  return deriveSupportTrackPlans(plan, catalog).some(
    (track) => affected.has(`${track.face}:${track.supportIndex}`) && track.top > maximumTop,
  )
}
