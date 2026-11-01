import type { BayWidth, Face, Finish, Millimetres, MountingType } from '../types'

export type ProductCategory = 'shelves' | 'cabinets' | 'tables' | 'accessories'

export interface ProductVariant {
  id: string
  name: string
  width: Millimetres
  height: Millimetres
  depth: Millimetres
  finishes: Finish[]
  faces: Face[]
  mountingTypes?: MountingType[]
  estimatedPriceEur?: number
  estimatedBeechPriceEur?: number
  bayCentres?: BayWidth[]
  innerWidth?: Millimetres
  innerHeight?: Millimetres
  innerDepth?: Millimetres
  closedDepth?: Millimetres
}

export interface CatalogProduct {
  id: string
  name: string
  category: ProductCategory
  description?: string
  /** Accessories attach to one of these host products. */
  compatibleHosts?: string[]
  variants: ProductVariant[]
}

export interface StructureVariant {
  id: string
  name: string
  width: Millimetres
  height: Millimetres
  depth: Millimetres
  estimatedPriceEur?: number
  bayCentres?: BayWidth[]
  mountingTypes?: MountingType[]
  minimumSystemHeight?: Millimetres
  maximumSystemHeight?: Millimetres
  recommendedTrackLengths?: Millimetres[]
  note?: string
}

export interface StructurePart {
  id: string
  name: string
  description: string
  variants: StructureVariant[]
}
