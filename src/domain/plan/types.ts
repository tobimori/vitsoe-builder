import type {
  BayWidth,
  Colour,
  Face,
  Finish,
  ItemOrientation,
  Millimetres,
  MountingType,
} from '../types'

export interface Room {
  width: Millimetres
  depth: Millimetres
  ceilingHeight: Millimetres
}

export interface Bay {
  id: string
  centreWidth: BayWidth
}

export type Rotation = 0 | 90 | 180 | 270

export interface Placement {
  /** Distance of the run's left end from the left wall. */
  x: Millimetres
  /** Distance of the supports from the back wall. */
  z: Millimetres
  rotation: Rotation
}

export interface SystemFinish {
  colour: Colour
  wood: 'laminate' | 'beech'
}

export interface StructureOptions {
  wallBracket: 'short' | 'long'
  extensionBolts: boolean
  cableChannels: boolean
  stabilisingFeet: boolean
}

export type TrackMode = 'automatic' | 'manual'

export interface ShelfDecor {
  kind: 'vinyl' | 'art-books'
  arrangement: 'upright' | 'stacked'
  count: number
  position: 'left' | 'centre' | 'right'
}

export interface PlanItem {
  id: string
  productId: string
  variantId: string
  bayIndex: number
  /** Pin height above the finished floor. */
  height: Millimetres
  face: Face
  /** `system` follows the plan's system finish. */
  finish: Finish | 'system'
  /** Front colour for an explicit beech finish. */
  frontFinish?: Colour
  orientation?: ItemOrientation
  /** Accessories attach to this host component. */
  parentItemId?: string
  open?: boolean
  decor?: ShelfDecor
}

export interface PlanSystem {
  mountingType: MountingType
  bays: readonly Bay[]
  items: readonly PlanItem[]
  placement: Placement
  trackMode: TrackMode
  /** Installed E-track length in manual mode. */
  railHeight: Millimetres
  /** Height of the bottom of an E-track above the finished floor. */
  mountHeight: Millimetres
  finish: SystemFinish
  structureOptions: StructureOptions
}

export interface Plan {
  version: 2
  name: string
  room: Room
  system: PlanSystem
}
