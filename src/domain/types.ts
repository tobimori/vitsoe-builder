export type Millimetres = number

export type MountingType = 'wall' | 'semi-wall' | 'floor-to-ceiling' | 'freestanding'

export type FinishId = 'off-white' | 'black' | 'silver' | 'beech'
export type FrontFinish = 'off-white' | 'black' | 'silver'
export type SystemColour = 'off-white' | 'black' | 'silver'
export type Face = 'front' | 'back'
export type ItemOrientation = 'standard' | 'inverted' | 'vertical'
export type ViewMode = 'orbit' | 'front' | 'back'

export interface RoomDimensions {
  width: Millimetres
  depth: Millimetres
  ceilingHeight: Millimetres
}

export interface RoomState extends RoomDimensions {
  showDimensions: boolean
}

export interface SystemPlacement {
  x: Millimetres
  z: Millimetres
  rotation: 0 | 90 | 180 | 270
}

export interface Bay {
  id: string
  centreWidth: 667 | 912
}

export type ProductCategory = 'shelves' | 'cabinets' | 'tables' | 'accessories'

export interface ProductVariant {
  id: string
  name: string
  width: Millimetres
  height: Millimetres
  depth: Millimetres
  finishes: FinishId[]
  faces: Face[]
  mountingTypes?: MountingType[]
  estimatedPriceEur?: number
  estimatedBeechPriceEur?: number
  bayCentres?: (667 | 912)[]
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
  compatibleHosts?: string[]
  variants: ProductVariant[]
}

export interface PlacedItem {
  id: string
  productId: string
  variantId: string
  bayIndex: number
  height: Millimetres
  face: Face
  finish: FinishId
  /** Missing means the legacy `finish` value is an explicit override. */
  finishOverride?: FinishId | 'system'
  frontFinish?: FrontFinish
  orientation?: ItemOrientation
  /** Accessories such as bookends attach to this component. */
  parentItemId?: string
  open?: boolean
}

export interface SystemState {
  mountingType: MountingType
  bays: Bay[]
  items: PlacedItem[]
  placement: SystemPlacement
  railHeight: Millimetres
  /** Height of the bottom of an E-track above the finished floor. */
  mountHeight: Millimetres
  trackMode?: 'automatic' | 'manual'
  activeFace?: Face
  finish?: {
    colour: SystemColour
    wood: 'laminate' | 'beech'
  }
  structureOptions?: {
    wallBracket: 'short' | 'long'
    extensionBolts: boolean
    cableChannels: boolean
    stabilisingFeet: boolean
  }
}

export interface ConnectedSupportMove {
  x: Millimetres
  z: Millimetres
  mountHeight: Millimetres
}

export interface ItemDragStatus {
  itemId: string
  face: Face
  valid: boolean
  duplicate?: boolean
  clientX: number
  clientY: number
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

export interface BuilderDocument {
  version: 1
  name: string
  room: RoomState
  system: SystemState
}

export interface ValidationIssue {
  code:
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
  severity: 'error' | 'advisory'
  message: string
  itemIds?: string[]
}

export interface PartsListLine {
  id: string
  label: string
  quantity: number
  unitPriceEur?: number
  note?: string
}

/** Props implemented by src/scene; domain measurements stay as integer mm. */
export interface BuilderSceneProps {
  document: BuilderDocument
  catalog: CatalogProduct[]
  selectedItemId: string | null
  selectedSupportIndex: number | null
  viewMode: ViewMode
  cameraFitRevision?: number
  onSelectItem: (itemId: string | null) => void
  onSelectSupport: (supportIndex: number | null) => void
  onMoveItem: (
    itemId: string,
    bayIndex: number,
    height: Millimetres,
    face: Face,
    duplicate?: boolean,
  ) => void
  onMoveConnectedSupports: (move: ConnectedSupportMove) => void
  dragFaceOverride?: Face | null
  cancelDragRevision?: number
  onItemDragStatusChange?: (status: ItemDragStatus | null) => void
  onExportUsdzReady?: (exportUsdz: () => Promise<Blob>) => void
}
