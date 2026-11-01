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
      shelf('item-1', 912, 220, 0, 555),
      shelf('item-2', 912, 220, 0, 905),
      shelf('item-3', 912, 220, 0, 1255),
      shelf('item-4', 667, 300, 1, 555),
      {
        id: 'item-cabinet',
        productId: 'cabinet',
        variantId: 'cabinet-667',
        bayIndex: 1,
        height: 1045,
        face: 'front',
        finish: 'system',
        open: false,
      },
      shelf('item-5', 667, 220, 1, 1535),
      shelf('item-6', 912, 300, 2, 555),
      shelf('item-7', 912, 220, 2, 905),
      shelf('item-8', 912, 220, 2, 1255),
      shelf('item-9', 912, 220, 2, 1605),
      shelf('item-10', 912, 220, 2, 1955),
    ],
    placement: { wall: 'back', offset: 855, distance: 0 },
    trackMode: 'automatic',
    railHeight: 2000,
    mountHeight: 345,
    finish: { colour: 'off-white', wood: 'beech' },
    structureOptions: defaultStructureOptions,
  },
}
