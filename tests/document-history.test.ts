import { describe, expect, it } from 'vite-plus/test'
import { catalog } from '../src/data/catalog'
import { recommendETracks } from '../src/data/structure'
import { initialDocument } from '../src/domain/defaults'
import { migrateDocumentFinishes, parseBuilderDocument } from '../src/domain/document'
import { commitHistory, createHistory, redoHistory, undoHistory } from '../src/domain/history'
import { buildPartsList, deriveSupportTrackPlans, validateDocument } from '../src/domain/rules'
import { resolveItemFinish } from '../src/domain/products'
import type { BuilderDocument } from '../src/domain/types'

const copy = (): BuilderDocument => structuredClone(initialDocument)

describe('bounded document history', () => {
  it('clears redo after a new commit and retains only the configured past limit', () => {
    let history = createHistory(0)
    for (let value = 1; value <= 55; value += 1) history = commitHistory(history, value, 50)
    expect(history.past).toHaveLength(50)
    history = undoHistory(history)
    expect(history.present).toBe(54)
    expect(history.future).toEqual([55])
    history = commitHistory(history, 99)
    expect(history.future).toEqual([])
    expect(redoHistory(history).present).toBe(99)
  })
})

describe('saved-plan validation', () => {
  it('rejects duplicate IDs, unknown variants and incompatible accessory hosts', () => {
    const duplicate = copy()
    duplicate.system.items[1].id = duplicate.system.items[0].id
    expect(parseBuilderDocument(JSON.stringify(duplicate), catalog)).toBeUndefined()

    const unknown = copy()
    unknown.system.items[0].variantId = 'not-a-real-variant'
    expect(parseBuilderDocument(JSON.stringify(unknown), catalog)).toBeUndefined()

    const invalidHost = copy()
    invalidHost.system.items.push({
      id: 'liner',
      productId: 'drawer-liner',
      variantId: 'drawer-liner-667',
      bayIndex: 1,
      height: 1045,
      face: 'front',
      finish: 'silver',
      parentItemId: 'item-1',
    })
    expect(parseBuilderDocument(JSON.stringify(invalidHost), catalog)).toBeUndefined()
  })

  it('loads reachable in-progress fit conflicts so the builder can show and repair them', () => {
    const bayMismatch = copy()
    bayMismatch.system.bays[0].centreWidth = 667
    const parsedBayMismatch = parseBuilderDocument(JSON.stringify(bayMismatch), catalog)
    expect(parsedBayMismatch).toBeDefined()
    expect(
      validateDocument(parsedBayMismatch!, catalog).some((issue) => issue.code === 'bay-fit'),
    ).toBe(true)

    const faceMismatch = copy()
    faceMismatch.system.items[0].face = 'back'
    const parsedFaceMismatch = parseBuilderDocument(JSON.stringify(faceMismatch), catalog)
    expect(parsedFaceMismatch).toBeDefined()
    expect(
      validateDocument(parsedFaceMismatch!, catalog).some((issue) => issue.code === 'invalid-face'),
    ).toBe(true)
  })

  it('reloads items left off-grid by a mounting-mode baseline change', () => {
    const inProgress = copy()
    inProgress.system.mountHeight = 333
    inProgress.system.items = inProgress.system.items.map((item) => ({
      ...item,
      height: item.height - 12,
    }))

    inProgress.system.mountingType = 'floor-to-ceiling'
    inProgress.system.mountHeight = 205
    inProgress.system.placement.z = 600

    const parsed = parseBuilderDocument(JSON.stringify(inProgress), catalog)
    expect(parsed).toBeDefined()
    expect(validateDocument(parsed!, catalog).some((issue) => issue.code === 'track-slot')).toBe(
      true,
    )
  })

  it('infers one system finish while preserving legacy item appearances', () => {
    const legacy = copy()
    delete legacy.system.finish
    legacy.system.items.forEach((item) => delete item.finishOverride)
    legacy.system.items[0].finish = 'black'

    const migrated = migrateDocumentFinishes(legacy, catalog)
    expect(migrated.system.finish).toEqual({ colour: 'off-white', wood: 'beech' })
    expect(migrated.system.items[0].finishOverride).toBe('black')
    expect(migrated.system.items[1].finishOverride).toBe('system')
    expect(migrated.system.items.find((item) => item.productId === 'cabinet')?.finishOverride).toBe(
      'system',
    )
    expect(
      migrated.system.items.map((item) => resolveItemFinish(migrated, item, catalog).finish),
    ).toEqual(legacy.system.items.map((item) => item.finish))
  })

  it('resolves global colour, supported beech and fixed materials consistently', () => {
    const document = copy()
    document.system.finish = { colour: 'black', wood: 'beech' }
    const shelf = resolveItemFinish(
      document,
      { productId: 'shelf', variantId: 'steel-667-220', finishOverride: 'system' },
      catalog,
    )
    const cabinet = resolveItemFinish(
      document,
      { productId: 'cabinet', variantId: 'cabinet-667', finishOverride: 'system' },
      catalog,
    )
    const liner = resolveItemFinish(
      document,
      { productId: 'drawer-liner', variantId: 'drawer-liner-667', finishOverride: 'system' },
      catalog,
    )

    expect(shelf.finish).toBe('black')
    expect(cabinet).toMatchObject({ finish: 'beech', frontFinish: 'black' })
    expect(liner.materialLabel).toBe('Grey wool felt')

    const parts = buildPartsList(document, catalog)
    expect(parts.find((line) => line.id.includes('cabinet-667/beech/black'))?.unitPriceEur).toBe(
      1005,
    )
  })
})

describe('automatic E-track selection', () => {
  it('keeps a fitting stock track uncut and cuts only to respect available height', () => {
    expect(recommendETracks(1600, 2200)).toMatchObject({
      stockLengths: [1710],
      finalLengths: [1710],
      needsCut: false,
      estimatedPriceEur: 90,
    })
    expect(recommendETracks(1900, 1950)).toMatchObject({
      stockLengths: [2000],
      finalLengths: [1950],
      needsCut: true,
      estimatedPriceEur: 95,
      cuttingChargeEur: 25,
    })
    const impossible = recommendETracks(2300, 1500)
    expect(impossible.fitsAvailableHeight).toBe(false)
    expect(impossible.finalLengths.every((length) => length > 0)).toBe(true)
    expect(impossible.totalLength).toBeGreaterThanOrEqual(2300)
  })

  it('sizes each shared support from items in both adjacent mixed-width bays and faces', () => {
    const document = copy()
    document.system.mountingType = 'floor-to-ceiling'
    document.system.mountHeight = 205
    document.system.bays = [
      { id: 'wide', centreWidth: 912 },
      { id: 'narrow', centreWidth: 667 },
    ]
    document.system.items = [
      {
        id: 'wide-high',
        productId: 'shelf',
        variantId: 'steel-912-220',
        bayIndex: 0,
        height: 2095,
        face: 'front',
        finish: 'off-white',
      },
      {
        id: 'narrow-low',
        productId: 'shelf',
        variantId: 'steel-667-220',
        bayIndex: 1,
        height: 695,
        face: 'back',
        finish: 'off-white',
      },
    ]
    const plans = deriveSupportTrackPlans(document, catalog)
    expect(plans).toHaveLength(6)
    const front = plans.filter((plan) => plan.face === 'front')
    const back = plans.filter((plan) => plan.face === 'back')
    expect(front[0].requiredLength).toBe(front[1].requiredLength)
    expect(front[1].requiredLength).toBeGreaterThan(front[2].requiredLength)
    expect(back[1].requiredLength).toBe(back[2].requiredLength)
    expect(front[0].top).toBe(
      front[0].bottom +
        front[0].segments.reduce((sum, segment) => sum + segment.installedLength, 0),
    )
  })

  it('uses an exact installed length in manual mode, including dedicated profiles', () => {
    const document = copy()
    document.system.trackMode = 'manual'
    document.system.railHeight = 1600
    expect(deriveSupportTrackPlans(document, catalog)[0]).toMatchObject({
      requiredLength: 1600,
      segments: [{ stockLength: 1710, installedLength: 1600, cut: true }],
    })
    document.system.railHeight = 395
    expect(deriveSupportTrackPlans(document, catalog)[0]).toMatchObject({
      segments: [{ stockLength: 395, installedLength: 395, cut: false, estimatedPriceEur: 40 }],
    })
  })
})
