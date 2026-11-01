import type { Catalog } from '../catalog/catalog'
import { priceForVariant } from '../catalog/catalog'
import { findStructureVariant, structurePrice } from '../catalog/structure'
import { resolveItemFinish } from '../plan/finish'
import type { Plan } from '../plan/types'
import { deriveSupportTrackPlans, postHeight, trackVariantId } from '../supports/tracks'

export interface PartsListLine {
  id: string
  label: string
  quantity: number
  unitPriceEur?: number
  note?: string
}

const xPosts = [
  'x-post-up-to-2300',
  'x-post-2310-2600',
  'x-post-2610-2900',
  'x-post-2910-3200',
  'x-post-3210-3500',
]

const hPosts = [
  'h-post-3510-3800',
  'h-post-3810-4100',
  'h-post-4110-4400',
  'h-post-4410-4700',
  'h-post-4710-5000',
  'h-post-5010-5400',
]

function structureLine(partId: string, variantId: string, label: string, quantity: number) {
  return { id: variantId, label, quantity, unitPriceEur: structurePrice(partId, variantId) }
}

function trackLines(plan: Plan, catalog: Catalog): PartsListLine[] {
  const quantities = new Map<number, number>()
  let cuts = 0

  for (const track of deriveSupportTrackPlans(plan, catalog)) {
    for (const segment of track.segments) {
      quantities.set(segment.stockLength, (quantities.get(segment.stockLength) ?? 0) + 1)
      if (segment.cut) cuts += 1
    }
  }

  const lines: PartsListLine[] = [...quantities].map(([length, quantity]) =>
    structureLine('e-track', trackVariantId(length), `${length} mm E-track`, quantity),
  )

  if (cuts > 0) {
    lines.push({
      ...structureLine('track-cutting', 'track-cutting-charge', 'E-track cutting charge', cuts),
      id: 'track-cuts',
      note: 'Estimate per cut; the published price does not state its charging unit.',
    })
  }

  return lines
}

function structureLines(plan: Plan, catalog: Catalog): PartsListLine[] {
  const { mountingType, structureOptions, bays } = plan.system
  const supportCount = bays.length + 1
  const height = postHeight(plan, deriveSupportTrackPlans(plan, catalog)) ?? 0
  const lines: PartsListLine[] = []

  if (mountingType === 'semi-wall' || mountingType === 'floor-to-ceiling') {
    const family = height > 3500 ? 'h-post' : 'x-post'
    const post = (family === 'x-post' ? xPosts : hPosts)
      .map((id) => findStructureVariant(family, id))
      .find(
        (variant) =>
          variant &&
          height >= (variant.minimumSystemHeight ?? 0) &&
          height <= (variant.maximumSystemHeight ?? Number.POSITIVE_INFINITY),
      )
    lines.push({
      id: post?.id ?? `${family}-unpriced`,
      label: `${family === 'x-post' ? 'X-post' : 'H-post'} · ${height} mm`,
      quantity: supportCount,
      unitPriceEur: post?.estimatedPriceEur,
    })

    if (structureOptions.stabilisingFeet) {
      lines.push(
        mountingType === 'floor-to-ceiling'
          ? structureLine(
              'stabilising-foot',
              'stabilising-foot-pair',
              'Pair of stabilising feet',
              supportCount,
            )
          : structureLine(
              'stabilising-foot',
              'stabilising-foot-single',
              'Stabilising foot',
              supportCount,
            ),
      )
    }

    if (mountingType === 'semi-wall') {
      const brackets = supportCount * (height >= 3000 ? 3 : 2)
      lines.push(
        structureOptions.wallBracket === 'long'
          ? structureLine('wall-bracket', 'wall-bracket-long', 'Long wall bracket', brackets)
          : structureLine('wall-bracket', 'wall-bracket-short', 'Short wall bracket', brackets),
      )
      if (structureOptions.extensionBolts) {
        lines.push(
          structureLine('extension-bolt', 'extension-bolt-65', '65 mm extension bolt', brackets),
        )
      }
    }
  }

  if (mountingType === 'freestanding') {
    lines.push(
      {
        id: 'h-post-up-to-1870',
        label: 'H-post · up to 1870 mm',
        quantity: supportCount,
        note: 'The published price bands start at 1910 mm, above the freestanding limit; planner pricing required.',
      },
      structureLine(
        'stabilising-foot',
        'stabilising-foot-pair',
        'Pair of stabilising feet',
        supportCount,
      ),
    )
  }

  if (mountingType !== 'wall') {
    for (const width of [667, 912] as const) {
      const bayCount = bays.filter((bay) => bay.centreWidth === width).length
      if (!bayCount) continue

      const railLength = width === 667 ? 622 : 867
      const tall = height >= 3000
      const wideMiddleRail = mountingType === 'floor-to-ceiling' && height <= 3500 && tall
      lines.push(
        structureLine(
          'cross-rail',
          `cross-rail-${width}-50`,
          `${railLength} mm × 50 cross rail`,
          bayCount * (tall && !wideMiddleRail ? 3 : 2),
        ),
      )
      if (wideMiddleRail) {
        lines.push(
          structureLine(
            'cross-rail',
            `cross-rail-${width}-175`,
            `${railLength} mm × 175 cross rail`,
            bayCount,
          ),
        )
      }
      if (structureOptions.cableChannels) {
        const channelLength = width === 667 ? 570 : 815
        lines.push(
          structureLine(
            'cable-channel',
            `cable-channel-${channelLength}`,
            `${channelLength} mm cable channel`,
            bayCount,
          ),
        )
      }
    }
  }

  return lines
}

function componentLines(plan: Plan, catalog: Catalog): PartsListLine[] {
  const lines = new Map<string, PartsListLine>()

  for (const item of plan.system.items) {
    const product = catalog.product(item.productId)
    const variant = catalog.variant(item.productId, item.variantId)
    if (!product || !variant) continue

    const { finish, frontFinish, materialLabel } = resolveItemFinish(
      plan.system.finish,
      item,
      catalog,
    )
    const key = `${item.productId}/${item.variantId}/${finish}/${frontFinish ?? ''}`
    const existing = lines.get(key)
    if (existing) {
      existing.quantity += 1
      continue
    }

    const appearance =
      materialLabel ?? (finish === 'beech' ? `beech / ${frontFinish ?? 'off-white'} front` : finish)
    lines.set(key, {
      id: key,
      label: `${product.name}, ${variant.name} · ${appearance}`,
      quantity: 1,
      unitPriceEur: priceForVariant(variant, finish),
    })
  }

  return [...lines.values()]
}

/** Every part to order: tracks, structure, then the components grouped by appearance. */
export function buildPartsList(plan: Plan, catalog: Catalog): PartsListLine[] {
  return [
    ...trackLines(plan, catalog),
    ...structureLines(plan, catalog),
    ...componentLines(plan, catalog),
  ]
}

export function partsTotal(lines: PartsListLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity * (line.unitPriceEur ?? 0), 0)
}

export function partsQuantity(lines: PartsListLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}
