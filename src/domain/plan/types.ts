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

export type Wall = 'back' | 'left' | 'right' | 'front'

export interface Placement {
  /** The wall the run stands along. Its front faces into the room, away from the wall. */
  wall: Wall
  /** From the wall's left corner, as seen facing the wall, to the first support's centre. */
  offset: Millimetres
  /** From the wall to the centre line of the supports. */
  distance: Millimetres
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
  /** Where a bookend stands along its shelf, from the shelf's centre. */
  offset?: Millimetres
  open?: boolean
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
