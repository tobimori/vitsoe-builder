import { catalog } from '../domain/catalog/catalog'
import { parsePlan } from '../domain/plan/codec'
import { initialPlan } from '../domain/plan/defaults'
import { buildPlanUrl, decodePlanHash } from '../domain/plan/share'
import type { Plan } from '../domain/plan/types'
import { editor, keepSharedPlan, selectors } from './editor'
import { editPlanId, forgetPlan, library, newPlanId, storedPlan, storePlan } from './library'

let timer: number | undefined

function write() {
  window.clearTimeout(timer)
  const plan = selectors.plan.get()
  try {
    storePlan(plan)
    editor.trigger.saved({ saved: true })
  } catch {
    editor.trigger.saved({ saved: false })
  }

  try {
    window.history.replaceState(window.history.state, '', buildPlanUrl(plan, window.location.href))
  } catch {
    editor.trigger.notify({ notice: 'This plan is too large to store in a shareable link.' })
  }
}

/** Keeps local storage and the address bar in step with the plan, and loads pasted links. */
export function syncPlan() {
  write()
  // Drags and typing change the plan on every event; compressing and storing it each time stutters
  selectors.plan.subscribe(() => {
    window.clearTimeout(timer)
    timer = window.setTimeout(write, 250)
  })
  window.addEventListener('pagehide', write)

  window.addEventListener('hashchange', () => {
    const shared = decodePlanHash(window.location.hash, catalog)
    if (shared.status === 'invalid') editor.trigger.notify({ notice: shared.message })
    if (shared.status !== 'valid') return
    write()
    keepSharedPlan(shared.plan, selectors.plan.get())
    editor.trigger.load({ plan: shared.plan, notice: 'Shared plan loaded.' })
  })
}

function open(id: string, plan: Plan, notice: string) {
  editPlanId(id)
  editor.trigger.load({ plan, notice })
}

/** Starts a new saved plan, empty or from another plan. */
export function newPlan(plan: Plan = initialPlan, notice = 'New plan started.') {
  write()
  open(newPlanId(), plan, notice)
}

export function openPlan(id: string) {
  const plan = parsePlan(storedPlan(id) ?? '', catalog)
  if (!plan) {
    forgetPlan(id)
    editor.trigger.notify({ notice: 'That plan could not be read, so it was removed.' })
    return
  }
  write()
  open(id, plan, `${plan.name} opened.`)
}

/** Deletes a saved plan; deleting the one being edited opens another. */
export function removePlan(id: string) {
  if (id === library.get().current) deletePlan()
  else forgetPlan(id)
}

/** Deletes the plan being edited and opens the most recent other one, or a new plan. */
export function deletePlan() {
  const { current } = library.get()
  const { name } = selectors.plan.get()
  window.clearTimeout(timer)
  forgetPlan(current)

  const next = library.get().plans[0]
  const plan = next && parsePlan(storedPlan(next.id) ?? '', catalog)
  if (next && plan) open(next.id, plan, `${name} deleted.`)
  else open(newPlanId(), initialPlan, `${name} deleted.`)
}
