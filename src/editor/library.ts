import { createAtom } from '@xstate/store'
import * as v from 'valibot'
import type { Plan } from '../domain/plan/types'

const INDEX_KEY = 'vitsoe-606-plans'
const CURRENT_KEY = 'vitsoe-606-current'
const planKey = (id: string) => `vitsoe-606-plan-${id}`

export interface SavedPlan {
  id: string
  name: string
  /** When it was last saved, in milliseconds since the epoch. */
  saved: number
}

const indexSchema = v.array(v.object({ id: v.string(), name: v.string(), saved: v.number() }))

// Private browsing can block storage; the plan then lives only in the link
function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function readIndex(): SavedPlan[] {
  try {
    return v.parse(indexSchema, JSON.parse(read(INDEX_KEY) ?? '[]'))
  } catch {
    return []
  }
}

export const newPlanId = () => crypto.randomUUID()

const index = readIndex()
const current = read(CURRENT_KEY)

/** The plans saved in this browser, most recently saved first, and the one being edited. */
export const library = createAtom({
  current: current !== null && index.some((plan) => plan.id === current) ? current : newPlanId(),
  plans: index,
})

export function storedPlan(id: string) {
  return read(planKey(id))
}

/** Saves the plan being edited. Throws when storage is full or blocked. */
export function storePlan(plan: Plan) {
  const { current, plans } = library.get()
  const next = [
    { id: current, name: plan.name, saved: Date.now() },
    ...plans.filter((entry) => entry.id !== current),
  ]
  localStorage.setItem(planKey(current), JSON.stringify(plan))
  localStorage.setItem(INDEX_KEY, JSON.stringify(next))
  localStorage.setItem(CURRENT_KEY, current)
  library.set({ current, plans: next })
}

/** Makes `id` the plan being edited; it is saved with the next change. */
export function editPlanId(id: string) {
  library.set({ ...library.get(), current: id })
}

export function forgetPlan(id: string) {
  const plans = library.get().plans.filter((entry) => entry.id !== id)
  try {
    localStorage.removeItem(planKey(id))
    localStorage.setItem(INDEX_KEY, JSON.stringify(plans))
  } catch {
    // Nothing was stored
  }
  library.set({ ...library.get(), plans })
}
