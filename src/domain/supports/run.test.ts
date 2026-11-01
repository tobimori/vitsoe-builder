import { expect, it } from 'vite-plus/test'
import { catalog } from '../catalog/catalog'
import { initialPlan } from '../plan/defaults'
import type { Plan } from '../plan/types'
import { moveSupportRun } from './run'
import { deriveSupportTrackPlans } from './tracks'

const copy = (): Plan => structuredClone(initialPlan)

it('moves a connected wall run and its fitted items by one committed elevation delta', () => {
  const plan = copy()
  const { x, z } = plan.system.placement
  const before = deriveSupportTrackPlans(plan, catalog)
  const moved = moveSupportRun(plan, { x, z, mountHeight: plan.system.mountHeight + 140 })
  const after = deriveSupportTrackPlans(moved, catalog)

  expect(moved.system.items.map((item) => item.height)).toEqual(
    plan.system.items.map((item) => item.height + 140),
  )
  expect(after.map((track) => track.bottom)).toEqual(before.map((track) => track.bottom + 140))
  expect(after.map((track) => track.top)).toEqual(before.map((track) => track.top + 140))
})

it('keeps wall-run elevation fixed when an integrated table reaches the floor', () => {
  const plan = copy()
  plan.system.items = [
    ...plan.system.items,
    {
      id: 'table',
      productId: 'table',
      variantId: 'table-667',
      bayIndex: 1,
      height: 740,
      face: 'front',
      finish: 'system',
    },
  ]
  const { x, z } = plan.system.placement

  expect(moveSupportRun(plan, { x, z, mountHeight: 625 }).system.mountHeight).toBe(
    plan.system.mountHeight,
  )
})
