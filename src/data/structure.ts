import type { MountingType } from '../domain/types'

export interface StructureVariant {
  id: string
  name: string
  width: number
  height: number
  depth: number
  estimatedPriceEur?: number
  bayCentres?: (667 | 912)[]
  mountingTypes?: MountingType[]
  minimumSystemHeight?: number
  maximumSystemHeight?: number
  recommendedTrackLengths?: number[]
  note?: string
}

export interface StructurePart {
  id: string
  name: string
  description: string
  variants: StructureVariant[]
}

export const structureCatalogue: StructurePart[] = [
  {
    id: 'e-track',
    name: 'E-track',
    description: 'Anodized aluminium track with a 70 mm vertical pin pitch.',
    variants: [
      {
        id: 'e-track-shelf-height-110',
        name: 'Shelf-height · 110',
        width: 20,
        height: 110,
        depth: 20,
        estimatedPriceEur: 30,
        mountingTypes: ['wall', 'semi-wall', 'floor-to-ceiling'],
        note: 'For light loads on solid walls or X-posts; a shelf finishes flush at both ends.',
      },
      {
        id: 'e-track-cabinet-height-395',
        name: 'Cabinet-height · 395',
        width: 20,
        height: 395,
        depth: 20,
        estimatedPriceEur: 40,
        mountingTypes: ['wall', 'semi-wall', 'floor-to-ceiling'],
        note: 'A cabinet finishes flush at both ends; do not place directly below another E-track.',
      },
      { id: 'e-track-570', name: '570', width: 20, height: 570, depth: 20, estimatedPriceEur: 60 },
      {
        id: 'e-track-1140',
        name: '1140',
        width: 20,
        height: 1140,
        depth: 20,
        estimatedPriceEur: 75,
      },
      {
        id: 'e-track-1710',
        name: '1710',
        width: 20,
        height: 1710,
        depth: 20,
        estimatedPriceEur: 90,
      },
      {
        id: 'e-track-2000',
        name: '2000',
        width: 20,
        height: 2000,
        depth: 20,
        estimatedPriceEur: 95,
      },
    ],
  },
  {
    id: 'track-cutting',
    name: 'E-track cutting',
    description: 'Factory cutting charge for a non-standard E-track length.',
    variants: [
      {
        id: 'track-cutting-charge',
        name: 'Cut to another length',
        width: 0,
        height: 0,
        depth: 0,
        estimatedPriceEur: 25,
        note: 'The price list does not state the charging unit.',
      },
    ],
  },
  {
    id: 'x-post',
    name: 'X-post',
    description:
      'Cut-to-height anodized aluminium post for semi-wall-mounted and compressed structures.',
    variants: [
      {
        id: 'x-post-up-to-2300',
        name: 'Up to 2300',
        width: 0,
        height: 2300,
        depth: 0,
        estimatedPriceEur: 270,
        minimumSystemHeight: 0,
        maximumSystemHeight: 2300,
        recommendedTrackLengths: [1710],
      },
      {
        id: 'x-post-2310-2600',
        name: '2310–2600',
        width: 0,
        height: 2600,
        depth: 0,
        estimatedPriceEur: 288,
        minimumSystemHeight: 2310,
        maximumSystemHeight: 2600,
        recommendedTrackLengths: [2000],
      },
      {
        id: 'x-post-2610-2900',
        name: '2610–2900',
        width: 0,
        height: 2900,
        depth: 0,
        estimatedPriceEur: 306,
        minimumSystemHeight: 2610,
        maximumSystemHeight: 2900,
        recommendedTrackLengths: [1710, 570],
      },
      {
        id: 'x-post-2910-3200',
        name: '2910–3200',
        width: 0,
        height: 3200,
        depth: 0,
        estimatedPriceEur: 324,
        minimumSystemHeight: 2910,
        maximumSystemHeight: 3200,
        recommendedTrackLengths: [2000, 570],
      },
      {
        id: 'x-post-3210-3500',
        name: '3210–3500',
        width: 0,
        height: 3500,
        depth: 0,
        estimatedPriceEur: 342,
        minimumSystemHeight: 3210,
        maximumSystemHeight: 3500,
        recommendedTrackLengths: [1710, 1140],
        note: 'The supplied German price list ends this X-post table at 3500 mm.',
      },
    ],
  },
  {
    id: 'h-post',
    name: 'H-post',
    description: 'Anodized aluminium post for free-standing and taller compressed structures.',
    variants: [
      {
        id: 'h-post-1910-2000',
        name: '1910–2000',
        width: 0,
        height: 2000,
        depth: 0,
        estimatedPriceEur: 315,
        minimumSystemHeight: 1910,
        maximumSystemHeight: 2000,
      },
      {
        id: 'h-post-3510-3800',
        name: '3510–3800',
        width: 0,
        height: 3800,
        depth: 0,
        estimatedPriceEur: 459,
        minimumSystemHeight: 3510,
        maximumSystemHeight: 3800,
      },
      {
        id: 'h-post-3810-4100',
        name: '3810–4100',
        width: 0,
        height: 4100,
        depth: 0,
        estimatedPriceEur: 483,
        minimumSystemHeight: 3810,
        maximumSystemHeight: 4100,
      },
      {
        id: 'h-post-4110-4400',
        name: '4110–4400',
        width: 0,
        height: 4400,
        depth: 0,
        estimatedPriceEur: 507,
        minimumSystemHeight: 4110,
        maximumSystemHeight: 4400,
      },
      {
        id: 'h-post-4410-4700',
        name: '4410–4700',
        width: 0,
        height: 4700,
        depth: 0,
        estimatedPriceEur: 531,
        minimumSystemHeight: 4410,
        maximumSystemHeight: 4700,
      },
      {
        id: 'h-post-4710-5000',
        name: '4710–5000',
        width: 0,
        height: 5000,
        depth: 0,
        estimatedPriceEur: 555,
        minimumSystemHeight: 4710,
        maximumSystemHeight: 5000,
      },
      {
        id: 'h-post-5010-5400',
        name: '5010–5400',
        width: 0,
        height: 5400,
        depth: 0,
        estimatedPriceEur: 587,
        minimumSystemHeight: 5010,
        maximumSystemHeight: 5400,
      },
    ],
  },
  {
    id: 'wall-bracket',
    name: 'Wall bracket',
    description: 'Powder-coated aluminium tie for securing an X-post to a wall.',
    variants: [
      {
        id: 'wall-bracket-short',
        name: '60–70 deep',
        width: 125,
        height: 125,
        depth: 70,
        estimatedPriceEur: 50,
        mountingTypes: ['semi-wall'],
      },
      {
        id: 'wall-bracket-long',
        name: '100–110 deep',
        width: 125,
        height: 125,
        depth: 110,
        estimatedPriceEur: 50,
        mountingTypes: ['semi-wall'],
      },
    ],
  },
  {
    id: 'extension-bolt',
    name: 'Extension bolt',
    description: 'Extension for a wall bracket where a deeper obstruction must be cleared.',
    variants: [
      {
        id: 'extension-bolt-65',
        name: '65 deep',
        width: 15,
        height: 15,
        depth: 65,
        estimatedPriceEur: 20,
        mountingTypes: ['semi-wall'],
      },
    ],
  },
  {
    id: 'cross-rail',
    name: 'Cross rail',
    description: 'Anodized aluminium brace between adjacent X- or H-posts.',
    variants: [
      {
        id: 'cross-rail-667-50',
        name: '622 wide · 50 high',
        width: 622,
        height: 50,
        depth: 15,
        bayCentres: [667],
        estimatedPriceEur: 90,
      },
      {
        id: 'cross-rail-912-50',
        name: '867 wide · 50 high',
        width: 867,
        height: 50,
        depth: 15,
        bayCentres: [912],
        estimatedPriceEur: 100,
      },
      {
        id: 'cross-rail-667-175',
        name: '622 wide · 175 high',
        width: 622,
        height: 175,
        depth: 15,
        bayCentres: [667],
        estimatedPriceEur: 155,
      },
      {
        id: 'cross-rail-912-175',
        name: '867 wide · 175 high',
        width: 867,
        height: 175,
        depth: 15,
        bayCentres: [912],
        estimatedPriceEur: 165,
      },
    ],
  },
  {
    id: 'stabilising-foot',
    name: 'Stabilising foot',
    description: 'Anodized aluminium outrigger for floor-supported structures.',
    variants: [
      {
        id: 'stabilising-foot-single',
        name: 'Single · 465 deep',
        width: 20,
        height: 145,
        depth: 465,
        estimatedPriceEur: 175,
        mountingTypes: ['semi-wall', 'floor-to-ceiling', 'freestanding'],
      },
      {
        id: 'stabilising-foot-pair',
        name: 'Pair · 850 deep',
        width: 20,
        height: 145,
        depth: 850,
        estimatedPriceEur: 350,
        mountingTypes: ['floor-to-ceiling', 'freestanding'],
      },
    ],
  },
  {
    id: 'cable-channel',
    name: 'Cable channel',
    description: 'Grey cable channel for X-posts and cross rails.',
    variants: [
      {
        id: 'cable-channel-570',
        name: '570 wide',
        width: 570,
        height: 20,
        depth: 15,
        estimatedPriceEur: 12,
      },
      {
        id: 'cable-channel-815',
        name: '815 wide',
        width: 815,
        height: 30,
        depth: 30,
        estimatedPriceEur: 15,
      },
    ],
  },
]

export const structureRules: Record<
  MountingType,
  {
    label: string
    sideClearance: number
    normalTrackBaseline: number
    postType: 'none' | 'x-post' | 'h-post-or-x-post' | 'h-post'
    doubleSided: boolean | 'optional'
    maximumOverallHeight?: number
  }
> = {
  wall: {
    label: 'Wall-mounted',
    sideClearance: 35,
    normalTrackBaseline: 345,
    postType: 'none',
    doubleSided: false,
  },
  'semi-wall': {
    label: 'Semi-wall-mounted',
    sideClearance: 65,
    normalTrackBaseline: 205,
    postType: 'x-post',
    doubleSided: false,
  },
  'floor-to-ceiling': {
    label: 'Compressed',
    sideClearance: 65,
    normalTrackBaseline: 205,
    postType: 'h-post-or-x-post',
    doubleSided: 'optional',
  },
  freestanding: {
    label: 'Free-standing',
    sideClearance: 65,
    normalTrackBaseline: 205,
    postType: 'h-post',
    doubleSided: true,
    maximumOverallHeight: 1915,
  },
}

export const structurePriceSource = {
  priceList: 'Vitsœ EUR price list',
  priceListMonth: '2026-08',
  hPostPageChecked: '2026-09-12',
  region: 'Germany',
  vatRate: 0.19,
  pricesIncludeVat: true,
  notes: [
    'The price list does not publish H-post prices; those bands come from the current German components page.',
    'No H-post price row is published for 2010–3500 mm, so no price is interpolated.',
    'The 622/867 mm cross-rail to 667/912 mm bay mapping follows the matching bay geometry.',
    'The public documents disagree at the exactly-3000 mm third-brace boundary; send that case to a planner.',
  ],
} as const

const standardTrackLengths = [570, 1140, 1710, 2000] as const

export interface TrackRecommendation {
  stockLengths: number[]
  finalLengths: number[]
  totalLength: number
  cutAmount: number
  needsCut: boolean
  estimatedPriceEur: number
  cuttingChargeEur?: number
  fitsAvailableHeight: boolean
}

/** Selects general-purpose stock by fitted cost, joins, then unused installed length. */
export function recommendETracks(
  requiredLength: number,
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

  const priceByLength = new Map([
    [570, 60],
    [1140, 75],
    [1710, 90],
    [2000, 95],
  ])
  const maximumSegments = Math.ceil(requiredLength / 2000) + 1
  let best: number[] | undefined

  function score(candidate: number[]) {
    const stockTotal = candidate.reduce((sum, length) => sum + length, 0)
    const cut = requiredLength <= availableHeight && stockTotal > availableHeight
    const installedTotal = cut ? availableHeight : stockTotal
    const price =
      candidate.reduce((sum, length) => sum + (priceByLength.get(length) ?? 0), 0) + (cut ? 25 : 0)
    return { price, joins: candidate.length - 1, unused: installedTotal - requiredLength }
  }

  function isBetter(candidate: number[], current: number[]) {
    const candidateScore = score(candidate)
    const currentScore = score(current)
    if (candidateScore.price !== currentScore.price)
      return candidateScore.price < currentScore.price
    if (candidateScore.joins !== currentScore.joins)
      return candidateScore.joins < currentScore.joins
    return candidateScore.unused < currentScore.unused
  }

  function visit(chosen: number[], total: number, startIndex: number) {
    if (total >= requiredLength) {
      if (!best || isBetter(chosen, best)) best = chosen
      return
    }
    if (chosen.length >= maximumSegments) return
    for (let index = startIndex; index < standardTrackLengths.length; index += 1) {
      const length = standardTrackLengths[index]
      visit([...chosen, length], total + length, index)
    }
  }

  visit([], 0, 0)
  const stockLengths = best ?? [2000]
  const stockTotal = stockLengths.reduce((sum, length) => sum + length, 0)
  const cutAmount =
    requiredLength <= availableHeight ? Math.max(0, stockTotal - availableHeight) : 0
  const finalLengths = [...stockLengths]
  if (cutAmount > 0) finalLengths[finalLengths.length - 1] -= cutAmount
  const estimatedPriceEur = stockLengths.reduce(
    (sum, length) => sum + (priceByLength.get(length) ?? 0),
    0,
  )

  return {
    stockLengths,
    finalLengths,
    totalLength: finalLengths.reduce((sum, length) => sum + length, 0),
    cutAmount,
    needsCut: cutAmount > 0,
    estimatedPriceEur,
    cuttingChargeEur: cutAmount > 0 ? 25 : undefined,
    fitsAvailableHeight: requiredLength <= availableHeight,
  }
}

export function findStructurePart(partId: string) {
  return structureCatalogue.find((part) => part.id === partId)
}

export function findStructureVariant(partId: string, variantId: string) {
  return findStructurePart(partId)?.variants.find((variant) => variant.id === variantId)
}
