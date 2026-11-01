import { catalog } from '../domain/catalog/catalog'
import { buildPlanUrl, decodePlanHash } from '../domain/plan/share'
import type { Plan } from '../domain/plan/types'
import { editor, selectors, STORAGE_KEY } from './editor'

/** Keeps local storage and the address bar in step with the plan, and loads pasted links. */
export function syncPlan() {
  let timer: number | undefined

  const write = (plan: Plan) => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
        editor.trigger.saved({ saved: true })
      } catch {
        editor.trigger.saved({ saved: false })
      }
    }, 250)

    try {
      window.history.replaceState(
        window.history.state,
        '',
        buildPlanUrl(plan, window.location.href),
      )
    } catch {
      editor.trigger.notify({ notice: 'This plan is too large to store in a shareable link.' })
    }
  }

  write(selectors.plan.get())
  selectors.plan.subscribe(write)

  window.addEventListener('hashchange', () => {
    const shared = decodePlanHash(window.location.hash, catalog)
    if (shared.status === 'invalid') editor.trigger.notify({ notice: shared.message })
    if (shared.status === 'valid')
      editor.trigger.load({ plan: shared.plan, notice: 'Shared plan loaded.' })
  })
}
