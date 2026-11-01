import { describe, expect, it } from 'vite-plus/test'
import { catalog } from '../catalog/catalog'
import { initialPlan } from './defaults'
import { buildPlanUrl, decodePlanHash, encodePlanHash, resolveInitialPlan } from './share'
import type { Plan } from './types'

const copy = (): Plan => structuredClone(initialPlan)

describe('share links', () => {
  it('round-trips the complete plan including rear components and attached accessories', () => {
    const plan = copy()
    plan.name = 'Two-sided studio'
    plan.room = { width: 5350, depth: 4400, ceilingHeight: 3100 }
    plan.system.mountingType = 'floor-to-ceiling'
    plan.system.mountHeight = 205
    plan.system.finish = { colour: 'black', wood: 'beech' }
    plan.system.placement = { x: 880, z: 1240, rotation: 90 }
    plan.system.items = [
      ...plan.system.items,
      {
        id: 'rear-shelf',
        productId: 'shelf',
        variantId: 'steel-667-220',
        bayIndex: 1,
        height: 695,
        face: 'back',
        finish: 'system',
      },
      {
        id: 'rear-bookend',
        productId: 'bookend',
        variantId: 'bookend-standard',
        bayIndex: 1,
        height: 695,
        face: 'back',
        finish: 'black',
        parentItemId: 'rear-shelf',
      },
    ]

    expect(decodePlanHash(encodePlanHash(plan), catalog)).toEqual({ status: 'valid', plan })
  })

  it('loads a shared plan before a different local plan', () => {
    const shared = copy()
    shared.name = 'From the link'
    const local = copy()
    local.name = 'From this device'

    const resolved = resolveInitialPlan(
      encodePlanHash(shared),
      JSON.stringify(local),
      catalog,
      initialPlan,
    )
    expect(resolved).toMatchObject({ source: 'url', plan: { name: 'From the link' } })
  })

  it('falls back safely and explains malformed, empty and oversized links', () => {
    const local = copy()
    local.name = 'Safe local plan'
    const saved = JSON.stringify(local)

    for (const hash of [
      '#plan=',
      '#plan=abc',
      '#plan=not!base64',
      `#plan=${'a'.repeat(250_001)}`,
    ]) {
      const resolved = resolveInitialPlan(hash, saved, catalog, initialPlan)
      expect(resolved.source).toBe('local')
      expect(resolved.plan.name).toBe('Safe local plan')
      expect(resolved.warning).toBeTruthy()
    }
  })

  it('preserves the page address and replaces its previous fragment', () => {
    const plan = copy()
    const url = buildPlanUrl(plan, 'http://100.90.46.105:5173/planner?room=studio#old')
    expect(url).toMatch(/^http:\/\/100\.90\.46\.105:5173\/planner\?room=studio#plan=[\w-]+$/)
    expect(encodePlanHash(plan)).toBe(encodePlanHash(plan))
  })
})
