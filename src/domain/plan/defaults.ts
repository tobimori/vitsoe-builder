import type { BayWidth } from '../types'
import type { Plan, PlanItem, StructureOptions } from './types'

export const defaultStructureOptions: StructureOptions = {
  wallBracket: 'short',
  extensionBolts: false,
  cableChannels: false,
  stabilisingFeet: false,
}

const shelf = (
  id: string,
  width: BayWidth,
  depth: number,
  bayIndex: number,
  height: number,
): PlanItem => ({
  id,
  productId: 'shelf',
  variantId: `steel-${width}-${depth}`,
  bayIndex,
  height,
  face: 'front',
  finish: 'system',
  orientation: 'standard',
})

export const initialPlan: Plan = {
  version: 2,
  name: 'Untitled 606 system',
  room: {
    width: 4200,
    depth: 3600,
    ceilingHeight: 2600,
  },
  system: {
    mountingType: 'wall',
    bays: [
      { id: 'bay-1', centreWidth: 912 },
      { id: 'bay-2', centreWidth: 667 },
      { id: 'bay-3', centreWidth: 912 },
    ],
    items: [
      shelf('item-1', 912, 220, 0, 590),
      shelf('item-2', 912, 220, 0, 940),
      shelf('item-3', 912, 220, 0, 1290),
      shelf('item-4', 667, 300, 1, 590),
      {
        id: 'item-cabinet',
        productId: 'cabinet',
        variantId: 'cabinet-667',
        bayIndex: 1,
        height: 1080,
        face: 'front',
        finish: 'system',
        open: false,
      },
      shelf('item-5', 667, 220, 1, 1570),
      shelf('item-6', 912, 300, 2, 590),
      shelf('item-7', 912, 220, 2, 940),
      shelf('item-8', 912, 220, 2, 1290),
      shelf('item-9', 912, 220, 2, 1640),
      shelf('item-10', 912, 220, 2, 1990),
    ],
    placement: { wall: 'back', offset: 855, distance: 0 },
    trackMode: 'automatic',
    railHeight: 2000,
    mountHeight: 345,
    finish: { colour: 'off-white', wood: 'beech' },
    structureOptions: defaultStructureOptions,
  },
}
