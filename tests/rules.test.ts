import { describe, expect, it } from 'vitest'
import { catalog } from '../src/data/catalog'
import { initialDocument } from '../src/domain/defaults'
import {
  canPlaceItem,
  carrierHeight,
  deriveSupportTrackPlans,
  findAvailablePlacement,
  moveConnectedSupportRun,
  proposeItemDuplicate,
  proposeItemMove,
  snapItemHeight,
  supportTrackAcceptsPin,
  trackHoleHeights,
  validateDocument,
} from '../src/domain/rules'
import type { BuilderDocument, CatalogProduct, MountingType, PlacedItem } from '../src/domain/types'

const copy = (): BuilderDocument => structuredClone(initialDocument)

describe('606 fit and combination rules', () => {
  it('rejects a narrow structural shelf in a wide bay while allowing the matching shelf', () => {
    const document = copy()
    document.system.items = []
    document.system.bays = [{ id: 'wide', centreWidth: 912 }]
    const narrow: PlacedItem = {
      id: 'narrow',
      productId: 'shelf',
      variantId: 'steel-667-220',
      bayIndex: 0,
      height: 695,
      face: 'front',
      finish: 'off-white',
    }
    const wide = { ...narrow, id: 'wide', variantId: 'steel-912-220' }
    expect(canPlaceItem(document, catalog, narrow)).toBe(false)
    expect(canPlaceItem(document, catalog, wide)).toBe(true)
  })

  it('uses the physical vertical envelopes when detecting a shelf and cabinet collision', () => {
    const document = copy()
    document.system.bays = [{ id: 'narrow', centreWidth: 667 }]
    document.system.items = [
      {
        id: 'cabinet',
        productId: 'cabinet',
        variantId: 'cabinet-667',
        bayIndex: 0,
        height: 1045,
        face: 'front',
        finish: 'off-white',
      },
      {
        id: 'shelf',
        productId: 'shelf',
        variantId: 'steel-667-220',
        bayIndex: 0,
        height: 765,
        face: 'front',
        finish: 'off-white',
      },
    ]
    const collision = validateDocument(document, catalog).find(
      (issue) => issue.code === 'item-collision',
    )
    expect(collision?.itemIds).toEqual(['cabinet', 'shelf'])
  })

  it('checks both faces and room corners after a 90 degree rotation', () => {
    const document = copy()
    document.system.mountingType = 'freestanding'
    document.system.items = [
      {
        id: 'front',
        productId: 'shelf',
        variantId: 'steel-912-300',
        bayIndex: 0,
        height: 555,
        face: 'front',
        finish: 'off-white',
      },
      {
        id: 'back',
        productId: 'shelf',
        variantId: 'steel-912-300',
        bayIndex: 0,
        height: 555,
        face: 'back',
        finish: 'off-white',
      },
    ]
    document.system.bays = [{ id: 'wide', centreWidth: 912 }]
    document.system.placement = { x: 200, z: 200, rotation: 90 }
    document.room = { ...document.room, width: 500, depth: 1600 }
    expect(
      validateDocument(document, catalog).some((issue) => issue.code === 'room-boundary'),
    ).toBe(true)
  })

  it('reports an unbalanced high freestanding item independently of collisions', () => {
    const document = copy()
    document.system.mountingType = 'freestanding'
    document.system.items = [
      {
        id: 'high',
        productId: 'shelf',
        variantId: 'steel-912-220',
        bayIndex: 0,
        height: 1955,
        face: 'front',
        finish: 'off-white',
      },
    ]
    const codes = validateDocument(document, catalog).map((issue) => issue.code)
    expect(codes).toContain('freestanding-height')
    expect(codes).toContain('balanced-load')
  })

  it('snaps attachment pins to the 70 mm E-track grid from the track origin', () => {
    const document = copy()
    document.system.mountHeight = 345
    expect(snapItemHeight(701, document)).toBe(695)
    expect(snapItemHeight(735, document)).toBe(765)
  })

  it('extends an automatic track below a baseline carrier and omits unsafe join holes', () => {
    const document = copy()
    document.system.bays = [{ id: 'narrow', centreWidth: 667 }]
    document.system.items = [
      {
        id: 'baseline-shelf',
        productId: 'shelf',
        variantId: 'steel-667-220',
        bayIndex: 0,
        height: document.system.mountHeight,
        face: 'front',
        finish: 'off-white',
      },
    ]
    const plan = deriveSupportTrackPlans(document, catalog)[0]
    expect(plan.bottom).toBe(document.system.mountHeight - 10)
    expect(
      supportTrackAcceptsPin(plan, document.system.mountHeight, document.system.mountHeight),
    ).toBe(true)

    const joined = {
      ...plan,
      bottom: 345,
      top: 1485,
      segments: [
        { stockLength: 570, installedLength: 570, cut: false, estimatedPriceEur: 0 },
        { stockLength: 570, installedLength: 570, cut: false, estimatedPriceEur: 0 },
      ],
    }
    const holes = trackHoleHeights(joined, 345)
    expect(holes).not.toContain(345)
    expect(holes.every((height) => Math.abs(height - 915) >= 10)).toBe(true)
    expect(holes.at(-1)).toBeLessThanOrEqual(1475)
  })

  it('adds components to every freestanding rear bay despite an unrelated high front shelf', () => {
    let document = copy()
    document.system.mountingType = 'freestanding'
    document.system.mountHeight = 205
    document.system.activeFace = 'back'
    document.system.placement.z = 600

    const variants = ['steel-912-220', 'steel-667-220', 'steel-912-220']
    variants.forEach((variantId, bayIndex) => {
      const item = findAvailablePlacement(
        document,
        catalog,
        'shelf',
        variantId,
        'back',
        bayIndex,
        undefined,
        `rear-${bayIndex}`,
      )
      expect(item).toMatchObject({ bayIndex, face: 'back', height: 345 })
      document = {
        ...document,
        system: { ...document.system, items: [...document.system.items, item!] },
      }
    })

    expect(
      canPlaceItem(document, catalog, { ...document.system.items.at(-3)!, face: 'front' }),
    ).toBe(true)
    expect(validateDocument(document, catalog).some((issue) => issue.code === 'track-height')).toBe(
      true,
    )
  })

  it('moves a connected wall run and its fitted items by one committed elevation delta', () => {
    const document = copy()
    const before = deriveSupportTrackPlans(document, catalog)
    const moved = moveConnectedSupportRun(document, {
      ...document.system.placement,
      mountHeight: document.system.mountHeight + 140,
    })
    const after = deriveSupportTrackPlans(moved, catalog)

    expect(moved.system.items.map((item) => item.height)).toEqual(
      document.system.items.map((item) => item.height + 140),
    )
    expect(after.map((track) => track.bottom)).toEqual(before.map((track) => track.bottom + 140))
    expect(after.map((track) => track.top)).toEqual(before.map((track) => track.top + 140))
  })

  it('keeps wall-run elevation fixed when an integrated table reaches the floor', () => {
    const document = copy()
    document.system.items.push({
      id: 'table',
      productId: 'table',
      variantId: 'table-667',
      bayIndex: 1,
      height: 740,
      face: 'front',
      finish: 'off-white',
      finishOverride: 'system',
    })
    const moved = moveConnectedSupportRun(document, {
      ...document.system.placement,
      mountHeight: 625,
    })
    expect(moved.system.mountHeight).toBe(document.system.mountHeight)
  })

  it('places both integrated table widths at 740 mm in an empty bay for every support mode', () => {
    const modes: MountingType[] = ['wall', 'semi-wall', 'floor-to-ceiling', 'freestanding']
    for (const mountingType of modes) {
      for (const centreWidth of [667, 912] as const) {
        const document = copy()
        document.system.mountingType = mountingType
        document.system.mountHeight = mountingType === 'wall' ? 345 : 205
        document.system.bays = [{ id: 'empty', centreWidth }]
        document.system.items = []
        document.system.placement.z = mountingType === 'wall' ? 0 : 600
        const item = findAvailablePlacement(
          document,
          catalog,
          'table',
          centreWidth === 667 ? 'table-667' : 'table-912',
          'front',
        )

        expect(item, `${mountingType}/${centreWidth}`).toBeDefined()
        expect(item?.height).toBe(740)
        expect((carrierHeight(item!, document) - document.system.mountHeight) % 70).toBe(0)
      }
    }
  })

  it('finds a clear default wide bay while keeping the cabinet-filled narrow bay blocked', () => {
    const document = copy()
    const wide = findAvailablePlacement(document, catalog, 'table', 'table-912', 'front')
    const narrow = findAvailablePlacement(document, catalog, 'table', 'table-667', 'front')

    expect(wide).toMatchObject({ bayIndex: 0, height: 740 })
    expect(narrow).toBeUndefined()
  })

  it('allows shallow furniture below a table but rejects its support and front-leg volumes', () => {
    const document = copy()
    document.system.bays = [{ id: 'narrow', centreWidth: 667 }]
    document.system.items = [
      {
        id: 'table',
        productId: 'table',
        variantId: 'table-667',
        bayIndex: 0,
        height: 740,
        face: 'front',
        finish: 'off-white',
      },
      {
        id: 'shallow',
        productId: 'shelf',
        variantId: 'steel-667-360',
        bayIndex: 0,
        height: 555,
        face: 'front',
        finish: 'off-white',
      },
    ]
    expect(
      validateDocument(document, catalog).some((issue) => issue.code === 'item-collision'),
    ).toBe(false)

    document.system.items[1].height = 695
    expect(
      validateDocument(document, catalog).some((issue) => issue.code === 'item-collision'),
    ).toBe(true)

    const deepProduct: CatalogProduct = {
      id: 'test-deep-shelf',
      name: 'Test deep shelf',
      category: 'shelves',
      variants: [
        {
          id: 'test-deep-667',
          name: 'Deep',
          width: 655,
          height: 110,
          depth: 720,
          bayCentres: [667],
          finishes: ['off-white'],
          faces: ['front'],
        },
      ],
    }
    document.system.items[1] = {
      ...document.system.items[1],
      productId: deepProduct.id,
      variantId: deepProduct.variants[0].id,
      height: 555,
    }
    expect(
      validateDocument(document, [...catalog, deepProduct]).some(
        (issue) => issue.code === 'item-collision',
      ),
    ).toBe(true)
  })

  it('includes freestanding feet and opened drawers in room bounds', () => {
    const freestanding = copy()
    freestanding.system.mountingType = 'freestanding'
    freestanding.system.items = []
    freestanding.system.placement.z = 450
    expect(
      validateDocument(freestanding, catalog).some((issue) => issue.code === 'room-boundary'),
    ).toBe(true)
    freestanding.system.placement.z = 459
    expect(
      validateDocument(freestanding, catalog).some((issue) => issue.code === 'room-boundary'),
    ).toBe(false)

    const drawer = copy()
    drawer.system.mountingType = 'floor-to-ceiling'
    drawer.system.bays = [{ id: 'narrow', centreWidth: 667 }]
    drawer.system.placement.z = 300
    drawer.room.depth = 700
    drawer.system.items = [
      {
        id: 'drawer',
        productId: 'shelf-with-drawer',
        variantId: 'shelf-drawer-667',
        bayIndex: 0,
        height: 905,
        face: 'front',
        finish: 'off-white',
        open: false,
      },
    ]
    expect(validateDocument(drawer, catalog).some((issue) => issue.code === 'room-boundary')).toBe(
      false,
    )
    drawer.system.items[0].open = true
    expect(validateDocument(drawer, catalog).some((issue) => issue.code === 'room-boundary')).toBe(
      true,
    )
  })

  it('moves a host and its attached accessories together across a freestanding system', () => {
    const document = copy()
    document.system.mountingType = 'freestanding'
    document.system.mountHeight = 205
    document.system.activeFace = 'front'
    document.system.placement.z = 600
    document.system.bays = [{ id: 'narrow', centreWidth: 667 }]
    document.system.items = [
      {
        id: 'host',
        productId: 'cabinet',
        variantId: 'cabinet-667',
        bayIndex: 0,
        height: 1045,
        face: 'front',
        finish: 'off-white',
      },
      {
        id: 'liner',
        productId: 'drawer-liner',
        variantId: 'drawer-liner-667',
        bayIndex: 0,
        height: 1045,
        face: 'front',
        finish: 'silver',
        parentItemId: 'host',
      },
    ]

    const proposal = proposeItemMove(document, catalog, {
      ...document.system.items[0],
      face: 'back',
    })
    expect(proposal?.valid).toBe(true)
    expect(proposal?.movedItemIds.sort()).toEqual(['host', 'liner'])
    expect(proposal?.document.system.activeFace).toBe('back')
    expect(proposal?.document.system.items.map((item) => item.face)).toEqual(['back', 'back'])
  })

  it('rejects a cross-face move that introduces a collision', () => {
    const document = copy()
    document.system.mountingType = 'freestanding'
    document.system.mountHeight = 205
    document.system.placement.z = 600
    document.system.bays = [{ id: 'narrow', centreWidth: 667 }]
    document.system.items = [
      {
        id: 'moving',
        productId: 'shelf',
        variantId: 'steel-667-220',
        bayIndex: 0,
        height: 765,
        face: 'front',
        finish: 'off-white',
      },
      {
        id: 'occupied',
        productId: 'shelf',
        variantId: 'steel-667-220',
        bayIndex: 0,
        height: 765,
        face: 'back',
        finish: 'off-white',
      },
    ]

    const proposal = proposeItemMove(document, catalog, {
      ...document.system.items[0],
      face: 'back',
    })
    expect(proposal?.valid).toBe(false)
    expect(
      validateDocument(proposal!.document, catalog).some(
        (issue) => issue.code === 'item-collision' && issue.itemIds?.includes('moving'),
      ),
    ).toBe(true)
  })

  it('allows unrelated edits and repairs while a freestanding front track is already too high', () => {
    const document = copy()
    document.system.mountingType = 'freestanding'
    document.system.mountHeight = 205
    document.system.placement.z = 600
    expect(validateDocument(document, catalog).some((issue) => issue.code === 'track-height')).toBe(
      true,
    )

    const unrelated = proposeItemMove(document, catalog, {
      ...document.system.items[0],
      height: document.system.items[0].height + 70,
    })
    expect(unrelated?.valid).toBe(true)

    const high = document.system.items.find((item) => item.id === 'item-10')!
    const repair = proposeItemMove(document, catalog, { ...high, height: 1815 })
    expect(repair?.valid).toBe(true)
    expect(
      validateDocument(repair!.document, catalog).some(
        (issue) => issue.itemIds?.includes(high.id) && issue.severity === 'error',
      ),
    ).toBe(false)
  })

  it('duplicates a host and its accessory tree across faces with fresh references', () => {
    const document = copy()
    document.system.mountingType = 'freestanding'
    document.system.mountHeight = 205
    document.system.placement.z = 600
    document.system.bays = [{ id: 'narrow', centreWidth: 667 }]
    document.system.items = [
      {
        id: 'host',
        productId: 'cabinet',
        variantId: 'cabinet-667',
        bayIndex: 0,
        height: 1045,
        face: 'front',
        finish: 'off-white',
      },
      {
        id: 'liner',
        productId: 'drawer-liner',
        variantId: 'drawer-liner-667',
        bayIndex: 0,
        height: 1045,
        face: 'front',
        finish: 'silver',
        parentItemId: 'host',
      },
    ]

    const proposal = proposeItemDuplicate(
      document,
      catalog,
      { ...document.system.items[0], face: 'back' },
      (id) => `new-${id}`,
    )
    expect(proposal?.valid).toBe(true)
    expect(proposal?.movedItemIds.sort()).toEqual(['new-host', 'new-liner'])
    expect(proposal?.document.system.items).toHaveLength(4)
    expect(proposal?.document.system.items.find((item) => item.id === 'host')?.face).toBe('front')
    expect(proposal?.document.system.items.find((item) => item.id === 'new-host')?.face).toBe(
      'back',
    )
    expect(proposal?.document.system.items.find((item) => item.id === 'new-liner')).toMatchObject({
      face: 'back',
      parentItemId: 'new-host',
    })
  })

  it('rejects a duplicate that still overlaps its source', () => {
    const document = copy()
    const source = document.system.items[0]
    const proposal = proposeItemDuplicate(document, catalog, source)
    expect(proposal?.valid).toBe(false)
    expect(
      validateDocument(proposal!.document, catalog).some(
        (issue) =>
          issue.code === 'item-collision' && issue.itemIds?.includes(proposal!.candidate.id),
      ),
    ).toBe(true)
  })
})
