import { describe, expect, it } from 'vite-plus/test'
import { catalog } from '../src/data/catalog'
import { resizeBay } from '../src/domain/bays'
import { decorLayout } from '../src/domain/decor'
import { initialDocument } from '../src/domain/defaults'
import { createHistory, commitHistory, undoHistory } from '../src/domain/history'
import { parseBuilderDocument } from '../src/domain/document'
import {
  buildPartsList,
  canPlaceItem,
  deriveSupportTrackPlans,
  proposeItemDuplicate,
  proposeItemMove,
  validateDocument,
} from '../src/domain/rules'
import { decodePlanHash, encodePlanHash } from '../src/domain/share'
import type { BuilderDocument, PlacedItem } from '../src/domain/types'

function decoratedPlan(): BuilderDocument {
  const document = structuredClone(initialDocument)
  document.system.bays = [
    { id: 'bay-1', centreWidth: 667 },
    { id: 'bay-2', centreWidth: 667 },
  ]
  document.system.items = [
    {
      id: 'decorated-shelf',
      productId: 'shelf',
      variantId: 'steel-667-360',
      bayIndex: 0,
      height: 555,
      face: 'front',
      finish: 'off-white',
      decor: {
        kind: 'vinyl',
        arrangement: 'upright',
        count: 8,
        position: 'left',
      },
    },
  ]
  return document
}

function shelf(id: string, height: number): PlacedItem {
  return {
    id,
    productId: 'shelf',
    variantId: 'steel-667-220',
    bayIndex: 0,
    height,
    face: 'front',
    finish: 'off-white',
  }
}

describe('shelf display objects', () => {
  it('uses the shared upright and stacked volume layout', () => {
    const upright = decorLayout(
      { kind: 'art-books', arrangement: 'upright', count: 2, position: 'centre' },
      655,
    )
    expect(upright.bounds).toMatchObject({
      x: -14.5,
      y: 0,
      z: 8,
      width: 29,
      height: 260,
      depth: 210,
    })

    const stacked = decorLayout(
      { kind: 'art-books', arrangement: 'stacked', count: 2, position: 'right' },
      655,
    )
    expect(stacked.bounds).toMatchObject({ y: 0, z: 8, width: 260, height: 28, depth: 210 })
    expect(stacked.bounds.x + stacked.bounds.width).toBe(655 / 2 - 18)
  })

  it('requires a suitable horizontal surface without changing structural parts', () => {
    const document = decoratedPlan()
    const plain = structuredClone(document)
    delete plain.system.items[0].decor

    expect(buildPartsList(document, catalog)).toEqual(buildPartsList(plain, catalog))
    expect(deriveSupportTrackPlans(document, catalog)).toEqual(
      deriveSupportTrackPlans(plain, catalog),
    )

    document.system.items[0].variantId = 'steel-667-300'
    expect(validateDocument(document, catalog).some((issue) => issue.code === 'decor-fit')).toBe(
      true,
    )

    document.system.items[0].decor = {
      kind: 'art-books',
      arrangement: 'upright',
      count: 4,
      position: 'centre',
    }
    expect(validateDocument(document, catalog).some((issue) => issue.code === 'decor-fit')).toBe(
      false,
    )

    document.system.items[0].orientation = 'vertical'
    expect(validateDocument(document, catalog).some((issue) => issue.code === 'decor-fit')).toBe(
      true,
    )
  })

  it('round-trips decor through a shared link and rejects malformed bounds', () => {
    const document = decoratedPlan()
    const decoded = decodePlanHash(encodePlanHash(document), catalog)
    expect(decoded.status).toBe('valid')
    if (decoded.status === 'valid') {
      expect(decoded.document.system.items[0].decor).toEqual(document.system.items[0].decor)
    }

    const malformed = structuredClone(document)
    malformed.system.items[0].decor!.count = 25
    expect(parseBuilderDocument(JSON.stringify(malformed), catalog)).toBeUndefined()
  })

  it('preserves decor through duplication, undo and a bay-width change', () => {
    const document = decoratedPlan()
    const source = document.system.items[0]
    const duplicate = proposeItemDuplicate(
      document,
      catalog,
      { ...source, bayIndex: 1 },
      (id) => `copy-${id}`,
    )
    expect(duplicate?.valid).toBe(true)
    expect(duplicate?.candidate.decor).toEqual(source.decor)

    const history = commitHistory(createHistory(document), duplicate!.document)
    expect(undoHistory(history).present.system.items).toEqual(document.system.items)

    const resized = resizeBay(document, catalog, 0, 912)
    expect(resized.ok).toBe(true)
    if (resized.ok) {
      expect(resized.document.system.items[0]).toMatchObject({
        id: source.id,
        variantId: 'steel-912-360',
        decor: source.decor,
      })
    }
  })

  it('blocks moving a decorated shelf beneath an obstruction', () => {
    const document = decoratedPlan()
    document.system.items.push(shelf('upper-shelf', 1185))
    const candidate = { ...document.system.items[0], height: 975 }
    const proposal = proposeItemMove(document, catalog, candidate)

    expect(proposal?.valid).toBe(false)
    expect(
      validateDocument(proposal!.document, catalog).find(
        (issue) => issue.code === 'decor-clearance',
      )?.itemIds,
    ).toEqual(['decorated-shelf', 'upper-shelf'])
  })

  it('identifies both items when another shelf enters the decor volume', () => {
    const document = decoratedPlan()
    const upper = shelf('new-shelf', 765)
    const next = {
      ...document,
      system: { ...document.system, items: [...document.system.items, upper] },
    }

    expect(canPlaceItem(document, catalog, upper)).toBe(false)
    expect(
      validateDocument(next, catalog).find((issue) => issue.code === 'decor-clearance')?.itemIds,
    ).toEqual(['decorated-shelf', 'new-shelf'])
  })
})
