import { describe, expect, it } from 'vite-plus/test'
import { catalog } from '../catalog/catalog'
import { validatePlan } from '../validation/validate'
import { parsePlan } from './codec'
import { initialPlan } from './defaults'
import type { Plan } from './types'

const copy = (): Plan => structuredClone(initialPlan)

const parse = (plan: Plan) => parsePlan(JSON.stringify(plan), catalog)

const issueCodes = (plan: Plan | undefined) =>
  plan ? validatePlan(plan, catalog).map((issue) => issue.code) : []

describe('saved-plan parsing', () => {
  it('rejects duplicate IDs, unknown variants and incompatible accessory hosts', () => {
    const duplicate = copy()
    duplicate.system.items[1]!.id = duplicate.system.items[0]!.id
    expect(parse(duplicate)).toBeUndefined()

    const unknown = copy()
    unknown.system.items[0]!.variantId = 'not-a-real-variant'
    expect(parse(unknown)).toBeUndefined()

    const invalidHost = copy()
    invalidHost.system.items = [
      ...invalidHost.system.items,
      {
        id: 'liner',
        productId: 'drawer-liner',
        variantId: 'drawer-liner-667',
        bayIndex: 1,
        height: 1045,
        face: 'front',
        finish: 'silver',
        parentItemId: 'item-1',
      },
    ]
    expect(parse(invalidHost)).toBeUndefined()
  })

  it('loads reachable in-progress fit conflicts so the builder can show and repair them', () => {
    const bayMismatch = copy()
    bayMismatch.system.bays[0]!.centreWidth = 667
    const parsedBayMismatch = parse(bayMismatch)
    expect(parsedBayMismatch).toBeDefined()
    expect(issueCodes(parsedBayMismatch)).toContain('bay-fit')

    const faceMismatch = copy()
    faceMismatch.system.items[0]!.face = 'back'
    const parsedFaceMismatch = parse(faceMismatch)
    expect(parsedFaceMismatch).toBeDefined()
    expect(issueCodes(parsedFaceMismatch)).toContain('invalid-face')
  })

  it('reloads items left off-grid by a mounting-mode baseline change', () => {
    const inProgress = copy()
    inProgress.system.items = inProgress.system.items.map((item) => ({
      ...item,
      height: item.height - 12,
    }))
    inProgress.system.mountingType = 'floor-to-ceiling'
    inProgress.system.mountHeight = 205
    inProgress.system.placement.z = 600

    const parsed = parse(inProgress)
    expect(parsed).toBeDefined()
    expect(issueCodes(parsed)).toContain('track-slot')
  })
})
