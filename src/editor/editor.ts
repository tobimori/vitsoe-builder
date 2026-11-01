import { useAtom, useSelector } from '@xstate/store-react'
import { catalog } from '../domain/catalog/catalog'
import { initialPlan } from '../domain/plan/defaults'
import { resolveInitialPlan } from '../domain/plan/share'
import { createEditor, createEditorSelectors, type EditorContext } from './store'

export const STORAGE_KEY = 'vitsoe-606-plan'

function savedPlan() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private browsing can block storage; shared links still work
    return null
  }
}

const initial = resolveInitialPlan(window.location.hash, savedPlan(), catalog, initialPlan)

export const editor = createEditor(initial.plan, initial.warning ?? null)

export const selectors = createEditorSelectors(editor)

export function useEditor<T>(select: (context: EditorContext) => T) {
  return useSelector(editor, (snapshot) => select(snapshot.context))
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
