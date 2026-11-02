import { describe, expect, it } from 'vite-plus/test'
import { catalog } from '../catalog/catalog'
import { initialPlan } from '../plan/defaults'
import { holeOrigin, snapPinHeight } from '../placement/grid'
import type { Plan } from '../plan/types'
import {
  deriveSupportTrackPlans,
  recommendETracks,
  supportTrackAcceptsPin,
  trackHoleHeights,
} from './tracks'

const copy = (): Plan => structuredClone(initialPlan)

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
    const plan = copy()
    plan.system.mountingType = 'floor-to-ceiling'
    plan.system.mountHeight = 205
    plan.system.bays = [
      { id: 'wide', centreWidth: 912 },
      { id: 'narrow', centreWidth: 667 },
    ]
    plan.system.items = [
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

    const tracks = deriveSupportTrackPlans(plan, catalog)
    expect(tracks).toHaveLength(6)
    const [frontLeft, frontMiddle, frontRight] = tracks.filter((track) => track.face === 'front')
    const [, backMiddle, backRight] = tracks.filter((track) => track.face === 'back')
    expect(frontLeft!.requiredLength).toBe(frontMiddle!.requiredLength)
    expect(frontMiddle!.requiredLength).toBeGreaterThan(frontRight!.requiredLength)
    expect(backMiddle!.requiredLength).toBe(backRight!.requiredLength)
    expect(frontLeft!.top).toBe(
      frontLeft!.bottom +
        frontLeft!.segments.reduce((sum, segment) => sum + segment.installedLength, 0),
    )
  })

  it('uses an exact installed length in manual mode, including dedicated profiles', () => {
    const plan = copy()
    plan.system.trackMode = 'manual'
    plan.system.railHeight = 1600
    expect(deriveSupportTrackPlans(plan, catalog)[0]).toMatchObject({
      requiredLength: 1600,
      segments: [{ stockLength: 1710, installedLength: 1600, cut: true }],
    })

    plan.system.railHeight = 395
    expect(deriveSupportTrackPlans(plan, catalog)[0]).toMatchObject({
      segments: [{ stockLength: 395, installedLength: 395, cut: false, estimatedPriceEur: 40 }],
    })
  })
})

describe('E-track hole grid', () => {
  it('snaps attachment pins to the 70 mm E-track grid from the track origin', () => {
    const plan = copy()
    plan.system.mountHeight = 345
    expect(snapPinHeight(701, plan)).toBe(730)
    expect(snapPinHeight(770, plan)).toBe(800)
  })

  it('extends an automatic track below a baseline carrier and omits unsafe join holes', () => {
    const plan = copy()
    const { mountHeight } = plan.system
    const origin = holeOrigin(plan)
    plan.system.bays = [{ id: 'narrow', centreWidth: 667 }]
    plan.system.items = [
      {
        id: 'baseline-shelf',
        productId: 'shelf',
        variantId: 'steel-667-220',
        bayIndex: 0,
        height: origin - 70,
        face: 'front',
        finish: 'off-white',
      },
    ]
    const track = deriveSupportTrackPlans(plan, catalog)[0]!
    expect(track.bottom).toBe(mountHeight - 70)
    expect(supportTrackAcceptsPin(track, origin - 70, origin)).toBe(true)

    const joined = {
      ...track,
      bottom: 345,
      top: 1485,
      segments: [
        { stockLength: 570, installedLength: 570, cut: false, estimatedPriceEur: 0 },
        { stockLength: 570, installedLength: 570, cut: false, estimatedPriceEur: 0 },
      ],
    }
    const holes = trackHoleHeights(joined, origin)
    expect(holes[0]).toBe(380)
    expect(holes.every((height) => Math.abs(height - 915) >= 10)).toBe(true)
    expect(holes.at(-1)).toBeLessThanOrEqual(1475)
  })
})
