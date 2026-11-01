import { expect, it } from 'vite-plus/test'
import { catalog } from '../catalog/catalog'
import { buildPartsList } from '../pricing/parts'
import { initialPlan } from './defaults'
import { resolveItemFinish } from './finish'
import type { Plan } from './types'

it('resolves global colour, supported beech and fixed materials consistently', () => {
  const plan: Plan = structuredClone(initialPlan)
  plan.system.finish = { colour: 'black', wood: 'beech' }
  const resolve = (productId: string, variantId: string) =>
    resolveItemFinish(plan.system.finish, { productId, variantId, finish: 'system' }, catalog)

  expect(resolve('shelf', 'steel-667-220').finish).toBe('black')
  expect(resolve('cabinet', 'cabinet-667')).toMatchObject({ finish: 'beech', frontFinish: 'black' })
  expect(resolve('drawer-liner', 'drawer-liner-667').materialLabel).toBe('Grey wool felt')

  const parts = buildPartsList(plan, catalog)
  expect(parts.find((line) => line.id.includes('cabinet-667/beech/black'))?.unitPriceEur).toBe(1005)
})
