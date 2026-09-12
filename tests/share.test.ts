import { describe, expect, it } from 'vite-plus/test'
import { catalog } from '../src/data/catalog'
import { initialDocument } from '../src/domain/defaults'
import {
  MAX_SHARE_FRAGMENT_LENGTH,
  buildPlanUrl,
  decodePlanHash,
  encodePlanHash,
  resolveInitialPlan,
} from '../src/domain/share'
import type { BuilderDocument } from '../src/domain/types'

const copy = (): BuilderDocument => structuredClone(initialDocument)

describe('share links', () => {
  it('round-trips the complete plan including rear components and attached accessories', () => {
    const document = copy()
    document.name = 'Two-sided studio'
    document.room = { width: 5350, depth: 4400, ceilingHeight: 3100, showDimensions: false }
    document.system.mountingType = 'floor-to-ceiling'
    document.system.mountHeight = 205
    document.system.activeFace = 'back'
    document.system.finish = { colour: 'black', wood: 'beech' }
    document.system.placement = { x: 880, z: 1240, rotation: 90 }
    document.system.items.push(
      {
        id: 'rear-shelf',
        productId: 'shelf',
        variantId: 'steel-667-220',
        bayIndex: 1,
        height: 695,
        face: 'back',
        finish: 'black',
        finishOverride: 'system',
      },
      {
        id: 'rear-bookend',
        productId: 'bookend',
        variantId: 'bookend-standard',
        bayIndex: 1,
        height: 695,
        face: 'back',
        finish: 'black',
        finishOverride: 'system',
        parentItemId: 'rear-shelf',
      },
    )

    const decoded = decodePlanHash(encodePlanHash(document), catalog)
    expect(decoded.status).toBe('valid')
    if (decoded.status === 'valid') expect(decoded.document).toEqual(document)
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
      initialDocument,
    )
    expect(resolved).toMatchObject({ source: 'url', document: { name: 'From the link' } })
  })

  it('falls back safely and explains malformed, empty and unsupported links', () => {
    const local = copy()
    local.name = 'Safe local plan'
    const saved = JSON.stringify(local)

    for (const hash of ['#plan=', '#plan=v2.abc', '#plan=v1.not!base64']) {
      const resolved = resolveInitialPlan(hash, saved, catalog, initialDocument)
      expect(resolved.source).toBe('local')
      expect(resolved.document.name).toBe('Safe local plan')
      expect(resolved.warning).toBeTruthy()
    }

    expect(
      decodePlanHash(`#plan=v1.${'a'.repeat(MAX_SHARE_FRAGMENT_LENGTH + 1)}`, catalog).status,
    ).toBe('invalid')
  })

  it('preserves the page address and replaces its previous fragment', () => {
    const document = copy()
    const url = buildPlanUrl(document, 'http://100.90.46.105:5173/planner?room=studio#old')
    expect(url).toMatch(/^http:\/\/100\.90\.46\.105:5173\/planner\?room=studio#plan=v1\./)
    expect(url).not.toContain('#old')
    expect(encodePlanHash(document)).toBe(encodePlanHash(document))
  })
})
