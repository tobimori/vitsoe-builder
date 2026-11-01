import { describe, expect, it } from 'vite-plus/test'
import { commitHistory, createHistory, undoHistory } from '../../editor/history'
import { catalog } from '../catalog/catalog'
import { canPlaceItem, proposeItemDuplicate, proposeItemMove } from '../placement/proposals'
import { parsePlan } from '../plan/codec'
import { initialPlan } from '../plan/defaults'
import { decodePlanHash, encodePlanHash } from '../plan/share'
import { resizeBay } from '../plan/system'
import type { Plan, PlanItem } from '../plan/types'
import { buildPartsList } from '../pricing/parts'
import { deriveSupportTrackPlans } from '../supports/tracks'
import { validatePlan } from '../validation/validate'
import { decorLayout } from './decor'

function decoratedPlan(): Plan {
  const plan = structuredClone(initialPlan)
  plan.system.bays = [
    { id: 'bay-1', centreWidth: 667 },
    { id: 'bay-2', centreWidth: 667 },
  ]
  plan.system.items = [
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
  return plan
}

function decorated(plan: Plan) {
  return plan.system.items[0]!
}

function shelf(id: string, height: number): PlanItem {
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

const hasIssue = (plan: Plan, code: string) =>
  validatePlan(plan, catalog).some((issue) => issue.code === code)

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
    const plan = decoratedPlan()
    const plain = structuredClone(plan)
    delete decorated(plain).decor

    expect(buildPartsList(plan, catalog)).toEqual(buildPartsList(plain, catalog))
    expect(deriveSupportTrackPlans(plan, catalog)).toEqual(deriveSupportTrackPlans(plain, catalog))

    decorated(plan).variantId = 'steel-667-300'
    expect(hasIssue(plan, 'decor-fit')).toBe(true)

    decorated(plan).decor = {
      kind: 'art-books',
      arrangement: 'upright',
      count: 4,
      position: 'centre',
    }
    expect(hasIssue(plan, 'decor-fit')).toBe(false)

    decorated(plan).orientation = 'vertical'
    expect(hasIssue(plan, 'decor-fit')).toBe(true)
  })

  it('round-trips decor through a shared link and rejects malformed bounds', () => {
    const plan = decoratedPlan()
    const decoded = decodePlanHash(encodePlanHash(plan), catalog)
    expect(decoded.status).toBe('valid')
    if (decoded.status === 'valid') {
      expect(decorated(decoded.plan).decor).toEqual(decorated(plan).decor)
    }

    const malformed = structuredClone(plan)
    decorated(malformed).decor!.count = 25
    expect(parsePlan(JSON.stringify(malformed), catalog)).toBeUndefined()
  })

  it('preserves decor through duplication, undo and a bay-width change', () => {
    const plan = decoratedPlan()
    const source = decorated(plan)
    const duplicate = proposeItemDuplicate(plan, catalog, { ...source, bayIndex: 1 })
    expect(duplicate?.valid).toBe(true)
    expect(duplicate?.candidate.decor).toEqual(source.decor)

    const history = commitHistory(createHistory(plan), duplicate!.plan)
    expect(undoHistory(history).present.system.items).toEqual(plan.system.items)

    const resized = resizeBay(plan, catalog, 0, 912)
    expect(resized.ok).toBe(true)
    if (resized.ok) {
      expect(decorated(resized.plan)).toMatchObject({
        id: source.id,
        variantId: 'steel-912-360',
        decor: source.decor,
      })
    }
  })

  it('blocks moving a decorated shelf beneath an obstruction', () => {
    const plan = decoratedPlan()
    plan.system.items = [...plan.system.items, shelf('upper-shelf', 1185)]
    const proposal = proposeItemMove(plan, catalog, { ...decorated(plan), height: 975 })

    expect(proposal?.valid).toBe(false)
    expect(
      validatePlan(proposal!.plan, catalog).find((issue) => issue.code === 'decor-clearance')
        ?.itemIds,
    ).toEqual(['decorated-shelf', 'upper-shelf'])
  })

  it('identifies both items when another shelf enters the decor volume', () => {
    const plan = decoratedPlan()
    const upper = shelf('new-shelf', 765)
    const next = structuredClone(plan)
    next.system.items = [...next.system.items, upper]

    expect(canPlaceItem(plan, catalog, upper)).toBe(false)
    expect(
      validatePlan(next, catalog).find((issue) => issue.code === 'decor-clearance')?.itemIds,
    ).toEqual(['decorated-shelf', 'new-shelf'])
  })
})
