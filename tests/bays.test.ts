import { describe, expect, it } from 'vite-plus/test'
import { catalog } from '../src/data/catalog'
import { resizeBay } from '../src/domain/bays'
import { initialDocument } from '../src/domain/defaults'
import type { BuilderDocument } from '../src/domain/types'

const copy = (): BuilderDocument => structuredClone(initialDocument)

describe('bay resizing', () => {
  it('has one reversible opposite-width match for every width-specific catalogue variant', () => {
    for (const product of catalog) {
      for (const variant of product.variants) {
        if (variant.bayCentres?.length !== 1) continue
        const sourceWidth = variant.bayCentres[0]
        const targetWidth = sourceWidth === 667 ? 912 : 667
        const matches = product.variants.filter(
          (candidate) =>
            candidate.bayCentres?.includes(targetWidth) &&
            candidate.depth === variant.depth &&
            candidate.height === variant.height,
        )
        expect(matches, `${product.id}/${variant.id}`).toHaveLength(1)

        const document = copy()
        document.system.bays = [{ id: 'test-bay', centreWidth: sourceWidth }]
        document.system.items = [
          {
            id: 'test-item',
            productId: product.id,
            variantId: variant.id,
            bayIndex: 0,
            height: 1045,
            face: 'front',
            finish: variant.finishes[0],
          },
        ]
        const resized = resizeBay(document, catalog, 0, targetWidth)
        expect(resized.ok, `${product.id}/${variant.id} outward`).toBe(true)
        if (!resized.ok) continue
        const restored = resizeBay(resized.document, catalog, 0, sourceWidth)
        expect(restored.ok, `${product.id}/${variant.id} return`).toBe(true)
        if (restored.ok) expect(restored.document.system.items[0].variantId).toBe(variant.id)
      }
    }
  })

  it('resizes components on both faces and width-dependent descendants atomically', () => {
    const document = copy()
    document.system.items = [
      {
        ...document.system.items[0],
        id: 'front-cabinet',
        productId: 'cabinet',
        variantId: 'cabinet-912',
      },
      {
        ...document.system.items[0],
        id: 'rear-shelf',
        variantId: 'steel-912-220',
        face: 'back',
      },
      {
        id: 'open-back',
        productId: 'open-back',
        variantId: 'open-back-912',
        bayIndex: 0,
        height: document.system.items[0].height,
        face: 'front',
        finish: 'off-white',
        finishOverride: 'system',
        parentItemId: 'front-cabinet',
      },
      {
        id: 'bookend',
        productId: 'bookend',
        variantId: 'bookend-standard',
        bayIndex: 0,
        height: document.system.items[0].height,
        face: 'back',
        finish: 'off-white',
        finishOverride: 'system',
        parentItemId: 'rear-shelf',
      },
    ]

    const result = resizeBay(document, catalog, 0, 667)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.document.system.bays[0].centreWidth).toBe(667)
    expect(result.document.system.items.map(({ id, variantId }) => [id, variantId])).toEqual([
      ['front-cabinet', 'cabinet-667'],
      ['rear-shelf', 'steel-667-220'],
      ['open-back', 'open-back-667'],
      ['bookend', 'bookend-standard'],
    ])
    expect(result.document.system.items.map((item) => item.parentItemId)).toEqual([
      undefined,
      undefined,
      'front-cabinet',
      'rear-shelf',
    ])
    expect(document.system.bays[0].centreWidth).toBe(912)
  })

  it('returns the original document when a matching width is unavailable', () => {
    const document = copy()
    const incompleteCatalog = catalog.map((product) =>
      product.id === 'shelf'
        ? {
            ...product,
            variants: product.variants.filter((variant) => !variant.bayCentres?.includes(667)),
          }
        : product,
    )

    const result = resizeBay(document, incompleteCatalog, 0, 667)
    expect(result).toMatchObject({ ok: false, itemIds: ['item-1', 'item-2', 'item-3'] })
    expect(document.system.bays[0].centreWidth).toBe(912)
  })
})
