import type { BuilderDocument, PlacedItem } from './types'

const shelf = (id: string, variantId: string, bayIndex: number, height: number): PlacedItem => ({
  id,
  productId: 'shelf',
  variantId,
  bayIndex,
  height,
  face: 'front',
  finish: 'off-white',
  finishOverride: 'system',
  orientation: 'standard',
})

export const initialDocument: BuilderDocument = {
  version: 1,
  name: 'Untitled 606 system',
  room: {
    width: 4200,
    depth: 3600,
    ceilingHeight: 2600,
    showDimensions: true,
  },
  system: {
    mountingType: 'wall',
    bays: [
      { id: 'bay-1', centreWidth: 912 },
      { id: 'bay-2', centreWidth: 667 },
      { id: 'bay-3', centreWidth: 912 },
    ],
    items: [
      shelf('item-1', 'steel-912-220', 0, 555),
      shelf('item-2', 'steel-912-220', 0, 905),
      shelf('item-3', 'steel-912-220', 0, 1255),
      shelf('item-4', 'steel-667-300', 1, 555),
      {
        id: 'item-cabinet',
        productId: 'cabinet',
        variantId: 'cabinet-667',
        bayIndex: 1,
        height: 1045,
        face: 'front',
        finish: 'beech',
        finishOverride: 'system',
        frontFinish: 'off-white',
        open: false,
      },
      shelf('item-5', 'steel-667-220', 1, 1535),
      shelf('item-6', 'steel-912-300', 2, 555),
      shelf('item-7', 'steel-912-220', 2, 905),
      shelf('item-8', 'steel-912-220', 2, 1255),
      shelf('item-9', 'steel-912-220', 2, 1605),
      shelf('item-10', 'steel-912-220', 2, 1955),
    ],
    placement: { x: 700, z: 0, rotation: 0 },
    railHeight: 2000,
    mountHeight: 345,
    trackMode: 'automatic',
    activeFace: 'front',
    finish: { colour: 'off-white', wood: 'beech' },
    structureOptions: {
      wallBracket: 'short',
      extensionBolts: false,
      cableChannels: false,
      stabilisingFeet: false,
    },
  },
}
