import { describe, expect, it } from 'vite-plus/test'
import { catalog, createCatalog } from '../catalog/catalog'
import { initialPlan } from './defaults'
import { resizeBay } from './system'
import type { Plan, PlanItem } from './types'

const copy = (): Plan => structuredClone(initialPlan)

describe('bay resizing', () => {
  it('has one reversible opposite-width match for every width-specific catalogue variant', () => {
    for (const product of catalog.products) {
      for (const variant of product.variants) {
        const [sourceWidth, ...otherWidths] = variant.bayCentres ?? []
        if (!sourceWidth || otherWidths.length) continue

        const targetWidth = sourceWidth === 667 ? 912 : 667
        const matches = product.variants.filter(
          (candidate) =>
            candidate.bayCentres?.includes(targetWidth) &&
            candidate.depth === variant.depth &&
            candidate.height === variant.height,
        )
        expect(matches, `${product.id}/${variant.id}`).toHaveLength(1)

        const plan = copy()
        plan.system.bays = [{ id: 'test-bay', centreWidth: sourceWidth }]
        plan.system.items = [
          {
            id: 'test-item',
            productId: product.id,
            variantId: variant.id,
            bayIndex: 0,
            height: 1045,
            face: 'front',
            finish: 'system',
          },
        ]

        const resized = resizeBay(plan, catalog, 0, targetWidth)
        expect(resized.ok, `${product.id}/${variant.id} outward`).toBe(true)
        if (!resized.ok) continue

        const restored = resizeBay(resized.plan, catalog, 0, sourceWidth)
        expect(restored.ok, `${product.id}/${variant.id} return`).toBe(true)
        if (restored.ok) expect(restored.plan.system.items[0]?.variantId).toBe(variant.id)
      }
    }
  })

  it('resizes components on both faces and width-dependent descendants atomically', () => {
    const plan = copy()
    const shelf = plan.system.items[0]!
    const accessory = (
      id: string,
      productId: string,
      variantId: string,
      face: PlanItem['face'],
      parentItemId: string,
    ): PlanItem => ({
      id,
      productId,
      variantId,
      bayIndex: 0,
      height: shelf.height,
      face,
      finish: 'system',
      parentItemId,
    })
    plan.system.items = [
      { ...shelf, id: 'front-cabinet', productId: 'cabinet', variantId: 'cabinet-912' },
      { ...shelf, id: 'rear-shelf', variantId: 'steel-912-220', face: 'back' },
      accessory('open-back', 'open-back', 'open-back-912', 'front', 'front-cabinet'),
      accessory('bookend', 'bookend', 'bookend-standard', 'back', 'rear-shelf'),
    ]

    const result = resizeBay(plan, catalog, 0, 667)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.plan.system.bays[0]?.centreWidth).toBe(667)
    expect(result.plan.system.items.map(({ id, variantId }) => [id, variantId])).toEqual([
      ['front-cabinet', 'cabinet-667'],
      ['rear-shelf', 'steel-667-220'],
      ['open-back', 'open-back-667'],
      ['bookend', 'bookend-standard'],
    ])
    expect(result.plan.system.items.map((item) => item.parentItemId)).toEqual([
      undefined,
      undefined,
      'front-cabinet',
      'rear-shelf',
    ])
    expect(plan.system.bays[0]?.centreWidth).toBe(912)
  })

  it('returns the original plan when a matching width is unavailable', () => {
    const plan = copy()
    const incompleteCatalog = createCatalog(
      catalog.products.map((product) =>
        product.id === 'shelf'
          ? {
              ...product,
              variants: product.variants.filter((variant) => !variant.bayCentres?.includes(667)),
            }
          : product,
      ),
    )

    const result = resizeBay(plan, incompleteCatalog, 0, 667)
    expect(result).toMatchObject({ ok: false, itemIds: ['item-1', 'item-2', 'item-3'] })
    expect(plan.system.bays[0]?.centreWidth).toBe(912)
  })
})
