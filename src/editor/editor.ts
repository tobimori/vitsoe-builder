import { useAtom, useSelector } from '@xstate/store-react'
import { catalog } from '../domain/catalog/catalog'
import { parsePlan } from '../domain/plan/codec'
import { initialPlan } from '../domain/plan/defaults'
import { resolveInitialPlan } from '../domain/plan/share'
import type { Plan } from '../domain/plan/types'
import { editPlanId, library, newPlanId, storedPlan } from './library'
import { createEditor, createEditorSelectors, type EditorContext } from './store'

const normalised = (plan: Plan) => JSON.stringify(parsePlan(JSON.stringify(plan), catalog))

/** A link to another plan opens as a new saved plan, so it does not replace the one being edited. */
export function keepSharedPlan(shared: Plan, editing: Plan | undefined) {
  if (editing && normalised(shared) !== normalised(editing)) editPlanId(newPlanId())
}

const saved = storedPlan(library.get().current)
const initial = resolveInitialPlan(window.location.hash, saved, catalog, initialPlan)
if (initial.source === 'url')
  keepSharedPlan(initial.plan, saved ? parsePlan(saved, catalog) : undefined)

export const editor = createEditor(initial.plan, initial.warning ?? null)

export const selectors = createEditorSelectors(editor)

export function useEditor<T>(select: (context: EditorContext) => T) {
  return useSelector(editor, (snapshot) => select(snapshot.context))
}

/**
 * Edits the plan as it is when the event happens. Handlers that close over the rendered plan
 * change with every edit, which re-renders their fields for unrelated changes.
 */
export function editPlan(change: (plan: Plan) => Plan) {
  editor.trigger.edit({ plan: change(selectors.plan.get()) })
}

export function usePlan() {
  return useAtom(selectors.plan)
}

export function useSelectedItem() {
  const plan = usePlan()
  const selection = useEditor((context) => context.selection)
  return selection?.type === 'item'
    ? plan.system.items.find((item) => item.id === selection.id)
    : undefined
}
