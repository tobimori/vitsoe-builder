import { describe, expect, it } from 'vite-plus/test'
import { catalog, createCatalog, type Catalog } from '../catalog/catalog'
import type { CatalogProduct } from '../catalog/types'
import { initialPlan } from '../plan/defaults'
import type { Plan, PlanItem } from '../plan/types'
import { validatePlan } from './validate'

const copy = (): Plan => structuredClone(initialPlan)

const codes = (plan: Plan, source: Catalog = catalog) =>
  validatePlan(plan, source).map((issue) => issue.code)

function shelf(
  id: string,
  variantId: string,
  height: number,
  face: PlanItem['face'] = 'front',
): PlanItem {
  return {
    id,
    productId: 'shelf',
    variantId,
    bayIndex: 0,
    height,
    face,
    finish: 'off-white',
  }
}

describe('606 fit and combination rules', () => {
  it('uses the physical vertical envelopes when detecting a shelf and cabinet collision', () => {
    const plan = copy()
    plan.system.bays = [{ id: 'narrow', centreWidth: 667 }]
    plan.system.items = [
      {
        id: 'cabinet',
        productId: 'cabinet',
        variantId: 'cabinet-667',
        bayIndex: 0,
        height: 1045,
        face: 'front',
        finish: 'off-white',
      },
      shelf('shelf', 'steel-667-220', 765),
    ]

    const collision = validatePlan(plan, catalog).find((issue) => issue.code === 'item-collision')
    expect(collision?.itemIds).toEqual(['cabinet', 'shelf'])
  })

  it('checks both faces and room corners after a 90 degree rotation', () => {
    const plan = copy()
    plan.system.mountingType = 'freestanding'
    plan.system.bays = [{ id: 'wide', centreWidth: 912 }]
    plan.system.items = [
      shelf('front', 'steel-912-300', 555),
      shelf('back', 'steel-912-300', 555, 'back'),
    ]
    plan.system.placement = { x: 200, z: 200, rotation: 90 }
    plan.room = { ...plan.room, width: 500, depth: 1600 }

    expect(codes(plan)).toContain('room-boundary')
  })

  it('reports an unbalanced high freestanding item independently of collisions', () => {
    const plan = copy()
    plan.system.mountingType = 'freestanding'
    plan.system.items = [shelf('high', 'steel-912-220', 1955)]

    expect(codes(plan)).toContain('freestanding-height')
    expect(codes(plan)).toContain('balanced-load')
  })

  it('allows shallow furniture below a table but rejects its support and front-leg volumes', () => {
    const plan = copy()
    plan.system.bays = [{ id: 'narrow', centreWidth: 667 }]
    const table: PlanItem = {
      id: 'table',
      productId: 'table',
      variantId: 'table-667',
      bayIndex: 0,
      height: 740,
      face: 'front',
      finish: 'off-white',
    }
    const shallow = shelf('shallow', 'steel-667-360', 555)

    plan.system.items = [table, shallow]
    expect(codes(plan)).not.toContain('item-collision')

    plan.system.items = [table, { ...shallow, height: 695 }]
    expect(codes(plan)).toContain('item-collision')

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
    plan.system.items = [
      table,
      { ...shallow, productId: deepProduct.id, variantId: 'test-deep-667' },
    ]
    expect(codes(plan, createCatalog([...catalog.products, deepProduct]))).toContain(
      'item-collision',
    )
  })

  it('includes freestanding feet and opened drawers in room bounds', () => {
    const freestanding = copy()
    freestanding.system.mountingType = 'freestanding'
    freestanding.system.items = []
    freestanding.system.placement.z = 450
    expect(codes(freestanding)).toContain('room-boundary')
    freestanding.system.placement.z = 459
    expect(codes(freestanding)).not.toContain('room-boundary')

    const drawer = copy()
    drawer.system.mountingType = 'floor-to-ceiling'
    drawer.system.bays = [{ id: 'narrow', centreWidth: 667 }]
    drawer.system.placement.z = 300
    drawer.room.depth = 700
    const closed: PlanItem = {
      id: 'drawer',
      productId: 'shelf-with-drawer',
      variantId: 'shelf-drawer-667',
      bayIndex: 0,
      height: 905,
      face: 'front',
      finish: 'off-white',
      open: false,
    }
    drawer.system.items = [closed]
    expect(codes(drawer)).not.toContain('room-boundary')
    drawer.system.items = [{ ...closed, open: true }]
    expect(codes(drawer)).toContain('room-boundary')
  })
})
