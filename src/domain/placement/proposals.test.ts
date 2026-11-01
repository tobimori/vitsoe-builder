import { describe, expect, it } from 'vite-plus/test'
import { catalog } from '../catalog/catalog'
import { initialPlan } from '../plan/defaults'
import type { Plan, PlanItem } from '../plan/types'
import type { MountingType } from '../types'
import { validatePlan } from '../validation/validate'
import { carrierHeight } from './grid'
import {
  canPlaceItem,
  findAvailablePlacement,
  proposeItemDuplicate,
  proposeItemMove,
} from './proposals'

const copy = (): Plan => structuredClone(initialPlan)

const codes = (plan: Plan) => validatePlan(plan, catalog).map((issue) => issue.code)

function freestanding(): Plan {
  const plan = copy()
  plan.system.mountingType = 'freestanding'
  plan.system.mountHeight = 205
  plan.system.placement.distance = 600
  return plan
}

function cabinetWithLiner(): Plan {
  const plan = freestanding()
  plan.system.bays = [{ id: 'narrow', centreWidth: 667 }]
  plan.system.items = [
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
  return plan
}

describe('placing new components', () => {
  it('rejects a narrow structural shelf in a wide bay while allowing the matching shelf', () => {
    const plan = copy()
    plan.system.items = []
    plan.system.bays = [{ id: 'wide', centreWidth: 912 }]
    const narrow: PlanItem = {
      id: 'narrow',
      productId: 'shelf',
      variantId: 'steel-667-220',
      bayIndex: 0,
      height: 695,
      face: 'front',
      finish: 'off-white',
    }

    expect(canPlaceItem(plan, catalog, narrow)).toBe(false)
    expect(canPlaceItem(plan, catalog, { ...narrow, id: 'wide', variantId: 'steel-912-220' })).toBe(
      true,
    )
  })

  it('adds components to every freestanding rear bay despite an unrelated high front shelf', () => {
    let plan = freestanding()

    const variants = ['steel-912-220', 'steel-667-220', 'steel-912-220']
    variants.forEach((variantId, bayIndex) => {
      const item = findAvailablePlacement(plan, catalog, {
        id: `rear-${bayIndex}`,
        productId: 'shelf',
        variantId,
        face: 'back',
        preferredBayIndex: bayIndex,
      })
      expect(item).toMatchObject({ bayIndex, face: 'back', height: 345 })
      plan = { ...plan, system: { ...plan.system, items: [...plan.system.items, item!] } }
    })

    expect(canPlaceItem(plan, catalog, { ...plan.system.items.at(-3)!, face: 'front' })).toBe(true)
    expect(codes(plan)).toContain('track-height')
  })

  it('places both integrated table widths at 740 mm in an empty bay for every support mode', () => {
    const modes: MountingType[] = ['wall', 'semi-wall', 'floor-to-ceiling', 'freestanding']
    for (const mountingType of modes) {
      for (const centreWidth of [667, 912] as const) {
        const plan = copy()
        plan.system.mountingType = mountingType
        plan.system.mountHeight = mountingType === 'wall' ? 345 : 205
        plan.system.bays = [{ id: 'empty', centreWidth }]
        plan.system.items = []
        plan.system.placement.distance = mountingType === 'wall' ? 0 : 600

        const item = findAvailablePlacement(plan, catalog, {
          id: 'table',
          productId: 'table',
          variantId: `table-${centreWidth}`,
          face: 'front',
        })
        expect(item, `${mountingType}/${centreWidth}`).toBeDefined()
        expect(item?.height).toBe(740)
        expect((carrierHeight(item!, plan) - plan.system.mountHeight) % 70).toBe(0)
      }
    }
  })

  it('finds a clear default wide bay while keeping the cabinet-filled narrow bay blocked', () => {
    const plan = copy()
    const place = (variantId: string) =>
      findAvailablePlacement(plan, catalog, {
        id: 'table',
        productId: 'table',
        variantId,
        face: 'front',
      })

    expect(place('table-912')).toMatchObject({ bayIndex: 0, height: 740 })
    expect(place('table-667')).toBeUndefined()
  })
})

describe('moving components', () => {
  it('moves a host and its attached accessories together across a freestanding system', () => {
    const plan = cabinetWithLiner()
    const proposal = proposeItemMove(plan, catalog, { ...plan.system.items[0]!, face: 'back' })

    expect(proposal?.valid).toBe(true)
    expect(proposal?.movedItemIds.toSorted()).toEqual(['host', 'liner'])
    expect(proposal?.plan.system.items.map((item) => item.face)).toEqual(['back', 'back'])
  })

  it('rejects a cross-face move that introduces a collision', () => {
    const plan = freestanding()
    plan.system.bays = [{ id: 'narrow', centreWidth: 667 }]
    const moving: PlanItem = {
      id: 'moving',
      productId: 'shelf',
      variantId: 'steel-667-220',
      bayIndex: 0,
      height: 765,
      face: 'front',
      finish: 'off-white',
    }
    plan.system.items = [moving, { ...moving, id: 'occupied', face: 'back' }]

    const proposal = proposeItemMove(plan, catalog, { ...moving, face: 'back' })
    expect(proposal?.valid).toBe(false)
    expect(
      validatePlan(proposal!.plan, catalog).some(
        (issue) => issue.code === 'item-collision' && issue.itemIds?.includes('moving'),
      ),
    ).toBe(true)
  })

  it('allows unrelated edits and repairs while a freestanding front track is already too high', () => {
    const plan = freestanding()
    expect(codes(plan)).toContain('track-height')

    const lowest = plan.system.items[0]!
    const unrelated = proposeItemMove(plan, catalog, { ...lowest, height: lowest.height + 70 })
    expect(unrelated?.valid).toBe(true)

    const high = plan.system.items.find((item) => item.id === 'item-10')!
    const repair = proposeItemMove(plan, catalog, { ...high, height: 1815 })
    expect(repair?.valid).toBe(true)
    expect(
      validatePlan(repair!.plan, catalog).some(
        (issue) => issue.itemIds?.includes(high.id) && issue.severity === 'error',
      ),
    ).toBe(false)
  })
})

describe('duplicating components', () => {
  it('duplicates a host and its accessory tree across faces with fresh references', () => {
    const plan = cabinetWithLiner()
    const proposal = proposeItemDuplicate(
      plan,
      catalog,
      { ...plan.system.items[0]!, face: 'back' },
      (id) => `new-${id}`,
    )
    const item = (id: string) => proposal?.plan.system.items.find((entry) => entry.id === id)

    expect(proposal?.valid).toBe(true)
    expect(proposal?.movedItemIds.toSorted()).toEqual(['new-host', 'new-liner'])
    expect(proposal?.plan.system.items).toHaveLength(4)
    expect(item('host')?.face).toBe('front')
    expect(item('new-host')?.face).toBe('back')
    expect(item('new-liner')).toMatchObject({ face: 'back', parentItemId: 'new-host' })
  })

  it('rejects a duplicate that still overlaps its source', () => {
    const plan = copy()
    const proposal = proposeItemDuplicate(plan, catalog, plan.system.items[0]!)

    expect(proposal?.valid).toBe(false)
    expect(
      validatePlan(proposal!.plan, catalog).some(
        (issue) =>
          issue.code === 'item-collision' && issue.itemIds?.includes(proposal!.candidate.id),
      ),
    ).toBe(true)
  })
})
